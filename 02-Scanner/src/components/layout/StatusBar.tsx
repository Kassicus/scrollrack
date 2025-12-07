import { useAppStore } from '@/store/appStore'

export function StatusBar() {
  const { totalCards, uniqueCards, totalValue } = useAppStore()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return (
    <footer className="border-t border-border bg-card py-2 px-4">
      <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full"></span>
          Ready to scan
        </span>
        <div className="flex items-center gap-6">
          <span>
            Cards: <span className="text-foreground font-medium">{totalCards.toLocaleString()}</span>
          </span>
          <span>
            Unique: <span className="text-foreground font-medium">{uniqueCards.toLocaleString()}</span>
          </span>
          <span>
            Value: <span className="text-foreground font-medium">{formatCurrency(totalValue)}</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
