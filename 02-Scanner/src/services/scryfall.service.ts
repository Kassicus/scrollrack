import axios, { AxiosError } from 'axios'
import type { ScryfallCard, ScryfallAutocomplete, ScryfallError } from '@/types/scryfall.types'

const API_BASE = 'https://api.scryfall.com'
const MIN_REQUEST_DELAY = 100 // 10 requests per second max

class ScryfallService {
  private requestQueue: Array<() => Promise<void>> = []
  private isProcessing = false
  private lastRequestTime = 0
  private cache = new Map<string, { data: ScryfallCard; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Search for a card by exact name
   */
  async getCardByExactName(name: string): Promise<ScryfallCard | null> {
    const cacheKey = `exact:${name.toLowerCase()}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

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
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

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
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

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
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  private setCache(key: string, data: ScryfallCard): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  clearCache(): void {
    this.cache.clear()
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
