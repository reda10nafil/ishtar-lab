import "./iniziali.css"

const TINTE = 5

function sigla(nome: string) {
  const parole = nome.trim().split(/\s+/)
  return (parole.length > 1 ? `${parole[0][0]}${parole[1][0]}` : nome.trim().slice(0, 2)).toUpperCase()
}

/** Stesso nome, stessa tinta: la riga resta riconoscibile fra un caricamento e l'altro. */
const tinta = (nome: string) => ([...nome].reduce((somma, lettera) => (somma * 31 + lettera.charCodeAt(0)) % 997, 7) % TINTE) + 1

export function Iniziali({ nome, tonda, punto }: { nome: string; tonda?: boolean; punto?: boolean }) {
  return (
    <span className={`iniziali iniziali--${tinta(nome)}${tonda ? " iniziali--tonda" : ""}`} aria-hidden="true">
      {sigla(nome)}
      {punto ? <i className="iniziali__punto" /> : null}
    </span>
  )
}
