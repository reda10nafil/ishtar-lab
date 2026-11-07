import { defineMiddlewares } from "@medusajs/framework/http"
import { registraModifiche } from "./registro"
import { rotteCatalogo } from "./rotte/catalogo"
import { rotteMagazzino } from "./rotte/magazzino"
import { rotteClienti } from "./rotte/clienti"
import { rotteOutfit } from "./rotte/outfit"
import { rotteSconti } from "./rotte/sconti"
import { rotteIngrosso } from "./rotte/ingrosso"
import { rotteOrdini } from "./rotte/ordini"
import { rotteCassa } from "./rotte/cassa"
import { rotteNegozioOnline } from "./rotte/negozio-online"
import { rotteAnalisi } from "./rotte/analisi"
import { rotteMarketing } from "./rotte/marketing"
import { rotteImpostazioni } from "./rotte/impostazioni"
import { rotteAssistenza } from "./rotte/assistenza"
import { rotteAvvisi } from "./rotte/avvisi"
import { permesso } from "./rotte/permesso"

/** Le rotte di Ishtar Lab dichiarano qui il permesso richiesto: il limite vive sul server. */
export default defineMiddlewares({
  routes: [
    { matcher: "/admin/ishtar/catalogo", method: ["GET"], middlewares: [permesso("products", "view")] },
    { matcher: "/admin/ishtar/catalogo", method: ["POST"], middlewares: [permesso("products", "manage"), permesso("inventory_items", "edit"), permesso("margini", "view")] },
    { matcher: "/admin/*", middlewares: [registraModifiche] },
    { matcher: "/vendor/*", middlewares: [registraModifiche] },

    { matcher: "/admin/connectors", method: ["GET"], middlewares: [permesso("connettori", "view")] },
    { matcher: "/admin/connectors/*", middlewares: [permesso("connettori", "manage")] },

    { matcher: "/admin/team", method: ["GET"], middlewares: [permesso("users", "view")] },
    { matcher: "/admin/team", method: ["POST"], middlewares: [permesso("users", "edit")] },
    { matcher: "/admin/team/inviti/:id", middlewares: [permesso("users", "edit")] },
    { matcher: "/admin/team/:id", method: ["POST"], middlewares: [permesso("users", "edit")] },
    { matcher: "/admin/team/:id", method: ["DELETE"], middlewares: [permesso("users", "manage")] },
    { matcher: "/admin/registro", middlewares: [permesso("registro", "view")] },

    ...rotteCatalogo,
    ...rotteMagazzino,
    ...rotteClienti,
    ...rotteOutfit,
    ...rotteSconti,
    ...rotteIngrosso,
    ...rotteOrdini,
    ...rotteCassa,
    ...rotteNegozioOnline,
    ...rotteAnalisi,
    ...rotteMarketing,
    ...rotteImpostazioni,
    ...rotteAssistenza,
    ...rotteAvvisi,
  ],
})
