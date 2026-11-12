import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { Riquadro, Tabella, useAvvisi, type Colonna } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { Stato } from "../../ui"
import { CellaProdotto } from "./Scorte"
import { useAggiornaMagazzino, useMagazzino } from "./dati"
import type { Riga, Soglie as DatiSoglie, SoglieAzienda } from "./tipi"

function SogliaAzienda({ azienda, predefinita, modificabile }: { azienda: SoglieAzienda; predefinita: number; modificabile: boolean }) {
  const { admin, base } = useMagazzino()
  const aggiorna = useAggiornaMagazzino()
  const { avvisa, segnalaErrore } = useAvvisi()
  const [valore, setValore] = useState(azienda.soglia === null ? "" : String(azienda.soglia))

  const salva = useMutation({
    mutationFn: () => {
      const soglia = valore.trim() === "" ? null : Number(valore)
      return admin ? api(`${base}/soglie`, { corpo: { azienda_id: azienda.id, soglia } }) : api(`${base}/soglia`, { corpo: { soglia } })
    },
    onSuccess: () => {
      void aggiorna()
      avvisa(`Reorder point for ${azienda.nome} updated`)
    },
    onError: segnalaErrore,
  })

  if (!modificabile) return <>{numero(azienda.soglia ?? predefinita)}</>
  const invariata = valore.trim() === (azienda.soglia === null ? "" : String(azienda.soglia))
  return (
    <span className="mag-soglia">
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        aria-label={`Reorder point for ${azienda.nome}`}
        placeholder={String(predefinita)}
        value={valore}
        onChange={(e) => setValore(e.target.value)}
      />
      <button type="button" disabled={invariata || salva.isPending} onClick={() => salva.mutate()}>Save</button>
    </span>
  )
}

export default function Soglie() {
  const { admin, base } = useMagazzino()
  const { puo } = usePermessi()
  const naviga = useNavigate()
  const query = useQuery({
    queryKey: ["magazzino", "soglie", base],
    queryFn: () => api<DatiSoglie>(admin ? `${base}/soglie` : `${base}/soglia`),
  })
  const dati = query.data
  const modificabile = puo("magazzino", "edit")

  const colonneAziende: Colonna<SoglieAzienda>[] = [
    { titolo: "Company", cella: (a) => a.nome },
    { titolo: "Items", destra: true, cella: (a) => numero(a.articoli) },
    { titolo: "At or below", destra: true, cella: (a) => numero(a.sotto_soglia) },
    { titolo: "Reorder point", destra: true, cella: (a) => <SogliaAzienda key={a.soglia} azienda={a} predefinita={dati?.soglia_predefinita ?? 0} modificabile={modificabile} /> },
  ]

  const colonneArticoli: Colonna<Riga>[] = [
    { titolo: "Product", cella: (r) => <CellaProdotto riga={r} /> },
    { titolo: "SKU", cella: (r) => <code className="mag-sku">{r.sku ?? "–"}</code> },
    ...(admin ? [{ titolo: "Company", cella: (r: Riga) => r.azienda }] : []),
    { titolo: "Available", destra: true, cella: (r) => numero(r.disponibili) },
    { titolo: "Reorder point", destra: true, cella: (r) => numero(r.soglia) },
  ]

  return (
    <>
      <Stato caricamento={query.isLoading} errore={query.error} vuoto={false} testoVuoto="" />
      {dati ? (
        <>
          <Riquadro
            titolo={`Default reorder point: ${numero(dati.soglia_predefinita)} units`}
            testo="Applies to any item without its own level and any company without a shared one. At or below this available quantity an item shows as low stock."
          >
            <p className="mag-nota">The item level wins, then the company level, then the default. Leave a field empty to fall back to the next one.</p>
          </Riquadro>
          <Riquadro titolo={admin ? "Reorder point by company" : "Your company's reorder point"}>
            {dati.aziende.length ? (
              <Tabella etichetta="Reorder point by company" colonne={colonneAziende} righe={dati.aziende} chiave={(a) => a.id} />
            ) : (
              <p className="mag-nota">No company has items in a warehouse yet.</p>
            )}
          </Riquadro>
          <Riquadro titolo="Items with their own reorder point" testo="Change it from the item page.">
            {dati.articoli.length ? (
              <Tabella etichetta="Items with their own reorder point" colonne={colonneArticoli} righe={dati.articoli} chiave={(r) => r.id} onApri={(r) => naviga(`/magazzino/scorte/${r.articolo_id}`)} />
            ) : (
              <p className="mag-nota">No item has its own reorder point.</p>
            )}
          </Riquadro>
        </>
      ) : null}
    </>
  )
}
