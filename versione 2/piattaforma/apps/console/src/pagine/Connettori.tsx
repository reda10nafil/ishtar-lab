import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, Check, CircleCheck, Download, Gift, Globe, LayoutGrid, Plug, RefreshCw, Scissors, Star, TriangleAlert, Truck, type LucideIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "react-router-dom"
import { api } from "../api/client"
import type { Connettore } from "../api/tipi"
import { CampoRicerca, Interruttore, useAvvisi, Vuoto } from "../componenti"
import { anima, CURVE, TEMPI } from "../movimenti"
import { Conferma, Etichetta, euro, Pagina, Stato } from "../ui"
import { LogoServizio } from "./LogoServizio"
import ModaleConnettore from "./ModaleConnettore"
import "../sezioni/impostazioni/fedele.css"
import "../sezioni/impostazioni/apps.css"

type AppDemo = {
  id: string
  nome: string
  categoria: string
  fornitore: string
  descrizione: string
  voto: number
  prezzo_mese: number | null
  icona: string
  installata: boolean
  attiva: boolean
}

type RispostaApp = { app: AppDemo[]; connettori_spenti: string[] }

/** Una riga dell'elenco: un'app dimostrativa o un connettore vero. */
type Voce =
  | { tipo: "app"; id: string; nome: string; categoria: string; fornitore: string; descrizione: string; attiva: boolean; installata: boolean; app: AppDemo }
  | { tipo: "connettore"; id: string; nome: string; categoria: string; fornitore: string; descrizione: string; attiva: boolean; installata: boolean; connettore: Connettore }

const CHIAVE = ["app"]
const ATTESA_INSTALLA_MS = 1400
const DURATA_ANNULLA_MS = 5000

const CATEGORIE: Record<string, string> = {
  shipping: "Shipping",
  marketing: "Marketing",
  finance: "Finance",
  checkout: "Checkout",
  sales: "Sales",
  inventory: "Inventory",
  social: "Social",
  messaggi: "Messaging",
  spedizioni: "Shipping",
  pagamenti: "Payments",
  contabilita: "Accounting",
  email: "Email",
  negozi: "Shops",
  ai: "AI",
  analisi: "Analytics",
}

const ICONE: Record<string, LucideIcon> = { truck: Truck, star: Star, book: BookOpen, gift: Gift, refresh: RefreshCw, grid: LayoutGrid, scissors: Scissors, globe: Globe }

const STATI_CONNETTORE = {
  collegato: { testo: "Running", tono: "ok" },
  errore: { testo: "Needs fixing", tono: "errore" },
  da_collegare: { testo: "To finish", tono: "attesa" },
  non_collegato: { testo: "Not connected", tono: "neutro" },
} as const

const prezzoDi = (app: AppDemo) => (app.prezzo_mese === null ? "Free" : `${euro(app.prezzo_mese).replace(/\.00$/, "")}/mo`)
const accessoDi = (c: Connettore) => (c.id === "demo" ? "Test only" : c.accesso === "login" ? "Account sign-in" : "API key")

type ProprietaScheda = {
  voce: Voce
  installate: boolean
  installando: boolean
  onInstalla: () => void
  onApri: () => void
  onTogli: () => void
  onAccendi: (attiva: boolean) => void
}

function Scheda({ voce, installate, installando, onInstalla, onApri, onTogli, onAccendi }: ProprietaScheda) {
  const categoria = CATEGORIE[voce.categoria] ?? "Other"
  const Icona = voce.tipo === "app" ? ICONE[voce.app.icona] ?? Plug : null
  const stato = voce.tipo === "connettore" ? STATI_CONNETTORE[voce.connettore.stato] : null
  const pronta = voce.tipo === "app" || voce.connettore.stato === "collegato"
  return (
    <article className={installate && !voce.attiva ? "connettore connettore--spenta vetro" : "connettore vetro"}>
      <header>
        {Icona ? <span className="connettore__icona" aria-hidden="true"><Icona size={21} /></span> : <LogoServizio id={voce.id} nome={voce.nome} />}
        <div>
          <h3>{voce.nome}</h3>
          <small>{installate ? `by ${voce.fornitore}` : `${categoria} · by ${voce.fornitore}`}</small>
        </div>
        {installate && pronta ? <Interruttore acceso={voce.attiva} etichetta={`${voce.nome} on`} onCambia={onAccendi} /> : null}
        {!installate && voce.tipo === "app" ? <span className="apps__voto"><Star size={13} fill="currentColor" aria-hidden="true" /> {voce.app.voto}</span> : null}
      </header>
      <p>{voce.descrizione}</p>
      <footer>
        {installate ? (
          <>
            <span className="apps__piede-sinistra">
              {voce.tipo === "app" ? (
                <>
                  <Etichetta tono={voce.attiva ? "ok" : "neutro"}>{voce.attiva ? "Running" : "Off"}</Etichetta> {prezzoDi(voce.app)}
                </>
              ) : (
                <>
                  <Etichetta tono={voce.attiva || !pronta ? stato!.tono : "neutro"}>{pronta && !voce.attiva ? "Off" : stato!.testo}</Etichetta> {accessoDi(voce.connettore)}
                </>
              )}
            </span>
            <span className="apps__azioni">
              {voce.tipo === "connettore" ? <button type="button" className="apps__gestisci" onClick={onApri} aria-label={`${voce.nome}: manage`}>Manage</button> : null}
              <button type="button" className="apps__togli" onClick={onTogli} aria-label={`Uninstall ${voce.nome}`}>Uninstall</button>
            </span>
          </>
        ) : voce.tipo === "app" ? (
          <>
            <span className="connettore__accesso">{prezzoDi(voce.app)}</span>
            {voce.installata ? (
              <span className="connettore__stato"><Check size={16} aria-hidden="true" /> Installed</span>
            ) : (
              <button type="button" className="primario pulsante-piccolo" disabled={installando} onClick={onInstalla} aria-label={`Install ${voce.nome}`}>
                <Download size={15} aria-hidden="true" /> Install
              </button>
            )}
          </>
        ) : (
          <>
            <span className="connettore__accesso">{accessoDi(voce.connettore)}{voce.connettore.fase === "vendite" ? " · for sales" : ""}</span>
            {voce.connettore.stato === "collegato" ? (
              <button type="button" className="connettore__stato" onClick={onApri} aria-label={`${voce.nome} connected: manage`}>
                <Check size={16} aria-hidden="true" /> Connected
              </button>
            ) : voce.connettore.stato === "errore" ? (
              <button type="button" className="connettore__stato connettore__stato--errore" onClick={onApri} aria-label={`${voce.nome}: fix the error`}>
                <TriangleAlert size={16} aria-hidden="true" /> Needs fixing
              </button>
            ) : (
              <button type="button" className="primario pulsante-piccolo" onClick={onApri} aria-label={`Connect ${voce.nome}`}>
                <Download size={15} aria-hidden="true" /> {voce.connettore.stato === "da_collegare" ? "Finish" : "Connect"}
              </button>
            )}
          </>
        )}
      </footer>
    </article>
  )
}

/** Avviso con Annulla: quello comune non ha azioni, quindi questo ne riprende l'aspetto. */
function AvvisoAnnulla({ testo, onAnnulla, onFine }: { testo: string; onAnnulla: () => void; onFine: () => void }) {
  useEffect(() => {
    const attesa = setTimeout(onFine, DURATA_ANNULLA_MS)
    return () => clearTimeout(attesa)
  }, [onFine])
  return createPortal(
    <div className="avvisi apps__annulla" aria-live="polite">
      <p>
        <CircleCheck size={18} aria-hidden="true" />
        <span>{testo}</span>
        <button type="button" onClick={onAnnulla}>Undo</button>
      </p>
    </div>,
    document.body
  )
}

export default function Connettori() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [parametri, setParametri] = useSearchParams()
  const [vista, setVista] = useState<"collegati" | "disponibili">("collegati")
  const [categoria, setCategoria] = useState("All")
  const [cerca, setCerca] = useState("")
  const [apertoId, setApertoId] = useState<string | null>(null)
  const [daTogliere, setDaTogliere] = useState<Voce | null>(null)
  const [annullabile, setAnnullabile] = useState<AppDemo | null>(null)
  const [notizia, setNotizia] = useState<{ testo: string; errore: boolean } | null>(null)

  const griglia = useRef<HTMLDivElement>(null)
  const primaVolta = useRef(true)

  // Cambiando filtro o vista le schede rientrano in sequenza; la prima entrata la fa il guscio.
  useEffect(() => {
    if (primaVolta.current) {
      primaVolta.current = false
      return
    }
    ;[...(griglia.current?.children ?? [])].forEach((scheda, indice) => {
      anima(scheda, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], {
        duration: TEMPI.entrataRiga,
        delay: indice * 24,
        easing: CURVE.fuori3,
      })
    })
  }, [vista, categoria])

  const connettori = useQuery({ queryKey: ["connettori"], queryFn: () => api<{ connettori: Connettore[] }>("/admin/connectors") })
  const app = useQuery({ queryKey: CHIAVE, queryFn: () => api<RispostaApp>("/admin/impostazioni/app") })
  const tutti = useMemo(() => connettori.data?.connettori ?? [], [connettori.data])

  useEffect(() => {
    const collegato = parametri.get("collegato")
    const errore = parametri.get("errore")
    if (!collegato && !errore) return
    setNotizia(collegato ? { testo: "Connection complete.", errore: false } : { testo: "Sign-in failed: try again from the connector.", errore: true })
    setParametri({}, { replace: true })
    void client.invalidateQueries({ queryKey: ["connettori"] })
  }, [parametri, setParametri, client])

  const voci = useMemo<Voce[]>(() => {
    const spenti = new Set(app.data?.connettori_spenti ?? [])
    return [
      ...(app.data?.app ?? []).map((a): Voce => ({ tipo: "app", id: a.id, nome: a.nome, categoria: a.categoria, fornitore: a.fornitore, descrizione: a.descrizione, attiva: a.attiva, installata: a.installata, app: a })),
      ...tutti.map((c): Voce => ({ tipo: "connettore", id: c.id, nome: c.nome, categoria: c.categoria, fornitore: c.fornitore, descrizione: c.descrizione, attiva: !spenti.has(c.id), installata: c.stato !== "non_collegato", connettore: c })),
    ]
  }, [app.data, tutti])

  const cambia = (id: string, corpo: { installata?: boolean; attiva?: boolean }) => api<RispostaApp>(`/admin/impostazioni/app/${encodeURIComponent(id)}`, { corpo })
  const aggiorna = (risposta: RispostaApp) => client.setQueryData(CHIAVE, risposta)

  const accendi = useMutation({
    mutationFn: ({ voce, attiva }: { voce: Voce; attiva: boolean }) => cambia(voce.id, { attiva }),
    onSuccess: (risposta, { voce, attiva }) => {
      aggiorna(risposta)
      avvisa(`${voce.nome} is ${attiva ? "on" : "off"}`)
    },
    onError: segnalaErrore,
  })
  const installa = useMutation({
    mutationFn: async (voce: Voce) => {
      // Come nel pannello, l'installazione ha un suo tempo: il pulsante non scatta di colpo.
      const [risposta] = await Promise.all([cambia(voce.id, { installata: true }), new Promise((fatto) => setTimeout(fatto, ATTESA_INSTALLA_MS))])
      return risposta as RispostaApp
    },
    onSuccess: (risposta, voce) => {
      aggiorna(risposta)
      avvisa(`${voce.nome} installed and switched on`)
    },
    onError: segnalaErrore,
  })
  const togli = useMutation({
    mutationFn: (voce: Voce) =>
      voce.tipo === "app" ? cambia(voce.id, { installata: false }) : api(`/admin/connectors/${encodeURIComponent(voce.id)}`, { metodo: "DELETE" }),
    onSuccess: (risposta, voce) => {
      setDaTogliere(null)
      if (voce.tipo === "app") {
        aggiorna(risposta as RispostaApp)
        setAnnullabile(voce.app)
      } else {
        // Le chiavi di un connettore sono cancellate davvero: non si può tornare indietro.
        avvisa(`${voce.nome} uninstalled`)
        void client.invalidateQueries({ queryKey: ["connettori"] })
        void client.invalidateQueries({ queryKey: ["avvisi"] })
      }
    },
    onError: segnalaErrore,
  })
  const annulla = useMutation({
    mutationFn: (a: AppDemo) => cambia(a.id, { installata: true, attiva: a.attiva }),
    onSuccess: aggiorna,
    onError: segnalaErrore,
  })

  const installate = vista === "collegati"
  const presenti = voci.filter((v) => v.installata)
  const accese = presenti.filter((v) => v.attiva).length
  const base = installate ? presenti : voci
  const testo = cerca.trim().toLowerCase()
  const visibili = base.filter(
    (v) => (installate || categoria === "All" || CATEGORIE[v.categoria] === categoria) && (!testo || `${v.nome} ${v.fornitore} ${v.descrizione}`.toLowerCase().includes(testo))
  )
  const categorie = ["All", ...new Set(Object.keys(CATEGORIE).filter((k) => voci.some((v) => v.categoria === k)).map((k) => CATEGORIE[k]))]
  const aperto = tutti.find((c) => c.id === apertoId)
  const nessunaCollegata = installate && !presenti.length
  const pronte = connettori.isSuccess && app.isSuccess
  const chiudiAnnulla = useMemo(() => () => setAnnullabile(null), [])

  return (
    <Pagina
      titolo="Apps & connectors"
      sottotitolo={installate ? `${presenti.length} ${presenti.length === 1 ? "app" : "apps"} working for the store · ${accese} switched on.` : "Tools and services for a fashion store."}
    >
      <div className="fedele">
        {notizia ? <p className={`avviso-stato ${notizia.errore ? "avviso-stato--errore" : "avviso-stato--ok"}`} role="status">{notizia.testo}</p> : null}

        <div className="apps__barra">
          <div className="apps__selettore" role="group" aria-label="View">
            <button type="button" aria-pressed={installate} className={installate ? "attivo" : ""} onClick={() => setVista("collegati")}>
              Installed <em>{presenti.length}</em>
            </button>
            <button type="button" aria-pressed={!installate} className={installate ? "" : "attivo"} onClick={() => setVista("disponibili")}>
              Browse
            </button>
          </div>
          <CampoRicerca valore={cerca} etichetta="Search apps" onCambia={setCerca} />
        </div>

        {installate ? null : (
          <div className="apps__filtri" role="group" aria-label="Category">
            {categorie.map((k) => (
              <button key={k} type="button" aria-pressed={categoria === k} className={categoria === k ? "attivo" : ""} onClick={() => setCategoria(k)}>{k}</button>
            ))}
          </div>
        )}

        <Stato caricamento={connettori.isLoading || app.isLoading} errore={connettori.error ?? app.error} vuoto={false} testoVuoto="" />
        {pronte && !visibili.length ? (
          <Vuoto
            icona={Plug}
            titolo={nessunaCollegata ? "No apps installed yet" : "No apps found"}
            testo={nessunaCollegata ? "Pick one under Browse to install it." : "Change the search or the category."}
          />
        ) : null}
        <div className="griglia-connettori" ref={griglia}>
          {visibili.map((v) => (
            <Scheda
              key={`${v.tipo}-${v.id}`}
              voce={v}
              installate={installate}
              installando={installa.isPending && installa.variables?.id === v.id}
              onInstalla={() => installa.mutate(v)}
              onApri={() => setApertoId(v.id)}
              onTogli={() => setDaTogliere(v)}
              onAccendi={(attiva) => accendi.mutate({ voce: v, attiva })}
            />
          ))}
        </div>

        {aperto ? <ModaleConnettore connettore={aperto} onChiudi={() => setApertoId(null)} /> : null}
        {daTogliere ? (
          <Conferma
            titolo={`Uninstall ${daTogliere.nome}?`}
            testo={daTogliere.tipo === "app" ? "Its setup is cleared. You can add it again from Browse." : "Its saved keys are deleted. You can connect it again from Browse."}
            azione="Uninstall"
            attesa={togli.isPending}
            onConferma={() => togli.mutate(daTogliere)}
            onChiudi={() => setDaTogliere(null)}
          />
        ) : null}
        {annullabile ? (
          <AvvisoAnnulla
            testo={`${annullabile.nome} uninstalled`}
            onAnnulla={() => {
              annulla.mutate(annullabile)
              setAnnullabile(null)
            }}
            onFine={chiudiAnnulla}
          />
        ) : null}
      </div>
    </Pagina>
  )
}
