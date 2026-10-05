import { expect, test } from '@playwright/test'
import { exampleAnalysis } from '../shared/fixtures'

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
