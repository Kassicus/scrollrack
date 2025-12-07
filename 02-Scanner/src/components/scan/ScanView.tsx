import { useState } from 'react'
import { CameraFeed } from '@/components/camera/CameraFeed'
import { CardPreview } from '@/components/cards/CardPreview'
import { ScanHistory } from '@/components/scan/ScanHistory'
import { ManualEntryModal } from '@/components/modals/ManualEntryModal'
import { useScanStore } from '@/store/scanStore'
import { useCardRecognition } from '@/hooks/useCardRecognition'

export function ScanView() {
  const { currentResult, setCurrentResult } = useScanStore()
  const { lookupByName } = useCardRecognition()
  const [manualEntryOpen, setManualEntryOpen] = useState(false)

  const handleSuggestionSelect = async (name: string) => {
    const result = await lookupByName(name)
    setCurrentResult(result)
  }

  const handleManualEntry = () => {
    setManualEntryOpen(true)
  }

  return (
    <div className="flex-1 container mx-auto p-4 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-row gap-6 min-h-0">
        {/* Left Column: Camera + Last Scanned Card */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-auto">
          <CameraFeed />
          <CardPreview
            card={currentResult?.card || null}
            isLoading={false}
            error={currentResult?.error}
            ocrText={currentResult?.ocrText}
            suggestions={currentResult?.suggestions}
            onSuggestionSelect={handleSuggestionSelect}
            onManualEntry={handleManualEntry}
          />
        </div>

        {/* Right Column: Full-height Scan History */}
        <div className="w-[400px] flex-shrink-0 flex flex-col min-h-0">
          <ScanHistory />
        </div>
      </div>

      <ManualEntryModal
        open={manualEntryOpen}
        onOpenChange={setManualEntryOpen}
        initialQuery={currentResult?.ocrText || ''}
      />
    </div>
  )
}
