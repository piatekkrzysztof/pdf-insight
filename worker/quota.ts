interface Transaction {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
}
interface State {
  storage: {
    transaction<T>(
      callback: (transaction: Transaction) => Promise<T>,
    ): Promise<T>
  }
}
export interface QuotaNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}

// A single persistent instance serializes reservations from all Cloudflare regions.
// Store only date and aggregate call count, never IPs, PDF text or filenames.
export class DailyQuota {
  constructor(
    private state: State,
    private env: { DAILY_AI_CALL_LIMIT?: string },
  ) {}
  async fetch(request: Request): Promise<Response> {
    const input: unknown = await request.json()
    const units =
      input && typeof input === 'object' && 'units' in input
        ? input.units
        : null
    if (
      typeof units !== 'number' ||
      !Number.isInteger(units) ||
      units < 1 ||
      units > 8
    )
      return new Response(null, { status: 400 })
    const configured = Number(this.env.DAILY_AI_CALL_LIMIT ?? 100)
    const limit =
      Number.isInteger(configured) && configured >= 1 && configured <= 1000
        ? configured
        : 100
    const day = new Date().toISOString().slice(0, 10)
    const success = await this.state.storage.transaction(
      async (transaction) => {
        const previous = await transaction.get<{ day: string; used: number }>(
          'quota',
        )
        const used = previous?.day === day ? previous.used : 0
        if (used + units > limit) return false
        await transaction.put('quota', { day, used: used + units })
        return true
      },
    )
    return Response.json({ success }, { status: success ? 200 : 429 })
  }
}
