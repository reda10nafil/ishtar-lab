import { useMutation, useQuery } from "@tanstack/react-query"
import { ClipboardList } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { api, ErroreApi } from "../../api/client"
import { CampoRicerca, Paginazione, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Etichetta, Stato, dataBreve } from "../../ui"
import { CellaProdotto } from "./Scorte"
import { PER_PAGINA, useAggiornaMagazzino, useMagazzino } from "./dati"
import type { ElencoScorte, Riga } from "./tipi"

type Esito = { contati: number; cambiati: number; differenza: number }
type Cambiata = { articolo_id: string; deposito_id: string; prima?: number; attuale?: number }

const differenzaDi = (riga: Riga, contata: string) => Number(contata) - riga.giacenza

/** L'azienda conta la merce: le righe lasciate vuote non si toccano. */
export default function Conteggio() {
  const { admin } = useMagazzino()
  const { puo } = usePermessi()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [contate, setContate] = useState<Record<string, string>>({})
  // Giacenza mostrata quando si è contata ogni riga: il conteggio vale solo se è ancora quella (altrimenti 412 e la riga
  // va ricontrollata con la giacenza aggiornata).
  const [prime, setPrime] = useState<Record<string, number>>({})
  // Righe cambiate altrove mentre si contava (412): il numero contato si toglie e la riga resta segnata, con la giacenza
  // da cui si era partiti e quella attuale, finché non la si riconta. Il messaggio del server resta sopra l'elenco.
  const [daRicontare, setDaRicontare] = useState<Record<string, { prima: number; attuale: number }>>({})
  const [messaggio, setMessaggio] = useState("")
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
  const segnate = Object.keys(daRicontare).length

  const registra = useMutation({
    mutationFn: () =>
      api<Esito>("/vendor/magazzino/conteggio", {
        corpo: {
          righe: scelte.map((r) => ({ articolo_id: r.articolo_id, deposito_id: r.deposito_id, contata: Number(contate[r.id]), prima: prime[r.id] ?? r.giacenza })),
          nota: nota.trim() || undefined,
        },
      }),
    onSuccess: (esito) => {
      void aggiorna()
      setContate({})
      setPrime({})
      setDaRicontare({})
      setMessaggio("")
      setNota("")
      setConferma(false)
      avvisa(`Stock count recorded: ${numero(esito.contati)} items counted, ${numero(esito.cambiati)} adjusted`)
    },
    onError: (errore) => {
      setConferma(false)
      if (!(errore instanceof ErroreApi) || errore.stato !== 412) {
        segnalaErrore(errore)
        return
      }
      // Niente registrato. Il numero contato di una riga cambiata non vale più (la merce contata può essere quella di
      // prima o di dopo la vendita): si toglie, e la riga va ricontata dalla giacenza aggiornata. Le altre restano.
      const conflitti = ((errore.dettagli as { conflitti?: Cambiata[] } | undefined)?.conflitti ?? []).filter((c) => c.articolo_id && c.deposito_id)
      const nuove = Object.fromEntries(conflitti.map((c) => {
        const id = `${c.articolo_id}@${c.deposito_id}`
        return [id, { prima: c.prima ?? prime[id] ?? 0, attuale: c.attuale ?? 0 }]
      }))
      const senza = <T,>(valori: Record<string, T>) => Object.fromEntries(Object.entries(valori).filter(([id]) => !(id in nuove)))
      setContate(senza)
      setPrime(senza)
      setDaRicontare((attuali) => ({ ...attuali, ...nuove }))
      setMessaggio(errore.message)
      void aggiorna()
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
          onChange={(e) => {
            setContate((attuali) => ({ ...attuali, [r.id]: e.target.value }))
            setPrime((attuali) => (r.id in attuali ? attuali : { ...attuali, [r.id]: r.giacenza }))
            setDaRicontare((attuali) => (r.id in attuali ? Object.fromEntries(Object.entries(attuali).filter(([id]) => id !== r.id)) : attuali))
          }}
        />
      ),
    },
    {
      titolo: "Difference",
      destra: true,
      cella: (r) => {
        const cambiata = daRicontare[r.id]
        if (cambiata) {
          return <Etichetta tono="attesa">Changed while counting ({numero(cambiata.prima)} → {numero(cambiata.attuale)}): count again</Etichetta>
        }
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
      {segnate ? (
        <p className="avviso-stato avviso-stato--errore" role="alert">
          {messaggio} {segnate === 1 ? "The changed item is marked below" : `The ${numero(segnate)} changed items are marked below`}: count {segnate === 1 ? "it" : "them"} again.
        </p>
      ) : null}
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
          testo={`${numero(scelte.length)} items counted: stock changes straight away for ${numero(cambiate.length)}.` +
            (segnate ? ` ${numero(segnate)} changed ${segnate === 1 ? "item is" : "items are"} not included until counted again.` : "")}
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
