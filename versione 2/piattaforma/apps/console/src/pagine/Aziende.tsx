import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, BadgeCheck, Building2, CircleCheck, CirclePause, Clock, MoreHorizontal, Play, Plus, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { Azienda } from "../api/tipi"
import { CampoRicerca, Tendina, Vuoto, useAvvisi } from "../componenti"
import { STATI_AZIENDA, numero, stato } from "../lingua"
import { Cifra, entraRighe } from "../movimenti"
import { usePermessi } from "../permessi"
import { Campo, Modale, Pagina, Stato, dataBreve } from "../ui"
import { Blocco } from "./Blocco"
import { Iniziali } from "./Iniziali"
import "./aziende.css"

type RigaAzienda = Azienda & { products?: { id: string }[] | null; orders?: { id: string }[] | null }

const CAMPI = "id,name,email,status,created_at,products.id,orders.id"

const TESSERE: { chiave: string; icona: LucideIcon }[] = [
  { chiave: "open", icona: CircleCheck },
  { chiave: "pending_approval", icona: Clock },
  { chiave: "suspended", icona: CirclePause },
  { chiave: "terminated", icona: Archive },
]

const AZIONI: Record<string, { verbo: string; testo: string; fatto: string; icona: LucideIcon }> = {
  pending_approval: { verbo: "approve", testo: "Approve", fatto: "approved", icona: BadgeCheck },
  open: { verbo: "suspend", testo: "Suspend", fatto: "suspended", icona: CirclePause },
  suspended: { verbo: "unsuspend", testo: "Reactivate", fatto: "reactivated", icona: Play },
}

const conta = (quanti: number, singolare: string) => `${numero(quanti)} ${singolare}${quanti === 1 ? "" : "s"}`

function NuovaAzienda({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const [dati, setDati] = useState({ nome: "", email: "" })
  const crea = useMutation({
    mutationFn: () =>
      api("/admin/sellers", {
        corpo: { name: dati.nome.trim(), email: dati.email.trim(), currency_code: "eur", member: { email: dati.email.trim() } },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["aziende"] })
      avvisa(`Invite sent to ${dati.email.trim()}`)
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New company" onChiudi={onChiudi}>
      <form className="modulo modulo--stretto" onSubmit={invia}>
        <Campo etichetta="Company name">
          <input required value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} />
        </Campo>
        <Campo etichetta="Contact email">
          <input type="email" required value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} />
        </Campo>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <div className="riga__azioni riga__azioni--fine">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={crea.isPending}>{crea.isPending ? "Creating..." : "Create and invite"}</button>
        </div>
      </form>
    </Modale>
  )
}

function RigaElenco({ azienda, puoGestire, inAttesa, onAzione }: { azienda: RigaAzienda; puoGestire: boolean; inAttesa: boolean; onAzione: (verbo: string, fatto: string) => void }) {
  const etichetta = stato(STATI_AZIENDA, azienda.status)
  const possibile = puoGestire ? AZIONI[azienda.status] : undefined
  return (
    <li data-riga className="azienda">
      <Iniziali nome={azienda.name} />
      <div className="azienda__testo">
        <strong>{azienda.name}</strong>
        <small>{azienda.email} · Joined {dataBreve(azienda.created_at)}</small>
      </div>
      <div className="azienda__dati">
        <b className={`tono--${etichetta.tono}`}>{etichetta.testo}</b>
        <small>{conta(azienda.products?.length ?? 0, "product")} · {conta(azienda.orders?.length ?? 0, "order")}</small>
      </div>
      {possibile ? (
        // La chiave chiude il menu quando l'azione cambia lo stato dell'azienda.
        <Tendina key={azienda.status} etichetta={`Actions for ${azienda.name}`} classe="azienda__puntini" bottone={<MoreHorizontal size={18} aria-hidden="true" />}>
          <button type="button" disabled={inAttesa} onClick={() => onAzione(possibile.verbo, possibile.fatto)}>
            <possibile.icona size={17} aria-hidden="true" /> {possibile.testo}
          </button>
        </Tendina>
      ) : null}
    </li>
  )
}

export default function Aziende() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [nuova, setNuova] = useState(false)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [testo, setTesto] = useState("")
  const elenco = useRef<HTMLUListElement>(null)
  const query = useQuery({
    queryKey: ["aziende"],
    queryFn: () => api<{ sellers: RigaAzienda[] }>(`/admin/sellers?limit=100&fields=${CAMPI}`),
  })
  const azione = useMutation({
    mutationFn: ({ id, verbo }: { id: string; verbo: string; messaggio: string }) => api(`/admin/sellers/${id}/${verbo}`, { corpo: {} }),
    onSuccess: (_risposta, { messaggio }) => {
      avvisa(messaggio)
      return client.invalidateQueries({ queryKey: ["aziende"] })
    },
    onError: segnalaErrore,
  })
  const puoGestire = puo("sellers", "edit")
  const tutte = query.data?.sellers ?? []
  const cerca = testo.trim().toLowerCase()
  const visibili = tutte.filter((a) => (!filtro || a.status === filtro) && (!cerca || `${a.name} ${a.email}`.toLowerCase().includes(cerca)))
  useEffect(() => {
    if (elenco.current) entraRighe(elenco.current)
  }, [filtro, cerca])
  const creaAzione = puoGestire ? <button className="primario azienda-nuova" type="button" onClick={() => setNuova(true)}><Plus size={17} aria-hidden="true" /> New company</button> : null

  return (
    <Pagina titolo="Companies" sottotitolo={query.data ? `${numero(tutte.length)} partner companies bring their products to Ishtar Lab.` : "The partner companies that bring their products to Ishtar Lab."} azioni={creaAzione}>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !tutte.length ? <Vuoto icona={Building2} titolo="No companies yet" testo="Add the first partner company: it will receive an email invitation." azione={creaAzione} /> : null}

      {tutte.length ? (
        <>
          <div className="aziende-tessere" role="group" aria-label="Status">
            {TESSERE.map(({ chiave, icona: Icona }) => {
              const { testo: nome, tono } = STATI_AZIENDA[chiave]
              return (
                <button key={chiave} type="button" className="azienda-tessera vetro" aria-pressed={filtro === chiave} onClick={() => setFiltro(filtro === chiave ? null : chiave)}>
                  <span className={`azienda-tessera__icona tono--${tono}`}><Icona size={20} aria-hidden="true" /></span>
                  <span>
                    <b><Cifra valore={tutte.filter((a) => a.status === chiave).length} formato={numero} /></b>
                    <small>{nome}</small>
                  </span>
                </button>
              )
            })}
          </div>

          <Blocco piatto classe="aziende-blocco" titolo="Partner companies" testo="Independent companies selling through Ishtar Lab" azioni={<CampoRicerca valore={testo} etichetta="Search by name or email" onCambia={setTesto} />}>
            {visibili.length ? (
              <ul className="aziende" ref={elenco}>
                {visibili.map((a) => (
                  <RigaElenco
                    key={a.id}
                    azienda={a}
                    puoGestire={puoGestire}
                    inAttesa={azione.isPending}
                    onAzione={(verbo, fatto) => azione.mutate({ id: a.id, verbo, messaggio: `${a.name} is ${fatto}` })}
                  />
                ))}
              </ul>
            ) : (
              <div className="aziende"><p className="avviso-stato">No companies match this filter.</p></div>
            )}
          </Blocco>
        </>
      ) : null}

      {nuova ? <NuovaAzienda onChiudi={() => setNuova(false)} /> : null}
    </Pagina>
  )
}
