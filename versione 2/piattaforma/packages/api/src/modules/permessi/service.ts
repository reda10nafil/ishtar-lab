import { MedusaService, Modules } from "@medusajs/framework/utils"
import type { IUserModuleService } from "@medusajs/framework/types"
import type { IPermissionResolver, PermissionActor, PermissionDefinition, PermissionMap } from "@mercurjs/types"
import { grantAll } from "@mercurjs/core/permissions/registry"
import "./permessi-extra"
import { RuoloCollaboratore } from "./models/ruolo-collaboratore"
import { VoceRegistro } from "./models/voce-registro"
import { RUOLI_ADMIN, RUOLI_AZIENDA, RUOLO_PROPRIETARIO, trovaRuolo, type Ruolo } from "./ruoli"

type MembroAzienda = { id: string; role_id: string | null; is_owner: boolean }
type ServizioAziende = { listSellerMembers: (filtri: { id: string }) => Promise<MembroAzienda[]> }
type Dipendenze = { [Modules.USER]: IUserModuleService; seller: ServizioAziende }

export default class PermessiModuleService
  // La chiave `Registrazione` dà metodi con lo stesso plurale a compilazione e a runtime (listRegistraziones).
  extends MedusaService({ RuoloCollaboratore, Registrazione: VoceRegistro })
  implements IPermissionResolver
{
  private readonly utenti: IUserModuleService
  private readonly aziende: ServizioAziende

  constructor(dipendenze: Dipendenze) {
    // eslint-disable-next-line prefer-rest-params
    super(...arguments)
    this.utenti = dipendenze[Modules.USER]
    this.aziende = dipendenze.seller
  }

  /** Senza alcun proprietario, il primo utente che entra lo diventa: evita di restare chiusi fuori. */
  async ruoloDiUtente(userId: string): Promise<Ruolo | undefined> {
    const { email } = await this.utenti.retrieveUser(userId, { select: ["email"] })
    const [riga] = await this.listRuoloCollaboratores({ email })
    if (riga) return trovaRuolo(RUOLI_ADMIN, riga.ruolo)
    const proprietari = await this.listRuoloCollaboratores({ ruolo: RUOLO_PROPRIETARIO }, { take: 1 })
    if (proprietari.length) return undefined
    await this.createRuoloCollaboratores({ email, ruolo: RUOLO_PROPRIETARIO })
    return trovaRuolo(RUOLI_ADMIN, RUOLO_PROPRIETARIO)
  }

  async ruoloDiMembro(membroId: string): Promise<Ruolo | undefined> {
    const [membro] = await this.aziende.listSellerMembers({ id: membroId })
    return membro ? trovaRuolo(RUOLI_AZIENDA, membro.role_id) : undefined
  }

  async ruoloDi(attore: PermissionActor): Promise<Ruolo | undefined> {
    if (attore.surface === "admin") return this.ruoloDiUtente(attore.actor_id)
    return attore.seller_member_id ? this.ruoloDiMembro(attore.seller_member_id) : undefined
  }

  /** Chi non ha un ruolo non riceve alcun permesso. */
  async resolvePermissions(attore: PermissionActor, catalogo: PermissionDefinition[]): Promise<PermissionMap> {
    const ruolo = await this.ruoloDi(attore)
    if (!ruolo) return {}
    if (ruolo.permessi === "tutto") return grantAll(catalogo.filter((d) => d.surface.includes(attore.surface)))
    return ruolo.permessi
  }
}
