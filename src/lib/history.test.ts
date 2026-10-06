import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleAnalysis } from '../../shared/fixtures'
import {
  deleteHistory,
  readHistory,
  saveHistory,
  setHistoryEnabled,
} from './history'
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())
const result = {
  analysis: exampleAnalysis,
  meta: { partial: false, unreadPages: [], durationMs: 1, model: 'test' },
}
describe('local history privacy', () => {
  it('does not persist anything until explicitly enabled', () => {
    expect(saveHistory(result)).toEqual([])
    expect(readHistory()).toEqual([])
  })
  it('keeps only five results and supports individual deletion and opt-out erasure', () => {
    setHistoryEnabled(true)
    for (let i = 0; i < 7; i++) saveHistory(result)
    expect(readHistory()).toHaveLength(5)
    expect(deleteHistory(readHistory()[0].id)).toHaveLength(4)
    setHistoryEnabled(false)
    expect(localStorage.getItem('pdf-insight-history-v1')).toBeNull()
  })
  it('ignores corrupted persisted data', () => {
    setHistoryEnabled(true)
    localStorage.setItem('pdf-insight-history-v1', '[{"unexpected":true}]')
    expect(readHistory()).toEqual([])
  })
})
