import { fotografiaProdotto, ripristinoProdotto } from "../ripristino"

const prodotto = {
  id: "prod_1", title: "Borsa", description: null, material: "Pelle", status: "draft", thumbnail: "https://x/b.jpg",
  images: [{ url: "https://x/b.jpg", rank: 1 }, { url: "https://x/a.jpg", rank: 0 }],
  categories: [{ id: "pcat_1" }], metadata: { ishtar_v1: { color: "Nero" }, altro: 1 },
}

describe("ripristino esplicito di un prodotto se il salvataggio viene annullato", () => {
  it("fotografa campi, foto in ordine, categorie e solo le chiavi di metadati che il salvataggio tocca", () => {
    expect(fotografiaProdotto(prodotto, ["ishtar_v1", "genere"])).toEqual({
      id: "prod_1", title: "Borsa", description: null, material: "Pelle", status: "draft", thumbnail: "https://x/b.jpg",
      images: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }], category_ids: ["pcat_1"],
      metadata: { ishtar_v1: { color: "Nero" }, genere: null },
    })
  })
  it("una chiave che prima non c'era viene tolta (\"\" con mergeMetadata), le altre tornano come erano", () => {
    const { id, ...aggiornamento } = { id: "prod_1", ...ripristinoProdotto(fotografiaProdotto(prodotto, ["ishtar_v1", "genere"])) }
    expect(id).toBe("prod_1")
    expect(aggiornamento.metadata).toEqual({ ishtar_v1: { color: "Nero" }, genere: "" })
    expect(aggiornamento.category_ids).toEqual(["pcat_1"])
    expect(aggiornamento).not.toHaveProperty("id")
  })
})
