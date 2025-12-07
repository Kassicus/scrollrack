import { cn } from '@/lib/utils'
import type { StabilityState } from '@/hooks/useStabilityDetection'

interface DetectionZoneProps {
  state: StabilityState | 'processing'
  progress?: number
}

// These percentages must match DETECTION_ZONE_PERCENT in image.service.ts
const ZONE_WIDTH_PERCENT = 30
const ZONE_HEIGHT_PERCENT = 75

export function DetectionZone({ state, progress = 0 }: DetectionZoneProps) {
  const getStateStyles = () => {
    switch (state) {
      case 'processing':
        return {
          border: 'border-warning',
          corners: 'border-warning',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
          label: 'Processing...',
          labelColor: 'text-warning',
        }
      case 'stable':
        return {
          border: 'border-success',
          corners: 'border-success',
          glow: 'shadow-[0_0_30px_rgba(34,197,94,0.4)]',
          label: 'Capturing!',
          labelColor: 'text-success',
        }
      case 'stabilizing':
        return {
          border: 'border-primary',
          corners: 'border-primary',
          glow: 'shadow-[0_0_15px_rgba(124,58,237,0.3)]',
          label: 'Hold steady...',
          labelColor: 'text-primary',
        }
      case 'moving':
        return {
          border: 'border-warning/70',
          corners: 'border-warning/70',
          glow: '',
          label: 'Card moving...',
          labelColor: 'text-warning',
        }
      case 'no-card':
      default:
        return {
          border: 'border-muted-foreground/50',
          corners: 'border-muted-foreground/50',
          glow: '',
          label: 'Position card here',
          labelColor: 'text-muted-foreground',
        }
    }
  }

  const styles = getStateStyles()

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Use percentage-based sizing to match image cropping */}
      <div
        className={cn(
          'relative border-2 rounded-lg transition-all duration-300',
          styles.border,
          styles.glow
        )}
        style={{
          width: `${ZONE_WIDTH_PERCENT}%`,
          height: `${ZONE_HEIGHT_PERCENT}%`,
        }}
      >
        {/* Corner indicators */}
        <div
          className={cn(
            'absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-300',
            styles.corners
          )}
        />
        <div
          className={cn(
            'absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-300',
            styles.corners
          )}
        />
        <div
          className={cn(
            'absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-300',
            styles.corners
          )}
        />
        <div
          className={cn(
            'absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg transition-colors duration-300',
            styles.corners
          )}
        />

        {/* Card name region indicator - top 10% of card */}
        <div
          className={cn(
            'absolute left-[6%] right-[6%] border border-dashed rounded transition-colors duration-300',
            state === 'processing' || state === 'stable'
              ? 'border-success/50'
              : 'border-primary/30'
          )}
          style={{
            top: '4%',
            height: '10%',
          }}
        >
          <span className="absolute -top-5 left-0 text-[10px] text-primary/50">
            Card name area
          </span>
        </div>

        {/* Progress indicator (when stabilizing) */}
        {state === 'stabilizing' && progress > 0 && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-primary rounded-b transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        )}

        {/* Scanning animation */}
        {state === 'processing' && (
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-warning to-transparent animate-scan" />
          </div>
        )}

        {/* Label */}
        <div
          className={cn(
            'absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-background/90 backdrop-blur-sm transition-colors duration-300 whitespace-nowrap',
            styles.labelColor
          )}
        >
          {styles.label}
        </div>

        {/* Scan success checkmark */}
        {state === 'stable' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center animate-ping">
              <svg
                className="w-8 h-8 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
