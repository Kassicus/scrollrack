import { useState, useEffect, useCallback } from 'react'
import { useScanStore } from '@/store/scanStore'

export interface CameraDevice {
  deviceId: string
  label: string
}

export function useCamera() {
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use Zustand store for camera selection (synced with settings page)
  const selectedDeviceId = useScanStore((state) => state.selectedCameraId)
  const setSelectedDeviceId = useScanStore((state) => state.setSelectedCameraId)

  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }))

      setDevices(videoDevices)

      // Only auto-select first camera if no camera is persisted in store
      // AND there are available cameras
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }

      // If persisted camera no longer exists, fall back to first available
      if (selectedDeviceId && videoDevices.length > 0) {
        const exists = videoDevices.some(d => d.deviceId === selectedDeviceId)
        if (!exists) {
          console.warn('Saved camera not found, falling back to first available')
          setSelectedDeviceId(videoDevices[0].deviceId)
        }
      }
    } catch (err) {
      setError('Failed to enumerate camera devices')
      console.error('Error enumerating devices:', err)
    }
  }, [selectedDeviceId, setSelectedDeviceId])

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())
      setHasPermission(true)
      setError(null)
      await enumerateDevices()
    } catch (err) {
      setHasPermission(false)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.')
        } else {
          setError(`Camera error: ${err.message}`)
        }
      }
    }
  }, [enumerateDevices])

  useEffect(() => {
    requestPermission()
  }, [requestPermission])

  useEffect(() => {
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices)
    }
  }, [enumerateDevices])

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    hasPermission,
    error,
    requestPermission,
  }
}
