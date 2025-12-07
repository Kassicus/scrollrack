import Tesseract, { type Worker } from 'tesseract.js'

class OCRService {
  private worker: Worker | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise
    }

    if (this.isInitialized && this.worker) {
      return
    }

    this.initPromise = this.doInitialize()
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    console.log('OCR: Creating worker...')
    const startTime = performance.now()

    try {
      this.worker = await Tesseract.createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'loading language traineddata') {
            console.log('OCR: Loading language data...')
          }
        },
      })

      const elapsed = performance.now() - startTime
      console.log(`OCR: Worker ready in ${elapsed.toFixed(0)}ms`)
      this.isInitialized = true
    } catch (error) {
      console.error('OCR: Failed to create worker:', error)
      this.initPromise = null
      throw error
    }
  }

  async recognizeText(imageSource: string | HTMLCanvasElement): Promise<OCRResult> {
    // Ensure worker is initialized
    if (!this.worker) {
      await this.initialize()
    }

    if (!this.worker) {
      throw new Error('OCR worker not available')
    }

    const startTime = performance.now()

    // Convert canvas to PNG data URL - known working format for Tesseract
    let imageData: string
    if (imageSource instanceof HTMLCanvasElement) {
      imageData = imageSource.toDataURL('image/png')
      console.log('OCR input:', imageSource.width, 'x', imageSource.height)
    } else {
      imageData = imageSource
    }

    try {
      const result = await this.worker.recognize(imageData)

      const endTime = performance.now()
      const text = result.data.text.trim()
      const confidence = result.data.confidence

      console.log('OCR result:', { text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), confidence, time: `${(endTime - startTime).toFixed(0)}ms` })

      return {
        text,
        confidence,
        processingTime: endTime - startTime,
      }
    } catch (error) {
      console.error('OCR Error:', error)
      throw new Error('Failed to recognize text from image')
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
    this.isInitialized = false
    this.initPromise = null
    console.log('OCR service terminated')
  }

  isReady(): boolean {
    return this.isInitialized && this.worker !== null
  }
}

export interface OCRResult {
  text: string
  confidence: number
  processingTime: number
}

export const ocrService = new OCRService()
