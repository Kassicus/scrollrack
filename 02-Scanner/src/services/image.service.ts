// MTG card name region is approximately at the top of the card
const NAME_REGION = {
  x: 0.06,      // 6% from left
  y: 0.04,      // 4% from top
  width: 0.88,  // 88% of card width
  height: 0.10, // 10% of card height
}

// Detection zone as percentage of video frame
// Card aspect ratio is 2.5:3.5 = 0.714:1
// For 16:9 video, we size to fit within frame with margins
const DETECTION_ZONE_PERCENT = {
  width: 0.30,   // 30% of video width
  height: 0.75,  // 75% of video height (maintains ~card aspect ratio in 16:9)
}

export interface ProcessedImage {
  canvas: HTMLCanvasElement
  originalWidth: number
  originalHeight: number
  debugInfo?: {
    cropRegion: { x: number; y: number; width: number; height: number }
    nameRegion: { x: number; y: number; width: number; height: number }
  }
}

export interface CropOptions {
  cropToDetectionZone?: boolean
  debug?: boolean
}

class ImageService {
  /**
   * Process an image for OCR by extracting and enhancing the card name region
   */
  processForOCR(
    imageSource: string | HTMLCanvasElement | HTMLVideoElement,
    options: CropOptions = { cropToDetectionZone: true }
  ): Promise<ProcessedImage> {
    return new Promise((resolve, reject) => {
      if (typeof imageSource === 'string') {
        const img = new Image()
        img.onload = () => {
          try {
            const result = this.processImageElement(img, options)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageSource
      } else if (imageSource instanceof HTMLCanvasElement) {
        try {
          const result = this.processCanvas(imageSource, options)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      } else if (imageSource instanceof HTMLVideoElement) {
        try {
          const result = this.processVideoElement(imageSource, options)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('Invalid image source'))
      }
    })
  }

  private processImageElement(img: HTMLImageElement, options: CropOptions): ProcessedImage {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return this.processCanvas(canvas, options)
  }

  private processVideoElement(video: HTMLVideoElement, options: CropOptions): ProcessedImage {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    return this.processCanvas(canvas, options)
  }

  private processCanvas(sourceCanvas: HTMLCanvasElement, options: CropOptions): ProcessedImage {
    const originalWidth = sourceCanvas.width
    const originalHeight = sourceCanvas.height

    let cardCanvas = sourceCanvas
    let cropRegion = { x: 0, y: 0, width: originalWidth, height: originalHeight }

    if (options.cropToDetectionZone) {
      const result = this.cropToCenteredDetectionZone(sourceCanvas)
      cardCanvas = result.canvas
      cropRegion = result.region
    }

    // Extract the card name region from the card image
    const nameRegion = this.extractNameRegion(cardCanvas)

    // Apply image enhancements for better OCR
    const enhanced = this.enhanceForOCR(nameRegion.canvas)

    const debugInfo = options.debug ? {
      cropRegion,
      nameRegion: nameRegion.region,
    } : undefined

    return {
      canvas: enhanced,
      originalWidth,
      originalHeight,
      debugInfo,
    }
  }

  /**
   * Crop to the centered detection zone using percentage-based dimensions
   * This ensures the crop region always fits within the video frame
   */
  private cropToCenteredDetectionZone(canvas: HTMLCanvasElement): {
    canvas: HTMLCanvasElement
    region: { x: number; y: number; width: number; height: number }
  } {
    const frameWidth = canvas.width
    const frameHeight = canvas.height

    // Calculate detection zone size as percentage of frame
    const zoneWidth = Math.round(frameWidth * DETECTION_ZONE_PERCENT.width)
    const zoneHeight = Math.round(frameHeight * DETECTION_ZONE_PERCENT.height)

    // Center the zone in the frame
    const zoneX = Math.round((frameWidth - zoneWidth) / 2)
    const zoneY = Math.round((frameHeight - zoneHeight) / 2)

    // Ensure we don't go out of bounds
    const safeX = Math.max(0, zoneX)
    const safeY = Math.max(0, zoneY)
    const safeWidth = Math.min(zoneWidth, frameWidth - safeX)
    const safeHeight = Math.min(zoneHeight, frameHeight - safeY)

    console.log('Crop region:', {
      frame: { width: frameWidth, height: frameHeight },
      zone: { x: safeX, y: safeY, width: safeWidth, height: safeHeight }
    })

    // Create output canvas at a consistent size for OCR
    const cardCanvas = document.createElement('canvas')
    cardCanvas.width = 400
    cardCanvas.height = 560
    const cardCtx = cardCanvas.getContext('2d')!

    // Extract the detection zone area and scale to output size
    cardCtx.drawImage(
      canvas,
      safeX, safeY, safeWidth, safeHeight,
      0, 0, cardCanvas.width, cardCanvas.height
    )

    return {
      canvas: cardCanvas,
      region: { x: safeX, y: safeY, width: safeWidth, height: safeHeight }
    }
  }

  /**
   * Extract the card name region from a card image
   */
  private extractNameRegion(canvas: HTMLCanvasElement): {
    canvas: HTMLCanvasElement
    region: { x: number; y: number; width: number; height: number }
  } {
    // Calculate region coordinates
    const x = Math.floor(canvas.width * NAME_REGION.x)
    const y = Math.floor(canvas.height * NAME_REGION.y)
    const width = Math.floor(canvas.width * NAME_REGION.width)
    const height = Math.floor(canvas.height * NAME_REGION.height)

    // Create a new canvas for the extracted region
    const regionCanvas = document.createElement('canvas')
    regionCanvas.width = width
    regionCanvas.height = height
    const regionCtx = regionCanvas.getContext('2d')!

    // Extract the region using drawImage (more reliable than getImageData)
    regionCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height)

    return {
      canvas: regionCanvas,
      region: { x, y, width, height }
    }
  }

  /**
   * Apply image processing to enhance text for OCR
   */
  private enhanceForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Step 1: Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = gray
      data[i + 1] = gray
      data[i + 2] = gray
    }

    // Step 2: Increase contrast
    const contrast = 1.4
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
    for (let i = 0; i < data.length; i += 4) {
      data[i] = this.clamp(factor * (data[i] - 128) + 128)
      data[i + 1] = this.clamp(factor * (data[i + 1] - 128) + 128)
      data[i + 2] = this.clamp(factor * (data[i + 2] - 128) + 128)
    }

    // Step 3: Apply Otsu's thresholding for black/white
    const threshold = this.calculateOtsuThreshold(data)
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
    }

    // Create output canvas with 2x scaling for better OCR
    const scale = 2
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = canvas.width * scale
    outputCanvas.height = canvas.height * scale
    const outputCtx = outputCanvas.getContext('2d')!

    // Put processed data back to source canvas
    ctx.putImageData(imageData, 0, 0)

    // Scale up with nearest-neighbor for sharp edges
    outputCtx.imageSmoothingEnabled = false
    outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height)

    return outputCanvas
  }

  /**
   * Calculate optimal threshold using Otsu's method
   */
  private calculateOtsuThreshold(data: Uint8ClampedArray): number {
    const histogram = new Array(256).fill(0)
    const total = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++
    }

    let sum = 0
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i]
    }

    let sumB = 0
    let wB = 0
    let wF = 0
    let maxVariance = 0
    let threshold = 128 // Default fallback

    for (let i = 0; i < 256; i++) {
      wB += histogram[i]
      if (wB === 0) continue

      wF = total - wB
      if (wF === 0) break

      sumB += i * histogram[i]

      const mB = sumB / wB
      const mF = (sum - sumB) / wF
      const variance = wB * wF * (mB - mF) * (mB - mF)

      if (variance > maxVariance) {
        maxVariance = variance
        threshold = i
      }
    }

    return threshold
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)))
  }

  /**
   * Get the detection zone dimensions for UI overlay
   * Returns percentages that can be used in CSS
   */
  getDetectionZonePercent(): { width: number; height: number } {
    return { ...DETECTION_ZONE_PERCENT }
  }
}

export const imageService = new ImageService()
