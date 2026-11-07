import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import type { Connettore, ModificaProdotto } from "../api/tipi"
import { useSessione } from "../sessione"
import { Pagina } from "../ui"

type Scheda = { titolo: string; valore: number | undefined; nota: string; a: string }

function Schede({ voci }: { voci: Scheda[] }) {
  return (
    <div className="griglia-schede">
      {voci.map((v) => (
        <Link key={v.titolo} to={v.a} className="scheda-numero vetro">
          <span>{v.titolo}</span>
          <strong>{v.valore ?? "–"}</strong>
          <small>{v.nota} <ArrowRight size={14} aria-hidden="true" /></small>
        </Link>
      ))}
    </div>
  )
}

function PanoramicaAdmin() {
  const aziende = useQuery({ queryKey: ["aziende", "conteggio"], queryFn: () => api<{ count: number }>("/admin/sellers?limit=1&fields=id") })
  const revisione = useQuery({ queryKey: ["revisione", "conteggio"], queryFn: () => api<{ count: number }>("/admin/products?status[]=proposed&limit=1&fields=id") })
  const modifiche = useQuery({ queryKey: ["modifiche"], queryFn: () => api<{ product_changes: ModificaProdotto[] }>("/admin/product-changes?limit=100") })
  const connettori = useQuery({ queryKey: ["connettori"], queryFn: () => api<{ connettori: Connettore[] }>("/admin/connectors") })
  const inAttesa = modifiche.data?.product_changes.filter((m) => m.status === "pending").length
  const collegati = connettori.data?.connettori.filter((c) => c.stato === "collegato").length
  const problemi = connettori.data?.connettori.filter((c) => c.stato === "errore").length ?? 0

  return (
    <Pagina titolo="Panoramica" sottotitolo="Tutte le aziende, i prodotti e i collegamenti in un colpo d'occhio.">
      <Schede
        voci={[
          { titolo: "Aziende partner", valore: aziende.data?.count, nota: "Gestisci", a: "/aziende" },
          { titolo: "Prodotti da approvare", valore: revisione.data?.count, nota: "Apri revisione", a: "/revisione" },
          { titolo: "Modifiche in attesa", valore: inAttesa, nota: "Apri revisione", a: "/revisione" },
          { titolo: "Connettori collegati", valore: collegati, nota: problemi ? `${problemi} con errori` : "Gestisci", a: "/connettori" },
        ]}
      />
    </Pagina>
  )
}

function PanoramicaAzienda() {
  const { sessione } = useSessione()
  const prodotti = useQuery({ queryKey: ["miei-prodotti", "conteggio"], queryFn: () => api<{ count: number }>("/vendor/products?limit=1&fields=id") })
  const revisione = useQuery({ queryKey: ["miei-prodotti", "revisione"], queryFn: () => api<{ count: number }>("/vendor/products?limit=1&status[]=proposed&fields=id") })
  const ordini = useQuery({ queryKey: ["mie-ordini", "conteggio"], queryFn: () => api<{ count: number }>("/vendor/orders?limit=1&fields=id") })

  return (
    <Pagina titolo={sessione?.aziendaNome ?? "Panoramica"} sottotitolo="La tua parte di Multi Outfit: prodotti, approvazioni e ordini.">
      <Schede
        voci={[
          { titolo: "I miei prodotti", valore: prodotti.data?.count, nota: "Gestisci", a: "/prodotti" },
          { titolo: "In revisione", valore: revisione.data?.count, nota: "Vedi stato", a: "/prodotti" },
          { titolo: "Ordini", valore: ordini.data?.count, nota: "Apri ordini", a: "/ordini" },
        ]}
      />
    </Pagina>
  )
}

export default function Panoramica() {
  const { sessione } = useSessione()
  return sessione?.tipo === "admin" ? <PanoramicaAdmin /> : <PanoramicaAzienda />
}
