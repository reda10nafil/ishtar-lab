import { useQuery } from "@tanstack/react-query"
import { useLayoutEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import { anima, CURVE, TEMPI } from "../movimenti"
import { euro } from "../ui"

const CIRCONFERENZA = 2 * Math.PI * 19

type Ordine = { total: number; status: string }

function inizioDelGiorno() {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  return oggi.toISOString()
}

/** Vendite di oggi rispetto all'obiettivo scelto in Settings. Senza obiettivo invita a impostarlo. */
export default function Obiettivo() {
  const obiettivo = useQuery({
    queryKey: ["impostazioni", "negozio"],
    queryFn: () => api<{ negozio: { obiettivo_giornaliero: number | null } }>("/admin/impostazioni"),
  })
  const vendite = useQuery({
    queryKey: ["ordini", "oggi"],
    queryFn: () => api<{ orders: Ordine[] }>(`/admin/orders?limit=500&fields=total,status&created_at[$gte]=${encodeURIComponent(inizioDelGiorno())}`),
  })
  const meta = obiettivo.data?.negozio.obiettivo_giornaliero ?? null
  const incasso = (vendite.data?.orders ?? []).filter((o) => o.status !== "canceled").reduce((somma, o) => somma + Number(o.total ?? 0), 0)
  const quota = meta ? Math.min(incasso / meta, 1) : 0
  const anello = useRef<SVGCircleElement>(null)
  const disegnato = useRef(false)

  // L'anello si disegna una volta sola, alla comparsa: gli aggiornamenti dei dati lo spostano e basta.
  useLayoutEffect(() => {
    if (!anello.current || disegnato.current) return
    disegnato.current = true
    anima(anello.current, [{ strokeDasharray: `0 ${CIRCONFERENZA}` }, { strokeDasharray: `${quota * CIRCONFERENZA} ${CIRCONFERENZA}` }], { duration: TEMPI.cifra, easing: CURVE.fuori3 })
  })

  if (!obiettivo.data || !vendite.data) return null
  return (
    <Link to={meta ? "/analisi/vendite" : "/impostazioni/negozio"} className="obiettivo" aria-label={meta ? `Today's sales ${euro(incasso)} of a ${euro(meta)} goal` : `Today's sales ${euro(incasso)}, set a daily goal`}>
      <span className="obiettivo__anello">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="19" className="obiettivo__fondo" />
          {quota > 0 ? <circle ref={anello} cx="22" cy="22" r="19" className="obiettivo__valore" strokeDasharray={`${quota * CIRCONFERENZA} ${CIRCONFERENZA}`} transform="rotate(-90 22 22)" /> : null}
        </svg>
        {meta ? <b>{Math.round(quota * 100)}%</b> : null}
      </span>
      <span className="obiettivo__testo">
        <strong>{euro(incasso)} today</strong>
        <small>{meta ? `of a ${euro(meta)} goal` : "Set a daily goal"}</small>
      </span>
    </Link>
  )
}
