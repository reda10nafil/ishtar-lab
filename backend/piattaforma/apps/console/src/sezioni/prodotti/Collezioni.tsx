import { useMutation } from "@tanstack/react-query"
import { Layers, Pencil, Plus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Modale, Pagina, Stato } from "../../ui"
import { FotoProdotto, SchedeProdotti } from "./comuni"
import { erroreCollezione, useAggiornaCatalogo, useCollezioni } from "./dati"
import type { Collezione } from "./tipi"

const MASSIMO_COPERTINE = 4

function NuovaCollezione({ onChiudi }: { onChiudi: () => void }) {
  const naviga = useNavigate()
  const { avvisa } = useAvvisi()
  const aggiorna = useAggiornaCatalogo()
  const [titolo, setTitolo] = useState("")
  const [descrizione, setDescrizione] = useState("")
  const crea = useMutation({
    mutationFn: () => api<{ collection: Collezione }>("/admin/collections", { corpo: { title: titolo.trim(), metadata: { descrizione: descrizione.trim() || null } } }),
    onSuccess: ({ collection }) => {
      avvisa("Collection created")
      aggiorna()
      naviga(`/prodotti/collezioni/${collection.id}`)
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New collection" sottotitolo="Group products you want to show together." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Collection name">
          <input required value={titolo} onChange={(e) => setTitolo(e.target.value)} />
        </Campo>
        <Campo etichetta="Short description">
          <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{erroreCollezione(crea.error)}</p> : null}
        <button type="submit" className="primario" disabled={crea.isPending}>{crea.isPending ? "Creating..." : "Create collection"}</button>
      </form>
    </Modale>
  )
}

function CartaCollezione({ collezione }: { collezione: Collezione }) {
  const prodotti = collezione.products ?? []
  return (
    <article className="collezione vetro">
      <div className="collezione__copertine" aria-hidden="true">
        {prodotti.slice(0, MASSIMO_COPERTINE).map((p) => <FotoProdotto key={p.id} url={p.thumbnail} titolo={p.title} classe="collezione__foto" />)}
        {prodotti.length ? null : <Layers size={30} />}
      </div>
      <div className="collezione__corpo">
        <h2>{collezione.title}</h2>
        <p>{collezione.metadata?.descrizione || "No description yet."}</p>
        <div className="collezione__piede">
          <span><strong>{numero(prodotti.length)}</strong> {prodotti.length === 1 ? "product" : "products"}</span>
          <Link className="pulsante-collegamento" to={`/prodotti/collezioni/${collezione.id}`} aria-label={`Edit ${collezione.title}`}><Pencil size={15} aria-hidden="true" /> Edit</Link>
        </div>
      </div>
    </article>
  )
}

export default function Collezioni() {
  const { puo, pronto } = usePermessi()
  const { data, isLoading, error } = useCollezioni()
  const [nuova, setNuova] = useState(false)
  const puoCreare = puo("product_collections", "edit")

  if (pronto && !puo("product_collections", "view")) return <Navigate to="/prodotti/catalogo" replace />
  const elenco = data ?? []
  return (
    <Pagina titolo="Products" sottotitolo="How products are grouped for the online shop.">
      <SchedeProdotti />
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data && !elenco.length && !puoCreare ? <Vuoto icona={Layers} titolo="No collections yet" testo="Collections group products from different companies, by season or theme." /> : null}
      <div className="griglia-collezioni">
        {elenco.map((c) => <CartaCollezione key={c.id} collezione={c} />)}
        {data && puoCreare ? (
          <button type="button" className="collezione-nuova" onClick={() => setNuova(true)}>
            <Plus size={26} aria-hidden="true" />
            <strong>New collection</strong>
            <span>Group products for the online shop</span>
          </button>
        ) : null}
      </div>
      {nuova ? <NuovaCollezione onChiudi={() => setNuova(false)} /> : null}
      <Outlet />
    </Pagina>
  )
}
