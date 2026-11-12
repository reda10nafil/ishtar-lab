import { Module } from "@medusajs/framework/utils"
import AssistenzaModuleService from "./service"

export const ASSISTENZA_MODULE = "assistenza"

export default Module(ASSISTENZA_MODULE, { service: AssistenzaModuleService })
