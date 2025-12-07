/**
 * Card Detection Service - Simplified
 *
 * Uses a fixed detection zone in the center of the frame.
 * Detects when a card is present by checking for image variance/contrast.
 */

const CARD_ASPECT_RATIO = 2.5 / 3.5 // ~0.714

export interface DetectedCard {
  x: number
  y: number
  width: number
  height: number
  corners: { x: number; y: number }[]
  confidence: number
  aspectRatio: number
}

export interface CardDetectionResult {
  detected: boolean
  card: DetectedCard | null
  debugCanvas?: HTMLCanvasElement
}

class CardDetectionService {
  private debugMode = false
  private wasDetecting = false // Track previous state for hysteresis

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
  }

  /**
   * Detect if a card is present in the center zone of the frame
   */
  detectCard(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): CardDetectionResult {
    let width: number, height: number
    if (source instanceof HTMLVideoElement) {
      width = source.videoWidth
      height = source.videoHeight
    } else if (source instanceof HTMLCanvasElement) {
      width = source.width
      height = source.height
    } else {
      width = source.naturalWidth
      height = source.naturalHeight
    }

    if (!width || !height) {
      return { detected: false, card: null }
    }

    // Define a detection zone - card-shaped region in center, ~50% of frame height
    const zoneHeight = height * 0.65
    const zoneWidth = zoneHeight * CARD_ASPECT_RATIO
    const zoneX = (width - zoneWidth) / 2
    const zoneY = (height - zoneHeight) / 2

    // Sample the zone to check if something is there (not just background)
    const canvas = document.createElement('canvas')
    canvas.width = 100 // Small sample size for speed
    canvas.height = 140
    const ctx = canvas.getContext('2d')!

    ctx.drawImage(source, zoneX, zoneY, zoneWidth, zoneHeight, 0, 0, 100, 140)
    const imageData = ctx.getImageData(0, 0, 100, 140)

    // Check if there's meaningful content (not just uniform background)
    // Use hysteresis: lower thresholds if we were already detecting
    const hasContent = this.checkForContent(imageData, this.wasDetecting)

    if (!hasContent) {
      this.wasDetecting = false
      return { detected: false, card: null }
    }

    this.wasDetecting = true

    // Card detected in zone
    const card: DetectedCard = {
      x: Math.round(zoneX),
      y: Math.round(zoneY),
      width: Math.round(zoneWidth),
      height: Math.round(zoneHeight),
      corners: [
        { x: Math.round(zoneX), y: Math.round(zoneY) },
        { x: Math.round(zoneX + zoneWidth), y: Math.round(zoneY) },
        { x: Math.round(zoneX + zoneWidth), y: Math.round(zoneY + zoneHeight) },
        { x: Math.round(zoneX), y: Math.round(zoneY + zoneHeight) },
      ],
      confidence: 1.0,
      aspectRatio: CARD_ASPECT_RATIO
    }

    return {
      detected: true,
      card,
      debugCanvas: this.debugMode ? canvas : undefined
    }
  }

  /**
   * Check if the sampled region contains a card (not just any content like a face)
   * Uses multiple heuristics specific to trading cards:
   * 1. Edge contrast - cards have distinct rectangular edges
   * 2. Title bar - cards have text at the top with high local contrast
   * 3. Overall structure - cards have more uniform regions than faces
   */
  private checkForContent(imageData: ImageData, wasDetecting: boolean): boolean {
    const w = imageData.width   // 100
    const h = imageData.height  // 140
    const data = imageData.data

    // 1. Check for edge contrast (card boundary against background)
    // Cards create distinct edges at the perimeter
    const edgeScore = this.getEdgeScore(data, w, h)
    const edgeThreshold = wasDetecting ? 15 : 25

    // 2. Check for title bar (high contrast text region at top)
    const titleBarContrast = this.getTitleBarContrast(data, w, h)
    const titleThreshold = wasDetecting ? 30 : 50

    // 3. Check for horizontal structure (cards have horizontal bands - title, art, text box)
    const horizontalStructure = this.getHorizontalStructure(data, w, h)
    const structureThreshold = wasDetecting ? 800 : 1200

    // Card must have good edge definition AND (title bar contrast OR horizontal structure)
    const hasEdges = edgeScore > edgeThreshold
    const hasTitleBar = titleBarContrast > titleThreshold
    const hasStructure = horizontalStructure > structureThreshold

    // For a card: need edges + at least one of (title bar, structure)
    const isCard = hasEdges && (hasTitleBar || hasStructure)

    return isCard
  }

  /**
   * Check edge contrast at the perimeter of the detection zone
   * Cards have distinct rectangular boundaries
   */
  private getEdgeScore(data: Uint8ClampedArray, w: number, h: number): number {
    let edgeSum = 0
    let samples = 0

    // Sample left and right edges (compare pixels at edge vs slightly inside)
    const edgeWidth = 3
    const innerOffset = 8

    for (let y = Math.floor(h * 0.1); y < Math.floor(h * 0.9); y += 2) {
      // Left edge
      const leftEdgeIdx = (y * w + edgeWidth) * 4
      const leftInnerIdx = (y * w + edgeWidth + innerOffset) * 4
      const leftEdgeBright = (data[leftEdgeIdx] + data[leftEdgeIdx + 1] + data[leftEdgeIdx + 2]) / 3
      const leftInnerBright = (data[leftInnerIdx] + data[leftInnerIdx + 1] + data[leftInnerIdx + 2]) / 3
      edgeSum += Math.abs(leftEdgeBright - leftInnerBright)
      samples++

      // Right edge
      const rightEdgeIdx = (y * w + (w - edgeWidth - 1)) * 4
      const rightInnerIdx = (y * w + (w - edgeWidth - innerOffset - 1)) * 4
      const rightEdgeBright = (data[rightEdgeIdx] + data[rightEdgeIdx + 1] + data[rightEdgeIdx + 2]) / 3
      const rightInnerBright = (data[rightInnerIdx] + data[rightInnerIdx + 1] + data[rightInnerIdx + 2]) / 3
      edgeSum += Math.abs(rightEdgeBright - rightInnerBright)
      samples++
    }

    // Sample top and bottom edges
    for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.9); x += 2) {
      // Top edge
      const topEdgeIdx = (edgeWidth * w + x) * 4
      const topInnerIdx = ((edgeWidth + innerOffset) * w + x) * 4
      const topEdgeBright = (data[topEdgeIdx] + data[topEdgeIdx + 1] + data[topEdgeIdx + 2]) / 3
      const topInnerBright = (data[topInnerIdx] + data[topInnerIdx + 1] + data[topInnerIdx + 2]) / 3
      edgeSum += Math.abs(topEdgeBright - topInnerBright)
      samples++

      // Bottom edge
      const bottomEdgeIdx = ((h - edgeWidth - 1) * w + x) * 4
      const bottomInnerIdx = ((h - edgeWidth - innerOffset - 1) * w + x) * 4
      const bottomEdgeBright = (data[bottomEdgeIdx] + data[bottomEdgeIdx + 1] + data[bottomEdgeIdx + 2]) / 3
      const bottomInnerBright = (data[bottomInnerIdx] + data[bottomInnerIdx + 1] + data[bottomInnerIdx + 2]) / 3
      edgeSum += Math.abs(bottomEdgeBright - bottomInnerBright)
      samples++
    }

    return samples > 0 ? edgeSum / samples : 0
  }

  /**
   * Get contrast in the title bar region (where card name is)
   * Cards have high-contrast text here
   */
  private getTitleBarContrast(data: Uint8ClampedArray, w: number, h: number): number {
    let min = 255, max = 0

    // Sample the title bar region (top 5-15% of card, excluding borders)
    for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.15); y++) {
      for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
        const idx = (y * w + x) * 4
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        min = Math.min(min, brightness)
        max = Math.max(max, brightness)
      }
    }

    return max - min
  }

  /**
   * Check for horizontal structure (cards have distinct horizontal bands)
   * This distinguishes cards from faces which have more organic structure
   */
  private getHorizontalStructure(data: Uint8ClampedArray, w: number, h: number): number {
    // Calculate average brightness for each row, then measure variance between rows
    const rowAverages: number[] = []

    for (let y = 0; y < h; y++) {
      let rowSum = 0
      for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.9); x++) {
        const idx = (y * w + x) * 4
        rowSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      }
      rowAverages.push(rowSum / (w * 0.8))
    }

    // Calculate variance of row averages
    const mean = rowAverages.reduce((a, b) => a + b, 0) / rowAverages.length
    const variance = rowAverages.reduce((sum, val) => sum + (val - mean) ** 2, 0) / rowAverages.length

    return variance
  }

  /**
   * Check if two cards are roughly in the same position
   */
  isCardStable(card1: DetectedCard | null, card2: DetectedCard | null, _threshold = 100): boolean {
    // With fixed zone, cards are always "stable" if both detected
    return card1 !== null && card2 !== null
  }

  /**
   * Extract the card region - just use the detection bounds directly
   */
  extractCard(
    source: HTMLVideoElement | HTMLCanvasElement,
    card: DetectedCard,
    outputWidth = 400,
    outputHeight = 560
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')!

    // Extract exactly what was detected
    ctx.drawImage(
      source,
      card.x, card.y, card.width, card.height,
      0, 0, outputWidth, outputHeight
    )

    return canvas
  }
}

export const cardDetectionService = new CardDetectionService()
