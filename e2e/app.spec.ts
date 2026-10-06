import { expect, test } from '@playwright/test'
import { exampleAnalysis } from '../shared/fixtures'
import AxeBuilder from '@axe-core/playwright'
import { writeFile } from 'node:fs/promises'

// A minimal, real PDF with a text layer, generated in-memory for portability.
function pdfBuffer() {
  const text =
    'BT /F1 12 Tf 50 700 Td (Contract for CRM implementation. Price: 184500 PLN. Date: 2026-03-12.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

test('read PDF, show validated result, preview and export JSON', async ({
  page,
}) => {
  await page.route('**/analyze', (route) =>
    route.fulfill({
      json: {
        analysis: {
          ...exampleAnalysis,
          document: { ...exampleAnalysis.document, pages: 1 },
        },
        meta: {
          partial: false,
          unreadPages: [],
          durationMs: 450,
          model: 'test-fixture',
        },
      },
    }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeDisabled()
  await page.getByLabel('Wybierz dokument PDF').setInputFiles({
    name: 'umowa.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer(),
  })
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Analizuj dokument' }).click()
  await expect(
    page.getByRole('heading', { name: 'Dokument, w skrócie.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  await expect(page.getByLabel('Dane JSON')).toContainText('184500')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Pobierz JSON' }).click()
  expect((await downloaded).suggestedFilename()).toBe('umowa-insight.json')
})

test('API error can be retried without re-uploading', async ({ page }) => {
  let attempts = 0
  await page.route('**/analyze', (route) => {
    attempts++
    return route.fulfill({
      status: 429,
      json: { error: 'Osiągnięto limit analiz. Spróbuj ponownie za minutę.' },
    })
  })
  await page.goto('/')
  await page.getByLabel('Wybierz dokument PDF').setInputFiles({
    name: 'umowa.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer(),
  })
  await page.getByRole('button', { name: 'Analizuj dokument' }).click()
  await expect(page.getByRole('alert')).toContainText('limit analiz')
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await expect.poll(() => attempts).toBe(2)
})

test('rejects invalid files and supports 360px layout', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByLabel('Wybierz dokument PDF').setInputFiles({
    name: 'not-a-pdf.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('invalid file'),
  })
  await expect(page.getByRole('alert')).toContainText('nagłówka PDF')
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeDisabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Usuń wybrany dokument' }).click()
  await expect(
    page.getByRole('button', { name: 'Wybierz plik', exact: true }),
  ).toBeVisible()
})

test('provided recruitment PDF detects the unreadable annex', async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_PDF_PATH,
    'Set TEST_PDF_PATH to test the supplied recruitment document locally.',
  )
  await page.goto('/')
  await page
    .getByLabel('Wybierz dokument PDF')
    .setInputFiles(process.env.TEST_PDF_PATH!)
  await expect(page.getByText('Niepełny odczyt: strony 11.')).toBeVisible()
  await expect(page.getByText(/12 stron/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeEnabled()
})

test('demo, opt-in history, source preview and accessible results', async ({
  page,
}) => {
  await page.route('**/analyze', async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      json: {
        analysis: {
          ...exampleAnalysis,
          document: {
            ...exampleAnalysis.document,
            fileName: body.fileName,
            pages: 1,
          },
        },
        meta: {
          partial: false,
          unreadPages: [],
          durationMs: 100,
          model: 'fixture',
        },
      },
    })
  })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Wypróbuj przykładowy dokument' }),
  ).toBeVisible()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([])
  await page.getByLabel('Zapisuj ostatnie 5 wyników na tym urządzeniu').check()
  await page
    .getByRole('button', { name: 'Wypróbuj przykładowy dokument' })
    .click()
  await page.getByRole('button', { name: 'Analizuj dokument' }).click()
  await expect(
    page.getByRole('heading', { name: 'Dokument, w skrócie.' }),
  ).toBeVisible()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([])
  await page
    .getByRole('button', { name: 'Otwórz stronę 1', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('dialog canvas')
        .evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(500)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^pdf-insight-demo.pdf/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Dokument, w skrócie.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Usuń całą historię' }).click()
  await expect(
    page.getByText('Historia usunięta.', { exact: true }),
  ).toBeVisible()
})

test('local OCR reads a real scanned PDF without an AI request', async ({
  page,
}) => {
  test.setTimeout(120_000)
  let aiRequests = 0
  let extractedText = ''
  await page.route('**/analyze', (route) => {
    aiRequests++
    extractedText = route.request().postDataJSON().pages[0].text
    return route.abort()
  })
  await page.goto('/')
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, 1200, 800)
    context.fillStyle = 'black'
    context.font = '40px Arial'
    ;[
      'DEMO INVOICE',
      'Maple Studio Ltd.',
      'Invoice date: 2026-10-01',
      'Total: 500.00 EUR',
      'Payment due: 2026-10-15',
    ].forEach((line, i) => context.fillText(line, 80, 110 + i * 90))
    return canvas.toDataURL('image/jpeg').split(',')[1]
  })
  const jpeg = Buffer.from(image, 'base64')
  const stream = 'q 600 0 0 400 0 0 cm /Im0 Do Q'
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 1200 /Height 800 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      Buffer.from('\nendstream'),
    ]),
    Buffer.from(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`),
  ]
  let pdf = Buffer.from('%PDF-1.4\n')
  const offsets = [0]
  objects.forEach((object, i) => {
    offsets.push(pdf.length)
    pdf = Buffer.concat([
      pdf,
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ])
  })
  const xref = pdf.length
  pdf = Buffer.concat([
    pdf,
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
    ),
  ])
  await page.getByLabel('Odczytuj skany lokalnie').check()
  await page.getByLabel('Wybierz dokument PDF').setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  })
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeEnabled({ timeout: 110_000 })
  expect(aiRequests).toBe(0)
  await expect(page.getByText(/Niepełny odczyt/)).not.toBeVisible()
  await page.getByRole('button', { name: 'Analizuj dokument' }).click()
  await expect.poll(() => extractedText).toMatch(/500[.,]00/)
  expect(extractedText).toContain('2026-10-15')
})

test('provided annex OCR preserves changed fee and user count', async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.TEST_OCR_PATH,
    'Optional local OCR evaluation of the supplied PDF',
  )
  test.setTimeout(120_000)
  let captured = ''
  await page.route('**/analyze', (route) => {
    captured = route.request().postData() ?? ''
    return route.abort()
  })
  await page.goto('/')
  await page.getByLabel('Odczytuj skany lokalnie').check()
  await page
    .getByLabel('Wybierz dokument PDF')
    .setInputFiles(process.env.TEST_OCR_PATH!)
  await expect(
    page.getByRole('button', { name: 'Analizuj dokument' }),
  ).toBeEnabled({ timeout: 110_000 })
  await page.getByRole('button', { name: 'Analizuj dokument' }).click()
  await expect.poll(() => captured).not.toBe('')
  await writeFile(testInfo.outputPath('ocr-request.json'), captured)
  const request = JSON.parse(captured)
  expect(request.pages[10].text).toMatch(/13\s?100/)
  expect(request.pages[10].text).toContain('135')
  expect(request.pages[10].ocrConfidence).toBeGreaterThanOrEqual(60)
})
