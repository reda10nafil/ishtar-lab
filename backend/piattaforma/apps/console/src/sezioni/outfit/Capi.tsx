import { CircleAlert, CircleCheck, Replace, X } from "lucide-react"
import { Riquadro } from "../../componenti"
import { numero } from "../../lingua"
import { Anteprima, Etichetta, euro } from "../../ui"
import { chiaveCapo } from "./comuni"
import type { Capo, Disponibilita, Sorgente, Variante } from "./tipi"

const prezzoDi = (s: Pick<Sorgente, "prezzo" | "prezzo_varia">) => (s.prezzo === null ? "No price" : `${s.prezzo_varia ? "from " : ""}${euro(s.prezzo)}`)

const quantitaLeggibile = (v: Pick<Variante, "quantita">) => (v.quantita === null ? "stock not tracked" : `${numero(v.quantita)} available`)

/** Le taglie che il cliente potrà scegliere, con le scorte vere dell'azienda. */
export function Taglie({ varianti }: { varianti: Pick<Variante, "id" | "titolo" | "quantita" | "disponibile">[] }) {
  if (!varianti.length) return null
  return (
    <ul className="taglie" aria-label="Sizes">
      {varianti.map((v) => (
        <li key={v.id} className={v.disponibile ? undefined : "taglie__esaurita"} title={`${v.titolo}: ${quantitaLeggibile(v)}`}>
          {v.titolo} <span>{v.quantita === null ? "–" : numero(v.quantita)}</span>
        </li>
      ))}
    </ul>
  )
}

function Stato({ sorgente }: { sorgente: Sorgente }) {
  return sorgente.acquistabile ? <Etichetta tono="ok">Available</Etichetta> : <Etichetta tono="attesa">{sorgente.problema ?? "Not available"}</Etichetta>
}

function RigaCapo({ capo, modificabile, scelto, onSeleziona, onAlternativa, onTogliAlternativa }: {
  capo: Capo
  modificabile: boolean
  scelto: boolean
  onSeleziona: () => void
  onAlternativa: () => void
  onTogliAlternativa: () => void
}) {
  return (
    <li className={`capo-riga${scelto ? " capo-riga--scelta" : ""}`}>
      <button type="button" className="capo-riga__apri" aria-label={`Select ${capo.titolo} on the canvas`} aria-pressed={scelto} onClick={onSeleziona}>
        <Anteprima url={capo.foto} titolo={capo.titolo} />
      </button>
      <div className="capo-riga__corpo">
        <div className="capo-riga__testa">
          <div className="riga__testo">
            <strong>{capo.titolo}</strong>
            <small>{capo.azienda_nome} · {prezzoDi(capo)}</small>
          </div>
          <Stato sorgente={capo} />
        </div>
        <Taglie varianti={capo.varianti} />
        {capo.alternativa ? (
          <div className="capo-alternativa">
            <Replace size={16} aria-hidden="true" />
            <div className="riga__testo">
              <strong>{capo.in_sostituzione ? "Replacement in use" : "Alternative"}: {capo.alternativa.titolo}</strong>
              <small>{capo.alternativa.azienda_nome} · {prezzoDi(capo.alternativa)}</small>
            </div>
            <Stato sorgente={capo.alternativa} />
            {modificabile ? (
              <button type="button" className="icona-pulsante" aria-label={`Remove the alternative for ${capo.titolo}`} onClick={onTogliAlternativa}>
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : modificabile ? (
          <button type="button" className="capo-riga__alternativa" onClick={onAlternativa}>
            <Replace size={16} aria-hidden="true" /> Add an alternative
          </button>
        ) : null}
      </div>
    </li>
  )
}

export default function Capi({ capi, disponibilita, modificabile, selezionato, onSeleziona, onAlternativa, onTogliAlternativa }: {
  capi: Capo[]
  disponibilita: Disponibilita
  modificabile: boolean
  selezionato: string | null
  onSeleziona: (chiave: string) => void
  onAlternativa: (chiave: string) => void
  onTogliAlternativa: (chiave: string) => void
}) {
  return (
    <Riquadro titolo="Pieces and availability" testo="Worked out from live stock: the outfit can be bought while every piece can.">
      {disponibilita.acquistabile ? (
        <p className="avviso-stato avviso-stato--ok outfit-esito">
          <CircleCheck size={18} aria-hidden="true" />
          {disponibilita.capi_sostituiti === 0
            ? "Buyable"
            : disponibilita.capi_sostituiti === 1
              ? "Buyable, with 1 piece replaced"
              : `Buyable, with ${numero(disponibilita.capi_sostituiti)} pieces replaced`}
        </p>
      ) : (
        <div className="avviso-stato avviso-stato--attesa outfit-esito" role="status">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <strong>Not buyable</strong>
            <ul>{disponibilita.motivi.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul>
          </div>
        </div>
      )}
      {capi.length ? (
        <ul className="capi-elenco">
          {capi.map((capo) => {
            const chiave = chiaveCapo(capo)
            return (
              <RigaCapo
                key={chiave}
                capo={capo}
                modificabile={modificabile}
                scelto={selezionato === chiave}
                onSeleziona={() => onSeleziona(chiave)}
                onAlternativa={() => onAlternativa(chiave)}
                onTogliAlternativa={() => onTogliAlternativa(chiave)}
              />
            )
          })}
        </ul>
      ) : null}
    </Riquadro>
  )
}
