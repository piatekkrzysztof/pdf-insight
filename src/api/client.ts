import { responseSchema, type AnalysisRequest } from '../../shared/schema'

export async function analyzeDocument(
  document: AnalysisRequest,
  signal: AbortSignal,
) {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:8787' : '')
  if (!apiUrl)
    throw new Error(
      'Analiza AI nie została jeszcze skonfigurowana. Spróbuj później.',
    )
  let response: Response
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(
          document.pages.reduce((sum, page) => sum + page.text.length, 0) >
            40000
            ? 90_000
            : 28_000,
        ),
      ]),
    })
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new Error('Przekroczono czas analizy. Spróbuj ponownie.', {
        cause: error,
      })
    throw new Error(
      'Nie można połączyć się z usługą analizy. Sprawdź połączenie i spróbuj ponownie.',
      { cause: error },
    )
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(
      'Usługa zwróciła nieprawidłową odpowiedź. Spróbuj ponownie.',
    )
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Analiza nie powiodła się. Spróbuj ponownie.'
    throw new Error(message)
  }
  const result = responseSchema.safeParse(data)
  if (!result.success)
    throw new Error('Wynik nie przeszedł walidacji. Spróbuj ponownie.')
  return result.data
}
