---
title: "CRM omnicanale - piano tappa 3"
updated: 2026-11-13
type: documentazione-progetto
tags: [ishtar-lab]
---

# CRM tappa 3: email nella casella dei clienti — piano

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** le email dei clienti alla casella del negozio entrano nella casella dei clienti (pagina «Chats») e il team risponde dal pannello, nello stesso filo, una sola volta per risposta.

**Architettura:**
- **Connettore.** Una voce nuova nei connettori, «Shop mailbox» (IMAP e SMTP), con le credenziali cifrate come le altre.
- **Lettura.** Ogni minuto un job legge la Posta in arrivo in sola lettura, con un cursore salvato (UIDVALIDITY e ultimo UID), e traduce ogni email in un messaggio della conversazione del mittente. Messaggi automatici, liste e rimbalzi non aprono conversazioni; un rimbalzo segna come non consegnata la risposta a cui si riferisce.
- **Invio.** Le risposte partono direttamente con nodemailer, seguendo le fasi SMTP, con Message-ID, In-Reply-To, References e «Re:» per restare nel filo. Il Message-ID è deterministico dall'id della risposta.
- **Regole pure.** Analisi dell'email, testo, citazioni, filtri, intestazioni e rete sicura stanno in moduli puri provati con jest. IMAP e SMTP finti scritti in Node: nessun download.

**Tecnologie:**
- Medusa 2.22.3, Mercur 2.4.1, TypeScript, jest;
- librerie nuove approvate da Marco il 13/11: `imapflow` 2.11.0 (MIT) e `postal-mime` 4.2.1 (MIT-0), versioni esatte;
- `nodemailer` aggiornato da 7.0.13 a 10.5.0 (MIT-0, già presente; `bun audit` segnala 20 avvisi sulla 7.0.13, fra cui recapito a domini diversi da quello scritto e iniezione di intestazioni).

**Progetto:** [[CRM omnicanale - progetto]], tappa 3. Ricognizione del 13/11 (quattro letture: backend v1, versione 2, librerie e fornitori, prove locali) nel rapporto finale.

## Scelte (di satria64, su delega di Marco; Reda può cambiarle)

- **Casella intatta.** Si legge solo la Posta in arrivo con EXAMINE e BODY.PEEK: nessun flag cambia, le email restano «non lette» sul telefono di Reda. Nessuna copia in «Inviata»:
  - Gmail e Microsoft la salvano da soli;
  - per gli altri fornitori è un limite dichiarato, si può aggiungere con APPEND se Reda lo vuole.
- **Primo collegamento:** solo le email nuove da quel momento. Dopo un cambio di UIDVALIDITY si rileggono le ultime 24 ore e la chiave unica ferma i doppioni.
- **Una conversazione per contatto,** come Telegram. L'oggetto della conversazione è quello dell'ultima email.
- **Mittente e destinatario.**
  - Si risponde sempre all'indirizzo del mittente (From).
  - Un Reply-To diverso non si usa: si mostra come avviso.
  - Le risposte partono dall'indirizzo della casella, con il nome del mittente del connettore.
- **Niente collegamento automatico al cliente.** La scheda propone il cliente con la stessa email e il team conferma con un clic. La conferma dice se il dominio del mittente è verificato (DMARC secondo il server della casella) o no. DMARC verifica il dominio, non la persona.
- **Allegati:** un segnaposto con nome e dimensione («[Attachment: fattura.pdf, 120 KB]»), senza scaricarli. HTML mai mostrato: solo testo.
- **Citazioni.** Si mostra il testo nuovo; il testo intero resta e si apre con «Show quoted text».
- **Fornitori.**
  - Funzionano con password o password per app: Gmail, Aruba, Libero, Register.it, iCloud, Yahoo.
  - Outlook, Hotmail e Microsoft 365 accettano solo OAuth: non in questa tappa. Domanda a Reda fatta il 13/11.

## Vincoli globali

- **Ramo e file protetti.** Ramo `crm-tappa3` dal main f66c250. Non toccare `LICENSE.md`, `LICENSING-SCOPE.md`, `THIRD_PARTY_NOTICES.md`, `licensing/`, `frontend/legal/`: le licenze delle librerie nuove si elencano nella PR.
- **Percorsi** del backend relativi a `backend/piattaforma/packages/api/`. Testi per l'interfaccia ed errori in inglese, commenti in italiano.
- **Rete sicura.**
  - IMAP solo sulla 993 con TLS implicito.
  - SMTP sulla 465 (TLS implicito) o sulla 587 con STARTTLS obbligatorio (`requireTLS`).
  - Certificati sempre verificati.
  - L'host si risolve una volta: si accettano solo indirizzi pubblici (`indirizzoPubblico`) e ci si collega all'IP con `servername` = host.
  - Solo con `EMAIL_PROVE_LOCALI=1` e NODE_ENV diverso da production si ammettono 127.0.0.1 e localhost senza TLS (prove con i server finti).
- **Segreti fuori dai log.** Password, risposte del server, testi e indirizzi dei clienti non vanno in log, errori o risposte. Gli errori hanno testi fissi; i logger di imapflow e nodemailer sono spenti.
- **Mai due volte.** Una risposta email segue le regole della tappa 1:
  - lucchetto e chiave unica;
  - si scrive «tentato» prima dell'invio;
  - «fallito» solo se certamente non partita (rifiuto prima dei dati o rifiuto esplicito dopo);
  - «incerto» per ogni caduta dopo l'inizio dei dati.
- **Mai perso o doppio.**
  - La chiave del messaggio è `email:<casella>:<Message-ID>`, con impronta se oltre 200 caratteri. Senza Message-ID: `email:<casella>:uid:<UIDVALIDITY>:<UID>`.
  - Un messaggio illeggibile entra come segnaposto e non blocca la lettura.
  - Si tengono solo gli UID oltre il cursore («n:*» restituisce sempre l'ultimo).
- **Comandi.**
  - Migrazioni: `node infra/runtime.mjs generate conversazioni`, applicate con `node infra/migra.mjs`.
  - Test: da `backend/`, jest con `infra/jest-security.cjs`; typecheck come nelle tappe 1 e 2; dalla radice `node --test verifiche/*.test.mjs` e `python3 -m unittest verifiche/test_ponte.py`.
- **Prove dal vivo e nel browser** sull'istanza locale:
  - backup prima e ripristino alla fine;
  - IMAP finto in `strumenti-prova/imap-finto.mjs`, SMTP con Mailpit (127.0.0.1:51730, API 58730) e un SMTP finto per le cadute;
  - nessuna casella vera fino alla prova con la casella di prova di Marco.
- **Commit e PR.** Commit con l'email noreply di satria64 e la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR con la dichiarazione di `CONTRIBUTING.md`, le licenze nuove e la riga finale di Claude Code.

## Da tenere d'occhio nella revisione

1. **Risposta mandata due volte o data per fallita quando forse è arrivata:** caduta dopo l'inizio dei dati, timeout dopo il punto finale, doppio clic. Prove nel Task 5 con l'SMTP finto (caduta dopo DATA = incerto).
2. **Email persa o doppia.** Casi: «n:*» con l'ultimo già letto, UIDVALIDITY cambiata, Message-ID mancante o lunghissimo, email enorme o MIME rotto. Prove nel Task 4 con l'IMAP finto.
3. **Casella modificata:** un SELECT, un BODY[] senza PEEK, un flag. Prova nel Task 4: il registro dei comandi del finto contiene solo EXAMINE, ricerca e FETCH con PEEK.
4. **Dati del cliente alla persona sbagliata.**
   - Reply-To ostile: si risponde sempre al From.
   - In-Reply-To che punta al filo di un altro: una conversazione per contatto, il filo non cambia contatto.
   - Collegamento automatico: mai, solo una proposta.
   Prove nei Task 2 e 7.
5. **Host interno o connessione in chiaro** scelti nel connettore (SSRF, password in chiaro). Prove nel Task 3.

---

### Task 1: librerie e modello

**File:** `package.json` e `bun.lock` del workspace; `src/modules/conversazioni/models/` (campo `dettagli` del messaggio, modello `Cursore`); `service.ts` (chiave `Cursore`); migrazione generata.

**Interfacce:**
- **Librerie.** `bun add --exact nodemailer@10.5.0 imapflow@2.11.0 postal-mime@4.2.1` nel pacchetto api; se serve, `@types/nodemailer` compatibile.
- **Messaggio.** `messaggio_cliente.dettagli`: json nullable.
- **Cursore.** Modello `cursore_canale` (prefisso `curs`): `canale`, `account`, `cartella`, `uidvalidity` (testo), `ultimo_uid` (intero), con indice unico su canale + account + cartella.
- **Servizio:**
  - `leggiCursore(canale, account, cartella): Promise<{uidvalidity: string, ultimo_uid: number} | null>`;
  - `salvaCursore(canale, account, cartella, valore): Promise<void>`.

- [ ] **Step 1:** librerie installate; jest, typecheck e `e2e-console-magazzino.mjs` (gli inviti passano da nodemailer 10). Atteso: tutto come prima.
- [ ] **Step 2:** modello, campo, servizio e migrazione (generata ex novo, applicata sul database di prova dopo il backup). Atteso: tabelle nuove, jest verde.
- [ ] **Step 3: commit** `chore(api): nodemailer 10.5.0, imapflow, postal-mime e cursore dei canali`

### Task 2: regole pure dell'email

**File:** crea `src/modules/conversazioni/canali/email-regole.ts`; test `src/modules/conversazioni/__tests__/email-regole.unit.spec.ts` (email di prova costruite con il MailComposer di nodemailer e testi grezzi).

**Interfacce:**
- **Traduzione dell'email.** `traduciEmail(grezzo: Buffer, meta: {account: string, uid: number, uidvalidity: string, internaldate: Date}): Promise<Tradotta>` restituisce uno di questi tipi:
  - `{tipo: 'messaggio', inArrivo: InArrivo & {dettagli: DettagliEmail}}`;
  - `{tipo: 'automatico', motivo: string}`;
  - `{tipo: 'rimbalzo', message_id_originale: string | null, motivo: string}`;
  - `{tipo: 'nostro'}`, per il mittente uguale alla casella.
- **Dettagli.** `DettagliEmail = {message_id, in_reply_to, references: string[], oggetto, reply_to: string | null, verifica: 'verificato' | 'non_verificato' | 'sconosciuto', allegati: {nome, byte}[], testo_completo: string | null}`.
- **Testo e citazioni.**
  - `testoDaHtml(html): string`: niente librerie; script, style e head tolti, blocchi e `<br>` in a capo, entità decodificate.
  - `senzaCitazioni(testo): {nuovo: string, citato: boolean}`: «Il giorno … ha scritto:», «On … wrote:», «-----Original Message-----», «Da:/From:» seguito da «Inviato:/Sent:/Data:/Date:», righe con «>».
- **Filtri.** `automatico(intestazioni, mittente): string | null`:
  - Auto-Submitted diverso da `no`, X-Autoreply, X-Autorespond;
  - Precedence bulk, junk, list o auto_reply;
  - List-Id, List-Unsubscribe;
  - mittenti mailer-daemon, postmaster, no-reply, noreply, do-not-reply, bounce.
- **Rimbalzi.** `rimbalzo(email): {message_id_originale, motivo} | null`: rapporto RFC 3464 (parte message/delivery-status con Status e Diagnostic-Code, intestazioni del messaggio originale) oppure il testo di un MAILER-DAEMON con un Message-ID nostro.
- **Verifica del mittente.** `verificaMittente(intestazioni, dominioFrom)`: vale solo il primo `Authentication-Results`, aggiunto dal server della casella. `verificato` solo con `dmarc=pass` e `header.from` uguale al dominio del From.
- **Risposta.**
  - `intestazioniRisposta(ultimo: {message_id, references, oggetto}): {inReplyTo, references: string[], oggetto}`: References = quelle dell'ultimo + il suo Message-ID (al massimo 20); oggetto con un solo «Re: », tolti `Re:`, `R:`, `RIF:`, `AW:`, `Sv:` ripetuti.
  - `messageIdNostro(id_client, indirizzo): string` (`<crm.<id_client>@<dominio>>`).
  - `chiaveEmail(account, message_id | null, uidvalidity, uid): string`.
- **Lunghezze e segnaposto.**
  - Testo fino a 20 000 caratteri e oggetto fino a 300.
  - Segnaposto `[Attachment: nome, 120 KB]` e `[This email could not be read: open it in your mail app]`.

- [ ] **Step 1: test che falliscono**, uno per funzione, con questi casi:
  - email solo HTML;
  - citazione Gmail su due righe, Outlook italiano, «>»;
  - fuori sede con Auto-Submitted;
  - newsletter con List-Unsubscribe;
  - rapporto RFC 3464 con il Message-ID nostro;
  - due Authentication-Results, quello falso sotto e ignorato;
  - Reply-To diverso;
  - Message-ID mancante e di 500 caratteri;
  - oggetto «RE: R: Re: Ordine»;
  - From della casella stessa;
  - MIME rotto, che dà il segnaposto senza lanciare.
- [ ] **Step 2:** jest sul file. Atteso: FAIL (modulo assente).
- [ ] **Step 3:** implementazione con `postal-mime`.
- [ ] **Step 4:** jest e typecheck. Atteso: verde.
- [ ] **Step 5: commit** `feat(conversazioni): regole delle email`

### Task 3: connettore «Shop mailbox» e rete sicura

**File:**
- crea `src/modules/conversazioni/canali/email-rete.ts`;
- modifica `src/modules/connectors/catalogo.ts` (voce `casella_email`), `prova.ts` (prova personalizzata), `service.ts` (`segnaErrore` generico);
- test `email-rete.unit.spec.ts` e connettori;
- crea il server finto riusabile `src/modules/conversazioni/__tests__/finti/imap.ts` e `smtp.ts` (node:net).

**Interfacce:**
- **Rete.** `destinazione(host, porta, tipo: 'imap' | 'smtp', risolvi?): Promise<{indirizzo: string, servername: string, porta: number, tls: 'implicito' | 'starttls' | 'nessuno'}>`. Errori fissi:
  - `Use port 993 (SSL) for IMAP`;
  - `Use port 465 (SSL) or 587 (STARTTLS) for SMTP`;
  - `This server is not reachable on the public internet`.
- **Voce `casella_email`.**
  - Nome «Shop mailbox», fornitore «IMAP / SMTP», categoria `email`, accesso `chiave`.
  - Campi:
    - `indirizzo`;
    - `nome` (facoltativo);
    - `utente` (facoltativo, di solito l'indirizzo);
    - `password` (segreto);
    - `imap_host`, `imap_porta` (facoltativo, 993);
    - `smtp_host`, `smtp_porta` (facoltativo, 465).
  - Aiuti con i valori di Gmail, Aruba e Libero e la nota su Microsoft (solo OAuth, non ancora).
  - `valida`: indirizzo, host senza schema, percorso o spazi, porte numeriche.
- **Prova del collegamento.**
  - `Servizio.provaPersonalizzata?: (valori) => Promise<EsitoProva>`, usata da `eseguiProva` quando c'è.
  - Per la casella: login IMAP + EXAMINE INBOX, poi connessione e login SMTP **senza invio**; account = indirizzo.
  - Errori fissi:
    - `The mailbox refused the username or password`;
    - `The mail server can't be reached`;
    - `The server's security certificate is not valid`.
- **Errori del connettore.** `segnaErrore(id, messaggio, segreti?: string[])`: toglie ogni segreto dal messaggio (oggi solo il token di Telegram).

- [ ] **Step 1: test che falliscono.**
  - Host privati e locali rifiutati senza la variabile, ammessi con la variabile.
  - Porte sbagliate rifiutate.
  - Prova riuscita con i finti.
  - Password sbagliata con il messaggio fisso e la password mai negli errori.
  - Certificato rifiutato.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** jest e typecheck verdi.
- [ ] **Step 5: commit** `feat(connettori): casella email del negozio con rete sicura`

### Task 4: lettura della casella

**File:**
- crea `src/modules/conversazioni/canali/email-imap.ts`, `src/modules/conversazioni/ricezione-email.ts`, `src/jobs/ricevi-email.ts`;
- modifica `service.ts`: `registraInArrivo` con `dettagli`, `segnaRimbalzo`;
- test con l'IMAP finto.

**Interfacce:**
- **Lettura.** `leggiCasella(cred, cursore, {massimo = 50, crea?}): Promise<{messaggi: {uid, grezzo: Buffer | null, internaldate, dimensione}[], cursore, iniziale: boolean}>`:
  - client nuovo a ogni giro, `logger: false`;
  - EXAMINE INBOX;
  - primo collegamento: cursore a UIDNEXT−1 e nessun messaggio;
  - UIDVALIDITY cambiata: SEARCH SINCE ieri;
  - prima FETCH di UID, dimensione e data, poi `source` (BODY.PEEK[]) solo sotto 10 MB, altrimenti `grezzo: null` e il segnaposto;
  - si tengono solo gli UID oltre il cursore, in ordine.
- **Ricezione.** `riceviDaEmail(container)`, con il lucchetto `conversazioni:ricevi:email` e attesa 1 s:
  - credenziali da `credenzialiCollegate('casella_email')`;
  - cursore letto;
  - per ogni messaggio, `traduciEmail` e poi:
    - `messaggio`: `registraInArrivo`;
    - `rimbalzo`: `segnaRimbalzo`;
    - `automatico` o `nostro`: si salta.
  - Il cursore si salva dopo ogni messaggio.
  - Errori:
    - credenziali o certificato: `segnaErrore` con il testo fisso;
    - rete: solo il nome dell'errore nel log.
- **Rimbalzo.** `segnaRimbalzo(message_id, motivo)`: la risposta con `id_esterno` = quel Message-ID diventa `fallito` («The email was not delivered: …») e la conversazione torna al team.
- **Job:** ogni minuto, `riceviDaEmail(container)`.

- [ ] **Step 1: test che falliscono** (IMAP finto con registro dei comandi e guasti governabili):
  - primo collegamento senza import;
  - due email nuove registrate una volta;
  - «n:*» con l'ultimo già letto: nessun doppione;
  - UIDVALIDITY cambiata: rilettura senza doppioni;
  - email di 11 MB: segnaposto;
  - MIME rotto: segnaposto e cursore avanti;
  - rimbalzo che segna la risposta;
  - risposta automatica saltata;
  - registro con solo EXAMINE, UID SEARCH e UID FETCH con PEEK;
  - password sbagliata: connettore in errore, password assente dal log.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(conversazioni): lettura della casella email`

### Task 5: invio delle risposte email

**File:** crea `src/modules/conversazioni/canali/email-smtp.ts`; modifica `invio.ts` (ramo `email`), `service.ts` (`dettagliUscita`); test con l'SMTP finto.

**Interfacce:**
- **Invio.** `inviaEmail(cred, {a, oggetto, testo, messageId, inReplyTo, references}, {primaDellInvio}): Promise<EsitoUscita>`:
  - il messaggio si compone con `MailComposer` (From = nome e indirizzo della casella);
  - `SMTPConnection` a fasi;
  - il contenuto si passa con uno stream che segna l'inizio dei dati;
  - prima dei dati, ogni errore è `fallito`;
  - dopo l'inizio dei dati, un rifiuto con codice è `fallito` e una caduta, un timeout o un errore di socket sono `incerto`.
- **Ramo email di `consegna`.**
  1. Legge l'ultimo messaggio in arrivo e i suoi `dettagli`.
  2. Calcola `intestazioniRisposta` e `messageIdNostro(id_client, indirizzo)`.
  3. Salva con `dettagliUscita(messaggio.id, {message_id, in_reply_to, references, oggetto})`, che imposta anche `id_esterno`, **prima** del tentativo.
  4. Manda a `identita.id_contatto` (mai al Reply-To).
  5. Senza casella collegata: `fallito` «Email is not connected».

- [ ] **Step 1: test che falliscono** (SMTP finto):
  - consegna con le intestazioni del filo e l'oggetto «Re:»;
  - RCPT rifiutato: fallito;
  - caduta dopo DATA: incerto, mai ritentato con lo stesso id;
  - server irraggiungibile: fallito;
  - stesso id due volte insieme: una sola consegna;
  - password mai negli errori.
- [ ] **Step 2:** FAIL. **Step 3:** implementazione. **Step 4:** verdi.
- [ ] **Step 5: commit** `feat(conversazioni): risposte email nello stesso filo`

### Task 6: vista dei messaggi email

**File:** modifica `src/api/admin/conversazioni/lib/elenco.ts` (`vistaMessaggio`); test in `elenco.unit.spec.ts`.

**Interfacce:** `vistaMessaggio(m).email`, presente solo con `dettagli`. Contiene `{oggetto, reply_to, verifica, allegati, testo_completo}`; mai le intestazioni grezze né References.

- [ ] Test, FAIL, implementazione, verdi, commit `feat(conversazioni): dettagli delle email nella vista`.

### Task 7: pagina «Chats» per l'email e due ritocchi grafici

**File:** `frontend/ishtar-lab/chat/casella.mjs`, `chat.js`, `chat.css`; test `verifiche/chat-casella.test.mjs`.

**Interfacce** (in `casella.mjs`):
- `oggettoRisposta(oggetto)`, la stessa regola del backend;
- `ultimaEmail(messaggi)`;
- `avvisoRispondiA(messaggio)`: testo dell'avviso se `reply_to` è diverso dal mittente;
- `clienteConEmail(clienti, indirizzo)`: corrispondenza esatta senza maiuscole; con più clienti, nessuna proposta automatica e l'elenco.

**Pagina:**
- **Conversazione.**
  - Riga «Subject: Re: …» sopra la casella di scrittura.
  - Avviso Reply-To: `This email asks to reply to <x>. Replies go to <mittente>, the sender's address.`
  - Nella bolla, «Show quoted text» / «Hide quoted text» quando c'è `testo_completo`.
- **Scheda cliente.**
  - Proposta `This email address belongs to <cliente>` con «Link».
  - Conferma con la verifica: `The sender's domain is verified (DMARC)` oppure `The sender's address is not verified: it can be forged`.
- **Ritocchi grafici.** Menu dei canali a larghezza automatica (sul telefono «All channels» era tagliato); pulsante «Send» alto quanto la casella di scrittura.

- [ ] Test dei nuovi aiuti (FAIL → verdi), pagina e stile, prova rapida nel browser, commit `feat(pannello): email nella pagina Chats`.

### Task 8: prova completa, regressioni e documenti

- **Prova completa** (`strumenti-prova/e2e-email.mjs`, IMAP finto in `strumenti-prova/imap-finto.mjs`):
  - API avviata con `EMAIL_PROVE_LOCALI=1`;
  - connettore collegato ai finti con `medusa exec`;
  - email in arrivo nella pagina con l'oggetto;
  - risposta consegnata a Mailpit con In-Reply-To, References e «Re:», una volta sola anche con il doppio clic;
  - citazione nascosta e mostrata, avviso Reply-To;
  - risposta automatica non importata;
  - rimbalzo che segna la risposta;
  - email solo HTML e allegato;
  - proposta del cliente e collegamento;
  - SMTP che cade dopo DATA: «Not confirmed»;
  - casella mai modificata (registro del finto);
  - telefono.
- **Regressioni:**
  - pannello 18/18, 32/32, 8/8, 20/20;
  - Chats con Telegram (`e2e-chat.mjs`);
  - console con gli inviti (nodemailer 10).
- **Documenti:** `PROJECT.md`, `CHANGELOG.md`, vault (stato delle funzioni, progetto), `verifiche/crm-tappa3-2026-11-13.json`, prove nel pacchetto di consegna.
- **Fine:** ripristino del database, API senza variabili di prova.
- Commit `docs(crm): email nella casella, verifiche e cronologia`.

## Lasciato a chi costruisce

Nomi interni, testi secondari, struttura dei server finti, ordine dei casi della prova completa.

## Dopo la revisione

Revisione avversariale dell'intero ramo (quattro revisori e quattro scettici): 32 rilievi, tutti confermati, 23 distinti. Corretti i 2 critici e gli 8 importanti, ognuno con un test che falliva prima o con un caso della prova nel browser:

- **Rapporti dei server.** Solo un rapporto «Action: failed» per il destinatario della risposta, e non più vecchio del suo ultimo tentativo, è un rimbalzo. Avvisi di ritardo, consegne confermate, ricevute di lettura e testi di MAILER-DAEMON non segnano nulla (prima la risposta diventava «fallita» e «Retry» la rimandava).
- **Email ostili.** Citazioni, HTML e rapporti elaborati in tempo lineare e con limiti: un'email costruita apposta fermava l'API per minuti o ore.
- **Email che il server non dà.** Si riprova una per una; poi entra come segnaposto con la busta, o si salta con un avviso nel registro: la lettura non si ferma più per sempre.
- **Rifiuti passeggeri.** UNAVAILABLE all'accesso IMAP, 454 o 421 all'AUTH SMTP e un server che chiude prima del saluto non mettono più la casella in errore come una password sbagliata (testo «The mail server is busy: try again later»).
- **Rimbalzo su una chat chiusa.** La chat si riapre ed è da leggere.
- **Verifica DMARC.** Conta solo l'Authentication-Results del server della casella (dominio del server IMAP, per Gmail google.com, oppure il campo «Sender check server» del connettore); quello scritto dal mittente non vale.
- **Email falsa nella chat di un cliente.** Un'email che non passa DMARC ha un avviso nella bolla e non cambia nome del contatto, oggetto né filo della risposta; un From «<>» non ha mittente.
- **Invio nelle chat email.** Invio va a capo; si invia con «Send» o Ctrl/Cmd + Invio.
- **Password e server nuovo.** Cambiare server, porte, utente o indirizzo richiede di riscrivere la password, che altrimenti andrebbe da sola al server scelto da chi modifica; vale anche per il sito di WooCommerce.
- **Allegati di Apple Mail.** Le parti inline con un nome sono elencate; si tolgono solo le immagini usate dall'HTML.

Rimandati (minori, nel registro del piano): conferma del collegamento manuale senza la verifica, oggetto della risposta preso da un'email non ancora mostrata, proposta sulle prime 8 righe della ricerca, Reply-To e nomi degli allegati senza limite, testo citato nella regione viva, codici di certificato SMTP in originalCode, rimbalzi falsi ben formati, EMAIL_PROVE_LOCALI con NODE_ENV sempre development, UIDVALIDITY cambiata dopo più di 24 ore, ricollegamento dopo «Disconnect» che riparte dal vecchio cursore.

Verifiche finali:
- jest 365/365, node 131/131, typecheck 0; mutazioni delle correzioni 16/16;
- prova nel browser 58/58 da database pulito (IMAP finto, Mailpit, ponte SMTP che taglia);
- Chats con Telegram 67/67, pannello 18/18, 32/32, 8/8 e 20/20, console 7/7.

Rapporto: `verifiche/crm-tappa3-2026-11-13.json`.

