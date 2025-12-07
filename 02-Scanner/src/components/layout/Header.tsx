import { Camera, Library, Settings } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/types/card.types'

const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'scan', label: 'Scan', icon: <Camera className="w-4 h-4" /> },
  { id: 'collection', label: 'Collection', icon: <Library className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
]

export function Header() {
  const { currentView, setCurrentView } = useAppStore()

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">MTG</span>
          </div>
          <h1 className="text-lg font-semibold hidden sm:block">Card Scanner</h1>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                currentView === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
