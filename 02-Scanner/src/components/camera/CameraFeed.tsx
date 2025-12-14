import { useRef, useCallback, useEffect, useState } from 'react'
import Webcam from 'react-webcam'
import { Camera, RefreshCw, Loader2, Bug, Check } from 'lucide-react'
import { useCamera } from '@/hooks/useCamera'
import { useCardRecognition, type RecognitionStatus } from '@/hooks/useCardRecognition'
import { useCardTracking, type TrackingState } from '@/hooks/useCardTracking'
import { useAudioFeedback } from '@/hooks/useAudioFeedback'
import { useScanStore } from '@/store/scanStore'
import { databaseService } from '@/services/database.service'
import { Button } from '@/components/ui/button'
import { CardOverlay } from './CardOverlay'
import { DebugPreview } from './DebugPreview'
import { cn } from '@/lib/utils'
import type { ProcessedImage } from '@/services/image.service'

interface CameraFeedProps {
  onRecognitionComplete?: () => void
}

export function CameraFeed({ onRecognitionComplete }: CameraFeedProps) {
  const webcamRef = useRef<Webcam>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [lastProcessedImage, setLastProcessedImage] = useState<ProcessedImage | null>(null)
  const [lastOcrText, setLastOcrText] = useState<string>('')
  const [lastConfidence, setLastConfidence] = useState<number>(0)
  const [lastProcessingTime, setLastProcessingTime] = useState<number>(0)
  const [lastAddedCard, setLastAddedCard] = useState<string | null>(null)

  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    hasPermission,
    error: cameraError,
    requestPermission,
  } = useCamera()

  const { status, recognizeCard, isInitialized, result, reset: resetRecognition } = useCardRecognition()
  const { autoCapture, setAutoCapture, setCurrentResult, cameraRotation, postScanDelay, addToHistory, performanceMode, resolution } = useScanStore()
  const { playSuccess, playError, playCapture, playStable } = useAudioFeedback()

  const isProcessing = status === 'processing'

  // Process a captured image through OCR
  const processCapture = useCallback(async (imageCanvas: HTMLCanvasElement) => {
    playCapture()

    const startTime = Date.now()
    const recognitionResult = await recognizeCard(imageCanvas, {
      isPreExtracted: true,
      debug: showDebug
    })

    setLastProcessingTime(Date.now() - startTime)
    setCurrentResult(recognitionResult)

    if (recognitionResult.ocrText) {
      setLastOcrText(recognitionResult.ocrText)
    }
    if (recognitionResult.confidence) {
      setLastConfidence(recognitionResult.confidence)
    }
    if (recognitionResult.processedImage) {
      setLastProcessedImage(recognitionResult.processedImage)
    }

    if (recognitionResult.card) {
      playSuccess()
      // Auto-add card to database and scan history
      await databaseService.addCard(recognitionResult.card, 1, false)
      addToHistory(recognitionResult.card, 1, false)
      setLastAddedCard(recognitionResult.card.name)
      console.log('Added to collection:', recognitionResult.card.name)
      // Clear the "added" message after 2 seconds
      setTimeout(() => setLastAddedCard(null), 2000)
    } else {
      playError()
    }

    onRecognitionComplete?.()
  }, [recognizeCard, setCurrentResult, onRecognitionComplete, playCapture, playSuccess, playError, showDebug, addToHistory])

  // Card tracking with auto-capture
  const {
    trackingState,
    detectedCard,
    stabilityProgress,
    extractedCard,
    startTracking,
    stopTracking,
    reset: resetTracking,
    captureCard,
  } = useCardTracking({
    enabled: autoCapture && isInitialized && !isProcessing,
    debug: showDebug,
    performanceMode,
    onStable: (_card, extracted) => {
      playStable()
      processCapture(extracted)
    },
  })

  // Start/stop tracking based on video element
  // Use a ref to track if we've started to avoid unnecessary restarts
  const trackingActiveRef = useRef(false)

  useEffect(() => {
    const video = webcamRef.current?.video
    const shouldTrack = video && autoCapture && isInitialized && !isProcessing

    if (shouldTrack && !trackingActiveRef.current) {
      trackingActiveRef.current = true
      startTracking(video)
    } else if (!shouldTrack && trackingActiveRef.current) {
      trackingActiveRef.current = false
      stopTracking()
    }

    return () => {
      if (trackingActiveRef.current) {
        trackingActiveRef.current = false
        stopTracking()
      }
    }
  }, [autoCapture, isInitialized, isProcessing, startTracking, stopTracking])

  // Reset tracking after recognition - uses configurable post-scan delay
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timeout = setTimeout(() => {
        resetTracking()
        resetRecognition()
      }, postScanDelay)
      return () => clearTimeout(timeout)
    }
  }, [status, resetTracking, resetRecognition, postScanDelay])

  // Manual capture handler
  const handleManualCapture = useCallback(async () => {
    if (!webcamRef.current || isProcessing) return

    // Try to use tracked card, fallback to screenshot
    let imageCanvas = captureCard()

    if (!imageCanvas) {
      // Fallback: capture from webcam screenshot
      const imageSrc = webcamRef.current.getScreenshot()
      if (!imageSrc) return

      // Convert to canvas
      const img = new Image()
      img.src = imageSrc
      await new Promise(resolve => { img.onload = resolve })

      imageCanvas = document.createElement('canvas')
      imageCanvas.width = img.width
      imageCanvas.height = img.height
      const ctx = imageCanvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
    }

    processCapture(imageCanvas)
  }, [captureCard, isProcessing, processCapture])

  // Keyboard shortcut for manual capture
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isProcessing) {
        e.preventDefault()
        handleManualCapture()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleManualCapture, isProcessing])

  const getStatusInfo = (
    recognitionStatus: RecognitionStatus,
    tracking: TrackingState
  ): { color: string; text: string } => {
    if (recognitionStatus === 'initializing') {
      return { color: 'bg-warning', text: 'Initializing OCR...' }
    }
    if (recognitionStatus === 'processing') {
      return { color: 'bg-primary animate-pulse', text: 'Recognizing card...' }
    }
    if (recognitionStatus === 'success') {
      return { color: 'bg-success', text: 'Card added! Ready for next card...' }
    }
    if (recognitionStatus === 'error' && result?.error) {
      return { color: 'bg-destructive', text: result.error }
    }

    switch (tracking) {
      case 'no-card':
        return { color: 'bg-muted-foreground', text: 'Place card in zone' }
      case 'tracking':
        return { color: 'bg-primary', text: 'Card detected - hold steady' }
      case 'stabilizing':
        return { color: 'bg-primary', text: 'Detecting card...' }
      case 'stable':
        return { color: 'bg-success', text: 'Card stable - capturing!' }
      case 'cooldown':
        return { color: 'bg-success', text: 'Remove card for next scan' }
      default:
        return { color: 'bg-success', text: 'Ready to scan' }
    }
  }

  const statusInfo = getStatusInfo(status, trackingState)

  // Get video dimensions for overlay
  const videoWidth = webcamRef.current?.video?.videoWidth || 1280
  const videoHeight = webcamRef.current?.video?.videoHeight || 720

  if (hasPermission === null) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 aspect-video flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>Requesting camera access...</p>
        </div>
      </div>
    )
  }

  if (hasPermission === false || cameraError) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 aspect-video flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-destructive mb-4">{cameraError || 'Camera access denied'}</p>
          <Button onClick={requestPermission} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="relative aspect-video bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={performanceMode ? 0.85 : 0.92}
            videoConstraints={{
              deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
              width: { ideal: resolution === '1080p' ? 1920 : resolution === '720p' ? 1280 : 854 },
              height: { ideal: resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480 },
            }}
            className={cn('w-full h-full object-cover', cameraRotation && 'rotate-180')}
          />

          {/* Card detection overlay */}
          <CardOverlay
            state={isProcessing ? 'processing' : trackingState}
            progress={stabilityProgress}
            detectedCard={detectedCard}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
          />

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-2" />
                <p className="text-white">Recognizing card...</p>
              </div>
            </div>
          )}

          {/* Success flash */}
          {status === 'success' && (
            <div className="absolute inset-0 bg-success/20 animate-pulse pointer-events-none" />
          )}

          {/* Card added notification */}
          {lastAddedCard && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-success text-success-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Check className="w-4 h-4" />
              <span className="font-medium">Added: {lastAddedCard}</span>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className={cn('w-2 h-2 rounded-full transition-colors', statusInfo.color)} />
            <span className="text-muted-foreground flex-1">{statusInfo.text}</span>
            {!isInitialized && (
              <span className="text-xs text-warning">OCR loading...</span>
            )}
          </div>

          {/* Stability progress bar (when tracking) */}
          {autoCapture && trackingState === 'stabilizing' && (
            <div className="mb-3">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${stabilityProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleManualCapture}
                disabled={isProcessing || !isInitialized}
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {isProcessing ? 'Processing...' : 'Capture'}
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Auto-capture
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <Bug className="w-3 h-3" />
                Debug
              </label>
            </div>

            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Keyboard shortcut hint */}
          <p className="text-xs text-muted-foreground mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Space</kbd> to capture
            {autoCapture && ' • Auto-capture triggers when card is stable'}
          </p>
        </div>
      </div>

      {/* Debug preview */}
      {showDebug && (
        <DebugPreview
          extractedCard={extractedCard}
          processedImage={lastProcessedImage}
          ocrText={lastOcrText}
          confidence={lastConfidence}
          processingTime={lastProcessingTime}
        />
      )}
    </div>
  )
}
