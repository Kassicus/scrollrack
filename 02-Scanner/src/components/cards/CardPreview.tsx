import { Plus, Sparkles, Undo2, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScanStore } from '@/store/scanStore'
import { databaseService } from '@/services/database.service'
import { cn } from '@/lib/utils'
import type { ScryfallCard } from '@/types/scryfall.types'

interface CardPreviewProps {
  card: ScryfallCard | null
  isLoading?: boolean
  error?: string | null
  ocrText?: string
  suggestions?: string[]
  onSuggestionSelect?: (name: string) => void
  onManualEntry?: () => void
}

export function CardPreview({
  card,
  isLoading,
  error,
  ocrText,
  suggestions = [],
  onSuggestionSelect,
  onManualEntry,
}: CardPreviewProps) {
  const { addToHistory, setLastAdded, lastAdded } = useScanStore()

  const handleAddCard = async (quantity: number, isFoil: boolean) => {
    if (!card) return

    await databaseService.addCard(card, quantity, isFoil)
    addToHistory(card, quantity, isFoil)
    setLastAdded({ card, quantity, isFoil })
  }

  const handleUndo = async () => {
    if (!lastAdded) return

    await databaseService.decrementCard(
      lastAdded.card.id,
      lastAdded.quantity,
      lastAdded.isFoil
    )
    setLastAdded(null)
  }

  const imageUrl =
    card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal

  const price = card?.prices.usd
  const foilPrice = card?.prices.usd_foil

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Recognizing Card...</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error && !card) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Recognition Result</h2>
        <div className="text-center py-6">
          <p className="text-destructive mb-2">{error}</p>
          {ocrText && (
            <p className="text-sm text-muted-foreground mb-4">
              Detected text: "<span className="font-mono">{ocrText}</span>"
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-4 mb-4">
              <p className="text-sm text-muted-foreground mb-2">Did you mean:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    onClick={() => onSuggestionSelect?.(name)}
                    className="px-3 py-1 text-sm bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={onManualEntry} variant="outline" className="gap-2 mt-2">
            <PenLine className="w-4 h-4" />
            Enter Manually
          </Button>
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Last Scanned Card</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No card scanned yet. Position a card in the camera view to begin.
          </p>
          <Button onClick={onManualEntry} variant="outline" className="gap-2">
            <PenLine className="w-4 h-4" />
            Enter Manually
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Scanned Card</h2>
        <Button onClick={onManualEntry} variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <PenLine className="w-3 h-3" />
          Manual
        </Button>
      </div>

      <div className="flex gap-4">
        {imageUrl && (
          <div className="flex-shrink-0">
            <img
              src={imageUrl}
              alt={card.name}
              className="w-32 rounded-lg shadow-lg"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{card.name}</h3>
          <p className="text-sm text-muted-foreground">
            {card.set_name} ({card.set.toUpperCase()})
          </p>
          <p className="text-sm text-muted-foreground capitalize">{card.rarity}</p>

          {card.mana_cost && (
            <p className="text-sm mt-1 font-mono">{card.mana_cost}</p>
          )}

          <div className="mt-2 flex gap-4">
            {price && (
              <span className="text-sm">
                <span className="text-muted-foreground">Price:</span>{' '}
                <span className="text-success font-medium">${price}</span>
              </span>
            )}
            {foilPrice && (
              <span className="text-sm">
                <span className="text-muted-foreground">Foil:</span>{' '}
                <span className="text-success font-medium">${foilPrice}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => handleAddCard(1, false)} size="sm" className="gap-1">
          <Plus className="w-4 h-4" />
          +1
        </Button>
        <Button
          onClick={() => handleAddCard(4, false)}
          size="sm"
          variant="secondary"
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          +4
        </Button>
        <Button
          onClick={() => handleAddCard(1, true)}
          size="sm"
          variant="secondary"
          className={cn('gap-1', 'hover:bg-amber-600 hover:text-white')}
        >
          <Sparkles className="w-4 h-4" />
          Foil
        </Button>
        {lastAdded && (
          <Button onClick={handleUndo} size="sm" variant="outline" className="gap-1 ml-auto">
            <Undo2 className="w-4 h-4" />
            Undo
          </Button>
        )}
      </div>
    </div>
  )
}
