import { Module } from "@medusajs/framework/utils"
import ConnectorsModuleService from "./service"

export const CONNECTORS_MODULE = "connectors"

export default Module(CONNECTORS_MODULE, { service: ConnectorsModuleService })
