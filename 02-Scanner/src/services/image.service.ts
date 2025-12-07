// MTG card name region is approximately at the top of the card
// Expanded slightly to ensure we capture the full name on all card types
const NAME_REGION = {
  x: 0.05,      // 5% from left (slightly wider)
  y: 0.03,      // 3% from top (start a bit higher)
  width: 0.90,  // 90% of card width (wider to catch full names)
  height: 0.12, // 12% of card height (taller to ensure full text capture)
}

// Detection zone as percentage of video frame (fallback for manual capture)
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
  // Additional debug stages
  stageImages?: {
    original: HTMLCanvasElement
    cropped: HTMLCanvasElement
    nameRegion: HTMLCanvasElement
    enhanced: HTMLCanvasElement
  }
  debugInfo?: {
    cropRegion: { x: number; y: number; width: number; height: number }
    nameRegion: { x: number; y: number; width: number; height: number }
  }
}

export interface CropOptions {
  cropToDetectionZone?: boolean
  debug?: boolean
  // If provided, skip cropping - the image is already an extracted card
  isPreExtracted?: boolean
  // If true, use full card instead of name region (for debugging)
  useFullCard?: boolean
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

    // Store original for debug
    const originalCopy = options.debug ? this.copyCanvas(sourceCanvas) : null

    // If image is pre-extracted (from card tracking), skip the detection zone crop
    if (!options.isPreExtracted && options.cropToDetectionZone) {
      const result = this.cropToCenteredDetectionZone(sourceCanvas)
      cardCanvas = result.canvas
      cropRegion = result.region
    }

    // Store cropped version for debug
    const croppedCopy = options.debug ? this.copyCanvas(cardCanvas) : null

    // DEBUG: If useFullCard is true, skip name region extraction
    let ocrCanvas: HTMLCanvasElement
    let nameRegionData: { canvas: HTMLCanvasElement; region: { x: number; y: number; width: number; height: number } }

    if (options.useFullCard) {
      // Full card works better - Tesseract needs more context than just the name region
      ocrCanvas = cardCanvas
      nameRegionData = { canvas: cardCanvas, region: cropRegion }
    } else {
      // Extract the card name region from the card image
      nameRegionData = this.extractNameRegion(cardCanvas)
      ocrCanvas = nameRegionData.canvas
    }

    // Store name region for debug
    const nameRegionCopy = options.debug ? this.copyCanvas(nameRegionData.canvas) : null

    // Apply image enhancements for better OCR
    const enhanced = this.enhanceForOCR(ocrCanvas)

    const debugInfo = options.debug ? {
      cropRegion,
      nameRegion: nameRegionData.region,
    } : undefined

    const stageImages = options.debug && originalCopy && croppedCopy && nameRegionCopy ? {
      original: originalCopy,
      cropped: croppedCopy,
      nameRegion: nameRegionCopy,
      enhanced: this.copyCanvas(enhanced),
    } : undefined

    return {
      canvas: enhanced,
      originalWidth,
      originalHeight,
      stageImages,
      debugInfo,
    }
  }

  private copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const copy = document.createElement('canvas')
    copy.width = source.width
    copy.height = source.height
    const ctx = copy.getContext('2d')!
    ctx.drawImage(source, 0, 0)
    return copy
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
   * No processing - just return the canvas as-is
   * Tesseract handles grayscale conversion internally
   */
  private enhanceForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
    return canvas
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
