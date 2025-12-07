import { useState, useMemo } from 'react'
import { Search, Filter, Grid, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardTile } from '@/components/cards/CardTile'
import { CardDetailModal } from '@/components/modals/CardDetailModal'
import { useCollection } from '@/hooks/useCollection'
import { cn } from '@/lib/utils'
import type { CardEntry } from '@/types/card.types'

const ITEMS_PER_PAGE = 24

const rarityOptions = [
  { value: '', label: 'All Rarities' },
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'mythic', label: 'Mythic' },
  { value: 'special', label: 'Special' },
] as const

const sortOptions = [
  { value: 'dateModified', label: 'Recently Added' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'value', label: 'Value (High-Low)' },
  { value: 'value-asc', label: 'Value (Low-High)' },
  { value: 'quantity', label: 'Quantity (High-Low)' },
  { value: 'rarity', label: 'Rarity' },
] as const

type SortOption = (typeof sortOptions)[number]['value']

const rarityOrder: Record<CardEntry['rarity'], number> = {
  mythic: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
  special: 4,
  bonus: 5,
}

export function CollectionView() {
  const { cards, isLoading } = useCollection()
  const [searchQuery, setSearchQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [setFilter, setSetFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('dateModified')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<CardEntry | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const uniqueSets = useMemo(() => {
    const sets = new Map<string, string>()
    cards.forEach((card) => sets.set(card.setCode, card.setName))
    return Array.from(sets.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
  }, [cards])

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.typeLine.toLowerCase().includes(query) ||
          card.setName.toLowerCase().includes(query)
      )
    }

    if (rarityFilter) {
      result = result.filter((card) => card.rarity === rarityFilter)
    }

    if (setFilter) {
      result = result.filter((card) => card.setCode === setFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'value': {
          const valueA = (a.priceUsd || 0) * a.quantity + (a.priceFoilUsd || a.priceUsd || 0) * a.foilQuantity
          const valueB = (b.priceUsd || 0) * b.quantity + (b.priceFoilUsd || b.priceUsd || 0) * b.foilQuantity
          return valueB - valueA
        }
        case 'value-asc': {
          const valueA = (a.priceUsd || 0) * a.quantity + (a.priceFoilUsd || a.priceUsd || 0) * a.foilQuantity
          const valueB = (b.priceUsd || 0) * b.quantity + (b.priceFoilUsd || b.priceUsd || 0) * b.foilQuantity
          return valueA - valueB
        }
        case 'quantity':
          return (b.quantity + b.foilQuantity) - (a.quantity + a.foilQuantity)
        case 'rarity':
          return rarityOrder[a.rarity] - rarityOrder[b.rarity]
        case 'dateModified':
        default:
          return new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime()
      }
    })

    return result
  }, [cards, searchQuery, rarityFilter, setFilter, sortBy])

  const totalPages = Math.ceil(filteredAndSortedCards.length / ITEMS_PER_PAGE)
  const paginatedCards = filteredAndSortedCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleRarityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRarityFilter(e.target.value)
    setCurrentPage(1)
  }

  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSetFilter(e.target.value)
    setCurrentPage(1)
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setRarityFilter('')
    setSetFilter('')
    setSortBy('dateModified')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchQuery || rarityFilter || setFilter

  if (isLoading) {
    return (
      <div className="flex-1 container mx-auto p-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">Loading collection...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 container mx-auto p-4 flex flex-col gap-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, type, or set..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full bg-input border border-border rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={rarityFilter}
                onChange={handleRarityChange}
                className="bg-input border border-border rounded-md pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                {rarityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={setFilter}
              onChange={handleSetChange}
              className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer max-w-[200px]"
            >
              <option value="">All Sets</option>
              {uniqueSets.map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code.toUpperCase()})
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={handleSortChange}
              className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-input hover:bg-accent'
                )}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-input hover:bg-accent'
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          Showing {paginatedCards.length} of {filteredAndSortedCards.length} cards
          {hasActiveFilters && ` (${cards.length} total)`}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="text-muted-foreground text-center py-16">
            Your collection is empty. Start scanning cards to build your inventory.
          </div>
        </div>
      ) : filteredAndSortedCards.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="text-muted-foreground text-center py-16">
            No cards match your search criteria.
            <button
              onClick={clearFilters}
              className="block mx-auto mt-2 text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {paginatedCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {paginatedCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="w-full flex items-center gap-4 p-3 hover:bg-accent transition-colors text-left"
            >
              {card.imageUri && (
                <img
                  src={card.imageUri}
                  alt={card.name}
                  className="w-12 h-auto rounded"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{card.name}</p>
                <p className="text-sm text-muted-foreground">
                  {card.setName} - <span className="capitalize">{card.rarity}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">x{card.quantity + card.foilQuantity}</p>
                {(card.priceUsd || card.priceFoilUsd) && (
                  <p className="text-sm text-success">
                    ${(
                      (card.priceUsd || 0) * card.quantity +
                      (card.priceFoilUsd || card.priceUsd || 0) * card.foilQuantity
                    ).toFixed(2)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 7) return true
                if (page === 1 || page === totalPages) return true
                if (Math.abs(page - currentPage) <= 1) return true
                return false
              })
              .map((page, index, array) => {
                const prevPage = array[index - 1]
                const showEllipsis = prevPage && page - prevPage > 1

                return (
                  <span key={page} className="flex items-center gap-1">
                    {showEllipsis && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        'w-8 h-8 rounded-md text-sm transition-colors',
                        currentPage === page
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      )}
                    >
                      {page}
                    </button>
                  </span>
                )
              })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <CardDetailModal
        card={selectedCard}
        open={!!selectedCard}
        onOpenChange={(open) => !open && setSelectedCard(null)}
      />
    </div>
  )
}
