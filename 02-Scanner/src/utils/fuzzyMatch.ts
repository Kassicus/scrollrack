/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function similarityScore(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1
  return 1 - distance / maxLength
}

/**
 * Find best matches from a list of candidates
 */
export function findBestMatches(
  query: string,
  candidates: string[],
  threshold = 0.6,
  maxResults = 5
): FuzzyMatchResult[] {
  const normalizedQuery = query.toLowerCase().trim()

  const results = candidates
    .map((candidate) => ({
      text: candidate,
      score: similarityScore(normalizedQuery, candidate),
    }))
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return results
}

/**
 * Clean and normalize text for better matching
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Check if two card names are likely the same card
 */
export function isLikelyMatch(ocrText: string, cardName: string, threshold = 0.7): boolean {
  const normalizedOcr = normalizeText(ocrText)
  const normalizedCard = normalizeText(cardName)

  // Check exact match after normalization
  if (normalizedOcr === normalizedCard) return true

  // Check if one contains the other (handles partial OCR)
  if (normalizedCard.includes(normalizedOcr) || normalizedOcr.includes(normalizedCard)) {
    return true
  }

  // Check similarity score
  return similarityScore(normalizedOcr, normalizedCard) >= threshold
}

/**
 * Common OCR errors and their corrections
 */
const OCR_CORRECTIONS: Record<string, string> = {
  '0': 'O',
  '1': 'l',
  '5': 'S',
  '8': 'B',
  '|': 'l',
  '!': 'l',
  '@': 'a',
  '$': 'S',
  '&': 'and',
}

/**
 * Apply common OCR error corrections
 */
export function correctOCRErrors(text: string): string {
  let corrected = text

  // Apply character substitutions
  for (const [error, correction] of Object.entries(OCR_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(escapeRegExp(error), 'g'), correction)
  }

  // Fix common word-level OCR errors
  corrected = corrected
    .replace(/\bthe\s+the\b/gi, 'the')
    .replace(/\s{2,}/g, ' ')

  return corrected.trim()
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface FuzzyMatchResult {
  text: string
  score: number
}
