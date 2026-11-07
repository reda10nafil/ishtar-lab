import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { enrichProductChangeRequests, getSellerOwnedProductIds } from "@mercurjs/core/api/vendor/products/helpers"
import { ASSISTENZA_MODULE } from "../../../modules/assistenza"
import type AssistenzaModuleService from "../../../modules/assistenza/service"
import type { Attore } from "../../../modules/assistenza/service"
import { CONNECTORS_MODULE } from "../../../modules/connectors"
import { trovaServizio } from "../../../modules/connectors/catalogo"
import type ConnectorsModuleService from "../../../modules/connectors/service"
import { interroga } from "../../utili"
import { leggiScorte, scorteBasse } from "../magazzino/lib/scorte"

export type Profilo = "admin" | "azienda"
export type Gravita = "info" | "attesa" | "errore"

export type Avviso = {
  /** Stabile finché il fatto non cambia: da qui dipende se l'avviso risulta già letto. */
  chiave: string
  titolo: string
  dettaglio: string | null
  /** Pagina della console che risolve l'avviso. */
  a: string
  quando: string | null
  gravita: Gravita
}

export type ContestoFonte = {
  req: AuthenticatedMedusaRequest
  attore: Attore
  /** Azienda di chi chiama: presente solo sul profilo azienda. */
  azienda: string | null
}

export type Fonte = {
  id: string
  etichetta: string
  descrizione: string
  profilo: Profilo
  permesso?: [chiave: string, diritto: "view" | "edit" | "manage"]
  calcola: (contesto: ContestoFonte) => Promise<Avviso[]>
}

const MASSIMO_PER_FONTE = 100

const istante = (valore: Date | string | null | undefined) => (valore ? new Date(valore).getTime() : 0)
const iso = (valore: Date | string | null | undefined) => (valore ? new Date(valore).toISOString() : null)

/** Stessi dati di `/magazzino/scorte-basse`: l'azienda riceve solo i propri articoli. */
async function avvisiScorte({ req, azienda }: ContestoFonte): Promise<Avviso[]> {
  const { righe } = await leggiScorte(req, azienda ?? undefined)
  return scorteBasse(righe, false).scorte_basse.slice(0, MASSIMO_PER_FONTE).map((r) => {
    const esaurito = r.stato === "esaurito"
    const nome = [r.prodotto, r.variante].filter(Boolean).join(" · ") || r.sku || "Item"
    return {
      chiave: `scorta:${r.id}:${r.disponibili}`,
      titolo: `${esaurito ? "Out of stock" : "Low stock"}: ${nome}`,
      dettaglio: azienda ? `Available: ${r.disponibili}` : `${r.azienda}, available: ${r.disponibili}`,
      a: "/magazzino",
      quando: null,
      gravita: esaurito ? "errore" : "attesa",
    }
  })
}

const richiestaInAvviso = (titolo: string, r: { id: string; oggetto: string; ultimo_messaggio_il: Date | string }): Avviso => ({
  chiave: `richiesta:${r.id}:${istante(r.ultimo_messaggio_il)}`,
  titolo,
  dettaglio: r.oggetto,
  a: `/assistenza/richieste/${r.id}`,
  quando: iso(r.ultimo_messaggio_il),
  gravita: "attesa",
})

type ModificaInbox = { id: string; status: string; type: string; product_title?: string; seller_name?: string; created_at: string }

/**
 * `inbox` è il filtro di Mercur che calcola tipo, titolo del prodotto e azienda.
 * Funziona solo se la paginazione indica `skip`: senza, Medusa usa un'altra lettura e lo rifiuta.
 */
async function modificheInAttesa(req: AuthenticatedMedusaRequest, azienda?: string) {
  const filtri: Record<string, unknown> = azienda ? { inbox: true, seller_id: azienda } : { inbox: true }
  const { data } = await interroga(req).graph({
    entity: "product_change",
    fields: ["id", "status", "type", "product_title", "seller_name", "created_at"],
    filters: filtri,
    pagination: { skip: 0, take: MASSIMO_PER_FONTE },
  })
  return (data as unknown as ModificaInbox[]).filter((m) => m.status === "pending" && m.type !== "new_product")
}

type ProdottoAzienda = { id: string; title: string; status: string; updated_at: string; change_request?: { message?: string | null; requested_at: string } | null }

/** Per le aziende i prodotti in revisione sono un riepilogo: non richiedono un'azione. */
function riepilogoRevisione(cosa: "prodotti" | "modifiche", quanti: number, ultimo: number): Avviso {
  const nome = cosa === "prodotti" ? "product" : "change"
  return {
    chiave: `revisione-${cosa}:${quanti}:${ultimo}`,
    titolo: `${quanti} ${nome}${quanti === 1 ? "" : "s"} awaiting approval`,
    dettaglio: "In review with the Ishtar Lab team.",
    a: "/prodotti",
    quando: ultimo ? new Date(ultimo).toISOString() : null,
    gravita: "info",
  }
}

async function prodottiDellAzienda({ req, azienda }: ContestoFonte): Promise<Avviso[]> {
  const venditore = azienda as string
  const propri = await getSellerOwnedProductIds(req.scope, venditore)
  if (!propri.length) return []
  const [{ data }, inAttesa] = await Promise.all([
    interroga(req).graph({ entity: "product", fields: ["id", "title", "status", "updated_at"], filters: { id: propri } }),
    modificheInAttesa(req, venditore),
  ])
  const prodotti = data as unknown as ProdottoAzienda[]
  await enrichProductChangeRequests(req.scope, prodotti as unknown as Parameters<typeof enrichProductChangeRequests>[1])

  const avvisi: Avviso[] = []
  for (const p of prodotti) {
    if (p.change_request) {
      avvisi.push({
        chiave: `correzione:${p.id}:${istante(p.change_request.requested_at)}`,
        titolo: `Changes requested: ${p.title}`,
        dettaglio: p.change_request.message ?? null,
        a: "/prodotti",
        quando: iso(p.change_request.requested_at),
        gravita: "attesa",
      })
    } else if (p.status === "rejected") {
      avvisi.push({ chiave: `rifiuto:${p.id}:${istante(p.updated_at)}`, titolo: `Product rejected: ${p.title}`, dettaglio: null, a: "/prodotti", quando: iso(p.updated_at), gravita: "errore" })
    }
  }
  const inRevisione = prodotti.filter((p) => p.status === "proposed" && !p.change_request)
  if (inRevisione.length) avvisi.push(riepilogoRevisione("prodotti", inRevisione.length, Math.max(...inRevisione.map((p) => istante(p.updated_at)))))
  if (inAttesa.length) avvisi.push(riepilogoRevisione("modifiche", inAttesa.length, Math.max(...inAttesa.map((m) => istante(m.created_at)))))
  return avvisi
}

/** Per aggiungere una fonte (ordini, evasioni...) basta un oggetto qui: rotte, conteggio e letture sono già pronti. */
export const FONTI: Fonte[] = [
  {
    id: "prodotti",
    etichetta: "Products to approve",
    descrizione: "When a company proposes a new product.",
    profilo: "admin",
    permesso: ["products.review", "edit"],
    calcola: async ({ req }) => {
      const { data } = await interroga(req).graph({
        entity: "product",
        fields: ["id", "title", "updated_at"],
        filters: { status: "proposed" },
        pagination: { take: MASSIMO_PER_FONTE, order: { updated_at: "DESC" } },
      })
      return data.map((p) => ({
        chiave: `prodotto:${p.id}:${istante(p.updated_at)}`,
        titolo: `Product to approve: ${p.title}`,
        dettaglio: null,
        a: "/revisione",
        quando: iso(p.updated_at),
        gravita: "attesa" as const,
      }))
    },
  },
  {
    id: "modifiche",
    etichetta: "Pending changes",
    descrizione: "When a company asks to change an approved product.",
    profilo: "admin",
    permesso: ["products.review", "edit"],
    calcola: async ({ req }) =>
      (await modificheInAttesa(req)).map((m) => ({
        chiave: `modifica:${m.id}`,
        titolo: `Change to approve: ${m.product_title ?? "product"}`,
        dettaglio: m.seller_name ?? null,
        a: "/revisione",
        quando: iso(m.created_at),
        gravita: "attesa" as const,
      })),
  },
  {
    id: "connettori",
    etichetta: "Connector errors",
    descrizione: "When a connected service stops responding or refuses access.",
    profilo: "admin",
    permesso: ["connettori", "view"],
    calcola: async ({ req }) => {
      const connettori = req.scope.resolve<ConnectorsModuleService>(CONNECTORS_MODULE)
      const conti = await connettori.listConnectorAccounts({ status: "errore" })
      return conti.map((c) => ({
        chiave: `connettore:${c.provider}:${istante(c.updated_at)}`,
        titolo: `${trovaServizio(c.provider)?.nome ?? c.provider}: connection needs fixing`,
        dettaglio: c.last_error ?? null,
        a: "/connettori",
        quando: iso(c.updated_at),
        gravita: "errore" as const,
      }))
    },
  },
  {
    id: "scorte",
    etichetta: "Low stock",
    descrizione: "When an item is about to run out.",
    profilo: "admin",
    permesso: ["magazzino", "view"],
    calcola: avvisiScorte,
  },
  {
    id: "assistenza",
    etichetta: "Help requests",
    descrizione: "When a request is waiting for a reply.",
    profilo: "admin",
    permesso: ["assistenza", "view"],
    calcola: async ({ req, attore }) => {
      const assistenza = req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE)
      const [aperte, risposte] = await Promise.all([
        assistenza.listRichiestas({ stato: "aperta" }, { take: MASSIMO_PER_FONTE, order: { ultimo_messaggio_il: "DESC" } }),
        assistenza.listRichiestas({ stato: "in_attesa", azienda_id: null, autore_id: attore.id }, { take: MASSIMO_PER_FONTE }),
      ])
      return [
        ...aperte.map((r) => richiestaInAvviso("Help request open", r)),
        ...risposte.map((r) => richiestaInAvviso("New reply to your request", r)),
      ]
    },
  },
  {
    id: "prodotti-azienda",
    etichetta: "Your products",
    descrizione: "Products in review, rejected or needing changes.",
    profilo: "azienda",
    permesso: ["products", "view"],
    calcola: prodottiDellAzienda,
  },
  {
    id: "scorte-azienda",
    etichetta: "Low stock",
    descrizione: "When one of your items is about to run out.",
    profilo: "azienda",
    permesso: ["magazzino", "view"],
    calcola: avvisiScorte,
  },
  {
    id: "assistenza-azienda",
    etichetta: "Help requests",
    descrizione: "When the Ishtar Lab team replies to one of your requests.",
    profilo: "azienda",
    permesso: ["assistenza", "view"],
    calcola: async ({ req, azienda }) => {
      const assistenza = req.scope.resolve<AssistenzaModuleService>(ASSISTENZA_MODULE)
      const risposte = await assistenza.listRichiestas(
        { stato: "in_attesa", azienda_id: azienda },
        { take: MASSIMO_PER_FONTE, order: { ultimo_messaggio_il: "DESC" } }
      )
      return risposte.map((r) => richiestaInAvviso("New reply to your request", r))
    },
  },
]
