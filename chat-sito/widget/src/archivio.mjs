// Dove sta la sessione del visitatore della chat del sito. Nessuna dipendenza: si legge anche prima di caricare supabase-js.

export const CHIAVE_SESSIONE = 'ishtar-chat';
const BANDIERA = 'ishtar-chat-ricorda';

const prova = lavoro => {
  try {
    return lavoro();
  } catch {
    return null;
  }
};
const archivioLocale = () => prova(() => window.localStorage);
const archivioScheda = () => prova(() => window.sessionStorage);

/**
 * Dove sta la sessione del visitatore: nella scheda del browser (sessionStorage), oppure sul dispositivo (localStorage)
 * se il sito lo permette (data-ricorda) e il visitatore l'ha scelto. Se il browser blocca l'archivio, resta in memoria.
 */
export function archivioSessione(ricordaAmmesso) {
  const memoria = new Map();
  const inMemoria = {getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k)};
  const ricordata = () => Boolean(ricordaAmmesso && prova(() => archivioLocale()?.getItem(BANDIERA) === '1'));
  const dove = () => (ricordata() ? archivioLocale() : archivioScheda()) ?? inMemoria;
  const chiavi = archivio => prova(() => Object.keys(archivio).filter(k => k.startsWith(CHIAVE_SESSIONE) && k !== BANDIERA)) ?? [];
  return {
    getItem: k => prova(() => dove().getItem(k)) ?? inMemoria.getItem(k),
    setItem: (k, v) => {
      if (prova(() => (dove().setItem(k, v), true)) === null) inMemoria.setItem(k, v);
    },
    removeItem: k => {
      prova(() => archivioScheda()?.removeItem(k));
      prova(() => archivioLocale()?.removeItem(k));
      inMemoria.removeItem(k);
    },
    ricordata,
    /** Sposta la sessione fra la scheda e il dispositivo quando il visitatore cambia la scelta. */
    ricorda(si) {
      if (!ricordaAmmesso) return false;
      const [da, a] = si ? [archivioScheda(), archivioLocale()] : [archivioLocale(), archivioScheda()];
      if (!da || !a) return false;
      for (const k of chiavi(da)) {
        prova(() => a.setItem(k, da.getItem(k)));
        prova(() => da.removeItem(k));
      }
      prova(() => (si ? archivioLocale().setItem(BANDIERA, '1') : archivioLocale().removeItem(BANDIERA)));
      return ricordata() === si;
    },
  };
}

/** C'è già una conversazione salvata (senza caricare supabase-js): serve a decidere se leggere le risposte a chat chiusa. */
export function sessioneSalvata(ricordaAmmesso) {
  const archivio = archivioSessione(ricordaAmmesso);
  return Boolean(archivio.getItem(CHIAVE_SESSIONE));
}
