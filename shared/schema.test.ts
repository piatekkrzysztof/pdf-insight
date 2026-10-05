import { describe, expect, it } from 'vitest'
import {
  analysisSchema,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  modelSchema,
  requestSchema,
} from './schema'
import { exampleAnalysis, exampleRequest } from './fixtures'

describe('analysis contract', () => {
  it('accepts complete data, nulls and empty collections', () => {
    expect(analysisSchema.parse(exampleAnalysis)).toEqual(exampleAnalysis)
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        document: {
          ...exampleAnalysis.document,
          title: null,
          date: null,
          language: null,
        },
        amounts: [],
        dates: [],
        keywords: [],
        sources: [],
      }).success,
    ).toBe(true)
  })
  it.each(['2026-02-30', '12.03.2026', '2026-13-01'])(
    'rejects invalid date %s',
    (date) => {
      expect(
        analysisSchema.safeParse({
          ...exampleAnalysis,
          document: { ...exampleAnalysis.document, date },
        }).success,
      ).toBe(false)
    },
  )
  it.each(['USD', 'EUR', 'PLN'])('accepts ISO currency %s', (currency) => {
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        amounts: [{ ...exampleAnalysis.amounts[0], currency }],
      }).success,
    ).toBe(true)
  })
  it('rejects invented currency, string amount and non-finite number', () => {
    for (const amount of [
      { value: 1, currency: 'ZZZ' },
      { value: '184500', currency: 'PLN' },
      { value: Infinity, currency: 'PLN' },
    ]) {
      expect(
        analysisSchema.safeParse({
          ...exampleAnalysis,
          amounts: [{ ...amount, context: 'test' }],
        }).success,
      ).toBe(false)
    }
  })
  it('rejects missing keys, invalid language/type and source page', () => {
    expect(
      analysisSchema.safeParse({ document: exampleAnalysis.document }).success,
    ).toBe(false)
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        document: { ...exampleAnalysis.document, language: 'zz' },
      }).success,
    ).toBe(false)
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        document: { ...exampleAnalysis.document, type: 'contract' },
      }).success,
    ).toBe(false)
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        sources: [{ ...exampleAnalysis.sources[0], page: 8 }],
      }).success,
    ).toBe(false)
  })
  it('requires 3-7 points and 3-5 summary sentence entries', () => {
    expect(
      analysisSchema.safeParse({ ...exampleAnalysis, keyPoints: ['one'] })
        .success,
    ).toBe(false)
    expect(
      analysisSchema.safeParse({
        ...exampleAnalysis,
        keyPoints: Array(8).fill('one'),
      }).success,
    ).toBe(false)
    for (const length of [2, 6])
      expect(
        modelSchema.safeParse({
          ...exampleAnalysis,
          summarySentences: Array(length).fill('Zdanie.'),
        }).success,
      ).toBe(false)
    expect(
      modelSchema.safeParse({
        ...exampleAnalysis,
        summarySentences: [
          'Firma to Przykład sp. z o.o.',
          'Kwota to 184 500 PLN.',
          'To trzecie zdanie.',
        ],
      }).success,
    ).toBe(true)
  })
})

describe('input limits', () => {
  it('accepts a mixed PDF and the exact size limit', () => {
    expect(
      requestSchema.safeParse({ ...exampleRequest, fileSize: MAX_FILE_BYTES })
        .success,
    ).toBe(true)
  })
  it('rejects oversized file, text and page count', () => {
    expect(
      requestSchema.safeParse({
        ...exampleRequest,
        fileSize: MAX_FILE_BYTES + 1,
      }).success,
    ).toBe(false)
    expect(
      requestSchema.safeParse({
        ...exampleRequest,
        pages: [{ number: 1, text: 'a'.repeat(MAX_TEXT_CHARS + 1) }],
      }).success,
    ).toBe(false)
    expect(
      requestSchema.safeParse({
        ...exampleRequest,
        pages: Array.from({ length: 101 }, (_, index) => ({
          number: index + 1,
          text: 'a'.repeat(50),
        })),
      }).success,
    ).toBe(false)
  })
  it('rejects empty text and out-of-order pages', () => {
    expect(
      requestSchema.safeParse({
        ...exampleRequest,
        pages: [{ number: 1, text: '' }],
      }).success,
    ).toBe(false)
    expect(
      requestSchema.safeParse({
        ...exampleRequest,
        pages: [...exampleRequest.pages].reverse(),
      }).success,
    ).toBe(false)
  })
})
