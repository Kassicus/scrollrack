export function SettingsView() {
  return (
    <div className="flex-1 container mx-auto p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-6">Settings</h2>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-medium mb-3">Camera Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Camera Device</label>
                <select className="bg-input border border-border rounded-md px-3 py-2 text-sm">
                  <option>Default Camera</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Resolution</label>
                <select className="bg-input border border-border rounded-md px-3 py-2 text-sm">
                  <option>720p</option>
                  <option>1080p</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium mb-3">Scan Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Auto-capture</label>
                <input type="checkbox" defaultChecked className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Sound Effects</label>
                <input type="checkbox" defaultChecked className="w-4 h-4" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium mb-3">Data Management</h3>
            <div className="flex gap-3">
              <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm hover:bg-secondary/80">
                Export Collection
              </button>
              <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm hover:bg-secondary/80">
                Import Collection
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
