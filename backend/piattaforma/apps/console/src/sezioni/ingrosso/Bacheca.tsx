import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleX, Handshake, KanbanSquare, Mail, MessagesSquare, MoreHorizontal, Package, Plus, type LucideIcon } from "lucide-react"
import { useEffect, useState, type DragEvent, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Tendina, Vuoto, useAvvisi } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Campo, Etichetta, Modale, Stato, euro } from "../../ui"
import { ModaleTrattativa } from "./ModaleTrattativa"
import { FASI, conteggioDi, numeroDa, sigla } from "./testi"
import type { Fase, Rivenditore, Trattativa } from "./tipi"

const CHIAVE = ["ingrosso", "trattative"]
type Elenco = { trattative: Trattativa[] }
type Bersaglio = { fase: Fase; indice: number }

const ICONE: Record<Fase, LucideIcon> = {
  richiesta: Mail,
  trattativa: MessagesSquare,
  campione: Package,
  accordo: Handshake,
  perso: CircleX,
}

const inOrdine = (elenco: Trattativa[]) => [...elenco].sort((a, b) => a.posizione - b.posizione)

/** Stessa regola del server: `indice` conta le carte della colonna senza quella spostata. */
function conCartaSpostata(elenco: Trattativa[], id: string, { fase, indice }: Bersaglio): Trattativa[] {
  const carta = elenco.find((t) => t.id === id)
  if (!carta) return elenco
  const colonna = inOrdine(elenco.filter((t) => t.fase === fase && t.id !== id))
  colonna.splice(indice, 0, { ...carta, fase })
  const altrove = elenco.filter((t) => t.fase !== fase && t.id !== id)
  return [...altrove, ...colonna.map((t, posizione) => ({ ...t, posizione }))]
}

function NuovaTrattativa({ rivenditori, onChiudi }: { rivenditori: Rivenditore[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({ titolo: "", rivenditore: rivenditori[0]?.id ?? "", valore: "", fase: "richiesta" as Fase })
  const crea = useMutation({
    mutationFn: () => api("/admin/ingrosso/trattative", { corpo: { titolo: dati.titolo, rivenditore_id: dati.rivenditore, valore_stimato: numeroDa(dati.valore), fase: dati.fase } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Deal created")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New deal" sottotitolo="A card on the board, tied to a stockist." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Title"><input required minLength={2} maxLength={120} value={dati.titolo} onChange={(e) => setDati({ ...dati, titolo: e.target.value })} /></Campo>
        <Campo etichetta="Stockist">
          <select required value={dati.rivenditore} onChange={(e) => setDati({ ...dati, rivenditore: e.target.value })}>
            {rivenditori.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Estimated value (optional)">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={dati.valore} onChange={(e) => setDati({ ...dati, valore: e.target.value })} />
          </Campo>
          <Campo etichetta="Stage">
            <select value={dati.fase} onChange={(e) => setDati({ ...dati, fase: e.target.value as Fase })}>
              {FASI.map((f) => <option key={f.id} value={f.id}>{f.titolo}</option>)}
            </select>
          </Campo>
        </div>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="riga__azioni ing-piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={crea.isPending}>{crea.isPending ? "Creating..." : "Create deal"}</button>
        </div>
      </form>
    </Modale>
  )
}

export default function Bacheca() {
  const client = useQueryClient()
  const { segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [aperta, setAperta] = useState<string | null>(null)
  const [presa, setPresa] = useState<string | null>(null)
  const [bersaglio, setBersaglio] = useState<Bersaglio | null>(null)
  const scrive = puo("ingrosso", "edit")
  const daApriRivenditore = parametri.get("apri")

  const query = useQuery({ queryKey: CHIAVE, queryFn: () => api<Elenco>("/admin/ingrosso/trattative") })
  const elencoRivenditori = useQuery({ queryKey: ["ingrosso", "rivenditori"], queryFn: () => api<{ rivenditori: Rivenditore[] }>("/admin/ingrosso/rivenditori") })
  const rivenditori = elencoRivenditori.data?.rivenditori ?? []
  const trattative = query.data?.trattative ?? []
  const nuova = parametri.get("nuovo") === "1" && scrive && rivenditori.length > 0

  // La scheda del rivenditore si apre nella stessa pagina: la trattativa le cede il posto.
  useEffect(() => {
    if (daApriRivenditore) setAperta(null)
  }, [daApriRivenditore])

  // La carta si sposta subito sullo schermo; se il server rifiuta torna al suo posto.
  const sposta = useMutation({
    mutationFn: ({ id, posto }: { id: string; posto: Bersaglio }) => api(`/admin/ingrosso/trattative/${id}/sposta`, { corpo: posto }),
    onMutate: async ({ id, posto }) => {
      await client.cancelQueries({ queryKey: CHIAVE })
      const prima = client.getQueryData<Elenco>(CHIAVE)
      if (prima) client.setQueryData<Elenco>(CHIAVE, { trattative: conCartaSpostata(prima.trattative, id, posto) })
      return { prima }
    },
    onError: (errore, _variabili, contesto) => {
      if (contesto?.prima) client.setQueryData(CHIAVE, contesto.prima)
      segnalaErrore(errore)
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["ingrosso"] }),
  })

  const lascia = (e: DragEvent, fase: Fase, senzaPresa: Trattativa[]) => {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain") || presa
    const posto = bersaglio?.fase === fase ? bersaglio : { fase, indice: senzaPresa.length }
    setPresa(null)
    setBersaglio(null)
    if (id) sposta.mutate({ id, posto })
  }

  const sopraCarta = (e: DragEvent<HTMLElement>, fase: Fase, indice: number) => {
    if (!presa) return
    e.preventDefault()
    e.stopPropagation()
    const riquadro = e.currentTarget.getBoundingClientRect()
    const sotto = e.clientY > riquadro.top + riquadro.height / 2
    setBersaglio({ fase, indice: indice + (sotto ? 1 : 0) })
  }

  if (elencoRivenditori.isSuccess && !rivenditori.length) return null

  const carteDi = (fase: Fase) => inOrdine(trattative.filter((t) => t.fase === fase))
  const sommaDi = (carte: Trattativa[]) => carte.reduce((totale, t) => totale + (t.valore_stimato ?? 0), 0)

  return (
    <>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !trattative.length ? (
        <Vuoto
          icona={KanbanSquare}
          titolo="No deals yet"
          testo="Create the first one: it starts at Enquiry and you drag it from stage to stage."
          azione={scrive ? <button type="button" className="primario" onClick={() => setParametri({ nuovo: "1" })}><Plus size={17} aria-hidden="true" /> New deal</button> : undefined}
        />
      ) : null}

      {trattative.length ? (
        <>
          <div className="ing-riquadri">
            {FASI.map(({ id: fase, titolo }) => {
              const carte = carteDi(fase)
              const Icona = ICONE[fase]
              return (
                <div key={fase} className="ing-riquadro vetro">
                  <span className={`ing-riquadro__icona ing-riquadro__icona--${fase}`}><Icona size={18} aria-hidden="true" /></span>
                  <div>
                    <strong>{euro(sommaDi(carte))}</strong>
                    <small>{titolo} · {carte.length}</small>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="ing-bacheca">
            {FASI.map(({ id: fase, titolo }) => {
              const carte = carteDi(fase)
              const senzaPresa = carte.filter((t) => t.id !== presa)
              const somma = sommaDi(carte)
              return (
                <section
                  key={fase}
                  className={`ing-colonna vetro${bersaglio?.fase === fase ? " ing-colonna--sopra" : ""}`}
                  aria-label={titolo}
                  onDragOver={(e) => {
                    if (!presa) return
                    e.preventDefault()
                    setBersaglio({ fase, indice: senzaPresa.length })
                  }}
                  onDrop={(e) => lascia(e, fase, senzaPresa)}
                >
                  <header>
                    <h2>{titolo}</h2>
                    <span>{carte.length}</span>
                    <small>{somma ? euro(somma) : ""}</small>
                  </header>
                  {carte.map((t) => {
                    const indice = senzaPresa.indexOf(t)
                    return (
                      <div key={t.id}>
                        {bersaglio?.fase === fase && bersaglio.indice === indice ? <div className="ing-segno" aria-hidden="true" /> : null}
                        <article
                          className={`ing-carta${presa === t.id ? " ing-carta--presa" : ""}`}
                          draggable={scrive}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id)
                            e.dataTransfer.effectAllowed = "move"
                            setPresa(t.id)
                          }}
                          onDragEnd={() => {
                            setPresa(null)
                            setBersaglio(null)
                          }}
                          onDragOver={(e) => (indice >= 0 ? sopraCarta(e, fase, indice) : undefined)}
                        >
                          <header className="ing-carta__testa">
                            <span className="ing-sigla" aria-hidden="true">{sigla(t.rivenditore.nome)}</span>
                            <button type="button" className="ing-carta__apri" onClick={() => setAperta(t.id)}>
                              <strong>{t.rivenditore.nome}</strong>
                              <small>{t.rivenditore.citta ?? "No town yet"}</small>
                            </button>
                            {scrive ? (
                              <Tendina etichetta={`Move ${t.titolo}`} classe="icona-pulsante ing-carta__menu" bottone={<MoreHorizontal size={17} aria-hidden="true" />}>
                                {FASI.filter((f) => f.id !== t.fase).map((f) => (
                                  <button key={f.id} type="button" onClick={() => sposta.mutate({ id: t.id, posto: { fase: f.id, indice: carteDi(f.id).length } })}>{f.titolo}</button>
                                ))}
                              </Tendina>
                            ) : null}
                          </header>
                          <p className="ing-carta__titolo">{t.titolo}</p>
                          <footer className="ing-carta__piede">
                            {t.ordine_id ? <Etichetta tono="ok">Draft order</Etichetta> : <span />}
                            <strong>{t.valore_stimato === null ? "No estimate" : euro(t.valore_stimato)}</strong>
                          </footer>
                        </article>
                      </div>
                    )
                  })}
                  {bersaglio?.fase === fase && bersaglio.indice === senzaPresa.length ? <div className="ing-segno" aria-hidden="true" /> : null}
                  {carte.length ? null : <p className="ing-colonna__vuota">{conteggioDi(0, "deal")} here</p>}
                </section>
              )
            })}
          </div>
        </>
      ) : null}

      {nuova ? <NuovaTrattativa rivenditori={rivenditori} onChiudi={() => setParametri({}, { replace: true })} /> : null}
      {aperta ? <ModaleTrattativa id={aperta} rivenditori={rivenditori} onChiudi={() => setAperta(null)} /> : null}
    </>
  )
}
