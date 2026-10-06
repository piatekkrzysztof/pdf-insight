import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_TEXT_CHARS,
  type AnalysisRequest,
} from '../../shared/schema'

GlobalWorkerOptions.workerSrc = workerUrl

export function validateFile(file: Pick<File, 'name' | 'size' | 'type'>) {
  if (!file.name.toLowerCase().endsWith('.pdf'))
    throw new Error('Wybierz plik PDF.')
  if (
    file.type &&
    file.type !== 'application/pdf' &&
    file.type !== 'application/octet-stream'
  )
    throw new Error('Ten plik nie jest dokumentem PDF.')
  if (!file.size) throw new Error('Wybrany plik jest pusty.')
  if (file.size > MAX_FILE_BYTES)
    throw new Error('Plik przekracza 10 MB. Wybierz mniejszy PDF.')
}

export async function extractPdf(
  file: File,
  signal: AbortSignal,
  onProgress: (current: number, total: number) => void,
  options: { ocr?: boolean; onOcrProgress?: (message: string) => void } = {},
): Promise<AnalysisRequest> {
  validateFile(file)
  const buffer = await file.arrayBuffer()
  signal.throwIfAborted()
  if (!new TextDecoder().decode(buffer.slice(0, 1024)).includes('%PDF-'))
    throw new Error('Plik nie ma poprawnego nagłówka PDF.')
  const task = getDocument({ data: new Uint8Array(buffer) })
  const cancel = () => {
    void task.destroy()
  }
  signal.addEventListener('abort', cancel, { once: true })
  let ocr:
    Awaited<ReturnType<(typeof import('./ocr'))['createOcr']>> | undefined
  let ocrCount = 0
  try {
    const document = await task.promise
    if (document.numPages > MAX_PAGES)
      throw new Error('Dokument przekracza limit 100 stron.')
    const pages: AnalysisRequest['pages'] = []
    let characters = 0
    for (let number = 1; number <= document.numPages; number++) {
      signal.throwIfAborted()
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      // Preserve PDF.js line hints; blanket space removal corrupts normal prose.
      let text = content.items
        .map((item) =>
          'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
        )
        .join('')
        .normalize('NFKC')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim()
      let ocrConfidence: number | undefined
      if (text.length < 30 && options.ocr && ocrCount < 5) {
        ocrCount++
        options.onOcrProgress?.(`OCR strony ${number} z ${document.numPages}…`)
        if (!ocr)
          ocr = await (
            await import('./ocr')
          ).createOcr(signal, (message) =>
            options.onOcrProgress?.(`Strona ${number}: ${message}`),
          )
        const canvas = window.document.createElement('canvas')
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({
          scale: Math.min(2.5, 1800 / Math.max(base.width, base.height)),
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        const recognized = await ocr.recognize(canvas)
        canvas.width = 0
        canvas.height = 0
        if (recognized.confidence >= 60 && recognized.text.length >= 30) {
          text = recognized.text.normalize('NFKC')
          ocrConfidence = recognized.confidence
        }
      }
      characters += text.length
      if (characters > MAX_TEXT_CHARS)
        throw new Error(
          'Dokument przekracza 100 000 znaków tekstu. Podziel go na mniejsze pliki; żadna treść nie została wysłana do AI.',
        )
      pages.push({
        number,
        text,
        ...(ocrConfidence === undefined ? {} : { ocrConfidence }),
      })
      onProgress(number, document.numPages)
      page.cleanup()
    }
    if (!pages.some((page) => page.text.length >= 30))
      throw new Error(
        options.ocr
          ? 'Nie udało się wiarygodnie odczytać tekstu. Wgraj wyraźniejszy skan.'
          : 'Nie znaleziono warstwy tekstowej. Włącz lokalny OCR i wgraj plik ponownie.',
      )
    return { fileName: file.name, fileSize: file.size, pages }
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error(
        'PDF jest chroniony hasłem. Wgraj odblokowaną kopię dokumentu.',
        { cause: error },
      )
    if (error instanceof Error && error.name === 'InvalidPDFException')
      throw new Error('Nie można odczytać PDF. Plik może być uszkodzony.', {
        cause: error,
      })
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
    await task.destroy()
    await ocr?.close()
  }
}

export async function renderSource(
  file: File,
  number: number,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const cancel = () => {
    void task.destroy()
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const document = await task.promise
    const page = await document.getPage(number)
    const viewport = page.getViewport({ scale: 1.5 })
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise
  } finally {
    signal.removeEventListener('abort', cancel)
    await task.destroy()
  }
}
