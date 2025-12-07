import { useState, useEffect, useRef } from 'react'
import Webcam from 'react-webcam'
import { Download, Upload, Trash2, AlertTriangle, RotateCw, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScanStore } from '@/store/scanStore'
import { useToastStore } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { databaseService } from '@/services/database.service'
import { cn } from '@/lib/utils'

interface CameraDevice {
  deviceId: string
  label: string
}

const DELAY_OPTIONS = [
  { value: 250, label: '0.25s (Fast)' },
  { value: 500, label: '0.5s (Default)' },
  { value: 750, label: '0.75s' },
  { value: 1000, label: '1s' },
  { value: 1500, label: '1.5s' },
  { value: 2000, label: '2s (Slow)' },
]

export function SettingsView() {
  const {
    autoCapture,
    setAutoCapture,
    soundEnabled,
    setSoundEnabled,
    selectedCameraId,
    setSelectedCameraId,
    resolution,
    setResolution,
    cameraRotation,
    setCameraRotation,
    postScanDelay,
    setPostScanDelay,
  } = useScanStore()

  const { addToast } = useToastStore()
  const { totalCards, uniqueCards, totalValue } = useAppStore()

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Enumerate camera devices
  useEffect(() => {
    async function getCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
          }))
        setCameras(videoDevices)
      } catch (err) {
        console.error('Failed to enumerate cameras:', err)
      }
    }
    getCameras()
  }, [])

  const handleExportJSON = async () => {
    setIsExporting(true)
    try {
      const json = await databaseService.exportToJSON()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mtg-collection-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('Collection exported as JSON', 'success')
    } catch (err) {
      console.error('Export failed:', err)
      addToast('Failed to export collection', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const csv = await databaseService.exportToCSV()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mtg-collection-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('Collection exported as CSV', 'success')
    } catch (err) {
      console.error('Export failed:', err)
      addToast('Failed to export collection', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const result = await databaseService.importFromJSON(text)
      addToast(
        `Imported ${result.imported} cards${result.errors > 0 ? ` (${result.errors} errors)` : ''}`,
        result.errors > 0 ? 'info' : 'success'
      )
    } catch (err) {
      console.error('Import failed:', err)
      addToast('Failed to import collection. Make sure the file is valid JSON.', 'error')
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClearCollection = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      return
    }

    setIsClearing(true)
    try {
      await databaseService.clearAllData()
      addToast('Collection cleared', 'success')
      setShowClearConfirm(false)
    } catch (err) {
      console.error('Clear failed:', err)
      addToast('Failed to clear collection', 'error')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex-1 container mx-auto p-4 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-row gap-6 min-h-0">
        {/* Left Column: Camera Preview & Settings */}
        <div className="flex-1 basis-1/2 flex flex-col gap-4 min-h-0 overflow-auto">
          {/* Camera Preview */}
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Camera Preview</h2>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{cameraError}</p>
                  </div>
                </div>
              ) : (
                <Webcam
                  audio={false}
                  videoConstraints={{
                    deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
                    width: { ideal: resolution === '1080p' ? 1920 : 1280 },
                    height: { ideal: resolution === '1080p' ? 1080 : 720 },
                  }}
                  onUserMediaError={(err) => {
                    setCameraError(err instanceof Error ? err.message : 'Camera access denied')
                  }}
                  onUserMedia={() => setCameraError(null)}
                  className={cn(
                    'w-full h-full object-cover',
                    cameraRotation && 'rotate-180'
                  )}
                />
              )}
            </div>
          </section>

          {/* Camera Settings */}
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Camera Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Camera Device</label>
                  <p className="text-xs text-muted-foreground">Select which camera to use for scanning</p>
                </div>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="bg-input border border-border rounded-md px-3 py-2 text-sm min-w-[200px]"
                >
                  <option value="">Default Camera</option>
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Resolution</label>
                  <p className="text-xs text-muted-foreground">Higher resolution may improve OCR accuracy</p>
                </div>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                  className="bg-input border border-border rounded-md px-3 py-2 text-sm min-w-[200px]"
                >
                  <option value="720p">720p (1280x720)</option>
                  <option value="1080p">1080p (1920x1080)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Rotate Camera 180°</label>
                  <p className="text-xs text-muted-foreground">
                    Flip the camera feed if your camera is mounted upside down
                  </p>
                </div>
                <button
                  onClick={() => setCameraRotation(!cameraRotation)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    cameraRotation ? 'bg-primary' : 'bg-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow flex items-center justify-center',
                      cameraRotation && 'translate-x-5'
                    )}
                  >
                    <RotateCw className={cn('w-3 h-3 text-muted-foreground', cameraRotation && 'text-primary')} />
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Other Settings */}
        <div className="flex-1 basis-1/2 flex flex-col gap-4 min-h-0 overflow-auto">
          {/* Scan Settings */}
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Scan Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Auto-capture</label>
                  <p className="text-xs text-muted-foreground">
                    Automatically scan when a card is detected and stable
                  </p>
                </div>
                <button
                  onClick={() => setAutoCapture(!autoCapture)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    autoCapture ? 'bg-primary' : 'bg-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                      autoCapture && 'translate-x-5'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Sound Effects</label>
                  <p className="text-xs text-muted-foreground">
                    Play audio feedback for scan events
                  </p>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    soundEnabled ? 'bg-primary' : 'bg-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                      soundEnabled && 'translate-x-5'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Post-Scan Delay</label>
                  <p className="text-xs text-muted-foreground">
                    Pause duration after a successful scan before detecting the next card
                  </p>
                </div>
                <select
                  value={postScanDelay}
                  onChange={(e) => setPostScanDelay(Number(e.target.value))}
                  className="bg-input border border-border rounded-md px-3 py-2 text-sm min-w-[160px]"
                >
                  {DELAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Data Management</h2>

            {/* Collection Stats */}
            <div className="mb-6 p-4 bg-secondary/30 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Collection Summary</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold">{totalCards.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{uniqueCards.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Unique</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-success">
                    ${totalValue.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Value</p>
                </div>
              </div>
            </div>

            {/* Export */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Export Collection</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  disabled={isExporting || uniqueCards === 0}
                  className="gap-1"
                >
                  <Download className="w-3 h-3" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={isExporting || uniqueCards === 0}
                  className="gap-1"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Import */}
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Import Collection</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={isImporting}
                className="gap-1"
              >
                <Upload className="w-3 h-3" />
                {isImporting ? 'Importing...' : 'Import JSON'}
              </Button>
            </div>

            {/* Danger Zone */}
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </h3>
              <Button
                variant={showClearConfirm ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleClearCollection}
                disabled={isClearing || uniqueCards === 0}
                className="gap-1"
                onBlur={() => setTimeout(() => setShowClearConfirm(false), 200)}
              >
                <Trash2 className="w-3 h-3" />
                {isClearing
                  ? 'Clearing...'
                  : showClearConfirm
                    ? 'Confirm'
                    : 'Clear All'}
              </Button>
            </div>
          </section>

          {/* About */}
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground">
              MTG Card Scanner uses OCR and the Scryfall API to identify Magic: The Gathering cards.
              Card data and prices are provided by{' '}
              <a
                href="https://scryfall.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Scryfall
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
