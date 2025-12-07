import { cn } from '@/lib/utils'
import type { TrackingState } from '@/hooks/useCardTracking'
import type { DetectedCard } from '@/services/cardDetection.service'

interface CardOverlayProps {
  state: TrackingState | 'processing'
  progress?: number
  detectedCard?: DetectedCard | null
  videoWidth?: number
  videoHeight?: number
}

export function CardOverlay({
  state,
  progress = 0,
  detectedCard,
  videoWidth = 1280,
  videoHeight = 720,
}: CardOverlayProps) {
  const getStateStyles = () => {
    switch (state) {
      case 'processing':
        return {
          border: 'border-warning',
          bg: 'bg-warning/10',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
          label: 'Processing...',
          labelColor: 'text-warning',
        }
      case 'stable':
        return {
          border: 'border-success',
          bg: 'bg-success/10',
          glow: 'shadow-[0_0_30px_rgba(34,197,94,0.4)]',
          label: 'Capturing!',
          labelColor: 'text-success',
        }
      case 'cooldown':
        return {
          border: 'border-success/50',
          bg: 'bg-success/5',
          glow: '',
          label: 'Remove card for next scan',
          labelColor: 'text-success',
        }
      case 'stabilizing':
        return {
          border: 'border-primary',
          bg: 'bg-primary/5',
          glow: 'shadow-[0_0_15px_rgba(124,58,237,0.3)]',
          label: 'Hold steady...',
          labelColor: 'text-primary',
        }
      case 'tracking':
        return {
          border: 'border-primary/70',
          bg: 'bg-transparent',
          glow: '',
          label: 'Card detected',
          labelColor: 'text-primary',
        }
      case 'no-card':
      default:
        return {
          border: 'border-muted-foreground/30',
          bg: 'bg-transparent',
          glow: '',
          label: 'Place card in zone',
          labelColor: 'text-muted-foreground',
        }
    }
  }

  const styles = getStateStyles()

  // If we have a detected card, show the overlay at its position
  if (detectedCard && state !== 'no-card') {
    const { x, y, width, height, confidence } = detectedCard

    // Convert pixel coordinates to percentages
    const leftPercent = (x / videoWidth) * 100
    const topPercent = (y / videoHeight) * 100
    const widthPercent = (width / videoWidth) * 100
    const heightPercent = (height / videoHeight) * 100

    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Detected card outline */}
        <div
          className={cn(
            'absolute border-2 rounded-lg transition-all duration-150',
            styles.border,
            styles.bg,
            styles.glow
          )}
          style={{
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
            width: `${widthPercent}%`,
            height: `${heightPercent}%`,
          }}
        >
          {/* Corner indicators */}
          <div className={cn('absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 rounded-tl-lg', styles.border)} />
          <div className={cn('absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 rounded-tr-lg', styles.border)} />
          <div className={cn('absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 rounded-bl-lg', styles.border)} />
          <div className={cn('absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 rounded-br-lg', styles.border)} />

          {/* Card name region indicator */}
          <div
            className={cn(
              'absolute left-[6%] right-[6%] border border-dashed rounded',
              state === 'processing' || state === 'stable' ? 'border-success/50' : 'border-primary/30'
            )}
            style={{ top: '4%', height: '10%' }}
          />

          {/* Progress bar */}
          {state === 'stabilizing' && progress > 0 && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-primary rounded-b transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          )}

          {/* Success animation */}
          {state === 'stable' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center animate-ping">
                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}

          {/* Confidence badge */}
          <div className="absolute -top-6 right-0 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white">
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Label */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-background/90 backdrop-blur-sm transition-colors duration-300',
            styles.labelColor
          )}
          style={{ top: `${topPercent + heightPercent + 2}%` }}
        >
          {styles.label}
        </div>
      </div>
    )
  }

  // No card detected - show the capture zone guide
  // Zone is 65% of height, card aspect ratio, centered
  const zoneHeight = 65 // percent
  const zoneWidth = zoneHeight * (2.5 / 3.5) // card aspect ratio
  const zoneLeft = (100 - zoneWidth) / 2
  const zoneTop = (100 - zoneHeight) / 2

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Capture zone outline */}
      <div
        className="absolute border-2 border-dashed border-primary/50 rounded-lg"
        style={{
          left: `${zoneLeft}%`,
          top: `${zoneTop}%`,
          width: `${zoneWidth}%`,
          height: `${zoneHeight}%`,
        }}
      >
        {/* Corner markers */}
        <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
        <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
        <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
        <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
      </div>

      {/* Label */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p className={cn('text-sm px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm', styles.labelColor)}>
          Place card in zone
        </p>
      </div>
    </div>
  )
}
