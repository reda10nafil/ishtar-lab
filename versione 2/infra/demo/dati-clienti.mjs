// Sessanta clienti fittizi con email @example.test. Tutto deriva da un seme fisso: ripartendo restano gli stessi.
import { casuale } from './comune.mjs';

const PAESI = {
  it: {
    prefisso: '+39 347 555',
    citta: [['Milano', '20121'], ['Roma', '00184'], ['Torino', '10123'], ['Bologna', '40124'], ['Firenze', '50122'], ['Napoli', '80133'], ['Genova', '16121'], ['Verona', '37121']],
    vie: ['Via dei Tessitori', 'Corso delle Rose', 'Via del Lino', 'Viale dei Tigli', 'Via San Calimero'],
    nomi: ['Giulia Marchetti', 'Matteo Rinaldi', 'Chiara Fontana', 'Alessio Bruno', 'Francesca De Luca', 'Davide Moretti', 'Sara Colombo', 'Lorenzo Gatti', 'Elena Barbieri', 'Tommaso Ferri', 'Martina Galli', 'Niccolò Serra', 'Beatrice Villa', 'Federico Pellegrini', 'Aurora Testa', 'Gabriele Caruso', 'Ginevra Riva', 'Simone Longo', 'Alice Monti', 'Riccardo Sala', 'Bianca Neri', 'Pietro Amato'],
  },
  fr: {
    prefisso: '+33 6 55 50',
    citta: [['Paris', '75011'], ['Lyon', '69002'], ['Marseille', '13006'], ['Bordeaux', '33000'], ['Nantes', '44000']],
    vie: ['Rue des Lilas', 'Rue du Moulin', 'Avenue des Platanes'],
    nomi: ['Camille Durand', 'Hugo Lefèvre', 'Léa Moreau', 'Antoine Girard', 'Manon Faure', 'Louis Perrin', 'Inès Roussel', 'Théo Blanchard'],
  },
  de: {
    prefisso: '+49 151 5550',
    citta: [['Berlin', '10435'], ['Hamburg', '20357'], ['München', '80331'], ['Köln', '50667'], ['Leipzig', '04109']],
    vie: ['Lindenstraße', 'Rosenweg', 'Am Stadtgarten'],
    nomi: ['Lena Hoffmann', 'Jonas Keller', 'Hannah Vogel', 'Felix Brandt', 'Clara Neumann', 'Paul Lorenz', 'Emilia Krause'],
  },
  es: {
    prefisso: '+34 655 50',
    citta: [['Madrid', '28004'], ['Barcelona', '08012'], ['Valencia', '46002'], ['Sevilla', '41001']],
    vie: ['Calle del Olmo', 'Carrer de les Flors', 'Avenida de la Luz'],
    nomi: ['Carmen Ortega', 'Diego Navarro', 'Paula Iglesias', 'Javier Molina', 'Marta Delgado', 'Álvaro Cano'],
  },
  gb: {
    prefisso: '+44 7700 900',
    citta: [['London', 'E8 3PN'], ['Bristol', 'BS1 5TR'], ['Manchester', 'M4 1HN'], ['Edinburgh', 'EH1 2NG']],
    vie: ['Mill Lane', 'Orchard Row', 'Queens Terrace'],
    nomi: ['Imogen Clarke', 'Oliver Whitfield', 'Poppy Harrington', 'Jack Thornton', 'Florence Mallory'],
  },
  dk: { prefisso: '+45 55 50', citta: [['København', '2200'], ['Aarhus', '8000']], vie: ['Nørrebrogade', 'Havnevej'], nomi: ['Freja Nielsen', 'Magnus Holm'] },
  se: { prefisso: '+46 70 555', citta: [['Stockholm', '11827'], ['Malmö', '21145']], vie: ['Storgatan', 'Lindvägen'], nomi: ['Elsa Lindqvist', 'Oskar Berg'] },
};

/** Clienti all'ingrosso: stessa email del rivenditore, così gli ordini arrivano alla sua scheda. */
const RIVENDITORI = [
  ['Noemi Sartori', 'Bottega Lumen', 'it', 'Bologna', '40125', 'Via Saragozza 41', 'buying@bottegalumen.example.test'],
  ['Elio Bassani', 'Casa Verbena', 'it', 'Torino', '10122', 'Via della Consolata 9', 'orders@casaverbena.example.test'],
  ['Solène Arnaud', 'Atelier Solène', 'fr', 'Bordeaux', '33000', 'Rue Sainte-Colombe 14', 'solene@ateliersolene.example.test'],
  ['Margaux Vidal', 'Maison Alizé', 'fr', 'Lyon', '69001', 'Rue Burdeau 22', 'achats@maisonalize.example.test'],
  ['Greta Paulsen', 'Nord & Sand', 'dk', 'København', '1160', 'Gammel Mønt 7', 'greta@nordsand.example.test'],
  ['Katrin Weber', 'Fräulein Kiosk', 'de', 'Hamburg', '20357', 'Schanzenstraße 31', 'einkauf@fraeuleinkiosk.example.test'],
  ['Rocío Campos', 'Calle Mayor 12', 'es', 'Sevilla', '41003', 'Calle Mayor 12', 'rocio@callemayor12.example.test'],
  ['Astrid Falk', 'Linnea Butik', 'se', 'Göteborg', '41128', 'Haga Nygata 18', 'astrid@linneabutik.example.test'],
];

const NOTE = [
  'Prefers half sizes; check stock before confirming.',
  'Asked for no paper invoice in the parcel.',
  'Buys gifts in December, wrap by default.',
  'Regular at the Milano pop-up.',
  'Allergic to nickel: avoid metal buckles.',
  'Happy to be contacted about early drops.',
  'Exchanged a pair last season without any fuss.',
  'Stylist, often orders two sizes for shoots.',
];

const ETICHETTE = ['VIP', 'Gift buyer', 'Early access', 'Press', 'Size 38', 'Size 43', 'Local'];

const ascii = (testo) => testo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

export function creaClienti() {
  const rng = casuale(4217);
  const clienti = [];
  for (const [paese, dati] of Object.entries(PAESI)) {
    for (const nome of dati.nomi) {
      const [primo, ...resto] = nome.split(' ');
      const [citta, cap] = rng.scegli(dati.citta);
      const iscritto = rng.prossimo() < 0.68;
      const conNota = rng.prossimo() < 0.26;
      const etichette = rng.prossimo() < 0.4 ? [rng.scegli(ETICHETTE)] : [];
      clienti.push({
        email: `${ascii(nome)}@example.test`,
        nome: primo,
        cognome: resto.join(' '),
        telefono: `${dati.prefisso} ${rng.intero(1000, 9899)}`,
        paese,
        citta,
        cap,
        via: `${rng.scegli(dati.vie)} ${rng.intero(2, 148)}`,
        newsletter: iscritto,
        giorni_iscrizione: rng.intero(3, 340),
        nota: conNota ? rng.scegli(NOTE) : null,
        etichette,
        azienda: null,
        rivenditore: false,
      });
    }
  }
  for (const [nome, azienda, paese, citta, cap, via, email] of RIVENDITORI) {
    const [primo, ...resto] = nome.split(' ');
    clienti.push({
      email,
      nome: primo,
      cognome: resto.join(' '),
      telefono: `${PAESI[paese].prefisso} ${rng.intero(1000, 9899)}`,
      paese,
      citta,
      cap,
      via,
      newsletter: false,
      giorni_iscrizione: 0,
      nota: 'Trade account: invoices go to the buying address.',
      etichette: ['Trade'],
      azienda,
      rivenditore: true,
    });
  }
  return clienti;
}

export const GRUPPI = [
  { chiave: 'vip', nome: 'VIP Circle', scelta: (c, i) => !c.rivenditore && i % 6 === 0 },
  { chiave: 'insider', nome: 'Newsletter Insiders', scelta: (c) => c.newsletter },
  { chiave: 'trade', nome: 'Trade Accounts', scelta: (c) => c.rivenditore },
  { chiave: 'stylist', nome: 'Press & Stylists', scelta: (c, i) => !c.rivenditore && i % 13 === 4 },
  { chiave: 'amici', nome: 'Friends of the Studio', scelta: (c, i) => !c.rivenditore && i % 9 === 2 },
];
