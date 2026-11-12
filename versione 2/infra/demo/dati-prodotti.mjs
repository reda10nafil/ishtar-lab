// Scheda dei prodotti esistenti, per handle. Si riempiono solo questi dodici: gli altri sono residui delle prove.
const CURA_PELLE = 'Wipe with a soft dry cloth. Treat the leather with neutral cream every few months and let it rest for a day between wears.';
const CURA_SUGHERO = 'Keep away from direct heat. Reseal the cork once a season and clean the footbed with a barely damp cloth.';
const CURA_GOMMA = 'Rinse with cool water and leave to dry in the shade. Mild soap only, no bleach.';
const CURA_TELA = 'Brush off dry dirt, then spot clean with mild soap. Stuff with paper and air dry away from radiators.';

export const PRODOTTI = [
  { handle: 'meridian-twin-strap-buckle-sandal', brand: 'Meridian', stagione: 'SS26', genere: 'Unisex', composizione: 'Upper 100% leather; footbed cork and latex; sole EVA', cura: CURA_SUGHERO, peso: 520, categoria: 'slides', collezione: 'riviera-days', cessione: 0.54, seo_titolo: 'Twin-strap buckle sandal in black leather', seo_descrizione: 'A contoured cork footbed and two adjustable buckles. Regular fit, made to mould to your foot over time.', popolarita: 9 },
  { handle: 'meridian-twin-strap-sandal', brand: 'Meridian', stagione: 'SS26', genere: 'Women', composizione: 'Upper synthetic nubuck; footbed cork and latex; sole EVA', cura: CURA_SUGHERO, peso: 460, categoria: 'slides', collezione: 'riviera-days', cessione: 0.52, seo_titolo: 'Twin-strap sandal in pearl white', seo_descrizione: 'Pearl white straps on a shaped cork footbed, cut narrow for a neat summer line.', popolarita: 7 },
  { handle: 'meridian-clog-slide', brand: 'Meridian', stagione: 'AW26', genere: 'Unisex', composizione: 'Upper 100% suede; footbed cork and latex; sole EVA', cura: CURA_SUGHERO, peso: 610, categoria: 'clogs', collezione: 'studio-clogs', cessione: 0.55, seo_titolo: 'Suede clog slide in anthracite', seo_descrizione: 'Closed-toe comfort with an easy backless fit. Soft anthracite suede for the colder months.', popolarita: 10 },
  { handle: 'cloudpeak-golden-slide', brand: 'Cloudpeak', stagione: 'SS26', genere: 'Women', composizione: 'Upper 70% recycled polyester, 30% cotton; sole recycled rubber', cura: CURA_GOMMA, peso: 380, categoria: 'slides', collezione: 'golden-hour', cessione: 0.5, seo_titolo: 'Golden slide in dark sand', seo_descrizione: 'A plush strap on a cushioned sole, finished in warm dark sand with a soft metallic edge.', popolarita: 6 },
  { handle: 'meridian-wire-buckle-clog', brand: 'Meridian', stagione: 'AW26', genere: 'Men', composizione: 'Upper 100% oiled leather; footbed cork; sole EVA', cura: CURA_PELLE, peso: 690, categoria: 'clogs', collezione: 'studio-clogs', cessione: 0.56, seo_titolo: 'Wire buckle clog in vintage roast', seo_descrizione: 'Oiled leather in a deep roasted brown, held by a slim wire buckle that ages with you.', popolarita: 5 },
  { handle: 'apex-pool-slides', brand: 'Apex', stagione: 'SS26', genere: 'Unisex', composizione: '100% moulded EVA', cura: CURA_GOMMA, peso: 290, categoria: 'slides', collezione: 'pool-club', cessione: 0.48, seo_titolo: 'Moulded pool slides in black', seo_descrizione: 'One-piece slides that dry in minutes. Light enough for the bag, tough enough for the deck.', popolarita: 8 },
  { handle: 'vantage-204-runner', brand: 'Vantage', stagione: 'AW26', genere: 'Unisex', composizione: 'Upper suede and mesh; lining textile; sole rubber', cura: CURA_TELA, peso: 740, categoria: 'running', collezione: 'city-walk', cessione: 0.57, seo_titolo: 'Vantage 204 runner in beige brown', seo_descrizione: 'A retro running shape in layered suede and mesh, with a cushioned sole for all-day walking.', popolarita: 10 },
  { handle: 'nimbus-classic-clog', brand: 'Nimbus', stagione: 'SS26', genere: 'Unisex', composizione: '100% foam resin', cura: CURA_GOMMA, peso: 340, categoria: 'clogs', collezione: 'pool-club', cessione: 0.49, seo_titolo: 'Classic foam clog in pond green', seo_descrizione: 'Feather-light foam with a pivoting heel strap, in a calm pond green that goes with everything.', popolarita: 6 },
  { handle: 'cloudpeak-starlet-sandal', brand: 'Cloudpeak', stagione: 'SS26', genere: 'Women', composizione: 'Upper 80% recycled polyester, 20% elastane; sole recycled rubber', cura: CURA_GOMMA, peso: 330, categoria: 'flip-flops', collezione: 'golden-hour', cessione: 0.5, seo_titolo: 'Starlet sandal in sand', seo_descrizione: 'A padded thong sandal with a soft woven strap, in an easy sand tone for long summer days.', popolarita: 4 },
  { handle: 'cityline-canvas-high-top', brand: 'Cityline', stagione: 'AW26', genere: 'Unisex', composizione: 'Upper denim canvas; lining cotton; sole vulcanised rubber', cura: CURA_TELA, peso: 820, categoria: 'high-top', collezione: 'city-walk', cessione: 0.53, seo_titolo: 'Canvas high top in black denim', seo_descrizione: 'Black denim canvas on a vulcanised sole. A straight-up city classic that softens with wear.', popolarita: 9 },
  { handle: 'cloudpeak-golden-sandal', brand: 'Cloudpeak', stagione: 'SS26', genere: 'Women', composizione: 'Upper 75% recycled polyester, 25% cotton; sole recycled rubber', cura: CURA_GOMMA, peso: 350, categoria: 'flip-flops', collezione: 'after-dark', cessione: 0.5, seo_titolo: 'Golden sandal in bay fog', seo_descrizione: 'Cool bay-fog straps and a slim sole, an easy step up from the beach to dinner.', popolarita: 3 },
  { handle: 'strive-mule-slides', brand: 'Strive', stagione: 'AW26', genere: 'Men', composizione: 'Upper recycled knit; sole EVA and gum rubber', cura: CURA_TELA, peso: 430, categoria: 'slides', collezione: 'after-dark', cessione: 0.51, seo_titolo: 'Mule slides in core black with gum sole', seo_descrizione: 'A knitted mule on a gum outsole, made for quick errands and long evenings at home.', popolarita: 5 },
];

export const COLLEZIONI = [
  { chiave: 'riviera-days', titolo: 'Riviera Days', descrizione: 'Buckled sandals for long lunches by the sea.', visibile: true },
  { chiave: 'pool-club', titolo: 'Pool Club', descrizione: 'Light, quick-drying pairs for the deck and the beach bag.', visibile: true },
  { chiave: 'golden-hour', titolo: 'Golden Hour', descrizione: 'Soft sand and metallic tones for the end of the day.', visibile: true },
  { chiave: 'city-walk', titolo: 'City Walk', descrizione: 'Runners and high tops that handle a full day on foot.', visibile: true },
  { chiave: 'studio-clogs', titolo: 'Studio Clogs', descrizione: 'Closed-toe comfort for cold floors and long shifts.', visibile: true },
  { chiave: 'after-dark', titolo: 'After Dark', descrizione: 'Pre-season preview, hidden from the shop until the launch.', visibile: false },
];

/** Codice a 13 cifre con prefisso interno 299 e cifra di controllo vera: non identifica merce reale. */
export function eanDi(prodotto, variante) {
  const corpo = `299${String(prodotto + 1).padStart(4, '0')}${String(variante + 1).padStart(5, '0')}`;
  const somma = [...corpo].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return `${corpo}${(10 - (somma % 10)) % 10}`;
}
