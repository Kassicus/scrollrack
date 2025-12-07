import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Minus, Trash2, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { databaseService } from '@/services/database.service'
import { cn } from '@/lib/utils'
import type { CardEntry } from '@/types/card.types'

interface CardDetailModalProps {
  card: CardEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CardDetailModal({ card, open, onOpenChange }: CardDetailModalProps) {
  const [quantity, setQuantity] = useState(0)
  const [foilQuantity, setFoilQuantity] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (card) {
      setQuantity(card.quantity)
      setFoilQuantity(card.foilQuantity)
      setHasChanges(false)
      setIsDeleting(false)
    }
  }, [card])

  if (!card) return null

  const totalValue =
    (card.priceUsd || 0) * quantity +
    (card.priceFoilUsd || card.priceUsd || 0) * foilQuantity

  const handleQuantityChange = (delta: number, isFoil: boolean) => {
    if (isFoil) {
      setFoilQuantity((prev) => Math.max(0, prev + delta))
    } else {
      setQuantity((prev) => Math.max(0, prev + delta))
    }
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (quantity === 0 && foilQuantity === 0) {
      await databaseService.removeCard(card.id)
    } else {
      const quantityDiff = quantity - card.quantity
      const foilDiff = foilQuantity - card.foilQuantity

      if (quantityDiff > 0) {
        await databaseService.incrementCard(card.id, quantityDiff, false)
      } else if (quantityDiff < 0) {
        await databaseService.decrementCard(card.id, Math.abs(quantityDiff), false)
      }

      if (foilDiff > 0) {
        await databaseService.incrementCard(card.id, foilDiff, true)
      } else if (foilDiff < 0) {
        await databaseService.decrementCard(card.id, Math.abs(foilDiff), true)
      }
    }
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true)
      return
    }
    await databaseService.removeCard(card.id)
    onOpenChange(false)
  }

  const scryfallUrl = `https://scryfall.com/card/${card.setCode}/${card.collectorNumber}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden z-50">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Card Details
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                {card.imageUri ? (
                  <img
                    src={card.imageUri}
                    alt={card.name}
                    className="w-56 rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-56 aspect-[488/680] bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-muted-foreground text-center px-4">
                      {card.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{card.name}</h2>
                  <p className="text-muted-foreground">{card.typeLine}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Set:</span>
                    <p className="font-medium">{card.setName}</p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {card.setCode} · #{card.collectorNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rarity:</span>
                    <p className={cn(
                      'font-medium capitalize',
                      card.rarity === 'mythic' && 'text-orange-500',
                      card.rarity === 'rare' && 'text-amber-500',
                      card.rarity === 'uncommon' && 'text-zinc-300',
                    )}>
                      {card.rarity}
                    </p>
                  </div>
                </div>

                {card.manaCost && (
                  <div>
                    <span className="text-sm text-muted-foreground">Mana Cost:</span>
                    <p className="font-mono">{card.manaCost}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {card.priceUsd && (
                    <div>
                      <span className="text-muted-foreground">Regular Price:</span>
                      <p className="text-success font-medium">${card.priceUsd.toFixed(2)}</p>
                    </div>
                  )}
                  {card.priceFoilUsd && (
                    <div>
                      <span className="text-muted-foreground">Foil Price:</span>
                      <p className="text-success font-medium">${card.priceFoilUsd.toFixed(2)}</p>
                    </div>
                  )}
                </div>

                <hr className="border-border" />

                <div className="space-y-3">
                  <h3 className="font-semibold">Quantity in Collection</h3>

                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">Regular:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(-1, false)}
                        disabled={quantity === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-12 text-center font-medium text-lg">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(1, false)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      {card.priceUsd && quantity > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          = ${(card.priceUsd * quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Foil:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(-1, true)}
                        disabled={foilQuantity === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-12 text-center font-medium text-lg">
                        {foilQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(1, true)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      {(card.priceFoilUsd || card.priceUsd) && foilQuantity > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          = ${((card.priceFoilUsd || card.priceUsd || 0) * foilQuantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {totalValue > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Value:</span>
                        <span className="text-lg font-semibold text-success">
                          ${totalValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Added: {new Date(card.dateAdded).toLocaleDateString()}</p>
                  <p>Modified: {new Date(card.dateModified).toLocaleDateString()}</p>
                </div>

                <a
                  href={scryfallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View on Scryfall <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border flex items-center justify-between">
            <Button
              variant={isDeleting ? 'destructive' : 'outline'}
              onClick={handleDelete}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Confirm Delete' : 'Delete'}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                Save Changes
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
