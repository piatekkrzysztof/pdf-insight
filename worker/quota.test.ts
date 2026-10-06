import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyQuota } from './quota'

function quota(limit = '4') {
  const data = new Map<string, unknown>()
  let queue: Promise<unknown> = Promise.resolve()
  const storage = {
    transaction<T>(
      callback: (transaction: {
        get<V>(key: string): Promise<V | undefined>
        put(key: string, value: unknown): Promise<void>
      }) => Promise<T>,
    ): Promise<T> {
      const next = queue.then(() =>
        callback({
          get: async <V>(key: string) => data.get(key) as V | undefined,
          put: async (key, value) => {
            data.set(key, value)
          },
        }),
      )
      queue = next.catch(() => {})
      return next
    },
  }
  return new DailyQuota({ storage }, { DAILY_AI_CALL_LIMIT: limit })
}
const reservation = (units: number) =>
  new Request('https://quota/reserve', {
    method: 'POST',
    body: JSON.stringify({ units }),
  })
afterEach(() => vi.useRealTimers())
describe('global daily reservations', () => {
  it('cannot exceed the cap with concurrent requests', async () => {
    const service = quota()
    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.fetch(reservation(2))),
    )
    expect(results.filter((response) => response.ok)).toHaveLength(2)
    expect(results.filter((response) => response.status === 429)).toHaveLength(
      6,
    )
  })
  it('resets only on a new UTC day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T23:59:00Z'))
    const service = quota('2')
    expect((await service.fetch(reservation(2))).status).toBe(200)
    expect((await service.fetch(reservation(1))).status).toBe(429)
    vi.setSystemTime(new Date('2026-10-07T00:00:01Z'))
    expect((await service.fetch(reservation(2))).status).toBe(200)
  })
  it('rejects unbounded or negative reservations', async () => {
    for (const units of [-1, 0, 9, 1.5])
      expect((await quota().fetch(reservation(units))).status).toBe(400)
  })
})
