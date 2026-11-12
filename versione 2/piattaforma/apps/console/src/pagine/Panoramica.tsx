import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Activity, BarChart3, Boxes, Heart, Package, Plus, ReceiptText, ShoppingBag } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { numero, percentuale } from "../lingua"
import { Titolo } from "../movimenti"
import { usePermessi } from "../permessi"
import { Indicatore } from "../sezioni/analisi/comuni"
import { BloccoAdesso, BloccoAdessoAzienda } from "../sezioni/analisi/panoramica/BloccoAdesso"
import { AttivitaTeam, CodaImballo, DaApprovare, PiuVenduti, ProdottiInRevisione, ScorteBasse, Spunto, StrisciaApprovare } from "../sezioni/analisi/panoramica/BlocchiLavoro"
import { BloccoUnita, BloccoVendite } from "../sezioni/analisi/panoramica/BloccoVendite"
import { NuovaCampagna, NuovoOrdine } from "../sezioni/analisi/panoramica/Moduli"
import SchedaOrdine from "../sezioni/analisi/panoramica/SchedaOrdine"
import "../sezioni/analisi/panoramica.css"
import type { PanoramicaAdmin as DatiAdmin, PanoramicaAzienda as DatiAzienda, ScortaBassa } from "../sezioni/analisi/tipi"
import { useSessione } from "../sessione"
import { Stato, euro } from "../ui"

function saluto() {
  const ora = new Date().getHours()
  if (ora < 5 || ora >= 18) return "Good evening"
  return ora < 12 ? "Good morning" : "Good afternoon"
}

/** La frase sotto il saluto dice le due cose che contano adesso, con i numeri veri. */
function FraseDelGiorno({ giorno, daPreparare, finisce }: { giorno: string; daPreparare: number | null; finisce: string | null }) {
  const ordini = daPreparare === 1 ? "1 order" : `${numero(daPreparare)} orders`
  return (
    <p>
      {giorno}
      {daPreparare === null ? null : daPreparare === 0 ? " · nothing to pack" : <> · <b>{ordini}</b> to pack</>}
      {finisce ? <>, and <b>{finisce}</b> is running low</> : null}.
    </p>
  )
}

function usaProdottoInEsaurimento(attivo: boolean, azienda: boolean) {
  const percorso = azienda ? "/vendor/magazzino/scorte-basse" : "/admin/magazzino/scorte-basse"
  const { data } = useQuery({
    queryKey: ["scorte-basse", azienda],
    queryFn: () => api<{ scorte_basse: ScortaBassa[]; conteggio: number }>(percorso),
    enabled: attivo,
  })
  return data?.scorte_basse[0]?.prodotto ?? null
}

function PanoramicaAdmin() {
  const naviga = useNavigate()
  const { puo } = usePermessi()
  const { data, isLoading, error } = useQuery({ queryKey: ["panoramica", "admin"], queryFn: () => api<DatiAdmin>("/admin/analisi/panoramica") })
  const [nuovoOrdine, setNuovoOrdine] = useState(false)
  const [nuovaCampagna, setNuovaCampagna] = useState(false)
  const vedeScorte = puo("magazzino", "view")
  const finisce = usaProdottoInEsaurimento(vedeScorte, false)
  const nome = useQuery({ queryKey: ["utente", "nome"], queryFn: () => api<{ user: { first_name: string | null } }>("/admin/users/me?fields=first_name") })
  const persona = nome.data?.user.first_name
  const indicatori = data?.indicatori
  const conversione = data?.conversione ?? null
  const vedeApprovare = puo("products.review", "edit")

  return (
    <div className="pagina pan">
      <div className="pagina__testa">
        <div className="pagina__titoli">
          <Titolo testo={persona ? `${saluto()}, ${persona}` : saluto()} />
          {data ? <FraseDelGiorno giorno={data.giorno} daPreparare={data.coda?.da_preparare ?? null} finisce={finisce} /> : <p>&nbsp;</p>}
        </div>
        <div className="pagina__azioni pan-azioni">
          {puo("analisi", "view") ? <button type="button" onClick={() => naviga("/analisi")}><BarChart3 size={18} aria-hidden="true" /> Full report</button> : null}
          {puo("orders", "edit") ? <button type="button" className="primario" onClick={() => setNuovoOrdine(true)}><Plus size={18} aria-hidden="true" /> New order</button> : null}
        </div>
      </div>
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data ? (
        <div className="pan-griglia">
          {data.vendite ? <BloccoVendite vendite={data.vendite} giorno={data.giorno} /> : null}
          <BloccoAdesso dati={data} modificaObiettivo={puo("impostazioni", "manage")} />
          {indicatori ? (
            <div className="pan-tessere">
              <Indicatore etichetta="Orders" icona={ReceiptText} colore="var(--serie-online)" valore={indicatori.ordini.valore} formato={numero} variazione={indicatori.ordini.variazione} nota="last 7 days" serie={indicatori.ordini.serie} />
              <Indicatore etichetta="Average order" icona={ShoppingBag} colore="var(--serie-ingrosso)" valore={indicatori.ordine_medio.valore ?? 0} formato={euro} variazione={indicatori.ordine_medio.variazione} nota="per order" serie={indicatori.ordine_medio.serie} />
              <Indicatore etichetta="Conversion" icona={Activity} colore="var(--serie-negozio)" valore={conversione?.valore ?? null} formato={percentuale} variazione={conversione?.variazione ?? null} nota={conversione ? "of shop visits" : "not measured until the shop is live"} serie={conversione?.serie.length ? conversione.serie : undefined} />
              <Indicatore etichetta="Returning" icona={Heart} colore="var(--serie-altro)" valore={indicatori.ritorno.valore ?? 0} formato={percentuale} variazione={indicatori.ritorno.variazione} nota="customers back again" serie={indicatori.ritorno.serie} />
            </div>
          ) : null}
          {data.coda ? <CodaImballo coda={data.coda} /> : null}
          {data.migliori ? <PiuVenduti voci={data.migliori} /> : null}
          <div className="pan-fila">
            {vedeScorte ? <ScorteBasse puoChiedere={puo("magazzino", "edit")} /> : null}
            {data.attivita ? <AttivitaTeam dati={data.attivita} /> : null}
            {data.spunto ? <Spunto dati={data.spunto} onPianifica={puo("marketing", "edit") ? () => setNuovaCampagna(true) : undefined} /> : vedeApprovare ? <DaApprovare /> : null}
          </div>
          {data.spunto && vedeApprovare ? <StrisciaApprovare /> : null}
        </div>
      ) : null}
      <SchedaOrdine />
      {nuovoOrdine ? <NuovoOrdine onChiudi={() => setNuovoOrdine(false)} /> : null}
      {nuovaCampagna ? <NuovaCampagna onChiudi={() => setNuovaCampagna(false)} /> : null}
    </div>
  )
}

function PanoramicaAzienda() {
  const naviga = useNavigate()
  const { sessione } = useSessione()
  const { puo } = usePermessi()
  const { data, isLoading, error } = useQuery({ queryKey: ["panoramica", "azienda"], queryFn: () => api<DatiAzienda>("/vendor/analisi/panoramica") })
  const vedeScorte = puo("magazzino", "view")
  const finisce = usaProdottoInEsaurimento(vedeScorte, true)
  const indicatori = data?.indicatori

  return (
    <div className="pagina pan">
      <div className="pagina__testa">
        <div className="pagina__titoli">
          <Titolo testo={sessione?.aziendaNome ? `${saluto()}, ${sessione.aziendaNome}` : saluto()} />
          {data ? <FraseDelGiorno giorno={data.giorno} daPreparare={data.coda.da_preparare} finisce={finisce} /> : <p>&nbsp;</p>}
        </div>
        <div className="pagina__azioni pan-azioni">
          {puo("evasioni", "view") ? <button type="button" onClick={() => naviga("/evasioni")}><Package size={18} aria-hidden="true" /> Fulfilment</button> : null}
          {puo("products", "edit") ? <button type="button" className="primario" onClick={() => naviga("/prodotti?nuovo=1")}><Plus size={18} aria-hidden="true" /> New product</button> : null}
        </div>
      </div>
      <Stato caricamento={isLoading} errore={error} vuoto={false} testoVuoto="" />
      {data && indicatori ? (
        <div className="pan-griglia">
          <BloccoUnita unita={data.unita} />
          <BloccoAdessoAzienda dati={data} />
          <div className="pan-tessere">
            <Indicatore etichetta="Orders" icona={ReceiptText} colore="var(--serie-online)" valore={indicatori.ordini.valore} formato={numero} variazione={indicatori.ordini.variazione} nota="last 7 days" serie={indicatori.ordini.serie} />
            <Indicatore etichetta="Units sold" icona={Boxes} colore="var(--serie-ingrosso)" valore={indicatori.unita.valore} formato={numero} variazione={indicatori.unita.variazione} nota="last 7 days" serie={indicatori.unita.serie} />
            <Indicatore etichetta="Units per order" icona={ShoppingBag} colore="var(--serie-negozio)" valore={indicatori.unita_per_ordine.valore ?? 0} formato={numero} variazione={indicatori.unita_per_ordine.variazione} nota="last 7 days" serie={indicatori.unita_per_ordine.serie} />
            <Indicatore etichetta="To pack" icona={Package} colore="var(--serie-altro)" valore={data.coda.da_preparare} formato={numero} nota="waiting now" />
          </div>
          <CodaImballo coda={data.coda} azienda />
          <PiuVenduti voci={data.migliori} azienda />
          <div className="pan-fila">
            {vedeScorte ? <ScorteBasse azienda puoChiedere={puo("magazzino", "edit")} /> : null}
            <ProdottiInRevisione />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function Panoramica() {
  const { sessione } = useSessione()
  return sessione?.tipo === "admin" ? <PanoramicaAdmin /> : <PanoramicaAzienda />
}
