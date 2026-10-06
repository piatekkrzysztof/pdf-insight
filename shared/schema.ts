import { z } from 'zod'

export const MAX_FILE_BYTES = 10_000_000
export const MAX_PAGES = 100
export const MAX_TEXT_CHARS = 100_000
export const MAX_REQUEST_BYTES = 500_000

const nullableText = z.string().min(1).max(500).nullable()
const isoDate = z.iso.date()
const languages = new Set(
  'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(
    ' ',
  ),
)
const currencies = new Set(Intl.supportedValuesOf('currency'))

export const analysisShape = z.object({
  document: z.object({
    fileName: z.string().min(1).max(255),
    pages: z.number().int().min(1).max(MAX_PAGES),
    language: z
      .string()
      .regex(/^[a-z]{2}$/)
      .nullable(),
    type: z.enum(['faktura', 'umowa', 'oferta', 'raport', 'inne']),
    title: nullableText,
    date: isoDate.nullable(),
  }),
  summary: z.string().min(1).max(5000),
  keyPoints: z.array(z.string().min(1).max(1000)).min(3).max(7),
  entities: z.object({
    organizations: z.array(z.string().min(1).max(300)).max(100),
    people: z.array(z.string().min(1).max(200)).max(100),
  }),
  amounts: z
    .array(
      z.object({
        value: z.number(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        context: z.string().min(1).max(600),
      }),
    )
    .max(100),
  dates: z
    .array(
      z.object({
        date: isoDate,
        context: z.string().min(1).max(600),
      }),
    )
    .max(100),
  keywords: z.array(z.string().min(1).max(100)).max(20),
  sources: z
    .array(
      z.object({
        page: z.number().int().positive(),
        quote: z.string().min(1).max(600),
        fact: z.string().min(1).max(600),
      }),
    )
    .max(12),
})

// Keep refinements out of the JSON Schema supplied to the model.
export const analysisSchema = analysisShape.superRefine((data, ctx) => {
  if (data.document.language && !languages.has(data.document.language)) {
    ctx.addIssue({
      code: 'custom',
      path: ['document', 'language'],
      message: 'Niepoprawny kod ISO 639-1',
    })
  }
  data.amounts.forEach((amount, index) => {
    if (!currencies.has(amount.currency))
      ctx.addIssue({
        code: 'custom',
        path: ['amounts', index, 'currency'],
        message: 'Niepoprawny kod ISO 4217',
      })
  })
  data.sources.forEach((source, index) => {
    if (source.page > data.document.pages)
      ctx.addIssue({
        code: 'custom',
        path: ['sources', index, 'page'],
        message: 'Strona poza dokumentem',
      })
  })
})

export type Analysis = z.infer<typeof analysisSchema>

// A sentence array is easier to constrain than counting dots in company names.
// It is converted to the required public summary string by the backend.
export const modelSchema = analysisShape.omit({ summary: true }).extend({
  summarySentences: z.array(z.string().min(1).max(1000)).min(3).max(5),
  amounts: z
    .array(
      analysisShape.shape.amounts.element.extend({
        sourcePage: z.number().int().positive(),
      }),
    )
    .max(100),
  dates: z
    .array(
      analysisShape.shape.dates.element.extend({
        sourcePage: z.number().int().positive(),
      }),
    )
    .max(100),
})
export type ModelAnalysis = z.infer<typeof modelSchema>

export const requestSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
    pages: z
      .array(
        z.object({
          number: z.number().int().positive(),
          text: z.string().max(MAX_TEXT_CHARS),
          ocrConfidence: z.number().min(0).max(100).optional(),
        }),
      )
      .min(1)
      .max(MAX_PAGES),
  })
  .superRefine((data, ctx) => {
    if (
      data.pages.reduce((sum, page) => sum + page.text.length, 0) >
      MAX_TEXT_CHARS
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Dokument przekracza limit tekstu',
      })
    }
    if (!data.pages.some((page) => page.text.trim().length >= 30)) {
      ctx.addIssue({ code: 'custom', message: 'Brak tekstu do analizy' })
    }
    if (data.pages.some((page, index) => page.number !== index + 1)) {
      ctx.addIssue({ code: 'custom', message: 'Niepoprawna kolejność stron' })
    }
  })

export type AnalysisRequest = z.infer<typeof requestSchema>

export const responseSchema = z.object({
  analysis: analysisSchema,
  meta: z.object({
    partial: z.boolean(),
    unreadPages: z.array(z.number().int().positive()),
    durationMs: z.number().nonnegative(),
    model: z.string(),
    ocrPages: z.array(z.number().int().positive()).optional(),
    chunks: z.number().int().positive().optional(),
  }),
})
export type AnalysisResponse = z.infer<typeof responseSchema>
