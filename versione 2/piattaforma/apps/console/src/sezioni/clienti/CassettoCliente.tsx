import { useMutation, useQuery } from "@tanstack/react-query"
import { Download, MapPin, Pencil, Plus, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { STATI_ORDINE, numero, stato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Etichetta, dataBreve, dataOra, euro } from "../../ui"
import { iniziali, lineaIndirizzo, nomeCompleto, quandoBreve, tonoIniziali, useAggiornaClienti } from "./dati"
import ModuloCliente from "./ModuloCliente"
import ModuloIndirizzo from "./ModuloIndirizzo"
import type { Gruppo, Indirizzo, SchedaCliente as Dati } from "./tipi"

const CHIUSURA = 300
const TRENTA_GIORNI = 30 * 86_400_000

/** Tutti i dati del cliente in un file: serve quando una persona li chiede. */
function esportaScheda({ cliente: c, indirizzi, ordini }: Dati) {
  const dati: [string, string, string | number | null][] = [
    ["Details", "First name", c.nome],
    ["Details", "Last name", c.cognome],
    ["Details", "Email", c.email],
    ["Details", "Phone", c.telefono],
    ["Details", "Company name", c.azienda],
    ["Details", "Town", c.citta],
    ["Details", "Customer since", dataBreve(c.creato_il)],
    ["Details", "Newsletter", c.newsletter ? "Yes" : "No"],
    ["Details", "Choice recorded", c.newsletter_data ? dataOra(c.newsletter_data) : null],
    ["Details", "Stockist", c.rivenditore ? "Yes" : "No"],
    ["Details", "Tags", c.tag.join(", ")],
    ["Details", "Groups", c.gruppi.map((g) => g.nome).join(", ")],
    ["Details", "Notes", c.note],
    ...indirizzi.map((i, n): [string, string, string] => [`Address ${n + 1}`, i.etichetta ?? "Address", `${[i.nome, i.cognome].filter(Boolean).join(" ")} ${lineaIndirizzo(i)}`.trim()]),
    ...ordini.map((o): [string, string, string] => [`Order ${o.numero ?? o.id}`, dataBreve(o.creato_il), `${stato(STATI_ORDINE, o.bozza ? "draft" : o.stato).testo} · ${euro(o.totale)}`]),
  ]
  scaricaCsv(`customer-${c.id}`, ["Section", "Field", "Value"], dati)
}

function Gruppi({ id, attuali, modificabile }: { id: string; attuali: Dati["cliente"]["gruppi"]; modificabile: boolean }) {
  const aggiorna = useAggiornaClienti()
  const { segnalaErrore } = useAvvisi()
  const [scelto, setScelto] = useState("")
  const elenco = useQuery({ queryKey: ["clienti", "gruppi"], queryFn: () => api<{ gruppi: Gruppo[] }>("/admin/clienti/gruppi"), enabled: modificabile })
  const cambia = useMutation({
    mutationFn: ({ gruppo, azione }: { gruppo: string; azione: "aggiungi" | "togli" }) => api(`/admin/clienti/gruppi/${gruppo}/clienti`, { corpo: { [azione]: [id] } }),
    onSuccess: () => {
      void aggiorna()
      setScelto("")
    },
    onError: segnalaErrore,
  })
  const liberi = elenco.data?.gruppi.filter((g) => !attuali.some((a) => a.id === g.id)) ?? []
  return (
    <>
      {attuali.length ? (
        <ul className="cli-etichette-lista">
          {attuali.map((g) => (
            <li key={g.id}>
              <Link to={`/clienti/persone?gruppo=${g.id}`}>{g.nome}</Link>
              {modificabile ? (
                <button type="button" aria-label={`Remove from group ${g.nome}`} onClick={() => cambia.mutate({ gruppo: g.id, azione: "togli" })}><X size={13} aria-hidden="true" /></button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="cli-nota">Not in any group.</p>}
      {modificabile && liberi.length ? (
        <div className="cli-riga-modulo">
          <select aria-label="Group to add" value={scelto} onChange={(e) => setScelto(e.target.value)}>
            <option value="">Choose a group</option>
            {liberi.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <button type="button" className="cli-piccolo" disabled={!scelto || cambia.isPending} onClick={() => cambia.mutate({ gruppo: scelto, azione: "aggiungi" })}>Add to group</button>
        </div>
      ) : null}
    </>
  )
}

/** La scheda del cliente scorre sopra l'elenco, e l'indirizzo resta `/clienti/persone/:id`. */
export default function CassettoCliente({ id, onChiudi }: { id: string; onChiudi: () => void }) {
  const { puo } = usePermessi()
  const aggiorna = useAggiornaClienti()
  const { avvisa, segnalaErrore } = useAvvisi()
  const pannello = useRef<HTMLDivElement>(null)
  const [uscita, setUscita] = useState(false)
  const [modifica, setModifica] = useState(false)
  const [elimina, setElimina] = useState(false)
  const [indirizzo, setIndirizzo] = useState<Indirizzo | "nuovo" | null>(null)
  const [daTogliere, setDaTogliere] = useState<Indirizzo | null>(null)
  const [nuovoTag, setNuovoTag] = useState("")
  const [nota, setNota] = useState("")

  const query = useQuery({ queryKey: ["clienti", "scheda", id], queryFn: () => api<Dati>(`/admin/clienti/${id}`) })
  const dati = query.data
  const cliente = dati?.cliente
  const puoModificare = puo("customers", "edit")
  const sopra = modifica || elimina || indirizzo !== null || daTogliere !== null

  useEffect(() => setNota(cliente?.note ?? ""), [cliente?.note])

  const chiudi = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onChiudi()
    setUscita(true)
    window.setTimeout(onChiudi, CHIUSURA)
  }, [onChiudi])

  useEffect(() => {
    pannello.current?.focus()
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".velo")) chiudi()
    }
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [chiudi])

  const salva = useMutation({
    mutationFn: (corpo: { newsletter?: boolean; tag?: string[]; note?: string }) => api(`/admin/clienti/${id}`, { corpo }),
    onSuccess: (_, corpo) => {
      void aggiorna()
      if (corpo.newsletter !== undefined) avvisa(`${cliente?.nome ?? "Customer"} ${corpo.newsletter ? "subscribed" : "unsubscribed"}`)
    },
    onError: segnalaErrore,
  })

  const cancella = useMutation({
    mutationFn: () => api(`/admin/clienti/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Customer deleted")
      setElimina(false)
      onChiudi()
    },
    onError: (errore) => {
      setElimina(false)
      segnalaErrore(errore)
    },
  })

  const togliIndirizzo = useMutation({
    mutationFn: (voce: Indirizzo) => api(`/admin/clienti/${id}/indirizzi/${voce.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      setDaTogliere(null)
      avvisa("Address deleted")
    },
    onError: (errore) => {
      setDaTogliere(null)
      segnalaErrore(errore)
    },
  })

  const aggiungiTag = (e: FormEvent) => {
    e.preventDefault()
    const tag = nuovoTag.trim()
    if (!tag || !cliente || cliente.tag.includes(tag)) return
    salva.mutate({ tag: [...cliente.tag, tag] })
    setNuovoTag("")
  }

  const recenti = dati?.ordini.filter((o) => Date.now() - new Date(o.creato_il).getTime() <= TRENTA_GIORNI) ?? []
  const media = cliente?.ordini ? cliente.speso / cliente.ordini : 0
  const profilo = cliente?.abituale ? "Regular" : cliente?.nuovo ? "New" : "Customer"

  return createPortal(
    <>
      <div className={`cli-velo${uscita ? " cli-velo--esce" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && !sopra && chiudi()}>
        <div className={`cli-cassetto${uscita ? " cli-cassetto--esce" : ""}`} role="dialog" aria-modal="true" aria-label={cliente ? nomeCompleto(cliente) : "Customer"} tabIndex={-1} ref={pannello}>
          <header className="cli-cassetto__testa">
            <div>
              <h2>{cliente ? nomeCompleto(cliente) : "Customer"}</h2>
              {cliente ? <p>{[cliente.citta, `customer since ${dataBreve(cliente.creato_il)}`].filter(Boolean).join(" · ")}</p> : null}
            </div>
            <button type="button" className="icona-pulsante" aria-label="Close" onClick={chiudi}><X size={20} aria-hidden="true" /></button>
          </header>
          <div className="cli-cassetto__corpo">
            {query.isLoading ? <p className="avviso-stato">Loading...</p> : null}
            {query.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{(query.error as Error).message}</p> : null}
            {dati && cliente ? (
              <>
                <div className="cli-profilo">
                  <span className={`cli-iniziali cli-iniziali--grande cli-iniziali--${tonoIniziali(cliente.id)}`} aria-hidden="true">{iniziali(cliente)}</span>
                  <div>
                    <b>{nomeCompleto(cliente)}</b>
                    <small>{[cliente.email ?? "No email", cliente.telefono].filter(Boolean).join(" · ")}</small>
                    <span className="cli-etichette">
                      <Etichetta tono={cliente.abituale ? "ok" : "neutro"}>{profilo}</Etichetta>
                      {cliente.rivenditore ? <Etichetta tono="neutro">Stockist</Etichetta> : null}
                      {cliente.tag.map((t) => <Etichetta key={t} tono="neutro">{t}</Etichetta>)}
                    </span>
                  </div>
                </div>
                <div className="cli-cifre">
                  <div><small>Orders</small><b>{numero(cliente.ordini)}</b></div>
                  <div><small>Spent</small><b>{euro(cliente.speso)}</b></div>
                  <div><small>Average</small><b>{euro(media)}</b></div>
                </div>
                <div className="cli-scelta">
                  <span>
                    <strong>Newsletter</strong>
                    <small>{cliente.newsletter ? "Subscribed: receives campaigns and news" : "Not subscribed: no marketing emails"}</small>
                  </span>
                  <Interruttore acceso={cliente.newsletter} etichetta="Newsletter" disattivo={!puoModificare || salva.isPending} onCambia={(newsletter) => salva.mutate({ newsletter })} />
                </div>

                <h3 className="cli-sezione">Tags</h3>
                {cliente.tag.length ? (
                  <div className="cli-tag-lista">
                    {cliente.tag.map((t) => (
                      <button key={t} type="button" className="cli-tag" aria-label={`Remove tag ${t}`} disabled={!puoModificare} onClick={() => salva.mutate({ tag: cliente.tag.filter((x) => x !== t) })}>
                        {t} <X size={12} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {puoModificare ? (
                  <form className="cli-riga-modulo" onSubmit={aggiungiTag}>
                    <input aria-label="New tag" placeholder="e.g. Loyal, Wholesale, Local" maxLength={40} value={nuovoTag} onChange={(e) => setNuovoTag(e.target.value)} />
                    <button type="submit" className="cli-piccolo"><Plus size={18} aria-hidden="true" /> Tag</button>
                  </form>
                ) : null}

                <h3 className="cli-sezione">Private note</h3>
                <textarea
                  rows={4}
                  maxLength={2000}
                  aria-label="Private note"
                  placeholder="Only your team can read this"
                  disabled={!puoModificare}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onBlur={() => nota !== (cliente.note ?? "") && salva.mutate({ note: nota })}
                />

                <h3 className="cli-sezione">Orders · last 30 days</h3>
                {recenti.length ? (
                  <ul className="cli-ordini">
                    {recenti.map((o) => {
                      const s = stato(STATI_ORDINE, o.bozza ? "draft" : o.stato)
                      return (
                        <li key={o.id}>
                          <Link to={`/ordini/tutti/${o.id}`}>
                            <span><b>{o.numero ? `#${o.numero}` : "Order"}</b><small>{quandoBreve(o.creato_il)} · {numero(o.articoli)} {o.articoli === 1 ? "item" : "items"}</small></span>
                            <Etichetta tono={s.tono}>{s.testo}</Etichetta>
                            <b>{euro(o.totale)}</b>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : <p className="cli-nota">No orders in the last 30 days.</p>}

                <h3 className="cli-sezione">Addresses</h3>
                {dati.indirizzi.length ? (
                  <ul className="cli-indirizzi">
                    {dati.indirizzi.map((i) => (
                      <li key={i.id}>
                        <MapPin size={15} aria-hidden="true" />
                        <span>
                          <b>{i.etichetta || [i.nome, i.cognome].filter(Boolean).join(" ") || "Address"}</b>
                          <small>{lineaIndirizzo(i)}{i.predefinito_spedizione ? " · Delivery" : ""}{i.predefinito_fatturazione ? " · Billing" : ""}</small>
                        </span>
                        {puoModificare ? (
                          <>
                            <button type="button" className="cli-piccolo" aria-label={`Edit address ${i.etichetta ?? i.citta ?? ""}`.trim()} onClick={() => setIndirizzo(i)}>Edit</button>
                            <button type="button" className="cli-piccolo" aria-label={`Delete address ${i.etichetta ?? i.citta ?? ""}`.trim()} onClick={() => setDaTogliere(i)}>Delete</button>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="cli-nota">No addresses yet.</p>}
                {puoModificare ? <button type="button" className="cli-piccolo cli-allinea" onClick={() => setIndirizzo("nuovo")}><Plus size={16} aria-hidden="true" /> Add address</button> : null}

                {puo("customer_groups", "view") ? (
                  <>
                    <h3 className="cli-sezione">Groups</h3>
                    <Gruppi id={id} attuali={cliente.gruppi} modificabile={puo("customer_groups", "edit")} />
                  </>
                ) : null}

                <div className="cli-azioni-scheda">
                  {puoModificare ? <button type="button" className="cli-piccolo" onClick={() => setModifica(true)}><Pencil size={15} aria-hidden="true" /> Edit</button> : null}
                  <button type="button" className="cli-piccolo" onClick={() => esportaScheda(dati)}><Download size={15} aria-hidden="true" /> Export data</button>
                  {puo("customers", "manage") ? <button type="button" className="cli-piccolo" onClick={() => setElimina(true)}><Trash2 size={15} aria-hidden="true" /> Delete customer</button> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {modifica && cliente ? <ModuloCliente cliente={cliente} onChiudi={() => setModifica(false)} /> : null}
      {indirizzo ? <ModuloIndirizzo clienteId={id} indirizzo={indirizzo === "nuovo" ? undefined : indirizzo} onChiudi={() => setIndirizzo(null)} /> : null}
      {elimina && cliente ? (
        <Conferma
          titolo={`Delete ${nomeCompleto(cliente)}?`}
          testo="Their details, addresses and notes will be removed. Past orders stay on record."
          azione="Yes, delete customer"
          attesa={cancella.isPending}
          onConferma={() => cancella.mutate()}
          onChiudi={() => setElimina(false)}
        />
      ) : null}
      {daTogliere ? (
        <Conferma
          titolo="Delete this address?"
          testo={lineaIndirizzo(daTogliere)}
          azione="Yes, delete address"
          attesa={togliIndirizzo.isPending}
          onConferma={() => togliIndirizzo.mutate(daTogliere)}
          onChiudi={() => setDaTogliere(null)}
        />
      ) : null}
    </>,
    document.body
  )
}
