type ErroreTransazione = { action?: string; handlerType?: string; error?: unknown }

const messaggio = (errore: unknown) => String((errore as { message?: unknown })?.message ?? errore)

/**
 * Esito di un workflow dal suo stato finale. «failed» arriva anche quando tutto è stato annullato: un workflow annidato
 * (runAsStep) che fallisce si annulla da solo, e quando il workflow esterno chiede poi di annullare quel passo la sua
 * transazione «non si trova» più. Solo un errore di annullamento su un altro passo, o di altro tipo, lascia il
 * salvataggio a metà.
 */
export function classificaEsito(stato: string, errori: ErroreTransazione[]): "fatto" | "annullato" | "a-meta" {
  if (stato === "done") return "fatto"
  if (stato === "reverted") return "annullato"
  // Qualunque altro stato (ancora in corso, in compensazione...) non è un salvataggio concluso.
  if (stato !== "failed") return "a-meta"
  return compensazioniFallite(errori).length ? "a-meta" : "annullato"
}

/** Annullamenti davvero non riusciti, come «passo: messaggio», escluso il caso innocuo dei workflow annidati. */
export function compensazioniFallite(errori: ErroreTransazione[]): string[] {
  const falliti = new Set(errori.filter((e) => e.handlerType === "invoke").map((e) => e.action))
  return errori
    .filter((e) => e.handlerType === "compensate" && !(falliti.has(e.action) && /could not be found/i.test(messaggio(e.error))))
    .map((e) => `${e.action}: ${messaggio(e.error)}`)
}
