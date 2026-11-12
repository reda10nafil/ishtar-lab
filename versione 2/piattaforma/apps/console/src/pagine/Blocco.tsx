import type { ReactNode } from "react"
import "./blocchi.css"

/** Blocco di pagina: `piatto` lascia che il contenuto arrivi ai bordi, come elenchi e tabelle. */
export function Blocco({ titolo, testo, azioni, piatto, classe = "", children }: { titolo: string; testo: string; azioni?: ReactNode; piatto?: boolean; classe?: string; children?: ReactNode }) {
  return (
    <section className={`blocco vetro${piatto ? " blocco--piatto" : ""} ${classe}`.trim()}>
      <header className="blocco__testa">
        <div>
          <h2>{titolo}</h2>
          <p>{testo}</p>
        </div>
        {azioni}
      </header>
      {children}
    </section>
  )
}
