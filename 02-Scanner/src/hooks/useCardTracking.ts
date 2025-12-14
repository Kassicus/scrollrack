import { useRef, useCallback, useState, useEffect } from 'react'
import { cardDetectionService, type DetectedCard } from '@/services/cardDetection.service'

// Simple timing - detect card in zone, wait briefly, capture
const CAPTURE_DELAY = 300 // ms to wait after detecting card
const SAMPLE_INTERVAL_NORMAL = 100 // ms between frame samples (normal mode)
const SAMPLE_INTERVAL_PERFORMANCE = 250 // ms between frame samples (performance mode for Pi)
const COOLDOWN_AFTER_CAPTURE = 1500 // ms to wait after capture before scanning again

export type TrackingState = 'no-card' | 'tracking' | 'stabilizing' | 'stable' | 'cooldown'

export interface CardTrackingResult {
  state: TrackingState
  card: DetectedCard | null
  progress: number // 0-1 for stability progress
  extractedImage: HTMLCanvasElement | null
}

interface UseCardTrackingOptions {
  onStable?: (card: DetectedCard, extractedImage: HTMLCanvasElement) => void
  onCardLost?: () => void
  enabled?: boolean
  debug?: boolean
  performanceMode?: boolean
}

export function useCardTracking(options: UseCardTrackingOptions = {}) {
  const { onStable, onCardLost, enabled = true, debug = false, performanceMode = false } = options

  const sampleInterval = performanceMode ? SAMPLE_INTERVAL_PERFORMANCE : SAMPLE_INTERVAL_NORMAL

  const [trackingState, setTrackingState] = useState<TrackingState>('no-card')
  const [detectedCard, setDetectedCard] = useState<DetectedCard | null>(null)
  const [stabilityProgress, setStabilityProgress] = useState(0)
  const [debugCanvas, setDebugCanvas] = useState<HTMLCanvasElement | null>(null)
  const [extractedCard, setExtractedCard] = useState<HTMLCanvasElement | null>(null)

  // Use refs to always get latest values (fixes stale closure in setInterval)
  const onStableRef = useRef(onStable)
  const onCardLostRef = useRef(onCardLost)
  const enabledRef = useRef(enabled)
  const debugRef = useRef(debug)

  // Keep refs updated
  useEffect(() => { onStableRef.current = onStable }, [onStable])
  useEffect(() => { onCardLostRef.current = onCardLost }, [onCardLost])
  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { debugRef.current = debug }, [debug])

  const lastCardRef = useRef<DetectedCard | null>(null)
  const stableStartTimeRef = useRef<number | null>(null)
  const hasTriggeredRef = useRef(false)
  const intervalRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackingStateRef = useRef<TrackingState>('no-card')
  const cooldownUntilRef = useRef<number>(0) // Timestamp when cooldown ends
  const requireCardRemovalRef = useRef(false) // Must see "no card" before scanning again

  // Track consecutive frames with no card to avoid flicker
  const noCardCountRef = useRef(0)
  const NO_CARD_THRESHOLD = 8 // frames without card before declaring "no card" (800ms at 100ms interval)

  // Process frame function - uses refs to avoid stale closures
  const processFrame = useCallback(() => {
    if (!enabledRef.current || !videoRef.current) return

    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    const now = Date.now()

    // Check if we're in cooldown period
    if (now < cooldownUntilRef.current) {
      // Still in cooldown - show cooldown state
      if (trackingStateRef.current !== 'cooldown') {
        setTrackingState('cooldown')
        trackingStateRef.current = 'cooldown'
      }
      return
    }

    // Enable debug mode in service if needed
    cardDetectionService.setDebugMode(debugRef.current)

    // Detect card in current frame
    const result = cardDetectionService.detectCard(video)

    if (debugRef.current && result.debugCanvas) {
      setDebugCanvas(result.debugCanvas)
    }

    if (result.detected && result.card) {
      // If we require card removal first, don't start tracking yet
      if (requireCardRemovalRef.current) {
        // Card still present, waiting for removal
        setTrackingState('cooldown')
        trackingStateRef.current = 'cooldown'
        return
      }

      noCardCountRef.current = 0
      setDetectedCard(result.card)
      setTrackingState('stabilizing')
      trackingStateRef.current = 'stabilizing'

      // Start timer on first detection
      if (!stableStartTimeRef.current) {
        stableStartTimeRef.current = Date.now()
        console.log('Card in zone! Capturing in', CAPTURE_DELAY, 'ms...')
      }

      const elapsed = now - stableStartTimeRef.current
      const progress = Math.min(elapsed / CAPTURE_DELAY, 1)
      setStabilityProgress(progress)

      // Capture after delay
      if (elapsed >= CAPTURE_DELAY && !hasTriggeredRef.current) {
        setTrackingState('stable')
        trackingStateRef.current = 'stable'
        hasTriggeredRef.current = true
        console.log('Capturing!')

        // Extract the card image from the fixed zone
        const extracted = cardDetectionService.extractCard(video, result.card)
        setExtractedCard(extracted)

        // Call the callback using ref to get latest function
        onStableRef.current?.(result.card, extracted)

        // Start cooldown and require card removal before next scan
        cooldownUntilRef.current = now + COOLDOWN_AFTER_CAPTURE
        requireCardRemovalRef.current = true
        console.log('Cooldown started - remove card to scan next')
      }

      lastCardRef.current = result.card
    } else {
      noCardCountRef.current++

      if (noCardCountRef.current >= NO_CARD_THRESHOLD) {
        // Card has been removed
        if (requireCardRemovalRef.current) {
          requireCardRemovalRef.current = false
          console.log('Card removed - ready for next card')
        }

        if (trackingStateRef.current !== 'no-card' && trackingStateRef.current !== 'cooldown' && lastCardRef.current) {
          console.log('Card lost')
          onCardLostRef.current?.()
        }

        setTrackingState('no-card')
        trackingStateRef.current = 'no-card'
        setDetectedCard(null)
        setStabilityProgress(0)
        stableStartTimeRef.current = null
        hasTriggeredRef.current = false
        lastCardRef.current = null
      }
    }
  }, []) // No dependencies - uses refs for everything

  const startTracking = useCallback((video: HTMLVideoElement) => {
    console.log('Starting card tracking...')
    videoRef.current = video

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Reset state
    setTrackingState('no-card')
    trackingStateRef.current = 'no-card'
    setDetectedCard(null)
    setStabilityProgress(0)
    lastCardRef.current = null
    stableStartTimeRef.current = null
    hasTriggeredRef.current = false
    noCardCountRef.current = 0

    intervalRef.current = window.setInterval(processFrame, sampleInterval)
  }, [processFrame, sampleInterval])

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    videoRef.current = null
    setTrackingState('no-card')
    trackingStateRef.current = 'no-card'
    setDetectedCard(null)
    setStabilityProgress(0)
    setDebugCanvas(null)
    setExtractedCard(null)
  }, [])

  const reset = useCallback(() => {
    stableStartTimeRef.current = null
    hasTriggeredRef.current = false
    lastCardRef.current = null
    noCardCountRef.current = 0
    cooldownUntilRef.current = 0
    requireCardRemovalRef.current = false
    setTrackingState('no-card')
    trackingStateRef.current = 'no-card'
    setStabilityProgress(0)
    setExtractedCard(null)
  }, [])

  /**
   * Manually capture the current card (for manual capture button)
   */
  const captureCard = useCallback((): HTMLCanvasElement | null => {
    if (!videoRef.current || !detectedCard) {
      // If no card detected, capture the whole frame center
      if (videoRef.current) {
        const video = videoRef.current
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 560

        const ctx = canvas.getContext('2d')!
        const vw = video.videoWidth
        const vh = video.videoHeight

        // Crop center of frame with card aspect ratio
        const cardAspect = 400 / 560
        let srcW, srcH, srcX, srcY

        if (vw / vh > cardAspect) {
          srcH = vh * 0.8
          srcW = srcH * cardAspect
        } else {
          srcW = vw * 0.5
          srcH = srcW / cardAspect
        }
        srcX = (vw - srcW) / 2
        srcY = (vh - srcH) / 2

        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, 400, 560)
        setExtractedCard(canvas)
        return canvas
      }
      return null
    }

    const extracted = cardDetectionService.extractCard(videoRef.current, detectedCard)
    setExtractedCard(extracted)
    return extracted
  }, [detectedCard])

  return {
    trackingState,
    detectedCard,
    stabilityProgress,
    debugCanvas,
    extractedCard,
    startTracking,
    stopTracking,
    reset,
    captureCard,
  }
}
