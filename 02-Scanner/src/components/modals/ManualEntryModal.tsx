import { useState, useCallback, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scryfallService } from '@/services/scryfall.service'
import { databaseService } from '@/services/database.service'
import { useScanStore } from '@/store/scanStore'
import type { ScryfallCard } from '@/types/scryfall.types'

interface ManualEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
}

export function ManualEntryModal({ open, onOpenChange, initialQuery = '' }: ManualEntryModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<ScryfallCard[]>([])
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [isFoil, setIsFoil] = useState(false)

  const { addToHistory, setLastAdded, setCurrentResult } = useScanStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setSuggestions([])
      setSearchResults([])
      setSelectedCard(null)
      setQuantity(1)
      setIsFoil(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, initialQuery])

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.length < 2) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      const results = await scryfallService.getAutocomplete(query)
      setSuggestions(results.slice(0, 8))
    }, 200)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    setSuggestions([])

    try {
      // Try exact match first
      const exactMatch = await scryfallService.getCardByExactName(searchQuery)
      if (exactMatch) {
        setSearchResults([exactMatch])
        setSelectedCard(exactMatch)
      } else {
        // Fall back to search
        const results = await scryfallService.searchCards(searchQuery, 10)
        setSearchResults(results)
        if (results.length === 1) {
          setSelectedCard(results[0])
        } else {
          setSelectedCard(null)
        }
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSuggestionClick = (name: string) => {
    setQuery(name)
    handleSearch(name)
  }

  const handleAddCard = async () => {
    if (!selectedCard) return

    await databaseService.addCard(selectedCard, quantity, isFoil)
    addToHistory(selectedCard, quantity, isFoil)
    setLastAdded({ card: selectedCard, quantity, isFoil })
    setCurrentResult({
      card: selectedCard,
      ocrText: query,
      confidence: 100,
      matchType: 'exact',
      suggestions: [],
      processingTime: 0,
      error: null,
    })

    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      if (selectedCard) {
        handleAddCard()
      } else {
        handleSearch(query)
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden z-50">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Manual Card Entry
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 space-y-4">
            {/* Search input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for a card..."
                className="w-full bg-input border border-border rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && !selectedCard && (
              <div className="bg-secondary/50 rounded-md overflow-hidden">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSuggestionClick(name)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 1 && !selectedCard && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  {searchResults.length} results found
                </p>
                {searchResults.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors text-left"
                  >
                    {(card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small) && (
                      <img
                        src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small}
                        alt={card.name}
                        className="w-10 h-14 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.set_name} · {card.rarity}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected card preview */}
            {selectedCard && (
              <div className="bg-secondary/30 rounded-lg p-4">
                <div className="flex gap-4">
                  {(selectedCard.image_uris?.normal ||
                    selectedCard.card_faces?.[0]?.image_uris?.normal) && (
                    <img
                      src={
                        selectedCard.image_uris?.normal ||
                        selectedCard.card_faces?.[0]?.image_uris?.normal
                      }
                      alt={selectedCard.name}
                      className="w-24 rounded-lg shadow"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{selectedCard.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCard.set_name} ({selectedCard.set.toUpperCase()})
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedCard.rarity}
                    </p>
                    {selectedCard.prices.usd && (
                      <p className="text-sm mt-1">
                        <span className="text-muted-foreground">Price:</span>{' '}
                        <span className="text-success">${selectedCard.prices.usd}</span>
                      </p>
                    )}

                    <button
                      onClick={() => setSelectedCard(null)}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      Choose different card
                    </button>
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Qty:</label>
                    <div className="flex items-center">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 bg-secondary rounded-l-md hover:bg-secondary/80"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 h-8 bg-input border-y border-border text-center text-sm"
                        min={1}
                      />
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-8 h-8 bg-secondary rounded-r-md hover:bg-secondary/80"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFoil}
                      onChange={(e) => setIsFoil(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">Foil</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCard} disabled={!selectedCard}>
              Add to Collection
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
