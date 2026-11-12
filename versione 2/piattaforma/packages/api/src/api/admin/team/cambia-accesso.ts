import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { PERMESSI_MODULE } from "../../../modules/permessi"
import { RUOLI_ADMIN, RUOLO_PROPRIETARIO, leggiRuolo, ruoloSpento, trovaRuolo } from "../../../modules/permessi/ruoli"
import type PermessiModuleService from "../../../modules/permessi/service"
import { invalido, rifiutato } from "../../utili"

type Modifica = { ruolo?: string; attivo?: boolean }

/** Ruolo e interruttore di una persona o di un invito: ciò che non si cambia resta com'era. */
export async function cambiaAccesso(req: AuthenticatedMedusaRequest, email: string, { ruolo, attivo }: Modifica) {
  if (ruolo !== undefined && !trovaRuolo(RUOLI_ADMIN, ruolo)) throw invalido("Unknown role")
  const permessi = req.scope.resolve<PermessiModuleService>(PERMESSI_MODULE)
  const [riga] = await permessi.listRuoloCollaboratores({ email })
  const attuale = riga ? leggiRuolo(riga.ruolo) : null
  if (attuale?.ruolo === RUOLO_PROPRIETARIO && attivo === false) throw rifiutato("The owner cannot be switched off")
  const nuovoRuolo = ruolo ?? attuale?.ruolo
  if (!nuovoRuolo) throw invalido("Choose a role first")
  const nuovoAttivo = attivo ?? attuale?.attivo ?? true
  const salvato = nuovoAttivo ? nuovoRuolo : ruoloSpento(nuovoRuolo)
  if (riga) await permessi.updateRuoloCollaboratores({ id: riga.id, ruolo: salvato })
  else await permessi.createRuoloCollaboratores({ email, ruolo: salvato })
  return { ruolo: nuovoRuolo, attivo: nuovoAttivo }
}
