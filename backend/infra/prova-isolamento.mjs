// Prova reale: un'azienda non deve poter leggere o modificare i dati di un'altra.
// Usa le aziende dimostrative del seed, solo in ambiente locale.
const API = process.env.API_URL || 'http://127.0.0.1:9273';
const PASSWORD = process.env.SELLER_PASSWORD || 'supersecret';

async function call(path, session, init = {}) {
  const headers = { 'content-type': 'application/json', ...init.headers };
  if (session?.token) headers.authorization = `Bearer ${session.token}`;
  if (session?.seller) headers['x-seller-id'] = session.seller;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function login(email) {
  const auth = await call('/auth/member/emailpass', null, { method: 'POST', body: JSON.stringify({ email, password: PASSWORD }) });
  if (!auth.body.token) throw new Error(`login ${email}: ${auth.status}`);
  const session = { token: auth.body.token };
  const sellers = await call('/vendor/sellers', session);
  const member = sellers.body.seller_members?.[0];
  if (!member) throw new Error(`${email}: nessuna azienda (${sellers.status})`);
  return { ...session, seller: member.seller_id, name: member.seller.name };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK' : 'KO'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const denied = (r) => r.status === 401 || r.status === 403 || r.status === 404;

const a = await login('seller@mercur.dev');
const b = await login('kickz@mercur.dev');
console.log(`aziende: A=${a.name}  B=${b.name}`);

const pa = await call('/vendor/products?limit=200&fields=id,title', a);
const pb = await call('/vendor/products?limit=200&fields=id,title', b);
const idsA = (pa.body.products || []).map((p) => p.id);
const idsB = (pb.body.products || []).map((p) => p.id);
check('A vede il proprio catalogo', pa.status === 200 && idsA.length > 0, `${idsA.length} prodotti`);
check('B vede il proprio catalogo', pb.status === 200 && idsB.length > 0, `${idsB.length} prodotti`);
console.log(`prodotti condivisi fra A e B: ${idsA.filter((id) => idsB.includes(id)).length}`);

const impersonate = await call('/vendor/products', { token: a.token, seller: b.seller });
check('A non può fingersi B con l\'intestazione', denied(impersonate), `HTTP ${impersonate.status}`);
const profile = await call('/vendor/sellers/me', { token: a.token, seller: b.seller });
check('A non legge il profilo di B', denied(profile), `HTTP ${profile.status}`);

const onlyB = idsB.find((id) => !idsA.includes(id));
if (onlyB) {
  const read = await call(`/vendor/products/${onlyB}`, a);
  check('A non legge un prodotto esclusivo di B', denied(read), `HTTP ${read.status}`);
  const write = await call(`/vendor/products/${onlyB}`, a, { method: 'POST', body: JSON.stringify({ title: 'Violazione' }) });
  check('A non modifica un prodotto di B', denied(write), `HTTP ${write.status}`);
} else console.log('nessun prodotto esclusivo di B: controllo saltato');

const oa = await call('/vendor/offers?limit=100', a);
const ob = await call('/vendor/offers?limit=100', b);
const offerIdsA = (oa.body.offers || []).map((o) => o.id);
const offerB = (ob.body.offers || []).map((o) => o.id).find((id) => !offerIdsA.includes(id));
check('Le offerte sono separate', oa.status === 200 && ob.status === 200 && Boolean(offerB), `A ${oa.body.count}, B ${ob.body.count}`);
if (offerB) {
  const read = await call(`/vendor/offers/${offerB}`, a);
  check('A non legge un\'offerta di B', denied(read), `HTTP ${read.status}`);
  const write = await call(`/vendor/offers/${offerB}`, a, { method: 'POST', body: JSON.stringify({ sku: 'VIOLAZIONE' }) });
  check('A non modifica un\'offerta di B', denied(write), `HTTP ${write.status}`);
  const del = await call(`/vendor/offers/${offerB}`, a, { method: 'DELETE' });
  check('A non cancella un\'offerta di B', denied(del), `HTTP ${del.status}`);
}
const orders = await call('/vendor/orders?limit=5', a);
check('Ordini dell\'azienda accessibili', orders.status === 200, `HTTP ${orders.status}`);
const asAdmin = await call('/admin/sellers', { token: a.token });
check('Azienda esclusa dalle rotte amministratore', denied(asAdmin), `HTTP ${asAdmin.status}`);
const anon = await call('/vendor/products');
check('Senza accesso non si legge nulla', denied(anon), `HTTP ${anon.status}`);

const ok = results.every(Boolean);
console.log(ok ? `ESITO: isolamento confermato (${results.length} controlli)` : 'ESITO: PROBLEMI DI ISOLAMENTO');
process.exit(ok ? 0 : 1);
