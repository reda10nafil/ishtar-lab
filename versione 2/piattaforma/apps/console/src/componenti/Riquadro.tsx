import type { ReactNode } from "react"

export function Riquadro({ titolo, testo, azioni, children }: { titolo: string; testo?: string; azioni?: ReactNode; children: ReactNode }) {
  return (
    <section className="riquadro vetro">
      <header>
        <div>
          <h2>{titolo}</h2>
          {testo ? <p>{testo}</p> : null}
        </div>
        {azioni}
      </header>
      {children}
    </section>
  )
}
