import { lazy } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import Apertura from "./layout/Apertura"
import Layout from "./layout/Layout"
import Accesso from "./pagine/Accesso"
import Aziende from "./pagine/Aziende"
import Connettori from "./pagine/Connettori"
import Invito from "./pagine/Invito"
import InvitoTeam from "./pagine/InvitoTeam"
import Panoramica from "./pagine/Panoramica"
import Registro from "./pagine/Registro"
import Revisione from "./pagine/Revisione"
import TeamAdmin from "./pagine/TeamAdmin"
import TeamAzienda from "./pagine/TeamAzienda"
import { usePermessi, type Permesso } from "./permessi"
import { useSessione } from "./sessione"

// Ogni sezione vive in `src/sezioni/<nome>/` e gestisce da sola le sue sotto-rotte.
const Analisi = lazy(() => import("./sezioni/analisi"))
const Assistenza = lazy(() => import("./sezioni/assistenza"))
const Cassa = lazy(() => import("./sezioni/cassa"))
const Clienti = lazy(() => import("./sezioni/clienti"))
const Evasioni = lazy(() => import("./sezioni/evasioni"))
const Impostazioni = lazy(() => import("./sezioni/impostazioni"))
const Ingrosso = lazy(() => import("./sezioni/ingrosso"))
const Magazzino = lazy(() => import("./sezioni/magazzino"))
const Marketing = lazy(() => import("./sezioni/marketing"))
const NegozioOnline = lazy(() => import("./sezioni/negozio-online"))
const Ordini = lazy(() => import("./sezioni/ordini"))
const Outfit = lazy(() => import("./sezioni/outfit"))
const Prodotti = lazy(() => import("./sezioni/prodotti"))
const Sconti = lazy(() => import("./sezioni/sconti"))

function Protetta({ tipo, permesso }: { tipo?: "admin" | "azienda"; permesso?: Permesso }) {
  const { sessione } = useSessione()
  const { puo, pronto } = usePermessi()
  if (!sessione) return <Apertura />
  if (tipo && sessione.tipo !== tipo) return <Navigate to="/" replace />
  if (permesso && !pronto) return <p className="avviso-stato">Caricamento...</p>
  if (permesso && !puo(...permesso)) return <Navigate to="/" replace />
  return <Outlet />
}

/** La stessa voce porta a pagine diverse per amministratore e azienda. */
function PerProfilo({ admin, azienda }: { admin: JSX.Element; azienda: JSX.Element }) {
  const { sessione } = useSessione()
  return sessione?.tipo === "admin" ? admin : azienda
}

export default function App() {
  return (
    <Routes>
      <Route path="/accesso-azienda" element={<Accesso />} />
      <Route path="/accesso" element={<Navigate to="/" replace />} />
      <Route path="/invito" element={<Invito />} />
      <Route path="/invito-team" element={<InvitoTeam />} />
      <Route element={<Protetta />}>
        <Route element={<Layout />}>
          <Route index element={<Panoramica />} />
          <Route path="team" element={<PerProfilo admin={<TeamAdmin />} azienda={<TeamAzienda />} />} />
          <Route element={<Protetta permesso={["assistenza", "view"]} />}><Route path="assistenza/*" element={<Assistenza />} /></Route>
          <Route element={<Protetta permesso={["products", "view"]} />}><Route path="prodotti/*" element={<Prodotti />} /></Route>
          <Route element={<Protetta permesso={["orders", "view"]} />}><Route path="ordini/*" element={<Ordini />} /></Route>
          <Route element={<Protetta permesso={["evasioni", "view"]} />}><Route path="evasioni/*" element={<Evasioni />} /></Route>
          <Route element={<Protetta permesso={["magazzino", "view"]} />}><Route path="magazzino/*" element={<Magazzino />} /></Route>
          <Route element={<Protetta permesso={["outfit", "view"]} />}><Route path="outfit/*" element={<Outfit />} /></Route>
          <Route element={<Protetta permesso={["sconti", "view"]} />}><Route path="sconti/*" element={<Sconti />} /></Route>
          <Route element={<Protetta tipo="admin" />}>
            <Route element={<Protetta permesso={["sellers", "view"]} />}><Route path="aziende" element={<Aziende />} /></Route>
            <Route element={<Protetta permesso={["products.review", "edit"]} />}><Route path="revisione" element={<Revisione />} /></Route>
            <Route element={<Protetta permesso={["connettori", "view"]} />}><Route path="connettori" element={<Connettori />} /></Route>
            <Route element={<Protetta permesso={["registro", "view"]} />}><Route path="registro" element={<Registro />} /></Route>
            <Route element={<Protetta permesso={["customers", "view"]} />}><Route path="clienti/*" element={<Clienti />} /></Route>
            <Route element={<Protetta permesso={["analisi", "view"]} />}><Route path="analisi/*" element={<Analisi />} /></Route>
            <Route element={<Protetta permesso={["marketing", "view"]} />}><Route path="marketing/*" element={<Marketing />} /></Route>
            <Route element={<Protetta permesso={["negozio_online", "view"]} />}><Route path="negozio-online/*" element={<NegozioOnline />} /></Route>
            <Route element={<Protetta permesso={["cassa", "view"]} />}><Route path="cassa/*" element={<Cassa />} /></Route>
            <Route element={<Protetta permesso={["ingrosso", "view"]} />}><Route path="ingrosso/*" element={<Ingrosso />} /></Route>
            <Route element={<Protetta permesso={["impostazioni", "view"]} />}><Route path="impostazioni/*" element={<Impostazioni />} /></Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
