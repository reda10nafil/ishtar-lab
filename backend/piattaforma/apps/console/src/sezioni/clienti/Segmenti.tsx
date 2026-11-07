import { useMutation, useQuery } from "@tanstack/react-query"
import { UsersRound } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, Tabella, Vuoto, useAvvisi, type Colonna } from "../../componenti"
import { numero, percentuale } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Campo, Conferma, Modale, Stato, euro } from "../../ui"
import { iniziali, regolaSegmento, useAggiornaClienti } from "./dati"
import type { DatiSegmenti } from "./tipi"

type RigaGruppo = DatiSegmenti["gruppi"][number]

function ModuloGruppo({ gruppo, onChiudi }: { gruppo?: RigaGruppo; onChiudi: () => void }) {
  const aggiorna = useAggiornaClienti()
  const { avvisa } = useAvvisi()
  const [nome, setNome] = useState(gruppo?.nome ?? "")
  const salva = useMutation({
    mutationFn: () => api(gruppo ? `/admin/clienti/gruppi/${gruppo.id}` : "/admin/clienti/gruppi", { corpo: { nome } }),
    onSuccess: () => {
      void aggiorna()
      avvisa(gruppo ? "Group renamed" : "Group created")
      onChiudi()
    },
  })
  const invia = (e: FormEvent) => {
    e.preventDefault()
    salva.mutate()
  }
  return (
    <Modale titolo={gruppo ? "Rename group" : "New group"} sottotitolo="Add customers from their own page." onChiudi={onChiudi}>
      <form className="modulo" onSubmit={invia}>
        <Campo etichetta="Group name">
          <input required maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        {salva.error ? <p className="avviso-stato avviso-stato--errore" role="alert">{salva.error.message}</p> : null}
        <button className="primario" type="submit" disabled={salva.isPending}>{salva.isPending ? "Saving..." : "Save group"}</button>
      </form>
    </Modale>
  )
}

export default function Segmenti() {
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const aggiorna = useAggiornaClienti()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [modulo, setModulo] = useState<RigaGruppo | "nuovo" | null>(null)
  const [daEliminare, setDaEliminare] = useState<RigaGruppo | null>(null)
  const query = useQuery({ queryKey: ["clienti", "segmenti"], queryFn: () => api<DatiSegmenti>("/admin/clienti/segmenti") })
  const elimina = useMutation({
    mutationFn: (gruppo: RigaGruppo) => api(`/admin/clienti/gruppi/${gruppo.id}`, { metodo: "DELETE" }),
    onSuccess: () => {
      void aggiorna()
      setDaEliminare(null)
      avvisa("Group deleted")
    },
    onError: (errore) => {
      setDaEliminare(null)
      segnalaErrore(errore)
    },
  })

  const dati = query.data
  const puoCreare = puo("customer_groups", "edit")
  const puoEliminare = puo("customer_groups", "manage")
  const massimo = Math.max(1, ...(dati?.citta.map((c) => c.conteggio) ?? []))

  const colonne: Colonna<RigaGruppo>[] = [
    { titolo: "Group", cella: (g) => <strong>{g.nome}</strong> },
    { titolo: "Customers", destra: true, cella: (g) => numero(g.conteggio) },
    ...(puoCreare || puoEliminare
      ? [
          {
            titolo: "Actions",
            cella: (g: RigaGruppo) => (
              <span className="riga__azioni">
                {puoCreare ? <button type="button" onClick={(e) => { e.stopPropagation(); setModulo(g) }}>Rename</button> : null}
                {puoEliminare ? <button type="button" onClick={(e) => { e.stopPropagation(); setDaEliminare(g) }}>Delete</button> : null}
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati ? (
        <>
          <div className="cli-segmenti">
            {dati.segmenti.map((s) => (
              <Link key={s.chiave} className="cli-segmento vetro" to={`/clienti/persone?segmento=${s.chiave}`}>
                <span className="cli-segmento__nome">{s.nome}</span>
                <small>{regolaSegmento(s.chiave, dati.regole)}</small>
                <strong>{numero(s.conteggio)}</strong>
                <small>{percentuale(dati.totale ? s.conteggio / dati.totale : 0)} of customers</small>
                <span className="cli-segmento__piede">
                  <span className="cli-gruppo-iniziali" aria-hidden="true">
                    {s.anteprima.map((c) => <span key={c.id} className="cli-iniziali">{iniziali(c)}</span>)}
                  </span>
                  <small>{s.media === null ? "No spend yet" : `avg ${euro(s.media)}`}</small>
                </span>
              </Link>
            ))}
          </div>
          <Riquadro titolo="Where they live" testo="Customers by town, from their default delivery address.">
            {dati.citta.length ? (
              <ul className="cli-citta">
                {dati.citta.map((c) => (
                  <li key={c.nome}>
                    <Link to={`/clienti/persone?citta=${encodeURIComponent(c.nome)}`}>{c.nome}</Link>
                    <i aria-hidden="true"><b style={{ width: `${(c.conteggio / massimo) * 100}%` }} /></i>
                    <span>{numero(c.conteggio)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cli-nota">No customer has an address with a town yet.</p>
            )}
          </Riquadro>
          {puo("customer_groups", "view") ? (
            <Riquadro
              titolo="Customer groups"
              testo="Hand-picked groups for discounts and price lists."
              azioni={puoCreare ? <button type="button" className="primario" onClick={() => setModulo("nuovo")}>New group</button> : undefined}
            >
              {dati.gruppi.length ? (
                <Tabella etichetta="Customer groups" colonne={colonne} righe={dati.gruppi} chiave={(g) => g.id} onApri={(g) => naviga(`/clienti/persone?gruppo=${g.id}`)} />
              ) : (
                <Vuoto icona={UsersRound} titolo="No groups yet" testo="Create a group to bring together customers you treat the same way." />
              )}
            </Riquadro>
          ) : null}
        </>
      ) : null}
      {modulo ? <ModuloGruppo gruppo={modulo === "nuovo" ? undefined : modulo} onChiudi={() => setModulo(null)} /> : null}
      {daEliminare ? (
        <Conferma
          titolo={`Delete the group ${daEliminare.nome}?`}
          testo="The customers stay: only the group goes."
          azione="Yes, delete group"
          attesa={elimina.isPending}
          onConferma={() => elimina.mutate(daEliminare)}
          onChiudi={() => setDaEliminare(null)}
        />
      ) : null}
    </>
  )
}
