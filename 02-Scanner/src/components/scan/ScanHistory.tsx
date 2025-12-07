import { useScanStore } from '@/store/scanStore'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScanHistory() {
  const { scanHistory, clearHistory } = useScanStore()

  if (scanHistory.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 flex-1">
        <h2 className="text-lg font-semibold mb-4">Scan History</h2>
        <div className="text-muted-foreground text-center py-8">
          Scanned cards will appear here.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Scan History</h2>
        <Button
          onClick={clearHistory}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {scanHistory.map((item) => {
          const imageUrl =
            item.card.image_uris?.small ||
            item.card.card_faces?.[0]?.image_uris?.small

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors"
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={item.card.name}
                  className="w-10 h-14 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.card.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.card.set.toUpperCase()} · {item.quantity}x
                  {item.isFoil && ' (Foil)'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTime(item.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
