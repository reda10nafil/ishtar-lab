import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Send, Trash2, UserPlus, X } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { RuoloProfilo } from "../api/tipi"
import { Interruttore, useAvvisi } from "../componenti"
import { numero } from "../lingua"
import { Campo, Conferma, Modale, Stato } from "../ui"
import { Blocco } from "./Blocco"
import { Persona } from "./Persona"
import { PaginaImpostazioni } from "./SchedeImpostazioni"
import "./team.css"

type Livello = "view" | "edit" | "manage"
type RuoloTeam = RuoloProfilo & { livelli: Record<string, Livello | null> }
type Area = { id: string; etichetta: string }
type Collaboratore = { id: string; email: string; first_name: string | null; last_name: string | null; ruolo: string | null; attivo: boolean }
type Invito = { id: string; email: string; nome: string | null; ruolo: string | null; attivo: boolean }
type Team = { io: string; ruoli: RuoloTeam[]; aree: Area[]; collaboratori: Collaboratore[]; inviti: Invito[] }

const LIVELLI: Record<Livello, string> = { view: "View", edit: "Edit", manage: "Manage" }

const assegnabili = (ruoli: RuoloTeam[]) => ruoli.filter((r) => r.id !== "proprietario")
const nomeDi = (c: Collaboratore) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email
const primaParola = (nome: string) => nome.split(/[\s@]/)[0]

function NuovoInvito({ ruoli, onChiudi }: { ruoli: RuoloTeam[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const { avvisa } = useAvvisi()
  const scelte = assegnabili(ruoli)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [ruolo, setRuolo] = useState(scelte.at(-1)?.id ?? "")
  const invita = useMutation({
    mutationFn: () => api("/admin/team", { corpo: { email: email.trim(), ruolo, nome: nome.trim() } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["team"] })
      avvisa(`Invite sent to ${email.trim()}`)
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    if (nome.trim() && email.trim()) invita.mutate()
  }
  return (
    <Modale titolo="Invite someone" onChiudi={onChiudi}>
      <form className="modulo modulo--stretto" onSubmit={invia}>
        <Campo etichetta="Name">
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo etichetta="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etichetta="Access">
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
            {scelte.map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
          </select>
        </Campo>
        {invita.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{invita.error.message}</p> : null}
        <div className="riga__azioni riga__azioni--fine">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button className="primario" type="submit" disabled={invita.isPending}><Send size={16} aria-hidden="true" /> {invita.isPending ? "Sending..." : "Send invite"}</button>
        </div>
      </form>
    </Modale>
  )
}

/** Righe e spunte arrivano dal server, ricavate dai permessi veri di ogni ruolo. */
function MatriceRuoli({ ruoli, aree }: { ruoli: RuoloTeam[]; aree: Area[] }) {
  return (
    <div className="ruoli">
      <h3>What each level can do</h3>
      <div className="ruoli__scorri">
        <table aria-label="What each level can do">
          <thead>
            <tr>
              <th scope="col" aria-label="Area" />
              {ruoli.map((r) => <th key={r.id} scope="col">{r.etichetta}</th>)}
            </tr>
          </thead>
          <tbody>
            {aree.map((area) => (
              <tr key={area.id}>
                <th scope="row">{area.etichetta}</th>
                {ruoli.map((r) => {
                  const livello = r.livelli[area.id]
                  return (
                    <td key={r.id} title={livello ? LIVELLI[livello] : "No access"}>
                      {livello ? <Check size={16} role="img" aria-label={LIVELLI[livello]} /> : <span aria-label="No access">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TeamAdmin() {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [nuovo, setNuovo] = useState(false)
  const [daRimuovere, setDaRimuovere] = useState<Collaboratore | null>(null)
  const query = useQuery({ queryKey: ["team"], queryFn: () => api<Team>("/admin/team") })
  const aggiorna = () => client.invalidateQueries({ queryKey: ["team"] })
  const cambia = useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: { ruolo?: string; attivo?: boolean }; messaggio: string }) => api(`/admin/team/${id}`, { corpo }),
    onSuccess: (_risposta, { messaggio }) => {
      avvisa(messaggio)
      return aggiorna()
    },
    onError: segnalaErrore,
  })
  const rimuovi = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      setDaRimuovere(null)
      return aggiorna()
    },
    onError: segnalaErrore,
  })
  const invito = useMutation({
    mutationFn: ({ id, metodo, corpo }: { id: string; metodo: "POST" | "DELETE"; corpo?: { ruolo?: string; attivo?: boolean }; messaggio: string }) => api(`/admin/team/inviti/${id}`, { metodo, corpo }),
    onSuccess: (_risposta, { messaggio }) => {
      avvisa(messaggio)
      return aggiorna()
    },
    onError: segnalaErrore,
  })
  const dati = query.data
  const etichetta = (id: string | null) => dati?.ruoli.find((r) => r.id === id)?.etichetta ?? "No role"

  return (
    <PaginaImpostazioni>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />

      {dati ? (
        <Blocco
          classe="scheda-team"
          titolo="Team"
          testo={`${numero(dati.collaboratori.filter((c) => c.attivo).length)} active · Only the owner can change settings`}
          azioni={<button className="primario" type="button" onClick={() => setNuovo(true)}><UserPlus size={16} aria-hidden="true" /> Invite</button>}
        >
          <ul>
            {dati.collaboratori.map((c) => {
              const nome = nomeDi(c)
              const bloccato = c.id === dati.io || c.ruolo === "proprietario"
              return (
                <Persona key={c.id} nome={nome} io={c.id === dati.io} dettaglio={c.email} spenta={!c.attivo}>
                  {bloccato ? (
                    <span className="persona__ruolo">{etichetta(c.ruolo)}</span>
                  ) : (
                    <>
                      <select
                        aria-label={`${nome} access`}
                        value={c.ruolo ?? ""}
                        onChange={(e) => cambia.mutate({ id: c.id, corpo: { ruolo: e.target.value }, messaggio: `${primaParola(nome)} is now ${etichetta(e.target.value)}` })}
                      >
                        {c.ruolo ? null : <option value="">No role</option>}
                        {assegnabili(dati.ruoli).map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
                      </select>
                      <Interruttore
                        acceso={c.attivo}
                        etichetta={`${nome} active`}
                        disattivo={cambia.isPending || !c.ruolo}
                        onCambia={(attivo) => cambia.mutate({ id: c.id, corpo: { attivo }, messaggio: attivo ? `${primaParola(nome)} can sign in` : `${primaParola(nome)} is switched off` })}
                      />
                      <button type="button" className="persona__comando persona__comando--pericolo" aria-label={`Remove ${nome}`} title="Remove" onClick={() => setDaRimuovere(c)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </Persona>
              )
            })}
            {dati.inviti.map((i) => {
              const nome = i.nome || i.email
              return (
                <Persona key={i.id} nome={nome} dettaglio={`Invited · ${i.email}`} spenta={!i.attivo}>
                  <select
                    aria-label={`${nome} access`}
                    value={i.ruolo ?? ""}
                    onChange={(e) => invito.mutate({ id: i.id, metodo: "POST", corpo: { ruolo: e.target.value }, messaggio: `${primaParola(nome)} is now ${etichetta(e.target.value)}` })}
                  >
                    {i.ruolo ? null : <option value="">No role</option>}
                    {assegnabili(dati.ruoli).map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
                  </select>
                  <Interruttore
                    acceso={i.attivo}
                    etichetta={`${nome} active`}
                    disattivo={invito.isPending || !i.ruolo}
                    onCambia={(attivo) => invito.mutate({ id: i.id, metodo: "POST", corpo: { attivo }, messaggio: attivo ? `${primaParola(nome)} can sign in` : `${primaParola(nome)} is switched off` })}
                  />
                  <button type="button" className="persona__comando" aria-label={`Send the invite to ${i.email} again`} title="Send again" disabled={invito.isPending} onClick={() => invito.mutate({ id: i.id, metodo: "POST", messaggio: `Invite sent to ${i.email}` })}>
                    <Send size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="persona__comando persona__comando--pericolo" aria-label={`Cancel the invite to ${i.email}`} title="Cancel invite" disabled={invito.isPending} onClick={() => invito.mutate({ id: i.id, metodo: "DELETE", messaggio: `Invite to ${i.email} cancelled` })}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </Persona>
              )
            })}
          </ul>
          <MatriceRuoli ruoli={dati.ruoli} aree={dati.aree} />
        </Blocco>
      ) : null}

      {nuovo && dati ? <NuovoInvito ruoli={dati.ruoli} onChiudi={() => setNuovo(false)} /> : null}
      {daRimuovere ? (
        <Conferma
          titolo="Remove team member"
          testo={`${daRimuovere.email} will no longer be able to sign in to Ishtar Lab.`}
          azione="Remove"
          attesa={rimuovi.isPending}
          onConferma={() => rimuovi.mutate(daRimuovere.id)}
          onChiudi={() => setDaRimuovere(null)}
        />
      ) : null}
    </PaginaImpostazioni>
  )
}
