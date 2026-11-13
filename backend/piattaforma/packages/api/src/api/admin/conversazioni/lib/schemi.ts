import { z } from "@medusajs/framework/zod"
import { ID_CLIENT } from "../../../../modules/conversazioni/regole"

/** Telegram accetta fino a 4096 caratteri: il margine resta per i canali che aggiungono qualcosa. */
export const Risposta = z.object({
  testo: z.string({ message: "Write a reply" }).trim().min(1, "Write a reply").max(4000, "This reply is too long"),
  id: z.string({ message: "Reload the page to send replies" }).regex(ID_CLIENT, "Reload the page to send replies"),
})

export const CambioStato = z.object({ stato: z.enum(["aperta", "chiusa"], { message: "Choose open or closed" }) })

export const Collegamento = z.object({ cliente_id: z.string().min(1).nullable() })

export const RispostaRapidaNuova = z.object({
  titolo: z.string().trim().min(1, "A quick reply needs a title").max(60, "This title is too long"),
  testo: z.string().trim().min(1, "A quick reply needs a text").max(1000, "This text is too long"),
})
