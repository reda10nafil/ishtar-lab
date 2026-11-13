import { Module } from "@medusajs/framework/utils"
import ConversazioniModuleService from "./service"

export const CONVERSAZIONI_MODULE = "conversazioni"

export default Module(CONVERSAZIONI_MODULE, { service: ConversazioniModuleService })
