import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'
import { exampleAnalysis, exampleRequest } from '../shared/fixtures'
import { analyze } from './analyze'
vi.mock('./analyze', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./analyze')>()),
  analyze: vi.fn(),
}))
const origin = 'https://example.github.io'
function env(): Env {
  return {
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'test-model',
    ALLOWED_ORIGIN: origin,
    CLIENT_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    GLOBAL_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  }
}
function request(data: unknown = exampleRequest, requestOrigin = origin) {
  return new Request('https://api.example/analyze', {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

describe('public API', () => {
  beforeEach(() => {
    vi.mocked(analyze).mockReset()
    vi.mocked(analyze).mockResolvedValue(exampleAnalysis)
  })
  it('rejects unrelated origins before contacting AI', async () => {
    expect(
      (
        await worker.fetch(
          request(exampleRequest, 'https://evil.example'),
          env(),
        )
      ).status,
    ).toBe(403)
    expect(analyze).not.toHaveBeenCalled()
  })
  it('handles browser preflight with restricted CORS', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/analyze', {
        method: 'OPTIONS',
        headers: { origin },
      }),
      env(),
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
  })
  it('rejects oversized streaming bodies even without content-length', async () => {
    const response = await worker.fetch(
      request({ text: 'a'.repeat(500001) }),
      env(),
    )
    expect(response.status).toBe(413)
    expect(analyze).not.toHaveBeenCalled()
  })
  it('validates inputs before spending on AI', async () => {
    expect((await worker.fetch(request({}), env())).status).toBe(400)
    expect(analyze).not.toHaveBeenCalled()
  })
  it('rate limits and returns Retry-After', async () => {
    const settings = env()
    settings.CLIENT_LIMITER.limit = vi
      .fn()
      .mockResolvedValue({ success: false })
    const response = await worker.fetch(request(), settings)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(analyze).not.toHaveBeenCalled()
  })
  it('does not leak errors or API keys', async () => {
    vi.mocked(analyze).mockRejectedValue(
      new Error('test-key secret internal error'),
    )
    const response = await worker.fetch(request(), env())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('test-key')
  })
  it('labels mixed-document results partial and disables caching', async () => {
    const response = await worker.fetch(request(), env())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      meta: { partial: true, unreadPages: [2] },
    })
  })
})
