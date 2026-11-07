import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { RuoloProfilo } from "../api/tipi"
import { Riquadro } from "../componenti"
import { numero } from "../lingua"
import { usePermessi } from "../permessi"
import { useSessione } from "../sessione"
import { Campo, Conferma, Etichetta, Modale, Pagina, Stato, dataBreve } from "../ui"
import { Persona } from "./Persona"
import "./team.css"

type Membro = {
  id: string
  is_owner: boolean
  role_id: string | null
  member: { id: string; email: string; first_name: string | null; last_name: string | null }
}
type Invito = { id: string; email: string; role_id: string | null; expires_at: string; accepted: boolean }

function NuovoInvito({ percorso, ruoli, onChiudi }: { percorso: string; ruoli: RuoloProfilo[]; onChiudi: () => void }) {
  const client = useQueryClient()
  const scelte = ruoli.filter((r) => r.id !== "role_seller_administration")
  const [email, setEmail] = useState("")
  const [ruolo, setRuolo] = useState(scelte[0]?.id ?? "")
  const invita = useMutation({
    mutationFn: () => api(percorso, { corpo: { email: email.trim(), role_id: ruolo } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["team-azienda"] })
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    invita.mutate()
  }
  return (
    <Modale titolo="Invite a person" sottotitolo="They will receive an email to activate their access." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etichetta="Role" aiuto={scelte.find((r) => r.id === ruolo)?.descrizione}>
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
            {scelte.map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
          </select>
        </Campo>
        {invita.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{invita.error.message}</p> : null}
        <button className="primario" type="submit" disabled={invita.isPending}>{invita.isPending ? "Sending..." : "Send invitation"}</button>
      </form>
    </Modale>
  )
}

export default function TeamAzienda() {
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const client = useQueryClient()
  const [nuovo, setNuovo] = useState(false)
  const [daRimuovere, setDaRimuovere] = useState<Membro | null>(null)
  const base = `/vendor/sellers/${sessione?.aziendaId}/members`
  const ruoli = useQuery({ queryKey: ["team-azienda", "ruoli"], queryFn: () => api<{ ruoli: RuoloProfilo[] }>("/vendor/team/ruoli") })
  const membri = useQuery({ queryKey: ["team-azienda", "membri"], queryFn: () => api<{ seller_members: Membro[] }>(`${base}?limit=100`) })
  const inviti = useQuery({ queryKey: ["team-azienda", "inviti"], queryFn: () => api<{ member_invites: Invito[] }>(`${base}/invites?limit=100`) })
  const aggiorna = () => client.invalidateQueries({ queryKey: ["team-azienda"] })
  const cambia = useMutation({
    mutationFn: ({ id, role_id }: { id: string; role_id: string }) => api(`${base}/${id}`, { corpo: { role_id } }),
    onSuccess: aggiorna,
  })
  const rimuovi = useMutation({
    mutationFn: (id: string) => api(`${base}/${id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      setDaRimuovere(null)
      return aggiorna()
    },
  })
  const elencoRuoli = ruoli.data?.ruoli ?? []
  const etichetta = (id: string | null) => elencoRuoli.find((r) => r.id === id)?.etichetta ?? "No role"
  const puoGestire = puo("members", "edit")
  const attesa = (inviti.data?.member_invites ?? []).filter((i) => !i.accepted)
  const errore = cambia.error ?? rimuovi.error
  const persone = membri.data?.seller_members ?? []

  return (
    <Pagina
      titolo="Team"
      sottotitolo="The people in your company and what they can do."
      azioni={puoGestire ? <button className="primario" type="button" onClick={() => setNuovo(true)}><UserPlus size={17} aria-hidden="true" /> Invite a person</button> : null}
    >
      <Stato caricamento={membri.isLoading} errore={membri.error} vuoto={false} testoVuoto="" />
      {errore ? <p className="avviso-stato avviso-stato--errore" role="alert">{errore.message}</p> : null}

      {membri.data ? (
        <Riquadro titolo="People" testo={`${numero(persone.length)} active`}>
          <ul className="persone">
            {persone.map((m) => {
              const nome = [m.member.first_name, m.member.last_name].filter(Boolean).join(" ") || m.member.email
              const proprio = m.member.email === sessione?.email
              return (
                <Persona key={m.id} nome={nome} io={proprio} dettaglio={m.member.email}>
                  {m.is_owner || proprio || !puoGestire ? (
                    <Etichetta tono="ok">{etichetta(m.role_id)}</Etichetta>
                  ) : (
                    <div className="riga__azioni">
                      <select aria-label={`Role of ${nome}`} className="scelta-ruolo" value={m.role_id ?? ""} onChange={(e) => cambia.mutate({ id: m.id, role_id: e.target.value })}>
                        {elencoRuoli.map((r) => <option key={r.id} value={r.id}>{r.etichetta}</option>)}
                      </select>
                      <button type="button" className="pericolo" onClick={() => setDaRimuovere(m)}>Remove</button>
                    </div>
                  )}
                </Persona>
              )
            })}
          </ul>
        </Riquadro>
      ) : null}

      {inviti.data ? (
        <Riquadro titolo="Pending invitations" testo={attesa.length ? `${numero(attesa.length)} waiting to be accepted` : "Nobody is waiting to join."}>
          {attesa.length ? (
            <ul className="persone">
              {attesa.map((i) => <Persona key={i.id} nome={i.email} dettaglio={`${etichetta(i.role_id)}, expires ${dataBreve(i.expires_at)}`} />)}
            </ul>
          ) : null}
        </Riquadro>
      ) : null}

      {nuovo ? <NuovoInvito percorso={base} ruoli={elencoRuoli} onChiudi={() => setNuovo(false)} /> : null}
      {daRimuovere ? (
        <Conferma
          titolo="Remove from team"
          testo={`${daRimuovere.member.email} will no longer be able to reach the company's data.`}
          azione="Remove"
          attesa={rimuovi.isPending}
          onConferma={() => rimuovi.mutate(daRimuovere.id)}
          onChiudi={() => setDaRimuovere(null)}
        />
      ) : null}
    </Pagina>
  )
}
