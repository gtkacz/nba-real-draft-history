// Single source of truth for height parsing. This logic previously lived in both
// useDraftData and DraftTable with divergent regexes, so the height filter and the
// height sort could disagree on what counted as a valid height (bug B6).

/**
 * Parses a height string such as "6-8", "6'8\"", or a bare inch count into total
 * inches. Returns 0 when the value is missing or unparseable, which callers treat
 * as "sort/place last".
 */
export function parseHeight(height: string | null | undefined): number {
  if (!height) return 0

  const str = String(height).trim()
  if (str === '') return 0

  // "6-8" or "6'8" (feet, separator, inches)
  const feetInches = str.match(/^(\d+)[-'](\d+)$/)
  if (feetInches && feetInches[1] && feetInches[2]) {
    const feet = parseInt(feetInches[1], 10)
    const inches = parseInt(feetInches[2], 10)
    if (!isNaN(feet) && !isNaN(inches)) return feet * 12 + inches
  }

  // "6'8\"" (feet'inches")
  const feetInchesQuote = str.match(/^(\d+)'(\d+)"$/)
  if (feetInchesQuote && feetInchesQuote[1] && feetInchesQuote[2]) {
    const feet = parseInt(feetInchesQuote[1], 10)
    const inches = parseInt(feetInchesQuote[2], 10)
    if (!isNaN(feet) && !isNaN(inches)) return feet * 12 + inches
  }

  // Bare number, assumed to already be inches.
  const num = parseFloat(str)
  if (!isNaN(num) && num > 0) return num

  return 0
}
