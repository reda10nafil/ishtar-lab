import { Module } from "@medusajs/framework/utils"
import CarteRegaloModuleService from "./service"

export const CARTE_REGALO_MODULE = "carteRegalo"

export default Module(CARTE_REGALO_MODULE, { service: CarteRegaloModuleService })
