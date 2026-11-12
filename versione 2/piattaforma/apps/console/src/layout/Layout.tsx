import { useQuery } from "@tanstack/react-query"
import { ChevronRight, LogOut, Menu as IconaMenu, Moon, PanelLeft, Search, Sun } from "lucide-react"
import { Fragment, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { api } from "../api/client"
import { ConfineErrore } from "../componenti"
import { numero } from "../lingua"
import { attivaMagnete, attivaSelettori, entraGuscio, precaricaSezioni, useVista } from "../movimenti"
import { usePermessi, type Permesso } from "../permessi"
import { useSessione } from "../sessione"
import { useTema } from "../tema"
import { impostaValuta } from "../valuta"
import BarraBasso from "./BarraBasso"
import { Crea, type Creazione } from "./Crea"
import Foglio from "./Foglio"
import Menu from "./Menu"
import MenuAccount from "./MenuAccount"
import MenuNuovo from "./MenuNuovo"
import Notifiche from "./Notifiche"
import Obiettivo from "./Obiettivo"
import Ricerca from "./Ricerca"
import { ElencoScorciatoie, useScorciatoie } from "./Scorciatoie"
import { appartiene, BASSO_ADMIN, BASSO_AZIENDA, MENU_ADMIN, MENU_AZIENDA, type Voce } from "./voci"

const CHIAVE_STRETTA = "ishtar-menu-stretto"

function leggiStretta() {
  try {
    return localStorage.getItem(CHIAVE_STRETTA) === "1"
  } catch {
    return false
  }
}

function useDaRevisionare(attivo: boolean) {
  const { data } = useQuery({
    queryKey: ["revisione", "conteggio"],
    queryFn: () => api<{ count: number }>("/admin/products?status[]=proposed&limit=1&fields=id"),
    enabled: attivo,
  })
  return data?.count
}

/** Numeri accanto alle voci del menu: ordini da evadere e richieste nuove dei rivenditori. */
function useContatori(attivo: boolean, puo: (...permesso: Permesso) => boolean) {
  const ordini = useQuery({
    queryKey: ["ordini", "riepilogo"],
    queryFn: () => api<{ evasioni: number }>("/admin/ordini/riepilogo"),
    enabled: attivo && puo("orders", "view"),
  })
  const trattative = useQuery({
    queryKey: ["menu", "trattative"],
    queryFn: () => api<{ trattative: { fase: string }[] }>("/admin/ingrosso/trattative"),
    enabled: attivo && puo("ingrosso", "view"),
  })
  const richieste = trattative.data?.trattative.filter((t) => t.fase === "richiesta").length
  return { ordini: ordini.data?.evasioni, richieste }
}

/** Persone sul negozio adesso: senza una fonte il blocco resta «Live». */
function useVisitatori(attivo: boolean) {
  const { data } = useQuery({
    queryKey: ["negozio-online", "visite"],
    queryFn: () => api<{ visite: { adesso: number } | null }>("/admin/negozio-online"),
    enabled: attivo,
  })
  return data?.visite?.adesso
}

/** Briciole come il pannello: area, poi scheda; i canali stanno sotto «Sales channels», Help da solo. */
function bricioleDi(corrente: Voce | undefined, pathname: string) {
  if (!corrente) return [{ testo: "Overview" }]
  if (corrente.canale) return [{ testo: "Sales channels", a: "/negozio-online" }, { testo: corrente.etichetta }]
  const schede = corrente.sotto ?? corrente.schede ?? []
  const scheda = schede.find((v) => pathname === v.a || pathname.startsWith(`${v.a}/`))
  return scheda ? [{ testo: corrente.etichetta, a: corrente.a }, { testo: scheda.etichetta }] : [{ testo: corrente.etichetta }]
}

/** La valuta scelta in Settings vale per tutta l'interfaccia. */
function useValuta(admin: boolean) {
  const { data } = useQuery({
    queryKey: ["valuta", admin],
    queryFn: () => api<{ codice: string }>(`/${admin ? "admin" : "vendor"}/impostazioni/valuta`),
    refetchInterval: false,
    retry: false,
  })
  if (data?.codice) impostaValuta(data.codice)
}

const MISURA_TELEFONO = "(max-width: 860px)"
const ATTESA_PERMESSI = 800

function useTelefono() {
  const [telefono, setTelefono] = useState(() => window.matchMedia(MISURA_TELEFONO).matches)
  useEffect(() => {
    const misura = window.matchMedia(MISURA_TELEFONO)
    const cambia = () => setTelefono(misura.matches)
    misura.addEventListener("change", cambia)
    return () => misura.removeEventListener("change", cambia)
  }, [])
  return telefono
}

export default function Layout() {
  const { sessione, chiudi } = useSessione()
  const { puo, pronto } = usePermessi()
  const { tema, alterna } = useTema()
  const [menu, setMenu] = useState(false)
  const [ricerca, setRicerca] = useState(false)
  const [creazione, setCreazione] = useState<Creazione | null>(null)
  const [stretta, setStretta] = useState(leggiStretta)
  const { pathname } = useLocation()
  const vista = useVista()
  const guscio = useRef<HTMLDivElement>(null)
  const telefono = useTelefono()
  const [scaduto, setScaduto] = useState(false)
  const entrato = useRef(false)
  const visibile = pronto || scaduto
  const admin = sessione?.tipo === "admin"
  const daRevisionare = useDaRevisionare(admin && puo("products.review", "edit"))
  const contatori = useContatori(admin, puo)
  const visitatori = useVisitatori(admin && puo("negozio_online", "view"))
  useValuta(admin)

  const gruppi = useMemo(
    () =>
      (admin ? MENU_ADMIN : MENU_AZIENDA)
        .map((gruppo) => ({ ...gruppo, voci: gruppo.voci.filter((v) => !v.permesso || puo(...v.permesso)) }))
        .filter((gruppo) => gruppo.voci.length),
    [admin, puo]
  )
  const voci = useMemo(() => gruppi.flatMap((g) => g.voci), [gruppi])
  const inBasso = (admin ? BASSO_ADMIN : BASSO_AZIENDA).map((a) => voci.find((v) => v.a === a)).filter((v): v is Voce => Boolean(v))
  const corrente = voci.find((v) => appartiene(v, pathname))
  const briciole = bricioleDi(corrente, pathname)
  const titoloScheda = [...briciole].reverse().map((b) => b.testo).join(" · ")
  const nome = admin ? "Ishtar Lab" : sessione?.aziendaNome ?? ""
  const conteggi = useMemo(
    () => ({
      "/ordini": contatori.ordini ? { valore: contatori.ordini, caldo: true } : undefined,
      "/revisione": daRevisionare ? { valore: daRevisionare, caldo: true } : undefined,
      "/ingrosso": contatori.richieste ? { valore: contatori.richieste } : undefined,
    }),
    [contatori.ordini, contatori.richieste, daRevisionare]
  )

  const riduci = () => {
    setStretta((attuale) => {
      try {
        localStorage.setItem(CHIAVE_STRETTA, attuale ? "0" : "1")
      } catch {
        // La preferenza vale solo per questa visita.
      }
      return !attuale
    })
  }

  const scorciatoie = useScorciatoie({ voci, onCerca: () => setRicerca(true), onRiduci: riduci })

  useEffect(() => {
    setMenu(false)
    setCreazione(null)
  }, [pathname])
  useEffect(() => {
    document.title = `${titoloScheda} — Ishtar Lab`
  }, [titoloScheda])
  useEffect(() => attivaSelettori(), [])
  useEffect(() => attivaMagnete(), [])
  useEffect(() => precaricaSezioni(), [])
  useEffect(() => {
    const attesa = setTimeout(() => setScaduto(true), ATTESA_PERMESSI)
    return () => clearTimeout(attesa)
  }, [])
  // Il menu dipende dai permessi: guscio e pagina entrano insieme appena sono noti, senza voci che spuntano dopo.
  useLayoutEffect(() => {
    if (!visibile || entrato.current || !guscio.current) return
    entrato.current = true
    entraGuscio(guscio.current)
  }, [visibile])

  return (
    <div className={`guscio${stretta ? " guscio--stretta" : ""}${visibile ? "" : " guscio--attesa"}`} ref={guscio}>
      <a className="salta" href="#contenuto">Skip to content</a>
      <div className="aurora" aria-hidden="true" />
      <aside className="laterale vetro" {...(telefono ? { inert: "" } : {})}>
        <div className="marchio">
          <Link to="/" className="marchio__link" aria-label={`${nome}: Overview`}>
            <span className="marchio__segno" aria-hidden="true">IL</span>
            <span className="marchio__testo">
              <strong>{admin ? "Ishtar Lab" : nome}</strong>
              <small>{admin ? "Store admin" : "Company portal"}</small>
            </span>
          </Link>
          <button type="button" className="icona-pulsante riduci-menu" aria-label={stretta ? "Expand sidebar" : "Collapse sidebar"} onClick={riduci}>
            <PanelLeft size={18} aria-hidden="true" />
          </button>
        </div>
        <Menu gruppi={gruppi} pathname={pathname} stretta={stretta} conteggi={conteggi} />
        <div className="laterale__piede">
          {admin ? <Obiettivo /> : (
            <button type="button" className="voce voce--esci" onClick={chiudi}>
              <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </aside>

      <div className="colonna">
        <header className="testata vetro">
          <button type="button" className="icona-pulsante apri-menu" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <IconaMenu size={20} aria-hidden="true" />
          </button>
          <nav className="briciole" aria-label="Breadcrumb">
            <span>{nome}</span>
            {briciole.map((briciola, indice) => (
              <Fragment key={briciola.testo}>
                <ChevronRight size={14} aria-hidden="true" />
                {indice === briciole.length - 1 ? <strong>{briciola.testo}</strong> : <Link to={briciola.a ?? "/"}>{briciola.testo}</Link>}
              </Fragment>
            ))}
            <div className="briciole__telefono">
              <span className="marchio__segno" aria-hidden="true">IL</span>
              <span>{corrente?.etichetta ?? "Overview"}</span>
            </div>
          </nav>
          <div className="testata__azioni">
            <button type="button" className="testata__cerca" aria-label="Search" onClick={() => setRicerca(true)}>
              <Search size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Search orders, products...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <Link to="/negozio-online" className="stato-rete" aria-label={visitatori === undefined ? "Live data, refreshed every 20 seconds" : `${visitatori} people on the online shop now`}>
              <i aria-hidden="true" /> {visitatori === undefined ? "Live" : `${numero(visitatori)} on the shop`}
            </Link>
            <button type="button" className="icona-pulsante testata__tema" aria-label={tema === "chiaro" ? "Switch to dark" : "Switch to light"} data-suggerimento={tema === "chiaro" ? "Dark" : "Light"} onClick={alterna}>
              {tema === "chiaro" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            </button>
            <Notifiche />
            <MenuNuovo onCrea={setCreazione} />
            <MenuAccount onScorciatoie={scorciatoie.apriElenco} />
          </div>
        </header>
        <main className="contenuto" id="contenuto">
          <div className="vista" ref={vista.radice}>
            <ConfineErrore chiave={vista.chiave}>
              <Suspense fallback={null}>{visibile ? vista.contenuto : null}</Suspense>
            </ConfineErrore>
          </div>
        </main>
      </div>
      {pronto ? <BarraBasso voci={inBasso} onAltro={() => setMenu(true)} /> : null}
      {menu ? <Foglio gruppi={gruppi} pathname={pathname} nome={nome} conteggi={conteggi} onChiudi={() => setMenu(false)} onCrea={setCreazione} /> : null}
      {ricerca ? <Ricerca voci={voci} onChiudi={() => setRicerca(false)} onCrea={setCreazione} /> : null}
      {creazione ? (
        <ConfineErrore chiave={creazione}>
          <Crea tipo={creazione} onChiudi={() => setCreazione(null)} />
        </ConfineErrore>
      ) : null}
      {scorciatoie.elenco ? <ElencoScorciatoie onChiudi={scorciatoie.chiudiElenco} /> : null}
    </div>
  )
}
