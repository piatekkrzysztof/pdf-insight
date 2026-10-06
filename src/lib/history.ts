import { z } from 'zod'
import { responseSchema, type AnalysisResponse } from '../../shared/schema'

const KEY = 'pdf-insight-history-v1'
const ENABLED = 'pdf-insight-history-enabled'
const entrySchema = z.object({
  id: z.string(),
  savedAt: z.iso.datetime(),
  result: responseSchema,
})
export type HistoryEntry = z.infer<typeof entrySchema>
export function historyEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED) === 'true'
  } catch {
    return false
  }
}
export function readHistory(): HistoryEntry[] {
  try {
    if (!historyEnabled()) return []
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .flatMap((item) => {
        const result = entrySchema.safeParse(item)
        return result.success ? [result.data] : []
      })
      .slice(0, 5)
  } catch {
    return []
  }
}
export function setHistoryEnabled(enabled: boolean) {
  if (!enabled) localStorage.removeItem(KEY)
  localStorage.setItem(ENABLED, String(enabled))
}
export function saveHistory(result: AnalysisResponse): HistoryEntry[] {
  if (!historyEnabled()) return []
  const entries = [
    {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      result: responseSchema.parse(result),
    },
    ...readHistory(),
  ].slice(0, 5)
  localStorage.setItem(KEY, JSON.stringify(entries))
  return entries
}
export function deleteHistory(id?: string): HistoryEntry[] {
  const entries = id ? readHistory().filter((entry) => entry.id !== id) : []
  localStorage.setItem(KEY, JSON.stringify(entries))
  return entries
}
