import { numeroDa } from "./dati"

export type DettaglioTaglia = { ean: string; quantita: string }
export type Taglie = { codice: string; taglie: string; dettagli: Record<string, DettaglioTaglia> }

export const elencoTaglie = (testo: string) => [...new Set(testo.split(",").map((t) => t.trim()).filter(Boolean))]

const parteCodice = (testo: string) => testo.trim().toUpperCase().replace(/\s+/g, "-")

/** Il codice di ogni variante nasce dal codice articolo e dalla taglia: BLZ01-S, BLZ01-M. */
export const variantiDa = ({ codice, taglie, dettagli }: Taglie) =>
  elencoTaglie(taglie).map((titolo) => ({
    titolo,
    sku: `${parteCodice(codice)}-${parteCodice(titolo)}`,
    ean: dettagli[titolo]?.ean.trim() || null,
    quantita: numeroDa(dettagli[titolo]?.quantita ?? ""),
  }))

type Proprieta = { valore: Taglie; onCambia: (valore: Taglie) => void; conQuantita: boolean }

/** Una riga per taglia, con il suo EAN e la sua quantità. */
export function RigheTaglie({ valore, onCambia, conQuantita }: Proprieta) {
  const titoli = elencoTaglie(valore.taglie)
  if (!titoli.length) return null
  const cambia = (titolo: string, campo: keyof DettaglioTaglia, testo: string) => {
    const attuale = valore.dettagli[titolo] ?? { ean: "", quantita: "" }
    onCambia({ ...valore, dettagli: { ...valore.dettagli, [titolo]: { ...attuale, [campo]: testo } } })
  }
  return (
    <div className="righe-taglie" role="group" aria-label="Details by size">
      <div className={`righe-taglie__riga righe-taglie__testa${conQuantita ? "" : " righe-taglie__riga--due"}`} aria-hidden="true">
        <span>Size</span>
        <span>EAN</span>
        {conQuantita ? <span>Quantity</span> : null}
      </div>
      {titoli.map((titolo) => (
        <div key={titolo} className={`righe-taglie__riga${conQuantita ? "" : " righe-taglie__riga--due"}`}>
          <strong>{titolo}</strong>
          <input inputMode="numeric" aria-label={`EAN for size ${titolo}`} value={valore.dettagli[titolo]?.ean ?? ""} onChange={(e) => cambia(titolo, "ean", e.target.value)} />
          {conQuantita ? (
            <input type="number" min="0" step="1" inputMode="numeric" aria-label={`Quantity for size ${titolo}`} value={valore.dettagli[titolo]?.quantita ?? ""} onChange={(e) => cambia(titolo, "quantita", e.target.value)} />
          ) : null}
        </div>
      ))}
    </div>
  )
}
