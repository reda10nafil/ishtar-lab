import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareFunction } from "@medusajs/framework/http"
import { aggiungiRegole } from "../../modules/permessi/azioni"
import { CHIAVI_RISERVATE } from "../admin/catalogo/comune/permessi"
import { permesso, type RottaProtetta } from "./permesso"

const ID = "[^/]+"

aggiungiRegole([
  ["POST", /^\/admin\/catalogo\/prodotti$/, "Product created"],
  ["DELETE", new RegExp(`^/admin/catalogo/prodotti/${ID}$`), "Product deleted"],
  ["POST", new RegExp(`^/admin/catalogo/prodotti/${ID}/varianti$`), "Variant added"],
  ["POST", new RegExp(`^/admin/catalogo/prodotti/${ID}/varianti/${ID}$`), "Variant, price or stock changed"],
  ["DELETE", new RegExp(`^/admin/catalogo/prodotti/${ID}/varianti/${ID}$`), "Variant deleted"],
  ["POST", /^\/admin\/catalogo\/blocco$/, "Bulk action on products"],
  ["POST", /^\/admin\/catalogo\/proposte$/, "Price proposal decided"],
  ["POST", new RegExp(`^/admin/products/${ID}$`), "Product changed"],
  ["POST", /^\/admin\/collections$/, "Collection created"],
  ["POST", new RegExp(`^/admin/collections/${ID}$`), "Collection changed"],
  ["POST", new RegExp(`^/admin/collections/${ID}/products$`), "Collection products changed"],
  ["DELETE", new RegExp(`^/admin/collections/${ID}$`), "Collection deleted"],
  ["POST", /^\/vendor\/catalogo\/prodotti$/, "Product created"],
  ["POST", new RegExp(`^/vendor/catalogo/prodotti/${ID}$`), "Product change proposed"],
])

const semplice = (valore: unknown): valore is Record<string, unknown> => {
  if (!valore || typeof valore !== "object") return false
  const prototipo = Object.getPrototypeOf(valore)
  return prototipo === Object.prototype || prototipo === null
}

function spoglia(valore: unknown, chiavi: Set<string>): unknown {
  if (Array.isArray(valore)) return valore.map((voce) => spoglia(voce, chiavi))
  if (!semplice(valore)) return valore
  return Object.fromEntries(
    Object.entries(valore)
      .filter(([chiave]) => !chiavi.has(chiave))
      .map(([chiave, voce]) => [chiave, spoglia(voce, chiavi)])
  )
}

type ConPermessi = { permissions?: Record<string, string> }

/** Toglie dalle risposte native i campi che quel profilo non deve ricevere. */
const senza = (chiavi: string[], salvo?: (req: MedusaRequest) => boolean): MiddlewareFunction => {
  const insieme = new Set(chiavi)
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const invia = res.json.bind(res)
    res.json = ((corpo: unknown) => invia(salvo?.(req) ? corpo : spoglia(corpo, insieme))) as typeof res.json
    next()
  }
}

const conMargini = (req: MedusaRequest) => Boolean((req as unknown as ConPermessi).permissions?.margini)

/** Il prezzo consigliato non rivela il margine: in amministrazione lo vedono tutti i ruoli. */
const CHIAVI_MARGINE = CHIAVI_RISERVATE.filter((chiave) => chiave !== "prezzo_consigliato")

/** Le rotte proprie dell'azienda filtrano da sole: danno i suoi prezzi e nessun altro. */
const rottaPropria = (req: MedusaRequest) => req.originalUrl.startsWith("/vendor/catalogo")

/** Il prezzo di vendita lo decide Ishtar Lab: insieme alla cessione rivelerebbe il margine. */
const PREZZI_DI_VENDITA = ["prices", "price_set", "price_sets", "calculated_price"]

const senzaPrezzi = senza(PREZZI_DI_VENDITA)

/**
 * Il parametro `fields` delle rotte native attraversa i legami fra le tabelle: da un'azienda
 * o da un prodotto si arriva alle offerte. Per questo le chiavi riservate si tolgono da tutta
 * l'area, non rotta per rotta. Il prezzo di vendita si toglie solo dove porta il catalogo:
 * altrove `prices` è altro, per esempio il costo delle opzioni di spedizione.
 */
const ROTTE_CON_OFFERTE = ["/vendor/offers", "/vendor/products", "/vendor/product-variants", "/vendor/sellers", "/vendor/inventory-items"]

const regola = (matcher: string, metodo: "GET" | "POST" | "DELETE", chiave: string, diritto: "view" | "edit" | "manage"): RottaProtetta => ({
  matcher,
  method: [metodo],
  middlewares: [permesso(chiave, diritto)],
})

export const rotteCatalogo: RottaProtetta[] = [
  regola("/admin/catalogo/prodotti", "GET", "products", "view"),
  regola("/admin/catalogo/prodotti", "POST", "products", "edit"),
  regola("/admin/catalogo/prodotti/:id", "GET", "products", "view"),
  regola("/admin/catalogo/prodotti/:id", "DELETE", "products", "manage"),
  regola("/admin/catalogo/prodotti/:id/varianti", "POST", "products", "edit"),
  regola("/admin/catalogo/prodotti/:id/varianti/:variante", "POST", "products", "edit"),
  regola("/admin/catalogo/prodotti/:id/varianti/:variante", "DELETE", "products", "manage"),
  regola("/admin/catalogo/blocco", "POST", "products", "edit"),
  regola("/admin/catalogo/collezioni", "GET", "product_collections", "view"),
  regola("/admin/catalogo/proposte", "GET", "products.review", "edit"),
  regola("/admin/catalogo/proposte", "POST", "products.review", "edit"),

  regola("/vendor/catalogo/prodotti", "GET", "products", "view"),
  regola("/vendor/catalogo/prodotti", "POST", "products", "edit"),
  regola("/vendor/catalogo/prodotti/:id", "GET", "products", "view"),
  regola("/vendor/catalogo/prodotti/:id", "POST", "products", "edit"),

  { matcher: "/admin/*", middlewares: [senza(CHIAVI_MARGINE, conMargini)] },
  { matcher: "/store/*", middlewares: [senza(CHIAVI_RISERVATE)] },
  { matcher: "/vendor/*", middlewares: [senza(CHIAVI_RISERVATE, rottaPropria)] },
  ...ROTTE_CON_OFFERTE.flatMap((rotta) => [
    { matcher: rotta, middlewares: [senzaPrezzi] },
    { matcher: `${rotta}/*`, middlewares: [senzaPrezzi] },
  ]),
]
