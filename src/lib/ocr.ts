import { createWorker, OEM } from 'tesseract.js'
import workerPath from 'tesseract.js/dist/worker.min.js?url'

export async function createOcr(
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const assetPath = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin)
    .href
  const worker = await createWorker('pol+eng', OEM.LSTM_ONLY, {
    workerPath,
    corePath: assetPath,
    langPath: assetPath,
    logger: (event) =>
      progress(
        event.status === 'recognizing text'
          ? `Rozpoznawanie tekstu: ${Math.round(event.progress * 100)}%`
          : 'Przygotowanie lokalnego OCR…',
      ),
  })
  if (signal.aborted) {
    await worker.terminate()
    signal.throwIfAborted()
  }
  const cancel = () => {
    void worker.terminate()
  }
  signal.addEventListener('abort', cancel, { once: true })
  return {
    recognize: async (canvas: HTMLCanvasElement) => {
      signal.throwIfAborted()
      const { data } = await worker.recognize(canvas)
      return { text: data.text.trim(), confidence: data.confidence }
    },
    close: async () => {
      signal.removeEventListener('abort', cancel)
      await worker.terminate()
    },
  }
}
