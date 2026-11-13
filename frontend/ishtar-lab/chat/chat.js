// Pagina «Chats» del primo pannello: casella dei clienti sui dati veri del backend, attraverso il ponte locale.
// Componenti, classi e token originali del kit; classi nuove solo `chat-*` (chat.css). I dati veri restano in memoria:
// mai nello stato dimostrativo salvato nel browser, mai nel registro delle attività del kit.
import {
  nn as modulo, wt as demo, d as Testata, b as Schede, t as Avatar, p as Pill, o as Vuoto, m as Ricerca, q as Icona,
  j as apriCassetto, N as apriFinestra, A as conferma, F as avviso,
} from '../assets/kit-BLRx7j0_.js';
import {richiesta} from './api.mjs';
import {creaCasella} from './controllo.mjs';
import {
  etichettaCanale, etichettaStato, nomeContatto, quandoElenco, quandoMessaggio, soldi, statoOrdine, unisci, statoRisposta,
  testoErrore, nuovoId,
} from './casella.mjs';
import {attesaRiprova} from '../catalogo/collegamento.mjs';

const React = modulo();
const {useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore, Fragment} = React;
const h = React.createElement;
const CANALI = ['telegram', 'email', 'sito', 'whatsapp', 'instagram', 'messenger'];
const MASSIMO_RISPOSTA = 4000;

// Conversazione sullo schermo, letta dall'indirizzo come fa il router del kit: #/chats/<open|closed>/<id>.
function vista() {
  const parti = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return p; } });
  if (parti[0] !== 'chats') return {chat: false, id: null};
  const scheda = ['open', 'closed'].includes(parti[1]);
  return {chat: true, id: scheda ? parti[2] ?? null : null};
}

const casella = window.IshtarChats ?? creaCasella({
  richiesta,
  nuovoId,
  ambiente: {
    adesso: () => Date.now(),
    visibile: () => document.visibilityState === 'visible',
    inPrimoPiano: () => document.hasFocus(),
    vista: () => ({id: vista().id}),
    avviso: (testo, opzioni) => avviso(testo, opzioni),
  },
});

// Letture: nella pagina dettaglio ogni 5 s ed elenco ogni 10 s; altrove solo i conteggi (badge del menu) ogni 30 s.
// Mai con la pagina nascosta o con la demo non ancora «entrata»; con errori, attesa crescente come il catalogo.
if (!window.IshtarChats) {
  window.IshtarChats = casella;
  let timer = 0, giro = 0, errori = 0, inCorso = false, ancora = false;
  const ciclo = async () => {
    clearTimeout(timer);
    if (inCorso) { ancora = true; return; }
    if (document.visibilityState !== 'visible') return;
    if (!demo.signedIn) { timer = setTimeout(ciclo, 5000); return; }
    const sullaPagina = vista().chat;
    inCorso = true;
    let ok = true;
    try {
      ok = sullaPagina ? await casella.aggiorna({elenco: giro++ % 2 === 0, dettaglio: true}) : await casella.aggiorna({conteggi: true});
    } finally {
      inCorso = false;
    }
    errori = ok ? 0 : errori + 1;
    if (ancora) { ancora = false; ciclo(); return; }
    timer = setTimeout(ciclo, errori ? attesaRiprova(errori - 1) : sullaPagina ? 5000 : 30000);
  };
  const subito = () => { giro = 0; ciclo(); };
  let eraSullaPagina = vista().chat;
  addEventListener('hashchange', () => { const ora = vista().chat; if (ora && !eraSullaPagina) subito(); eraSullaPagina = ora; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') subito(); });
  addEventListener('focus', () => casella.segnaLetta());
  addEventListener('online', subito);
  // Badge del menu (Chats): conversazioni aperte con messaggi non letti.
  let badge = -1;
  casella.iscrivi(() => {
    const n = casella.istantanea().elenco.conteggi.non_lette | 0;
    if (n === badge) return;
    badge = n;
    window.IshtarChatBadge = n;
    dispatchEvent(new Event('ishtar:chat-badge'));
  });
  // Risposte non partite o rifiutate: chiudendo la scheda andrebbero perse, il browser chiede conferma.
  addEventListener('beforeunload', e => { if (casella.inAttesa()) { e.preventDefault(); e.returnValue = ''; } });
  subito();
}

const usaCasella = () => useSyncExternalStore(casella.iscrivi, casella.istantanea);

function usaLarghezza() {
  const leggi = () => (innerWidth >= 1280 ? 'tre' : innerWidth > 760 ? 'due' : 'una');
  const [larghezza, cambia] = useState(leggi);
  useEffect(() => {
    const segui = () => cambia(leggi());
    addEventListener('resize', segui);
    return () => removeEventListener('resize', segui);
  }, []);
  return larghezza;
}

// Altezza della casella: fino in fondo alla finestra (sopra la barra del telefono), così la scrittura resta in vista.
function usaAltezza(ref, chiave) {
  useLayoutEffect(() => {
    const misura = () => {
      const el = ref.current;
      if (!el) return;
      let sopra = 0;
      for (let n = el; n; n = n.offsetParent) sopra += n.offsetTop;
      const barra = document.querySelector('.tabbar');
      const sotto = barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight + 16 : 24;
      el.style.height = `${Math.max(420, innerHeight - sopra - sotto)}px`;
    };
    misura();
    document.fonts?.ready.then(misura);
    addEventListener('resize', misura);
    return () => removeEventListener('resize', misura);
  }, [chiave]);
}

const nomeCliente = c => [c?.nome, c?.cognome].filter(Boolean).join(' ') || c?.email || 'Customer';

function PaginaChats({sub, params}) {
  const s = usaCasella();
  const id = params?.[0] ?? null;
  const scheda = sub === 'closed' ? 'closed' : 'open';
  const larghezza = usaLarghezza();
  const ref = useRef(null);
  usaAltezza(ref, larghezza);
  useEffect(() => { casella.filtra({stato: scheda === 'closed' ? 'chiuse' : 'aperte'}); }, [scheda]);
  useEffect(() => { casella.apri(id); }, [id]);
  useEffect(() => { if (!casella.istantanea().rapide.caricate) casella.caricaRapide(); }, []);
  const {aperte, chiuse} = s.elenco.conteggi;
  const colonne = [];
  if (larghezza !== 'una' || !id) colonne.push(h(Elenco, {key: 'elenco', s, scheda, id}));
  if (larghezza !== 'una' || id) colonne.push(h(Conversazione, {key: 'conv', s, scheda, id, larghezza}));
  if (larghezza === 'tre') colonne.push(h('aside', {key: 'scheda', className: 'card chat__scheda', 'aria-label': 'Customer'}, h(SchedaCliente, {idConversazione: id})));
  return h(Fragment, null,
    h(Testata, {title: 'Chats', sub: 'Customer messages from your channels, with their orders alongside.'},
      h('button', {type: 'button', className: 'btn', onClick: apriRapide}, h(Icona, {name: 'reply'}), 'Quick replies')),
    h(Schede, {page: 'chats', sub: scheda, counts: {open: aperte, closed: chiuse}}),
    h('div', {className: `chat chat--${larghezza}`, ref}, colonne));
}

function Elenco({s, scheda, id}) {
  const {righe, filtri, caricato, errore, totale, quante} = s.elenco;
  const [q, cambiaQ] = useState(filtri.q);
  useEffect(() => {
    const attesa = setTimeout(() => casella.filtra({q}), 300);
    return () => clearTimeout(attesa);
  }, [q]);
  const adesso = Date.now();
  let corpo;
  if (!caricato && errore) corpo = h(Vuoto, {icon: 'alert', title: 'Chats are offline', body: `${errore} Trying again…`});
  else if (!caricato) corpo = h('p', {className: 'chat-carica', role: 'status'}, 'Loading chats…');
  else if (!righe.length) {
    corpo = filtri.q || filtri.canale
      ? h(Vuoto, {icon: 'search', title: 'No chats match', body: 'Try another name or word.'})
      : scheda === 'closed'
        ? h(Vuoto, {icon: 'chat', title: 'No closed chats'})
        : h(Vuoto, {icon: 'chat', title: 'No open chats', body: "When a customer writes to the shop's Telegram bot, the chat appears here."});
  } else {
    corpo = h('ul', {className: 'chat__righe'}, righe.map(r => h(Riga, {key: r.id, r, scheda, attiva: r.id === id, adesso})));
  }
  return h('section', {className: 'card card--flush chat__elenco', 'aria-label': 'Conversations'},
    h('div', {className: 'chat__strumenti'},
      h(Ricerca, {value: q, onChange: cambiaQ, placeholder: 'Name, message or contact'}),
      h('select', {className: 'select chat__canale', value: filtri.canale, 'aria-label': 'Channel', onChange: e => casella.filtra({canale: e.target.value})},
        h('option', {value: ''}, 'All channels'),
        CANALI.map(c => h('option', {key: c, value: c}, etichettaCanale(c))))),
    caricato && errore && h('p', {className: 'chat-avviso', role: 'alert'}, `Not updated: ${errore}`),
    h('div', {className: 'chat__scorri'}, corpo,
      totale > righe.length && quante < 200 && h('div', {className: 'more-row'},
        h('button', {type: 'button', className: 'btn btn--sm', onClick: () => casella.altre()}, `Show more (${righe.length} of ${totale})`))));
}

function Riga({r, scheda, attiva, adesso}) {
  const nome = nomeContatto(r);
  const classi = ['chat-riga', attiva && 'is-on', r.non_letti > 0 && 'is-nuova'].filter(Boolean).join(' ');
  return h('li', null, h('a', {className: classi, href: `#/chats/${scheda}/${encodeURIComponent(r.id)}`, 'aria-current': attiva ? 'page' : undefined},
    h(Avatar, {name: nome}),
    h('span', {className: 'chat-riga__testo'},
      h('span', {className: 'chat-riga__su'}, h('b', null, nome), h('time', {dateTime: r.ultimo_messaggio_il}, quandoElenco(r.ultimo_messaggio_il, adesso))),
      h('span', {className: 'chat-riga__su'},
        h('small', {className: 'chat-riga__estratto'}, r.estratto),
        r.non_letti > 0 && h('span', {className: 'badge chat-riga__nuovi', 'aria-label': `${r.non_letti} unread`}, r.non_letti)),
      h('span', {className: 'chat-riga__info'},
        h('small', null, etichettaCanale(r.canale)),
        r.stato === 'in_attesa' && h('small', null, '· Waiting')))));
}

function Conversazione({s, scheda, id, larghezza}) {
  if (!id) return h('section', {className: 'card chat__conv chat__conv--vuota'}, h(Vuoto, {icon: 'chat', title: 'Pick a chat', body: 'Choose a conversation to read and reply.'}));
  const {aperta} = s;
  const indietro = h('a', {className: 'btn btn--sm', href: `#/chats/${scheda}`}, h(Icona, {name: 'back'}), 'Back to chats');
  if (aperta.id === id && aperta.mancante) {
    return h('section', {className: 'card chat__conv chat__conv--vuota'}, h(Vuoto, {icon: 'chat', title: 'Chat not found', body: 'It may have been removed.'}, indietro));
  }
  const dati = aperta.id === id ? aperta.dati : null;
  const riga = s.elenco.righe.find(r => r.id === id);
  const conv = dati?.conversazione ?? riga;
  if (!conv) {
    return h('section', {className: 'card chat__conv chat__conv--vuota'},
      aperta.errore ? h(Vuoto, {icon: 'alert', title: 'Chats are offline', body: `${aperta.errore} Trying again…`}) : h('p', {className: 'chat-carica', role: 'status'}, 'Loading the chat…'));
  }
  return h(Aperta, {key: id, s, scheda, id, conv, dati, larghezza});
}

function Aperta({s, scheda, id, conv, dati, larghezza}) {
  const nome = nomeContatto(dati?.identita ?? conv);
  const chiusa = conv.stato === 'chiusa';
  const [testo, cambiaTesto] = useState(() => casella.bozza(id));
  const area = useRef(null);
  const scrivi = valore => { cambiaTesto(valore); casella.bozza(id, valore); };
  const manda = () => {
    const daInviare = testo;
    if (!daInviare.trim() || chiusa) return;
    scrivi('');
    casella.rispondi(id, daInviare);
    area.current?.focus();
  };
  const inserisci = aggiunta => {
    const el = area.current, inizio = el?.selectionStart ?? testo.length, fine = el?.selectionEnd ?? testo.length;
    const nuovo = (testo.slice(0, inizio) + aggiunta + testo.slice(fine)).slice(0, MASSIMO_RISPOSTA);
    scrivi(nuovo);
    requestAnimationFrame(() => { const p = Math.min(nuovo.length, inizio + aggiunta.length); el?.focus(); el?.setSelectionRange(p, p); });
  };
  const riprendi = id_client => {
    const ripreso = casella.scarta(id_client);
    if (ripreso) scrivi(testo ? `${testo}\n${ripreso}` : ripreso);
  };
  const messaggi = dati ? unisci(dati.messaggi, s.inSospeso, id) : [];
  return h('section', {className: 'card card--flush chat__conv', 'aria-label': `Chat with ${nome}`},
    h('header', {className: 'chat__testa'},
      larghezza === 'una' && h('a', {className: 'ibtn ibtn--flat', href: `#/chats/${scheda}`, 'aria-label': 'Back'}, h(Icona, {name: 'back'})),
      h(Avatar, {name: nome}),
      h('span', {className: 'cell__text chat__chi'}, h('b', null, nome),
        h('small', null, [etichettaCanale(conv.canale), etichettaStato(conv.stato), conv.oggetto].filter(Boolean).join(' · '))),
      h('span', {className: 'chat__azioni'},
        larghezza !== 'tre' && h('button', {type: 'button', className: 'btn btn--sm', onClick: () => apriCassetto({title: 'Customer', body: () => h(SchedaCliente, {idConversazione: id})})},
          h(Icona, {name: 'user'}), 'Customer'),
        chiusa
          ? h('button', {type: 'button', className: 'btn btn--sm', onClick: () => casella.cambiaStato(id, 'aperta')}, h(Icona, {name: 'refresh'}), 'Reopen')
          : h('button', {type: 'button', className: 'btn btn--sm', disabled: !dati, onClick: () => casella.cambiaStato(id, 'chiusa')}, h(Icona, {name: 'check'}), 'Close'))),
    s.aperta.errore && dati && h('p', {className: 'chat-avviso', role: 'alert'}, `Not updated: ${s.aperta.errore}`),
    dati ? h(Registro, {messaggi, conversazione_id: id, riprendi}) : h('p', {className: 'chat-carica', role: 'status'}, 'Loading messages…'),
    chiusa
      ? h('div', {className: 'chat-chiusa'}, h('span', null, 'This chat is closed.'),
        h('button', {type: 'button', className: 'btn btn--sm', onClick: () => casella.cambiaStato(id, 'aperta')}, 'Reopen'))
      : h(Fragment, null,
        h(Rapide, {righe: s.rapide.righe, inserisci}),
        h('form', {className: 'chat-scrivi', onSubmit: e => { e.preventDefault(); manda(); }},
          h('textarea', {
            ref: area, className: 'textarea chat-scrivi__testo', value: testo, maxLength: MASSIMO_RISPOSTA, rows: 1, disabled: !dati,
            placeholder: `Reply to ${nome.split(/\s+/)[0]}…`, 'aria-label': `Reply to ${nome}`,
            onChange: e => scrivi(e.target.value),
            onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); manda(); } },
          }),
          h('button', {type: 'submit', className: 'btn btn--primary', disabled: !dati || !testo.trim()}, h(Icona, {name: 'send'}), 'Send')),
        testo.length > MASSIMO_RISPOSTA - 500 && h('small', {className: 'chat-conta', 'aria-live': 'polite'}, `${testo.length} / ${MASSIMO_RISPOSTA}`)));
}

function Registro({messaggi, conversazione_id, riprendi}) {
  const ref = useRef(null), inFondo = useRef(true);
  const ultimo = messaggi.length ? messaggi[messaggi.length - 1] : null;
  const chiaveUltimo = ultimo ? `${ultimo.id ?? ultimo.id_client}:${ultimo.stato_consegna ?? ultimo.fase}` : '';
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && inFondo.current) el.scrollTop = el.scrollHeight;
  }, [messaggi.length, chiaveUltimo]);
  const adesso = Date.now();
  return h('ol', {
    className: 'chat__registro', ref, role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages', tabIndex: 0,
    onScroll: () => { const el = ref.current; inFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; },
  }, messaggi.length ? messaggi.map(m => h(Bolla, {key: m.id ?? m.id_client, m, adesso, conversazione_id, riprendi}))
    : h('li', {className: 'chat-carica'}, 'No messages yet.'));
}

function Bolla({m, adesso, conversazione_id, riprendi}) {
  const fuori = m.locale || m.direzione === 'uscita';
  const stato = statoRisposta(m, adesso);
  const riprova = () => (m.id_client ? casella.riprova({id_client: m.id_client, testo: m.testo, conversazione_id}) : rimanda());
  const rimanda = async () => {
    const si = await conferma({title: 'Send again?', body: 'The customer may already have this reply. Send it again as a new message?', ok: 'Send again'});
    if (si) casella.rimanda({testo: m.testo, conversazione_id});
  };
  const azioni = [];
  if (stato?.azione === 'riprova') azioni.push(h('button', {key: 'r', type: 'button', className: 'btn btn--sm', onClick: riprova}, h(Icona, {name: 'refresh', size: 'sm'}), 'Retry'));
  if (stato?.azione === 'rimanda') azioni.push(h('button', {key: 's', type: 'button', className: 'btn btn--sm', onClick: rimanda}, 'Send again'));
  if (stato?.azione === 'modifica') {
    azioni.push(h('button', {key: 'e', type: 'button', className: 'btn btn--sm', onClick: () => riprendi(m.id_client)}, h(Icona, {name: 'edit', size: 'sm'}), 'Edit'));
    azioni.push(h('button', {key: 'd', type: 'button', className: 'btn btn--sm', onClick: () => casella.scarta(m.id_client)}, 'Discard'));
  }
  const chi = fuori ? m.autore_nome || 'You' : null;
  return h('li', {className: `chat-bolla ${fuori ? 'chat-bolla--fuori' : 'chat-bolla--dentro'}`},
    h('p', {className: 'chat-bolla__testo'}, m.testo),
    h('div', {className: 'chat-bolla__piede'},
      h('small', null, [chi, quandoMessaggio(m.quando, adesso)].filter(Boolean).join(' · ')),
      stato && h('small', {className: `chat-stato chat-stato--${stato.tono}`}, stato.testo)),
    m.locale && m.fase === 'attesa' && m.errore && h('small', {className: 'chat-bolla__motivo'}, m.errore),
    azioni.length > 0 && h('div', {className: 'chat-bolla__azioni'}, azioni));
}

function Rapide({righe, inserisci}) {
  return h('div', {className: 'chat-rapide', role: 'group', 'aria-label': 'Quick replies'},
    righe.map(r => h('button', {key: r.id, type: 'button', className: 'chip', title: r.testo, onClick: () => inserisci(r.testo)}, r.titolo)),
    h('button', {type: 'button', className: 'chip chat-rapide__gestisci', onClick: apriRapide},
      h(Icona, {name: righe.length ? 'edit' : 'plus', size: 'sm'}), righe.length ? 'Manage' : 'Add quick reply'));
}

function SchedaCliente({idConversazione}) {
  const s = usaCasella();
  const dati = idConversazione && s.aperta.id === idConversazione ? s.aperta.dati : null;
  const identita = dati?.identita;
  const clienteId = identita?.cliente_id ?? null;
  useEffect(() => { if (clienteId) casella.cliente(clienteId); }, [clienteId]);
  if (!idConversazione) return h('div', {className: 'chat-scheda'}, h(Vuoto, {icon: 'user', title: 'Customer', body: 'The customer of the chat you open appears here, with their orders.'}));
  if (!dati) return h('div', {className: 'chat-scheda'}, h('p', {className: 'chat-carica', role: 'status'}, 'Loading…'));
  const contatto = nomeContatto(identita);
  const canale = [etichettaCanale(identita.canale), identita.recapito].filter(Boolean).join(' · ');
  if (!clienteId) {
    return h('div', {className: 'chat-scheda'},
      h('div', {className: 'chat-scheda__testa'}, h(Avatar, {name: contatto, size: 'lg'}), h('b', null, contatto), h('small', null, canale)),
      h('p', {className: 'chat-scheda__nota'}, 'Not linked to a shop customer.'),
      h('p', {className: 'chat-aiuto'}, 'Link this chat to a shop customer to see their details and orders.'),
      h('button', {type: 'button', className: 'btn btn--primary', onClick: () => apriCollega(idConversazione, contatto)}, h(Icona, {name: 'user'}), 'Link to customer'));
  }
  const scheda = s.schede[clienteId];
  const scollega = async nome => {
    const si = await conferma({title: `Unlink ${nome}?`, body: "The chat stays, but it will not show this customer's details and orders.", ok: 'Unlink', danger: true});
    if (si) casella.collega(idConversazione, null);
  };
  if (!scheda?.caricato) return h('div', {className: 'chat-scheda'}, h('p', {className: 'chat-carica', role: 'status'}, 'Loading the customer…'));
  if (scheda.mancante) {
    return h('div', {className: 'chat-scheda'}, h(Vuoto, {icon: 'user', title: 'This customer no longer exists.'},
      h('button', {type: 'button', className: 'btn btn--sm', onClick: () => scollega('this customer')}, 'Unlink')));
  }
  if (!scheda.dati) {
    return h('div', {className: 'chat-scheda'}, h(Vuoto, {icon: 'alert', title: 'Customer not loaded', body: scheda.errore},
      h('button', {type: 'button', className: 'btn btn--sm', onClick: () => casella.cliente(clienteId)}, 'Try again')));
  }
  const {cliente, ordini = []} = scheda.dati;
  const nome = nomeCliente(cliente);
  const segni = [cliente.abituale && 'Regular', cliente.nuovo && 'New', cliente.rivenditore && 'Reseller', cliente.newsletter && 'Newsletter'].filter(Boolean);
  const adesso = Date.now();
  return h('div', {className: 'chat-scheda'},
    h('div', {className: 'chat-scheda__testa'}, h(Avatar, {name: nome, size: 'lg'}), h('b', null, nome),
      h('small', null, [cliente.citta, `via ${canale}`].filter(Boolean).join(' · ')),
      segni.length > 0 && h('span', {className: 'chips chat-scheda__segni'}, segni.map(x => h(Pill, {key: x, tone: 'accent', dot: false}, x)))),
    h('dl', {className: 'chat-scheda__numeri'},
      h('div', null, h('dt', null, 'Orders'), h('dd', null, cliente.ordini ?? 0)),
      h('div', null, h('dt', null, 'Spent'), h('dd', null, soldi(cliente.speso, 'eur'))),
      h('div', null, h('dt', null, 'Last order'), h('dd', null, cliente.ultimo_ordine ? quandoElenco(cliente.ultimo_ordine, adesso) : '—'))),
    (cliente.email || cliente.telefono) && h('p', {className: 'chat-scheda__contatti'},
      cliente.email && h('a', {href: `mailto:${cliente.email}`}, h(Icona, {name: 'mail', size: 'sm'}), cliente.email),
      cliente.telefono && h('a', {href: `tel:${cliente.telefono}`}, h(Icona, {name: 'phone', size: 'sm'}), cliente.telefono)),
    cliente.note && h(Fragment, null, h('div', {className: 'section-label'}, 'Note'), h('p', {className: 'chat-scheda__nota'}, cliente.note)),
    h('div', {className: 'section-label'}, 'Recent orders'),
    ordini.length ? h('ul', {className: 'chat-ordini'}, ordini.slice(0, 5).map(o => {
      const st = o.bozza ? {testo: 'Draft', tono: 'plain'} : statoOrdine(o.stato);
      return h('li', {key: o.id, className: 'chat-ordine'},
        h('span', {className: 'cell__text'}, h('b', null, o.numero != null ? `#${o.numero}` : 'Order'), h('small', null, quandoMessaggio(o.creato_il, adesso))),
        h(Pill, {tone: st.tono, dot: false}, st.testo),
        h('b', {className: 'chat-ordine__totale'}, soldi(o.totale, o.valuta)));
    })) : h('p', {className: 'chat-aiuto'}, 'No orders yet.'),
    h('button', {type: 'button', className: 'btn btn--sm chat-scheda__scollega', onClick: () => scollega(nome)}, 'Unlink'));
}

function apriCollega(idConversazione, contatto) {
  apriFinestra({title: 'Link to a customer', body: chiudi => h(CercaCliente, {idConversazione, contatto, chiudi})});
}

function CercaCliente({idConversazione, contatto, chiudi}) {
  const [q, cambiaQ] = useState(contatto === 'Customer' ? '' : contatto);
  const [esito, cambiaEsito] = useState({righe: [], errore: null, cerca: false});
  useEffect(() => {
    if (!q.trim()) { cambiaEsito({righe: [], errore: null, cerca: false}); return undefined; }
    let valida = true;
    cambiaEsito(e => ({...e, cerca: true}));
    const attesa = setTimeout(() => casella.cercaClienti(q).then(
      righe => valida && cambiaEsito({righe, errore: null, cerca: false}),
      errore => valida && cambiaEsito({righe: [], errore: testoErrore(errore), cerca: false})), 300);
    return () => { valida = false; clearTimeout(attesa); };
  }, [q]);
  const scegli = async cliente => {
    const nome = nomeCliente(cliente);
    const si = await conferma({
      title: 'Link this chat?',
      body: `Link ${contatto} to ${nome}${cliente.email ? ` (${cliente.email})` : ''}? The chat will show their details and orders. Check that it is the same person.`,
      ok: 'Link',
    });
    if (si && await casella.collega(idConversazione, cliente.id)) chiudi();
  };
  return h('div', {className: 'chat-cerca'},
    h(Ricerca, {value: q, onChange: v => cambiaQ(v.slice(0, 120)), placeholder: 'Name, email or phone'}),
    esito.errore && h('p', {className: 'chat-avviso', role: 'alert'}, esito.errore),
    esito.righe.length > 0 && h('ul', {className: 'chat-cerca__righe'}, esito.righe.map(c => h('li', {key: c.id},
      h('span', {className: 'cell'}, h(Avatar, {name: nomeCliente(c)}),
        h('span', {className: 'cell__text'}, h('b', null, nomeCliente(c)), h('small', null, [c.email, c.telefono, c.citta].filter(Boolean).join(' · ')))),
      h('button', {type: 'button', className: 'btn btn--sm', onClick: () => scegli(c)}, 'Link')))),
    !esito.cerca && q.trim() && !esito.righe.length && !esito.errore && h('p', {className: 'chat-aiuto'}, 'No customers match.'));
}

function apriRapide() {
  casella.caricaRapide();
  apriFinestra({title: 'Quick replies', sub: 'Short answers you insert above the reply box. They are never sent on their own.', body: () => h(GestisciRapide)});
}

function GestisciRapide() {
  const s = usaCasella();
  const vuoto = {id: null, titolo: '', testo: ''};
  const [modulo, cambiaModulo] = useState(vuoto);
  const [salva, cambiaSalva] = useState(false);
  const invia = async e => {
    e.preventDefault();
    cambiaSalva(true);
    const ok = await casella.salvaRapida(modulo);
    cambiaSalva(false);
    if (ok) cambiaModulo(vuoto);
  };
  const elimina = async r => {
    const si = await conferma({title: 'Delete this quick reply?', body: `«${r.titolo}» will no longer appear above the reply box.`, ok: 'Delete', danger: true});
    if (si) casella.eliminaRapida(r.id);
  };
  return h('div', {className: 'chat-rapide-gestione'},
    s.rapide.errore && h('p', {className: 'chat-avviso', role: 'alert'}, s.rapide.errore),
    s.rapide.righe.length ? h('ul', {className: 'chat-rapide-elenco'}, s.rapide.righe.map(r => h('li', {key: r.id},
      h('span', {className: 'cell__text'}, h('b', null, r.titolo), h('small', null, r.testo)),
      h('span', {className: 'chat-rapide-elenco__azioni'},
        h('button', {type: 'button', className: 'btn btn--sm', onClick: () => cambiaModulo({id: r.id, titolo: r.titolo, testo: r.testo})}, 'Edit'),
        h('button', {type: 'button', className: 'btn btn--sm', onClick: () => elimina(r)}, 'Delete')))))
      : h('p', {className: 'chat-aiuto'}, 'No quick replies yet.'),
    h('form', {className: 'chat-rapide-modulo', onSubmit: invia},
      h('label', {className: 'field'}, h('span', null, modulo.id ? 'Title (editing)' : 'Title'),
        h('input', {className: 'input chat-input', value: modulo.titolo, maxLength: 60, required: true, onChange: e => cambiaModulo({...modulo, titolo: e.target.value})})),
      h('label', {className: 'field'}, h('span', null, 'Text'),
        h('textarea', {className: 'textarea chat-rapide-modulo__testo', value: modulo.testo, maxLength: 1000, required: true, rows: 3, onChange: e => cambiaModulo({...modulo, testo: e.target.value})})),
      h('div', {className: 'chat-rapide-modulo__piede'},
        modulo.id && h('button', {type: 'button', className: 'btn', onClick: () => cambiaModulo(vuoto)}, 'Cancel'),
        h('button', {type: 'submit', className: 'btn btn--primary', disabled: salva}, modulo.id ? 'Save' : 'Add'))));
}

export default function Chats(props) {
  return h(PaginaChats, props);
}
