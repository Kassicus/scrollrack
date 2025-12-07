import { useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, databaseService } from '@/services/database.service'
import { useAppStore } from '@/store/appStore'

export function useCollection() {
  const setStats = useAppStore((state) => state.setStats)

  const cards = useLiveQuery(() => db.cards.orderBy('dateModified').reverse().toArray())

  const refreshStats = useCallback(async () => {
    const [totalCards, uniqueCards, totalValue] = await Promise.all([
      databaseService.getTotalCards(),
      databaseService.getUniqueCards(),
      databaseService.getTotalValue(),
    ])
    setStats({ totalCards, uniqueCards, totalValue })
  }, [setStats])

  useEffect(() => {
    refreshStats()
  }, [cards, refreshStats])

  return {
    cards: cards || [],
    isLoading: cards === undefined,
    refreshStats,
  }
}
