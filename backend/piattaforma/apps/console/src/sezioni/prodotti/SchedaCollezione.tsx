import { useMutation, useQuery } from "@tanstack/react-query"
import { Layers, PackagePlus, Pencil, Trash2, X } from "lucide-react"
import { useCallback, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, useAvvisi, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale, Stato } from "../../ui"
import { Cassetto, FotoProdotto } from "./comuni"
import { erroreCollezione, useAggiornaCatalogo, useCatalogo } from "./dati"
import type { Collezione } from "./tipi"

const MASSIMO_PRODOTTI = 200

function Modifica({ collezione, onChiudi, onFatto }: { collezione: Collezione; onChiudi: () => void; onFatto: () => void }) {
  const [titolo, setTitolo] = useState(collezione.title)
  const [indirizzo, setIndirizzo] = useState(collezione.handle)
  const [descrizione, setDescrizione] = useState(collezione.metadata?.descrizione ?? "")
  const salva = useMutation({
    mutationFn: () => api(`/admin/collections/${collezione.id}`, { corpo: { title: titolo.trim(), handle: indirizzo.trim(), metadata: { descrizione: descrizione.trim() || null } } }),
    onSuccess: onFatto,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  return (
    <Modale titolo="Edit collection" onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Collection name">
          <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Short description">
          <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <Campo etichetta="Shop address">
          <input required value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
        </Campo>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{erroreCollezione(salva.error)}</p> : null}
        <button type="submit" className="primario" disabled={salva.isPending}>Save changes</button>
      </form>
    </Modale>
  )
}

function AggiungiProdotti({ presenti, onChiudi, onAggiungi, attesa }: { presenti: Set<string>; onChiudi: () => void; onAggiungi: (ids: string[]) => void; attesa: boolean }) {
  const [testo, setTesto] = useState("")
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const { data, isLoading } = useCatalogo({ q: testo.trim(), limit: 50 })
  const disponibili = (data?.prodotti ?? []).filter((p) => !presenti.has(p.id))
  const scegli = (id: string, attivo: boolean) => {
    const nuovi = new Set(scelti)
    if (attivo) nuovi.add(id)
    else nuovi.delete(id)
    setScelti(nuovi)
  }
  return (
    <Modale titolo="Add products" sottotitolo="Choose the products for this collection." onChiudi={onChiudi}>
      <div className="modulo">
        <CampoRicerca valore={testo} etichetta="Search for a product" onCambia={setTesto} />
        <Stato caricamento={isLoading} errore={null} vuoto={!disponibili.length} testoVuoto="No products to add." />
        <ul className="scelta-prodotti">
          {disponibili.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" className="casella" checked={scelti.has(p.id)} onChange={(e) => scegli(p.id, e.target.checked)} />
                <FotoProdotto url={p.foto} titolo={p.titolo} classe="prodotto-riga__foto" />
                <span>{p.titolo}</span>
              </label>
            </li>
          ))}
        </ul>
        <button type="button" className="primario" disabled={!scelti.size || attesa} onClick={() => onAggiungi([...scelti])}>
          {scelti.size ? `Add ${numero(scelti.size)}` : "Add"}
        </button>
      </div>
    </Modale>
  )
}

export default function SchedaCollezione() {
  const { id = "" } = useParams()
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const [finestra, setFinestra] = useState<"modifica" | "aggiungi" | "elimina" | null>(null)

  const collezione = useQuery({
    queryKey: ["collezione", id],
    queryFn: () => api<{ collection: Collezione }>(`/admin/collections/${id}?fields=id,title,handle,created_at,metadata`),
  })
  const prodotti = useCatalogo({ collezione: id, limit: MASSIMO_PRODOTTI, ordine: "nome" })
  const dati = collezione.data?.collection
  const chiudi = useCallback(() => naviga("/prodotti/collezioni"), [naviga])

  const cambia = useMutation({
    mutationFn: (corpo: { add?: string[]; remove?: string[] }) => api(`/admin/collections/${id}/products`, { corpo }),
    onSuccess: () => {
      aggiorna()
      setFinestra(null)
    },
    onError: segnalaErrore,
  })
  const elimina = useMutation({
    mutationFn: () => api(`/admin/collections/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      avvisa("Collection deleted")
      aggiorna()
      chiudi()
    },
    onError: segnalaErrore,
  })

  if (!dati) {
    return (
      <Cassetto titolo="Collection" onChiudi={chiudi}>
        <Stato caricamento={collezione.isLoading} errore={collezione.error} vuoto={false} testoVuoto="" />
      </Cassetto>
    )
  }
  const elenco = prodotti.data?.prodotti ?? []
  const puoModificare = puo("product_collections", "edit")

  return (
    <>
      <Cassetto
        titolo={dati.title}
        sottotitolo={`${numero(prodotti.data?.totale ?? 0)} products in this collection`}
        onChiudi={chiudi}
        bloccato={finestra !== null}
        piede={
          puoModificare ? (
            <>
              <button type="button" className="primario" onClick={() => setFinestra("aggiungi")}><PackagePlus size={17} aria-hidden="true" /> Add products</button>
              <button type="button" onClick={() => setFinestra("modifica")}><Pencil size={16} aria-hidden="true" /> Edit</button>
              {puo("product_collections", "manage") ? <button type="button" className="pericolo" onClick={() => setFinestra("elimina")}><Trash2 size={16} aria-hidden="true" /> Delete</button> : null}
            </>
          ) : undefined
        }
      >
        {dati.metadata?.descrizione ? <p className="scheda-testo">{dati.metadata.descrizione}</p> : null}
        <Stato caricamento={prodotti.isLoading} errore={prodotti.error} vuoto={false} testoVuoto="" />
        {prodotti.data && !elenco.length ? <Vuoto icona={Layers} titolo="This collection is empty" testo="Add the products you want to show together." /> : null}
        <ul className="elenco">
          {elenco.map((p) => (
            <li key={p.id} className="riga vetro">
              <FotoProdotto url={p.foto} titolo={p.titolo} classe="prodotto-riga__foto" />
              <div className="riga__testo">
                <strong><Link to={`/prodotti/catalogo/${p.id}`}>{p.titolo}</Link></strong>
                <small>{p.aziende.map((a) => a.nome).join(", ") || "No company"}</small>
              </div>
              {puoModificare ? (
                <button type="button" className="icona-pulsante" aria-label={`Remove ${p.titolo} from the collection`} disabled={cambia.isPending} onClick={() => cambia.mutate({ remove: [p.id] })}>
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Cassetto>

      {finestra === "aggiungi" ? <AggiungiProdotti presenti={new Set(elenco.map((p) => p.id))} attesa={cambia.isPending} onChiudi={() => setFinestra(null)} onAggiungi={(add) => cambia.mutate({ add })} /> : null}
      {finestra === "modifica" ? (
        <Modifica
          collezione={dati}
          onChiudi={() => setFinestra(null)}
          onFatto={() => {
            avvisa("Changes saved")
            void collezione.refetch()
            aggiorna()
            setFinestra(null)
          }}
        />
      ) : null}
      {finestra === "elimina" ? (
        <Conferma
          titolo="Delete this collection?"
          testo={`“${dati.title}” will go; its products stay in the catalogue.`}
          azione="Delete"
          attesa={elimina.isPending}
          onConferma={() => elimina.mutate()}
          onChiudi={() => setFinestra(null)}
        />
      ) : null}
    </>
  )
}
