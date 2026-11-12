import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Schede } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Pagina } from "../../ui"
import "../analisi/analisi.css"
import "../analisi/panoramica.css"
import Automazioni from "./Automazioni"
import Campagne from "./Campagne"
import "./marketing.css"
import ModuloCampagna from "./ModuloCampagna"

const SOTTOTITOLI: Record<string, string> = {
  "/marketing/campagne": "Every send, and how many people it really reached.",
  "/marketing/automazioni": "Emails that go out on their own, when a customer does something.",
}

function Guscio() {
  const { pathname } = useLocation()
  const [cerca, setCerca] = useSearchParams()
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const [nuova, setNuova] = useState(false)

  useEffect(() => {
    if (cerca.get("nuovo") !== "1") return
    setNuova(true)
    setCerca({}, { replace: true })
  }, [cerca, setCerca])

  return (
    <Pagina
      titolo="Marketing"
      sottotitolo={SOTTOTITOLI[pathname] ?? SOTTOTITOLI["/marketing/campagne"]}
      azioni={
        puo("marketing", "edit") ? (
          <button type="button" className="primario mk-nuova" onClick={() => setNuova(true)}>
            <Plus size={18} aria-hidden="true" /> New campaign
          </button>
        ) : null
      }
    >
      <Schede
        etichetta="Marketing sections"
        voci={[
          { a: "/marketing/campagne", etichetta: "Campaigns" },
          { a: "/marketing/automazioni", etichetta: "Automations" },
        ]}
      />
      <Outlet />
      {nuova ? (
        <ModuloCampagna
          onChiudi={() => setNuova(false)}
          onFatto={() => {
            setNuova(false)
            naviga("/marketing/campagne")
          }}
        />
      ) : null}
    </Pagina>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route element={<Guscio />}>
        <Route index element={<Navigate to="campagne" replace />} />
        <Route path="campagne" element={<Campagne />} />
        <Route path="automazioni" element={<Automazioni />} />
      </Route>
      <Route path="*" element={<Navigate to="campagne" replace />} />
    </Routes>
  )
}
