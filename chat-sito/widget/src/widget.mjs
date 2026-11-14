// Finestra della chat del sito: pulsante e finestra non modale in uno Shadow DOM. Il testo entra sempre come testo
// (textContent o nodi di testo), mai come HTML. Lo stato sta in stato.mjs; la casella (supabase-js) arriva da
// `caricaCasella` solo quando serve. Il controllo Turnstile parte solo al primo invio, prima dell'accesso anonimo.
import {archivioSessione} from './archivio.mjs';
import {etichetta, intervalloLettura, MASSIMO_TESTO, motivoErrore, paginaCorrente, riduci, statoIniziale, statoNegozio, vista} from './stato.mjs';
import {STILE} from './stile.mjs';
import {testi} from './testi.mjs';

const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const VISTA = 'ishtar-chat-vista';
const SVG = 'http://www.w3.org/2000/svg';
const ICONE = {
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z',
  chiudi: 'M6 6l12 12M18 6L6 18',
};

/** Elemento con attributi e figli; `testo` diventa textContent, i figli stringa diventano nodi di testo. */
function el(tag, attributi = {}, ...figli) {
  const nodo = document.createElement(tag);
  for (const [nome, valore] of Object.entries(attributi)) {
    if (valore === false || valore === null || valore === undefined) continue;
    if (nome === 'testo') nodo.textContent = valore;
    else if (nome.startsWith('on')) nodo.addEventListener(nome.slice(2), valore);
    else if (typeof valore !== 'string' && nome in nodo) nodo[nome] = valore;
    else nodo.setAttribute(nome, valore === true ? '' : String(valore));
  }
  for (const figlio of figli) if (figlio) nodo.append(figlio);
  return nodo;
}

function icona(nome) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const tracciato = document.createElementNS(SVG, 'path');
  tracciato.setAttribute('d', ICONE[nome]);
  if (nome === 'chiudi') {
    tracciato.setAttribute('fill', 'none');
    tracciato.setAttribute('stroke', 'currentColor');
    tracciato.setAttribute('stroke-width', '2');
    tracciato.setAttribute('stroke-linecap', 'round');
  } else tracciato.setAttribute('fill', 'currentColor');
  svg.append(tracciato);
  return svg;
}

/**
 * Stile dentro lo Shadow DOM con un foglio costruibile: una CSP senza 'unsafe-inline' per gli stili blocca un <style>,
 * non un foglio creato da JavaScript. Il <style> resta solo per i browser senza fogli costruibili.
 */
function applicaStile(ombra) {
  try {
    const foglio = new CSSStyleSheet();
    foglio.replaceSync(STILE);
    ombra.adoptedStyleSheets = [foglio];
  } catch {
    ombra.append(el('style', {testo: STILE}));
  }
}

/** Elemento del documento che il tema del negozio non deve toccare: proprietà iniziali con priorità (CSSOM, ammesso dalla CSP). */
function neutro(nome, proprieta = {}) {
  const nodo = document.createElement(nome);
  nodo.style.setProperty('all', 'initial', 'important');
  for (const [chiave, valore] of Object.entries(proprieta)) nodo.style.setProperty(chiave, valore, 'important');
  return nodo;
}

const nuovoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

let scriptTurnstile = null;
function caricaTurnstile() {
  scriptTurnstile ??= new Promise((ok, ko) => {
    if (window.turnstile) return ok();
    const script = document.createElement('script');
    script.src = TURNSTILE;
    script.async = true;
    script.onload = () => ok();
    script.onerror = () => {
      scriptTurnstile = null;
      ko(Object.assign(new Error('turnstile'), {verifica: true}));
    };
    document.head.append(script);
  });
  return scriptTurnstile;
}

export function creaWidget(config, caricaCasella, {haConversazione = false} = {}) {
  const t = testi(config.lingua);
  const archivio = archivioSessione(config.ricorda);
  const id = `ishtar-chat-${Math.random().toString(36).slice(2, 8)}`;
  let s = statoIniziale();
  let aperta = false;
  let conConversazione = haConversazione;
  let casellaPromessa = null;
  let accesso = null;
  let coda = Promise.resolve();
  let timer = null;
  let inLettura = false;
  let primaLettura = true;
  const nodi = new Map();

  // ——— Struttura ———
  // Ospite con un nome suo (le regole del tema per div e simili non lo prendono) e fuori dal body: una transform del tema
  // sul body non sposta la finestra, che resta fissa sullo schermo.
  const ospite = neutro('ishtar-chat');
  ospite.setAttribute('data-ishtar-chat-widget', '');
  const ombra = ospite.attachShadow({mode: 'open'});
  // Il controllo Turnstile sta nel documento (contenuto dello slot «verifica»): lo script di Cloudflare lavora lì.
  const verifica = neutro('ishtar-chat-verifica', {display: 'block', margin: '0 16px 8px'});
  verifica.setAttribute('slot', 'verifica');
  ospite.append(verifica);

  const punto = el('span', {class: 'punto', hidden: true});
  const pulsante = el('button', {type: 'button', class: 'pulsante', 'aria-expanded': 'false', 'aria-controls': `${id}-finestra`, 'aria-label': t.apri,
    onclick: () => (aperta ? chiudi() : apri())}, icona('chat'), punto);
  const titolo = el('h2', {id: `${id}-titolo`, testo: t.titolo});
  const statoRiga = el('p', {class: 'stato', 'aria-live': 'polite', hidden: true});
  const chiudiPulsante = el('button', {type: 'button', class: 'chiudi', 'aria-label': t.chiudi, onclick: () => chiudi()}, icona('chiudi'));
  const vuoto = el('p', {class: 'vuoto', testo: t.vuoto});
  const registro = el('ol', {class: 'registro', role: 'log', 'aria-live': 'polite', 'aria-label': t.registro});
  const testoVerifica = el('p', {class: 'verifica-testo', 'aria-live': 'polite', hidden: true});
  const nome = el('input', {type: 'text', id: `${id}-nome`, maxLength: 100, autocomplete: 'name'});
  const email = el('input', {type: 'email', id: `${id}-email`, maxLength: 254, autocomplete: 'email'});
  const ricorda = config.ricorda ? el('input', {type: 'checkbox', id: `${id}-ricorda`}) : null;
  const esitoDettagli = el('p', {class: 'esito', 'aria-live': 'polite'});
  const dettagli = el('form', {class: 'dettagli', hidden: true, onsubmit: salvaDettagli},
    el('p', {testo: t.dettagli}),
    el('label', {for: nome.id, testo: t.nome}), nome,
    el('label', {for: email.id, testo: t.email}), email,
    ricorda && el('label', {class: 'ricorda', for: ricorda.id}, ricorda, t.ricorda),
    el('button', {type: 'submit', class: 'secondario', testo: t.salva}),
    esitoDettagli);
  const campo = el('textarea', {id: `${id}-campo`, rows: 2, maxLength: MASSIMO_TESTO, placeholder: t.segnaposto,
    oninput: () => { s = riduci(s, {tipo: 'bozza', testo: campo.value}); },
    onkeydown: e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        mandaBozza();
      }
    }});
  const scrivi = el('form', {class: 'scrivi', onsubmit: e => { e.preventDefault(); mandaBozza(); }},
    el('label', {class: 'nascosto', for: campo.id, testo: t.campo}), campo, el('button', {type: 'submit', class: 'invia', testo: t.invia}));
  const corpo = el('div', {class: 'corpo'}, el('p', {class: 'avviso', testo: t.avviso}), vuoto, registro, testoVerifica, el('slot', {name: 'verifica'}), dettagli);
  const finestra = el('section', {class: 'finestra', id: `${id}-finestra`, role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': titolo.id, hidden: true,
    onkeydown: e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        chiudi();
      }
    }},
  el('div', {class: 'testa'}, el('div', {}, titolo, statoRiga), chiudiPulsante), corpo, scrivi);
  applicaStile(ombra);
  ombra.append(el('div', {class: 'radice'}, finestra, pulsante));
  document.documentElement.append(ospite);

  // ——— Casella e accesso ———
  function casella() {
    casellaPromessa ??= caricaCasella().then(c => {
      if (ricorda) ricorda.checked = c.ricordata();
      return c;
    }, e => {
      casellaPromessa = null;
      throw e;
    });
    return casellaPromessa;
  }

  function tokenTurnstile() {
    testoVerifica.textContent = t.verifica;
    testoVerifica.hidden = false;
    let widgetId = null;
    return caricaTurnstile()
      .then(() => new Promise((ok, ko) => {
        const fallita = () => ko(Object.assign(new Error('turnstile'), {verifica: true}));
        try {
          widgetId = window.turnstile.render(verifica, {
            sitekey: config.turnstile, language: config.lingua, appearance: 'interaction-only',
            callback: ok, 'error-callback': fallita, 'expired-callback': fallita, 'timeout-callback': fallita,
          });
        } catch {
          fallita();
        }
      }))
      .finally(() => {
        testoVerifica.hidden = true;
        try { if (widgetId !== null) window.turnstile.remove(widgetId); } catch { /* già tolto */ }
      });
  }

  /** Accesso anonimo solo al primo invio (con il controllo Turnstile se il sito ha la chiave); uno solo alla volta. */
  async function entraSeServe(c) {
    if (await c.sessione()) return;
    accesso ??= (async () => c.entra(config.turnstile ? await tokenTurnstile() : null))().finally(() => { accesso = null; });
    await accesso;
  }

  // ——— Invio ———
  function mandaBozza() {
    s = riduci(s, {tipo: 'bozza', testo: campo.value});
    const prima = s.inSospeso.length;
    const id_client = nuovoId();
    s = riduci(s, {tipo: 'invia', id_client, adesso: Date.now()});
    if (s.inSospeso.length === prima) return;
    campo.value = s.bozza;
    disegna({inFondo: true});
    coda = coda.then(() => manda(id_client));
  }

  function riprova(id_client) {
    s = riduci(s, {tipo: 'riprova', id_client});
    disegna();
    coda = coda.then(() => manda(id_client));
  }

  async function manda(id_client) {
    const m = s.inSospeso.find(x => x.id_client === id_client);
    if (!m || m.fase !== 'invio') return;
    try {
      const c = await casella();
      await entraSeServe(c);
      const r = await c.scrivi(id_client, m.testo, paginaCorrente(window.location));
      conConversazione = true;
      s = riduci(s, {tipo: 'inviato', id_client, id: r?.id, creato_il: r?.creato_il});
      dettagli.hidden = false;
      leggiPresto();
    } catch (e) {
      s = riduci(s, {tipo: 'non_inviato', id_client, errore: motivoErrore(e, t) ?? (e?.verifica ? t.verificaFallita : null)});
    }
    disegna();
  }

  async function salvaDettagli(e) {
    e.preventDefault();
    esitoDettagli.textContent = '';
    try {
      const c = await casella();
      const n = nome.value.trim(), m = email.value.trim();
      if (n || m) await c.profilo(n || null, m || null);
      if (ricorda) c.ricorda(ricorda.checked);
      esitoDettagli.textContent = t.salvato;
    } catch {
      esitoDettagli.textContent = t.nonSalvato;
    }
  }

  // ——— Letture ———
  async function leggi() {
    if (inLettura) return;
    inLettura = true;
    try {
      const c = await casella();
      const stato = await c.stato();
      s = riduci(s, {tipo: 'negozio', online: stato?.online, nome: stato?.nome});
      if (await c.sessione()) {
        conConversazione = true;
        // Prima le righe, poi lo stato: con l'await dentro gli argomenti si ripartirebbe dallo stato di prima della lettura
        // e una conferma d'invio arrivata nel frattempo andrebbe persa (messaggio doppio o fermo su «Invio…»).
        const righe = await c.leggi();
        s = riduci(s, {tipo: 'letti', righe});
      }
    } catch {
      s = riduci(s, {tipo: 'errore_lettura'});
    } finally {
      inLettura = false;
    }
    disegna();
    programma();
  }

  function programma() {
    clearTimeout(timer);
    const ms = intervalloLettura({aperta, conversazione: conConversazione, errori: s.erroriLettura});
    timer = ms === null ? null : setTimeout(leggi, ms);
  }

  function leggiPresto() {
    clearTimeout(timer);
    timer = setTimeout(leggi, 400);
  }

  // ——— Disegno ———
  const ultimaRisposta = () => {
    const risposte = s.messaggi.filter(m => m.direzione === 'uscita');
    return risposte.length ? risposte[risposte.length - 1].id : null;
  };

  function segnaVista() {
    const ultima = ultimaRisposta();
    if (ultima) archivio.setItem(VISTA, ultima);
  }

  function nodoMessaggio() {
    const testo = el('p', {class: 'testo'});
    const piede = el('span', {class: 'piede'});
    const motivo = el('p', {class: 'motivo', hidden: true});
    const bottone = el('button', {type: 'button', class: 'riprova', hidden: true, testo: t.riprova});
    const li = el('li', {class: 'msg'}, testo, piede, motivo, bottone);
    return {li, testo, piede, motivo, bottone};
  }

  function aggiorna(nodo, m) {
    const tu = m.direzione !== 'uscita';
    const stato = etichetta(m, t);
    nodo.li.className = `msg ${tu ? 'msg--tu' : 'msg--negozio'}${stato?.riprova ? ' msg--errore' : ''}`;
    if (nodo.testo.textContent !== m.testo) nodo.testo.textContent = m.testo;
    const piede = tu ? stato?.testo ?? '' : m.firma || t.negozio;
    if (nodo.piede.textContent !== piede) nodo.piede.textContent = piede;
    nodo.motivo.textContent = m.errore ?? '';
    nodo.motivo.hidden = !m.errore || m.fase !== 'errore';
    nodo.bottone.hidden = !stato?.riprova;
    nodo.bottone.onclick = stato?.riprova ? () => riprova(m.id_client) : null;
  }

  function disegna({inFondo = false} = {}) {
    const vicinoAlFondo = corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 60;
    const elenco = vista(s);
    vuoto.hidden = elenco.length > 0;
    const visti = new Set();
    let precedente = null;
    for (const m of elenco) {
      const chiave = m.id ?? `p:${m.id_client}`;
      let nodo = nodi.get(chiave);
      // Il messaggio appena confermato prende l'id della casella: resta lo stesso elemento (nessun nuovo annuncio).
      if (!nodo && m.id_client && nodi.has(`p:${m.id_client}`)) {
        nodo = nodi.get(`p:${m.id_client}`);
        nodi.delete(`p:${m.id_client}`);
        nodi.set(chiave, nodo);
      }
      if (!nodo) {
        nodo = nodoMessaggio();
        nodi.set(chiave, nodo);
      }
      aggiorna(nodo, m);
      visti.add(chiave);
      const atteso = precedente ? precedente.li.nextSibling : registro.firstChild;
      if (nodo.li !== atteso) registro.insertBefore(nodo.li, atteso);
      precedente = nodo;
    }
    for (const [chiave, nodo] of nodi) {
      if (!visti.has(chiave)) {
        nodo.li.remove();
        nodi.delete(chiave);
      }
    }

    const negozio = statoNegozio(s);
    statoRiga.hidden = !negozio;
    statoRiga.className = `stato stato--${negozio ?? 'sconosciuto'}`;
    statoRiga.replaceChildren();
    if (negozio === 'offline' && config.email) {
      statoRiga.append(el('span', {class: 'pallino'}), `${t.offlineEmail} `, el('a', {href: `mailto:${config.email}`, testo: config.email}));
    } else if (negozio) {
      statoRiga.append(el('span', {class: 'pallino'}), t[negozio]);
    }

    // Risposte nuove a chat chiusa: un punto sul pulsante (la prima lettura dopo il caricamento ne prende nota).
    const ultima = ultimaRisposta();
    if (aperta) segnaVista();
    else if (primaLettura && ultima && !archivio.getItem(VISTA)) segnaVista();
    if (ultima) primaLettura = false;
    const nuova = !aperta && ultima && ultima !== archivio.getItem(VISTA);
    punto.hidden = !nuova;
    pulsante.setAttribute('aria-label', aperta ? t.chiudi : nuova ? t.apriNuovo : t.apri);

    if (inFondo || vicinoAlFondo) corpo.scrollTop = corpo.scrollHeight;
  }

  function apri() {
    aperta = true;
    finestra.hidden = false;
    pulsante.setAttribute('aria-expanded', 'true');
    disegna({inFondo: true});
    campo.focus();
    leggi();
  }

  function chiudi() {
    aperta = false;
    finestra.hidden = true;
    pulsante.setAttribute('aria-expanded', 'false');
    disegna();
    pulsante.focus();
    programma();
  }

  // Con una conversazione già aperta (in questa scheda o ricordata) si seguono le risposte anche a chat chiusa.
  if (conConversazione) timer = setTimeout(leggi, 1500);
  return {apri, chiudi};
}
