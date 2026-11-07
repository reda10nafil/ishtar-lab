import { Module } from "@medusajs/framework/utils"
import { PERMISSIONS_MODULE } from "@mercurjs/types"
import PermessiModuleService from "./service"

export const PERMESSI_MODULE = PERMISSIONS_MODULE

export default Module(PERMESSI_MODULE, { service: PermessiModuleService })
