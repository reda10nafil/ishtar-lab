/**
 * Mentre un prodotto viene cancellato il legame con la sua offerta sopravvive per un istante:
 * la relazione restituisce allora un elemento vuoto. Un solo buco non deve fermare tutto il magazzino.
 */
export const presenti = <T>(elenco: readonly (T | null | undefined)[] | null | undefined): T[] =>
  (elenco ?? []).filter((voce): voce is T => voce !== null && voce !== undefined)
