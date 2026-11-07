type Valore = string | number | boolean | null | undefined

function scarica(nome: string, contenuto: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }))
  const collegamento = document.createElement("a")
  collegamento.href = url
  collegamento.download = nome
  collegamento.click()
  URL.revokeObjectURL(url)
}

/** Un testo che inizia così diventerebbe una formula in Excel: l'apostrofo lo lascia testo. */
const FORMULA = /^[=+\-@\t\r]/

const cella = (valore: Valore) => {
  const grezzo = valore === null || valore === undefined ? "" : String(valore)
  const testo = typeof valore === "string" && FORMULA.test(grezzo) ? `'${grezzo}` : grezzo
  return /[";\r\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo
}

/** Punto e virgola e BOM: Excel apre il file senza passaggi in più, anche con il separatore europeo. */
export function scaricaCsv(nome: string, intestazioni: string[], righe: Valore[][]) {
  const testo = [intestazioni, ...righe].map((riga) => riga.map(cella).join(";")).join("\r\n")
  scarica(nome.endsWith(".csv") ? nome : `${nome}.csv`, `\uFEFF${testo}`, "text/csv;charset=utf-8")
}

export function scaricaJson(nome: string, dati: unknown) {
  scarica(nome.endsWith(".json") ? nome : `${nome}.json`, JSON.stringify(dati, null, 2), "application/json")
}
