import { useQuery } from "@tanstack/react-query"
import { Plus, Store } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { CampoRicerca, Vuoto } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Etichetta, Stato, euro } from "../../ui"
import { ModuloRivenditore } from "./ModuloRivenditore"
import { condizioni, conteggioDi, sigla } from "./testi"
import type { Rivenditore } from "./tipi"

export default function Rivenditori() {
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [testo, setTesto] = useState("")
  const [aperto, setAperto] = useState<Rivenditore | null>(null)
  const scrive = puo("ingrosso", "edit")
  const nuovo = parametri.get("nuovo") === "rivenditore" && scrive
  const daAprire = parametri.get("apri")

  const query = useQuery({ queryKey: ["ingrosso", "rivenditori"], queryFn: () => api<{ rivenditori: Rivenditore[] }>("/admin/ingrosso/rivenditori") })
  const tutti = query.data?.rivenditori ?? []
  const cerca = testo.trim().toLowerCase()
  const rivenditori = cerca ? tutti.filter((r) => [r.nome, r.referente, r.email, r.citta].some((v) => v?.toLowerCase().includes(cerca))) : tutti

  // Dalla bozza d'ordine si arriva qui per completare i dati mancanti.
  useEffect(() => {
    const trovato = daAprire ? tutti.find((r) => r.id === daAprire) : undefined
    if (!trovato) return
    setAperto(trovato)
    setParametri({}, { replace: true })
  }, [daAprire, tutti, setParametri])

  const chiudiNuovo = () => setParametri({}, { replace: true })
  const creaAzione = <button type="button" onClick={() => setParametri({ nuovo: "rivenditore" })}><Plus size={17} aria-hidden="true" /> New stockist</button>

  return (
    <section className="ing-blocco vetro" aria-label="Stockists">
      <header className="ing-blocco__testa">
        <div>
          <h2>Stockists</h2>
          <p>The shops that buy from you on trade terms.</p>
        </div>
        <div className="ing-blocco__azioni">
          {tutti.length ? <CampoRicerca valore={testo} etichetta="Search stockists" onCambia={setTesto} /> : null}
          {scrive ? creaAzione : null}
        </div>
      </header>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !tutti.length ? (
        <Vuoto icona={Store} titolo="No stockists yet" testo="Add the first one with contacts, price terms, payment terms and a minimum order. Deals on the board hang off a stockist." />
      ) : null}
      {tutti.length && !rivenditori.length ? <Vuoto icona={Store} titolo="No stockists found" testo="Try another search." /> : null}

      <ul className="ing-rivenditori">
        {rivenditori.map((r) => (
          <li key={r.id}>
            <button type="button" className="ing-rivenditore" disabled={!scrive} onClick={() => setAperto(r)}>
              <span className="ing-sigla" aria-hidden="true">{sigla(r.nome)}</span>
              <span className="ing-rivenditore__testo">
                <strong>{r.nome}</strong>
                <small>{[r.citta, r.referente, r.pagamento, condizioni(r)].filter(Boolean).join(" · ")}</small>
                {r.email ? null : <Etichetta tono="attesa">Email missing</Etichetta>}
              </span>
              <span className="ing-rivenditore__valori">
                <strong>{r.valore_aperto ? euro(r.valore_aperto) : "–"}</strong>
                <small>{conteggioDi(r.trattative_aperte, "open deal")}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {nuovo ? <ModuloRivenditore onChiudi={chiudiNuovo} /> : null}
      {aperto ? <ModuloRivenditore rivenditore={aperto} onChiudi={() => setAperto(null)} /> : null}
    </section>
  )
}
