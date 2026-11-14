# Chat del sito — guida

La chat del sito porta in **Chats** di Ishtar Lab i messaggi che i visitatori scrivono sul sito del negozio, e riporta nella stessa finestra le risposte del team.

## Come funziona

1. Il visitatore scrive nella finestra della chat del sito (il file `widget/dist/ishtar-chat.js`).
2. Il messaggio aspetta in una **casella su Supabase**, un progetto usato solo per la chat.
3. Ishtar Lab legge la casella ogni pochi secondi, registra i messaggi in Chats e li conferma.
4. Le risposte partono dal pannello, passano dalla casella e il visitatore le vede nella finestra.

Il PC con Ishtar Lab non è mai raggiungibile da internet: fa solo chiamate in uscita, come per Telegram e per l'email. Se Ishtar Lab è spento, i messaggi aspettano nella casella e il widget dice «Al momento assenti». Entrano in Chats appena Ishtar Lab riparte.

Le chiavi sono due:

- la **chiave pubblicabile** (`sb_publishable_…`) va nel sito: con quella un visitatore può solo scrivere e leggere la propria conversazione;
- la **chiave segreta** (`sb_secret_…`) va solo in Ishtar Lab: non deve mai stare nel sito, in un messaggio o in un'email.

## Cosa serve

- Un account Supabase. Il piano gratuito basta per cominciare.
- Un account Cloudflare per Turnstile, il controllo anti-robot, anche quello gratuito.
- Chi gestisce il sito, per caricare un file e aggiungere una riga.

## Preparazione (una volta, la fa Reda)

### 1. Progetto Supabase

1. Su supabase.com crea un progetto nuovo, solo per la chat (per esempio «ishtar-chat»).
2. Come regione scegli **Central EU (Frankfurt)**.
3. Conserva la password del database in un gestore di password. A Ishtar Lab non serve.

### 2. SQL della chat

1. Apri **SQL Editor** → **New query**.
2. Incolla tutto il file `casella/supabase/migrations/20261114000000_casella.sql` e premi **Run**.

Il file crea lo schema privato `chat` (mai esposto) e le funzioni della chat. Quando esce una versione nuova dell'SQL, Ishtar Lab lo dice nel connettore («Run the latest chat SQL on the project»).

### 3. Accesso dei visitatori

1. Apri **Authentication → Sign In / Providers**.
2. Lascia attivo **Allow new users to sign up** e attiva **Allow anonymous sign-ins**.
3. In **Email**, spegni la registrazione con email: i visitatori entrano solo come anonimi, al primo messaggio.

Supabase limita già gli accessi anonimi a 30 l'ora per indirizzo IP.

### 4. Turnstile (anti-robot)

1. Nella dashboard di Cloudflare apri **Turnstile → Add widget**.
2. Come nome di dominio metti quello del negozio (con e senza `www`) e come modalità **Managed**.
3. Copia la **Site key**: va nello script del sito.
4. Copia la **Secret key** e incollala in Supabase, **Authentication → Attack Protection** → **Enable Captcha protection** → provider **Turnstile** → **Save**.

### 5. Schemi esposti

Apri **Project Settings → Data API**. Fra gli schemi esposti deve esserci solo `public`, mai `chat`.

### 6. Chiavi

1. Apri **Project Settings → API Keys**.
2. Copia la **publishable key** per lo script del sito.
3. Crea o copia una **secret key** per Ishtar Lab e conservala in un gestore di password.

### 7. Connettore in Ishtar Lab

1. Nella console apri **Apps** (pagina «Apps & connectors»), categoria **Messaging**, **Site chat**, e compila:
   - **Project URL**: l'indirizzo del progetto, `https://<rif>.supabase.co`.
   - **Secret key**: la chiave segreta.
   - **Name shown to visitors**: il nome che firma le risposte (per esempio «Ishtar Hub»).
2. Premi **Save and test**. Il connettore risulta collegato con il riferimento del progetto. Da quel momento la stessa finestra ha anche **Test**, per riprovarlo.

Se cambi il Project URL devi riscrivere la chiave segreta: non va da sola a un progetto nuovo.

## Per chi gestisce il sito

1. Carica sul sito il file `widget/dist/ishtar-chat.js`, sempre quello del repository. Per aggiornarlo sostituisci il file: non usare copie prese altrove.
2. Prima di `</body>`, in tutte le pagine, aggiungi:

```html
<script src="/percorso/ishtar-chat.js" async
  data-url="https://<rif>.supabase.co"
  data-chiave="sb_publishable_..."
  data-turnstile="<site key di Turnstile>"
  data-lingua="it"
  data-email="info@negozio.it"></script>
```

Gli attributi:

- `data-lingua`: `it` oppure `en`.
- `data-email` (facoltativo): l'indirizzo mostrato quando la chat non è raggiungibile.
- `data-ricorda="si"` (facoltativo): mostra al visitatore la casella «Ricorda questa chat su questo dispositivo». Senza, la conversazione vale finché resta aperta la scheda del browser.

Se nello script finisce la chiave segreta, il widget non parte e lo scrive nella console del browser. In quel caso la chiave segreta va cambiata subito:

1. in Supabase crea una nuova secret key;
2. incollala in Ishtar Lab (**Apps → Site chat → Secret key**) e premi **Test**;
3. elimina in Supabase la chiave finita nel sito.

Finché la chiave nuova non è in Ishtar Lab, la lettura si ferma e il connettore dice «The chat project refused the secret key».

**Content Security Policy.** Se il sito ne ha una, **aggiungi** queste origini alle direttive che ha già, senza togliere niente:

- `https://challenges.cloudflare.com` a `script-src` e a `frame-src`;
- `https://<rif>.supabase.co` a `connect-src`.

Il browser legge solo la prima copia di ogni direttiva, quindi non vanno aggiunte nuove righe `script-src`, `frame-src` o `connect-src` accanto a quelle che ci sono già. Se una di queste direttive manca, creala ripetendo anche quello che il sito ammette in `default-src` (di solito `'self'`). Per esempio, una politica che aveva `default-src 'self'` diventa:

```
default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://<rif>.supabase.co
```

Non servono `'unsafe-inline'` né `'unsafe-eval'`: lo stile del widget passa da un foglio costruito in JavaScript, che la CSP ammette. Se il sito autorizza gli script con un `nonce`, metti lo stesso `nonce` anche sul tag dello script del widget.

**Colore.** Il pulsante e i messaggi del visitatore usano un colore scuro con il testo bianco. Per cambiarlo, nel CSS del sito:

```css
ishtar-chat { --ishtar-chat-colore: #1d4ed8; }
```

Scegli un colore abbastanza scuro: il testo sopra resta bianco.

## Uso di tutti i giorni

- Con Ishtar Lab acceso i messaggi arrivano in Chats in pochi secondi. Se il visitatore non ha lasciato né nome né email compare come «Visitor XXXX»; se ha lasciato solo l'email, compare la sua email.
- Nome ed email li scrive il visitatore: nella scheda sono segnati «typed by the visitor, not verified» e non si collegano da soli a un cliente.
- Sotto il messaggio compare la pagina da cui il visitatore ha scritto. Il widget manda solo l'indirizzo della pagina, senza la parte dopo `?` e `#`.
- Il widget dice «Online» quando Ishtar Lab ha letto la casella negli ultimi 2 minuti, altrimenti «Al momento assenti».
- Se una risposta resta «Not confirmed yet: checking with the site chat…», Ishtar Lab la cerca nella casella da solo. Entro un paio di minuti diventa «Sent», oppure «Not sent» con **Retry**: in quel caso la chat torna fra quelle aperte, anche se era stata chiusa, con un segno da leggere. Riprovare non la duplica mai. Se dopo 10 minuti è ancora incerta, la verifica non sta girando (per esempio il connettore è da sistemare): la chat lo dice e offre **Send again**.

## Limiti e sicurezza

- Ogni visitatore può mandare al massimo 20 messaggi in 10 minuti e 200 al giorno, di 4000 caratteri al massimo ciascuno.
- Se 5000 messaggi aspettano senza essere importati, la casella non ne accetta altri: succede solo se Ishtar Lab resta spento a lungo durante un'ondata di messaggi.
- I visitatori non vedono mai le tabelle: entrano solo dalle funzioni del visitatore e vedono solo la propria conversazione.
- Una sola installazione di Ishtar Lab alla volta può leggere la casella. Se ne parte una seconda, il connettore va in errore: «Another Ishtar Lab is reading this site chat». Ferma l'altra installazione, aspetta 10 minuti e premi Test. Il controllo riconosce le installazioni dal loro database: non collegare alla stessa casella un Ishtar Lab avviato con una copia del database di un altro, perché i due si dividerebbero i messaggi senza accorgersene.
- **Piano gratuito di Supabase:** dopo una settimana di poca attività il progetto va in pausa. Supabase avvisa per email circa una settimana prima, e lo si riprende dalla dashboard. Con Ishtar Lab acceso la casella viene letta di continuo.

## Pulizia e conservazione (da decidere)

La funzione `chat_pulizia(giorni_importati, giorni_anonimi)` toglie:

- le conversazioni già importate in Ishtar Lab più vecchie dei giorni indicati;
- gli utenti anonimi rimasti senza conversazione.

Non tocca mai un messaggio non ancora importato. I giorni li decide Reda insieme all'informativa. Per farla girare ogni notte, in **Database → Extensions** attiva `pg_cron`, poi nell'SQL Editor esegui, per esempio con 30 giorni:

```sql
select cron.schedule('pulizia-chat', '0 3 * * *', $$select public.chat_pulizia(30, 30)$$);
```

## Bozze da far validare

**Avviso nel widget** (già presente, sopra i messaggi):

> I tuoi messaggi e la pagina da cui scrivi arrivano al negozio. Non scrivere mai password o numeri di carte.

**Paragrafo per l'informativa privacy** (bozza, da far controllare a chi segue la privacy del negozio):

> **Chat del sito.** Se ci scrivi con la chat del sito trattiamo il testo dei messaggi, la pagina da cui scrivi e, solo se li inserisci, nome ed email, per risponderti. Prima del primo messaggio un controllo anti-robot di Cloudflare (Turnstile) verifica che tu non sia un programma automatico; per questo controllo e per l'accesso alla chat Cloudflare e Supabase trattano anche l'indirizzo IP e i dati tecnici del browser. I messaggi passano da Supabase, in un data center dell'Unione europea (Francoforte), dove restano per [N] giorni dopo l'ultimo messaggio della conversazione; una copia è conservata nel nostro gestionale per [M]. Il tuo browser conserva solo l'accesso alla conversazione: finché chiudi la scheda, oppure sul dispositivo se scegli «Ricorda questa chat». Puoi chiederci in ogni momento di vedere o cancellare i tuoi messaggi scrivendo a [email].

La pulizia nella casella avviene solo se la funzione `chat_pulizia` è pianificata (sezione precedente); la copia in Ishtar Lab segue le regole di conservazione del gestionale, da decidere a parte.

## Prove in locale (per chi sviluppa)

**Casella.** Serve Docker:

```bash
cd chat-sito/casella
npm run avvia    # Supabase locale con la CLI 2.122.0
npm run prove    # prove pgTAP (60)
npm run azzera   # database della casella da capo
npm run ferma
```

**Widget.** Serve bun:

```bash
cd chat-sito/widget
bun install --frozen-lockfile
bun costruisci.mjs   # ricostruisce dist/ishtar-chat.js: uguale byte per byte con bun 1.4.4
```

**Ishtar Lab.** Il connettore accetta un indirizzo `http://127.0.0.1:<porta>` solo con `SITO_PROVE_LOCALI=1`, mai con `NODE_ENV=production`. La Supabase locale usa le chiavi di prova di Turnstile di Cloudflare.
