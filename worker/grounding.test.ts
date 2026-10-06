import { describe, expect, it } from 'vitest'
import { exampleAnalysis } from '../shared/fixtures'
import type { ModelAnalysis, AnalysisRequest } from '../shared/schema'
import { groundingErrors, sourceContains } from './grounding'

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
