export function CollectionView() {
  return (
    <div className="flex-1 container mx-auto p-4">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Collection</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search cards..."
              className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="text-muted-foreground text-center py-16">
          Your collection is empty. Start scanning cards to build your inventory.
        </div>
      </div>
    </div>
  )
}
