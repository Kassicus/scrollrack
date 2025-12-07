import { useState, useCallback, useEffect, useRef } from 'react'
import { ocrService, type OCRResult } from '@/services/ocr.service'
import { imageService, type ProcessedImage } from '@/services/image.service'
import { scryfallService, type CardLookupResult } from '@/services/scryfall.service'
import { extractCardName, isValidCardName } from '@/utils/textNormalization'
import { correctOCRErrors } from '@/utils/fuzzyMatch'
import type { ScryfallCard } from '@/types/scryfall.types'

export type RecognitionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error'

export interface RecognitionOptions {
  // If true, the image is already an extracted card (from card tracking)
  isPreExtracted?: boolean
  // If true, include debug images in the result
  debug?: boolean
}

export interface RecognitionResult {
  card: ScryfallCard | null
  ocrText: string
  confidence: number
  matchType: 'exact' | 'fuzzy' | null
  suggestions: string[]
  processingTime: number
  error: string | null
  // Debug info
  processedImage?: ProcessedImage
}

export function useCardRecognition() {
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const processingRef = useRef(false)

  // Initialize OCR worker on mount
  // Note: We don't terminate on unmount because ocrService is a singleton
  // that should persist across component re-mounts (e.g., view switches)
  useEffect(() => {
    const init = async () => {
      setStatus('initializing')
      try {
        await ocrService.initialize()
        setIsInitialized(true)
        setStatus('ready')
      } catch (error) {
        console.error('Failed to initialize OCR:', error)
        setStatus('error')
      }
    }
    init()
  }, [])

  const recognizeCard = useCallback(
    async (
      imageSource: string | HTMLCanvasElement | HTMLVideoElement,
      options: RecognitionOptions = {}
    ): Promise<RecognitionResult> => {
      const { isPreExtracted = false, debug = false } = options

      if (processingRef.current) {
        return {
          card: null,
          ocrText: '',
          confidence: 0,
          matchType: null,
          suggestions: [],
          processingTime: 0,
          error: 'Recognition already in progress',
        }
      }

      processingRef.current = true
      setStatus('processing')
      const startTime = performance.now()

      try {
        // Step 1: Process image for OCR
        // If pre-extracted (from card tracking), skip detection zone cropping
        console.log('Processing image for OCR...')
        const processedImage = await imageService.processForOCR(imageSource, {
          cropToDetectionZone: !isPreExtracted,
          isPreExtracted,
          debug,
          useFullCard: true, // Full card works better than name region for Tesseract
        })
        console.log('Processed image size:', processedImage.canvas.width, 'x', processedImage.canvas.height)

        // Step 2: Run OCR on processed image
        console.log('Running OCR...')
        const ocrResult: OCRResult = await ocrService.recognizeText(processedImage.canvas)

        // Step 3: Extract and normalize card name
        const rawText = ocrResult.text
        const correctedText = correctOCRErrors(rawText)
        const cardName = extractCardName(correctedText)

        console.log('OCR Result:', { rawText, correctedText, cardName, confidence: ocrResult.confidence })

        // Step 4: Validate extracted name
        if (!isValidCardName(cardName)) {
          const result: RecognitionResult = {
            card: null,
            ocrText: rawText,
            confidence: ocrResult.confidence,
            matchType: null,
            suggestions: [],
            processingTime: performance.now() - startTime,
            error: 'Could not extract valid card name from image',
            processedImage: debug ? processedImage : undefined,
          }
          setResult(result)
          setStatus('error')
          processingRef.current = false
          return result
        }

        // Step 5: Look up card in Scryfall
        const lookupResult: CardLookupResult = await scryfallService.lookupCard(cardName)

        const recognitionResult: RecognitionResult = {
          card: lookupResult.card || null,
          ocrText: cardName,
          confidence: ocrResult.confidence,
          matchType: lookupResult.matchType || null,
          suggestions: lookupResult.suggestions || [],
          processingTime: performance.now() - startTime,
          error: lookupResult.success ? null : lookupResult.error || 'Card not found',
          processedImage: debug ? processedImage : undefined,
        }

        setResult(recognitionResult)
        setStatus(lookupResult.success ? 'success' : 'error')
        processingRef.current = false

        return recognitionResult
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Recognition failed'
        const result: RecognitionResult = {
          card: null,
          ocrText: '',
          confidence: 0,
          matchType: null,
          suggestions: [],
          processingTime: performance.now() - startTime,
          error: errorMessage,
        }
        setResult(result)
        setStatus('error')
        processingRef.current = false
        return result
      }
    },
    []
  )

  const reset = useCallback(() => {
    setResult(null)
    setStatus(isInitialized ? 'ready' : 'idle')
  }, [isInitialized])

  const lookupByName = useCallback(async (name: string): Promise<RecognitionResult> => {
    setStatus('processing')
    const startTime = performance.now()

    try {
      const lookupResult = await scryfallService.lookupCard(name)

      const result: RecognitionResult = {
        card: lookupResult.card || null,
        ocrText: name,
        confidence: 100,
        matchType: lookupResult.matchType || null,
        suggestions: lookupResult.suggestions || [],
        processingTime: performance.now() - startTime,
        error: lookupResult.success ? null : lookupResult.error || 'Card not found',
      }

      setResult(result)
      setStatus(lookupResult.success ? 'success' : 'error')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lookup failed'
      const result: RecognitionResult = {
        card: null,
        ocrText: name,
        confidence: 0,
        matchType: null,
        suggestions: [],
        processingTime: performance.now() - startTime,
        error: errorMessage,
      }
      setResult(result)
      setStatus('error')
      return result
    }
  }, [])

  return {
    status,
    result,
    isInitialized,
    recognizeCard,
    lookupByName,
    reset,
  }
}
