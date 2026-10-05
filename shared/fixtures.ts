import type { Analysis, AnalysisRequest } from './schema'

// Synthetic fixture for deterministic tests; never shown as a real AI result.
export const exampleAnalysis: Analysis = {
  document: {
    fileName: 'umowa.pdf',
    pages: 2,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa wdrożenia CRM',
    date: '2026-03-12',
  },
  summary:
    'Umowa dotyczy wdrożenia CRM. Wynagrodzenie wynosi 184 500 PLN netto. Dokument określa termin wdrożenia.',
  keyPoints: [
    'Wdrożenie CRM.',
    'Wynagrodzenie: 184 500 PLN netto.',
    'Go-live: 12 października 2026.',
  ],
  entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
  amounts: [
    {
      value: 184500,
      currency: 'PLN',
      context: 'Wynagrodzenie za wdrożenie, netto',
    },
  ],
  dates: [{ date: '2026-10-12', context: 'Planowany Go-live' }],
  keywords: ['CRM', 'wdrożenie'],
  sources: [
    {
      page: 1,
      quote: 'Wynagrodzenie wynosi 184 500 PLN netto.',
      fact: 'Koszt wdrożenia',
    },
  ],
}
export const exampleRequest: AnalysisRequest = {
  fileName: 'umowa.pdf',
  fileSize: 1024,
  pages: [
    {
      number: 1,
      text: 'Umowa dotyczy wdrożenia CRM. Wynagrodzenie wynosi 184 500 PLN netto. Go-live: 12.10.2026.',
    },
    { number: 2, text: '' },
  ],
}
