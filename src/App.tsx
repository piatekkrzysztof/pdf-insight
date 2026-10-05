import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { AnalysisRequest, AnalysisResponse } from '../shared/schema'
import { analyzeDocument } from './api/client'
import { Results } from './components/Results'
import './App.css'

type Stage = 'empty' | 'reading' | 'ready' | 'analyzing' | 'done' | 'error'

function App() {
  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [document, setDocument] = useState<AnalysisRequest | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const busy = stage === 'reading' || stage === 'analyzing'
  const unreadPages =
    document?.pages
      .filter((page) => page.text.length < 30)
      .map((page) => page.number) ?? []

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (stage !== 'analyzing') return
    const start = Date.now()
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    )
    return () => clearInterval(timer)
  }, [stage])

  async function loadFile(selected: File) {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setError('')
    setResult(null)
    setDocument(null)
    setFile(selected)
    setStage('reading')
    setProgress('Otwieranie dokumentu…')
    try {
      const { extractPdf } = await import('./lib/pdf')
      const extracted = await extractPdf(
        selected,
        current.signal,
        (page, total) => setProgress(`Odczyt strony ${page} z ${total}`),
      )
      if (current.signal.aborted) return
      setDocument(extracted)
      setStage('ready')
    } catch (err) {
      if (current.signal.aborted) return
      setError(
        err instanceof Error ? err.message : 'Nie można odczytać dokumentu.',
      )
      setStage('error')
    }
  }

  async function runAnalysis() {
    if (!document || busy) return
    const current = new AbortController()
    controller.current = current
    setStage('analyzing')
    setResult(null)
    setElapsed(0)
    setError('')
    try {
      const response = await analyzeDocument(document, current.signal)
      if (current.signal.aborted) return
      setResult(response)
      setStage('done')
    } catch (err) {
      if (current.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Analiza nie powiodła się.')
      setStage('error')
    }
  }

  function reset() {
    controller.current?.abort()
    setStage('empty')
    setFile(null)
    setDocument(null)
    setResult(null)
    setError('')
    if (input.current) input.current.value = ''
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <header className="topbar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="PDF Insight — strona główna"
        >
          <span className="brand-icon">
            <ScanText size={22} />
          </span>
          <span>
            PDF<span className="brand-light">Insight</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="workspace-label">TWÓJ ASYSTENT DOKUMENTÓW</span>
          <button
            className="privacy-button"
            onClick={() => setShowPrivacy(!showPrivacy)}
            aria-expanded={showPrivacy}
          >
            <LockKeyhole size={15} /> O prywatności <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      {showPrivacy && (
        <aside className="privacy-panel">
          <strong>Co dzieje się z dokumentem?</strong>
          <p>
            PDF odczytujemy w Twojej przeglądarce. Dopiero po kliknięciu
            „Analizuj dokument” jego tekst i nazwa trafiają przez nasz backend
            do OpenAI. Nie zapisujemy dokumentów ani wyników na naszym serwerze.
            Nie zapisujemy ich też w historii przeglądarki. Zewnętrzny dostawca
            stosuje własne zasady przetwarzania danych. Nie przesyłaj
            informacji, których nie możesz udostępnić.
          </p>
          <button
            className="button secondary"
            onClick={() => setShowPrivacy(false)}
          >
            Rozumiem
          </button>
        </aside>
      )}
      <main id="main">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="green-line" /> MNIEJ CZYTANIA. WIĘCEJ
              ZROZUMIENIA.
            </div>
            <h1>
              Od dokumentu
              <br />
              do <span>konkretów.</span>
            </h1>
            <p>
              Wgraj PDF. Otrzymaj krótkie podsumowanie,
              <br className="desktop-break" /> najważniejsze informacje i
              uporządkowany JSON.
            </p>
          </div>
          <div className="intro-note">
            <span className="note-icon">
              <Sparkles size={20} />
            </span>
            <p>
              Ważne informacje,
              <br />
              <strong>bez szukania między wierszami.</strong>
            </p>
          </div>
        </section>
        <div className="workflow-strip">
          <span className={document ? 'complete' : 'active'}>
            <b>{document ? <Check size={13} /> : '01'}</b> Wgraj PDF
          </span>
          <span className="step-line" />
          <span
            className={
              stage === 'analyzing' || stage === 'ready'
                ? 'active'
                : result
                  ? 'complete'
                  : ''
            }
          >
            <b>{result ? <Check size={13} /> : '02'}</b> Przeanalizuj
          </span>
          <span className="step-line" />
          <span className={result ? 'active' : ''}>
            <b>03</b> Odbierz dane
          </span>
        </div>
        <div className="workspace-grid">
          <section className="upload-card" aria-labelledby="upload-heading">
            <div className="section-label">
              <span className="eyebrow">DOKUMENT ŹRÓDŁOWY</span>
              <span className="small-badge">PDF · do 10 MB</span>
            </div>
            <h2 id="upload-heading">Zacznij od swojego pliku</h2>
            <input
              className="visually-hidden"
              type="file"
              accept=".pdf,application/pdf"
              ref={input}
              tabIndex={-1}
              aria-label="Wybierz dokument PDF"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) void loadFile(selected)
                event.target.value = ''
              }}
            />
            <div
              className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                if (event.dataTransfer.files.length !== 1) {
                  setError('Wgraj jeden dokument naraz.')
                  return
                }
                const selected = event.dataTransfer.files[0]
                if (selected) void loadFile(selected)
              }}
            >
              {file ? (
                <>
                  <div className="document-symbol">
                    <FileText size={30} />
                  </div>
                  <strong className="file-name">{file.name}</strong>
                  <span className="file-info">
                    {(file.size / 1_000_000).toFixed(2)} MB
                    {document ? ` · ${document.pages.length} stron` : ''}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => input.current?.click()}
                  >
                    <FolderOpen size={15} /> Zmień dokument
                  </button>
                </>
              ) : (
                <>
                  <div className="document-symbol">
                    <Upload size={28} />
                  </div>
                  <strong>Przeciągnij tutaj swój PDF</strong>
                  <span>lub wybierz plik z komputera</span>
                  <button
                    className="button secondary"
                    onClick={() => input.current?.click()}
                  >
                    <FolderOpen size={16} /> Wybierz plik
                  </button>
                  <small>Umowy, faktury, oferty i raporty</small>
                </>
              )}
            </div>
            <div role="status" aria-live="polite">
              {stage === 'done' && (
                <p className="processing">
                  <Check size={17} /> Analiza gotowa. Wyniki znajdziesz poniżej.
                </p>
              )}
              {stage === 'reading' && (
                <p className="processing">
                  <LoaderCircle className="spin" size={17} />
                  {progress}
                </p>
              )}
              {stage === 'analyzing' && (
                <p className="processing">
                  <LoaderCircle className="spin" size={17} />
                  AI analizuje treść i przygotowuje dane…{' '}
                  <span>{elapsed} s</span>
                </p>
              )}
            </div>
            {unreadPages.length > 0 && !result && (
              <div className="notice warning">
                <strong>
                  Niepełny odczyt: strony {unreadPages.join(', ')}.
                </strong>{' '}
                Nie znaleziono wystarczającej ilości tekstu. Mogą zawierać skan
                lub ważny aneks. Analiza obejmie tylko odczytaną treść.
              </div>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="upload-actions">
              {busy ? (
                <button className="button secondary" onClick={reset}>
                  <X size={16} /> Anuluj
                </button>
              ) : (
                <button
                  className="button primary analyze-button"
                  disabled={!document}
                  onClick={() => void runAnalysis()}
                >
                  <Sparkles size={17} />
                  {stage === 'error' && document
                    ? 'Spróbuj ponownie'
                    : 'Analizuj dokument'}
                  <ArrowRight size={17} />
                </button>
              )}
              {file && !busy && (
                <button
                  className="icon-button"
                  onClick={reset}
                  aria-label="Usuń wybrany dokument"
                >
                  <X size={19} />
                </button>
              )}
            </div>
            <p className="privacy-note">
              <LockKeyhole size={14} />
              <span>
                Po rozpoczęciu analizy tekst dokumentu zostanie przekazany do
                OpenAI. Nie zapisujemy go na naszym serwerze.
              </span>
            </p>
          </section>
          <aside className="guide-card">
            <span className="eyebrow">CO OTRZYMASZ</span>
            <h2>
              Jasny obraz
              <br />
              Twojego dokumentu.
            </h2>
            <div className="guide-item">
              <span>01</span>
              <div>
                <h3>Podsumowanie</h3>
                <p>Najważniejsza treść w kilku zdaniach, w języku dokumentu.</p>
              </div>
            </div>
            <div className="guide-item">
              <span>02</span>
              <div>
                <h3>Konkretne informacje</h3>
                <p>
                  Kwoty, daty, osoby i organizacje — z zachowaniem kontekstu.
                </p>
              </div>
            </div>
            <div className="guide-item">
              <span>03</span>
              <div>
                <h3>Dane gotowe do użycia</h3>
                <p>Przejrzysty podgląd i eksport JSON do dalszej pracy.</p>
              </div>
            </div>
            <div className="guide-footer">
              <ShieldCheck size={18} />
              <span>
                Sprawdzamy strukturę wyniku
                <br />
                przed jego wyświetleniem.
              </span>
            </div>
          </aside>
        </div>
        {result ? (
          <Results key={result.meta.durationMs} result={result} />
        ) : (
          <div className="empty-result">
            <ScanText size={20} />
            <p>Tutaj pojawią się informacje z Twojego dokumentu.</p>
            <span>Wgraj PDF, aby rozpocząć</span>
          </div>
        )}
      </main>
      <footer className="page-footer">
        <span>
          PDF Insight <span className="footer-dot">/</span> Dokumenty pod
          kontrolą.
        </span>
        <span>Warstwa tekstowa · Bez rejestracji</span>
      </footer>
    </div>
  )
}

export default App
