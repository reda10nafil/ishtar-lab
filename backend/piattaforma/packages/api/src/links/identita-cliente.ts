import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import ConversazioniModule from "../modules/conversazioni"

/** Legame di sola lettura: `query.graph` risolve il cliente del contatto dal campo `cliente_id`, senza tabelle in più. */
export default defineLink(
  { linkable: ConversazioniModule.linkable.identitaContatto, field: "cliente_id" },
  CustomerModule.linkable.customer,
  { readOnly: true }
)
