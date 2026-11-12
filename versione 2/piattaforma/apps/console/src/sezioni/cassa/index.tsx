import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { useAvvisi } from "../../componenti"
import { numero } from "../../lingua"
import { usePermessi } from "../../permessi"
import { euro, Pagina, Stato } from "../../ui"
import "./canali.css"
import "./cassa.css"
import { Cestino } from "./Cestino"
import { CHIAVE_CASSA, sceltaUnica, useCestino, useConto, useStatoCassa, voceDa } from "./dati"
import { ModaleIncasso } from "./ModaleIncasso"
import { ModaleTaglia } from "./ModaleTaglia"
import { rimbalzo, volaNelCestino } from "./movimenti"
import { Scaffale } from "./Scaffale"
import { SchedeCanali } from "./SchedeCanali"
import type { Cliente, Conto, OffertaTaglia, Prodotto, Taglia } from "./tipi"

const AVVISO_LETTORE = "No card reader: card payments are recorded by hand."

function Cassa() {
  const stato = useStatoCassa()
  const { puo } = usePermessi()
  const client = useQueryClient()
  const { segnalaErrore } = useAvvisi()
  const { righe, pezzi, aggiungi, cambia, svuota } = useCestino()
  const [codice, setCodice] = useState<string | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [daScegliere, setDaScegliere] = useState<{ prodotto: Prodotto; scheda: HTMLElement } | null>(null)
  const [incasso, setIncasso] = useState(false)
  const [aperto, setAperto] = useState(false)
  const cestino = useRef<HTMLElement>(null)
  const conto = useConto(righe, codice)

  // Un codice può smettere di valere quando cambia il cestino: si toglie e si dice perché.
  useEffect(() => {
    if (!conto.error || !codice) return
    segnalaErrore(conto.error)
    setCodice(null)
  }, [conto.error, codice, segnalaErrore])

  useEffect(() => {
    document.body.classList.toggle("cassa-con-cestino", aperto)
    return () => document.body.classList.remove("cassa-con-cestino")
  }, [aperto])

  const inserisci = (prodotto: Prodotto, taglia: Taglia, offerta: OffertaTaglia, scheda: HTMLElement) => {
    aggiungi(voceDa(prodotto, taglia, offerta))
    rimbalzo(scheda)
    volaNelCestino(scheda.querySelector(".cassa-miniatura"), cestino.current)
  }

  const scegli = (prodotto: Prodotto, scheda: HTMLElement) => {
    const unica = sceltaUnica(prodotto)
    if (unica) inserisci(prodotto, unica.taglia, unica.offerta, scheda)
    else setDaScegliere({ prodotto, scheda })
  }

  const prossimo = useCallback(() => {
    setIncasso(false)
    setAperto(false)
    svuota()
    setCodice(null)
    setCliente(null)
  }, [svuota])

  const chiudiIncasso = useCallback(() => setIncasso(false), [])
  const chiudiTaglia = useCallback(() => setDaScegliere(null), [])

  const venduto = () => {
    client.invalidateQueries({ queryKey: CHIAVE_CASSA })
    client.invalidateQueries({ queryKey: ["ordini"] })
  }

  // Senza codice il totale si conosce subito: il server lo ricontrolla comunque alla vendita.
  const lordo = Math.round(righe.reduce((somma, r) => somma + r.prezzo * r.quantita, 0) * 100) / 100
  const mostrato: Conto | undefined = codice ? conto.data : { subtotale: lordo, sconto: 0, iva: conto.data?.iva ?? null, totale: lordo, codice: null }

  const mancanti = stato.data?.mancanti ?? []
  const puoVendere = puo("cassa", "edit") && !mancanti.length
  const motivo = puo("cassa", "edit") ? null : "Your role can look at the till but not charge."
  const indirizzo = stato.data?.indirizzo
  const totale = mostrato?.totale ?? 0

  return (
    <Pagina titolo="Shop till" sottotitolo={indirizzo ? `${indirizzo} · ${AVVISO_LETTORE}` : AVVISO_LETTORE}>
      <SchedeCanali />
      {mancanti.map((frase) => <p key={frase} className="avviso-stato avviso-stato--attesa" role="alert">{frase}</p>)}
      <Stato caricamento={stato.isLoading} errore={stato.error} vuoto={false} testoVuoto="" />
      {stato.data ? (
        <div className="cassa">
          <Scaffale stato={stato.data} righe={righe} onScegli={scegli} />
          <Cestino
            ref={cestino}
            righe={righe}
            pezzi={pezzi}
            conto={mostrato}
            aggiornando={Boolean(codice) && conto.isFetching}
            codice={codice}
            cliente={cliente}
            puoIncassare={puoVendere}
            motivo={motivo}
            aperto={aperto}
            onCodice={setCodice}
            onCliente={setCliente}
            onQuantita={cambia}
            onSvuota={() => { svuota(); setCodice(null); setCliente(null); setAperto(false) }}
            onIncassa={() => setIncasso(true)}
            onChiudi={() => setAperto(false)}
          />
          <button type="button" className={`cassa__bottone${pezzi && !aperto ? " cassa__bottone--visibile" : ""}`} tabIndex={pezzi ? 0 : -1} onClick={() => setAperto(true)}>
            <span>{numero(pezzi)}</span>
            View basket
            <b>{euro(totale)}</b>
          </button>
        </div>
      ) : null}
      {daScegliere ? (
        <ModaleTaglia
          prodotto={daScegliere.prodotto}
          onChiudi={chiudiTaglia}
          onScelta={(taglia, offerta) => {
            inserisci(daScegliere.prodotto, taglia, offerta, daScegliere.scheda)
            setDaScegliere(null)
          }}
        />
      ) : null}
      {incasso ? (
        <ModaleIncasso righe={righe} pezzi={pezzi} totale={totale} codice={codice} cliente={cliente} onVenduto={venduto} onProssimo={prossimo} onChiudi={chiudiIncasso} />
      ) : null}
    </Pagina>
  )
}

export default function Sezione() {
  return (
    <Routes>
      <Route index element={<Cassa />} />
      <Route path="*" element={<Navigate to="/cassa" replace />} />
    </Routes>
  )
}
