import { useCallback, useRef } from 'react'
import { useScanStore } from '@/store/scanStore'

// Web Audio API for generating feedback sounds
export function useAudioFeedback() {
  const { soundEnabled } = useScanStore()
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = 'sine') => {
      if (!soundEnabled) return

      try {
        const ctx = getAudioContext()
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.type = type
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

        // Fade out
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + duration)
      } catch (error) {
        console.warn('Audio feedback failed:', error)
      }
    },
    [soundEnabled, getAudioContext]
  )

  const playSuccess = useCallback(() => {
    // Pleasant ascending tone
    playTone(523.25, 0.1) // C5
    setTimeout(() => playTone(659.25, 0.1), 100) // E5
    setTimeout(() => playTone(783.99, 0.15), 200) // G5
  }, [playTone])

  const playError = useCallback(() => {
    // Low descending tone
    playTone(293.66, 0.15, 'square') // D4
    setTimeout(() => playTone(220, 0.2, 'square'), 150) // A3
  }, [playTone])

  const playCapture = useCallback(() => {
    // Quick shutter-like sound
    playTone(1000, 0.05, 'square')
  }, [playTone])

  const playStable = useCallback(() => {
    // Soft confirmation beep
    playTone(880, 0.08) // A5
  }, [playTone])

  return {
    playSuccess,
    playError,
    playCapture,
    playStable,
  }
}
