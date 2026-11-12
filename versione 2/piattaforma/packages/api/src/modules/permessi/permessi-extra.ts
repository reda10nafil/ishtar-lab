import { defineMercurPermissions } from "@mercurjs/core/permissions/registry"

/** Permessi delle funzioni proprie di Ishtar Lab, oltre a quelli di Mercur. */
defineMercurPermissions([
  { key: "outfit", group: "outfit", surface: ["admin", "vendor"], rights: ["view", "edit", "manage"], label: "Outfits" },
  { key: "sconti", group: "sconti", surface: ["admin", "vendor"], rights: ["view", "edit", "manage"], label: "Discounts" },
  { key: "margini", group: "finanza", surface: ["admin"], rights: ["view"], label: "Margins" },
  { key: "evasioni", group: "logistica", surface: ["admin", "vendor"], rights: ["view", "edit", "manage"], label: "Fulfilment requests" },
  { key: "magazzino", group: "logistica", surface: ["admin", "vendor"], rights: ["view", "edit", "manage"], label: "Inventory" },
  { key: "analisi", group: "analisi", surface: ["admin"], rights: ["view"], label: "Analytics" },
  { key: "marketing", group: "marketing", surface: ["admin"], rights: ["view", "edit", "manage"], label: "Marketing" },
  { key: "negozio_online", group: "canali", surface: ["admin"], rights: ["view", "edit", "manage"], label: "Online shop" },
  { key: "cassa", group: "canali", surface: ["admin"], rights: ["view", "edit"], label: "Shop till" },
  { key: "ingrosso", group: "canali", surface: ["admin"], rights: ["view", "edit", "manage"], label: "Wholesale" },
  { key: "assistenza", group: "assistenza", surface: ["admin", "vendor"], rights: ["view", "edit", "manage"], label: "Help" },
  { key: "impostazioni", group: "sicurezza", surface: ["admin"], rights: ["view", "manage"], label: "Settings" },
  { key: "connettori", group: "sicurezza", surface: ["admin"], rights: ["view", "manage"], label: "Connectors" },
  { key: "registro", group: "sicurezza", surface: ["admin"], rights: ["view"], label: "Activity log" },
])
