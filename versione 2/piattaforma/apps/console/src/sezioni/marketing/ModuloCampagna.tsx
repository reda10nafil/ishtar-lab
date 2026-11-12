import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Send } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { Campo, Modale } from "../../ui"
import type { Campagna, DatiCampagne } from "./tipi"

type Quando = "bozza" | "domani" | "tre_giorni" | "settimana" | "scelta"

const OPZIONI: { valore: Quando; testo: string }[] = [
  { valore: "bozza", testo: "Save as a draft" },
  { valore: "domani", testo: "Tomorrow, 8am" },
  { valore: "tre_giorni", testo: "In 3 days" },
  { valore: "settimana", testo: "Next week" },
  { valore: "scelta", testo: "Pick a date and time" },
]

const alleOtto = (giorni: number) => {
  const data = new Date()
  data.setDate(data.getDate() + giorni)
  data.setHours(8, 0, 0, 0)
  return data.toISOString()
}

const ALLE: Partial<Record<Quando, number>> = { domani: 1, tre_giorni: 3, settimana: 7 }

const perCampoData = (valore: string | null) => {
  if (!valore) return ""
  const d = new Date(valore)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Nuova campagna o modifica: l'invio vero parte solo da Schedule o da Send now, mai salvando una bozza. */
export default function ModuloCampagna({ campagna, onChiudi, onFatto }: { campagna?: Campagna; onChiudi: () => void; onFatto: () => void }) {
  const client = useQueryClient()
  const { avvisa, segnalaErrore } = useAvvisi()
  const { data } = useQuery({ queryKey: ["marketing", "campagne"], queryFn: () => api<DatiCampagne>("/admin/marketing/campagne") })
  const [nome, setNome] = useState(campagna?.nome ?? "")
  const [oggetto, setOggetto] = useState(campagna?.oggetto ?? "")
  const [testo, setTesto] = useState(campagna?.testo ?? "")
  const [pubblico, setPubblico] = useState(campagna?.pubblico ?? "tutti")
  const [quando, setQuando] = useState<Quando>(campagna?.programmata_il ? "scelta" : "bozza")
  const [data_ora, setDataOra] = useState(perCampoData(campagna?.programmata_il ?? null))

  const salva = useMutation({
    mutationFn: async () => {
      const corpo = { nome, oggetto, testo, pubblico }
      const { campagna: salvata } = await (campagna
        ? api<{ campagna: Campagna }>(`/admin/marketing/campagne/${campagna.id}`, { corpo })
        : api<{ campagna: Campagna }>("/admin/marketing/campagne", { corpo }))
      if (quando === "bozza") {
        if (campagna?.programmata_il) await api(`/admin/marketing/campagne/${salvata.id}/programma`, { metodo: "DELETE" })
        return "Saved as a draft"
      }
      const momento = quando === "scelta" ? new Date(data_ora).toISOString() : alleOtto(ALLE[quando] ?? 1)
      await api(`/admin/marketing/campagne/${salvata.id}/programma`, { corpo: { quando: momento } })
      return "Campaign scheduled"
    },
    onSuccess: (messaggio) => {
      avvisa(messaggio)
      client.invalidateQueries({ queryKey: ["marketing"] })
      onFatto()
    },
    onError: (errore) => {
      client.invalidateQueries({ queryKey: ["marketing"] })
      segnalaErrore(errore)
    },
  })

  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }

  const scelto = data?.pubblici.find((p) => p.chiave === pubblico)
  const vuoto = !nome.trim() || !oggetto.trim() || !testo.trim() || (quando === "scelta" && !data_ora)

  return (
    <Modale titolo={campagna ? "Edit campaign" : "New campaign"} onChiudi={onChiudi}>
      <form className="modulo mk-modulo" onSubmit={invia}>
        <Campo etichetta="Name">
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="New season drop" maxLength={120} />
        </Campo>
        <div className="griglia-due">
          <Campo etichetta="Channel">
            <select defaultValue="email">
              <option value="email">Email</option>
              <option value="instagram" disabled>Instagram (not connected)</option>
              <option value="sms" disabled>SMS (not connected)</option>
            </select>
          </Campo>
          <Campo etichetta="Send">
            <select value={quando} onChange={(e) => setQuando(e.target.value as Quando)}>
              {OPZIONI.map((o) => <option key={o.valore} value={o.valore}>{o.testo}</option>)}
            </select>
          </Campo>
        </div>
        {quando === "scelta" ? (
          <Campo etichetta="Date and time">
            <input type="datetime-local" value={data_ora} onChange={(e) => setDataOra(e.target.value)} />
          </Campo>
        ) : null}
        <Campo etichetta="Audience" aiuto={scelto ? `${numero(scelto.conteggio)} ${scelto.conteggio === 1 ? "customer" : "customers"} who agreed to marketing emails · ${scelto.regola}` : null}>
          <select value={pubblico} onChange={(e) => setPubblico(e.target.value)}>
            {(data?.pubblici ?? []).map((p) => <option key={p.chiave} value={p.chiave}>{p.nome} ({numero(p.conteggio)})</option>)}
          </select>
        </Campo>
        <Campo etichetta="Subject line">
          <input value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="The new pieces are here" maxLength={180} />
        </Campo>
        <Campo etichetta="Message" aiuto="An unsubscribe link is added to every email.">
          <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={5} placeholder="What do you want to tell your customers?" />
        </Campo>
        <p className="mk-canali">Instagram and SMS aren't connected yet. <Link to="/connettori">Connect them in Apps</Link></p>
        <div className="riga__azioni mk-modulo__azioni">
          <button type="button" onClick={onChiudi}>Cancel</button>
          <button type="submit" className="primario" disabled={vuoto || salva.isPending}>
            <Send size={18} aria-hidden="true" /> {quando === "bozza" ? "Save draft" : "Schedule"}
          </button>
        </div>
      </form>
    </Modale>
  )
}
