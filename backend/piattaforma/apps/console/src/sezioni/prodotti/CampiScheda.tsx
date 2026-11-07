import { Campo } from "../../ui"
import { numeroDa, testoDa } from "./dati"
import type { Riferimento } from "./tipi"

export const GENERI = ["Women", "Men", "Unisex", "Girls", "Boys"]
export const STAGIONI = ["Spring/Summer", "Autumn/Winter", "All year"]

export type ValoriScheda = {
  categoria_id: string
  brand: string
  stagione: string
  genere: string
  composizione: string
  cura: string
  peso: string
  prezzo_cessione: string
  prezzo_consigliato: string
}

export const SCHEDA_VUOTA: ValoriScheda = {
  categoria_id: "",
  brand: "",
  stagione: "",
  genere: "",
  composizione: "",
  cura: "",
  peso: "",
  prezzo_cessione: "",
  prezzo_consigliato: "",
}

type Origine = {
  categorie: Riferimento[]
  brand: string | null
  stagione: string | null
  genere: string | null
  composizione: string | null
  cura: string | null
  peso: number | null
  prezzo_cessione?: number | null
  prezzo_consigliato?: number | null
}

export const valoriDa = (s: Origine): ValoriScheda => ({
  categoria_id: s.categorie[0]?.id ?? "",
  brand: s.brand ?? "",
  stagione: s.stagione ?? "",
  genere: s.genere ?? "",
  composizione: s.composizione ?? "",
  cura: s.cura ?? "",
  peso: testoDa(s.peso),
  prezzo_cessione: testoDa(s.prezzo_cessione),
  prezzo_consigliato: testoDa(s.prezzo_consigliato),
})

/** Corpo comune alle rotte del catalogo: i testi vuoti diventano assenti. */
export const corpoScheda = (v: ValoriScheda, conCessione: boolean) => ({
  categoria_id: v.categoria_id || null,
  brand: v.brand.trim() || null,
  stagione: v.stagione || null,
  genere: v.genere || null,
  composizione: v.composizione.trim() || null,
  cura: v.cura.trim() || null,
  peso: numeroDa(v.peso),
  prezzo_consigliato: numeroDa(v.prezzo_consigliato),
  ...(conCessione ? { prezzo_cessione: numeroDa(v.prezzo_cessione) } : {}),
})

type Proprieta = {
  valori: ValoriScheda
  categorie: Riferimento[]
  onCambia: (valori: ValoriScheda) => void
  conCessione: boolean
  conConsigliato?: boolean
}

export function CampiScheda({ valori, categorie, onCambia, conCessione, conConsigliato = true }: Proprieta) {
  const cambia = (chiave: keyof ValoriScheda) => (e: { target: { value: string } }) => onCambia({ ...valori, [chiave]: e.target.value })
  // Un valore scritto prima dell'elenco fisso resta sceglibile: non si perde salvando.
  const conAttuale = (elenco: string[], attuale: string) => (attuale && !elenco.includes(attuale) ? [attuale, ...elenco] : elenco)

  return (
    <>
      <div className="griglia-due">
        <Campo etichetta="Category">
          <select value={valori.categoria_id} onChange={cambia("categoria_id")}>
            <option value="">No category</option>
            {categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Brand">
          <input value={valori.brand} onChange={cambia("brand")} />
        </Campo>
        <Campo etichetta="Season">
          <select value={valori.stagione} onChange={cambia("stagione")}>
            <option value="">Not set</option>
            {conAttuale(STAGIONI, valori.stagione).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Gender">
          <select value={valori.genere} onChange={cambia("genere")}>
            <option value="">Not set</option>
            {conAttuale(GENERI, valori.genere).map((g) => <option key={g}>{g}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Composition">
          <input value={valori.composizione} placeholder="For example, 100% linen" onChange={cambia("composizione")} />
        </Campo>
        <Campo etichetta="Weight in grams">
          <input type="number" min="0" step="1" inputMode="numeric" value={valori.peso} onChange={cambia("peso")} />
        </Campo>
      </div>
      <Campo etichetta="Garment care">
        <textarea rows={2} value={valori.cura} onChange={cambia("cura")} />
      </Campo>
      {conCessione || conConsigliato ? (
        <div className="griglia-due">
          {conCessione ? (
            <Campo etichetta="Supply price">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={valori.prezzo_cessione} onChange={cambia("prezzo_cessione")} />
            </Campo>
          ) : null}
          {conConsigliato ? (
            <Campo etichetta="Suggested price">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={valori.prezzo_consigliato} onChange={cambia("prezzo_consigliato")} />
            </Campo>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
