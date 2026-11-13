import { ordiniRecenti } from "../ordini"

describe("ordini della scheda cliente", () => {
  it("dal più recente, anche con le date come oggetti Date (query.graph), e date in ISO", () => {
    const ordini = [
      { id: "order_lun", display_id: 1, status: "pending", is_draft_order: false, total: 10, currency_code: "eur", created_at: new Date("2026-11-09T10:00:00Z") },
      { id: "order_ven", display_id: 3, status: "completed", is_draft_order: false, total: 30, currency_code: "eur", created_at: new Date("2026-11-13T09:00:00Z") },
      { id: "order_mer", display_id: 2, status: "canceled", is_draft_order: false, total: 20, currency_code: "eur", created_at: "2026-11-11T10:00:00.000Z" },
    ]
    const visti = ordiniRecenti(ordini)
    expect(visti.map((o) => o.id)).toEqual(["order_ven", "order_mer", "order_lun"])
    expect(visti[0]).toEqual({ id: "order_ven", numero: 3, stato: "completed", bozza: false, totale: 30, valuta: "eur", creato_il: "2026-11-13T09:00:00.000Z" })
  })
})
