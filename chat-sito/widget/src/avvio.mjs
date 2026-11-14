// Avvio del widget della chat del sito. Configurazione dagli attributi data- dello script; il pulsante compare subito,
// supabase-js (casella.mjs) si valuta solo quando il visitatore apre la chat o ha già una conversazione da seguire.
import {sessioneSalvata} from './archivio.mjs';
import {configurazione} from './stato.mjs';
import {creaWidget} from './widget.mjs';

const script = document.currentScript;
const config = configurazione(script?.dataset ?? {});
if (config.errore) {
  console.error(`Ishtar chat: ${config.errore}`);
} else if (!window.__ishtarChat) {
  window.__ishtarChat = true;
  const avvia = () => creaWidget(config, () => import('./casella.mjs').then(m => m.creaCasella(config)), {haConversazione: sessioneSalvata(config.ricorda)});
  if (document.body) avvia();
  else document.addEventListener('DOMContentLoaded', avvia, {once: true});
}
