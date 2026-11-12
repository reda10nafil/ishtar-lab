import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Coins, Copy, Eye, Grid2x2, Mail, Megaphone, MessageSquare, Pencil, Send, Trash2, Users, type LucideIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi, Vuoto } from "../../componenti"
import { Barra, GraficoColonne } from "../../componenti/Grafici"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Conferma, Stato, dataBreve } from "../../ui"
import { Indicatore, intero } from "../analisi/comuni"
import { Segmenti } from "../analisi/Segmenti"
import ModuloCampagna from "./ModuloCampagna"
import type { Campagna, DatiCampagne, Pubblico, StatoCampagna } from "./tipi"

type Filtro = "tutte" | "prossime" | "inviate"

const STATI: Record<StatoCampagna, { testo: string; classe: string }> = {
  bozza: { testo: "Draft", classe: "" },
  programmata: { testo: "Scheduled", classe: "mk-stato--blu" },
  in_invio: { testo: "Sending", classe: "mk-stato--rosa" },
  inviata: { testo: "Sent", classe: "mk-stato--ok" },
  fallita: { testo: "Failed", classe: "mk-stato--errore" },
}

const PROSSIME = new Set<StatoCampagna>(["bozza", "programmata"])

const CANALI: Record<Campagna["canale"], { nome: string; icona: LucideIcon; colore: string }> = {
  email: { nome: "Email", icona: Mail, colore: "var(--serie-online)" },
  instagram: { nome: "Instagram", icona: Grid2x2, colore: "var(--serie-ingrosso)" },
  sms: { nome: "SMS", icona: MessageSquare, colore: "var(--serie-negozio)" },
}

/** Nelle schede basta giorno e mese: «21 Oct». */
const giorno = (data: string) => dataBreve(data).replace(/ \d{4}$/, "")

const quandoDi = (c: Campagna) => {
  if (c.stato === "programmata" && c.programmata_il) return `goes out ${giorno(c.programmata_il)}`
  if (c.conclusa_il) return giorno(c.conclusa_il)
  if (c.stato === "in_invio") return "going out now"
  return "not scheduled"
}

const nomePubblico = (pubblici: Pubblico[], chiave: string) => pubblici.find((p) => p.chiave === chiave)?.nome ?? (chiave.startsWith("gruppo:") ? "Customer group" : "All subscribers")

function Scheda({ campagna: c, pubblici, puoInviare, puoScrivere, onInvia, onModifica, onDuplica, onElimina }: {
  campagna: Campagna
  pubblici: Pubblico[]
  puoInviare: boolean
  puoScrivere: boolean
  onInvia: () => void
  onModifica: () => void
  onDuplica: () => void
  onElimina: () => void
}) {
  const stato = STATI[c.stato]
  const partita = !PROSSIME.has(c.stato)
  const canale = CANALI[c.canale]
  const m = c.misure
  const quota = m ? m.aperture : c.destinatari ? c.inviati / c.destinatari : 0
  const piede = [partita ? `${numero(c.inviati)} sent` : nomePubblico(pubblici, c.pubblico), m?.ordini ? `${numero(m.ordini)} orders` : null, c.falliti ? `${numero(c.falliti)} failed` : null].filter(Boolean).join(" · ")
  return (
    <article className="mk-scheda vetro" data-blocco>
      <div className="mk-scheda__testa">
        <span className="mk-scheda__icona" style={{ background: canale.colore }}><canale.icona size={20} aria-hidden="true" /></span>
        <span>
          <b>{c.nome}</b>
          <small>{canale.nome} · {quandoDi(c)}</small>
        </span>
        <em className={`mk-stato ${stato.classe}`}>{stato.testo}</em>
      </div>
      {c.oggetto ? <p className="mk-scheda__oggetto">“{c.oggetto}”</p> : null}
      <div className="mk-scheda__numeri">
        <div><small>Audience</small><b>{numero(partita ? c.destinatari : c.pubblico_ora)}</b></div>
        <div title={m ? undefined : "Opens aren't measured"}><small>{c.canale === "instagram" ? "Reached" : "Opened"}</small><b>{m ? percentuale(m.aperture) : "—"}</b></div>
        <div title={m ? undefined : "Clicks aren't measured"}><small>Clicked</small><b>{m?.clic === null || m?.clic === undefined ? "—" : percentuale(m.clic)}</b></div>
        <div title={m ? undefined : "Earnings aren't measured"}><small>Earned</small><b>{m?.incasso === null || m?.incasso === undefined ? "—" : intero(m.incasso)}</b></div>
      </div>
      {partita ? <Barra quota={quota} classe="mk-scheda__barra" ritardo={300} /> : null}
      <div className="mk-scheda__piede">
        {!partita && puoInviare && !c.dimostrativa ? (
          <button type="button" className="primario pan-piccolo" onClick={onInvia}><Send size={16} aria-hidden="true" /> Send now</button>
        ) : (
          <small>{piede}</small>
        )}
        <span>
          {!partita && puoScrivere && !c.dimostrativa ? <button type="button" className="mk-fantasma" aria-label={`Edit ${c.nome}`} onClick={onModifica}><Pencil size={16} aria-hidden="true" /></button> : null}
          {c.stato !== "in_invio" && puoInviare && !c.dimostrativa ? <button type="button" className="mk-fantasma" aria-label={`Delete ${c.nome}`} onClick={onElimina}><Trash2 size={16} aria-hidden="true" /></button> : null}
          {puoScrivere && !c.dimostrativa ? <button type="button" className="mk-fantasma mk-fantasma--testo" onClick={onDuplica}><Copy size={16} aria-hidden="true" /> Duplicate</button> : null}
        </span>
      </div>
    </article>
  )
}

export default function Campagne() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [filtro, setFiltro] = useState<Filtro>("tutte")
  const [daInviare, setDaInviare] = useState<Campagna | null>(null)
  const [daEliminare, setDaEliminare] = useState<Campagna | null>(null)
  const [inModifica, setInModifica] = useState<Campagna | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["marketing", "campagne"],
    queryFn: () => api<DatiCampagne>("/admin/marketing/campagne"),
    // Mentre un invio è in corso i conteggi veri arrivano da soli.
    refetchInterval: (q) => (q.state.data?.campagne.some((c) => c.stato === "in_invio") ? 1500 : false),
  })

  const azione = useMutation({
    mutationFn: ({ percorso, metodo }: { percorso: string; metodo?: string; messaggio: string }) => api(percorso, { metodo: metodo ?? "POST", corpo: metodo ? undefined : {} }),
    onSuccess: (_, { messaggio }) => {
      avvisa(messaggio)
      client.invalidateQueries({ queryKey: ["marketing"] })
      setDaInviare(null)
      setDaEliminare(null)
    },
    onError: segnalaErrore,
  })

  const duplica = useMutation({
    mutationFn: (c: Campagna) => api<{ campagna: Campagna }>(`/admin/marketing/campagne/${c.id}/duplica`, { corpo: {} }),
    onSuccess: ({ campagna }) => {
      client.invalidateQueries({ queryKey: ["marketing"] })
      avvisa("Copied as a draft", {
        etichetta: "Undo",
        esegui: () => void api(`/admin/marketing/campagne/${campagna.id}`, { metodo: "DELETE" }).then(() => client.invalidateQueries({ queryKey: ["marketing"] })).catch(segnalaErrore),
      })
    },
    onError: segnalaErrore,
  })

  const inviate = useMemo(() => (data?.campagne ?? []).filter((c) => c.conclusa_il && (c.inviati > 0 || c.misure)), [data])
  const conIncasso = inviate.some((c) => c.misure?.incasso)
  const voci = useMemo(() => [...inviate].reverse().map((c) => ({ id: c.id, nome: c.nome, valore: conIncasso ? (c.misure?.incasso ?? 0) : c.inviati })), [inviate, conIncasso])

  if (!data) return <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
  const { riepilogo: r } = data
  const elenco = data.campagne.filter((c) => filtro === "tutte" || (filtro === "prossime" ? PROSSIME.has(c.stato) : !PROSSIME.has(c.stato)))

  return (
    <div className="ana-pila">
      <div className="pan-tessere">
        {r.incasso === null ? (
          <Indicatore etichetta="Emails sent" icona={Send} colore="var(--serie-online)" valore={r.email_inviate} formato={numero} nota={`${numero(r.inviate)} ${r.inviate === 1 ? "send" : "sends"} · 90 days`} />
        ) : (
          <Indicatore etichetta="Earned by campaigns" icona={Coins} colore="var(--serie-online)" valore={r.incasso} formato={intero} nota={`${numero(r.inviate)} ${r.inviate === 1 ? "send" : "sends"} · 90 days`} />
        )}
        <Indicatore etichetta="Open rate" icona={Eye} colore="var(--serie-negozio)" valore={r.apertura} formato={percentuale} nota={r.apertura === null ? "not measured" : "across recent sends"} />
        <Indicatore etichetta="Subscribers" icona={Users} colore="var(--serie-ingrosso)" valore={r.iscritti} formato={numero} nota={`+${numero(r.nuovi_iscritti)} this month`} />
        <Indicatore etichetta="Next send" icona={CalendarClock} colore="var(--serie-altro)" valore={null} formato={numero} vuoto={r.prossima ? giorno(r.prossima) : "–"} nota={`${numero(r.programmate)} scheduled`} />
      </div>
      <div className="mk-filtri">
        <Segmenti
          voci={[{ valore: "tutte" as Filtro, testo: "All" }, { valore: "prossime" as Filtro, testo: "Upcoming" }, { valore: "inviate" as Filtro, testo: "Sent" }]}
          valore={filtro}
          onCambia={setFiltro}
          etichetta="Filter campaigns"
        />
        {r.apertura === null ? <p className="mk-avviso">Opens and clicks aren't measured: the counts show emails really sent. Instagram and SMS aren't connected: <Link to="/connettori">see Apps</Link>.</p> : null}
      </div>
      {elenco.length ? (
        <div className="mk-griglia">
          {elenco.map((c) => (
            <Scheda
              key={c.id}
              campagna={c}
              pubblici={data.pubblici}
              puoInviare={puo("marketing", "manage")}
              puoScrivere={puo("marketing", "edit")}
              onInvia={() => setDaInviare(c)}
              onModifica={() => setInModifica(c)}
              onElimina={() => setDaEliminare(c)}
              onDuplica={() => duplica.mutate(c)}
            />
          ))}
        </div>
      ) : (
        <Vuoto
          icona={Megaphone}
          titolo={filtro === "tutte" ? "No campaigns yet" : "Nothing here"}
          testo={filtro === "tutte" ? "Write an email to the customers who agreed to hear from you, then send it or schedule it." : "Try another filter."}
        />
      )}
      {voci.length > 1 ? (
        <section className="ana-blocco mk-grafico vetro" data-blocco aria-label={conIncasso ? "What each send earned" : "What each send reached"}>
          <div className="pan-testa">
            <div>
              <h2>{conIncasso ? "What each send earned" : "What each send reached"}</h2>
              <p>{conIncasso ? "Revenue from sent campaigns" : "Emails really sent, campaign by campaign"}</p>
            </div>
          </div>
          <GraficoColonne voci={voci} colore="var(--serie-online)" formato={conIncasso ? intero : numero} interi={!conIncasso} etichetta="Results per campaign" />
        </section>
      ) : null}
      {daInviare ? (
        <Conferma
          titolo={`Send “${daInviare.nome}” now?`}
          testo={`It goes to ${numero(daInviare.pubblico_ora)} ${daInviare.pubblico_ora === 1 ? "person" : "people"} straight away${daInviare.programmata_il ? ` instead of ${dataBreve(daInviare.programmata_il)}` : ""}. Only customers who agreed to marketing emails get it.`}
          azione="Send"
          attesa={azione.isPending}
          onConferma={() => azione.mutate({ percorso: `/admin/marketing/campagne/${daInviare.id}/invia`, messaggio: "Campaign on its way" })}
          onChiudi={() => setDaInviare(null)}
        />
      ) : null}
      {daEliminare ? (
        <Conferma
          titolo="Delete this campaign?"
          testo={`“${daEliminare.nome}” and its send counts will be removed. Customers won't notice anything.`}
          azione="Delete"
          attesa={azione.isPending}
          onConferma={() => azione.mutate({ percorso: `/admin/marketing/campagne/${daEliminare.id}`, metodo: "DELETE", messaggio: "Campaign deleted" })}
          onChiudi={() => setDaEliminare(null)}
        />
      ) : null}
      {inModifica ? <ModuloCampagna campagna={inModifica} onChiudi={() => setInModifica(null)} onFatto={() => setInModifica(null)} /> : null}
    </div>
  )
}
