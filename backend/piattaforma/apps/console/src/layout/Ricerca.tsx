import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import type { Voce } from "./voci"

type Risultato = { id: string; gruppo: string; titolo: string; dettaglio?: string; a: string }

const ATTESA_DIGITAZIONE = 250
const PER_GRUPPO = 5

function useTestoCalmo(testo: string) {
  const [calmo, setCalmo] = useState(testo)
  useEffect(() => {
    const attesa = setTimeout(() => setCalmo(testo), ATTESA_DIGITAZIONE)
    return () => clearTimeout(attesa)
  }, [testo])
  return calmo
}

/** Cerca sul server in ciò che il profilo può vedere; una fonte che fallisce non blocca le altre. */
function useRisultati(testo: string) {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const admin = sessione?.tipo === "admin"
  const q = encodeURIComponent(testo)

  return useQuery({
    queryKey: ["ricerca", sessione?.tipo, testo],
    enabled: testo.length >= 2,
    refetchInterval: false,
    queryFn: async () => {
      const radice = admin ? "/admin" : "/vendor"
      const fonti: Promise<Risultato[]>[] = []
      if (puo("products", "view")) {
        fonti.push(
          api<{ products: { id: string; title: string }[] }>(`${radice}/products?q=${q}&limit=${PER_GRUPPO}&fields=id,title`).then(({ products }) =>
            products.map((p) => ({ id: p.id, gruppo: "Products", titolo: p.title, a: admin ? `/prodotti/catalogo/${p.id}` : "/prodotti" }))
          )
        )
      }
      if (puo("orders", "view")) {
        fonti.push(
          api<{ orders: { id: string; display_id: number; email: string | null }[] }>(`${radice}/orders?q=${q}&limit=${PER_GRUPPO}&fields=id,display_id,email`).then(({ orders }) =>
            orders.map((o) => ({ id: o.id, gruppo: "Orders", titolo: `Order ${o.display_id}`, dettaglio: o.email ?? undefined, a: admin ? `/ordini/tutti/${o.id}` : "/ordini" }))
          )
        )
      }
      if (admin && puo("customers", "view")) {
        fonti.push(
          api<{ customers: { id: string; email: string; first_name: string | null; last_name: string | null }[] }>(`/admin/customers?q=${q}&limit=${PER_GRUPPO}&fields=id,email,first_name,last_name`).then(({ customers }) =>
            customers.map((c) => ({ id: c.id, gruppo: "Customers", titolo: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email, dettaglio: c.email, a: `/clienti/persone/${c.id}` }))
          )
        )
      }
      if (admin && puo("sellers", "view")) {
        fonti.push(
          api<{ sellers: { id: string; name: string; email: string }[] }>("/admin/sellers?limit=100&fields=id,name,email").then(({ sellers }) =>
            sellers
              .filter((s) => s.name.toLowerCase().includes(testo.toLowerCase()))
              .slice(0, PER_GRUPPO)
              .map((s) => ({ id: s.id, gruppo: "Companies", titolo: s.name, dettaglio: s.email, a: "/aziende" }))
          )
        )
      }
      const esiti = await Promise.allSettled(fonti)
      return esiti.flatMap((esito) => (esito.status === "fulfilled" ? esito.value : []))
    },
  })
}

export default function Ricerca({ voci, onChiudi }: { voci: Voce[]; onChiudi: () => void }) {
  const naviga = useNavigate()
  const campo = useRef<HTMLInputElement>(null)
  const [testo, setTesto] = useState("")
  const [attivo, setAttivo] = useState(0)
  const calmo = useTestoCalmo(testo.trim())
  const { data: trovati = [], isFetching } = useRisultati(calmo)

  useEffect(() => campo.current?.focus(), [])
  useEffect(() => setAttivo(0), [calmo])

  const elenco = useMemo<Risultato[]>(() => {
    const cercato = testo.trim().toLowerCase()
    const pagine = voci
      .filter((v) => !cercato || v.etichetta.toLowerCase().includes(cercato))
      .map((v) => ({ id: v.a, gruppo: "Pages", titolo: v.etichetta, a: v.a }))
    return [...pagine, ...trovati]
  }, [testo, voci, trovati])

  const apri = (risultato: Risultato | undefined) => {
    if (!risultato) return
    naviga(risultato.a)
    onChiudi()
  }

  const tasto = (e: KeyboardEvent) => {
    if (e.key === "Escape") onChiudi()
    if (e.key === "Enter") apri(elenco[attivo])
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const passo = e.key === "ArrowDown" ? 1 : -1
      setAttivo((attivo + passo + elenco.length) % Math.max(elenco.length, 1))
    }
  }

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className="modale vetro ricerca" role="dialog" aria-modal="true" aria-label="Search">
        <div className="ricerca__campo">
          <Search size={19} aria-hidden="true" />
          <input ref={campo} type="search" value={testo} placeholder="Search products, orders, customers, companies..." aria-label="Search" onChange={(e) => setTesto(e.target.value)} onKeyDown={tasto} />
        </div>
        <div className="ricerca__elenco">
          {elenco.map((risultato, indice) => (
            <div key={`${risultato.gruppo}-${risultato.id}`}>
              {risultato.gruppo !== elenco[indice - 1]?.gruppo ? <p className="ricerca__gruppo">{risultato.gruppo}</p> : null}
              <button
                type="button"
                className={`ricerca__voce larga${indice === attivo ? " ricerca__voce--attiva" : ""}`}
                style={{ border: 0, background: indice === attivo ? undefined : "none" }}
                onMouseEnter={() => setAttivo(indice)}
                onClick={() => apri(risultato)}
              >
                <span>{risultato.titolo}</span>
                {risultato.dettaglio ? <small>{risultato.dettaglio}</small> : null}
              </button>
            </div>
          ))}
          {!elenco.length ? <p className="tendina__vuoto">{isFetching ? "Searching..." : "No results."}</p> : null}
        </div>
      </div>
    </div>
  )
}
