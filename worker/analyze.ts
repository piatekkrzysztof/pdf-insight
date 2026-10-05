import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import {
  analysisSchema,
  modelSchema,
  type Analysis,
  type AnalysisRequest,
} from '../shared/schema'
import { SYSTEM_PROMPT } from './prompt'

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
  const normalize = (text: string) =>
    text.normalize('NFKC').replace(/\s+/g, ' ').trim()
  return {
    ...analysis,
    sources: analysis.sources.filter((source) => {
      const page = request.pages[source.page - 1]
      return page && normalize(page.text).includes(normalize(source.quote))
    }),
  }
}

export async function analyze(
  request: AnalysisRequest,
  apiKey: string,
  model: string,
  signal: AbortSignal,
) {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 25_000 })
  let feedback = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.responses.create(
      {
        model,
        store: false,
        max_output_tokens: 6000,
        instructions: SYSTEM_PROMPT + feedback,
        input: [
          {
            role: 'user',
            content: JSON.stringify({
              fileName: request.fileName,
              totalPages: request.pages.length,
              unreadPages: request.pages
                .filter((p) => p.text.trim().length < 30)
                .map((p) => p.number),
              untrustedDocumentPages: request.pages,
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
    const parsed = analysisSchema.safeParse(
      modelResult.success
        ? {
            ...modelResult.data,
            summary: modelResult.data.summarySentences.join(' '),
            document: {
              ...modelResult.data.document,
              fileName: request.fileName,
              pages: request.pages.length,
            },
          }
        : null,
    )
    if (response.status === 'completed' && parsed.success) {
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
      '\nYour previous response was invalid or incomplete. Produce a complete valid object adhering to all requirements. Use shorter descriptions and fewer repeated entries.'
  }
  throw new ApiError(
    502,
    'AI nie zwróciło poprawnych danych po dwóch próbach. Spróbuj ponownie.',
  )
}
