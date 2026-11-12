import { model } from "@medusajs/framework/utils"

/** Ruolo di chi lavora per Multi Outfit dentro Ishtar Lab. La riga esiste già dall'invito, prima che l'utente venga creato. */
export const RuoloCollaboratore = model.define("ruolo_collaboratore", {
  id: model.id({ prefix: "ruolo" }).primaryKey(),
  email: model.text().unique(),
  ruolo: model.text(),
})
