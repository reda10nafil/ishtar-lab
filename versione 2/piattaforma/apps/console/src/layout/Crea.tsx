import { lazy, Suspense } from "react"
import { useNavigate } from "react-router-dom"

export type Creazione = "ordine" | "prodotto" | "cliente" | "sconto" | "campagna"

// Ogni modulo vive nella sua sezione: la sezione si carica prima perché porta con sé il suo CSS.
const ModuloBozza = lazy(async () => {
  await import("../sezioni/ordini")
  return import("../sezioni/ordini/ModuloBozza")
})
const NuovoProdotto = lazy(async () => {
  await import("../sezioni/prodotti")
  const { NuovoProdotto: modulo } = await import("../sezioni/prodotti/NuovoProdotto")
  return { default: modulo }
})
const ModuloCliente = lazy(async () => {
  await import("../sezioni/clienti")
  return import("../sezioni/clienti/ModuloCliente")
})
const ModuloCodice = lazy(async () => {
  await import("../sezioni/sconti")
  const { ModuloCodice: modulo } = await import("../sezioni/sconti/ModuloCodice")
  return { default: modulo }
})
const ModuloCampagna = lazy(async () => {
  await import("../sezioni/marketing")
  return import("../sezioni/marketing/ModuloCampagna")
})

/** I moduli del menu New e della ricerca si aprono sulla pagina in cui ci si trova, come nel pannello. */
export function Crea({ tipo, onChiudi }: { tipo: Creazione; onChiudi: () => void }) {
  const naviga = useNavigate()
  const vai = (dove: string) => {
    onChiudi()
    naviga(dove)
  }
  return (
    <Suspense fallback={null}>
      {tipo === "ordine" ? <ModuloBozza onChiudi={onChiudi} onCreata={vai} /> : null}
      {tipo === "prodotto" ? <NuovoProdotto onChiudi={onChiudi} /> : null}
      {tipo === "cliente" ? <ModuloCliente onChiudi={onChiudi} onCreato={(id) => vai(`/clienti/persone/${id}`)} /> : null}
      {tipo === "sconto" ? <ModuloCodice onChiudi={onChiudi} /> : null}
      {tipo === "campagna" ? <ModuloCampagna onChiudi={onChiudi} onFatto={() => vai("/marketing/campagne")} /> : null}
    </Suspense>
  )
}
