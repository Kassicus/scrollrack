import { create } from 'zustand'
import type { ScryfallCard } from '@/types/scryfall.types'
import type { RecognitionResult } from '@/hooks/useCardRecognition'

interface ScanHistoryItem {
  id: string
  card: ScryfallCard
  timestamp: Date
  quantity: number
  isFoil: boolean
}

interface ScanState {
  // Current scan result
  currentResult: RecognitionResult | null
  setCurrentResult: (result: RecognitionResult | null) => void

  // Scan settings
  autoCapture: boolean
  setAutoCapture: (enabled: boolean) => void
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void

  // Scan history (session-based)
  scanHistory: ScanHistoryItem[]
  addToHistory: (card: ScryfallCard, quantity: number, isFoil: boolean) => void
  clearHistory: () => void

  // Pending card (awaiting confirmation)
  pendingCard: ScryfallCard | null
  setPendingCard: (card: ScryfallCard | null) => void

  // Last added card info
  lastAdded: { card: ScryfallCard; quantity: number; isFoil: boolean } | null
  setLastAdded: (info: { card: ScryfallCard; quantity: number; isFoil: boolean } | null) => void
}

export const useScanStore = create<ScanState>((set) => ({
  currentResult: null,
  setCurrentResult: (result) => set({ currentResult: result }),

  autoCapture: true,
  setAutoCapture: (enabled) => set({ autoCapture: enabled }),
  soundEnabled: true,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  scanHistory: [],
  addToHistory: (card, quantity, isFoil) =>
    set((state) => ({
      scanHistory: [
        {
          id: crypto.randomUUID(),
          card,
          timestamp: new Date(),
          quantity,
          isFoil,
        },
        ...state.scanHistory,
      ].slice(0, 50), // Keep last 50 items
    })),
  clearHistory: () => set({ scanHistory: [] }),

  pendingCard: null,
  setPendingCard: (card) => set({ pendingCard: card }),

  lastAdded: null,
  setLastAdded: (info) => set({ lastAdded: info }),
}))
