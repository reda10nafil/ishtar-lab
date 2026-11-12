import { Module } from "@medusajs/framework/utils"
import NegozioOnlineModuleService from "./service"

export const NEGOZIO_ONLINE_MODULE = "negozioOnline"

export default Module(NEGOZIO_ONLINE_MODULE, { service: NegozioOnlineModuleService })
