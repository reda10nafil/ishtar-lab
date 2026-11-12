// Prova del team con ruoli, degli inviti ai collaboratori, dei limiti sul server e del registro.
// Richiede backend e email di prova attivi.
import crypto from 'node:crypto';
import { accediAdmin, accediAzienda, attendiBackend, chiama, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';

const { check, chiudi } = nuovaProva();
const stamp = Date.now();
await attendiBackend();
const admin = await accediAdmin();

const io = await chiama('/admin/permessi/me', admin);
check('Il primo amministratore è il proprietario', io.corpo.ruolo?.id === 'proprietario', io.corpo.ruolo?.etichetta);
check('Il proprietario ha tutti i permessi', io.corpo.permessi?.connettori === 'manage' && io.corpo.permessi?.users === 'manage' && io.corpo.permessi?.registro === 'view');

const team = await chiama('/admin/team', admin);
check('Elenco del team con ruoli e collaboratori', team.stato === 200 && team.corpo.ruoli?.length === 6 && team.corpo.collaboratori?.length >= 1, `${team.corpo.ruoli?.length} ruoli`);
const ioId = team.corpo.io;
const ruolo = (id) => team.corpo.ruoli?.find((r) => r.id === id);
check('Etichette dei ruoli in inglese', team.corpo.ruoli?.map((r) => r.etichetta).join(', ') === 'Owner, Catalogue manager, Orders operator, Marketing, Accounting, Read only', team.corpo.ruoli?.map((r) => r.etichetta).join(', '));
check('Sei aree nella tabella dei ruoli', team.corpo.aree?.length === 6, team.corpo.aree?.map((a) => a.etichetta).join(', '));
check('Il proprietario gestisce ogni area', team.corpo.aree?.every((a) => ruolo('proprietario').livelli[a.id] === 'manage'));
check('I livelli vengono dai permessi veri', ruolo('lettura').livelli.impostazioni === null && ruolo('lettura').livelli.prodotti === 'view' && ruolo('ordini').livelli.ordini === 'manage' && ruolo('contabilita').livelli.clienti === 'view', JSON.stringify(ruolo('lettura').livelli));
check('Il proprietario compare con il suo ruolo', team.corpo.collaboratori?.some((c) => c.id === ioId && c.ruolo === 'proprietario'));

const emailCollab = `prova-collab-${stamp}@ishtarlab.test`;
const passwordCollab = crypto.randomBytes(12).toString('base64url');
const sbagliato = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'inesistente' } });
check('Ruolo sconosciuto rifiutato', sbagliato.stato === 400 && sbagliato.corpo?.message === 'Unknown role', sbagliato.corpo?.message);
const proprietario = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'proprietario' } });
check('Il proprietario non si assegna con un invito', proprietario.stato === 400 && /owner/.test(proprietario.corpo?.message), proprietario.corpo?.message);
const invito = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'lettura' } });
check('Invito creato con ruolo Sola lettura', invito.stato === 201 && invito.corpo.invito?.ruolo === 'lettura', JSON.stringify(invito.corpo).slice(0, 100));
const doppio = await chiama('/admin/team', admin, { corpo: { email: emailCollab, ruolo: 'lettura' } });
check('Invito doppio rifiutato', doppio.stato === 400 && /already exists/.test(doppio.corpo?.message), doppio.corpo?.message);

const messaggio = await emailPer(emailCollab);
check('Email di invito ricevuta', Boolean(messaggio?.Subject?.includes('Ishtar Lab')), messaggio?.Subject);
check('Email di invito in inglese, senza Multi Outfit', /invited/.test(messaggio?.Text ?? '') && !/Multi Outfit|invitato|Accetta/.test(`${messaggio?.Subject} ${messaggio?.Text} ${messaggio?.HTML}`));
const link = tokenDaEmail(messaggio);
check('Il link porta alla pagina di attivazione della console', link?.pathname === '/invito-team' && link.port === '5180', link?.href?.replace(/token=.*/, 'token=...'));
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
check('Sola lettura non invita nessuno', negato(await chiama('/admin/team', collab, { corpo: { email: `prova-x-${stamp}@ishtarlab.test`, ruolo: 'lettura' } })));

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
const spento = await chiama(`/admin/team/${collabId}`, admin, { corpo: { attivo: false } });
check('Collaboratore spento dal proprietario', spento.stato === 200 && spento.corpo.attivo === false && spento.corpo.ruolo === 'catalogo', JSON.stringify(spento.corpo).slice(0, 100));
check('Da spento perde subito ogni permesso sul server', negato(await chiama('/admin/products?limit=1', collab)) && negato(await chiama('/admin/permessi/me', collab)));
const teamSpento = await chiama('/admin/team', admin);
check('Nel team resta con il suo ruolo, segnato come spento', teamSpento.corpo.collaboratori.some((c) => c.id === collabId && c.ruolo === 'catalogo' && c.attivo === false));
const cambioSpento = await chiama(`/admin/team/${collabId}`, admin, { corpo: { ruolo: 'marketing' } });
check('Il ruolo cambiato da spento non lo riaccende', cambioSpento.corpo.attivo === false && negato(await chiama('/admin/products?limit=1', collab)));
await chiama(`/admin/team/${collabId}`, admin, { corpo: { ruolo: 'catalogo' } });
const acceso = await chiama(`/admin/team/${collabId}`, admin, { corpo: { attivo: true } });
check('Riacceso ritrova ruolo e permessi', acceso.corpo.attivo === true && (await chiama('/admin/permessi/me', collab)).corpo.ruolo?.id === 'catalogo');
const proprietarioSpento = await chiama(`/admin/team/${ioId}`, admin, { corpo: { attivo: false } });
check('Il proprietario non si spegne', proprietarioSpento.stato === 400, proprietarioSpento.corpo?.message);
check('Il proprietario non cambia il proprio ruolo', seStesso.stato === 400 && /own profile/.test(seStesso.corpo?.message), seStesso.corpo?.message);

const emailSecondo = `prova-collab2-${stamp}@ishtarlab.test`;
const secondo = await chiama('/admin/team', admin, { corpo: { email: emailSecondo, ruolo: 'ordini', nome: 'Prova Secondo' } });
const invitoNome = (await chiama('/admin/team', admin)).corpo.inviti.find((i) => i.email === emailSecondo);
check("Il nome dell'invito compare nel team", invitoNome?.nome === 'Prova Secondo' && invitoNome?.ruolo === 'ordini', invitoNome?.nome);
const invitoSpento = await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: { attivo: false } });
check('Invitato spento e riacceso, col ruolo conservato', invitoSpento.corpo.attivo === false && invitoSpento.corpo.ruolo === 'ordini' && (await chiama('/admin/team', admin)).corpo.inviti.some((i) => i.email === emailSecondo && i.attivo === false));
await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: { attivo: true } });
const ruoloInvito = await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: { ruolo: 'contabilita' } });
check("Ruolo dell'invitato cambiato", ruoloInvito.stato === 200 && (await chiama('/admin/team', admin)).corpo.inviti.find((i) => i.email === emailSecondo)?.ruolo === 'contabilita');
check("All'invitato non si assegna il proprietario", (await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: { ruolo: 'proprietario' } })).stato === 400);
const primaEmail = await emailPer(emailSecondo);
const rinvio = await chiama(`/admin/team/inviti/${secondo.corpo.invito?.id}`, admin, { corpo: {} });
check('Invito inviato di nuovo', rinvio.stato === 200 && rinvio.corpo.inviato === true);
let seconde = 0;
for (let i = 0; i < 20 && seconde < 2; i += 1) {
  await new Promise((r) => setTimeout(r, 500));
  seconde = (await (await fetch(`http://127.0.0.1:58500/api/v1/search?query=${encodeURIComponent(`to:${emailSecondo}`)}`)).json()).messages_count ?? 0;
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
for (const attesa of ['Team member invited', 'Team member updated', 'Invitation updated', 'Invitation cancelled', 'Team member removed', 'Denied: team member removed']) {
  check(`Registro: ${attesa}`, azioni.includes(attesa));
}
const chi = registro.corpo.voci?.find((v) => v.azione === 'Denied: team member removed');
check('La voce negata indica chi ha provato', chi?.chi === emailCollab || chi?.chi === 'Removed account', chi?.chi);

const azienda = await accediAzienda('seller@mercur.dev');
const mioAzienda = await chiama('/vendor/permessi/me', azienda);
check("Il titolare dell'azienda ha il ruolo Company owner", mioAzienda.corpo.ruolo?.etichetta === 'Company owner' && mioAzienda.corpo.permessi?.members === 'manage', mioAzienda.corpo.ruolo?.id);
check('Le aziende leggono gli ordini ma non toccano prezzi e clienti', mioAzienda.corpo.permessi?.orders === 'view' && !mioAzienda.corpo.permessi?.price_lists && !mioAzienda.corpo.permessi?.customers);
const ruoliAzienda = await chiama('/vendor/team/ruoli', azienda);
check('Quattro ruoli aziendali in inglese', ruoliAzienda.corpo.ruoli?.map((r) => r.etichetta).join(', ') === 'Company owner, Staff, Warehouse staff, Accounting', ruoliAzienda.corpo.ruoli?.map((r) => r.etichetta).join(', '));
const membri = await chiama(`/vendor/sellers/${azienda.azienda}/members?limit=100`, azienda);
check("Elenco dei membri dell'azienda", membri.stato === 200 && membri.corpo.seller_members?.some((m) => m.is_owner));
const emailMembro = `prova-staff-${stamp}@ishtarlab.test`;
const invitoMembro = await chiama(`/vendor/sellers/${azienda.azienda}/members`, azienda, { corpo: { email: emailMembro, role_id: 'role_seller_order_management' } });
check('Invito di una persona nel team azienda', invitoMembro.stato === 201, JSON.stringify(invitoMembro.corpo).slice(0, 100));
const invitiAzienda = await chiama(`/vendor/sellers/${azienda.azienda}/members/invites?limit=100`, azienda);
check("L'invito compare tra quelli in attesa", invitiAzienda.corpo.member_invites?.some((i) => i.email === emailMembro && !i.accepted));
// Mercur non offre una rotta per annullare gli inviti delle aziende: questo resta in attesa fino alla scadenza.
check("Un'azienda non legge il team di un'altra", negato(await chiama(`/vendor/sellers/${azienda.azienda}/members`, { token: azienda.token, azienda: 'sel_inesistente' })));

chiudi('team, permessi e registro funzionanti');
