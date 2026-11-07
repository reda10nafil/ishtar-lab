import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CircleAlert, Clock, Info } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import { Tendina } from "../componenti"
import { fa, numero } from "../lingua"
import { useSessione } from "../sessione"
import "../sezioni/impostazioni/notifiche.css"
// Unico punto sempre caricato tra quelli di questa sezione: tiene il tema allineato al sistema in ogni pagina.
import "../sezioni/impostazioni/tema-sistema"

type Avviso = {
  chiave: string
  titolo: string
  dettaglio: string | null
  a: string
  quando: string | null
  gravita: "info" | "attesa" | "errore"
  letto: boolean
}

const ICONE = { info: Info, attesa: Clock, errore: CircleAlert }
const AGGIORNAMENTO_MS = 60_000
const MASSIMO_SEGNO = 99

/** Avvisi del pannello. Sono calcolati dal server; qui si salva solo cosa ha letto questo account. */
export default function Notifiche() {
  const { sessione } = useSessione()
  const client = useQueryClient()
  const base = sessione?.tipo === "admin" ? "/admin" : "/vendor"

  const { data, isError, isLoading } = useQuery({
    queryKey: ["avvisi", sessione?.tipo, sessione?.email],
    queryFn: () => api<{ non_letti: number; avvisi: Avviso[] }>(`${base}/avvisi`),
    enabled: Boolean(sessione),
    refetchInterval: AGGIORNAMENTO_MS,
  })
  const leggi = useMutation({
    mutationFn: (chiavi: string[]) => api(`${base}/avvisi/letti`, { corpo: { chiavi } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["avvisi"] }),
  })

  const avvisi = data?.avvisi ?? []
  const nonLetti = data?.non_letti ?? 0
  const daLeggere = avvisi.filter((a) => !a.letto).map((a) => a.chiave)

  return (
    <Tendina
      etichetta={nonLetti ? `Notifications: ${numero(nonLetti)} unread` : "Notifications"}
      classe="icona-pulsante campanella"
      bottone={
        <>
          <Bell size={18} aria-hidden="true" />
          {nonLetti ? <em>{nonLetti > MASSIMO_SEGNO ? `${MASSIMO_SEGNO}+` : nonLetti}</em> : null}
        </>
      }
    >
      <div className="tendina__testa notifiche__testa">
        <strong>Notifications</strong>
        {daLeggere.length ? (
          <button type="button" disabled={leggi.isPending} onClick={() => leggi.mutate(daLeggere)}>Mark all as read</button>
        ) : null}
      </div>
      {isError ? <p className="tendina__vuoto">Notifications are unavailable: try again shortly.</p> : null}
      {!isError && !isLoading && !avvisi.length ? <p className="tendina__vuoto">No notifications.</p> : null}
      {avvisi.length ? (
        <ul className="notifiche__elenco">
          {avvisi.map((avviso) => {
            const Icona = ICONE[avviso.gravita]
            return (
              <li key={avviso.chiave}>
                <Link
                  to={avviso.a}
                  className={`notifiche__voce notifiche__voce--${avviso.gravita}${avviso.letto ? " notifiche__voce--letta" : ""}`}
                  onClick={() => (avviso.letto ? undefined : leggi.mutate([avviso.chiave]))}
                >
                  <Icona size={17} aria-hidden="true" />
                  <span>
                    <strong>{avviso.titolo}</strong>
                    {avviso.dettaglio ? <small>{avviso.dettaglio}</small> : null}
                    {avviso.quando ? <time dateTime={avviso.quando}>{fa(avviso.quando)}</time> : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Tendina>
  )
}
