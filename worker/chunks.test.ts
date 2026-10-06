import { describe, expect, it, vi, beforeEach } from 'vitest'
import { analyzeChunks, splitPages, CHUNK_CHARS } from './chunks'
import { analyze } from './analyze'
import { exampleAnalysis } from '../shared/fixtures'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    responses = { create }
  },
}))
vi.mock('./analyze', async (original) => ({
  ...(await original<typeof import('./analyze')>()),
  analyze: vi.fn(),
}))
beforeEach(() => {
  create.mockReset()
  vi.mocked(analyze).mockReset()
  vi.mocked(analyze).mockResolvedValue(exampleAnalysis)
})

describe('long document splitting', () => {
  it('merges grounded excerpts from each part and validates against the full original', async () => {
    const request = {
      fileName: 'long.pdf',
      fileSize: 90000,
      pages: [{ number: 1, text: 'Fee 1000 PLN. '.repeat(4000) }],
    }
    create.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        excerpts: [{ page: 1, quote: 'Fee 1000 PLN.' }],
      }),
    })
    const result = await analyzeChunks(
      request,
      'test-key',
      'model',
      new AbortController().signal,
    )
    expect(result.chunks).toBe(2)
    expect(create).toHaveBeenCalledTimes(2)
    expect(analyze).toHaveBeenCalledWith(
      request,
      'test-key',
      'model',
      expect.any(AbortSignal),
      [{ number: 1, text: 'Fee 1000 PLN.' }],
    )
  })
  it('does not silently drop a chunk with fabricated quotes', async () => {
    create.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        excerpts: [{ page: 1, quote: 'Not in the document.' }],
      }),
    })
    await expect(
      analyzeChunks(
        {
          fileName: 'long.pdf',
          fileSize: 90000,
          pages: [{ number: 1, text: 'Real '.repeat(9000) }],
        },
        'key',
        'model',
        new AbortController().signal,
      ),
    ).rejects.toThrow('jednej części')
    expect(analyze).not.toHaveBeenCalled()
  })
  it('preserves every character, source page number and order', () => {
    const pages = [
      { number: 1, text: 'Alpha '.repeat(9000) },
      { number: 2, text: 'Beta '.repeat(8000) },
    ]
    const chunks = splitPages(pages)
    expect(chunks).toHaveLength(3)
    for (const chunk of chunks)
      expect(
        chunk.reduce((sum, page) => sum + page.text.length, 0),
      ).toBeLessThanOrEqual(CHUNK_CHARS)
    for (const page of pages)
      expect(
        chunks
          .flat()
          .filter((part) => part.number === page.number)
          .map((part) => part.text)
          .join(''),
      ).toBe(page.text)
  })
  it('does not split documents at or below the normal request threshold', () => {
    expect(
      splitPages([
        { number: 1, text: 'a'.repeat(CHUNK_CHARS - 50) },
        { number: 2, text: 'b'.repeat(50) },
      ]),
    ).toHaveLength(1)
  })
})
