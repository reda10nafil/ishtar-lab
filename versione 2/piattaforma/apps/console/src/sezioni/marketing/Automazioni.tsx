import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock, Heart, Mail, Pencil, RefreshCw, ShoppingBasket, Sparkles, Star, Zap, type LucideIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../../api/client"
import { Interruttore, useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Modale, Stato } from "../../ui"
import { intero } from "../analisi/comuni"
import type { Automazione } from "./tipi"

const ICONE: Record<Automazione["chiave"], LucideIcon> = { benvenuto: Mail, carrello: ShoppingBasket, riacquisto: RefreshCw, recensione: Star, recupero: Heart }

function ModuloEmail({ regola, onChiudi }: { regola: Automazione; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [oggetto, setOggetto] = useState(regola.oggetto)
  const [testo, setTesto] = useState(regola.testo)
  const salva = useMutation({
    mutationFn: () => api(`/admin/marketing/automazioni/${regola.chiave}`, { corpo: { oggetto, testo } }),
    onSuccess: () => {
      avvisa("Email saved")
      client.invalidateQueries({ queryKey: ["marketing", "automazioni"] })
      onChiudi()
    },
    onError: segnalaErrore,
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  return (
    <Modale titolo={`${regola.nome} email`} sottotitolo="Goes to new customers who agreed to marketing emails." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Subject line">
          <input autoFocus value={oggetto} onChange={(e) => setOggetto(e.target.value)} maxLength={180} />
        </Campo>
        <Campo etichetta="Message" aiuto="An unsubscribe link is added to every email.">
          <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={6} />
        </Campo>
        <div className="riga__azioni mk-modulo__azioni">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button type="submit" className="primario" disabled={!oggetto.trim() || !testo.trim() || salva.isPending}>Save</button>
        </div>
      </form>
    </Modale>
  )
}

function SchedaRegola({ regola, puoCambiare, onCambia, onModifica }: { regola: Automazione; puoCambiare: boolean; onCambia: (attiva: boolean) => void; onModifica: () => void }) {
  const Icona = ICONE[regola.chiave]
  const spenta = !regola.attiva
  return (
    <article className={spenta ? "mk-regola mk-regola--spenta vetro" : "mk-regola vetro"} data-blocco>
      <div className="mk-regola__testa">
        <span><Icona size={20} aria-hidden="true" /></span>
        <div>
          <h3>{regola.nome}</h3>
          <p>{regola.bloccata ? "Can't start yet" : regola.attiva ? "Running" : "Paused"}</p>
        </div>
        <Interruttore acceso={regola.attiva} etichetta={`${regola.nome}: ${regola.attiva ? "turn off" : "turn on"}`} disattivo={!puoCambiare || Boolean(regola.bloccata)} onCambia={onCambia} />
      </div>
      <div className="mk-regola__flusso">
        <span><Zap size={16} aria-hidden="true" /> {regola.inizio}</span>
        <i />
        <span><Clock size={16} aria-hidden="true" /> Wait</span>
        <i />
        <span className="mk-regola__email"><Mail size={16} aria-hidden="true" /> Email</span>
      </div>
      {regola.bloccata ? (
        <p className="mk-regola__motivo">{regola.bloccata}</p>
      ) : (
        <div className="mk-regola__numeri">
          <span className="mk-regola__conti"><span><b>{numero(regola.inviate)}</b> sent</span><span><b>{regola.incasso === null ? "—" : intero(regola.incasso)}</b> earned</span></span>
          {puoCambiare ? <button type="button" className="mk-fantasma mk-fantasma--testo" onClick={onModifica}><Pencil size={16} aria-hidden="true" /> Edit email</button> : null}
        </div>
      )}
    </article>
  )
}

export default function Automazioni() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [inModifica, setInModifica] = useState<Automazione | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ["marketing", "automazioni"], queryFn: () => api<{ automazioni: Automazione[]; guadagno: number | null }>("/admin/marketing/automazioni") })
  const cambia = useMutation({
    mutationFn: ({ chiave, attiva }: { chiave: string; nome: string; attiva: boolean }) => api(`/admin/marketing/automazioni/${chiave}`, { corpo: { attiva } }),
    onSuccess: (_, { nome, attiva }) => {
      avvisa(attiva ? `${nome} is running` : `${nome} paused`)
      client.invalidateQueries({ queryKey: ["marketing", "automazioni"] })
    },
    onError: segnalaErrore,
  })

  if (!data) return <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
  const inviate = data.automazioni.reduce((s, a) => s + a.inviate, 0)

  return (
    <div className="mk-automazioni">
      <div className="mk-striscia vetro" data-blocco>
        <Sparkles size={20} aria-hidden="true" />
        {data.guadagno === null ? <span><b>{numero(inviate)} {inviate === 1 ? "email" : "emails"}</b> sent by automations so far, with nobody pressing send.</span> : <span><b>{intero(data.guadagno)}</b> earned by automations in the last 30 days, with nobody pressing send.</span>}
      </div>
      <div className="mk-griglia">
        {data.automazioni.map((r) => (
          <SchedaRegola key={r.id} regola={r} puoCambiare={puo("marketing", "manage")} onCambia={(attiva) => cambia.mutate({ chiave: r.chiave, nome: r.nome, attiva })} onModifica={() => setInModifica(r)} />
        ))}
      </div>
      {inModifica ? <ModuloEmail regola={inModifica} onChiudi={() => setInModifica(null)} /> : null}
    </div>
  )
}
