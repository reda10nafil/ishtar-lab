import { useMutation } from "@tanstack/react-query"
import { Banknote, Check, CreditCard, Nfc, Printer } from "lucide-react"
import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { euro, Modale } from "../../ui"
import { importoBreve, tagliRapidi } from "./dati"
import { Scontrino } from "./Scontrino"
import type { Cliente, Metodo, RigaCestino, Vendita } from "./tipi"

type Proprieta = {
  righe: RigaCestino[]
  pezzi: number
  totale: number
  codice: string | null
  cliente: Cliente | null
  onVenduto: () => void
  onProssimo: () => void
  onChiudi: () => void
}

function Contanti({ totale, ricevuto, onCambia }: { totale: number; ricevuto: string; onCambia: (valore: string) => void }) {
  const importo = Number(ricevuto.replace(",", "."))
  const scritto = ricevuto.trim() !== "" && !Number.isNaN(importo)
  const mancano = scritto ? totale - importo : 0
  return (
    <div className="incasso__contanti">
      <label className="canale-campo">
        <span>Cash handed over</span>
        <input autoFocus inputMode="decimal" value={ricevuto} placeholder={euro(totale)} onChange={(e) => onCambia(e.target.value)} />
      </label>
      <div className="incasso__tagli">
        {tagliRapidi(totale).map((taglio) => (
          <button key={taglio} type="button" aria-pressed={scritto && importo === taglio} onClick={() => onCambia(String(taglio))}>{importoBreve(taglio)}</button>
        ))}
      </div>
      <p className="incasso__resto">
        {!scritto ? "Enter what they hand you" : mancano > 0 ? <>{euro(mancano)} short</> : <>Change: <b>{euro(-mancano)}</b></>}
      </p>
    </div>
  )
}

function Carta() {
  return (
    <div className="incasso__carta">
      <span className="incasso__lettore"><Nfc size={24} aria-hidden="true" /></span>
      <p>No card reader is connected. Take the payment on your own terminal, then record it here.</p>
    </div>
  )
}

function Pagato({ vendita, onProssimo }: { vendita: Vendita; onProssimo: () => void }) {
  return (
    <>
      <div className="incasso__pagato">
        <span className="incasso__spunta"><Check size={26} strokeWidth={3} aria-hidden="true" /></span>
        <span className="incasso__piu" aria-hidden="true">+{euro(vendita.totale)}</span>
        <h3>Paid · {euro(vendita.totale)}</h3>
        {vendita.metodo === "contanti" ? <p>Change to give: <b>{euro(vendita.resto)}</b></p> : <p>Card payment recorded by hand</p>}
        <Scontrino vendita={vendita} />
      </div>
      <div className="cassa-piede">
        <Link className="incasso__ordine" to={`/ordini/tutti/${vendita.id}`}>View order #{vendita.numero}</Link>
        <button type="button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Print</button>
        <button type="button" className="primario" onClick={onProssimo}>Next customer</button>
      </div>
    </>
  )
}

/** Incasso: contanti con il resto, oppure carta registrata a mano. La vendita vera nasce sul server. */
export function ModaleIncasso({ righe, pezzi, totale, codice, cliente, onVenduto, onProssimo, onChiudi }: Proprieta) {
  const { segnalaErrore } = useAvvisi()
  const [metodo, setMetodo] = useState<Metodo>("carta")
  const [ricevuto, setRicevuto] = useState("")
  const importo = Number(ricevuto.replace(",", "."))

  const vendi = useMutation({
    mutationFn: () =>
      api<{ vendita: Vendita }>("/admin/cassa/vendite", {
        corpo: {
          righe: righe.map((r) => ({ offerta_id: r.offerta_id, quantita: r.quantita })),
          codice,
          cliente_id: cliente?.id ?? null,
          metodo,
          ricevuto: metodo === "contanti" ? importo : null,
          totale_atteso: totale,
        },
      }),
    onSuccess: onVenduto,
    onError: segnalaErrore,
  })

  const vendita = vendi.data?.vendita
  const contantiOk = ricevuto.trim() !== "" && !Number.isNaN(importo) && importo >= totale
  // Stabile: `Modale` rimette il fuoco sul primo campo ogni volta che questa funzione cambia.
  const venduta = Boolean(vendita)
  const chiudi = useCallback(() => (venduta ? onProssimo() : onChiudi()), [venduta, onProssimo, onChiudi])

  return (
    <Modale titolo={`Take ${euro(vendita?.totale ?? totale)}`} sottotitolo={[`${numero(pezzi)} ${pezzi === 1 ? "item" : "items"}`, codice].filter(Boolean).join(" · ")} onChiudi={chiudi}>
      {vendita ? (
        <Pagato vendita={vendita} onProssimo={onProssimo} />
      ) : (
        <div className="incasso">
          <div className="selettore incasso__scelta">
            <button type="button" className={metodo === "carta" ? "attivo" : undefined} aria-pressed={metodo === "carta"} onClick={() => setMetodo("carta")}><CreditCard size={16} aria-hidden="true" /> Card</button>
            <button type="button" className={metodo === "contanti" ? "attivo" : undefined} aria-pressed={metodo === "contanti"} onClick={() => setMetodo("contanti")}><Banknote size={16} aria-hidden="true" /> Cash</button>
          </div>
          {metodo === "carta" ? <Carta /> : <Contanti totale={totale} ricevuto={ricevuto} onCambia={setRicevuto} />}
          <div className="cassa-piede">
            <button type="button" onClick={onChiudi}>Cancel</button>
            <button type="button" className="primario" disabled={vendi.isPending || (metodo === "contanti" && !contantiOk)} onClick={() => vendi.mutate()}>
              <Check size={18} aria-hidden="true" /> {metodo === "carta" ? "Card approved" : "Take cash"}
            </button>
          </div>
        </div>
      )}
    </Modale>
  )
}
