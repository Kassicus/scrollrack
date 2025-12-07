import { create } from 'zustand'
import type { ViewMode } from '@/types/card.types'

interface AppState {
  currentView: ViewMode
  setCurrentView: (view: ViewMode) => void

  totalCards: number
  uniqueCards: number
  totalValue: number
  setStats: (stats: { totalCards: number; uniqueCards: number; totalValue: number }) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'scan',
  setCurrentView: (view) => set({ currentView: view }),

  totalCards: 0,
  uniqueCards: 0,
  totalValue: 0,
  setStats: (stats) => set(stats),
}))
