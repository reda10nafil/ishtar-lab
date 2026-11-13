// Controllo della casella della pagina Chats: stato, letture dal ponte, risposte in attesa, «letta».
// Senza DOM: richieste e ambiente (orologio, pagina visibile, conversazione sullo schermo, avvisi) arrivano da fuori,
// così le regole si provano in verifiche/chat-controllo.test.mjs.
//
// Regole che proteggono il cliente e il team:
// - una risposta ha un solo id per tutti i suoi tentativi: il server non la manda mai due volte;
// - una risposta di cui non si conosce l'esito resta visibile («Not sent yet») finché il server non mostra la sua riga;
// - una lettura vecchia del server non sovrascrive una più nuova né la conversazione aperta dopo;
// - «letta» parte solo con la pagina visibile, in primo piano e sulla conversazione, fino all'ultimo messaggio mostrato.
import {percorsoElenco, testoErrore, ultimoVisto} from './casella.mjs';

const RIGHE = 50, MASSIMO_RIGHE = 200;
const CONTEGGI_VUOTI = {aperte: 0, chiuse: 0, non_lette: 0};

export function creaCasella({richiesta, ambiente, nuovoId}) {
  let stato = {
    elenco: {righe: [], conteggi: CONTEGGI_VUOTI, totale: 0, filtri: {stato: 'aperte', canale: '', q: ''}, quante: RIGHE, caricato: false, errore: null},
    aperta: {id: null, dati: null, errore: null, caricato: false, mancante: false},
    inSospeso: [],
    schede: {},
    rapide: {righe: [], caricate: false, errore: null},
  };
  const iscritti = new Set();
  const bozze = new Map();
  // Numero dell'ultima lettura partita per tipo: si applica solo quella (le altre sono superate).
  const turno = {elenco: 0, conteggi: 0, dettaglio: 0, schede: {}};
  const letteInCorso = new Set();

  const cambia = parti => {
    stato = {...stato, ...parti};
    for (const avvisa of iscritti) avvisa();
  };
  const cambiaElenco = parti => cambia({elenco: {...stato.elenco, ...parti}});
  const cambiaAperta = parti => cambia({aperta: {...stato.aperta, ...parti}});
  const cambiaDati = parti => stato.aperta.dati && cambiaAperta({dati: {...stato.aperta.dati, ...parti}});
  const cambiaRiga = (id, parti) => {
    if (stato.elenco.righe.some(r => r.id === id)) cambiaElenco({righe: stato.elenco.righe.map(r => (r.id === id ? {...r, ...parti} : r))});
  };
  const segna = (id_client, parti) => cambia({inSospeso: stato.inSospeso.map(r => (r.id_client === id_client ? {...r, ...parti} : r))});
  const togli = id_client => cambia({inSospeso: stato.inSospeso.filter(r => r.id_client !== id_client)});
  const indirizzo = (id, parte = '') => `/api/conversazioni/${encodeURIComponent(id)}${parte}`;
  const ultimoDi = id => (stato.aperta.id === id ? ultimoVisto(stato.aperta.dati?.messaggi) : null);
  const nomeDi = id => stato.elenco.righe.find(r => r.id === id)?.nome ?? (stato.aperta.id === id ? stato.aperta.dati?.identita?.nome : null);

  async function leggiElenco() {
    const n = ++turno.elenco;
    const {filtri, quante} = stato.elenco;
    try {
      const dati = await richiesta(percorsoElenco({...filtri, quante}));
      if (n === turno.elenco) cambiaElenco({righe: dati.conversazioni ?? [], conteggi: dati.conteggi ?? CONTEGGI_VUOTI, totale: dati.totale ?? 0, caricato: true, errore: null});
      return true;
    } catch (errore) {
      if (n !== turno.elenco) return true;
      cambiaElenco({errore: testoErrore(errore)});
      return false;
    }
  }

  // Solo i conteggi (badge del menu dalle altre pagine): le righe restano quelle dei filtri della pagina.
  async function leggiConteggi() {
    const n = ++turno.conteggi;
    try {
      const dati = await richiesta(percorsoElenco({stato: 'aperte', quante: 1}));
      if (n === turno.conteggi && dati.conteggi) cambiaElenco({conteggi: dati.conteggi});
      return true;
    } catch {
      return false;
    }
  }

  async function leggiDettaglio(id) {
    const n = ++turno.dettaglio;
    try {
      const dati = await richiesta(indirizzo(id));
      if (n !== turno.dettaglio || stato.aperta.id !== id) return true;
      applicaDettaglio(id, dati);
      return true;
    } catch (errore) {
      if (n !== turno.dettaglio || stato.aperta.id !== id) return true;
      if (errore.stato === 404) {
        cambiaAperta({dati: null, errore: null, caricato: true, mancante: true});
        return true;
      }
      cambiaAperta({errore: testoErrore(errore), caricato: true});
      return false;
    }
  }

  function applicaDettaglio(id, dati) {
    const sulServer = new Set((dati.messaggi ?? []).map(m => m.id_client).filter(Boolean));
    // Una risposta in attesa che il server ha già si toglie (la sua riga vale di più); quella in invio resta fino all'esito.
    const inSospeso = stato.inSospeso.filter(r => r.fase === 'invio' || !sulServer.has(r.id_client));
    cambia({aperta: {id, dati, errore: null, caricato: true, mancante: false}, inSospeso});
    cambiaRiga(id, dati.conversazione);
    segnaLetta();
  }

  async function segnaLetta() {
    const {id, dati} = stato.aperta;
    if (!id || !dati || !(dati.conversazione?.non_letti > 0)) return;
    if (!ambiente.visibile() || !ambiente.inPrimoPiano() || ambiente.vista().id !== id) return;
    const ultimo = ultimoVisto(dati.messaggi);
    const chiave = `${id} ${ultimo}`;
    if (letteInCorso.has(chiave)) return;
    letteInCorso.add(chiave);
    try {
      await richiesta(indirizzo(id, '/letta'), {metodo: 'POST', corpo: {ultimo_visto: ultimo}});
      // I messaggi arrivati dopo l'ultimo mostrato restano non letti sul server: qui si azzera solo se è ancora l'ultimo.
      if (stato.aperta.id === id && ultimoVisto(stato.aperta.dati?.messaggi) === ultimo) {
        cambiaDati({conversazione: {...stato.aperta.dati.conversazione, non_letti: 0}});
      }
      const riga = stato.elenco.righe.find(r => r.id === id);
      const conteggi = stato.elenco.conteggi;
      cambiaElenco({conteggi: {...conteggi, non_lette: Math.max(0, conteggi.non_lette - (dati.conversazione.non_letti > 0 ? 1 : 0))}});
      if (riga) cambiaRiga(id, {non_letti: 0});
    } catch {
      // Si riprova al prossimo dettaglio letto.
    } finally {
      letteInCorso.delete(chiave);
    }
  }

  /** Una lettura per ogni parte richiesta. Non lancia mai: false se una lettura non è riuscita (attesa crescente). */
  async function aggiorna({elenco = false, dettaglio = false, conteggi = false} = {}) {
    const letture = [];
    if (elenco) letture.push(leggiElenco());
    else if (conteggi) letture.push(leggiConteggi());
    if (dettaglio && stato.aperta.id) letture.push(leggiDettaglio(stato.aperta.id));
    return (await Promise.all(letture)).every(Boolean);
  }

  function apri(id) {
    const nuovo = id || null;
    if (nuovo === stato.aperta.id) return;
    turno.dettaglio++;
    cambia({aperta: {id: nuovo, dati: null, errore: null, caricato: false, mancante: false}});
    if (nuovo) leggiDettaglio(nuovo);
  }

  function filtra(nuovi) {
    const filtri = {...stato.elenco.filtri, ...nuovi};
    const prima = stato.elenco.filtri;
    if (filtri.stato === prima.stato && filtri.canale === prima.canale && filtri.q === prima.q) return;
    // Cambiando scheda (aperte/chiuse) le righe vecchie non restano sotto il titolo nuovo.
    cambiaElenco({filtri, quante: RIGHE, ...(filtri.stato !== prima.stato ? {righe: [], caricato: false, totale: 0} : {})});
    leggiElenco();
  }

  function altre() {
    const quante = Math.min(MASSIMO_RIGHE, stato.elenco.quante + RIGHE);
    if (quante === stato.elenco.quante) return;
    cambiaElenco({quante});
    leggiElenco();
  }

  async function invia(voce) {
    const {id_client, conversazione_id, testo} = voce;
    segna(id_client, {fase: 'invio', errore: null});
    let messaggio;
    try {
      ({messaggio} = await richiesta(indirizzo(conversazione_id, '/messaggi'), {
        metodo: 'POST', corpo: {testo, id: id_client, ultimo_visto: ultimoDi(conversazione_id)},
      }));
    } catch (errore) {
      // Rete, ponte, API o lucchetto: l'esito non si conosce, si ritenta solo con lo stesso id. Altri rifiuti: da correggere.
      const ignoto = errore.stato === 0 || errore.stato === 409 || errore.stato >= 500;
      segna(id_client, {fase: ignoto ? 'attesa' : 'rifiutato', errore: testoErrore(errore)});
      if (stato.aperta.id !== conversazione_id) avvisaFuori(conversazione_id, testoErrore(errore));
      return;
    }
    // Le letture partite prima di questo esito non lo contengono: si scartano.
    turno.dettaglio++;
    turno.elenco++;
    togli(id_client);
    if (stato.aperta.id === conversazione_id && stato.aperta.dati && messaggio) {
      const messaggi = stato.aperta.dati.messaggi;
      const posto = messaggi.findIndex(m => m.id === messaggio.id);
      cambiaDati({messaggi: posto < 0 ? [...messaggi, messaggio] : messaggi.map((m, i) => (i === posto ? messaggio : m))});
    }
    if (stato.aperta.id !== conversazione_id && ['fallito', 'incerto'].includes(messaggio?.stato_consegna)) {
      avvisaFuori(conversazione_id, messaggio.errore || 'Not confirmed');
    }
    aggiorna({elenco: true, dettaglio: true});
  }

  function avvisaFuori(conversazione_id, motivo) {
    const nome = nomeDi(conversazione_id);
    ambiente.avviso(`Your reply${nome ? ` to ${nome}` : ''} was not sent: ${motivo}`, {warn: true});
  }

  async function rispondi(conversazione_id, testo) {
    const pulito = String(testo ?? '').trim();
    if (!pulito) return;
    const voce = {id_client: nuovoId(), conversazione_id, testo: pulito, fase: 'invio', errore: null, quando: ambiente.adesso()};
    bozze.delete(conversazione_id);
    cambia({inSospeso: [...stato.inSospeso, voce]});
    await invia(voce);
  }

  /** Nuovo tentativo con lo stesso id e lo stesso testo (risposta in attesa o riga del server non partita). */
  async function riprova({id_client, testo, conversazione_id}) {
    if (!id_client || !testo) return;
    const voce = stato.inSospeso.find(r => r.id_client === id_client);
    if (voce?.fase === 'invio') return;
    if (!voce) cambia({inSospeso: [...stato.inSospeso, {id_client, conversazione_id, testo, fase: 'invio', errore: null, quando: ambiente.adesso()}]});
    await invia(voce ?? {id_client, conversazione_id, testo});
  }

  /** Stessa risposta come risposta nuova (id nuovo): solo dopo la conferma della persona, per le risposte incerte. */
  const rimanda = ({testo, conversazione_id}) => rispondi(conversazione_id, testo);

  function scarta(id_client) {
    const voce = stato.inSospeso.find(r => r.id_client === id_client);
    if (!voce || voce.fase === 'invio') return undefined;
    togli(id_client);
    return voce.testo;
  }

  const inAttesa = () => stato.inSospeso.some(r => r.fase !== 'invio');

  function bozza(conversazione_id, testo) {
    if (testo === undefined) return bozze.get(conversazione_id) ?? '';
    if (testo) bozze.set(conversazione_id, testo);
    else bozze.delete(conversazione_id);
    return testo;
  }

  async function cambiaStato(id, nuovo) {
    const corpo = nuovo === 'chiusa' ? {stato: nuovo, ultimo_visto: ultimoDi(id)} : {stato: nuovo};
    try {
      const {conversazione} = await richiesta(indirizzo(id, '/stato'), {metodo: 'POST', corpo});
      turno.dettaglio++;
      turno.elenco++;
      if (stato.aperta.id === id && conversazione) cambiaDati({conversazione});
      aggiorna({elenco: true, dettaglio: true});
      return true;
    } catch (errore) {
      ambiente.avviso(testoErrore(errore), {warn: true});
      // 412: il cliente ha scritto dopo l'ultimo messaggio mostrato; si rilegge per mostrarlo.
      if (errore.stato === 412) aggiorna({elenco: true, dettaglio: true});
      return false;
    }
  }

  async function collega(id, cliente_id) {
    try {
      const {identita} = await richiesta(indirizzo(id, '/cliente'), {metodo: 'POST', corpo: {cliente_id}});
      turno.dettaglio++;
      if (stato.aperta.id === id && identita) cambiaDati({identita});
      cambiaRiga(id, {cliente_id});
      if (cliente_id) cliente(cliente_id);
      return true;
    } catch (errore) {
      ambiente.avviso(testoErrore(errore), {warn: true});
      return false;
    }
  }

  async function cliente(id) {
    if (!id) return;
    const n = (turno.schede[id] ?? 0) + 1;
    turno.schede[id] = n;
    const cambiaScheda = parti => cambia({schede: {...stato.schede, [id]: {...(stato.schede[id] ?? {dati: null}), ...parti}}});
    try {
      const dati = await richiesta(`/api/clienti/${encodeURIComponent(id)}`);
      if (turno.schede[id] === n) cambiaScheda({dati, errore: null, caricato: true, mancante: false});
    } catch (errore) {
      if (turno.schede[id] !== n) return;
      cambiaScheda(errore.stato === 404 ? {dati: null, errore: null, caricato: true, mancante: true} : {errore: testoErrore(errore), caricato: true});
    }
  }

  async function cercaClienti(q) {
    const dati = await richiesta(`/api/clienti?${new URLSearchParams({q: String(q ?? '').trim(), limit: '8'})}`);
    return dati.clienti ?? [];
  }

  async function caricaRapide() {
    try {
      const dati = await richiesta('/api/risposte-rapide');
      cambia({rapide: {righe: dati.risposte ?? [], caricate: true, errore: null}});
      return true;
    } catch (errore) {
      cambia({rapide: {...stato.rapide, caricate: true, errore: testoErrore(errore)}});
      return false;
    }
  }

  async function salvaRapida({id, titolo, testo}) {
    try {
      await richiesta(id ? `/api/risposte-rapide/${encodeURIComponent(id)}` : '/api/risposte-rapide', {metodo: 'POST', corpo: {titolo, testo}});
    } catch (errore) {
      ambiente.avviso(testoErrore(errore), {warn: true});
      return false;
    }
    await caricaRapide();
    return true;
  }

  async function eliminaRapida(id) {
    try {
      await richiesta(`/api/risposte-rapide/${encodeURIComponent(id)}`, {metodo: 'DELETE'});
    } catch (errore) {
      ambiente.avviso(testoErrore(errore), {warn: true});
      return false;
    }
    await caricaRapide();
    return true;
  }

  return {
    iscrivi(funzione) {
      iscritti.add(funzione);
      return () => iscritti.delete(funzione);
    },
    istantanea: () => stato,
    aggiorna, segnaLetta, apri, filtra, altre,
    rispondi, riprova, rimanda, scarta, inAttesa, bozza,
    cambiaStato, collega, cliente, cercaClienti,
    caricaRapide, salvaRapida, eliminaRapida,
  };
}
