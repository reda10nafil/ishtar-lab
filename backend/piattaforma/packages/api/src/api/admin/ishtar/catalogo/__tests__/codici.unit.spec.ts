import { controllaCodici, restiDeiCodici } from "../../../catalogo/comune/codici"

/** Contenitore finto: query.graph restituisce le righe preparate per entità e SKU. */
function scope(righe: Record<string, { sku: string }[]>) {
  const query = { graph: async ({ entity, filters }: any) => ({ data: (righe[entity] ?? []).filter((r) => filters.sku.includes(r.sku)) }) }
  return { resolve: () => query } as any
}

describe("codici degli articoli", () => {
  it("uno SKU libero passa", async () => {
    await expect(controllaCodici(scope({}), ["SKU-NUOVO"])).resolves.toBeUndefined()
  })
  it("uno SKU già usato da una variante è rifiutato come prima", async () => {
    await expect(controllaCodici(scope({ variant: [{ sku: "SKU-1" }] }), ["SKU-1"])).rejects.toThrow(/already used by another item/)
  })
  it("uno SKU rimasto su una voce di magazzino orfana è rifiutato subito, non a creazione già avviata", async () => {
    await expect(controllaCodici(scope({ inventory_item: [{ sku: "SKU-2" }] }), ["SKU-2"])).rejects.toThrow(/already used by a stock item/)
  })
  it("dopo una creazione annullata si cercano i resti con quegli SKU (varianti o voci di magazzino)", async () => {
    expect(await restiDeiCodici(scope({}), ["SKU-3"])).toEqual([])
    expect(await restiDeiCodici(scope({ inventory_item: [{ sku: "SKU-3" }] }), ["SKU-3"])).toEqual(["SKU-3"])
  })
})
