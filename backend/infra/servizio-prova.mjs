// Servizio OAuth finto, solo locale: permette di provare il login dei connettori senza account reali.
// Accetta unicamente app-di-prova / segreto-di-prova e verifica davvero PKCE e monouso del codice.
import crypto from 'node:crypto';
import http from 'node:http';

const PORTA = Number(process.env.PORT || 59732);
const codici = new Map();
const token = new Set();

const leggi = (req) => new Promise((ok) => {
  let corpo = '';
  req.on('data', (d) => { corpo += d; });
  req.on('end', () => ok(corpo));
});
const json = (res, stato, dati) => {
  res.writeHead(stato, { 'content-type': 'application/json' });
  res.end(JSON.stringify(dati));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  if (url.pathname === '/authorize') {
    const q = url.searchParams;
    if (q.get('client_id') !== 'app-di-prova' || !q.get('code_challenge') || q.get('code_challenge_method') !== 'S256') {
      return json(res, 400, { error: 'richiesta non valida' });
    }
    const codice = crypto.randomBytes(16).toString('hex');
    codici.set(codice, { challenge: q.get('code_challenge'), redirect: q.get('redirect_uri') });
    const ritorno = new URL(q.get('redirect_uri'));
    ritorno.searchParams.set('code', codice);
    ritorno.searchParams.set('state', q.get('state'));
    const pagina = `<!doctype html><meta charset="utf-8"><title>Servizio di prova</title>
<body style="font-family:system-ui;background:#16121a;color:#f4eef2;display:grid;place-items:center;height:100vh;margin:0">
<main style="text-align:center"><h1>Servizio di prova</h1><p>Multi Outfit chiede l'accesso al tuo account di prova.</p>
<a id="autorizza" href="${ritorno}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#ff5f8f;color:#16121a;font-weight:700;text-decoration:none">Autorizza</a></main></body>`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(pagina);
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    const p = new URLSearchParams(await leggi(req));
    const dati = codici.get(p.get('code'));
    codici.delete(p.get('code'));
    const atteso = dati && crypto.createHash('sha256').update(p.get('code_verifier') ?? '').digest('base64url');
    if (p.get('client_id') !== 'app-di-prova' || p.get('client_secret') !== 'segreto-di-prova') return json(res, 401, { error: 'invalid_client' });
    if (!dati || atteso !== dati.challenge || p.get('redirect_uri') !== dati.redirect) return json(res, 400, { error: 'invalid_grant' });
    const accesso = crypto.randomBytes(16).toString('hex');
    token.add(accesso);
    return json(res, 200, { access_token: accesso, refresh_token: 'rinnovo-di-prova', expires_in: 3600 });
  }
  if (url.pathname === '/me') {
    const t = (req.headers.authorization ?? '').replace('Bearer ', '');
    return token.has(t) ? json(res, 200, { account: 'account-di-prova' }) : json(res, 401, { error: 'token non valido' });
  }
  return json(res, 404, { error: 'non trovato' });
}).listen(PORTA, '127.0.0.1', () => console.log(`servizio di prova su http://127.0.0.1:${PORTA}`));
