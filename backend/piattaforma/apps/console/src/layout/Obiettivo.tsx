import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import { euro } from "../ui"

const CIRCONFERENZA = 2 * Math.PI * 16

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

  if (!obiettivo.data || !vendite.data) return null
  return (
    <Link to={meta ? "/analisi" : "/impostazioni/negozio"} className="obiettivo">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="16" className="obiettivo__fondo" />
        {quota > 0 ? <circle cx="21" cy="21" r="16" className="obiettivo__valore" strokeDasharray={`${quota * CIRCONFERENZA} ${CIRCONFERENZA}`} transform="rotate(-90 21 21)" /> : null}
      </svg>
      <span>
        <strong>{euro(incasso)} today</strong>
        <small>{meta ? `of a ${euro(meta)} goal` : "Set a daily goal"}</small>
      </span>
    </Link>
  )
}
