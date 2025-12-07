import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'
import { ScanView } from '@/components/scan/ScanView'
import { CollectionView } from '@/components/collection/CollectionView'
import { SettingsView } from '@/components/settings/SettingsView'
import { useAppStore } from '@/store/appStore'
import { useCollection } from '@/hooks/useCollection'

function App() {
  const { currentView } = useAppStore()
  useCollection() // Initialize collection stats

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 flex flex-col">
        {currentView === 'scan' && <ScanView />}
        {currentView === 'collection' && <CollectionView />}
        {currentView === 'settings' && <SettingsView />}
      </main>
      <StatusBar />
    </div>
  )
}

export default App
