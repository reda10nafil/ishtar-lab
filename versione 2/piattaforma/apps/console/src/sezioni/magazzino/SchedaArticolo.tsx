import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Warehouse } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero, stato as statoDi } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Etichetta, Pagina, Stato, dataOra, euro } from "../../ui"
import { ModuloCorrezione, ModuloRiserva, ModuloSoglia } from "./Moduli"
import { ORIGINI_SOGLIA, STATI_SCORTA, TIPI_MOVIMENTO, testoMotivo, useAggiornaMagazzino, useMagazzino } from "./dati"
import type { Movimento, Riga, Riserva, Scheda } from "./tipi"

const segno = (valore: number) => (valore > 0 ? `+${numero(valore)}` : numero(valore))

const colonneMovimenti: Colonna<Movimento>[] = [
  { titolo: "When", cella: (m) => dataOra(m.quando) },
  {
    titolo: "Type",
    cella: (m) => {
      const s = statoDi(TIPI_MOVIMENTO, m.tipo)
      return <Etichetta tono={s.tono}>{s.testo}</Etichetta>
    },
  },
  { titolo: "From", destra: true, cella: (m) => numero(m.prima) },
  { titolo: "To", destra: true, cella: (m) => numero(m.dopo) },
  { titolo: "Difference", destra: true, cella: (m) => segno(m.differenza) },
  { titolo: "Reason", cella: (m) => testoMotivo(m.motivo) },
  { titolo: "Who", cella: (m) => m.chi },
  { titolo: "Note", cella: (m) => m.nota ?? "–" },
]

export default function SchedaArticolo() {
  const { id = "" } = useParams()
  const { admin, base } = useMagazzino()
  const { puo } = usePermessi()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [correzione, setCorrezione] = useState<Riga | null>(null)
  const [nuovaRiserva, setNuovaRiserva] = useState<Riga | null>(null)
  const [daTogliere, setDaTogliere] = useState<Riserva | null>(null)
  const [soglia, setSoglia] = useState(false)

  const query = useQuery({ queryKey: ["magazzino", "scheda", base, id], queryFn: () => api<Scheda>(`${base}/articoli/${id}`) })
  const togli = useMutation({
    mutationFn: (riserva: Riserva) => api(`/admin/magazzino/riserve/${riserva.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      setDaTogliere(null)
      avvisa("Reservation released: the units are available again")
    },
    onError: segnalaErrore,
  })

  const scheda = query.data
  const prima = scheda?.livelli[0]
  const puoSoglia = puo("magazzino", "edit")
  const puoCorreggere = puo("magazzino", "edit")
  const puoRiservare = admin && puo("reservations", "edit")

  const colonneLivelli: Colonna<Riga>[] = [
    ...(admin ? [{ titolo: "Company", cella: (r: Riga) => r.azienda }] : []),
    { titolo: "Warehouse", cella: (r) => r.deposito },
    { titolo: "In stock", destra: true, cella: (r) => numero(r.giacenza) },
    { titolo: "Reserved", destra: true, cella: (r) => numero(r.riservate) },
    { titolo: "Available", destra: true, cella: (r) => numero(r.disponibili) },
    { titolo: "Reorder point", destra: true, cella: (r) => numero(r.soglia) },
    ...(scheda?.vede_valore ? [{ titolo: "Value at cost", destra: true, cella: (r: Riga) => (r.valore === null ? "No supply price" : euro(r.valore)) }] : []),
    {
      titolo: "Status",
      cella: (r) => {
        const s = statoDi(STATI_SCORTA, r.stato)
        return <Etichetta tono={s.tono}>{s.testo}</Etichetta>
      },
    },
    { titolo: "Last counted", cella: (r) => (r.ultimo_conteggio ? dataOra(r.ultimo_conteggio) : "Never") },
    ...(puoCorreggere || puoRiservare
      ? [
          {
            titolo: "Actions",
            cella: (r: Riga) => (
              <span className="riga__azioni">
                {puoCorreggere ? <button type="button" onClick={() => setCorrezione(r)}>Adjust quantity</button> : null}
                {puoRiservare ? <button type="button" disabled={r.disponibili <= 0} onClick={() => setNuovaRiserva(r)}>Set aside</button> : null}
              </span>
            ),
          },
        ]
      : []),
  ]

  const colonneRiserve: Colonna<Riserva>[] = [
    { titolo: "Created", cella: (r) => dataOra(r.creata_il) },
    { titolo: "Quantity", destra: true, cella: (r) => numero(r.quantita) },
    { titolo: "Source", cella: (r) => <Etichetta tono={r.origine === "ordine" ? "attesa" : "neutro"}>{r.origine === "ordine" ? "Order" : "Manual"}</Etichetta> },
    { titolo: "Description", cella: (r) => r.descrizione ?? "–" },
    ...(puoRiservare
      ? [{ titolo: "Actions", cella: (r: Riserva) => (r.origine === "manuale" ? <button type="button" onClick={() => setDaTogliere(r)}>Release</button> : "–") }]
      : []),
  ]

  return (
    <Pagina
      titolo={prima?.prodotto ?? "Item"}
      sottotitolo={[prima?.variante, prima?.sku].filter(Boolean).join(" · ") || "Item details"}
      azioni={<Link className="mag-collegamento" to="/magazzino/scorte"><ArrowLeft size={16} aria-hidden="true" /> Back to inventory</Link>}
    >
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {scheda && prima ? (
        <>
          <Tabella etichetta="Stock by warehouse" colonne={colonneLivelli} righe={scheda.livelli} chiave={(r) => r.id} />
          <Riquadro
            titolo="Reorder point"
            testo={`In use: ${numero(prima.soglia)} units · ${ORIGINI_SOGLIA[prima.origine_soglia]}`}
            azioni={puoSoglia ? <button type="button" onClick={() => setSoglia(true)}>Change reorder point</button> : undefined}
          >
            <p className="mag-nota">At or below this available quantity the item shows as low stock and an alert goes out.</p>
          </Riquadro>
          <Riquadro titolo="Reservations" testo="Units set aside for orders or by hand.">
            {scheda.riserve.length ? (
              <Tabella etichetta="Item reservations" colonne={colonneRiserve} righe={scheda.riserve} chiave={(r) => r.id} />
            ) : (
              <Vuoto icona={Warehouse} titolo="No reservations" testo="No units of this item are set aside." />
            )}
          </Riquadro>
          <Riquadro titolo="Movements" testo="Adjustments and counts for this item.">
            {scheda.movimenti.length ? (
              <Tabella etichetta="Item movements" colonne={colonneMovimenti} righe={scheda.movimenti} chiave={(m) => m.id} />
            ) : (
              <Vuoto icona={Warehouse} titolo="No movements" testo="Adjustments and counts will appear here." />
            )}
          </Riquadro>
        </>
      ) : null}
      {correzione ? <ModuloCorrezione riga={correzione} onChiudi={() => setCorrezione(null)} /> : null}
      {nuovaRiserva ? <ModuloRiserva riga={nuovaRiserva} onChiudi={() => setNuovaRiserva(null)} /> : null}
      {soglia && prima ? <ModuloSoglia articoloId={id} attuale={scheda?.soglia_articolo ?? null} onChiudi={() => setSoglia(false)} /> : null}
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
    </Pagina>
  )
}
