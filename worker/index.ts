import OpenAI from 'openai'
import { MAX_REQUEST_BYTES, requestSchema } from '../shared/schema'
import { ApiError } from './analyze'
import { analyzeChunks, splitPages } from './chunks'
import type { QuotaNamespace } from './quota'
export { DailyQuota } from './quota'

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}
export interface Env {
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  ALLOWED_ORIGIN: string
  CLIENT_LIMITER: RateLimiter
  GLOBAL_LIMITER: RateLimiter
  DAILY_QUOTA: QuotaNamespace
}

async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES)
    throw new ApiError(413, 'Przesłane dane są zbyt duże.')
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError(400, 'Brak danych dokumentu.')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new ApiError(413, 'Przesłane dane są zbyt duże.')
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new ApiError(400, 'Niepoprawny format żądania.')
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    })
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers })
    if (!origin || origin !== env.ALLOWED_ORIGIN)
      return json({ error: 'Niedozwolone źródło żądania.' }, 403)
    headers.set('Access-Control-Allow-Origin', origin)
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type')
      headers.set('Access-Control-Max-Age', '600')
      return new Response(null, { status: 204, headers })
    }
    if (new URL(request.url).pathname !== '/analyze')
      return json({ error: 'Nie znaleziono endpointu.' }, 404)
    if (request.method !== 'POST')
      return json({ error: 'Niedozwolona metoda.' }, 405)
    const started = Date.now()
    try {
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        throw new ApiError(415, 'Wymagany format JSON.')
      if (!env.OPENAI_API_KEY)
        throw new ApiError(
          503,
          'Analiza AI nie jest jeszcze skonfigurowana. Spróbuj później.',
        )
      if (!env.CLIENT_LIMITER || !env.GLOBAL_LIMITER)
        throw new ApiError(503, 'Usługa jest chwilowo niedostępna.')
      const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
      const [client, global] = await Promise.all([
        env.CLIENT_LIMITER.limit({ key: ip }),
        env.GLOBAL_LIMITER.limit({ key: 'all' }),
      ])
      if (!client.success || !global.success) {
        headers.set('Retry-After', '60')
        throw new ApiError(
          429,
          'Osiągnięto limit analiz. Spróbuj ponownie za minutę.',
        )
      }
      const parsed = requestSchema.safeParse(await readBody(request))
      if (!parsed.success)
        throw new ApiError(
          400,
          'Niepoprawne dane PDF. Limit: 10 MB, 100 stron i 100 000 znaków tekstu.',
        )
      const data = parsed.data
      const chunkCount = splitPages(data.pages).length
      if (chunkCount > 3)
        throw new ApiError(400, 'Podziel dokument na mniejsze pliki.')
      if (!env.DAILY_QUOTA)
        throw new ApiError(
          503,
          'Limit dobowy nie jest skonfigurowany. Spróbuj później.',
        )
      const quota = env.DAILY_QUOTA.get(env.DAILY_QUOTA.idFromName('global-v1'))
      const reserved = await quota.fetch(
        new Request('https://quota/reserve', {
          method: 'POST',
          body: JSON.stringify({
            units: chunkCount > 1 ? 2 * (chunkCount + 1) : 2,
          }),
        }),
      )
      if (reserved.status === 429)
        throw new ApiError(
          429,
          'Wspólny dobowy limit demo został wykorzystany. Spróbuj po północy UTC.',
        )
      if (!reserved.ok)
        throw new ApiError(
          503,
          'Nie można sprawdzić limitu demo. Spróbuj później.',
        )
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(chunkCount > 1 ? 85_000 : 50_000),
      ])
      const { analysis, chunks } = await analyzeChunks(
        data,
        env.OPENAI_API_KEY,
        env.OPENAI_MODEL || 'gpt-4.1-mini',
        signal,
      )
      const unreadPages = data.pages
        .filter((page) => page.text.trim().length < 30)
        .map((page) => page.number)
      return json({
        analysis,
        meta: {
          partial: unreadPages.length > 0,
          unreadPages,
          durationMs: Date.now() - started,
          model: env.OPENAI_MODEL || 'gpt-4.1-mini',
          chunks,
          ocrPages: data.pages
            .filter((page) => page.ocrConfidence !== undefined)
            .map((page) => page.number),
        },
      })
    } catch (error) {
      if (error instanceof ApiError)
        return json({ error: error.message }, error.status)
      if (error instanceof OpenAI.APIError && error.status === 429)
        return json(
          { error: 'Dostawca AI osiągnął limit. Spróbuj ponownie później.' },
          503,
        )
      if (
        error instanceof Error &&
        /abort|timeout/i.test(error.name + error.message)
      )
        return json(
          { error: 'Analiza trwała zbyt długo. Spróbuj ponownie.' },
          504,
        )
      return json(
        { error: 'Nie udało się przeprowadzić analizy. Spróbuj ponownie.' },
        502,
      )
    }
  },
}
