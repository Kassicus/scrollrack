import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScryfallCard } from '@/types/scryfall.types'
import type { RecognitionResult } from '@/hooks/useCardRecognition'

export interface ScanHistoryItem {
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

  // Scan settings (persisted)
  autoCapture: boolean
  setAutoCapture: (enabled: boolean) => void
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  selectedCameraId: string
  setSelectedCameraId: (id: string) => void
  resolution: '480p' | '720p' | '1080p'
  setResolution: (res: '480p' | '720p' | '1080p') => void
  cameraRotation: boolean
  setCameraRotation: (rotated: boolean) => void
  postScanDelay: number
  setPostScanDelay: (delay: number) => void
  // Performance mode for low-power devices like Raspberry Pi
  performanceMode: boolean
  setPerformanceMode: (enabled: boolean) => void

  // Scan history (session-based)
  scanHistory: ScanHistoryItem[]
  addToHistory: (card: ScryfallCard, quantity: number, isFoil: boolean) => void
  removeFromHistory: (id: string) => ScanHistoryItem | undefined
  clearHistory: () => void

  // Pending card (awaiting confirmation)
  pendingCard: ScryfallCard | null
  setPendingCard: (card: ScryfallCard | null) => void

  // Last added card info
  lastAdded: { card: ScryfallCard; quantity: number; isFoil: boolean } | null
  setLastAdded: (info: { card: ScryfallCard; quantity: number; isFoil: boolean } | null) => void
}

export const useScanStore = create<ScanState>()(
  persist(
    (set) => ({
      currentResult: null,
      setCurrentResult: (result) => set({ currentResult: result }),

      autoCapture: true,
      setAutoCapture: (enabled) => set({ autoCapture: enabled }),
      soundEnabled: true,
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      selectedCameraId: '',
      setSelectedCameraId: (id) => set({ selectedCameraId: id }),
      resolution: '720p',
      setResolution: (res) => set({ resolution: res }),
      cameraRotation: false,
      setCameraRotation: (rotated) => set({ cameraRotation: rotated }),
      postScanDelay: 500,
      setPostScanDelay: (delay) => set({ postScanDelay: delay }),
      performanceMode: false,
      setPerformanceMode: (enabled) => set({ performanceMode: enabled }),

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
      removeFromHistory: (id) => {
        let removedItem: ScanHistoryItem | undefined
        set((state) => {
          removedItem = state.scanHistory.find((item) => item.id === id)
          return {
            scanHistory: state.scanHistory.filter((item) => item.id !== id),
          }
        })
        return removedItem
      },
      clearHistory: () => set({ scanHistory: [] }),

      pendingCard: null,
      setPendingCard: (card) => set({ pendingCard: card }),

      lastAdded: null,
      setLastAdded: (info) => set({ lastAdded: info }),
    }),
    {
      name: 'mtg-scanner-settings',
      partialize: (state) => ({
        autoCapture: state.autoCapture,
        soundEnabled: state.soundEnabled,
        selectedCameraId: state.selectedCameraId,
        resolution: state.resolution,
        cameraRotation: state.cameraRotation,
        postScanDelay: state.postScanDelay,
        performanceMode: state.performanceMode,
      }),
    }
  )
)
