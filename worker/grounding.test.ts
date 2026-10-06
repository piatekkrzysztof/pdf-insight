import { describe, expect, it } from 'vitest'
import { exampleAnalysis } from '../shared/fixtures'
import type { ModelAnalysis, AnalysisRequest } from '../shared/schema'
import { alignDatePages, groundingErrors, sourceContains } from './grounding'

const input: AnalysisRequest = {
  fileName: 'test.pdf',
  fileSize: 500,
  pages: [
    {
      number: 1,
      text: 'VAT: 42 435,00 PLN. Protokół zatwierdzono 26.02.2026. Umowa od 1 kwietnia 2026 r.',
    },
  ],
}
const output: ModelAnalysis = {
  ...exampleAnalysis,
  summarySentences: ['A.', 'B.', 'C.'],
  amounts: [
    {
      value: 42435,
      currency: 'PLN',
      context: 'VAT',
      sourcePage: 1,
    },
  ],
  dates: [
    {
      date: '2026-02-26',
      context: 'Protokół',
      sourcePage: 1,
    },
  ],
}

describe('factual source grounding', () => {
  it('corrects only an unambiguous neighboring date page, never a distant match', () => {
    const request = {
      ...input,
      pages: [
        ...input.pages,
        { number: 2, text: 'Harmonogram i opis prac.' },
        { number: 3, text: 'Kolejny rozdział.' },
      ],
    }
    const adjacent = {
      ...output,
      dates: [{ ...output.dates[0], sourcePage: 2 }],
    }
    expect(alignDatePages(adjacent, request).dates[0].sourcePage).toBe(1)
    const distant = {
      ...output,
      dates: [{ ...output.dates[0], sourcePage: 3 }],
    }
    expect(alignDatePages(distant, request).dates[0].sourcePage).toBe(3)
    expect(
      groundingErrors(alignDatePages(distant, request), request),
    ).toHaveLength(1)
    const ambiguous = {
      ...request,
      pages: [
        ...input.pages,
        request.pages[1],
        { number: 3, text: input.pages[0].text },
      ],
    }
    expect(alignDatePages(adjacent, ambiguous).dates[0].sourcePage).toBe(2)
  })
  it('recognizes an OCR amount wrapped between thousands and units', () => {
    const request = {
      ...input,
      pages: [{ number: 1, text: 'Abonament: 13\n100,00 PLN netto.' }],
    }
    expect(
      groundingErrors(
        {
          ...output,
          amounts: [{ ...output.amounts[0], value: 13100 }],
          dates: [],
        },
        request,
      ),
    ).toEqual([])
    expect(
      groundingErrors(
        {
          ...output,
          amounts: [{ ...output.amounts[0], value: 100 }],
          dates: [],
        },
        request,
      ),
    ).toHaveLength(1)
  })
  it('recognizes adjacent table dates without accepting fragments of longer days', () => {
    const request = {
      ...input,
      pages: [{ number: 1, text: '01.04.2026 30.04.2026 42 435,00' }],
    }
    expect(
      groundingErrors(
        {
          ...output,
          dates: [{ date: '2026-04-30', context: 'End', sourcePage: 1 }],
        },
        request,
      ),
    ).toEqual([])
    expect(
      groundingErrors(
        {
          ...output,
          dates: [{ date: '2026-04-03', context: 'Wrong', sourcePage: 1 }],
        },
        request,
      ),
    ).toHaveLength(1)
  })
  it('accepts equivalent decimal notation only when the value is printed on the page', () => {
    const request = {
      ...input,
      pages: [{ number: 1, text: 'Licencje: 8 600 EUR. Data 26.02.2026.' }],
    }
    expect(
      groundingErrors(
        {
          ...output,
          amounts: [
            {
              ...output.amounts[0],
              value: 8600,
              currency: 'EUR',
            },
          ],
        },
        request,
      ),
    ).toEqual([])
    expect(
      groundingErrors(
        {
          ...output,
          amounts: [
            {
              ...output.amounts[0],
              value: 600,
              currency: 'EUR',
            },
          ],
        },
        request,
      ),
    ).toHaveLength(1)
  })
  it('accepts numbers and dates that match actual source text', () => {
    expect(groundingErrors(output, input)).toEqual([])
  })
  it('rejects the wrong VAT value observed during live evaluation', () => {
    expect(
      groundingErrors(
        { ...output, amounts: [{ ...output.amounts[0], value: 42600 }] },
        input,
      ),
    ).toHaveLength(1)
  })
  it('rejects the wrong month observed during live evaluation', () => {
    expect(
      groundingErrors(
        { ...output, dates: [{ ...output.dates[0], date: '2026-03-26' }] },
        input,
      ),
    ).toHaveLength(1)
  })
  it('rejects fabricated evidence and nonexistent pages', () => {
    expect(
      groundingErrors(
        {
          ...output,
          amounts: [{ ...output.amounts[0], value: 42600 }],
        },
        input,
      ),
    ).toHaveLength(1)
    expect(
      groundingErrors(
        { ...output, dates: [{ ...output.dates[0], sourcePage: 11 }] },
        input,
      ),
    ).toHaveLength(1)
  })
  it('supports Polish month names and fragmented font runs', () => {
    expect(
      groundingErrors(
        {
          ...output,
          dates: [
            {
              date: '2026-04-01',
              context: 'Początek',
              sourcePage: 1,
            },
          ],
        },
        input,
      ),
    ).toEqual([])
    expect(
      sourceContains(
        'Wynagrodzenie wynosi 184 500,00 z ł netto.',
        'Wynagrodzenie wynosi 184 500,00 zł netto.',
      ),
    ).toBe(true)
  })
  it('does not find a smaller number inside a larger number', () => {
    expect(sourceContains('184500', '4500')).toBe(false)
  })
})
