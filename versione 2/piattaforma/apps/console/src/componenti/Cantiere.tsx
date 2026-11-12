import { Pagina } from "../ui"

/** Segnaposto di una sezione ancora da costruire: non mostra dati. */
export function Cantiere({ titolo }: { titolo: string }) {
  return (
    <Pagina titolo={titolo} sottotitolo="Coming soon.">
      <p className="cantiere vetro">This section is on its way: the page updates by itself as soon as it is ready.</p>
    </Pagina>
  )
}
