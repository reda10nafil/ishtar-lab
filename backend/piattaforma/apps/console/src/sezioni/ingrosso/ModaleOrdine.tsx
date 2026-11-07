import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useEffect, useId, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { Campo, Modale, Stato, euro } from "../../ui"
import { useRitardato } from "../sconti/useRitardato"
import { condizioni, minimo, numeroDa } from "./testi"
import type { RequisitiOrdine, Trattativa, Variante } from "./tipi"

type Riga = { chiave: number; variante_id: string | null; titolo: string; quantita: string; prezzo: string }

const rigaVuota = (chiave: number): Riga => ({ chiave, variante_id: null, titolo: "", quantita: "1", prezzo: "" })
const arrotonda = (valore: number) => Math.round(valore * 100) / 100

function RigaOrdine({ riga, sconto, solaRiga, onCambia, onTogli }: { riga: Riga; sconto: number | null; solaRiga: boolean; onCambia: (riga: Riga) => void; onTogli: () => void }) {
  const elenco = useId()
  const cerca = useRitardato(riga.titolo)
  const articoli = useQuery({
    queryKey: ["ingrosso", "varianti", cerca],
    queryFn: () => api<{ varianti: Variante[] }>(`/admin/ingrosso/varianti?q=${encodeURIComponent(cerca)}`),
    enabled: cerca.trim().length >= 2 && !riga.variante_id,
  })

  /** Scegliendo un articolo del catalogo il prezzo parte dal listino, meno lo sconto del rivenditore. */
  const scrivi = (titolo: string) => {
    const scelta = articoli.data?.varianti.find((v) => v.titolo === titolo)
    if (!scelta) return onCambia({ ...riga, titolo, variante_id: null })
    const prezzo = scelta.prezzo === null ? riga.prezzo : String(arrotonda(scelta.prezzo * (1 - (sconto ?? 0) / 100)))
    return onCambia({ ...riga, titolo, variante_id: scelta.id, prezzo })
  }

  return (
    <div className="ing-riga-ordine">
      <Campo etichetta="Item" aiuto={riga.variante_id ? "From the catalogue" : "From the catalogue or free text"}>
        <input required list={elenco} maxLength={200} value={riga.titolo} onChange={(e) => scrivi(e.target.value)} />
        <datalist id={elenco}>{articoli.data?.varianti.map((v) => <option key={v.id} value={v.titolo} />)}</datalist>
      </Campo>
      <Campo etichetta="Quantity">
        <input type="number" required min="1" step="1" inputMode="numeric" value={riga.quantita} onChange={(e) => onCambia({ ...riga, quantita: e.target.value })} />
      </Campo>
      <Campo etichetta="Unit price">
        <input type="number" required min="0" step="0.01" inputMode="decimal" value={riga.prezzo} onChange={(e) => onCambia({ ...riga, prezzo: e.target.value })} />
      </Campo>
      <button type="button" className="icona-pulsante pericolo" aria-label="Remove line" title="Remove line" disabled={solaRiga} onClick={onTogli}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ModaleOrdine({ trattativa, onChiudi }: { trattativa: Trattativa; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [righe, setRighe] = useState<Riga[]>([rigaVuota(1)])
  const [regione, setRegione] = useState("")
  const [canale, setCanale] = useState("")

  const percorso = `/admin/ingrosso/trattative/${trattativa.id}/ordine`
  const requisiti = useQuery({ queryKey: ["ingrosso", "ordine", trattativa.id], queryFn: () => api<RequisitiOrdine>(percorso) })
  const dati = requisiti.data

  useEffect(() => {
    if (!dati) return
    setRegione((attuale) => attuale || (dati.regioni.find((r) => r.valuta === "eur") ?? dati.regioni[0])?.id || "")
    setCanale((attuale) => attuale || dati.canali[0]?.id || "")
  }, [dati])

  const totale = righe.reduce((somma, r) => somma + (numeroDa(r.quantita) ?? 0) * (numeroDa(r.prezzo) ?? 0), 0)
  const sottoMinimo = Boolean(dati?.condizioni.ordine_minimo && totale > 0 && totale < dati.condizioni.ordine_minimo)

  const crea = useMutation({
    mutationFn: () =>
      api(percorso, {
        corpo: {
          regione_id: regione,
          canale_id: canale,
          righe: righe.map((r) => ({ variante_id: r.variante_id, titolo: r.titolo, quantita: numeroDa(r.quantita), prezzo_unitario: numeroDa(r.prezzo) })),
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Draft order created")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }

  if (!dati) {
    return (
      <Modale titolo="Create draft order" onChiudi={onChiudi}>
        <Stato caricamento={requisiti.isLoading} errore={requisiti.error} vuoto={false} testoVuoto="" />
      </Modale>
    )
  }

  const { condizioni: patti } = dati
  const sconto = patti.condizione === "sconto" ? patti.sconto_percentuale : null

  return (
    <Modale titolo="Create draft order" sottotitolo={`${trattativa.titolo}, ${trattativa.rivenditore.nome}`} onChiudi={onChiudi}>
      {dati.mancanti.length ? (
        <div className="avviso-stato avviso-stato--errore ing-mancanti" role="alert">
          <strong>The draft can't be created yet:</strong>
          <ul>{dati.mancanti.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul>
          <Link to={`/ingrosso?apri=${trattativa.rivenditore.id}`}>Open the stockist's details</Link>
        </div>
      ) : (
        <form className="modulo" onSubmit={invia}>
          <p className="avviso-stato">
            {condizioni(patti)}. Payment: {patti.pagamento ?? "to agree"}. Minimum order: {minimo(patti.ordine_minimo)}.
          </p>
          {dati.avvisi.map((avviso) => <p key={avviso} className="avviso-stato avviso-stato--attesa">{avviso}</p>)}
          {dati.regioni.length > 1 || dati.canali.length > 1 ? (
            <div className="griglia-due ing-griglia">
              <Campo etichetta="Sales region">
                <select required value={regione} onChange={(e) => setRegione(e.target.value)}>
                  {dati.regioni.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </Campo>
              <Campo etichetta="Sales channel">
                <select required value={canale} onChange={(e) => setCanale(e.target.value)}>
                  {dati.canali.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
            </div>
          ) : null}

          {righe.map((riga) => (
            <RigaOrdine
              key={riga.chiave}
              riga={riga}
              sconto={sconto}
              solaRiga={righe.length === 1}
              onCambia={(nuova) => setRighe(righe.map((r) => (r.chiave === riga.chiave ? nuova : r)))}
              onTogli={() => setRighe(righe.filter((r) => r.chiave !== riga.chiave))}
            />
          ))}
          <div className="riga__azioni">
            <button type="button" onClick={() => setRighe([...righe, rigaVuota(Math.max(...righe.map((r) => r.chiave)) + 1)])}>
              <Plus size={16} aria-hidden="true" /> Add a line
            </button>
          </div>

          <div className="ing-totale"><span>Goods total</span><strong>{euro(totale)}</strong></div>
          {sottoMinimo ? <p className="avviso-stato avviso-stato--attesa">This is below the agreed minimum order of {minimo(patti.ordine_minimo)}: you can still create the draft.</p> : null}
          {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
          <div className="riga__azioni ing-piede">
            <span className="spazio" />
            <button type="button" onClick={onChiudi}>Cancel</button>
            <button className="primario" type="submit" disabled={crea.isPending}>{crea.isPending ? "Creating..." : "Create draft order"}</button>
          </div>
        </form>
      )}
    </Modale>
  )
}
