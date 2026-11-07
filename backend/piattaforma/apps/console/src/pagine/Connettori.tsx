import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Plug, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../api/client"
import type { Connettore } from "../api/tipi"
import { CampoRicerca, Vuoto } from "../componenti"
import { Pagina, Stato } from "../ui"
import { LogoServizio } from "./LogoServizio"
import ModaleConnettore from "./ModaleConnettore"

const CATEGORIE: Record<string, { nome: string }> = {
  social: { nome: "Social" },
  messaggi: { nome: "Messaging" },
  spedizioni: { nome: "Shipping" },
  pagamenti: { nome: "Payments" },
  contabilita: { nome: "Accounting" },
  email: { nome: "Email" },
  negozi: { nome: "Shops" },
  ai: { nome: "AI" },
  analisi: { nome: "Analytics" },
}

function Scheda({ connettore, onApri }: { connettore: Connettore; onApri: () => void }) {
  const { nome } = CATEGORIE[connettore.categoria] ?? CATEGORIE.analisi
  const collegato = connettore.stato === "collegato"
  const errore = connettore.stato === "errore"
  return (
    <article className="connettore vetro">
      <header>
        <LogoServizio id={connettore.id} nome={connettore.nome} />
        <div>
          <h3>{connettore.nome}</h3>
          <small>{nome} · by {connettore.fornitore}</small>
        </div>
      </header>
      <p>{connettore.descrizione}</p>
      <footer>
        <span className="connettore__accesso">{connettore.id === "demo" ? "Test only" : connettore.accesso === "login" ? "Account sign-in" : "API key"}{connettore.fase === "vendite" ? " · for sales" : ""}</span>
        {collegato ? (
          <button type="button" className="connettore__stato" onClick={onApri} aria-label={`${connettore.nome} connected: manage`}>
            <Check size={16} aria-hidden="true" /> Connected
          </button>
        ) : errore ? (
          <button type="button" className="connettore__stato connettore__stato--errore" onClick={onApri} aria-label={`${connettore.nome}: fix the error`}>
            <TriangleAlert size={16} aria-hidden="true" /> Needs fixing
          </button>
        ) : (
          <button type="button" className="primario" onClick={onApri} aria-label={`Connect ${connettore.nome}`}>
            {connettore.stato === "da_collegare" ? "Finish" : "Connect"}
          </button>
        )}
      </footer>
    </article>
  )
}

export default function Connettori() {
  const client = useQueryClient()
  const [parametri, setParametri] = useSearchParams()
  const [vista, setVista] = useState<"collegati" | "disponibili">("disponibili")
  const [categoria, setCategoria] = useState("tutti")
  const [cerca, setCerca] = useState("")
  const [apertoId, setApertoId] = useState<string | null>(null)
  const [notizia, setNotizia] = useState<{ testo: string; errore: boolean } | null>(null)

  const query = useQuery({ queryKey: ["connettori"], queryFn: () => api<{ connettori: Connettore[] }>("/admin/connectors") })
  const tutti = useMemo(() => query.data?.connettori ?? [], [query.data])

  useEffect(() => {
    const collegato = parametri.get("collegato")
    const errore = parametri.get("errore")
    if (!collegato && !errore) return
    setNotizia(collegato ? { testo: "Connection complete.", errore: false } : { testo: "Sign-in failed: try again from the connector.", errore: true })
    setParametri({}, { replace: true })
    void client.invalidateQueries({ queryKey: ["connettori"] })
  }, [parametri, setParametri, client])

  const collegati = tutti.filter((c) => c.stato !== "non_collegato")
  const base = vista === "collegati" ? collegati : tutti
  const testo = cerca.trim().toLowerCase()
  const visibili = base.filter(
    (c) => (categoria === "tutti" || c.categoria === categoria) && (!testo || `${c.nome} ${c.fornitore} ${c.descrizione}`.toLowerCase().includes(testo))
  )
  const categorie = Object.keys(CATEGORIE).filter((k) => tutti.some((c) => c.categoria === k))
  const aperto = tutti.find((c) => c.id === apertoId)
  const nessunaCollegata = vista === "collegati" && !collegati.length

  return (
    <Pagina titolo="Apps & connectors" sottotitolo="Connect social networks, shipping, payments and other services with your account or an API key.">
      {notizia ? <p className={`avviso-stato ${notizia.errore ? "avviso-stato--errore" : "avviso-stato--ok"}`} role="status">{notizia.testo}</p> : null}

      {/* Dentro una riga: da sola, in colonna, la ricerca crescerebbe in altezza. */}
      <div className="filtri">
        <div className="selettore selettore--stretto" role="group" aria-label="View">
          <button type="button" aria-pressed={vista === "collegati"} className={vista === "collegati" ? "attivo" : ""} onClick={() => setVista("collegati")}>
            Installed <em>{collegati.length}</em>
          </button>
          <button type="button" aria-pressed={vista === "disponibili"} className={vista === "disponibili" ? "attivo" : ""} onClick={() => setVista("disponibili")}>
            Browse
          </button>
        </div>
        <CampoRicerca valore={cerca} etichetta="Search apps" onCambia={setCerca} />
      </div>

      <div className="filtri" role="group" aria-label="Category">
        {["tutti", ...categorie].map((k) => (
          <button key={k} type="button" aria-pressed={categoria === k} className={categoria === k ? "attivo" : ""} onClick={() => setCategoria(k)}>
            {k === "tutti" ? "All" : CATEGORIE[k].nome}
          </button>
        ))}
      </div>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !visibili.length ? (
        <Vuoto
          icona={Plug}
          titolo={nessunaCollegata ? "No apps connected yet" : "No apps found"}
          testo={nessunaCollegata ? "Pick a service under Browse to connect it." : "Change the search or the category."}
        />
      ) : null}
      <div className="griglia-connettori">
        {visibili.map((c) => <Scheda key={c.id} connettore={c} onApri={() => setApertoId(c.id)} />)}
      </div>

      {aperto ? <ModaleConnettore connettore={aperto} onChiudi={() => setApertoId(null)} /> : null}
    </Pagina>
  )
}
