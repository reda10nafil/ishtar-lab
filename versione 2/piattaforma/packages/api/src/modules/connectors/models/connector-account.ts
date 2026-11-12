import { model } from "@medusajs/framework/utils"

/** Un collegamento con un servizio. `secret` è sempre cifrato. */
export const ConnectorAccount = model.define("connector_account", {
  id: model.id({ prefix: "conn" }).primaryKey(),
  provider: model.text().unique(),
  status: model.enum(["da_collegare", "collegato", "errore"]).default("da_collegare"),
  account_label: model.text().nullable(),
  secret: model.text(),
  expires_at: model.dateTime().nullable(),
  last_checked_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
})
