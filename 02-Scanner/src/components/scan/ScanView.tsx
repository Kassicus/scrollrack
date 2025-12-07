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
    <div className="flex-1 container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <div className="flex flex-col gap-4">
          <CameraFeed />
        </div>
        <div className="flex flex-col gap-4">
          <CardPreview
            card={currentResult?.card || null}
            isLoading={false}
            error={currentResult?.error}
            ocrText={currentResult?.ocrText}
            suggestions={currentResult?.suggestions}
            onSuggestionSelect={handleSuggestionSelect}
            onManualEntry={handleManualEntry}
          />
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
