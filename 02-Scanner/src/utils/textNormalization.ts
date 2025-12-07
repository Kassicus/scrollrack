// Common English words that appear in MTG card names
const COMMON_WORDS = new Set([
  // Articles & prepositions
  'a', 'an', 'the', 'of', 'in', 'to', 'for', 'on', 'at', 'by', 'or', 'as', 'is', 'it',
  'and', 'but', 'not', 'with', 'from', 'into', 'upon', 'over', 'under', 'through',
  // Common card name words
  'who', 'who\'s', 'what', 'that', 'this', 'his', 'her', 'its', 'my', 'our', 'your',
  'be', 'no', 'so', 'up', 'go', 'do', 'if', 'me', 'we', 'he', 'she', 'us', 'am',
  // Specific to MTG
  'el', 'la', 'le', 'de', 'von', 'van', 'der', 'den', 'das', // foreign articles
])

/**
 * Normalize OCR output for card name lookup
 */
export function normalizeCardName(text: string): string {
  let normalized = text
    .trim()
    // Remove leading parentheses/brackets (common OCR artifact)
    .replace(/^[([\]]+/, '')
    // Remove common OCR artifacts but keep hyphens and apostrophes
    .replace(/[|\\/_~*#@$%^&+=<>[\]{}()]/g, '')
    // Fix common character misreads
    .replace(/0/g, 'O')
    .replace(/1(?=[a-zA-Z])/g, 'l')
    .replace(/(?<=[a-zA-Z])1/g, 'l')
    // Normalize quotes and apostrophes
    .replace(/[''`´]/g, "'")
    .replace(/[""«»]/g, '"')
    // Normalize hyphens
    .replace(/[–—−]/g, '-')
    // Remove excessive punctuation but keep single instances
    .replace(/[.]{2,}/g, '')
    .replace(/[,]{2,}/g, ',')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading non-alphanumeric
    .replace(/^[^a-zA-Z]+/, '')
    // Remove trailing garbage but keep apostrophes
    .replace(/[^a-zA-Z']+$/, '')

  // Cut off at mana cost artifacts
  const words = normalized.split(' ')
  const cleanWords: string[] = []

  for (const word of words) {
    const isGarbage = isLikelyManaGarbage(word, cleanWords.length)

    if (isGarbage && cleanWords.length > 0) {
      // We've hit garbage after real words, stop here
      break
    }

    if (!isGarbage) {
      cleanWords.push(word)
    }
  }

  return cleanWords.join(' ')
}

/**
 * Detect if a word is likely OCR garbage from mana symbols
 */
function isLikelyManaGarbage(word: string, wordIndex: number): boolean {
  // Clean word for checking (remove punctuation for comparison)
  const cleanWord = word.replace(/['-]/g, '').toLowerCase()

  // Common words are NEVER garbage
  if (COMMON_WORDS.has(cleanWord) || COMMON_WORDS.has(word.toLowerCase())) {
    return false
  }

  // Words with apostrophes in the middle are likely real (possessives, contractions)
  // e.g., "Will-o'-the-Wisp", "Serra's", "Who's"
  if (/[a-zA-Z]'[a-zA-Z]/.test(word)) {
    return false
  }

  // Hyphenated words that look real
  if (word.includes('-') && word.length >= 3) {
    // Check if both parts look reasonable
    const parts = word.split('-')
    const looksReal = parts.every(p => p.length === 0 || /^[A-Z]?[a-z]+$/.test(p) || COMMON_WORDS.has(p.toLowerCase()))
    if (looksReal) return false
  }

  // Single character - only allow common single-char words
  if (cleanWord.length === 1) {
    return !['a', 'i', 'o'].includes(cleanWord)
  }

  // Two characters - check if it's a real word or garbage
  if (cleanWord.length === 2) {
    // Common 2-letter words are fine
    if (COMMON_WORDS.has(cleanWord)) return false
    // Weird patterns like "ie", "nT", "iE" - likely mana symbol garbage
    if (/^[a-z]{2}$/.test(word) && !COMMON_WORDS.has(word)) return true
    // Mixed case 2-letter: almost always garbage
    if (/[a-z][A-Z]|[A-Z][a-z][A-Z]/.test(word)) return true
    return true // Default: 2-char non-common words are suspicious
  }

  // Three characters
  if (cleanWord.length === 3) {
    // Weird case mixing like "iE", "nT", "LfE" - garbage
    if (/[a-z][A-Z]/.test(word)) return true
    // All caps short words at end are often garbage
    if (wordIndex > 0 && /^[A-Z]{2,3}$/.test(word)) return true
  }

  // Looks like a real word
  return false
}

/**
 * Extract potential card name from OCR text
 * For MTG cards, the name is always on the first line
 */
export function extractCardName(ocrText: string): string {
  // Split by newlines and get the first non-empty line
  const lines = ocrText.split(/[\n\r]+/).map((line) => line.trim()).filter(Boolean)

  if (lines.length === 0) return ''

  // The card name is always the first line on an MTG card
  // Take the first line that looks like it could be a name (has letters)
  for (const line of lines) {
    const normalized = normalizeCardName(line)
    // Skip lines that are too short or don't have enough letters
    if (normalized.length >= 2) {
      const letterCount = (normalized.match(/[a-zA-Z]/g) || []).length
      if (letterCount >= 2) {
        console.log('Extracted card name:', normalized, 'from line:', line)
        return normalized
      }
    }
  }

  return normalizeCardName(lines[0])
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
