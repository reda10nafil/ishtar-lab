import { dataOra, euro } from "../../ui"
import type { Vendita } from "./tipi"

/** Scontrino della vendita. In stampa resta solo questo blocco, vedi `cassa.css`. */
export function Scontrino({ vendita }: { vendita: Vendita }) {
  const sottotitolo = [vendita.indirizzo, dataOra(vendita.data)].filter(Boolean).join(" · ")
  return (
    <div className="scontrino">
      <b className="scontrino__negozio">{vendita.negozio}</b>
      <small>{sottotitolo}</small>
      <div className="scontrino__taglio" />
      {vendita.righe.map((riga, indice) => (
        <div className="scontrino__riga" key={`${riga.prodotto}-${indice}`}>
          <span>{riga.quantita} × {riga.prodotto} · {riga.taglia}</span>
          <span>{euro(riga.totale)}</span>
        </div>
      ))}
      <div className="scontrino__taglio" />
      {vendita.sconto ? (
        <div className="scontrino__riga">
          <span>{vendita.codice ?? "Discount"}</span>
          <span>−{euro(vendita.sconto)}</span>
        </div>
      ) : null}
      <div className="scontrino__riga scontrino__totale">
        <span>Total</span>
        <span>{euro(vendita.totale)}</span>
      </div>
      <div className="scontrino__riga">
        <span>{vendita.metodo === "contanti" ? "Cash" : "Card, recorded by hand"}</span>
        <span>{euro(vendita.ricevuto)}</span>
      </div>
      {vendita.iva === null ? null : (
        <div className="scontrino__riga">
          <span>Includes VAT</span>
          <span>{euro(vendita.iva)}</span>
        </div>
      )}
      {vendita.cliente ? <small>{vendita.cliente.nome}</small> : null}
      <small>Sale #{vendita.numero} · thank you</small>
    </div>
  )
}
