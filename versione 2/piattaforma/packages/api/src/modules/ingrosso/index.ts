import { Module } from "@medusajs/framework/utils"
import IngrossoModuleService from "./service"

export const INGROSSO_MODULE = "ingrosso"

export default Module(INGROSSO_MODULE, { service: IngrossoModuleService })
