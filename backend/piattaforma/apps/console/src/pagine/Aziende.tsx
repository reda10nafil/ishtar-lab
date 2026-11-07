import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Plus } from "lucide-react"
import { useState, type FormEvent } from "react"
import { api } from "../api/client"
import type { Azienda } from "../api/tipi"
import { CampoRicerca, Riquadro, Vuoto } from "../componenti"
import { STATI_AZIENDA, numero, stato } from "../lingua"
import { usePermessi } from "../permessi"
import { Campo, Etichetta, Modale, Pagina, Stato, dataBreve } from "../ui"
import "./aziende.css"

type Conteggi = { products?: { id: string }[] | null; orders?: { id: string }[] | null }
type RigaAzienda = Azienda & Conteggi

const CAMPI = "id,name,email,status,created_at,products.id,orders.id"
const FILTRI = ["tutte", ...Object.keys(STATI_AZIENDA)]

/** Le azioni possibili dipendono dallo stato; per le altre l'azienda non offre nulla da fare. */
const AZIONI: Record<string, { verbo: string; testo: string }> = {
  pending_approval: { verbo: "approve", testo: "Approve" },
  open: { verbo: "suspend", testo: "Suspend" },
  suspended: { verbo: "unsuspend", testo: "Reactivate" },
}

const conta = (quanti: number, singolare: string) => `${numero(quanti)} ${singolare}${quanti === 1 ? "" : "s"}`

function NuovaAzienda({ onChiudi }: { onChiudi: () => void }) {
  const client = useQueryClient()
  const [dati, setDati] = useState({ nome: "", email: "" })
  const crea = useMutation({
    mutationFn: () =>
      api("/admin/sellers", {
        corpo: { name: dati.nome.trim(), email: dati.email.trim(), currency_code: "eur", member: { email: dati.email.trim() } },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["aziende"] })
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    crea.mutate()
  }
  return (
    <Modale titolo="New company" sottotitolo="The company will receive an email invitation to activate its access." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Company name">
          <input required value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} />
        </Campo>
        <Campo etichetta="Contact email">
          <input type="email" required value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} />
        </Campo>
        {crea.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{crea.error.message}</p> : null}
        <button className="primario" type="submit" disabled={crea.isPending}>{crea.isPending ? "Creating..." : "Create and invite"}</button>
      </form>
    </Modale>
  )
}

export default function Aziende() {
  const client = useQueryClient()
  const { puo } = usePermessi()
  const [nuova, setNuova] = useState(false)
  const [filtro, setFiltro] = useState("tutte")
  const [testo, setTesto] = useState("")
  const query = useQuery({
    queryKey: ["aziende"],
    queryFn: () => api<{ sellers: RigaAzienda[] }>(`/admin/sellers?limit=100&fields=${CAMPI}`),
  })
  const azione = useMutation({
    mutationFn: ({ id, verbo }: { id: string; verbo: string }) => api(`/admin/sellers/${id}/${verbo}`, { corpo: {} }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["aziende"] }),
  })
  const puoGestire = puo("sellers", "edit")
  const tutte = query.data?.sellers ?? []
  const cerca = testo.trim().toLowerCase()
  const visibili = tutte.filter((a) => (filtro === "tutte" || a.status === filtro) && (!cerca || `${a.name} ${a.email}`.toLowerCase().includes(cerca)))
  const creaAzione = puoGestire ? <button className="primario" type="button" onClick={() => setNuova(true)}><Plus size={17} aria-hidden="true" /> New company</button> : null

  return (
    <Pagina titolo="Companies" sottotitolo={`${numero(tutte.length)} partner companies bring their products to Ishtar Lab.`} azioni={creaAzione}>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {azione.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{azione.error.message}</p> : null}
      {query.isSuccess && !tutte.length ? <Vuoto icona={Building2} titolo="No companies yet" testo="Add the first partner company: it will receive an email invitation." azione={creaAzione} /> : null}

      {tutte.length ? (
        <>
          <div className="filtri aziende-filtri" role="group" aria-label="Status">
            {FILTRI.map((chiave) => {
              const quante = chiave === "tutte" ? tutte.length : tutte.filter((a) => a.status === chiave).length
              const nome = chiave === "tutte" ? "All" : STATI_AZIENDA[chiave].testo
              return (
                <button key={chiave} type="button" aria-pressed={filtro === chiave} className={filtro === chiave ? "attivo" : ""} onClick={() => setFiltro(chiave)}>
                  {nome} <em>{numero(quante)}</em>
                </button>
              )
            })}
            <CampoRicerca valore={testo} etichetta="Search by name or email" onCambia={setTesto} />
          </div>

          <Riquadro titolo="Partner companies" testo="Independent companies that sell through Ishtar Lab">
            {visibili.length ? (
              <ul className="aziende">
                {visibili.map((a) => {
                  const etichetta = stato(STATI_AZIENDA, a.status)
                  const possibile = AZIONI[a.status]
                  return (
                    <li key={a.id} className="azienda">
                      <span className="anteprima anteprima--vuota" aria-hidden="true">{a.name.slice(0, 2).toUpperCase()}</span>
                      <div className="azienda__testo">
                        <strong>{a.name}</strong>
                        <small>{a.email} · Joined {dataBreve(a.created_at)}</small>
                      </div>
                      <div className="azienda__dati">
                        <Etichetta tono={etichetta.tono}>{etichetta.testo}</Etichetta>
                        <small>{conta(a.products?.length ?? 0, "product")} · {conta(a.orders?.length ?? 0, "order")}</small>
                      </div>
                      {puoGestire && possibile ? (
                        <button type="button" disabled={azione.isPending} aria-label={`${possibile.testo} ${a.name}`} onClick={() => azione.mutate({ id: a.id, verbo: possibile.verbo })}>
                          {possibile.testo}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="avviso-stato">No companies match this filter.</p>
            )}
          </Riquadro>
        </>
      ) : null}

      {nuova ? <NuovaAzienda onChiudi={() => setNuova(false)} /> : null}
    </Pagina>
  )
}
