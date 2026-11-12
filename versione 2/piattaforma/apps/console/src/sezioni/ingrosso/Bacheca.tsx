import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Gift, KanbanSquare, Mail, Plus, ReceiptText, Truck, type LucideIcon } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent as EventoTastiera, type PointerEvent as EventoPuntatore } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Vuoto, useAvvisi } from "../../componenti"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { Campo, Modale, Stato } from "../../ui"
import { entraCarte, useRiordino } from "../sconti/movimenti"
import { AvvisoAnnulla } from "./AvvisoAnnulla"
import { CassettoTrattativa } from "./CassettoTrattativa"
import { MenuSposta } from "./MenuSposta"
import { FASI, conteggioDi, importoTondo, numeroDa, sigla, tintaDi, titoloFase } from "./testi"
import type { Fase, Rivenditore, Trattativa } from "./tipi"

const CHIAVE = ["ingrosso", "trattative"]
const SOGLIA_TRASCINAMENTO = 5

type Elenco = { trattative: Trattativa[] }
type Posto = { fase: Fase; indice: number }

const ICONE: Record<Fase, LucideIcon> = { richiesta: Mail, campione: Gift, accordo: ReceiptText, spedito: Truck }

const inOrdine = (elenco: Trattativa[]) => [...elenco].sort((a, b) => a.posizione - b.posizione)
const sommaDi = (carte: Trattativa[]) => carte.reduce((totale, t) => totale + (t.valore_stimato ?? 0), 0)
const cifraTonda = (valore: number) => importoTondo(Math.round(valore))

/** Stessa regola del server: `indice` conta le carte della colonna senza quella spostata. */
function conCartaSpostata(elenco: Trattativa[], id: string, { fase, indice }: Posto): Trattativa[] {
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
  const [dati, setDati] = useState({ titolo: "", rivenditore: rivenditori[0]?.id ?? "", unita: "48", valore: "" })
  const titolo = useRef<HTMLInputElement>(null)

  // Gira dopo l'effetto di Modale, che darebbe il fuoco alla tendina.
  useEffect(() => titolo.current?.focus({ preventScroll: true }), [])

  const crea = useMutation({
    mutationFn: () => api("/admin/ingrosso/trattative", { corpo: { titolo: dati.titolo, rivenditore_id: dati.rivenditore, unita: numeroDa(dati.unita), valore_stimato: numeroDa(dati.valore) } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ingrosso"] })
      avvisa("Deal added to Enquiry")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New wholesale deal" onChiudi={onChiudi}>
      <form className="modulo ing-modulo" onSubmit={invia}>
        <Campo etichetta="Stockist">
          <select required value={dati.rivenditore} onChange={(e) => setDati({ ...dati, rivenditore: e.target.value })}>
            {rivenditori.map((r) => <option key={r.id} value={r.id}>{r.citta ? `${r.nome} · ${r.citta}` : r.nome}</option>)}
          </select>
        </Campo>
        <Campo etichetta="What it's for"><input required minLength={2} maxLength={120} placeholder="Spring restock" ref={titolo} value={dati.titolo} onChange={(e) => setDati({ ...dati, titolo: e.target.value })} /></Campo>
        <div className="griglia-due ing-griglia">
          <Campo etichetta="Units">
            <input type="number" inputMode="numeric" min="1" step="1" value={dati.unita} onChange={(e) => setDati({ ...dati, unita: e.target.value })} />
          </Campo>
          <Campo etichetta="Value at trade">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={dati.valore} onChange={(e) => setDati({ ...dati, valore: e.target.value })} />
          </Campo>
        </div>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="ing-piede">
          <span className="spazio" />
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={crea.isPending}><Check size={16} aria-hidden="true" /> {crea.isPending ? "Adding..." : "Add deal"}</button>
        </div>
      </form>
    </Modale>
  )
}

function Riquadro({ fase, titolo, carte }: { fase: Fase; titolo: string; carte: Trattativa[] }) {
  const Icona = ICONE[fase]
  return (
    <div className="ing-riquadro vetro">
      <span className={`ing-riquadro__icona ing-tono--${fase}`}><Icona size={20} aria-hidden="true" /></span>
      <div>
        <strong><Cifra valore={sommaDi(carte)} formato={cifraTonda} /></strong>
        <small>{titolo} · {carte.length}</small>
      </div>
    </div>
  )
}

export default function Bacheca() {
  const client = useQueryClient()
  const { segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [aperta, setAperta] = useState<string | null>(null)
  const [sopra, setSopra] = useState<Fase | null>(null)
  const [annullabile, setAnnullabile] = useState<{ chiave: number; testo: string; annulla: () => void } | null>(null)
  const radice = useRef<HTMLDivElement>(null)
  const entrata = useRef(false)
  const daRifocalizzare = useRef<string | null>(null)
  const fotografa = useRiordino(radice, ".ing-carta")
  const scrive = puo("ingrosso", "edit")
  const daApriRivenditore = parametri.get("apri")

  const query = useQuery({ queryKey: CHIAVE, queryFn: () => api<Elenco>("/admin/ingrosso/trattative") })
  const elencoRivenditori = useQuery({ queryKey: ["ingrosso", "rivenditori"], queryFn: () => api<{ rivenditori: Rivenditore[] }>("/admin/ingrosso/rivenditori") })
  const rivenditori = elencoRivenditori.data?.rivenditori ?? []
  const trattative = query.data?.trattative ?? []
  const nuova = parametri.get("nuovo") === "1" && scrive && rivenditori.length > 0
  const carteDi = (fase: Fase) => inOrdine(trattative.filter((t) => t.fase === fase))

  // La scheda del rivenditore si apre nella stessa pagina: la trattativa le cede il posto.
  useEffect(() => {
    if (daApriRivenditore) setAperta(null)
  }, [daApriRivenditore])

  // Le corsie entrano con il guscio; poco dopo le carte, una dopo l'altra.
  useLayoutEffect(() => {
    if (entrata.current || !radice.current || !trattative.length) return
    entrata.current = true
    entraCarte(radice.current.querySelectorAll(".ing-carta"), 170, 55)
  }, [trattative.length])

  // Cambiando corsia la carta si rimonta: il fuoco torna su di lei, così le frecce continuano a funzionare.
  useLayoutEffect(() => {
    if (!daRifocalizzare.current) return
    radice.current?.querySelector<HTMLElement>(`.ing-carta[data-id="${daRifocalizzare.current}"]`)?.focus({ preventScroll: true })
    daRifocalizzare.current = null
  }, [trattative])

  // La carta si sposta subito sullo schermo; se il server rifiuta torna al suo posto.
  const sposta = useMutation({
    mutationFn: ({ id, posto }: { id: string; posto: Posto }) => api(`/admin/ingrosso/trattative/${id}/sposta`, { corpo: posto }),
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

  const muovi = (carta: Trattativa, posto: Posto) => {
    const di = { fase: carta.fase, indice: carteDi(carta.fase).findIndex((t) => t.id === carta.id) }
    fotografa()
    sposta.mutate({ id: carta.id, posto })
    if (posto.fase === carta.fase) return
    setAnnullabile({
      chiave: Date.now(),
      testo: `${carta.rivenditore.nome} → ${titoloFase(posto.fase)}`,
      annulla: () => {
        fotografa()
        sposta.mutate({ id: carta.id, posto: di })
        setAnnullabile(null)
      },
    })
  }

  /** Invio apre la carta; le frecce a destra e a sinistra la portano in cima alla corsia vicina. */
  const tastoSullaCarta = (e: EventoTastiera<HTMLElement>, carta: Trattativa) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter") return setAperta(carta.id)
    if (!scrive || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return
    e.preventDefault()
    const vicina = FASI[FASI.findIndex((f) => f.id === carta.fase) + (e.key === "ArrowRight" ? 1 : -1)]
    if (!vicina) return
    daRifocalizzare.current = carta.id
    muovi(carta, { fase: vicina.id, indice: 0 })
  }

  /** Il trascinamento segue il puntatore, quindi vale anche per il tocco: in verticale la pagina scorre. */
  const prendi = (e: EventoPuntatore<HTMLElement>, carta: Trattativa) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, [role="menu"]')) return
    const elemento = e.currentTarget
    const partenzaX = e.clientX
    const partenzaY = e.clientY
    let trascina = false

    const faseSotto = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>(".ing-colonna")
    const lascia = () => {
      window.removeEventListener("pointermove", muoviPuntatore)
      window.removeEventListener("pointerup", rilascia)
      window.removeEventListener("pointercancel", annulla)
      window.removeEventListener("keydown", tasto)
      setSopra(null)
      elemento.style.translate = ""
      elemento.classList.remove("ing-carta--presa")
    }
    const muoviPuntatore = (ev: PointerEvent) => {
      const x = ev.clientX - partenzaX
      const y = ev.clientY - partenzaY
      if (!trascina) {
        if (!scrive || Math.hypot(x, y) < SOGLIA_TRASCINAMENTO) return
        trascina = true
        elemento.classList.add("ing-carta--presa")
        fotografa()
      }
      elemento.style.translate = `${x}px ${y}px`
      setSopra((faseSotto(ev.clientX, ev.clientY)?.dataset.fase as Fase | undefined) ?? null)
    }
    const rilascia = (ev: PointerEvent) => {
      if (!trascina) {
        lascia()
        if (!(ev.target as HTMLElement).closest('button, [role="menu"]')) setAperta(carta.id)
        return
      }
      const colonna = faseSotto(ev.clientX, ev.clientY)
      const fase = colonna?.dataset.fase as Fase | undefined
      const indice = colonna ? [...colonna.querySelectorAll<HTMLElement>(".ing-carta")].filter((c) => c !== elemento && c.getBoundingClientRect().top + c.offsetHeight / 2 < ev.clientY).length : 0
      fotografa()
      lascia()
      if (fase) muovi(carta, { fase, indice })
    }
    const annulla = () => {
      fotografa()
      lascia()
    }
    const tasto = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") annulla()
    }
    window.addEventListener("pointermove", muoviPuntatore)
    window.addEventListener("pointerup", rilascia)
    window.addEventListener("pointercancel", annulla)
    window.addEventListener("keydown", tasto)
  }

  const fine = useCallback(() => setAnnullabile(null), [])
  const chiudiCassetto = useCallback(() => setAperta(null), [])
  const apertaDalla = trattative.find((t) => t.id === aperta)

  if (elencoRivenditori.isSuccess && !rivenditori.length) return null

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
          <div className="ing-riquadri" data-fermo>
            {FASI.map(({ id, titolo }) => <Riquadro key={id} fase={id} titolo={titolo} carte={carteDi(id)} />)}
          </div>

          <div className="ing-bacheca" ref={radice}>
            {FASI.map(({ id: fase, titolo }) => {
              const carte = carteDi(fase)
              const somma = sommaDi(carte)
              return (
                <section key={fase} className={`ing-colonna vetro${sopra === fase ? " ing-colonna--sopra" : ""}`} aria-label={titolo} data-fase={fase}>
                  <header>
                    <h2>{titolo}</h2>
                    <span>{carte.length}</span>
                    <small>{importoTondo(somma)}</small>
                  </header>
                  <div className="ing-colonna__carte">
                    {carte.map((t) => (
                      <article
                        key={t.id}
                        className="ing-carta"
                        data-id={t.id}
                        tabIndex={0}
                        aria-label={`${t.rivenditore.nome}, ${t.titolo}. Arrow keys move it between stages.`}
                        onPointerDown={(e) => prendi(e, t)}
                        onKeyDown={(e) => tastoSullaCarta(e, t)}
                      >
                        <header className="ing-carta__testa">
                          <span className={`ing-sigla ing-tinta${tintaDi(t.rivenditore.nome)}`} aria-hidden="true">{sigla(t.rivenditore.nome)}</span>
                          <span className="ing-carta__chi">
                            <strong>{t.rivenditore.nome}</strong>
                            <small>{t.rivenditore.citta ?? "Town not set"}</small>
                          </span>
                          {scrive ? <MenuSposta titolo={t.rivenditore.nome} fase={t.fase} icone={ICONE} onScegli={(destinazione) => muovi(t, { fase: destinazione, indice: 0 })} /> : null}
                        </header>
                        <p className="ing-carta__titolo">{t.titolo}</p>
                        <footer className="ing-carta__piede">
                          <span>{[t.unita ? conteggioDi(t.unita, "unit") : null, t.ordine_id ? "Draft order" : null].filter(Boolean).join(" · ")}</span>
                          <strong>{t.valore_stimato === null ? "No estimate" : importoTondo(t.valore_stimato)}</strong>
                        </footer>
                      </article>
                    ))}
                    {carte.length ? null : <p className="ing-colonna__vuota">Drop a deal here</p>}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      ) : null}

      {nuova ? <NuovaTrattativa rivenditori={rivenditori} onChiudi={() => setParametri({}, { replace: true })} /> : null}
      {aperta ? (
        <CassettoTrattativa
          id={aperta}
          fase={apertaDalla?.fase}
          rivenditori={rivenditori}
          onSposta={(fase) => apertaDalla && muovi(apertaDalla, { fase, indice: 0 })}
          onChiudi={chiudiCassetto}
        />
      ) : null}
      {annullabile ? <AvvisoAnnulla chiave={annullabile.chiave} testo={annullabile.testo} onAnnulla={annullabile.annulla} onFine={fine} /> : null}
    </>
  )
}
