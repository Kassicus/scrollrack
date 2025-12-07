import Dexie, { type EntityTable } from 'dexie'
import type { CardEntry, ScanHistoryEntry } from '@/types/card.types'
import type { ScryfallCard } from '@/types/scryfall.types'

class CardDatabase extends Dexie {
  cards!: EntityTable<CardEntry, 'id'>
  scanHistory!: EntityTable<ScanHistoryEntry, 'id'>

  constructor() {
    super('MTGCardScanner')

    this.version(1).stores({
      cards: 'id, name, setCode, rarity, dateAdded, dateModified',
      scanHistory: '++id, cardId, timestamp',
    })
  }
}

const db = new CardDatabase()

export const databaseService = {
  async addCard(scryfallCard: ScryfallCard, quantity = 1, isFoil = false): Promise<CardEntry> {
    const existing = await db.cards.get(scryfallCard.id)

    if (existing) {
      const updates: Partial<CardEntry> = {
        dateModified: new Date(),
      }
      if (isFoil) {
        updates.foilQuantity = existing.foilQuantity + quantity
      } else {
        updates.quantity = existing.quantity + quantity
      }
      await db.cards.update(scryfallCard.id, updates)
      return { ...existing, ...updates } as CardEntry
    }

    const imageUri =
      scryfallCard.image_uris?.normal ||
      scryfallCard.card_faces?.[0]?.image_uris?.normal ||
      ''

    const newCard: CardEntry = {
      id: scryfallCard.id,
      name: scryfallCard.name,
      setCode: scryfallCard.set,
      setName: scryfallCard.set_name,
      collectorNumber: scryfallCard.collector_number,
      quantity: isFoil ? 0 : quantity,
      foilQuantity: isFoil ? quantity : 0,
      imageUri,
      manaCost: scryfallCard.mana_cost || '',
      typeLine: scryfallCard.type_line,
      rarity: scryfallCard.rarity as CardEntry['rarity'],
      priceUsd: scryfallCard.prices.usd ? parseFloat(scryfallCard.prices.usd) : null,
      priceFoilUsd: scryfallCard.prices.usd_foil
        ? parseFloat(scryfallCard.prices.usd_foil)
        : null,
      dateAdded: new Date(),
      dateModified: new Date(),
    }

    await db.cards.add(newCard)
    return newCard
  },

  async incrementCard(cardId: string, amount = 1, isFoil = false): Promise<CardEntry | null> {
    const card = await db.cards.get(cardId)
    if (!card) return null

    const updates: Partial<CardEntry> = {
      dateModified: new Date(),
    }
    if (isFoil) {
      updates.foilQuantity = card.foilQuantity + amount
    } else {
      updates.quantity = card.quantity + amount
    }

    await db.cards.update(cardId, updates)
    return { ...card, ...updates } as CardEntry
  },

  async decrementCard(cardId: string, amount = 1, isFoil = false): Promise<CardEntry | null> {
    const card = await db.cards.get(cardId)
    if (!card) return null

    const updates: Partial<CardEntry> = {
      dateModified: new Date(),
    }
    if (isFoil) {
      updates.foilQuantity = Math.max(0, card.foilQuantity - amount)
    } else {
      updates.quantity = Math.max(0, card.quantity - amount)
    }

    await db.cards.update(cardId, updates)
    return { ...card, ...updates } as CardEntry
  },

  async removeCard(cardId: string): Promise<void> {
    await db.cards.delete(cardId)
    await db.scanHistory.where('cardId').equals(cardId).delete()
  },

  async getCard(cardId: string): Promise<CardEntry | undefined> {
    return db.cards.get(cardId)
  },

  async getAllCards(): Promise<CardEntry[]> {
    return db.cards.orderBy('dateModified').reverse().toArray()
  },

  async searchCards(query: string): Promise<CardEntry[]> {
    const lowerQuery = query.toLowerCase()
    return db.cards
      .filter((card) => card.name.toLowerCase().includes(lowerQuery))
      .toArray()
  },

  async getCardsBySet(setCode: string): Promise<CardEntry[]> {
    return db.cards.where('setCode').equals(setCode).toArray()
  },

  async getCardsByRarity(rarity: CardEntry['rarity']): Promise<CardEntry[]> {
    return db.cards.where('rarity').equals(rarity).toArray()
  },

  async getTotalCards(): Promise<number> {
    const cards = await db.cards.toArray()
    return cards.reduce((sum, card) => sum + card.quantity + card.foilQuantity, 0)
  },

  async getUniqueCards(): Promise<number> {
    return db.cards.count()
  },

  async getTotalValue(): Promise<number> {
    const cards = await db.cards.toArray()
    return cards.reduce((sum, card) => {
      const regularValue = (card.priceUsd || 0) * card.quantity
      const foilValue = (card.priceFoilUsd || card.priceUsd || 0) * card.foilQuantity
      return sum + regularValue + foilValue
    }, 0)
  },

  async addScanHistory(
    cardId: string,
    confidence: number,
    wasManualEntry = false
  ): Promise<void> {
    await db.scanHistory.add({
      id: crypto.randomUUID(),
      cardId,
      timestamp: new Date(),
      confidence,
      wasManualEntry,
    })
  },

  async getRecentScans(limit = 10): Promise<ScanHistoryEntry[]> {
    return db.scanHistory.orderBy('timestamp').reverse().limit(limit).toArray()
  },

  async exportToJSON(): Promise<string> {
    const cards = await db.cards.toArray()
    return JSON.stringify(cards, null, 2)
  },

  async exportToCSV(): Promise<string> {
    const cards = await db.cards.toArray()
    const headers = [
      'name',
      'setCode',
      'setName',
      'collectorNumber',
      'quantity',
      'foilQuantity',
      'rarity',
      'priceUsd',
      'priceFoilUsd',
    ]

    const rows = cards.map((card) =>
      headers
        .map((header) => {
          const value = card[header as keyof CardEntry]
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value ?? ''
        })
        .join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  },

  async importFromJSON(jsonString: string): Promise<{ imported: number; errors: number }> {
    try {
      const cards = JSON.parse(jsonString) as CardEntry[]
      let imported = 0
      let errors = 0

      for (const card of cards) {
        try {
          await db.cards.put({
            ...card,
            dateAdded: new Date(card.dateAdded),
            dateModified: new Date(),
          })
          imported++
        } catch {
          errors++
        }
      }

      return { imported, errors }
    } catch {
      throw new Error('Invalid JSON format')
    }
  },

  async clearAllData(): Promise<void> {
    await db.cards.clear()
    await db.scanHistory.clear()
  },
}

export { db }
