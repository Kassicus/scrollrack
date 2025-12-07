import { useState } from 'react'
import { ChevronDown, ChevronUp, Bug } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessedImage } from '@/services/image.service'

interface DebugPreviewProps {
  extractedCard: HTMLCanvasElement | null
  processedImage: ProcessedImage | null
  ocrText?: string
  confidence?: number
  processingTime?: number
}

export function DebugPreview({
  extractedCard,
  processedImage,
  ocrText,
  confidence,
  processingTime,
}: DebugPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hasContent = extractedCard || processedImage

  if (!hasContent) return null

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bug className="w-4 h-4 text-muted-foreground" />
          Debug Preview
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {/* Processing stats */}
          {(ocrText || confidence !== undefined || processingTime !== undefined) && (
            <div className="text-xs space-y-1 p-2 bg-secondary/50 rounded">
              {ocrText && (
                <div>
                  <span className="text-muted-foreground">OCR Result: </span>
                  <span className="font-mono">{ocrText}</span>
                </div>
              )}
              {confidence !== undefined && (
                <div>
                  <span className="text-muted-foreground">Confidence: </span>
                  <span className={cn(
                    'font-medium',
                    confidence >= 70 ? 'text-success' : confidence >= 50 ? 'text-warning' : 'text-destructive'
                  )}>
                    {confidence.toFixed(1)}%
                  </span>
                </div>
              )}
              {processingTime !== undefined && (
                <div>
                  <span className="text-muted-foreground">Processing: </span>
                  <span>{processingTime}ms</span>
                </div>
              )}
            </div>
          )}

          {/* Image stages */}
          <div className="grid grid-cols-2 gap-2">
            {/* Extracted card from tracking */}
            {extractedCard && (
              <ImageStage
                label="Captured Card"
                canvas={extractedCard}
              />
            )}

            {/* Processing stages */}
            {processedImage?.stageImages && (
              <>
                <ImageStage
                  label="Cropped"
                  canvas={processedImage.stageImages.cropped}
                />
                <ImageStage
                  label="Name Region"
                  canvas={processedImage.stageImages.nameRegion}
                />
                <ImageStage
                  label="Enhanced (OCR Input)"
                  canvas={processedImage.stageImages.enhanced}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ImageStage({ label, canvas }: { label: string; canvas: HTMLCanvasElement }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="bg-black rounded overflow-hidden">
        <img
          src={canvas.toDataURL()}
          alt={label}
          className="w-full h-auto"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {canvas.width}x{canvas.height}
      </p>
    </div>
  )
}
