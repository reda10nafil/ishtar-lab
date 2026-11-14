// Stile del widget, dentro lo Shadow DOM: non tocca la pagina del negozio e la pagina non lo tocca. Il colore si può
// cambiare dal sito con la proprietà --ishtar-chat-colore sull'elemento [data-ishtar-chat-widget] (testo bianco sopra).
export const STILE = `
:host { all: initial; }
@media print { :host { display: none; } }
.radice {
  --colore: var(--ishtar-chat-colore, #9d1b52);
  --fondo: #ffffff; --testo: #1f1f24; --tenue: #5b5b66; --bordo: #e3e3ea; --bordo-forte: #9a9aa6; --bolla: #f0f0f4;
  --errore: #b3261e; --fuoco: #1a73e8;
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--testo);
}
@media (prefers-color-scheme: dark) {
  .radice { --fondo: #1d1d22; --testo: #f3f3f6; --tenue: #b9b9c4; --bordo: #34343d; --bordo-forte: #6e6e7a; --bolla: #2b2b33; --errore: #ff8a80; --fuoco: #8ab4f8; }
}
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 3px solid var(--fuoco); outline-offset: 2px; }
.nascosto { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.pulsante {
  position: relative; display: grid; place-items: center; width: 56px; height: 56px; margin-left: auto; padding: 0; border: 0;
  border-radius: 50%; background: var(--colore); color: #fff; box-shadow: 0 4px 16px rgb(0 0 0 / 0.28);
}
.pulsante svg { width: 26px; height: 26px; }
.punto { position: absolute; top: 3px; right: 3px; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: #e8a33d; }
.finestra {
  position: absolute; right: 0; bottom: 72px; display: flex; flex-direction: column;
  width: min(360px, calc(100vw - 32px)); height: min(560px, calc(100vh - 104px));
  background: var(--fondo); border: 1px solid var(--bordo); border-radius: 14px; box-shadow: 0 12px 40px rgb(0 0 0 / 0.3); overflow: hidden;
}
[hidden] { display: none !important; }
.testa { display: flex; align-items: flex-start; gap: 8px; padding: 12px 10px 10px 16px; border-bottom: 1px solid var(--bordo); }
.testa h2 { margin: 0; font-size: 1.05em; font-weight: 650; line-height: 1.3; }
.stato { margin: 2px 0 0; font-size: 0.85em; color: var(--tenue); }
.stato a { color: inherit; }
.pallino { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: #8a8a96; vertical-align: 1px; }
.stato--online .pallino { background: #1e9e55; }
.chiudi { display: grid; place-items: center; flex: none; width: 36px; height: 36px; margin-left: auto; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--tenue); }
.chiudi svg { width: 20px; height: 20px; }
.corpo { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.avviso { margin: 0; padding: 8px 16px; font-size: 0.8em; color: var(--tenue); border-bottom: 1px solid var(--bordo); }
.vuoto { margin: auto 16px; padding: 16px 0; text-align: center; font-size: 0.9em; color: var(--tenue); }
.registro { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 12px 16px; list-style: none; }
.msg { display: flex; flex-direction: column; max-width: 85%; }
.msg--tu { align-self: flex-end; align-items: flex-end; }
.msg--negozio { align-self: flex-start; align-items: flex-start; }
.testo { margin: 0; padding: 8px 12px; border-radius: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg--tu .testo { background: var(--colore); color: #fff; border-bottom-right-radius: 4px; }
.msg--negozio .testo { background: var(--bolla); color: var(--testo); border-bottom-left-radius: 4px; }
.piede { margin-top: 3px; font-size: 0.75em; color: var(--tenue); }
.motivo { margin: 2px 0 0; font-size: 0.75em; color: var(--errore); }
.msg--errore .piede { color: var(--errore); font-weight: 600; }
.riprova { margin-top: 4px; padding: 2px 10px; border: 1px solid var(--bordo-forte); border-radius: 999px; background: transparent; font-size: 0.8em; }
.verifica-testo { margin: 0 16px 8px; font-size: 0.85em; color: var(--tenue); }
.dettagli { display: grid; gap: 6px; margin: 4px 16px 12px; padding: 10px 12px; border: 1px solid var(--bordo); border-radius: 10px; font-size: 0.85em; }
.dettagli p { margin: 0; color: var(--tenue); }
.dettagli input[type="text"], .dettagli input[type="email"] {
  min-width: 0; padding: 6px 8px; border: 1px solid var(--bordo-forte); border-radius: 8px; background: var(--fondo);
}
.ricorda { display: flex; align-items: center; gap: 6px; }
.secondario { justify-self: start; padding: 5px 14px; border: 1px solid var(--bordo-forte); border-radius: 999px; background: transparent; }
.esito { min-height: 1em; }
.scrivi { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--bordo); }
.scrivi textarea {
  flex: 1; min-width: 0; min-height: 40px; max-height: 120px; padding: 8px 10px; resize: none;
  border: 1px solid var(--bordo-forte); border-radius: 10px; background: var(--fondo);
}
.invia { flex: none; min-height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--colore); color: #fff; font-weight: 600; }
@media (max-width: 480px) {
  .radice { right: 8px; bottom: 8px; }
  .finestra { position: fixed; inset: 8px 8px 76px 8px; width: auto; height: auto; }
}
@media (forced-colors: active) {
  .pulsante, .invia, .chiudi, .riprova, .secondario { border: 1px solid ButtonText; }
  .msg .testo { border: 1px solid CanvasText; }
}
`;
