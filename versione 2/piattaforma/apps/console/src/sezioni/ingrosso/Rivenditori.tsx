import { useQuery } from "@tanstack/react-query"
import { Plus, Store } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../../api/client"
import { Vuoto } from "../../componenti"
import { usePermessi } from "../../permessi"
import { Etichetta, Stato } from "../../ui"
import { ModuloRivenditore } from "./ModuloRivenditore"
import { conteggioDi, importoTondo, sigla, tintaDi } from "./testi"
import type { Rivenditore } from "./tipi"

export default function Rivenditori() {
  const { puo } = usePermessi()
  const [parametri, setParametri] = useSearchParams()
  const [aperto, setAperto] = useState<Rivenditore | null>(null)
  const scrive = puo("ingrosso", "edit")
  const nuovo = parametri.get("nuovo") === "rivenditore" && scrive
  const daAprire = parametri.get("apri")

  const query = useQuery({ queryKey: ["ingrosso", "rivenditori"], queryFn: () => api<{ rivenditori: Rivenditore[] }>("/admin/ingrosso/rivenditori") })
  const rivenditori = query.data?.rivenditori ?? []

  // Dalla bozza d'ordine si arriva qui per completare i dati mancanti.
  useEffect(() => {
    const trovato = daAprire ? rivenditori.find((r) => r.id === daAprire) : undefined
    if (!trovato) return
    setAperto(trovato)
    setParametri({}, { replace: true })
  }, [daAprire, rivenditori, setParametri])

  const chiudiNuovo = () => setParametri({}, { replace: true })

  return (
    <section className="ing-blocco vetro" aria-label="Stockists">
      <header className="ing-blocco__testa">
        <div>
          <h2>Stockists</h2>
          <p>The shops that buy from you on trade terms.</p>
        </div>
        {scrive ? <button type="button" className="ing-blocco__azione" onClick={() => setParametri({ nuovo: "rivenditore" })}><Plus size={15} aria-hidden="true" /> New stockist</button> : null}
      </header>

      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {query.isSuccess && !rivenditori.length ? (
        <Vuoto icona={Store} titolo="No stockists yet" testo="Add the first one with contacts, price terms, payment terms and a minimum order. Deals on the board hang off a stockist." />
      ) : null}

      {rivenditori.length ? (
        <ul className="ing-rivenditori">
          {rivenditori.map((r) => (
            <li key={r.id}>
              <button type="button" className="ing-rivenditore" disabled={!scrive} onClick={() => setAperto(r)}>
                <span className={`ing-sigla ing-tinta${tintaDi(r.nome)}`} aria-hidden="true">{sigla(r.nome)}</span>
                <span className="ing-rivenditore__testo">
                  <strong>{r.nome}</strong>
                  <small>{[r.citta, r.referente, r.pagamento].filter(Boolean).join(" · ")}</small>
                </span>
                {r.email ? null : <Etichetta tono="attesa">Email missing</Etichetta>}
                <span className="ing-rivenditore__valori">
                  <strong>{r.valore_recente ? importoTondo(r.valore_recente) : "–"}</strong>
                  <small>{conteggioDi(r.ordini_recenti, "order")} · 30d</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {nuovo ? <ModuloRivenditore onChiudi={chiudiNuovo} /> : null}
      {aperto ? <ModuloRivenditore rivenditore={aperto} onChiudi={() => setAperto(null)} /> : null}
    </section>
  )
}
