import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Scintilla } from "../../componenti/Grafici"
import { Cifra } from "../../movimenti"
import { percentuale } from "../../lingua"
import { euro } from "../../ui"
import type { Canale } from "./tipi"

export const COLORE_CANALE: Record<Canale, string> = {
  online: "var(--serie-online)",
  cassa: "var(--serie-negozio)",
  ingrosso: "var(--serie-ingrosso)",
}

/** Importo senza centesimi, per i riepiloghi. */
export const intero = (valore: number) => euro(Math.round(valore)).replace(/\.00$/, "")

/** Variazione col suo verso: su è buono, giù no. Senza confronto non compare. */
export function Delta({ valore }: { valore: number | null }) {
  if (valore === null || !Number.isFinite(valore)) return null
  const giu = valore < 0
  const Freccia = giu ? ArrowDown : ArrowUp
  return (
    <span className={giu ? "delta delta--giu" : "delta"}>
      <Freccia size={11} strokeWidth={3} aria-hidden="true" />
      <span className="nascosto">{giu ? "Down " : "Up "}</span>
      {percentuale(Math.abs(valore))}
    </span>
  )
}

const iniziali = (nome: string) =>
  nome
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

export function Miniatura({ nome, url, classe }: { nome: string; url?: string | null; classe?: string }) {
  return (
    <span className={classe ? `miniatura ${classe}` : "miniatura"} title={nome} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <b>{iniziali(nome)}</b>}
    </span>
  )
}

const TONI = 4
const tonoDi = (nome: string) => [...nome].reduce((somma, c) => somma + c.charCodeAt(0), 0) % TONI

export function Avatar({ nome }: { nome: string }) {
  return <span className={`avatar-pan avatar-pan--${tonoDi(nome)}`} aria-hidden="true">{iniziali(nome)}</span>
}

type Tessera = {
  etichetta: string
  icona: LucideIcon
  colore: string
  valore: number | null
  formato: (valore: number) => string
  variazione?: number | null
  nota: ReactNode
  serie?: number[]
  vuoto?: string
}

/** Scheda di un indicatore: etichetta e icona, numero, variazione, nota e andamento. */
export function Indicatore({ etichetta, icona: Icona, colore, valore, formato, variazione = null, nota, serie, vuoto = "–" }: Tessera) {
  return (
    <div className="tessera vetro" data-blocco>
      <div className="tessera__testa">
        <span>{etichetta}</span>
        <i style={{ background: colore }}><Icona size={18} aria-hidden="true" /></i>
      </div>
      <strong className="tessera__valore">{valore === null ? vuoto : <Cifra valore={valore} formato={formato} />}</strong>
      <div className="tessera__piede">
        <Delta valore={variazione} />
        <span>{nota}</span>
        {serie ? <Scintilla valori={serie} colore={colore} /> : null}
      </div>
    </div>
  )
}
