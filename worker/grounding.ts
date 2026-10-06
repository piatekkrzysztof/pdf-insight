import type { AnalysisRequest, ModelAnalysis } from '../shared/schema'

// PDF font runs may introduce spaces inside words. Whitespace-insensitive
// matching tolerates this without changing letters, punctuation or digits.
export function compact(text: string) {
  return text.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase()
}

export function sourceContains(source: string, excerpt: string) {
  const haystack = compact(source)
  const needle = compact(excerpt)
  let offset = haystack.indexOf(needle)
  while (offset >= 0) {
    const before = haystack[offset - 1] ?? ''
    const after = haystack[offset + needle.length] ?? ''
    // Reject a numeric fragment inside a larger number or date.
    if (
      !(/\d/.test(needle[0]) && /\d/.test(before)) &&
      !(/\d/.test(needle.at(-1) ?? '') && /\d/.test(after))
    )
      return true
    offset = haystack.indexOf(needle, offset + 1)
  }
  return false
}

function numberMatches(raw: string, expected: number) {
  const clean = raw.normalize('NFKC').replace(/[\s'’]/g, '')
  if (!/^-?\d[\d.,]*$/.test(clean)) return false
  // Accept locale-specific decimal/group separators, but never recompute sums.
  const candidates = [
    clean,
    clean.replace(/\./g, '').replace(',', '.'),
    clean.replace(/,/g, ''),
  ]
  return candidates.some((candidate) => Number(candidate) === expected)
}

function printedAmountMatches(page: string, expected: number) {
  // Check the actual page rather than trusting a model-generated transcription.
  const numbers =
    page
      .normalize('NFKC')
      .match(/-?\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)*/g) ?? []
  return numbers.some((number) => numberMatches(number, expected))
    ? null
    : 'page_number_missing'
}

function dateMatches(page: string, expected: string, language: string | null) {
  const [year, month, day] = expected.split('-').map(Number)
  const candidates = [expected]
  for (const separator of ['.', '/', '-']) {
    for (const d of [String(day), String(day).padStart(2, '0')]) {
      for (const m of [String(month), String(month).padStart(2, '0')]) {
        candidates.push(`${d}${separator}${m}${separator}${year}`)
        if (language === 'en')
          candidates.push(`${m}${separator}${d}${separator}${year}`)
      }
    }
  }
  const date = new Date(`${expected}T12:00:00Z`)
  for (const locale of [language ?? 'en', 'en']) {
    for (const monthStyle of ['long', 'short'] as const) {
      candidates.push(
        new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: monthStyle,
          year: 'numeric',
          timeZone: 'UTC',
        }).format(date),
      )
    }
  }
  return candidates.some((candidate) => {
    const pattern = [...compact(candidate)]
      .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*')
    // Table cells may have adjacent dates separated only by whitespace.
    return new RegExp(`(?<!\\d)${pattern}(?!\\d)`, 'iu').test(
      page.normalize('NFKC'),
    )
  })
}

export function groundingErrors(
  data: ModelAnalysis,
  request: AnalysisRequest,
): string[] {
  const errors: string[] = []
  data.amounts.forEach((amount, index) => {
    const page = request.pages[amount.sourcePage - 1]
    const problem = !page
      ? 'page_missing'
      : printedAmountMatches(page.text, amount.value)
    if (problem) {
      errors.push(
        `amounts[${index}]: ${problem}; numeric value must be printed on sourcePage; do not calculate or guess`,
      )
    }
  })
  data.dates.forEach((entry, index) => {
    const page = request.pages[entry.sourcePage - 1]
    if (!page || !dateMatches(page.text, entry.date, data.document.language)) {
      errors.push(
        `dates[${index}]: date absent on claimed page ${entry.sourcePage}; matching page numbers: ${
          request.pages
            .filter((candidate) =>
              dateMatches(candidate.text, entry.date, data.document.language),
            )
            .map((candidate) => candidate.number)
            .join(',') || 'none'
        }; correct sourcePage or omit this entry`,
      )
    }
  })
  return errors
}
