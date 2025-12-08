import { useScanStore } from '@/store/scanStore'
import { databaseService } from '@/services/database.service'
import { Trash2, History, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScanHistory() {
  const { scanHistory, clearHistory, removeFromHistory } = useScanStore()

  const handleRemoveItem = async (id: string) => {
    const removed = removeFromHistory(id)
    if (removed) {
      // Also remove from database
      await databaseService.decrementCard(removed.card.id, removed.quantity, removed.isFoil)
    }
  }

  const handleClearAll = async () => {
    // Remove all items from database
    for (const item of scanHistory) {
      await databaseService.decrementCard(item.card.id, item.quantity, item.isFoil)
    }
    clearHistory()
  }

  return (
    <div className="bg-card border border-border rounded-lg flex-1 flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Scan History</h2>
          {scanHistory.length > 0 && (
            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
              {scanHistory.length}
            </span>
          )}
        </div>
        {scanHistory.length > 0 && (
          <Button
            onClick={handleClearAll}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            title="Clear history and remove from collection"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {scanHistory.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No cards scanned yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Scanned cards will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="divide-y divide-border">
            {scanHistory.map((item) => {
              const imageUrl =
                item.card.image_uris?.small ||
                item.card.card_faces?.[0]?.image_uris?.small
              const price = item.isFoil
                ? item.card.prices.usd_foil
                : item.card.prices.usd

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.card.name}
                      className="w-12 h-[67px] rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-[67px] bg-secondary rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground">?</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate flex items-center gap-1">
                      {item.card.name}
                      {item.isFoil && (
                        <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.card.set_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                        x{item.quantity}
                      </span>
                      {price && (
                        <span className="text-xs text-success">${price}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(item.timestamp)}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove from history and collection"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer with session stats */}
      {scanHistory.length > 0 && (
        <div className="p-3 border-t border-border bg-secondary/20">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Session: {scanHistory.reduce((sum, item) => sum + item.quantity, 0)} cards
            </span>
            <span className="text-success">
              ${scanHistory
                .reduce((sum, item) => {
                  const price = item.isFoil
                    ? parseFloat(item.card.prices.usd_foil || '0')
                    : parseFloat(item.card.prices.usd || '0')
                  return sum + price * item.quantity
                }, 0)
                .toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(date: Date): string {
  // Handle both Date objects and date strings
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
