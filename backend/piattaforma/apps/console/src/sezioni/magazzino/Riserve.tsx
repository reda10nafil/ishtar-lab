import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { Warehouse } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Etichetta, Stato, dataOra } from "../../ui"
import { PER_PAGINA, interrogazione, useAggiornaMagazzino, useMagazzino, useRitardato } from "./dati"
import type { ElencoRiserve, Riserva } from "./tipi"

export default function Riserve() {
  const { admin, base } = useMagazzino()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [testo, setTesto] = useState("")
  const q = useRitardato(testo.trim())
  const [pagina, setPagina] = useState(1)
  const [daTogliere, setDaTogliere] = useState<Riserva | null>(null)

  useEffect(() => setPagina(1), [q])

  const query = useQuery({
    queryKey: ["magazzino", "riserve", base, q, pagina],
    queryFn: () => api<ElencoRiserve>(`${base}/riserve?${interrogazione({ q, limit: PER_PAGINA, offset: (pagina - 1) * PER_PAGINA })}`),
    placeholderData: keepPreviousData,
  })

  const togli = useMutation({
    mutationFn: (riserva: Riserva) => api(`/admin/magazzino/riserve/${riserva.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      setDaTogliere(null)
      avvisa("Reservation released: the units are available again")
    },
    onError: segnalaErrore,
  })

  const puoTogliere = admin && puo("reservations", "edit")
  const colonne: Colonna<Riserva>[] = [
    { titolo: "Product", cella: (r) => [r.prodotto, r.variante].filter(Boolean).join(" · ") || "Unnamed item" },
    { titolo: "SKU", cella: (r) => <code className="mag-sku">{r.sku ?? "–"}</code> },
    ...(admin ? [{ titolo: "Company", cella: (r: Riserva) => r.azienda }] : []),
    { titolo: "Quantity", destra: true, cella: (r) => numero(r.quantita) },
    { titolo: "Source", cella: (r) => <Etichetta tono={r.origine === "ordine" ? "attesa" : "neutro"}>{r.origine === "ordine" ? "Order" : "Manual"}</Etichetta> },
    { titolo: "Description", cella: (r) => r.descrizione ?? "–" },
    { titolo: "Created", cella: (r) => dataOra(r.creata_il) },
    ...(puoTogliere
      ? [
          {
            titolo: "Actions",
            cella: (r: Riserva) =>
              r.origine === "manuale" ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); setDaTogliere(r) }}>Release</button>
              ) : "–",
          },
        ]
      : []),
  ]

  const dati = query.data

  return (
    <>
      <div className="barra-strumenti">
        <CampoRicerca valore={testo} etichetta="Search by SKU or product" onCambia={setTesto} />
        <span className="spazio" />
        {dati?.conteggio ? <span className="mag-nota">{numero(dati.unita)} units set aside</span> : null}
      </div>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati && !dati.riserve.length ? (
        <Vuoto
          icona={Warehouse}
          titolo={q ? "No reservations found" : "No reservations"}
          testo={q ? "No reservations match this search." : admin ? "Units held for orders appear here. To set some aside by hand, open an item from Stock." : "Units held for orders appear here."}
        />
      ) : null}
      {dati?.riserve.length ? (
        <Tabella etichetta="Reservations" colonne={colonne} righe={dati.riserve} chiave={(r) => r.id} onApri={(r) => naviga(`/magazzino/scorte/${r.articolo_id}`)} />
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={dati?.conteggio ?? 0} onCambia={setPagina} />
      {daTogliere ? (
        <Conferma
          titolo="Release this reservation?"
          testo={`${numero(daTogliere.quantita)} units go back on sale.`}
          azione="Yes, release"
          attesa={togli.isPending}
          onConferma={() => togli.mutate(daTogliere)}
          onChiudi={() => setDaTogliere(null)}
        />
      ) : null}
    </>
  )
}
