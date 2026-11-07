import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { RuoloProfilo } from "../api/tipi"
import { Riquadro, Tabella, type Colonna } from "../componenti"
import { numero } from "../lingua"
import { Campo, Conferma, Etichetta, Modale, Stato, dataBreve } from "../ui"
import { Persona } from "./Persona"
import { PaginaImpostazioni } from "./SchedeImpostazioni"
import "./team.css"

type Livello = "view" | "edit" | "manage"
type RuoloTeam = RuoloProfilo & { livelli: Record<string, Livello | null> }
type Area = { id: string; etichetta: string }
type Collaboratore = { id: string; email: string; first_name: string | null; last_name: string | null; ruolo: string | null }
type Invito = { id: string; email: string; expires_at: string; ruolo: string | null }
type Team = { io: string; ruoli: RuoloTeam[]; aree: Area[]; collaboratori: Collaboratore[]; inviti: Invito[] }

const LIVELLI: Record<Livello, string> = { view: "View", edit: "Edit", manage: "Manage" }

const assegnabili = (ruoli: RuoloTeam[]) => ruoli.filter((r) => r.id !== "proprietario")

function NuovoInvito({ ruoli, onChiudi }: { ruoli: RuoloTeam[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const [email, setEmail] = useState("")
  const [ruolo, setRuolo] = useState(assegnabili(ruoli)[0]?.id ?? "")
  const invita = useMutation({
    mutationFn: () => api("/admin/team", { corpo: { email: email.trim(), ruolo } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["team"] })
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    invita.mutate()
  }
  return (
    <Modale titolo="Invite a team member" sottotitolo="They will receive an email to activate their access." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etichetta="Role" aiuto={ruoli.find((r) => r.id === ruolo)?.descrizione}>
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
            {assegnabili(ruoli).map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
          </select>
        </Campo>
        {invita.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{invita.error.message}</p> : null}
        <button className="primario" type="submit" disabled={invita.isPending}>{invita.isPending ? "Sending..." : "Send invitation"}</button>
      </form>
    </Modale>
  )
}

/** Righe e livelli arrivano dal server, ricavati dai permessi veri di ogni ruolo. */
function MatriceRuoli({ ruoli, aree }: { ruoli: RuoloTeam[]; aree: Area[] }) {
  const colonne: Colonna<Area>[] = [
    { titolo: "Area", cella: (area) => area.etichetta },
    ...ruoli.map((ruolo): Colonna<Area> => ({
      titolo: ruolo.etichetta,
      cella: (area) => {
        const livello = ruolo.livelli[area.id]
        return livello ? LIVELLI[livello] : "–"
      },
    })),
  ]
  return (
    <div className="ruoli-matrice">
      <Riquadro titolo="What each role can do">
        <Tabella etichetta="What each role can do" colonne={colonne} righe={aree} chiave={(area) => area.id} />
      </Riquadro>
    </div>
  )
}

export default function TeamAdmin() {
  const client = useQueryClient()
  const [nuovo, setNuovo] = useState(false)
  const [daRimuovere, setDaRimuovere] = useState<Collaboratore | null>(null)
  const query = useQuery({ queryKey: ["team"], queryFn: () => api<Team>("/admin/team") })
  const aggiorna = () => client.invalidateQueries({ queryKey: ["team"] })
  const cambia = useMutation({
    mutationFn: ({ id, ruolo }: { id: string; ruolo: string }) => api(`/admin/team/${id}`, { corpo: { ruolo } }),
    onSuccess: aggiorna,
  })
  const rimuovi = useMutation({
    mutationFn: (id: string) => api(`/admin/team/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      setDaRimuovere(null)
      return aggiorna()
    },
  })
  const invito = useMutation({
    mutationFn: ({ id, metodo }: { id: string; metodo: "POST" | "DELETE" }) => api(`/admin/team/inviti/${id}`, { metodo }),
    onSuccess: aggiorna,
  })
  const dati = query.data
  const errore = cambia.error ?? rimuovi.error ?? invito.error
  const etichetta = (id: string | null) => dati?.ruoli.find((r) => r.id === id)?.etichetta ?? "No role"

  return (
    <PaginaImpostazioni>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null}

      {dati ? (
        <>
          <Riquadro
            titolo="Team"
            testo={`${numero(dati.collaboratori.length)} active · Only the owner can change roles and settings`}
            azioni={<button className="primario" type="button" onClick={() => setNuovo(true)}><UserPlus size={17} aria-hidden="true" /> Invite</button>}
          >
            <ul className="persone">
              {dati.collaboratori.map((c) => {
                const nome = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email
                const bloccato = c.id === dati.io || c.ruolo === "proprietario"
                return (
                  <Persona key={c.id} nome={nome} io={c.id === dati.io} dettaglio={c.email}>
                    {bloccato ? (
                      <Etichetta tono="ok">{etichetta(c.ruolo)}</Etichetta>
                    ) : (
                      <div className="riga__azioni">
                        <select aria-label={`Role of ${nome}`} className="scelta-ruolo" value={c.ruolo ?? ""} onChange={(e) => cambia.mutate({ id: c.id, ruolo: e.target.value })}>
                          {c.ruolo ? null : <option value="">No role</option>}
                          {assegnabili(dati.ruoli).map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
                        </select>
                        <button type="button" className="pericolo" onClick={() => setDaRimuovere(c)}>Remove</button>
                      </div>
                    )}
                  </Persona>
                )
              })}
            </ul>
          </Riquadro>

          <Riquadro titolo="Pending invitations" testo={dati.inviti.length ? `${numero(dati.inviti.length)} waiting to be accepted` : "Nobody is waiting to join."}>
            {dati.inviti.length ? (
              <ul className="persone">
                {dati.inviti.map((i) => (
                  <Persona key={i.id} nome={i.email} dettaglio={`${etichetta(i.ruolo)}, expires ${dataBreve(i.expires_at)}`}>
                    <div className="riga__azioni">
                      <button type="button" disabled={invito.isPending} onClick={() => invito.mutate({ id: i.id, metodo: "POST" })}>Send again</button>
                      <button type="button" className="pericolo" disabled={invito.isPending} onClick={() => invito.mutate({ id: i.id, metodo: "DELETE" })}>Cancel</button>
                    </div>
                  </Persona>
                ))}
              </ul>
            ) : null}
          </Riquadro>

          <MatriceRuoli ruoli={dati.ruoli} aree={dati.aree} />
        </>
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
