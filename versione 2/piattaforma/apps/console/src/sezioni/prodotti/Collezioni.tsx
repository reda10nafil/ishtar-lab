import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Layers, Pencil, Plus } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { Link, Navigate, Outlet, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Interruttore, useAvvisi, Vuoto } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro, Pagina, Stato } from "../../ui"
import { FotoProdotto, SchedeProdotti } from "./comuni"
import { useCartaSubito } from "./dati"
import { entraAMolla } from "./griglia"
import { NuovoProdotto } from "./NuovoProdotto"
import type { CartaCollezione as Carta } from "./tipi"

const MASSIMO_COPERTINE = 4
const NOME_NUOVA = "New collection"

/** Sulle carte basta la cifra intera: i centesimi non dicono nulla su un mese di vendite. */
const euroIntero = (valore: number) => euro(Math.round(valore)).replace(/\.00$/, "")

function CartaCollezione({ collezione }: { collezione: Carta }) {
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const client = useQueryClient()
  const subito = useCartaSubito()
  const prodotti = collezione.prodotti
  const visibilita = useMutation({
    mutationFn: (visibile: boolean) => api(`/admin/collections/${collezione.id}`, { corpo: { metadata: { visibile } } }),
    onMutate: (visibile) => subito(collezione.id, { visibile }),
    onSuccess: (_, visibile) => avvisa(visibile ? `${collezione.titolo} is showing on the shop` : `${collezione.titolo} is hidden`),
    onError: segnalaErrore,
    onSettled: () => void client.invalidateQueries({ queryKey: ["collezioni-carte"] }),
  })
  return (
    <article className="collezione vetro">
      <div className="collezione__copertine" aria-hidden="true">
        {prodotti.slice(0, MASSIMO_COPERTINE).map((p) => <FotoProdotto key={p.id} url={p.foto} titolo={p.titolo} tinta={p.tinta} classe="collezione__foto" />)}
        {prodotti.length ? null : <Layers size={30} />}
      </div>
      <div className="collezione__corpo">
        <div className="collezione__testa">
          <h3>{collezione.titolo}</h3>
          <Interruttore acceso={collezione.visibile} etichetta={`${collezione.titolo} visible`} disattivo={!puo("product_collections", "edit")} onCambia={(acceso) => visibilita.mutate(acceso)} />
        </div>
        <p>{collezione.descrizione || "Describe what ties these together"}</p>
        <div className="collezione__piede">
          <span className="collezione__dati">
            <span><b>{numero(prodotti.length)}</b> {prodotti.length === 1 ? "product" : "products"}</span>
            <span><b>{euroIntero(collezione.incasso)}</b> · 30 days</span>
          </span>
          <Link className="pulsante-collegamento" to={`/prodotti/collezioni/${collezione.id}`} aria-label={`Edit ${collezione.titolo}`}><Pencil size={16} aria-hidden="true" /> Edit</Link>
        </div>
      </div>
    </article>
  )
}

export default function Collezioni() {
  const { puo, pronto } = usePermessi()
  const naviga = useNavigate()
  const [parametri, setParametri] = useSearchParams()
  const { segnalaErrore } = useAvvisi()
  const client = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ["collezioni-carte"],
    queryFn: () => api<{ collezioni: Carta[] }>("/admin/catalogo/collezioni"),
    enabled: puo("product_collections", "view"),
  })
  const crea = useMutation({
    // Il nome si cambia subito dopo, nel cassetto: l'indirizzo deve restare unico anche con più collezioni nuove.
    mutationFn: () =>
      api<{ collection: { id: string } }>("/admin/collections", {
        corpo: { title: NOME_NUOVA, handle: `new-collection-${Date.now().toString(36)}`, metadata: { visibile: true } },
      }),
    onSuccess: ({ collection }) => {
      void client.invalidateQueries({ queryKey: ["collezioni-carte"] })
      void client.invalidateQueries({ queryKey: ["collezioni"] })
      naviga(`/prodotti/collezioni/${collection.id}`)
    },
    onError: segnalaErrore,
  })
  const griglia = useRef<HTMLDivElement>(null)
  const caricate = Boolean(data)
  // Le carte arrivano con i dati: la griglia entra allora, una volta sola.
  useLayoutEffect(() => {
    if (caricate) entraAMolla(griglia.current)
  }, [caricate])
  const puoCreare = puo("product_collections", "edit")
  const puoAggiungereProdotti = puo("products", "edit")

  if (pronto && !puo("product_collections", "view")) return <Navigate to="/prodotti/catalogo" replace />
  const elenco = data?.collezioni ?? []
  return (
    <Pagina
      titolo="Products"
      sottotitolo="How the online shop is grouped."
      azioni={puoAggiungereProdotti ? <button type="button" className="primario azione-testa" onClick={() => setParametri({ nuovo: "1" }, { replace: true })}><Plus size={18} aria-hidden="true" /> New product</button> : undefined}
    >
      <SchedeProdotti />
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data && !elenco.length && !puoCreare ? <Vuoto icona={Layers} titolo="No collections yet" testo="Collections group products from different companies." /> : null}
      <div className="griglia-collezioni" data-fermo="" ref={griglia}>
        {elenco.map((c) => <CartaCollezione key={c.id} collezione={c} />)}
        {data && puoCreare ? (
          <button type="button" className="collezione-nuova" disabled={crea.isPending} onClick={() => crea.mutate()}>
            <Plus size={30} aria-hidden="true" />
            <b>{NOME_NUOVA}</b>
            <small>Group products for the online shop</small>
          </button>
        ) : null}
      </div>
      {parametri.get("nuovo") && puoAggiungereProdotti ? <NuovoProdotto onChiudi={() => setParametri({}, { replace: true })} /> : null}
      <Outlet />
    </Pagina>
  )
}
