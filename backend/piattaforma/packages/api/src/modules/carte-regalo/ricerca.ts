/** Testo cercato come tale: `%`, `_` e `\` non fanno da caratteri jolly. */
const simile = (testo: string) => ({ $ilike: `%${testo.replace(/[\\%_]/g, (c) => `\\${c}`)}%` })

/**
 * Filtro della ricerca nell'elenco delle carte regalo. Il codice vale come denaro: chi ha solo la lettura ne vede le
 * ultime quattro cifre, e una ricerca libera che guarda anche il codice (`q`) gli permetterebbe di ricostruirlo un
 * carattere alla volta. Con la sola lettura si cerca quindi per destinatario (nome o email).
 */
export function filtroRicerca(q: string, conCodice: boolean): Record<string, unknown> {
  if (!q) return {}
  if (conCodice) return { q }
  return { $or: [{ destinatario_nome: simile(q) }, { destinatario_email: simile(q) }] }
}
