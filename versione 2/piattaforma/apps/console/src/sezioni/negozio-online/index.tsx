import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { Cifra } from "../../movimenti"
import { usePermessi } from "../../permessi"
import { Pagina, Stato } from "../../ui"
import "../cassa/canali.css"
import "../cassa/cassa.css"
import { SchedeCanali } from "../cassa/SchedeCanali"
import { Anteprima } from "./Anteprima"
import "./negozio-online.css"
import { Pagine } from "./Pagine"
import type { Accento, DatiVetrina, StatoNegozio, Visite } from "./tipi"

const CHIAVE = ["negozio-online", "stato"]
const ATTESA_SALVATAGGIO = 500

const ACCENTI: { valore: Accento; nome: string }[] = [
  { valore: "rosa", nome: "Rose" },
  { valore: "mare", nome: "Sea" },
  { valore: "sabbia", nome: "Sand" },
]

function Aspetto({ vetrina, massimo, onCambia, disattivo }: { vetrina: DatiVetrina; massimo: number; onCambia: (parte: Partial<DatiVetrina>) => void; disattivo: boolean }) {
  const restanti = massimo - vetrina.annuncio.length
  return (
    <section className="negozio__blocco vetro" aria-label="Look and message">
      <div className="canale-testa">
        <div>
          <h2>Look &amp; message</h2>
          <p>Saved on the server as you go, not online yet</p>
        </div>
      </div>
      <label className="canale-campo">
        <span>Header name</span>
        <input value={vetrina.testata} maxLength={60} disabled={disattivo} onChange={(e) => onCambia({ testata: e.target.value })} />
      </label>
      <label className="canale-campo">
        <span>Announcement bar</span>
        <input value={vetrina.annuncio} maxLength={massimo} disabled={disattivo} onChange={(e) => onCambia({ annuncio: e.target.value })} />
        <small>{restanti} characters left</small>
      </label>
      <label className="canale-campo">
        <span>Message</span>
        <input value={vetrina.messaggio} maxLength={120} disabled={disattivo} onChange={(e) => onCambia({ messaggio: e.target.value })} />
      </label>
      <div className="canale-campo">
        <span>Accent colour</span>
        <div className="selettore negozio__accento">
          {ACCENTI.map((a) => (
            <button key={a.valore} type="button" className={a.valore === vetrina.accento ? "attivo" : undefined} aria-pressed={a.valore === vetrina.accento} disabled={disattivo} onClick={() => onCambia({ accento: a.valore })}>{a.nome}</button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Visitatori({ visite }: { visite: Visite | null }) {
  const massimo = Math.max(1, ...(visite?.citta ?? []).map((c) => c.visitatori))
  return (
    <section className="negozio__blocco vetro" aria-label="Visiting now">
      <div className="canale-testa">
        <div>
          <h2>Visiting now</h2>
          <p>By town · sample figures until the site is live</p>
        </div>
        {visite ? <span className="negozio__dal-vivo"><i aria-hidden="true" /><Cifra valore={visite.adesso} formato={numero} /></span> : null}
      </div>
      {visite ? (
        <div className="negozio__visite">
          {visite.citta.map((citta) => (
            <div className="negozio__visita" key={citta.nome}>
              <span>{citta.nome}</span>
              <span className="negozio__barra"><i style={{ transform: `scaleX(${citta.visitatori / massimo})` }} /></span>
              <b>{numero(citta.visitatori)}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="negozio__nulla">Nobody can visit yet: the count starts when the public site exists.</p>
      )}
    </section>
  )
}

function Negozio() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { puo } = usePermessi()
  const { data, isLoading, error } = useQuery({ queryKey: CHIAVE, queryFn: () => api<StatoNegozio>("/admin/negozio-online"), refetchInterval: false })
  const [bozza, setBozza] = useState<DatiVetrina | null>(null)
  const attesa = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (data && !bozza) {
      const { testata, annuncio, accento, messaggio } = data.vetrina
      setBozza({ testata, annuncio, accento, messaggio })
    }
  }, [data, bozza])

  const salva = useMutation({
    mutationFn: (dati: DatiVetrina) => api("/admin/negozio-online", { corpo: dati }),
    onSuccess: () => client.invalidateQueries({ queryKey: CHIAVE }),
    onError: segnalaErrore,
  })

  useEffect(() => () => clearTimeout(attesa.current), [])

  const cambia = (parte: Partial<DatiVetrina>) => {
    if (!bozza) return
    const nuova = { ...bozza, ...parte }
    setBozza(nuova)
    clearTimeout(attesa.current)
    if (nuova.testata.trim()) attesa.current = setTimeout(() => salva.mutate(nuova), ATTESA_SALVATAGGIO)
  }

  return (
    <Pagina
      titolo="Online shop"
      sottotitolo="What visitors will see. The public site doesn't exist yet, so nothing here is online."
      azioni={<button type="button" onClick={() => avvisa("The public site doesn't exist yet: there's nothing to open")}><ExternalLink size={18} aria-hidden="true" /> Visit shop</button>}
    >
      <SchedeCanali />
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data && bozza ? (
        <div className="negozio">
          <section className="negozio__anteprima vetro" aria-label="Preview">
            <div className="canale-testa">
              <div>
                <h2>Preview</h2>
                <p>Updates as you edit, with the products on sale</p>
              </div>
              <span className="negozio__stato"><i aria-hidden="true" /> Not online</span>
            </div>
            <Anteprima vetrina={bozza} pagine={data.pagine} />
          </section>
          <div className="negozio__colonna">
            <Aspetto vetrina={bozza} massimo={data.massimo_annuncio} onCambia={cambia} disattivo={!puo("negozio_online", "edit")} />
            <Visitatori visite={data.visite} />
          </div>
          <Pagine pagine={data.pagine} viste={data.visite?.pagine ?? {}} />
        </div>
      ) : null}
    </Pagina>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route index element={<Negozio />} />
      <Route path="*" element={<Navigate to="/negozio-online" replace />} />
    </Routes>
  )
}
