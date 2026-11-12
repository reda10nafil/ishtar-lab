// Dati del negozio fittizio: contatti, spedizioni, vetrina, pagine e traffico. Testi nuovi, in inglese britannico.
export const NEGOZIO = {
  nome: 'Ishtar Lab',
  email: 'hello@ishtarlab.test',
  telefono: '+39 02 5550 0142',
  indirizzo: 'Via delle Filande 18, 20144 Milano, Italy',
  partita_iva: 'IT09990001234',
  obiettivo_giornaliero: 900,
};

export const SPEDIZIONI = {
  giorni_max_evasione: 3,
  soglia_gratuita: 150,
  nomi: { Standard: 'Tracked Standard · 3–5 days', Express: 'Priority Courier · 1–2 days' },
};

export const CORRIERI = ['Corriere Rapido', 'Nordlink Parcel', 'EuroPost Tracked'];

export const VETRINA = {
  testata: 'Ishtar Lab',
  annuncio: 'Free delivery on orders over 150 EUR · 30-day returns',
  accento: 'sabbia',
  messaggio: 'Footwear and accessories chosen in Milano, shipped across Europe.',
};

export const PAGINE = [
  { titolo: 'About Ishtar Lab', percorso: '/about', testo: 'Ishtar Lab began as a small Milano studio that wanted fewer, better shoes. We work with independent makers across Europe and keep every pair in stock with the people who made it.', visibile: true },
  { titolo: 'Size guide', percorso: '/size-guide', testo: 'Our sandals run true to size. Clogs have a roomy toe box, so choose a size down if you are between two. Measure your foot in the evening, when it is at its longest.', visibile: true },
  { titolo: 'Delivery and returns', percorso: '/delivery-returns', testo: 'Orders leave the maker within three working days. Tracked delivery takes three to five days and free returns are open for thirty days from delivery.', visibile: true },
  { titolo: 'Caring for your shoes', percorso: '/care-guide', testo: 'Let leather rest for a day between wears. Brush suede dry, and keep cork soles away from direct heat. A little care keeps a good pair going for years.', visibile: true },
  { titolo: 'Find a stockist', percorso: '/find-a-stockist', testo: 'See the pieces in person at our partner boutiques in Italy, France, Germany, Spain, Denmark and Sweden.', visibile: true },
  { titolo: 'Winter journal', percorso: '/winter-journal', testo: 'Notes from the studio on the coming winter capsule. Draft, not yet in the menu.', visibile: false },
];

export const FONTI_TRAFFICO = [
  ['Instagram', 0.31],
  ['Google search', 0.29],
  ['Newsletter', 0.15],
  ['Direct', 0.13],
  ['TikTok', 0.07],
  ['Referrals', 0.05],
];

export const PAGINE_TRAFFICO = [
  ['Home', '/', 1],
  ['New in', '/new-in', 0.58],
  ['Sandals', '/sandals', 0.41],
  ['Size guide', '/size-guide', 0.12],
];

/** Chi è sul sito adesso, per città: la pagina Online shop li somma. */
export const VISITATORI_PER_CITTA = [
  ['Milano', 7],
  ['Paris', 4],
  ['Berlin', 3],
  ['Madrid', 2],
  ['London', 2],
];

export const VISTE_PAGINE = { '/': 12840, '/about': 1160, '/size-guide': 1640, '/delivery-returns': 930, '/care-guide': 410, '/find-a-stockist': 620, '/winter-journal': 0 };
