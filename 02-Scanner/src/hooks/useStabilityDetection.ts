import { useRef, useCallback, useState } from 'react'

const STABILITY_THRESHOLD = 600 // ms card must be stable
const MOVEMENT_THRESHOLD = 12 // pixel difference threshold (lower = more sensitive)
const SAMPLE_INTERVAL = 100 // ms between frame samples
const SAMPLE_SIZE = 64 // downscaled image size for comparison

// Detection zone as percentage (must match image.service.ts)
const ZONE_WIDTH_PERCENT = 0.30
const ZONE_HEIGHT_PERCENT = 0.75

export type StabilityState = 'no-card' | 'moving' | 'stabilizing' | 'stable'

interface UseStabilityDetectionOptions {
  onStable?: () => void
  enabled?: boolean
}

export function useStabilityDetection(options: UseStabilityDetectionOptions = {}) {
  const { onStable, enabled = true } = options

  const [stabilityState, setStabilityState] = useState<StabilityState>('no-card')
  const [stabilityProgress, setStabilityProgress] = useState(0)

  const lastFrameRef = useRef<ImageData | null>(null)
  const stableStartTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const hasTriggeredRef = useRef(false)

  /**
   * Extract and downsample only the detection zone from the video
   * This ensures we're only monitoring the area where the card should be
   */
  const extractDetectionZone = useCallback((video: HTMLVideoElement): ImageData | null => {
    if (!video.videoWidth || !video.videoHeight) return null

    const vw = video.videoWidth
    const vh = video.videoHeight

    // Calculate detection zone bounds
    const zoneWidth = Math.round(vw * ZONE_WIDTH_PERCENT)
    const zoneHeight = Math.round(vh * ZONE_HEIGHT_PERCENT)
    const zoneX = Math.round((vw - zoneWidth) / 2)
    const zoneY = Math.round((vh - zoneHeight) / 2)

    // Create canvas to extract zone
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d')!

    // Draw only the detection zone, scaled down
    ctx.drawImage(
      video,
      zoneX, zoneY, zoneWidth, zoneHeight,
      0, 0, SAMPLE_SIZE, SAMPLE_SIZE
    )

    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  }, [])

  /**
   * Calculate difference between two frames
   */
  const calculateFrameDifference = useCallback(
    (frame1: ImageData, frame2: ImageData): number => {
      let totalDiff = 0
      const data1 = frame1.data
      const data2 = frame2.data

      for (let i = 0; i < data1.length; i += 4) {
        const gray1 = (data1[i] + data1[i + 1] + data1[i + 2]) / 3
        const gray2 = (data2[i] + data2[i + 1] + data2[i + 2]) / 3
        totalDiff += Math.abs(gray1 - gray2)
      }

      return totalDiff / (data1.length / 4)
    },
    []
  )

  /**
   * Check if the detection zone likely contains a card
   * Cards have:
   * - Moderate to high brightness (not dark)
   * - High contrast/variance (text, artwork)
   * - A mix of light and dark regions
   */
  const detectCardPresence = useCallback((frame: ImageData): boolean => {
    const data = frame.data
    const pixelCount = data.length / 4

    let totalBrightness = 0
    let brightPixels = 0
    let darkPixels = 0
    const brightnessValues: number[] = []

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
      brightnessValues.push(brightness)
      totalBrightness += brightness

      if (brightness > 180) brightPixels++
      if (brightness < 80) darkPixels++
    }

    const avgBrightness = totalBrightness / pixelCount
    const brightRatio = brightPixels / pixelCount
    const darkRatio = darkPixels / pixelCount

    // Calculate variance (cards have high variance due to text/art)
    let variance = 0
    for (const b of brightnessValues) {
      variance += (b - avgBrightness) ** 2
    }
    variance = Math.sqrt(variance / pixelCount)

    // Card detection criteria:
    // 1. Average brightness should be moderate (not too dark, not washed out)
    // 2. Should have both light and dark regions (variance > threshold)
    // 3. Should have a good mix of bright and dark pixels

    const hasGoodBrightness = avgBrightness > 80 && avgBrightness < 220
    const hasHighVariance = variance > 40 // Cards have text/art = high variance
    const hasMixedRegions = brightRatio > 0.1 && darkRatio > 0.05

    const isCard = hasGoodBrightness && hasHighVariance && hasMixedRegions

    // Debug logging (can be removed in production)
    if (Math.random() < 0.05) { // Log occasionally
      console.log('Card detection:', {
        avgBrightness: avgBrightness.toFixed(1),
        variance: variance.toFixed(1),
        brightRatio: (brightRatio * 100).toFixed(1) + '%',
        darkRatio: (darkRatio * 100).toFixed(1) + '%',
        isCard,
      })
    }

    return isCard
  }, [])

  /**
   * Process a video frame and check stability
   */
  const processFrame = useCallback(
    (video: HTMLVideoElement) => {
      if (!enabled) return

      const currentFrame = extractDetectionZone(video)
      if (!currentFrame) return

      // Check if there's likely a card in the detection zone
      if (!detectCardPresence(currentFrame)) {
        setStabilityState('no-card')
        setStabilityProgress(0)
        lastFrameRef.current = currentFrame
        stableStartTimeRef.current = null
        hasTriggeredRef.current = false
        return
      }

      // Compare with last frame for movement
      if (lastFrameRef.current) {
        const diff = calculateFrameDifference(lastFrameRef.current, currentFrame)

        if (diff < MOVEMENT_THRESHOLD) {
          // Frame is stable
          if (!stableStartTimeRef.current) {
            stableStartTimeRef.current = Date.now()
            setStabilityState('stabilizing')
          }

          const stableTime = Date.now() - stableStartTimeRef.current
          const progress = Math.min(stableTime / STABILITY_THRESHOLD, 1)
          setStabilityProgress(progress)

          if (stableTime >= STABILITY_THRESHOLD && !hasTriggeredRef.current) {
            setStabilityState('stable')
            hasTriggeredRef.current = true
            onStable?.()
          }
        } else {
          // Movement detected
          setStabilityState('moving')
          setStabilityProgress(0)
          stableStartTimeRef.current = null
          hasTriggeredRef.current = false
        }
      }

      lastFrameRef.current = currentFrame
    },
    [enabled, extractDetectionZone, detectCardPresence, calculateFrameDifference, onStable]
  )

  /**
   * Start monitoring video element for stability
   */
  const startMonitoring = useCallback(
    (video: HTMLVideoElement) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = window.setInterval(() => {
        processFrame(video)
      }, SAMPLE_INTERVAL)
    },
    [processFrame]
  )

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStabilityState('no-card')
    setStabilityProgress(0)
  }, [])

  /**
   * Reset stability state (call after capture)
   */
  const reset = useCallback(() => {
    stableStartTimeRef.current = null
    hasTriggeredRef.current = false
    lastFrameRef.current = null
    setStabilityState('no-card')
    setStabilityProgress(0)
  }, [])

  return {
    stabilityState,
    stabilityProgress,
    startMonitoring,
    stopMonitoring,
    reset,
    processFrame,
  }
}
