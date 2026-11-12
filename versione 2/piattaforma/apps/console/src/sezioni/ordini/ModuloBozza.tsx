import { useQuery } from "@tanstack/react-query"
import { Check, Minus, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { euro } from "../../ui"
import { useAggiorna } from "./dati"
import { Finestra, Mini } from "./Pezzi"
import type { Bozza, DatiIndirizzo, OpzioniBozza } from "./tipi"

export const INDIRIZZO_VUOTO: DatiIndirizzo = { nome: "", via: "", citta: "", cap: "", paese: "it", telefono: "" }

export function CampiIndirizzo({ indirizzo, onCambia }: { indirizzo: DatiIndirizzo; onCambia: (i: DatiIndirizzo) => void }) {
  const campo = (chiave: keyof DatiIndirizzo) => (e: { target: { value: string } }) => onCambia({ ...indirizzo, [chiave]: e.target.value })
  return (
    <>
      <label className="ord-campo"><span>Recipient</span><input required value={indirizzo.nome} onChange={campo("nome")} /></label>
      <label className="ord-campo"><span>Phone</span><input value={indirizzo.telefono} onChange={campo("telefono")} /></label>
      <label className="ord-campo ord-tutta"><span>Street and number</span><input required value={indirizzo.via} onChange={campo("via")} /></label>
      <label className="ord-campo"><span>City</span><input required value={indirizzo.citta} onChange={campo("citta")} /></label>
      <label className="ord-campo"><span>Postcode</span><input required value={indirizzo.cap} onChange={campo("cap")} /></label>
    </>
  )
}

type Linea = { chiave: string; riga?: string; offerta?: string; titolo: string; dettaglio: string; miniatura: string | null; prezzo: number; quantita: number }

export default function ModuloBozza({ bozza, onChiudi, onCreata }: { bozza?: Bozza; onChiudi: () => void; onCreata: (destinazione: string) => void }) {
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiorna()
  const query = useQuery({ queryKey: ["ordini", "opzioni"], queryFn: () => api<OpzioniBozza>("/admin/ordini/bozze/opzioni") })
  const opzioni = query.data
  const [cliente, setCliente] = useState(bozza?.cliente_id ?? "")
  const [email, setEmail] = useState(bozza?.email ?? "")
  const [scelta, setScelta] = useState("")
  const [linee, setLinee] = useState<Linea[]>(() =>
    (bozza?.righe ?? []).map((r) => ({ chiave: r.id, riga: r.id, titolo: r.titolo, dettaglio: `${euro(r.prezzo)} each`, miniatura: r.miniatura, prezzo: r.prezzo, quantita: r.quantita }))
  )
  const [consegna, setConsegna] = useState(bozza?.consegna ?? "")
  const [nota, setNota] = useState(bozza?.nota ?? "")
  const [indirizzo, setIndirizzo] = useState<DatiIndirizzo>({ ...INDIRIZZO_VUOTO, nome: bozza?.cliente ?? "" })
  const [attesa, setAttesa] = useState(false)

  const persona = opzioni?.clienti.find((c) => c.id === cliente)
  const metodo = opzioni?.consegne.find((c) => c.nome === consegna)
  const totale = useMemo(() => linee.reduce((s, l) => s + l.prezzo * l.quantita, 0) + (metodo?.importo ?? 0), [linee, metodo])
  const chiediIndirizzo = !persona?.indirizzo && !bozza?.ha_indirizzo
  const vive = linee.filter((l) => l.quantita > 0)

  useEffect(() => {
    if (bozza && !bozza.consegna) setConsegna("")
  }, [bozza])

  const aggiungi = () => {
    const offerta = opzioni?.offerte.find((o) => o.id === scelta)
    if (!offerta) return
    setLinee((attuali) =>
      attuali.some((l) => l.offerta === offerta.id)
        ? attuali.map((l) => (l.offerta === offerta.id ? { ...l, quantita: l.quantita + 1 } : l))
        : [...attuali, { chiave: offerta.id, offerta: offerta.id, titolo: offerta.titolo, dettaglio: `${[offerta.variante, offerta.azienda].filter(Boolean).join(" · ")} · ${euro(offerta.prezzo)} each`, miniatura: offerta.miniatura, prezzo: offerta.prezzo, quantita: 1 }]
    )
    setScelta("")
  }

  const avvisaCreato = (numero: number) => avvisa(`Order #${numero} for ${(persona?.nome ?? bozza?.cliente ?? (indirizzo.nome || email)).split(" ")[0]} · ${euro(totale)}`)

  const invia = async (conferma: boolean) => {
    setAttesa(true)
    try {
      const scelto = persona?.indirizzo ?? (indirizzo.via ? indirizzo : undefined)
      const consegnaA = scelto ? { ...scelto, telefono: scelto.telefono || undefined } : undefined
      if (bozza) {
        await api(`/admin/ordini/bozze/${bozza.id}/conferma`, {
          corpo: {
            indirizzo: consegnaA,
            cliente_id: persona?.id,
            email: persona?.email ?? (email || undefined),
            righe: linee.filter((l) => l.riga).map((l) => ({ id: l.riga, quantita: l.quantita })),
            aggiunte: vive.filter((l) => l.offerta).map((l) => ({ offerta_id: l.offerta, quantita: l.quantita })),
          },
        })
        avvisaCreato(bozza.numero)
      } else {
        const { id, numero } = await api<{ id: string; numero: number }>("/admin/ordini/bozze", {
          corpo: {
            cliente_id: persona?.id,
            email: persona?.email ?? email,
            indirizzo: consegnaA,
            nota: nota.trim() || undefined,
            consegna: metodo,
            righe: vive.map((l) => ({ offerta_id: l.offerta, quantita: l.quantita })),
            conferma,
          },
        })
        if (conferma) avvisaCreato(numero)
        else avvisa(`D-${numero} saved`)
        onChiudi()
        onCreata(conferma ? `/ordini/tutti/${id}` : "/ordini/bozze")
        void aggiorna()
        return
      }
      onChiudi()
      onCreata(`/ordini/tutti/${bozza.id}`)
      void aggiorna()
    } catch (errore) {
      segnalaErrore(errore)
    } finally {
      setAttesa(false)
    }
  }

  return (
    <Finestra titolo={bozza ? `Convert D-${bozza.numero} to an order` : "New order"} sottotitolo="Phone, email or market orders: each company gets its share to pack." onChiudi={onChiudi}>
      <>
        <form
          className="ord-griglia-modulo"
          onSubmit={(e) => {
            e.preventDefault()
            void invia(true)
          }}
        >
          <label className="ord-campo ord-tutta">
            <span>Customer</span>
            <select value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Choose a customer…</option>
              {opzioni?.clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.email ? ` · ${c.email}` : ""}</option>)}
            </select>
          </label>
          {!persona ? <label className="ord-campo ord-tutta"><span>Email, for a new customer</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label> : null}
          <div className="ord-campo ord-tutta">
            <span>Products</span>
            <div className="ord-aggiungi">
              <select value={scelta} aria-label="Add a product" onChange={(e) => setScelta(e.target.value)}>
                <option value="">Add a product…</option>
                {opzioni?.offerte.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.disponibili !== null && o.disponibili <= 0}>
                    {[o.titolo, o.variante, o.azienda].filter(Boolean).join(" · ")} · {euro(o.prezzo)}{o.disponibili !== null && o.disponibili <= 0 ? " · out of stock" : ""}
                  </option>
                ))}
              </select>
              <button type="button" className="ord-btn" disabled={!scelta} onClick={aggiungi}><Plus size={18} aria-hidden="true" /> Add</button>
            </div>
            {vive.length ? (
              <div className="ord-righe ord-righe--modulo">
                {linee.filter((l) => l.quantita > 0).map((l) => (
                  <div key={l.chiave} className="ord-riga ord-riga--s">
                    <Mini url={l.miniatura} titolo={l.titolo} />
                    <span className="ord-riga__testo"><b>{l.titolo}</b><small>{l.dettaglio}</small></span>
                    <span className="ord-passetti">
                      <button type="button" className="icona-pulsante ord-icona" aria-label={`One fewer ${l.titolo}`} onClick={() => setLinee((attuali) => attuali.map((x) => (x.chiave === l.chiave ? { ...x, quantita: x.quantita - 1 } : x)))}><Minus size={16} aria-hidden="true" /></button>
                      <span>{l.quantita}</span>
                      <button type="button" className="icona-pulsante ord-icona" aria-label={`One more ${l.titolo}`} onClick={() => setLinee((attuali) => attuali.map((x) => (x.chiave === l.chiave ? { ...x, quantita: x.quantita + 1 } : x)))}><Plus size={16} aria-hidden="true" /></button>
                    </span>
                    <b className="ord-importo">{euro(l.prezzo * l.quantita)}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {chiediIndirizzo ? <CampiIndirizzo indirizzo={indirizzo} onCambia={setIndirizzo} /> : null}
          <label className="ord-campo">
            <span>Delivery</span>
            <select value={consegna} onChange={(e) => setConsegna(e.target.value)}>
              <option value="">No delivery charge</option>
              {opzioni?.consegne.map((c) => <option key={c.nome} value={c.nome}>{c.nome} · {euro(c.importo)}</option>)}
            </select>
          </label>
          <div className="ord-campo">
            <span>Total</span>
            <div className="ord-totale-modulo">{euro(totale)}</div>
          </div>
          <label className="ord-campo ord-tutta"><span>Note</span><input value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /></label>
          <div className="ord-piede-modulo ord-tutta">
            <button type="button" className="ord-btn" onClick={onChiudi}>Cancel</button>
            {bozza ? null : <button type="button" className="ord-btn" disabled={attesa || !vive.length} onClick={() => void invia(false)}>Save draft</button>}
            <button type="submit" className="ord-btn ord-btn--primario" disabled={attesa || !vive.length}><Check size={18} aria-hidden="true" /> Create order</button>
          </div>
        </form>
      </>
    </Finestra>
  )
}
