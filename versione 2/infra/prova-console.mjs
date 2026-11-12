// Collaudo della console in un browser reale: accesso, menu, Apps, Companies, Settings, portale azienda, Review e telefono.
// Richiede backend, console e servizio-prova attivi. Salva gli screenshot in .scratch/console.
import crypto from 'node:crypto';
import path from 'node:path';
import { CONSOLE, accediAdmin, accediAzienda, attendiBackend, chiama, emailPer, negato, nuovaProva, tokenDaEmail } from './lib.mjs';
import { CARTELLA_SCREENSHOT as OUT, accediAdminBrowser, apriBrowser } from './lib-browser.mjs';

const MENU_ADMIN = 'Overview, Orders, Products, Review, Outfit Studio, Customers, Analytics, Marketing, Discounts, Online shop, Shop till, Wholesale, Companies, Apps, Settings, Help';
const MENU_AZIENDA = 'Overview, My products, Inventory, Orders, Fulfilment, Outfits, Discounts, Team, Help';
const BARRA_TELEFONO = 'Home, Orders, Products, Analytics, More';
const SCHEDE_SETTINGS = 'Store, Team, Shipping, Alerts, Appearance, Data, Activity log';
const ITALIANO = /\b(Azienda|Aziende|Collaboratore|Ruolo|Invita|Annulla|Rimuovi|Registro|Accedi|Attiva|Sospendi|Approva|Nuova|Impostazioni|Scade|Nessun[oa]?|Modifiche)\b/;

await attendiBackend();
const { check, chiudi } = nuovaProva();
const { browser, nuovaPagina: paginaNuova, errori } = await apriBrowser();
// Altri lavori salvano file mentre la prova gira: senza il canale di Vite la pagina non si ricarica a metà.
const nuovaPagina = async (opzioni) => {
  const pagina = await paginaNuova(opzioni);
  await pagina.routeWebSocket(/:5180/, () => undefined);
  return pagina;
};

const step = async (nome, azione) => {
  try {
    await azione();
  } catch (e) {
    check(nome, false, e.message.split('\n')[0].slice(0, 140));
    for (const p of browser.contexts().flatMap((c) => c.pages())) {
      await p.screenshot({ path: path.join(OUT, `errore-${nome}-${browser.contexts().indexOf(p.context())}.png`) }).catch(() => undefined);
      console.log(`   pagina ${p.url()}: ${(await p.locator('main, form').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220)}`);
      // Una finestra rimasta aperta non deve far cadere anche i passaggi seguenti.
      await p.reload().catch(() => undefined);
    }
  }
};
const voci = async (p, selettore) => (await p.locator(selettore).allInnerTexts()).map((t) => t.split('\n')[0].trim()).join(', ');
const senzaScorrimento = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const inglese = async (p, nome) => {
  const trovata = ITALIANO.exec(await p.locator('main, form').first().innerText());
  check(`${nome} senza italiano`, !trovata, trovata?.[0]);
};
const avviso = (p, testo) => p.locator('.avvisi').getByText(testo, { exact: true }).first().waitFor();

const stamp = Date.now();
const admin = await nuovaPagina();
const sessioneAdmin = await accediAdmin();

await step('Accesso', async () => {
  await admin.goto(`${CONSOLE}/accesso-azienda`);
  await inglese(admin, 'Accesso azienda');
  await admin.getByLabel('Email').fill('nessuno@ishtarlab.test');
  await admin.getByLabel('Password').fill('password-sbagliata');
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.getByRole('alert').waitFor();
  check('Accesso azienda: password errata rifiutata con messaggio', (await admin.getByRole('alert').innerText()).includes('Wrong email or password'));

  await accediAdminBrowser(admin);
  await admin.locator('h1').first().waitFor();
  await admin.locator('.laterale').getByRole('link', { name: 'Help' }).waitFor({ timeout: 60000 });
  check("L'amministratore entra senza email e password", !admin.url().includes('accesso') && (await admin.locator('input[type=password]').count()) === 0);
  check('Menu amministratore completo', (await voci(admin, '.laterale nav a')) === MENU_ADMIN, await voci(admin, '.laterale nav a'));
  await admin.waitForTimeout(600);
  await admin.screenshot({ path: path.join(OUT, '1-overview.png') });
});

await step('Apps', async () => {
  await admin.locator('.laterale').getByRole('link', { name: 'Apps' }).click();
  await admin.getByRole('heading', { name: 'Apps & connectors' }).waitFor();
  await admin.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Browse' }).click();
  await admin.locator('.connettore').first().waitFor();
  const schede = await admin.locator('.connettore').count();
  check('Schede dei connettori visibili', schede >= 18, `${schede} schede`);
  await admin.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Shipping' }).click();
  const spedizioni = await admin.locator('.connettore').count();
  check('Filtro per categoria', spedizioni >= 1 && spedizioni < schede, `${spedizioni} schede`);
  await admin.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'All' }).click();
  await admin.waitForTimeout(400);
  await admin.screenshot({ path: path.join(OUT, '2-apps.png') });

  await admin.getByRole('button', { name: 'Connect Instagram' }).click();
  await admin.getByRole('dialog').getByText('public HTTPS address').waitFor();
  check('Instagram spiega il requisito HTTPS', true);
  check('Accesso Instagram disattivato senza dominio', await admin.getByRole('button', { name: 'Sign in to Instagram' }).isDisabled());
  await admin.keyboard.press('Escape');
  await admin.waitForTimeout(500);

  await admin.getByRole('button', { name: 'Connect Stripe' }).click();
  await admin.getByRole('dialog').locator('input[type=password]').fill('sk_test_chiave_finta_per_collaudo');
  await admin.getByRole('button', { name: 'Save and test' }).click();
  // Il servizio vero può rifiutare la chiave o non rispondere: conta che l'esito sia chiaro e in inglese.
  await admin.getByRole('dialog').getByText(/Credentials rejected by the service|Service unreachable/).first().waitFor({ timeout: 30000 });
  check('Chiave sbagliata segnalata in inglese', true);
  check('La chiave non resta visibile', (await admin.getByRole('dialog').locator('input[type=password]').inputValue()) === '');
  await admin.screenshot({ path: path.join(OUT, '3-errore-chiave.png') });
  await admin.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });

  await admin.getByRole('button', { name: 'Connect Test service' }).click();
  await admin.getByLabel('Application ID').fill('test-app');
  await admin.getByLabel('Application secret key').fill('test-secret');
  await admin.getByRole('button', { name: 'Save app details' }).click();
  await admin.getByRole('dialog').getByText('To finish').waitFor();
  await admin.getByRole('button', { name: 'Sign in to Test service' }).click();
  await admin.getByText('Ishtar Lab is asking for access to your test account.').waitFor();
  check('Il servizio di prova parla inglese e nomina Ishtar Lab', true);
  await admin.locator('#autorizza').click();
  await admin.waitForURL('**/connettori*');
  await admin.getByText('Connection complete.').waitFor();
  check("Accesso completo fino al ritorno nell'app", true);
  await admin.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Browse' }).click();
  await admin.getByRole('button', { name: 'Test service connected: manage' }).click();
  await admin.getByRole('dialog').getByText('test-account').waitFor();
  check("Stato collegato con nome dell'account", true);
  await admin.getByRole('dialog').getByRole('button', { name: 'Test', exact: true }).click();
  await admin.getByText('Connection successful: test-account.').waitFor();
  check("Prova del collegamento dall'interfaccia", true);
  await admin.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });
});

const emailAzienda = `prova-azienda-${stamp}@ishtarlab.test`;
const passwordAzienda = crypto.randomBytes(12).toString('base64url');
const nomeAzienda = `Prova Atelier ${stamp}`;
let tokenInvito;

await step('Companies', async () => {
  await admin.locator('.laterale').getByRole('link', { name: 'Companies' }).click();
  await admin.getByRole('heading', { name: 'Companies', level: 1 }).waitFor();
  await admin.locator('.azienda').first().waitFor();
  await inglese(admin, 'Companies');
  const stati = await voci(admin, '.azienda-tessera small');
  check('Quattro tessere con gli stati tradotti', stati === 'Active, Awaiting approval, Suspended, Closed', stati);
  const tutte = await admin.locator('.azienda').count();
  await admin.getByRole('group', { name: 'Status' }).getByRole('button', { name: /Closed/ }).click();
  check('La tessera filtra per stato', (await admin.locator('.azienda').count()) < tutte);
  await admin.getByRole('group', { name: 'Status' }).getByRole('button', { name: /Closed/ }).click();
  await admin.getByLabel('Search by name or email').fill('seller@mercur.dev');
  await admin.waitForTimeout(300);
  check('Ricerca per nome o email', (await admin.locator('.azienda').count()) === 1, `${await admin.locator('.azienda').count()} righe`);
  await admin.getByLabel('Search by name or email').fill('nessuna-azienda-con-questo-nome');
  await admin.getByText('No companies match this filter.').waitFor();
  check('Filtro senza risultati con messaggio', true);
  await admin.getByLabel('Search by name or email').fill('');
  await admin.waitForTimeout(300);
  await admin.screenshot({ path: path.join(OUT, '4-companies.png') });

  await admin.getByRole('button', { name: 'New company' }).click();
  await admin.keyboard.press('Escape');
  await admin.getByRole('dialog').waitFor({ state: 'detached' });
  check('Esc chiude la finestra della nuova azienda', true);
  await admin.waitForTimeout(500);
  await admin.getByRole('button', { name: 'New company' }).click();
  await admin.getByLabel('Company name').fill(nomeAzienda);
  await admin.getByLabel('Contact email').fill(emailAzienda);
  await admin.getByRole('button', { name: 'Create and invite' }).click();
  const riga = admin.locator('.azienda', { hasText: nomeAzienda });
  await riga.waitFor();
  check("Nuova azienda creata dall'interfaccia", true);
  const messaggio = await emailPer(emailAzienda);
  check('Email di invito ricevuta, in inglese', /Ishtar Lab/.test(messaggio?.Subject ?? '') && !/Multi Outfit|Attiva/.test(`${messaggio?.Subject} ${messaggio?.Text}`), messaggio?.Subject);
  tokenInvito = tokenDaEmail(messaggio)?.searchParams.get('token');
  check("L'email contiene il token di invito", Boolean(tokenInvito));
  const azione = riga.getByRole('button', { name: `Actions for ${nomeAzienda}` });
  await azione.click();
  const approva = riga.getByRole('button', { name: 'Approve' });
  if (await approva.count()) {
    await approva.click();
    await avviso(admin, `${nomeAzienda} is approved`);
    await azione.click();
  }
  await riga.getByRole('button', { name: 'Suspend' }).click();
  await riga.getByText('Suspended').waitFor();
  check('Azienda sospesa dal menu dei puntini', true);
  await azione.click();
  await riga.getByRole('button', { name: 'Reactivate' }).click();
  await riga.getByText('Active').waitFor();
  check('Azienda riattivata', true);
});

await step('Settings', async () => {
  await admin.locator('.laterale').getByRole('link', { name: 'Settings' }).click();
  await admin.waitForURL('**/impostazioni/**');
  await admin.locator('main').getByRole('link', { name: 'Team', exact: true }).click();
  await admin.waitForURL('**/team');
  await admin.getByRole('heading', { name: 'Team', level: 2 }).waitFor();
  check('Team si raggiunge da Settings', true);
  check('Stesse schede di Settings su Team', (await voci(admin, 'main .schede a')) === SCHEDE_SETTINGS, await voci(admin, 'main .schede a'));
  check('Settings resta la voce attiva del menu', (await admin.locator('.laterale nav a.active').innerText()).includes('Settings'));
  await inglese(admin, 'Team');
  check('Tabella dei livelli con sei righe e sette colonne', (await admin.locator('.ruoli tbody tr').count()) === 6 && (await admin.locator('.ruoli thead th').count()) === 7);
  check('La tabella segna il proprietario in ogni riga', (await admin.locator('.ruoli tbody tr td:first-of-type svg').count()) === 6);
  await admin.waitForTimeout(300);
  await admin.screenshot({ path: path.join(OUT, '5-team.png'), fullPage: true });

  // Invito dalla finestra, come nel pannello: nome, email, accesso.
  const emailInvito = `prova-invito-${stamp}@ishtarlab.test`;
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  const finestra = admin.getByRole('dialog', { name: 'Invite someone' });
  await finestra.waitFor();
  check('Il cursore parte dal nome', await finestra.getByLabel('Name').evaluate((e) => e === document.activeElement));
  check('Largo 520 px come nel pannello', (await finestra.evaluate((e) => e.offsetWidth)) === 520);
  await admin.keyboard.press('Escape');
  await finestra.waitFor({ state: 'detached' });
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await finestra.getByRole('button', { name: 'Close' }).click();
  await finestra.waitFor({ state: 'detached' });
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await finestra.getByRole('button', { name: 'Cancel' }).click();
  await finestra.waitFor({ state: 'detached' });
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await admin.waitForTimeout(600);
  await admin.mouse.click(40, 450);
  await finestra.waitFor({ state: 'detached' });
  check('La finestra si chiude con Esc, X, Cancel e clic fuori', true);
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await finestra.getByRole('button', { name: 'Send invite' }).click();
  await admin.waitForTimeout(400);
  check('Invio a campi vuoti: la finestra resta aperta senza errori', await finestra.isVisible());
  await finestra.getByLabel('Name').fill('Prova Vuota');
  await finestra.getByLabel('Email').fill('non-una-email');
  await finestra.getByRole('button', { name: 'Send invite' }).click();
  await admin.waitForTimeout(400);
  check('Email non valida fermata dal modulo', await finestra.isVisible() && !(await finestra.getByLabel('Email').evaluate((e) => e.validity.valid)));
  const nomeInvito = `Prova Invitata ${stamp}`;
  await finestra.getByLabel('Name').fill(nomeInvito);
  await finestra.getByLabel('Email').fill(emailInvito);
  await finestra.getByLabel('Access').selectOption('lettura');
  await finestra.getByLabel('Email').press('Enter');
  await avviso(admin, `Invite sent to ${emailInvito}`);
  const invitata = admin.locator('.persona', { hasText: nomeInvito });
  await invitata.waitFor();
  check('La persona invitata compare nel team', (await invitata.innerText()).includes(`Invited · ${emailInvito}`));
  await invitata.getByLabel(`${nomeInvito} access`).selectOption('marketing');
  await avviso(admin, 'Prova is now Marketing');
  await invitata.getByRole('switch', { name: `${nomeInvito} active` }).click();
  await avviso(admin, 'Prova is switched off');
  await admin.locator('.persona--spenta', { hasText: nomeInvito }).waitFor();
  await invitata.getByRole('switch', { name: `${nomeInvito} active` }).click();
  await avviso(admin, 'Prova can sign in');
  await invitata.getByRole('button', { name: `Send the invite to ${emailInvito} again` }).click();
  await avviso(admin, `Invite sent to ${emailInvito}`);
  await invitata.getByRole('button', { name: `Cancel the invite to ${emailInvito}` }).click();
  await invitata.waitFor({ state: 'detached' });
  check('Invito cambiato, rinviato e annullato', true);

  // Interruttore, ruolo e rimozione su un collaboratore vero.
  const emailCollab = `prova-console-${stamp}@ishtarlab.test`;
  const passwordCollab = crypto.randomBytes(12).toString('base64url');
  await chiama('/admin/team', sessioneAdmin, { corpo: { email: emailCollab, ruolo: 'lettura', nome: 'Prova Member' } });
  const invito = tokenDaEmail(await emailPer(emailCollab))?.searchParams.get('token') ?? '';
  const conto = await chiama('/auth/user/emailpass/register', null, { corpo: { email: emailCollab, password: passwordCollab } });
  await chiama(`/admin/invites/accept?token=${encodeURIComponent(invito)}`, { token: conto.corpo.token }, { corpo: { first_name: 'Prova', last_name: 'Member' } });
  await admin.reload();
  const collab = admin.locator('.persona', { hasText: emailCollab });
  await collab.waitFor();
  const interruttore = collab.getByRole('switch', { name: 'Prova Member active' });
  await interruttore.focus();
  await admin.keyboard.press('Space');
  await avviso(admin, 'Prova is switched off');
  await admin.locator('.persona--spenta', { hasText: emailCollab }).waitFor();
  const spento = await accediAdmin(emailCollab, passwordCollab);
  check("Spento dall'interruttore: sul server non vede più nulla", negato(await chiama('/admin/sellers?limit=1', spento)));
  await interruttore.click();
  await avviso(admin, 'Prova can sign in');
  check('Riacceso: rivede le aziende', (await chiama('/admin/sellers?limit=1', spento)).stato === 200);
  await collab.getByLabel('Prova Member access').selectOption('marketing');
  await avviso(admin, 'Prova is now Marketing');
  await collab.getByRole('button', { name: 'Remove Prova Member' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await collab.waitFor({ state: 'detached' });
  check('Collaboratore cambiato e rimosso dalla pagina', true);

  await admin.locator('main').getByRole('link', { name: 'Activity log', exact: true }).click();
  await admin.waitForURL('**/registro');
  await admin.locator('.tabella tbody tr').first().waitFor();
  const colonne = await voci(admin, '.tabella th');
  check('Activity log con le colonne in inglese', colonne === 'Action, Who, Company, When, Result', colonne);
  check('Stesse schede di Settings su Activity log', (await voci(admin, 'main .schede a')) === SCHEDE_SETTINGS);
  const testoLog = await admin.locator('.tabella').innerText();
  check('Activity log in inglese', /Team member removed/.test(testoLog) && /Done/.test(testoLog) && !/Eseguita|Collaboratore rimosso/.test(testoLog));
  await admin.screenshot({ path: path.join(OUT, '6-activity-log.png') });
});

const azienda = await nuovaPagina();
const titoloProdotto = `Prova blazer ${stamp}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAKklEQVR4nGP8z8DAwMDAwMDAxMDAwMAgwMDA8J+BgYGB4T8DAwMDw38GAAYuAgQ0PqZtAAAAAElFTkSuQmCC', 'base64');

await step('Portale azienda', async () => {
  await azienda.goto(`${CONSOLE}/invito?token=${encodeURIComponent(tokenInvito)}`);
  await inglese(azienda, 'Invito');
  await azienda.getByLabel('First name').fill('Prova');
  await azienda.getByLabel('Last name').fill('Partner');
  await azienda.getByLabel('Email').fill(emailAzienda);
  await azienda.getByLabel('Password').fill(passwordAzienda);
  await azienda.getByRole('button', { name: 'Activate access' }).click();
  await azienda.locator('.laterale').waitFor();
  await azienda.locator('h1').first().waitFor();
  await azienda.locator('.laterale').getByRole('link', { name: 'Help' }).waitFor({ timeout: 60000 });
  check('Invito accettato e portale aperto', (await azienda.locator('input[type=password]').count()) === 0);
  check("L'azienda vede solo le sue voci", (await voci(azienda, '.laterale nav a')) === MENU_AZIENDA, await voci(azienda, '.laterale nav a'));
  for (const [rotta, nome] of [['connettori', 'Apps'], ['aziende', 'Companies'], ['registro', 'Activity log']]) {
    await azienda.goto(`${CONSOLE}/${rotta}`);
    await azienda.locator('.laterale').waitFor();
    await azienda.waitForURL((u) => !u.pathname.startsWith(`/${rotta}`), { timeout: 8000 }).catch(() => undefined);
    check(`Pagina ${nome} vietata all'azienda`, !azienda.url().includes(rotta));
  }

  await azienda.locator('.laterale').getByRole('link', { name: 'Team' }).click();
  await azienda.getByRole('heading', { name: 'Team', level: 2 }).waitFor();
  await azienda.locator('.persona').first().waitFor();
  await inglese(azienda, 'Team azienda');

  await azienda.locator('.laterale').getByRole('link', { name: 'My products' }).click();
  await azienda.getByText('You have not uploaded any products yet.').waitFor();
  check("Un'azienda nuova non vede prodotti altrui", true);
  await azienda.getByRole('button', { name: 'New product' }).click();
  await azienda.getByLabel('Product name').fill(titoloProdotto);
  await azienda.getByLabel('Description').fill('Unlined linen blazer with a soft cut.');
  await azienda.getByLabel('Item code').fill(`BLZ${stamp}`);
  await azienda.getByLabel('Add photo').setInputFiles({ name: 'blazer.png', mimeType: 'image/png', buffer: PNG });
  await azienda.locator('.galleria__voce img').waitFor();
  await azienda.waitForFunction(() => document.querySelector('.galleria__voce img')?.naturalWidth > 0);
  check('Foto caricata e visibile', true);
  await azienda.screenshot({ path: path.join(OUT, '7-nuovo-prodotto.png') });
  await azienda.getByRole('button', { name: 'Send for review' }).click();
  const riga = azienda.locator('.riga', { hasText: titoloProdotto });
  await riga.getByText('In review').waitFor();
  check('Prodotto inviato e in revisione', (await riga.innerText()).includes('S, M, L'));
  await azienda.waitForTimeout(300);
  await azienda.screenshot({ path: path.join(OUT, '8-prodotti-azienda.png') });
});

await step('Review', async () => {
  await admin.locator('.laterale').getByRole('link', { name: /^Review/ }).click();
  await admin.getByRole('heading', { name: 'Review', level: 1 }).waitFor();
  const riga = admin.locator('.riga', { hasText: titoloProdotto });
  await riga.waitFor();
  check('Il prodotto arriva in revisione con la foto', (await riga.locator('img').count()) === 1);
  await admin.screenshot({ path: path.join(OUT, '9-review.png') });
  await riga.getByRole('button', { name: 'Approve' }).click();
  await riga.waitFor({ state: 'detached' });
  check('Prodotto approvato', true);
  await azienda.reload();
  await azienda.locator('.riga', { hasText: titoloProdotto }).getByText('Live').waitFor();
  check("L'azienda vede subito lo stato Live", true);
  const altra = await accediAzienda('seller@mercur.dev');
  const elenco = await chiama('/vendor/products?limit=500&fields=id,title', altra);
  check("Un'altra azienda non vede il prodotto pubblicato", !(elenco.corpo.products ?? []).some((p) => p.title === titoloProdotto), `${elenco.corpo.products?.length} prodotti visibili`);
});

await step('Telefono', async () => {
  const p = await nuovaPagina({ viewport: { width: 390, height: 844 } });
  await p.goto(`${CONSOLE}/accesso-azienda`);
  await p.getByRole('heading', { name: 'Ishtar Lab' }).waitFor();
  check('Pagina di accesso senza scorrimento laterale su telefono', await senzaScorrimento(p));
  await accediAdminBrowser(p);
  await p.locator('.barra-basso').getByRole('link', { name: 'Analytics' }).waitFor({ timeout: 60000 });
  check('Barra del telefono', (await voci(p, '.barra-basso a, .barra-basso button')) === BARRA_TELEFONO, await voci(p, '.barra-basso a, .barra-basso button'));
  for (const [rotta, selettore, nome] of [['connettori', '.apps__barra', 'Apps'], ['aziende', '.azienda', 'Companies'], ['team', '.persona', 'Team'], ['registro', '.tabella', 'Activity log']]) {
    await p.goto(`${CONSOLE}/${rotta}`);
    await p.locator(selettore).first().waitFor();
    await p.waitForTimeout(300);
    check(`${nome} senza scorrimento laterale su telefono`, await senzaScorrimento(p));
    await p.screenshot({ path: path.join(OUT, `10-telefono-${rotta}.png`) });
  }
});

await step('Tema chiaro', async () => {
  const p = await nuovaPagina({ colorScheme: 'light' });
  await p.addInitScript("try { localStorage.setItem('ishtar-tema', 'chiaro') } catch {}");
  await accediAdminBrowser(p);
  await p.locator('.laterale').getByRole('link', { name: 'Help' }).waitFor({ timeout: 60000 });
  for (const rotta of ['aziende', 'team']) {
    await p.goto(`${CONSOLE}/${rotta}`);
    await p.locator(rotta === 'team' ? '.persona' : '.azienda').first().waitFor();
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `11-chiaro-${rotta}.png`), fullPage: true });
  }
  check('Tema chiaro attivo su Companies e Team', (await p.evaluate(() => document.documentElement.dataset.tema)) === 'chiaro');
});

await step('Pulizia', async () => {
  // Pulisce anche ciò che una prova interrotta ha lasciato.
  const connettori = await chiama('/admin/connectors', sessioneAdmin);
  for (const c of (connettori.corpo.connettori ?? []).filter((v) => v.id === 'demo' || (v.id === 'stripe' && v.stato === 'errore'))) await chiama(`/admin/connectors/${c.id}`, sessioneAdmin, { metodo: 'DELETE' });
  const prodotti = await chiama('/admin/products?limit=50&q=Prova%20blazer&fields=id,title', sessioneAdmin);
  for (const prodotto of (prodotti.corpo.products ?? []).filter((p) => p.title.startsWith('Prova blazer'))) await chiama(`/admin/products/${prodotto.id}`, sessioneAdmin, { metodo: 'DELETE' });
  const team = await chiama('/admin/team', sessioneAdmin);
  for (const invito of team.corpo.inviti.filter((i) => /^prova-(invito|console|collab2?|x)-/.test(i.email))) await chiama(`/admin/team/inviti/${invito.id}`, sessioneAdmin, { metodo: 'DELETE' });
  for (const persona of team.corpo.collaboratori.filter((c) => /^prova-(console|collab2?)-/.test(c.email))) await chiama(`/admin/team/${persona.id}`, sessioneAdmin, { metodo: 'DELETE' });
  // Le aziende non si cancellano: quelle di prova restano come chiuse.
  const aziende = await chiama('/admin/sellers?limit=100&fields=id,name,status', sessioneAdmin);
  const prova = (aziende.corpo.sellers ?? []).filter((a) => a.name.startsWith('Prova Atelier') && a.status !== 'terminated');
  for (const a of prova) {
    await chiama(`/admin/sellers/${a.id}/${a.status === 'pending_approval' ? 'approve' : 'suspend'}`, sessioneAdmin, { corpo: {} });
    if (a.status === 'pending_approval') await chiama(`/admin/sellers/${a.id}/suspend`, sessioneAdmin, { corpo: {} });
    await chiama(`/admin/sellers/${a.id}/terminate`, sessioneAdmin, { corpo: {} });
  }
  const dopo = await chiama('/admin/sellers?limit=100&fields=id,name,status', sessioneAdmin);
  check('Aziende di prova chiuse a fine prova', !(dopo.corpo.sellers ?? []).some((a) => a.name.startsWith('Prova Atelier') && a.status !== 'terminated'));
});

check('Nessun errore JavaScript nelle pagine', errori.length === 0, errori[0]?.slice(0, 120));
await browser.close();
chiudi('console operativa');
process.exit(process.exitCode ?? 0);
