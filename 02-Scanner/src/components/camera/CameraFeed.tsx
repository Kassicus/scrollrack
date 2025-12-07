import { useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, RefreshCw, Loader2 } from 'lucide-react'
import { useCamera } from '@/hooks/useCamera'
import { useCardRecognition, type RecognitionStatus } from '@/hooks/useCardRecognition'
import { useStabilityDetection, type StabilityState } from '@/hooks/useStabilityDetection'
import { useAudioFeedback } from '@/hooks/useAudioFeedback'
import { useScanStore } from '@/store/scanStore'
import { Button } from '@/components/ui/button'
import { DetectionZone } from './DetectionZone'
import { cn } from '@/lib/utils'

interface CameraFeedProps {
  onRecognitionComplete?: () => void
}

export function CameraFeed({ onRecognitionComplete }: CameraFeedProps) {
  const webcamRef = useRef<Webcam>(null)
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    hasPermission,
    error: cameraError,
    requestPermission,
  } = useCamera()

  const { status, recognizeCard, isInitialized, result } = useCardRecognition()
  const { autoCapture, setAutoCapture, setCurrentResult } = useScanStore()
  const { playSuccess, playError, playCapture, playStable } = useAudioFeedback()

  const isProcessing = status === 'processing'

  const handleCapture = useCallback(async () => {
    if (!webcamRef.current || isProcessing) return

    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return

    playCapture()
    const recognitionResult = await recognizeCard(imageSrc)
    setCurrentResult(recognitionResult)

    if (recognitionResult.card) {
      playSuccess()
    } else {
      playError()
    }

    onRecognitionComplete?.()
  }, [recognizeCard, isProcessing, setCurrentResult, onRecognitionComplete, playCapture, playSuccess, playError])

  // Stability detection for auto-capture
  const { stabilityState, stabilityProgress, startMonitoring, stopMonitoring, reset } =
    useStabilityDetection({
      enabled: autoCapture && isInitialized && !isProcessing,
      onStable: () => {
        playStable()
        handleCapture()
      },
    })

  // Start/stop monitoring based on video element
  useEffect(() => {
    const video = webcamRef.current?.video
    if (video && autoCapture && isInitialized && !isProcessing) {
      startMonitoring(video)
    } else {
      stopMonitoring()
    }

    return () => stopMonitoring()
  }, [autoCapture, isInitialized, isProcessing, startMonitoring, stopMonitoring])

  // Reset stability after successful recognition
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      // Small delay before allowing next auto-capture
      const timeout = setTimeout(() => {
        reset()
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [status, reset])

  // Keyboard shortcut for manual capture
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isProcessing) {
        e.preventDefault()
        handleCapture()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleCapture, isProcessing])

  const getStatusInfo = (
    recognitionStatus: RecognitionStatus,
    stability: StabilityState
  ): { color: string; text: string } => {
    if (recognitionStatus === 'initializing') {
      return { color: 'bg-warning', text: 'Initializing OCR...' }
    }
    if (recognitionStatus === 'processing') {
      return { color: 'bg-primary animate-pulse', text: 'Recognizing card...' }
    }
    if (recognitionStatus === 'success') {
      return { color: 'bg-success', text: 'Card recognized!' }
    }
    if (recognitionStatus === 'error' && result?.error) {
      return { color: 'bg-destructive', text: result.error }
    }

    // Show stability state when idle
    switch (stability) {
      case 'no-card':
        return { color: 'bg-muted-foreground', text: 'Position a card in the frame' }
      case 'moving':
        return { color: 'bg-warning', text: 'Hold card steady...' }
      case 'stabilizing':
        return { color: 'bg-primary', text: 'Detecting card...' }
      case 'stable':
        return { color: 'bg-success', text: 'Card stable - capturing!' }
      default:
        return { color: 'bg-success', text: 'Ready to scan' }
    }
  }

  const statusInfo = getStatusInfo(status, stabilityState)

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
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="relative aspect-video bg-black">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }}
          className="w-full h-full object-cover"
        />
        <DetectionZone
          state={isProcessing ? 'processing' : stabilityState}
          progress={stabilityProgress}
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

        {/* Stability progress bar (when auto-capture enabled) */}
        {autoCapture && stabilityState === 'stabilizing' && (
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
              onClick={handleCapture}
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
          {autoCapture && ' • Auto-capture will trigger when card is stable'}
        </p>
      </div>
    </div>
  )
}
