import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale } from "../../ui"
import { numeroDa, testoDa, useAggiornaCatalogo, useAziende } from "./dati"
import type { OffertaScheda, SchedaProdotto, VarianteScheda } from "./tipi"

type ValoriOfferta = { prezzo: string; cessione: string; consigliato: string; quantita: string }

const valoriOfferta = (o: OffertaScheda): ValoriOfferta => ({
  prezzo: testoDa(o.prezzo),
  cessione: testoDa(o.prezzo_cessione),
  consigliato: testoDa(o.prezzo_consigliato),
  quantita: String(o.scorte),
})

const VUOTA: ValoriOfferta = { prezzo: "", cessione: "", consigliato: "", quantita: "" }

type CampiOffertaProprieta = { valori: ValoriOfferta; onCambia: (valori: ValoriOfferta) => void; conCessione: boolean; conScorte: boolean; depositi: number }

function CampiOfferta({ valori, onCambia, conCessione, conScorte, depositi }: CampiOffertaProprieta) {
  const cambia = (chiave: keyof ValoriOfferta) => (e: { target: { value: string } }) => onCambia({ ...valori, [chiave]: e.target.value })
  return (
    <div className="griglia-due">
      <Campo etichetta="Selling price">
        <input type="number" min="0" step="0.01" inputMode="decimal" value={valori.prezzo} onChange={cambia("prezzo")} />
      </Campo>
      {conCessione ? (
        <Campo etichetta="Supply price">
          <input type="number" min="0" step="0.01" inputMode="decimal" value={valori.cessione} onChange={cambia("cessione")} />
        </Campo>
      ) : null}
      <Campo etichetta="Suggested price">
        <input type="number" min="0" step="0.01" inputMode="decimal" value={valori.consigliato} onChange={cambia("consigliato")} />
      </Campo>
      {conScorte && depositi <= 1 ? (
        <Campo etichetta="Stock">
          <input type="number" min="0" step="1" inputMode="numeric" value={valori.quantita} onChange={cambia("quantita")} />
        </Campo>
      ) : null}
      {conScorte && depositi > 1 ? <p className="testo-tenue">Stock across several warehouses is changed from <Link to="/magazzino">Inventory</Link>.</p> : null}
    </div>
  )
}

type Proprieta = { scheda: SchedaProdotto; variante: VarianteScheda | null; onChiudi: () => void }

/** Aggiunge o modifica una variante con i prezzi e le scorte di ogni azienda che la vende. */
export function ModaleVariante({ scheda, variante, onChiudi }: Proprieta) {
  const { puo } = usePermessi()
  const { avvisa } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const aziende = useAziende()
  const conCessione = puo("margini", "view")
  const conScorte = puo("inventory_items", "edit")

  const [titolo, setTitolo] = useState(variante?.titolo ?? "")
  const [sku, setSku] = useState(variante?.sku ?? "")
  const [ean, setEan] = useState(variante?.ean ?? "")
  const [offerte, setOfferte] = useState<Record<string, ValoriOfferta>>(Object.fromEntries((variante?.offerte ?? []).map((o) => [o.id, valoriOfferta(o)])))
  const [azienda, setAzienda] = useState(scheda.aziende[0]?.id ?? "")
  const [nuova, setNuova] = useState<ValoriOfferta>(VUOTA)
  const [elimina, setElimina] = useState(false)

  const senzaOfferte = !variante?.offerte.length
  const percorsoProdotto = `/admin/catalogo/prodotti/${scheda.id}/varianti`
  const prezzi = (v: ValoriOfferta) => ({
    prezzo: numeroDa(v.prezzo),
    prezzo_consigliato: numeroDa(v.consigliato),
    ...(conCessione ? { prezzo_cessione: numeroDa(v.cessione) } : {}),
  })
  const quantita = (v: ValoriOfferta, depositi: number) => (conScorte && depositi <= 1 && v.quantita !== "" ? { quantita: Number(v.quantita) } : {})

  const salva = useMutation({
    mutationFn: () => {
      if (!variante) {
        return api(percorsoProdotto, {
          corpo: { titolo, sku, ean: ean || null, azienda_id: azienda || null, ...(azienda ? { ...prezzi(nuova), ...quantita(nuova, 0) } : {}) },
        })
      }
      return api(`${percorsoProdotto}/${variante.id}`, {
        corpo: {
          titolo,
          sku,
          ean: ean || null,
          offerte: variante.offerte.map((o) => ({ id: o.id, ...prezzi(offerte[o.id]), ...quantita(offerte[o.id], o.depositi) })),
          ...(senzaOfferte && azienda ? { nuova_offerta: { azienda_id: azienda, ...prezzi(nuova), ...quantita(nuova, 0) } } : {}),
        },
      })
    },
    onSuccess: () => {
      avvisa(variante ? "Variant saved" : "Variant added")
      aggiorna(scheda.id)
      onChiudi()
    },
  })
  const togli = useMutation({
    mutationFn: () => api(`${percorsoProdotto}/${variante?.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      avvisa("Variant deleted")
      aggiorna(scheda.id)
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  const errore = salva.error ?? togli.error
  const sceltaAziende = scheda.aziende.length ? scheda.aziende : (aziende.data ?? [])

  return (
    <Modale titolo={variante ? "Edit variant" : "New variant"} sottotitolo={scheda.titolo} onChiudi={onChiudi}>
      <form className="modulo modulo-prodotto" onSubmit={invia}>
        <div className="griglia-due">
          <Campo etichetta="Variant name">
            <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
          </Campo>
          <Campo etichetta="SKU">
            <input required value={sku} onChange={(e) => setSku(e.target.value)} />
          </Campo>
          <Campo etichetta="EAN">
            <input inputMode="numeric" value={ean} onChange={(e) => setEan(e.target.value)} />
          </Campo>
        </div>

        {variante?.offerte.map((o) => (
          <fieldset key={o.id} className="gruppo">
            <legend>{o.azienda.nome}</legend>
            <CampiOfferta valori={offerte[o.id]} onCambia={(valori) => setOfferte({ ...offerte, [o.id]: valori })} conCessione={conCessione} conScorte={conScorte} depositi={o.depositi} />
          </fieldset>
        ))}

        {senzaOfferte ? (
          <fieldset className="gruppo">
            <legend>Company selling it</legend>
            <div className="modulo">
              <Campo etichetta="Company" aiuto="Without a company there is no price or stock">
                <select value={azienda} onChange={(e) => setAzienda(e.target.value)}>
                  <option value="">No company</option>
                  {sceltaAziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </Campo>
              {azienda ? <CampiOfferta valori={nuova} onCambia={setNuova} conCessione={conCessione} conScorte={conScorte} depositi={0} /> : null}
            </div>
          </fieldset>
        ) : null}

        {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null}
        <div className="riga__azioni">
          <button type="submit" className="primario" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save variant"}</button>
          {variante && puo("products", "manage") ? <button type="button" className="pericolo" onClick={() => setElimina(true)}>Delete variant</button> : null}
        </div>
      </form>
      {elimina ? (
        <Conferma
          titolo="Delete this variant?"
          testo={`“${variante?.titolo}” will go, with its offers and stock.`}
          azione="Delete"
          attesa={togli.isPending}
          onConferma={() => togli.mutate()}
          onChiudi={() => setElimina(false)}
        />
      ) : null}
    </Modale>
  )
}
