/**
 * App dimostrative del pannello, scritte per un negozio di moda. Installarle e spegnerle è salvato davvero,
 * ma non collegano nulla: i servizi veri sono i connettori. `predefinita` dice com'è l'app al primo avvio.
 */
export type AppDemo = {
  id: string
  nome: string
  categoria: "shipping" | "marketing" | "finance" | "checkout" | "sales" | "inventory"
  fornitore: string
  descrizione: string
  voto: number
  prezzo_mese: number | null
  icona: "truck" | "star" | "book" | "gift" | "refresh" | "grid" | "scissors" | "globe"
  predefinita?: { attiva: boolean }
}

export const APP_DEMO: AppDemo[] = [
  { id: "parcel-desk", nome: "Parcel Desk", categoria: "shipping", fornitore: "Northline Couriers", descrizione: "Tracked labels for every parcel, ready to print from the order", voto: 4.5, prezzo_mese: null, icona: "truck", predefinita: { attiva: true } },
  { id: "fit-notes", nome: "Fit Notes", categoria: "marketing", fornitore: "Seamwise", descrizione: "Customer photos and fit comments on each product page", voto: 4.7, prezzo_mese: 9, icona: "star", predefinita: { attiva: true } },
  { id: "tallybook", nome: "Tallybook", categoria: "finance", fornitore: "Tally & Sons", descrizione: "Posts sales, refunds and fees straight into your books", voto: 4.3, prezzo_mese: 12, icona: "book", predefinita: { attiva: true } },
  { id: "tissue-twine", nome: "Tissue & Twine", categoria: "checkout", fornitore: "Paper Atelier", descrizione: "Gift boxes and handwritten cards offered in the basket", voto: 4.2, prezzo_mese: 4, icona: "gift", predefinita: { attiva: false } },
  { id: "capsule-club", nome: "Capsule Club", categoria: "sales", fornitore: "Loopline Studio", descrizione: "Subscriptions: a fresh capsule wardrobe every season", voto: 4.6, prezzo_mese: 19, icona: "refresh" },
  { id: "look-grid", nome: "Look Grid", categoria: "marketing", fornitore: "Mirrorline", descrizione: "Tag outfits in your social posts and sell from the feed", voto: 4.4, prezzo_mese: null, icona: "grid" },
  { id: "cut-list", nome: "Cut List", categoria: "inventory", fornitore: "Small Run Co", descrizione: "Plans production runs from your fabric and trim stock", voto: 4.8, prezzo_mese: 15, icona: "scissors" },
  { id: "border-duty", nome: "Border Duty", categoria: "shipping", fornitore: "Clearlane", descrizione: "Works out VAT and duty at checkout for orders abroad", voto: 4.1, prezzo_mese: 8, icona: "globe" },
]

export const trovaApp = (id: string) => APP_DEMO.find((a) => a.id === id)
