import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import {
  analysisSchema,
  modelSchema,
  type Analysis,
  type AnalysisRequest,
} from '../shared/schema'
import { SYSTEM_PROMPT } from './prompt'
import { alignDatePages, compact, groundingErrors } from './grounding'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function validateEvidence(
  analysis: Analysis,
  request: AnalysisRequest,
): Analysis {
  return {
    ...analysis,
    sources: analysis.sources.filter((source) => {
      const page = request.pages[source.page - 1]
      return page && compact(page.text).includes(compact(source.quote))
    }),
  }
}

// A model statement that an unread page is empty or the analysis complete.
function misstatesUnread(text: string, unreadPages: number[]) {
  const pageRef = new RegExp(
    `\\b(?:stron\\p{L}*|pages?)\\s+(?:\\d+\\s*(?:,|i|and|-)\\s*)*(?:${unreadPages.join('|')})\\b`,
    'iu',
  )
  const claim =
    /\bpust[aeyąi]|(?<!nie)kompletn|\bblank\b|\bempty\b|\bcomplete\b|nie zawiera informacji|no information/iu
  return (
    pageRef.test(text) ||
    (claim.test(text) && /analiz|analys|stron|page/iu.test(text))
  )
}

// Completeness is stated by the server from the extraction result, never
// inferred by the model, which cannot see what an unread page contains.
export function applyUnreadNotice(
  summarySentences: string[],
  keyPoints: string[],
  unreadPages: number[],
  language: string | null,
) {
  if (!unreadPages.length)
    return { summary: summarySentences.join(' '), keyPoints }
  const list = unreadPages.join(', ')
  const notice =
    language === 'en'
      ? `The analysis is incomplete: no text could be extracted from ${unreadPages.length === 1 ? 'page' : 'pages'} ${list} (likely a scan), so ${unreadPages.length === 1 ? 'its' : 'their'} content is not included.`
      : `Analiza jest niepełna: nie odczytano tekstu ${unreadPages.length === 1 ? 'ze strony' : 'ze stron'} ${list} (prawdopodobnie skan), więc ${unreadPages.length === 1 ? 'jej' : 'ich'} treść nie została uwzględniona.`
  const sentences = summarySentences.filter(
    (sentence) => !misstatesUnread(sentence, unreadPages),
  )
  const points = keyPoints.map((point) =>
    misstatesUnread(point, unreadPages) ? notice : point,
  )
  const unique = [...new Set(points)]
  return {
    summary: [...sentences.slice(0, 4), notice].join(' '),
    keyPoints: unique.length >= 3 ? unique : points,
  }
}

export async function analyze(
  request: AnalysisRequest,
  apiKey: string,
  model: string,
  signal: AbortSignal,
  selectedPages?: AnalysisRequest['pages'],
) {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 25_000 })
  let feedback = ''
  let previousAnalysis: unknown
  let repairHints: unknown
  const unreadPages = request.pages
    .filter((p) => p.text.trim().length < 30)
    .map((p) => p.number)
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.responses.create(
      {
        model,
        temperature: 0,
        store: false,
        max_output_tokens: 6000,
        instructions: SYSTEM_PROMPT + feedback,
        input: [
          {
            role: 'user',
            content: JSON.stringify({
              fileName: request.fileName,
              totalPages: request.pages.length,
              unreadPages,
              untrustedDocumentPages: selectedPages ?? request.pages,
              excerptedLongDocument: !!selectedPages,
              previousAnalysis,
              untrustedRepairHints: repairHints,
            }),
          },
        ],
        text: { format: zodTextFormat(modelSchema, 'pdf_insight') },
      },
      { signal },
    )

    let raw: unknown
    try {
      raw = JSON.parse(response.output_text)
    } catch {
      raw = null
    }
    const modelResult = modelSchema.safeParse(raw)
    if (modelResult.success)
      modelResult.data = alignDatePages(modelResult.data, request)
    const unsupported = modelResult.success
      ? groundingErrors(modelResult.data, request)
      : []
    const parsed = analysisSchema.safeParse(
      modelResult.success
        ? {
            ...modelResult.data,
            ...applyUnreadNotice(
              modelResult.data.summarySentences,
              modelResult.data.keyPoints,
              unreadPages,
              modelResult.data.document.language,
            ),
            document: {
              ...modelResult.data.document,
              fileName: request.fileName,
              pages: request.pages.length,
            },
          }
        : null,
    )
    if (
      response.status === 'completed' &&
      parsed.success &&
      unsupported.length === 0
    ) {
      // File metadata is determined by the parser, never invented by the model.
      const result = analysisSchema.parse({
        ...parsed.data,
        document: {
          ...parsed.data.document,
          fileName: request.fileName,
          pages: request.pages.length,
        },
      })
      return validateEvidence(result, request)
    }
    feedback =
      '\nYour previous response was invalid or incomplete. Produce a complete valid object adhering to all requirements. Use shorter descriptions and fewer repeated entries.' +
      (unsupported.length
        ? '\nValidation problems: ' + unsupported.slice(0, 8).join('; ')
        : '')
    previousAnalysis = raw
    if (modelResult.success && unsupported.length) {
      const corrections = modelResult.data.amounts.flatMap((amount, index) => {
        if (
          !unsupported.some((error) => error.startsWith(`amounts[${index}]:`))
        )
          return []
        const page = request.pages[amount.sourcePage - 1]
        return [
          {
            index,
            previousValue: amount.value,
            context: amount.context,
            sourcePage: amount.sourcePage,
            printedNumbers:
              page?.text.match(/-?\d+(?:\s+\d{3})*(?:[.,]\d+)*/g) ?? [],
          },
        ]
      })
      // Only returned to the already authorized model; never emitted in logs.
      repairHints = corrections
    }
    // Diagnostics contain only field paths/reasons, never document text or keys.
    console.warn(
      JSON.stringify({
        event: 'analysis_validation_failed',
        attempt: attempt + 1,
        unsupported,
        schemaPaths: modelResult.success
          ? parsed.success
            ? []
            : parsed.error.issues.map((issue) => issue.path.join('.'))
          : modelResult.error.issues.map((issue) => issue.path.join('.')),
      }),
    )
  }
  throw new ApiError(
    502,
    'AI nie zwróciło poprawnych danych po dwóch próbach. Spróbuj ponownie.',
  )
}
