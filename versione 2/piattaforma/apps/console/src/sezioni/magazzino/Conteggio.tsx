import { useMutation, useQuery } from "@tanstack/react-query"
import { ClipboardList } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Stato, dataBreve } from "../../ui"
import { CellaProdotto } from "./Scorte"
import { PER_PAGINA, useAggiornaMagazzino, useMagazzino } from "./dati"
import type { ElencoScorte, Riga } from "./tipi"

type Esito = { contati: number; cambiati: number; differenza: number }

const differenzaDi = (riga: Riga, contata: string) => Number(contata) - riga.giacenza

/** L'azienda conta la merce: le righe lasciate vuote non si toccano. */
export default function Conteggio() {
  const { admin } = useMagazzino()
  const { puo } = usePermessi()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [contate, setContate] = useState<Record<string, string>>({})
  const [testo, setTesto] = useState("")
  const [pagina, setPagina] = useState(1)
  const [conferma, setConferma] = useState(false)
  const [nota, setNota] = useState("")

  useEffect(() => setPagina(1), [testo])

  const query = useQuery({
    queryKey: ["magazzino", "conteggio"],
    queryFn: () => api<ElencoScorte>("/vendor/magazzino?tutte=1"),
    enabled: !admin,
  })
  const righe = useMemo(() => query.data?.righe ?? [], [query.data])
  const cercato = testo.trim().toLowerCase()
  const trovate = useMemo(
    () => righe.filter((r) => !cercato || [r.sku, r.prodotto, r.variante].some((v) => v?.toLowerCase().includes(cercato))),
    [righe, cercato]
  )
  const scelte = righe.filter((r) => (contate[r.id] ?? "").trim() !== "")
  const cambiate = scelte.filter((r) => differenzaDi(r, contate[r.id]) !== 0)

  const registra = useMutation({
    mutationFn: () =>
      api<Esito>("/vendor/magazzino/conteggio", {
        corpo: {
          righe: scelte.map((r) => ({ articolo_id: r.articolo_id, deposito_id: r.deposito_id, contata: Number(contate[r.id]) })),
          nota: nota.trim() || undefined,
        },
      }),
    onSuccess: (esito) => {
      void aggiorna()
      setContate({})
      setNota("")
      setConferma(false)
      avvisa(`Stock count recorded: ${numero(esito.contati)} items counted, ${numero(esito.cambiati)} adjusted`)
    },
    onError: (errore) => {
      setConferma(false)
      segnalaErrore(errore)
    },
  })

  if (admin || !puo("magazzino", "edit")) return <Navigate to="/magazzino/scorte" replace />

  const colonne: Colonna<Riga>[] = [
    { titolo: "Product", cella: (r) => <CellaProdotto riga={r} /> },
    { titolo: "SKU", cella: (r) => <code className="mag-sku">{r.sku ?? "–"}</code> },
    { titolo: "In stock", destra: true, cella: (r) => numero(r.giacenza) },
    { titolo: "Last counted", cella: (r) => (r.ultimo_conteggio ? dataBreve(r.ultimo_conteggio) : "Never") },
    {
      titolo: "Counted",
      destra: true,
      cella: (r) => (
        <input
          className="mag-contate"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          aria-label={`Counted quantity for ${r.sku ?? r.prodotto}`}
          value={contate[r.id] ?? ""}
          onChange={(e) => setContate((attuali) => ({ ...attuali, [r.id]: e.target.value }))}
        />
      ),
    },
    {
      titolo: "Difference",
      destra: true,
      cella: (r) => {
        const contata = (contate[r.id] ?? "").trim()
        if (!contata) return "–"
        const differenza = differenzaDi(r, contata)
        return differenza > 0 ? `+${numero(differenza)}` : numero(differenza)
      },
    },
  ]

  const inizio = (pagina - 1) * PER_PAGINA

  return (
    <>
      <div className="barra-strumenti">
        <CampoRicerca valore={testo} etichetta="Search by SKU or product" onCambia={setTesto} />
        <span className="spazio" />
        <span className="mag-nota">{numero(scelte.length)} counted · {numero(cambiate.length)} with differences</span>
        <button type="button" className="primario" disabled={!scelte.length} onClick={() => setConferma(true)}>Record count</button>
      </div>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.data && !trovate.length ? (
        <Vuoto
          icona={ClipboardList}
          titolo={cercato ? "No items found" : "Nothing to count"}
          testo={cercato ? "Try another SKU or product name." : "Items appear here once they are in your warehouse."}
        />
      ) : null}
      {trovate.length ? (
        <Tabella etichetta="Items to count" colonne={colonne} righe={trovate.slice(inizio, inizio + PER_PAGINA)} chiave={(r) => r.id} />
      ) : null}
      <Paginazione pagina={pagina} perPagina={PER_PAGINA} totale={trovate.length} onCambia={setPagina} />
      {conferma ? (
        <Conferma
          titolo="Record this count?"
          testo={`${numero(scelte.length)} items counted: stock changes straight away for ${numero(cambiate.length)}.`}
          azione="Confirm count"
          attesa={registra.isPending}
          onConferma={() => registra.mutate()}
          onChiudi={() => setConferma(false)}
        />
      ) : null}
      {scelte.length ? (
        <Campo etichetta="Count note" aiuto="Optional: it stays in the movement history.">
          <input maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      ) : null}
    </>
  )
}
