import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardEntry } from '@/types/card.types'

interface CardTileProps {
  card: CardEntry
  onClick?: () => void
}

const rarityColors: Record<CardEntry['rarity'], string> = {
  common: 'border-zinc-500',
  uncommon: 'border-zinc-400',
  rare: 'border-amber-500',
  mythic: 'border-orange-500',
  special: 'border-purple-500',
  bonus: 'border-purple-400',
}

export function CardTile({ card, onClick }: CardTileProps) {
  const totalQuantity = card.quantity + card.foilQuantity
  const totalValue =
    (card.priceUsd || 0) * card.quantity +
    (card.priceFoilUsd || card.priceUsd || 0) * card.foilQuantity

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative bg-card rounded-lg overflow-hidden border-2 transition-all',
        'hover:scale-105 hover:shadow-lg hover:shadow-primary/20 hover:z-10',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        rarityColors[card.rarity]
      )}
    >
      <div className="aspect-[488/680] relative">
        {card.imageUri ? (
          <img
            src={card.imageUri}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-xs text-muted-foreground text-center px-2">
              {card.name}
            </span>
          </div>
        )}

        <div className="absolute top-1 right-1 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded">
          x{totalQuantity}
        </div>

        {card.foilQuantity > 0 && (
          <div className="absolute top-1 left-1 bg-amber-500/90 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" />
            {card.foilQuantity}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
          <p className="text-white text-xs font-medium truncate">{card.name}</p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-white/70 text-[10px] uppercase">
              {card.setCode}
            </span>
            {totalValue > 0 && (
              <span className="text-success text-[10px] font-medium">
                ${totalValue.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
