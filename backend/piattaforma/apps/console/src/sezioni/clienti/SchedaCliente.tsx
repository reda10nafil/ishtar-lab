import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Download, MapPin, Pencil, ShoppingBag, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { scaricaCsv } from "../../esporta"
import { STATI_ORDINE, numero, stato } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Etichetta, Pagina, Stato, dataBreve, dataOra, euro } from "../../ui"
import { lineaIndirizzo, nomeCompleto, nomePaese, useAggiornaClienti } from "./dati"
import ModuloCliente from "./ModuloCliente"
import ModuloIndirizzo from "./ModuloIndirizzo"
import type { Gruppo, Indirizzo, OrdineCliente, SchedaCliente as Dati } from "./tipi"

const colonneOrdini: Colonna<OrdineCliente>[] = [
  { titolo: "Order", cella: (o) => (o.numero ? `#${o.numero}` : "–") },
  { titolo: "Date", cella: (o) => dataOra(o.creato_il) },
  {
    titolo: "Status",
    cella: (o) => {
      const s = stato(STATI_ORDINE, o.bozza ? "draft" : o.stato)
      return <Etichetta tono={s.tono}>{s.testo}</Etichetta>
    },
  },
  { titolo: "Total", destra: true, cella: (o) => euro(o.totale) },
]

/** Tutti i dati del cliente in un file: serve quando una persona li chiede. */
function esportaScheda({ cliente: c, indirizzi, ordini }: Dati) {
  const dati: [string, string, string | number | null][] = [
    ["Details", "First name", c.nome],
    ["Details", "Last name", c.cognome],
    ["Details", "Email", c.email],
    ["Details", "Phone", c.telefono],
    ["Details", "Company name", c.azienda],
    ["Details", "Customer since", dataBreve(c.creato_il)],
    ["Details", "Newsletter", c.newsletter ? "Yes" : "No"],
    ["Details", "Choice recorded", c.newsletter_data ? dataOra(c.newsletter_data) : null],
    ["Details", "Stockist", c.rivenditore ? "Yes" : "No"],
    ["Details", "Groups", c.gruppi.map((g) => g.nome).join(", ")],
    ["Details", "Notes", c.note],
    ...indirizzi.map((i, n): [string, string, string] => [`Address ${n + 1}`, i.etichetta ?? "Address", `${[i.nome, i.cognome].filter(Boolean).join(" ")} ${lineaIndirizzo(i)}`.trim()]),
    ...ordini.map((o): [string, string, string] => [`Order ${o.numero ?? o.id}`, dataBreve(o.creato_il), `${stato(STATI_ORDINE, o.bozza ? "draft" : o.stato).testo} · ${euro(o.totale)}`]),
  ]
  scaricaCsv(`customer-${c.id}`, ["Section", "Field", "Value"], dati)
}

function Note({ id, iniziale, modificabile }: { id: string; iniziale: string | null; modificabile: boolean }) {
  const aggiorna = useAggiornaClienti()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [testo, setTesto] = useState(iniziale ?? "")
  useEffect(() => setTesto(iniziale ?? ""), [iniziale])
  const salva = useMutation({
    mutationFn: () => api(`/admin/clienti/${id}`, { corpo: { note: testo } }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Notes saved")
    },
    onError: segnalaErrore,
  })
  if (!modificabile) return <p className="cli-nota">{iniziale ?? "No notes."}</p>
  return (
    <div className="modulo">
      <textarea rows={4} maxLength={2000} aria-label="Notes about this customer" value={testo} onChange={(e) => setTesto(e.target.value)} />
      <div className="riga__azioni">
        <button type="button" disabled={salva.isPending || testo === (iniziale ?? "")} onClick={() => salva.mutate()}>Save notes</button>
      </div>
    </div>
  )
}

function Gruppi({ id, attuali, modificabile }: { id: string; attuali: Dati["cliente"]["gruppi"]; modificabile: boolean }) {
  const aggiorna = useAggiornaClienti()
  const { segnalaErrore } = useAvvisi()
  const [scelto, setScelto] = useState("")
  const elenco = useQuery({
    queryKey: ["clienti", "gruppi"],
    queryFn: () => api<{ gruppi: Gruppo[] }>("/admin/clienti/gruppi"),
    enabled: modificabile,
  })
  const cambia = useMutation({
    mutationFn: ({ gruppo, azione }: { gruppo: string; azione: "aggiungi" | "togli" }) =>
      api(`/admin/clienti/gruppi/${gruppo}/clienti`, { corpo: { [azione]: [id] } }),
    onSuccess: () => {
      void aggiorna()
      setScelto("")
    },
    onError: segnalaErrore,
  })
  const liberi = elenco.data?.gruppi.filter((g) => !attuali.some((a) => a.id === g.id)) ?? []
  return (
    <div className="cli-gruppi">
      {attuali.length ? (
        <ul>
          {attuali.map((g) => (
            <li key={g.id}>
              <Link to={`/clienti/persone?gruppo=${g.id}`}>{g.nome}</Link>
              {modificabile ? (
                <button type="button" className="icona-pulsante" aria-label={`Remove from group ${g.nome}`} onClick={() => cambia.mutate({ gruppo: g.id, azione: "togli" })}>
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cli-nota">Not in any group.</p>
      )}
      {modificabile && liberi.length ? (
        <div className="riga__azioni">
          <select aria-label="Group to add" value={scelto} onChange={(e) => setScelto(e.target.value)}>
            <option value="">Choose a group</option>
            {liberi.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <button type="button" disabled={!scelto || cambia.isPending} onClick={() => cambia.mutate({ gruppo: scelto, azione: "aggiungi" })}>Add to group</button>
        </div>
      ) : null}
    </div>
  )
}

export default function SchedaCliente() {
  const { id = "" } = useParams()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const aggiorna = useAggiornaClienti()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [modifica, setModifica] = useState(false)
  const [elimina, setElimina] = useState(false)
  const [indirizzo, setIndirizzo] = useState<Indirizzo | "nuovo" | null>(null)
  const [daTogliere, setDaTogliere] = useState<Indirizzo | null>(null)

  const query = useQuery({ queryKey: ["clienti", "scheda", id], queryFn: () => api<Dati>(`/admin/clienti/${id}`) })

  const cancella = useMutation({
    mutationFn: () => api(`/admin/clienti/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      avvisa("Customer deleted")
      naviga("/clienti/persone")
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

  const dati = query.data
  const cliente = dati?.cliente
  const puoModificare = puo("customers", "edit")

  return (
    <Pagina
      titolo={cliente ? nomeCompleto(cliente) : "Customer"}
      sottotitolo={cliente?.email ?? "Customer details"}
      azioni={
        <div className="riga__azioni">
          <Link className="cli-collegamento" to="/clienti/persone"><ArrowLeft size={16} aria-hidden="true" /> Back to people</Link>
          {dati ? <button type="button" onClick={() => esportaScheda(dati)}><Download size={16} aria-hidden="true" /> Export data</button> : null}
          {dati && puoModificare ? <button type="button" onClick={() => setModifica(true)}><Pencil size={16} aria-hidden="true" /> Edit</button> : null}
          {dati && puo("customers", "manage") ? <button type="button" onClick={() => setElimina(true)}><Trash2 size={16} aria-hidden="true" /> Delete customer</button> : null}
        </div>
      }
    >
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati && cliente ? (
        <>
          <div className="cli-griglia">
            <Riquadro titolo="Details">
              <dl className="cli-dati">
                <div><dt>Phone</dt><dd>{cliente.telefono ?? "–"}</dd></div>
                <div><dt>Company name</dt><dd>{cliente.azienda ?? "–"}</dd></div>
                <div><dt>Customer since</dt><dd>{dataBreve(cliente.creato_il)}</dd></div>
                <div>
                  <dt>Newsletter</dt>
                  <dd>
                    <Etichetta tono={cliente.newsletter ? "ok" : "neutro"}>{cliente.newsletter ? "Subscribed" : "Not subscribed"}</Etichetta>
                    {cliente.newsletter_data ? <small> since {dataBreve(cliente.newsletter_data)}</small> : null}
                  </dd>
                </div>
                <div><dt>Type</dt><dd>{cliente.rivenditore ? "Stockist" : "Shopper"}</dd></div>
              </dl>
            </Riquadro>
            <Riquadro titolo="Purchases">
              <dl className="cli-dati">
                <div><dt>Orders</dt><dd>{numero(cliente.ordini)}</dd></div>
                <div><dt>Spent</dt><dd>{euro(cliente.speso)}</dd></div>
                <div><dt>Last order</dt><dd>{cliente.ultimo_ordine ? dataBreve(cliente.ultimo_ordine) : "None"}</dd></div>
              </dl>
            </Riquadro>
          </div>
          <Riquadro
            titolo="Addresses"
            azioni={puoModificare ? <button type="button" onClick={() => setIndirizzo("nuovo")}>Add address</button> : undefined}
          >
            {dati.indirizzi.length ? (
              <ul className="elenco">
                {dati.indirizzi.map((i) => (
                  <li key={i.id} className="riga">
                    <div className="riga__testo">
                      <strong>{i.etichetta || [i.nome, i.cognome].filter(Boolean).join(" ") || nomePaese(i.paese) || "Address"}</strong>
                      <small>{lineaIndirizzo(i)}</small>
                      {i.predefinito_spedizione || i.predefinito_fatturazione ? (
                        <span className="cli-etichette">
                          {i.predefinito_spedizione ? <Etichetta tono="neutro">Delivery</Etichetta> : null}
                          {i.predefinito_fatturazione ? <Etichetta tono="neutro">Billing</Etichetta> : null}
                        </span>
                      ) : null}
                    </div>
                    {puoModificare ? (
                      <div className="riga__azioni">
                        <button type="button" aria-label={`Edit address ${i.etichetta ?? i.citta ?? ""}`.trim()} onClick={() => setIndirizzo(i)}>Edit</button>
                        <button type="button" aria-label={`Delete address ${i.etichetta ?? i.citta ?? ""}`.trim()} onClick={() => setDaTogliere(i)}>Delete</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Vuoto icona={MapPin} titolo="No addresses" testo="Add an address to deliver to this customer." />
            )}
          </Riquadro>
          <Riquadro titolo="Orders">
            {dati.ordini.length ? (
              <Tabella etichetta="Customer orders" colonne={colonneOrdini} righe={dati.ordini} chiave={(o) => o.id} onApri={(o) => naviga(`/ordini/tutti/${o.id}`)} />
            ) : (
              <Vuoto icona={ShoppingBag} titolo="No orders yet" testo="This customer's orders will appear here." />
            )}
          </Riquadro>
          <div className="cli-griglia">
            <Riquadro titolo="Notes"><Note id={id} iniziale={cliente.note} modificabile={puoModificare} /></Riquadro>
            {puo("customer_groups", "view") ? (
              <Riquadro titolo="Groups"><Gruppi id={id} attuali={cliente.gruppi} modificabile={puo("customer_groups", "edit")} /></Riquadro>
            ) : null}
          </div>
        </>
      ) : null}
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
    </Pagina>
  )
}
