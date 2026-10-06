import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export function SourceViewer({
  file,
  page,
  onClose,
}: {
  file: File
  page: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
    const controller = new AbortController()
    void (async () => {
      try {
        const { renderSource } = await import('../lib/pdf')
        if (canvas.current)
          await renderSource(file, page, canvas.current, controller.signal)
        if (!controller.signal.aborted) setReady(true)
      } catch {
        if (!controller.signal.aborted)
          setError('Nie udało się wyświetlić strony PDF.')
      }
    })()
    return () => controller.abort()
  }, [file, page])
  return (
    <dialog
      ref={dialog}
      className="source-dialog"
      onCancel={onClose}
      aria-labelledby="source-title"
    >
      <div className="source-dialog-header">
        <h2 id="source-title">Źródło · strona {page}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Zamknij podgląd"
        >
          <X />
        </button>
      </div>
      <p className="muted">
        Oryginalny PDF pozostaje w przeglądarce. Porównaj cytat z treścią
        strony.
      </p>
      {!ready && !error && <p role="status">Wczytywanie strony…</p>}
      {error && <p role="alert">{error}</p>}
      <canvas
        ref={canvas}
        aria-label={`Obraz strony ${page} dokumentu ${file.name}`}
      />
    </dialog>
  )
}
