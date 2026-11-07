// Prova del team con ruoli, degli inviti ai collaboratori, dei limiti sul server e del registro.
// Richiede backend e email di prova attivi.
import crypto from 'node:crypto';
import { accediAdmin, accediAzienda, chiama, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';

const { check, chiudi } = nuovaProva();
const stamp = Date.now();
const admin = await accediAdmin();

const io = await chiama('/admin/permessi/me', admin);
check('Il primo amministratore è il proprietario', io.corpo.ruolo?.id === 'proprietario', io.corpo.ruolo?.etichetta);
check('Il proprietario ha tutti i permessi', io.corpo.permessi?.connettori === 'manage' && io.corpo.permessi?.users === 'manage' && io.corpo.permessi?.registro === 'view');

const team = await chiama('/admin/team', admin);
check('Elenco del team con ruoli e collaboratori', team.stato === 200 && team.corpo.ruoli?.length === 6 && team.corpo.collaboratori?.length >= 1, `${team.corpo.ruoli?.length} ruoli`);
const ioId = team.corpo.io;
check('Il proprietario compare con il suo ruolo', team.corpo.collaboratori?.some((c) => c.id === ioId && c.ruolo === 'proprietario'));

const emailCollab = `collab-${stamp}@multioutfit.test`;
const passwordCollab = crypto.randomBytes(12).toString('base64url');
const sbagliato = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'inesistente' } });
check('Ruolo sconosciuto rifiutato', sbagliato.stato === 400, sbagliato.corpo?.message);
const proprietario = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'proprietario' } });
check('Il proprietario non si assegna con un invito', proprietario.stato === 400, proprietario.corpo?.message);
const invito = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'lettura' } });
check('Invito creato con ruolo Sola lettura', invito.stato === 201 && invito.corpo.invito?.ruolo === 'lettura', JSON.stringify(invito.corpo).slice(0, 100));
const doppio = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'lettura' } });
check('Invito doppio rifiutato', doppio.stato === 400, doppio.corpo?.message);

const messaggio = await emailPer(emailCollab);
check('Email di invito ricevuta', Boolean(messaggio?.Subject?.includes('Ishtar Lab')), messaggio?.Subject);
const link = tokenDaEmail(messaggio);
check('Il link porta alla pagina di attivazione della console', link?.pathname === '/invito-team' && link.port === '5283', link?.href?.replace(/token=.*/, 'token=...'));
const token = link?.searchParams.get('token') ?? '';
let emailNelToken = '';
try {
  emailNelToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).email;
} catch {
  emailNelToken = '';
}
check("Il token contiene l'email dell'invitato", emailNelToken === emailCollab);

const registrazione = await chiama('/auth/user/emailpass/register', null, { corpo: { email: emailCollab, password: passwordCollab } });
check('Account del collaboratore creato', Boolean(registrazione.corpo?.token));
const accettato = await chiama(`/admin/invites/accept?token=${encodeURIComponent(token)}`, { token: registrazione.corpo?.token }, { corpo: { first_name: 'Luca', last_name: 'Bianchi' } });
check('Invito accettato', accettato.stato === 200, JSON.stringify(accettato.corpo).slice(0, 100));

const collab = await accediAdmin(emailCollab, passwordCollab);
const mio = await chiama('/admin/permessi/me', collab);
check('Il collaboratore entra con il ruolo Sola lettura', mio.corpo.ruolo?.id === 'lettura', mio.corpo.ruolo?.etichetta);
check('Sola lettura vede le aziende', (await chiama('/admin/sellers?limit=1', collab)).stato === 200);
check('Sola lettura non vede i connettori', negato(await chiama('/admin/connectors', collab)));
check('Sola lettura non vede il team', negato(await chiama('/admin/team', collab)));
check('Sola lettura non vede il registro', negato(await chiama('/admin/registro', collab)));
check('Sola lettura non invita nessuno', negato(await chiama('/admin/team', collab, { corpo: { email: `x-${stamp}@multioutfit.test`, ruolo: 'lettura' } })));

const teamDopo = await chiama('/admin/team', admin);
const collabId = teamDopo.corpo.collaboratori.find((c) => c.email === emailCollab)?.id;
check('Il collaboratore compare nel team con nome e ruolo', Boolean(collabId) && teamDopo.corpo.collaboratori.some((c) => c.email === emailCollab && c.first_name === 'Luca' && c.ruolo === 'lettura'));
check("L'invito accettato non è più in attesa", !teamDopo.corpo.inviti.some((i) => i.email === emailCollab));

const cambio = await chiama(`/admin/team/${collabId}`, admin, { corpo: { ruolo: 'catalogo' } });
check('Ruolo cambiato in Responsabile catalogo', cambio.stato === 200 && cambio.corpo.ruolo === 'catalogo');
const mio2 = await chiama('/admin/permessi/me', collab);
check('Il nuovo ruolo vale subito', mio2.corpo.ruolo?.id === 'catalogo' && mio2.corpo.permessi?.products === 'manage');
check('Responsabile catalogo vede i prodotti da approvare', (await chiama('/admin/products?status[]=proposed&limit=1', collab)).stato === 200);
check('Responsabile catalogo non rimuove collaboratori', negato(await chiama(`/admin/team/${ioId}`, collab, { metodo: 'DELETE' })));
const seStesso = await chiama(`/admin/team/${ioId}`, admin, { corpo: { ruolo: 'lettura' } });
check('Il proprietario non cambia il proprio ruolo', seStesso.stato === 400, seStesso.corpo?.message);

const emailSecondo = `collab2-${stamp}@multioutfit.test`;
const secondo = await chiama('/admin/team', admin, { corpo: { email: emailSecondo, ruolo: 'ordini' } });
const primaEmail = await emailPer(emailSecondo);
const rinvio = await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: {} });
check('Invito inviato di nuovo', rinvio.stato === 200 && rinvio.corpo.inviato === true);
let seconde = 0;
for (let i = 0; i < 20 && seconde < 2; i += 1) {
  await new Promise((r) => setTimeout(r, 500));
  seconde = (await (await fetch(`http://127.0.0.1:58730/api/v1/search?query=${encodeURIComponent(`to:${emailSecondo}`)}`)).json()).messages_count ?? 0;
}
check("Due email per l'invito rinviato", Boolean(primaEmail) && seconde >= 2, `${seconde} email`);
const annulla = await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { metodo: 'DELETE' });
check('Invito annullato', annulla.stato === 200);
const teamSenza = await chiama('/admin/team', admin);
check("L'invito annullato sparisce dall'elenco", !teamSenza.corpo.inviti.some((i) => i.email === emailSecondo));
const ancora = await chiama('/admin/team', admin, { corpo: { email: emailSecondo, ruolo: 'marketing' } });
check("Dopo l'annullamento si può invitare di nuovo lo stesso indirizzo", ancora.stato === 201 && ancora.corpo.invito?.ruolo === 'marketing');
await chiama(`/admin/team/inviti/${ancora.corpo.invito?.id}`, admin, { metodo: 'DELETE' });

const rimozione = await chiama(`/admin/team/${collabId}`, admin, { metodo: 'DELETE' });
check('Collaboratore rimosso', rimozione.stato === 200 && rimozione.corpo.rimosso === true);
let rientra = false;
try {
  await accediAdmin(emailCollab, passwordCollab);
  rientra = true;
} catch {
  rientra = false;
}
check('Il collaboratore rimosso non entra più', !rientra);
check('Il proprietario non si rimuove', (await chiama(`/admin/team/${ioId}`, admin, { metodo: 'DELETE' })).stato === 400);

const registro = await chiama('/admin/registro', admin);
const azioni = registro.corpo.voci?.map((v) => v.azione) ?? [];
check('Registro leggibile', registro.stato === 200 && azioni.length > 0, `${azioni.length} voci`);
for (const attesa of ['Collaboratore invitato', 'Ruolo di un collaboratore cambiato', 'Invito inviato di nuovo', 'Invito annullato', 'Collaboratore rimosso', 'Negato: collaboratore rimosso']) {
  check(`Registro: ${attesa}`, azioni.includes(attesa));
}
const chi = registro.corpo.voci?.find((v) => v.azione === 'Negato: collaboratore rimosso');
check('La voce negata indica chi ha provato', chi?.chi === emailCollab || chi?.chi === 'Account rimosso', chi?.chi);

const azienda = await accediAzienda('seller@mercur.dev');
const mioAzienda = await chiama('/vendor/permessi/me', azienda);
check("Il titolare dell'azienda ha il ruolo Titolare", mioAzienda.corpo.ruolo?.etichetta === 'Titolare' && mioAzienda.corpo.permessi?.members === 'manage', mioAzienda.corpo.ruolo?.id);
check('Le aziende leggono gli ordini ma non toccano prezzi e clienti', mioAzienda.corpo.permessi?.orders === 'view' && !mioAzienda.corpo.permessi?.price_lists && !mioAzienda.corpo.permessi?.customers);
const ruoliAzienda = await chiama('/vendor/team/ruoli', azienda);
check('Quattro ruoli aziendali', ruoliAzienda.corpo.ruoli?.length === 4, ruoliAzienda.corpo.ruoli?.map((r) => r.etichetta).join(', '));
const membri = await chiama(`/vendor/sellers/${azienda.azienda}/members?limit=100`, azienda);
check("Elenco dei membri dell'azienda", membri.stato === 200 && membri.corpo.seller_members?.some((m) => m.is_owner));
const emailMembro = `staff-${stamp}@multioutfit.test`;
const invitoMembro = await chiama(`/vendor/sellers/${azienda.azienda}/members`, azienda, { corpo: { email: emailMembro, role_id: 'role_seller_order_management' } });
check('Invito di una persona nel team azienda', invitoMembro.stato === 201, JSON.stringify(invitoMembro.corpo).slice(0, 100));
const invitiAzienda = await chiama(`/vendor/sellers/${azienda.azienda}/members/invites?limit=100`, azienda);
check("L'invito compare tra quelli in attesa", invitiAzienda.corpo.member_invites?.some((i) => i.email === emailMembro && !i.accepted));
check("Un'azienda non legge il team di un'altra", negato(await chiama(`/vendor/sellers/${azienda.azienda}/members`, { token: azienda.token, azienda: 'sel_inesistente' })));

chiudi('team, permessi e registro funzionanti');
