import { useState } from 'react'
import { Braces, Check, Copy, Download, FileCheck2, Quote } from 'lucide-react'
import type { AnalysisResponse } from '../../shared/schema'

export function Results({ result }: { result: AnalysisResponse }) {
  const [view, setView] = useState<'readable' | 'json'>('readable')
  const [copyStatus, setCopyStatus] = useState('')
  const { analysis, meta } = result
  // Keep completeness metadata in exports, not only in the UI.
  const json = JSON.stringify({ ...analysis, analysisMeta: meta }, null, 2)
  function download() {
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${analysis.document.fileName.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}_.-]/gu, '_')}-insight.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopyStatus('Skopiowano JSON.')
    } catch {
      setCopyStatus('Nie udało się skopiować. Możesz pobrać plik JSON.')
    }
  }
  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="result-heading">
        <div>
          <span className="eyebrow">WYNIK ANALIZY</span>
          <h2 id="results-heading">Dokument, w skrócie.</h2>
        </div>
        <button className="button primary" onClick={download}>
          <Download size={17} /> Pobierz JSON
        </button>
      </div>
      {meta.partial && (
        <div className="notice warning" role="status">
          <strong>Analiza jest niepełna.</strong> Strony bez wystarczającej
          warstwy tekstowej: {meta.unreadPages.join(', ')}. Mogą zawierać
          istotne informacje lub zmiany warunków. Nie zostały odczytane przez
          AI.
        </div>
      )}
      <div className="result-toolbar">
        <div className="view-switch" role="group" aria-label="Widok wyniku">
          <button
            aria-pressed={view === 'readable'}
            onClick={() => setView('readable')}
          >
            <FileCheck2 size={16} /> Podsumowanie
          </button>
          <button
            aria-pressed={view === 'json'}
            onClick={() => setView('json')}
          >
            <Braces size={16} /> JSON
          </button>
        </div>
        <span className="validated">
          <Check size={14} /> Struktura zweryfikowana
        </span>
      </div>
      {view === 'json' ? (
        <div className="json-panel">
          <div className="json-header">
            <span>analysis.json</span>
            <button className="button secondary" onClick={() => void copy()}>
              <Copy size={16} /> Kopiuj
            </button>
          </div>
          <pre tabIndex={0} aria-label="Dane JSON">
            {json}
          </pre>
          <p role="status">{copyStatus}</p>
        </div>
      ) : (
        <>
          <article className="summary-card">
            <div className="document-tags">
              <span>{analysis.document.type}</span>
              <span>
                {analysis.document.language?.toUpperCase() ?? 'Język nieznany'}
              </span>
              <span>{analysis.document.pages} str.</span>
              {analysis.document.date && <span>{analysis.document.date}</span>}
            </div>
            <h3>{analysis.document.title ?? analysis.document.fileName}</h3>
            <p className="summary-text">{analysis.summary}</p>
            <div className="keywords">
              {analysis.keywords.map((word, i) => (
                <span key={i}>{word}</span>
              ))}
            </div>
          </article>
          <div className="result-grid">
            <article className="data-card">
              <h3>Najważniejsze informacje</h3>
              <ol className="key-points">
                {analysis.keyPoints.map((point, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{point}</p>
                  </li>
                ))}
              </ol>
            </article>
            <article className="data-card">
              <h3>Osoby i organizacje</h3>
              <p className="label">ORGANIZACJE</p>
              {analysis.entities.organizations.length ? (
                <ul className="entity-list">
                  {analysis.entities.organizations.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nie wskazano.</p>
              )}
              <p className="label">OSOBY</p>
              {analysis.entities.people.length ? (
                <ul className="entity-list">
                  {analysis.entities.people.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nie wskazano.</p>
              )}
            </article>
          </div>
          <article className="data-card">
            <h3>
              Kwoty i ich znaczenie{' '}
              <span className="count">{analysis.amounts.length}</span>
            </h3>
            {analysis.amounts.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                aria-label="Kwoty w dokumencie"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Kwota</th>
                      <th>Kontekst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.amounts.map((amount, i) => (
                      <tr key={i}>
                        <td className="money">
                          {new Intl.NumberFormat('pl-PL', {
                            style: 'currency',
                            currency: amount.currency,
                          }).format(amount.value)}
                        </td>
                        <td>{amount.context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Nie znaleziono kwot.</p>
            )}
          </article>
          <article className="data-card">
            <h3>
              Daty <span className="count">{analysis.dates.length}</span>
            </h3>
            {analysis.dates.length ? (
              <ul className="dates">
                {analysis.dates.map((date, i) => (
                  <li key={i}>
                    <time dateTime={date.date}>{date.date}</time>
                    <span>{date.context}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nie znaleziono dokładnych dat.</p>
            )}
          </article>
          {analysis.sources.length > 0 && (
            <article className="data-card">
              <h3>Sprawdź w źródle</h3>
              <p className="muted">
                Cytaty dopasowano do odczytanego tekstu. Zweryfikuj
                interpretację w oryginalnym PDF.
              </p>
              <div className="sources">
                {analysis.sources.map((source, i) => (
                  <blockquote key={i}>
                    <span className="source-page">
                      <Quote size={15} /> Strona {source.page}
                    </span>
                    <p>{source.quote}</p>
                    <footer>{source.fact}</footer>
                  </blockquote>
                ))}
              </div>
            </article>
          )}
          <p className="result-note">
            AI może popełniać błędy. Przed podjęciem decyzji sprawdź informacje
            w oryginalnym dokumencie.
          </p>
        </>
      )}
    </section>
  )
}
