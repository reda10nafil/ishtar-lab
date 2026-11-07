import { useQuery } from "@tanstack/react-query"
import { LogOut, Menu, Moon, PanelLeft, Search, Sun } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { api } from "../api/client"
import { ConfineErrore } from "../componenti"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import { useTema } from "../tema"
import { impostaValuta } from "../valuta"
import BarraBasso from "./BarraBasso"
import MenuAccount from "./MenuAccount"
import MenuNuovo from "./MenuNuovo"
import Notifiche from "./Notifiche"
import Obiettivo from "./Obiettivo"
import Ricerca from "./Ricerca"
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

export default function Layout() {
  const { sessione, chiudi } = useSessione()
  const { puo } = usePermessi()
  const { tema, alterna } = useTema()
  const [menu, setMenu] = useState(false)
  const [ricerca, setRicerca] = useState(false)
  const [stretta, setStretta] = useState(leggiStretta)
  const { pathname } = useLocation()
  const admin = sessione?.tipo === "admin"
  const daRevisionare = useDaRevisionare(admin && puo("products.review", "edit"))
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
  const nome = admin ? "Ishtar Lab" : sessione?.aziendaNome ?? ""

  useEffect(() => setMenu(false), [pathname])

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setRicerca(true)
      }
    }
    document.addEventListener("keydown", tasto)
    return () => document.removeEventListener("keydown", tasto)
  }, [])

  const riduci = () => {
    const nuova = !stretta
    setStretta(nuova)
    try {
      localStorage.setItem(CHIAVE_STRETTA, nuova ? "1" : "0")
    } catch {
      // La preferenza vale solo per questa visita.
    }
  }

  return (
    <div className={`guscio${stretta ? " guscio--stretta" : ""}`}>
      <div className="aurora" aria-hidden="true" />
      {menu ? <button type="button" className="velo-menu" aria-label="Close menu" onClick={() => setMenu(false)} /> : null}
      <aside className={`laterale vetro${menu ? " laterale--aperta" : ""}`}>
        <div className="marchio">
          <span className="marchio__segno" aria-hidden="true">IL</span>
          <div>
            <strong>Ishtar Lab</strong>
            <small>{admin ? "Store admin" : "Company portal"}</small>
          </div>
        </div>
        <nav aria-label="Main">
          {gruppi.map((gruppo) => (
            <div key={gruppo.titolo} style={{ display: "contents" }}>
              <p className="menu-gruppo">{gruppo.titolo}</p>
              {gruppo.voci.map((voce) => (
                <NavLink key={voce.a} to={voce.a} end={voce.a === "/"} className={() => `voce${appartiene(voce, pathname) ? " active" : ""}`} title={stretta ? voce.etichetta : undefined}>
                  <voce.icona size={19} aria-hidden="true" />
                  <span>{voce.etichetta}</span>
                  {voce.a === "/revisione" && daRevisionare ? <em className="contatore">{daRevisionare}</em> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {admin ? <Obiettivo /> : (
          <button type="button" className="voce voce--esci" onClick={chiudi}>
            <LogOut size={19} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        )}
      </aside>

      <div className="colonna">
        <header className="testata vetro">
          <button type="button" className="icona-pulsante apri-menu" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <button type="button" className="icona-pulsante riduci-menu" aria-label={stretta ? "Expand sidebar" : "Collapse sidebar"} onClick={riduci}>
            <PanelLeft size={18} aria-hidden="true" />
          </button>
          <div className="briciole">
            <span>{nome}</span>
            <b aria-hidden="true">/</b>
            <strong>{corrente?.etichetta ?? "Overview"}</strong>
          </div>
          <div className="testata__azioni">
            <button type="button" className="testata__cerca" aria-label="Search" onClick={() => setRicerca(true)}>
              <Search size={17} aria-hidden="true" />
              <span>Search orders, products...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="stato-rete" title="Data refreshes from the server every 20 seconds">
              <i aria-hidden="true" /> Live
            </span>
            <button type="button" className="icona-pulsante testata__tema" aria-label={tema === "chiaro" ? "Switch to dark" : "Switch to light"} onClick={alterna}>
              {tema === "chiaro" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            </button>
            <Notifiche />
            <MenuNuovo />
            <MenuAccount />
          </div>
        </header>
        <main className="contenuto" id="contenuto">
          <ConfineErrore chiave={pathname}>
            <Suspense fallback={<p className="avviso-stato">Caricamento...</p>}>
              <Outlet />
            </Suspense>
          </ConfineErrore>
        </main>
      </div>
      <BarraBasso voci={inBasso} onAltro={() => setMenu(true)} />
      {ricerca ? <Ricerca voci={voci} onChiudi={() => setRicerca(false)} /> : null}
    </div>
  )
}
