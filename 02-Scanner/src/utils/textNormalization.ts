/**
 * Normalize OCR output for card name lookup
 */
export function normalizeCardName(text: string): string {
  let normalized = text
    .trim()
    // Remove common OCR artifacts
    .replace(/[|\\/_]/g, '')
    // Fix common character misreads
    .replace(/0/g, 'O')
    .replace(/1(?=[a-zA-Z])/g, 'l')
    .replace(/(?<=[a-zA-Z])1/g, 'l')
    // Normalize quotes and apostrophes
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    // Remove excessive punctuation
    .replace(/[.]{2,}/g, '')
    .replace(/[,]{2,}/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing non-alphanumeric
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[^a-zA-Z]+$/, '')

  return normalized
}

/**
 * Extract potential card name from OCR text
 * Handles multi-line OCR results
 */
export function extractCardName(ocrText: string): string {
  // Split by newlines and take the most promising line
  const lines = ocrText.split(/[\n\r]+/).map((line) => line.trim()).filter(Boolean)

  if (lines.length === 0) return ''
  if (lines.length === 1) return normalizeCardName(lines[0])

  // Find the line most likely to be a card name
  // Card names typically have more letters than numbers/symbols
  const scoredLines = lines.map((line) => {
    const letterCount = (line.match(/[a-zA-Z]/g) || []).length
    const totalChars = line.length
    const letterRatio = totalChars > 0 ? letterCount / totalChars : 0
    const lengthScore = Math.min(line.length / 30, 1) // Longer names up to ~30 chars

    return {
      line,
      score: letterRatio * 0.7 + lengthScore * 0.3,
    }
  })

  // Sort by score and return the best candidate
  scoredLines.sort((a, b) => b.score - a.score)

  return normalizeCardName(scoredLines[0].line)
}

/**
 * Check if text looks like a valid card name
 */
export function isValidCardName(text: string): boolean {
  const normalized = normalizeCardName(text)

  // Must have at least 2 characters
  if (normalized.length < 2) return false

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(normalized)) return false

  // Should be mostly letters
  const letterCount = (normalized.match(/[a-zA-Z]/g) || []).length
  const letterRatio = letterCount / normalized.length

  return letterRatio >= 0.7
}

/**
 * Split a potential double-faced card name
 */
export function splitDoubleFacedName(name: string): { front: string; back?: string } {
  const separator = name.match(/\s*\/\/\s*/)
  if (separator) {
    const parts = name.split(separator[0])
    return {
      front: parts[0].trim(),
      back: parts[1]?.trim(),
    }
  }
  return { front: name }
}
