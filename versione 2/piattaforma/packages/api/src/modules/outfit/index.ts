import { Module } from "@medusajs/framework/utils"
import OutfitModuleService from "./service"

export const OUTFIT_MODULE = "outfit"

export default Module(OUTFIT_MODULE, { service: OutfitModuleService })
