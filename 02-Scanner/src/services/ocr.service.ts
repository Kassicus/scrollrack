import Tesseract, { createWorker, type Worker } from 'tesseract.js'

class OCRService {
  private worker: Worker | null = null
  private isInitializing = false
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.worker) return
    if (this.initPromise) return this.initPromise

    this.isInitializing = true
    this.initPromise = this.createWorker()
    await this.initPromise
    this.isInitializing = false
  }

  private async createWorker(): Promise<void> {
    this.worker = await createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
        }
      },
    })

    // Configure for card name recognition (single line, alphanumeric with some punctuation)
    await this.worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-',. /",
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    })
  }

  async recognizeText(imageSource: string | HTMLCanvasElement): Promise<OCRResult> {
    await this.initialize()

    if (!this.worker) {
      throw new Error('OCR worker not initialized')
    }

    const startTime = performance.now()

    try {
      const result = await this.worker.recognize(imageSource)
      const endTime = performance.now()

      const text = result.data.text.trim()
      const confidence = result.data.confidence

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
      this.initPromise = null
    }
  }

  isReady(): boolean {
    return this.worker !== null && !this.isInitializing
  }
}

export interface OCRResult {
  text: string
  confidence: number
  processingTime: number
}

export const ocrService = new OCRService()
