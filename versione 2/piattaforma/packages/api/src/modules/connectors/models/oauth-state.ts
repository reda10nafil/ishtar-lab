import { model } from "@medusajs/framework/utils"

/** Accesso in corso: conservato per pochi minuti, con lo stato solo come impronta. */
export const OauthState = model.define("oauth_state", {
  id: model.id({ prefix: "ostate" }).primaryKey(),
  provider: model.text(),
  state_hash: model.text().unique(),
  verifier: model.text(),
  expires_at: model.dateTime(),
})
