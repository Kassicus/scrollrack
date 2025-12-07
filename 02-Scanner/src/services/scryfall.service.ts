import axios, { AxiosError } from 'axios'
import type { ScryfallCard, ScryfallAutocomplete, ScryfallError } from '@/types/scryfall.types'

const API_BASE = 'https://api.scryfall.com'
const MIN_REQUEST_DELAY = 100 // 10 requests per second max
const CACHE_DB_NAME = 'mtg-scanner-cache'
const CACHE_STORE_NAME = 'scryfall-cards'
const CACHE_VERSION = 1
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours - card data rarely changes

interface CachedCard {
  key: string
  data: ScryfallCard
  timestamp: number
}

class ScryfallService {
  private requestQueue: Array<() => Promise<void>> = []
  private isProcessing = false
  private lastRequestTime = 0
  // In-memory cache for fast access during session
  private memoryCache = new Map<string, { data: ScryfallCard; timestamp: number }>()
  private db: IDBDatabase | null = null
  private dbReady: Promise<void>

  constructor() {
    this.dbReady = this.initDB()
  }

  private initDB(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION)

        request.onerror = () => {
          console.warn('Scryfall cache DB failed to open, using memory-only cache')
          resolve()
        }

        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
            db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' })
          }
        }
      } catch {
        console.warn('IndexedDB not available, using memory-only cache')
        resolve()
      }
    })
  }

  /**
   * Search for a card by exact name
   */
  async getCardByExactName(name: string): Promise<ScryfallCard | null> {
    const cacheKey = `exact:${name.toLowerCase()}`

    // Check memory cache first
    const memoryCached = this.getFromCache(cacheKey)
    if (memoryCached) return memoryCached

    // Check persistent cache
    const persistentCached = await this.getFromPersistentCache(cacheKey)
    if (persistentCached) return persistentCached

    try {
      const response = await this.makeRequest<ScryfallCard>(
        `/cards/named?exact=${encodeURIComponent(name)}`
      )
      this.setCache(cacheKey, response)
      return response
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Search for a card by fuzzy name (handles typos)
   */
  async getCardByFuzzyName(name: string): Promise<ScryfallCard | null> {
    const cacheKey = `fuzzy:${name.toLowerCase()}`

    // Check memory cache first
    const memoryCached = this.getFromCache(cacheKey)
    if (memoryCached) return memoryCached

    // Check persistent cache
    const persistentCached = await this.getFromPersistentCache(cacheKey)
    if (persistentCached) return persistentCached

    try {
      const response = await this.makeRequest<ScryfallCard>(
        `/cards/named?fuzzy=${encodeURIComponent(name)}`
      )
      this.setCache(cacheKey, response)
      return response
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Get autocomplete suggestions for a partial card name
   */
  async getAutocomplete(query: string): Promise<string[]> {
    if (query.length < 2) return []

    try {
      const response = await this.makeRequest<ScryfallAutocomplete>(
        `/cards/autocomplete?q=${encodeURIComponent(query)}`
      )
      return response.data
    } catch {
      return []
    }
  }

  /**
   * Search for cards matching a query
   */
  async searchCards(query: string, limit = 10): Promise<ScryfallCard[]> {
    try {
      const response = await this.makeRequest<{ data: ScryfallCard[] }>(
        `/cards/search?q=${encodeURIComponent(query)}&unique=cards`
      )
      return response.data.slice(0, limit)
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return []
      }
      throw error
    }
  }

  /**
   * Get a card by its Scryfall ID
   */
  async getCardById(id: string): Promise<ScryfallCard | null> {
    const cacheKey = `id:${id}`

    // Check memory cache first
    const memoryCached = this.getFromCache(cacheKey)
    if (memoryCached) return memoryCached

    // Check persistent cache
    const persistentCached = await this.getFromPersistentCache(cacheKey)
    if (persistentCached) return persistentCached

    try {
      const response = await this.makeRequest<ScryfallCard>(`/cards/${id}`)
      this.setCache(cacheKey, response)
      return response
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Get all printings of a card
   */
  async getCardPrintings(oracleId: string): Promise<ScryfallCard[]> {
    try {
      const response = await this.makeRequest<{ data: ScryfallCard[] }>(
        `/cards/search?q=oracleid:${oracleId}&unique=prints`
      )
      return response.data
    } catch {
      return []
    }
  }

  /**
   * Smart card lookup - tries exact match, then fuzzy match
   */
  async lookupCard(name: string): Promise<CardLookupResult> {
    // Clean up the OCR result
    const cleanedName = this.normalizeCardName(name)

    if (!cleanedName || cleanedName.length < 2) {
      return { success: false, error: 'Name too short' }
    }

    // Try exact match first
    const exactMatch = await this.getCardByExactName(cleanedName)
    if (exactMatch) {
      return { success: true, card: exactMatch, matchType: 'exact' }
    }

    // Try fuzzy match
    const fuzzyMatch = await this.getCardByFuzzyName(cleanedName)
    if (fuzzyMatch) {
      return { success: true, card: fuzzyMatch, matchType: 'fuzzy' }
    }

    // Try autocomplete for suggestions
    const suggestions = await this.getAutocomplete(cleanedName)
    if (suggestions.length > 0) {
      return {
        success: false,
        error: 'No exact match found',
        suggestions: suggestions.slice(0, 5),
      }
    }

    return { success: false, error: 'Card not found' }
  }

  /**
   * Normalize card name from OCR output
   */
  private normalizeCardName(name: string): string {
    return name
      .trim()
      .replace(/[^\w\s\-',./]/g, '') // Remove special characters except common ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[^a-zA-Z]+/, '') // Remove leading non-letters
      .replace(/[^a-zA-Z]+$/, '') // Remove trailing non-letters
  }

  /**
   * Rate-limited request handler
   */
  private async makeRequest<T>(endpoint: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeRequest<T>(endpoint)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return

    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const elapsed = Date.now() - this.lastRequestTime
      if (elapsed < MIN_REQUEST_DELAY) {
        await this.sleep(MIN_REQUEST_DELAY - elapsed)
      }

      const request = this.requestQueue.shift()
      if (request) {
        this.lastRequestTime = Date.now()
        await request()
      }
    }

    this.isProcessing = false
  }

  private async executeRequest<T>(endpoint: string): Promise<T> {
    try {
      const response = await axios.get<T>(`${API_BASE}${endpoint}`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      return response.data
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          await this.sleep(1000)
          return this.executeRequest(endpoint)
        }
        if (error.response?.data) {
          const scryfallError = error.response.data as ScryfallError
          throw new Error(scryfallError.details || 'Scryfall API error')
        }
      }
      throw error
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return error.response?.status === 404
    }
    return false
  }

  private getFromCache(key: string): ScryfallCard | null {
    // Check memory cache first (fast path)
    const cached = this.memoryCache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
    if (cached) {
      this.memoryCache.delete(key)
    }
    return null
  }

  private async getFromPersistentCache(key: string): Promise<ScryfallCard | null> {
    await this.dbReady
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(CACHE_STORE_NAME, 'readonly')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.get(key)

        request.onsuccess = () => {
          const cached = request.result as CachedCard | undefined
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            // Also populate memory cache
            this.memoryCache.set(key, { data: cached.data, timestamp: cached.timestamp })
            resolve(cached.data)
          } else {
            resolve(null)
          }
        }

        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  private setCache(key: string, data: ScryfallCard): void {
    const timestamp = Date.now()
    // Set in memory cache
    this.memoryCache.set(key, { data, timestamp })
    // Persist to IndexedDB (fire and forget)
    this.persistToCache(key, data, timestamp)
  }

  private async persistToCache(key: string, data: ScryfallCard, timestamp: number): Promise<void> {
    await this.dbReady
    if (!this.db) return

    try {
      const transaction = this.db.transaction(CACHE_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(CACHE_STORE_NAME)
      store.put({ key, data, timestamp } as CachedCard)
    } catch {
      // Ignore persistence errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  clearCache(): void {
    this.memoryCache.clear()
    // Also clear IndexedDB cache
    if (this.db) {
      try {
        const transaction = this.db.transaction(CACHE_STORE_NAME, 'readwrite')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        store.clear()
      } catch {
        // Ignore
      }
    }
  }
}

export interface CardLookupResult {
  success: boolean
  card?: ScryfallCard
  matchType?: 'exact' | 'fuzzy'
  error?: string
  suggestions?: string[]
}

export const scryfallService = new ScryfallService()
