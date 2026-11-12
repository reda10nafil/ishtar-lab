import { useQuery } from "@tanstack/react-query"
import { Download, Plus } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Schede } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { useSessione } from "../../sessione"
import { Pagina } from "../../ui"
import ModuloBozza from "./ModuloBozza"
import "./ordini.css"
import type { ElencoCoda, Riepilogo } from "./tipi"

/** Stessa testata e stesse schede per Orders e Fulfilment: sono una sezione sola. */
export function Guscio({ children, sottotitolo, esporta }: { children: ReactNode; sottotitolo?: string; esporta?: { current: (() => void) | null } }) {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const { pathname } = useLocation()
  const [parametri, setParametri] = useSearchParams()
  const admin = sessione?.tipo === "admin"
  const conteggi = useQuery({ queryKey: ["ordini", "riepilogo"], queryFn: () => api<Riepilogo>("/admin/ordini/riepilogo"), enabled: admin })
  const coda = useQuery({ queryKey: ["ordini", "coda", "aperte"], queryFn: () => api<ElencoCoda>("/vendor/evasioni?limit=1"), enabled: !admin && puo("evasioni", "view") })
  const puoCreare = admin && puo("orders", "edit")
  const nuovo = parametri.get("nuovo") === "1"

  const schede = admin
    ? [
        { a: "/ordini/tutti", etichetta: "All orders" },
        { a: "/ordini/bozze", etichetta: "Drafts", conteggio: conteggi.data?.bozze },
        { a: "/ordini/resi", etichetta: "Returns", conteggio: conteggi.data?.resi },
        ...(puo("evasioni", "view") ? [{ a: "/evasioni", etichetta: "Fulfilment", conteggio: conteggi.data?.evasioni }] : []),
      ]
    : [
        { a: "/ordini/tutti", etichetta: "All orders" },
        ...(puo("evasioni", "view") ? [{ a: "/evasioni", etichetta: "Fulfilment", conteggio: coda.data?.aperte }] : []),
      ]

  const inTutti = pathname.startsWith("/ordini/tutti")
  const testoPredefinito = admin
    ? pathname.startsWith("/ordini/bozze")
      ? "Quotes and phone orders that are waiting to be confirmed."
      : pathname.startsWith("/ordini/resi")
        ? "Every return, from the first request to the refund."
        : pathname.startsWith("/evasioni")
          ? "One request for each company in an order, from confirmation to delivery."
          : `${numero(conteggi.data?.ultimi_trenta ?? 0)} orders in the last 30 days across the online shop, the till and wholesale.`
    : pathname.startsWith("/evasioni")
      ? "Your queue: confirm, pack, add the tracking and ship."
      : "The orders that contain your products."

  const apriNuovo = () =>
    setParametri((attuali) => {
      attuali.set("nuovo", "1")
      return attuali
    })
  const chiudiNuovo = () =>
    setParametri((attuali) => {
      attuali.delete("nuovo")
      return attuali
    })

  useEffect(() => {
    if (nuovo && !puoCreare && pathname.startsWith("/ordini/bozze")) chiudiNuovo()
    // Il parametro vale solo per chi può creare: gli altri tornano alla pagina normale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuovo, puoCreare])

  return (
    <Pagina
      titolo="Orders"
      sottotitolo={sottotitolo ?? testoPredefinito}
      azioni={
        <div className="ord-azioni">
          {inTutti && esporta ? (
            <button type="button" className="ord-btn" onClick={() => esporta.current?.()}><Download size={18} aria-hidden="true" /> Export</button>
          ) : null}
          {puoCreare ? (
            <button type="button" className="ord-btn ord-btn--primario" onClick={apriNuovo}><Plus size={18} aria-hidden="true" /> New order</button>
          ) : null}
        </div>
      }
    >
      <div className="ord">
        <Schede voci={schede} etichetta="Order sections" />
        {children}
      </div>
      {nuovo && puoCreare ? <ModuloBozza onChiudi={chiudiNuovo} onCreata={(destinazione) => naviga(destinazione)} /> : null}
    </Pagina>
  )
}
