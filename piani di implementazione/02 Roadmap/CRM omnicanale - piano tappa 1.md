---
title: "CRM omnicanale - piano tappa 1"
updated: 2026-11-13
type: documentazione-progetto
tags: [ishtar-lab]
---

# CRM tappa 1: nucleo delle conversazioni e canale Telegram — piano

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un compito alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** il backend riceve i messaggi dei clienti da Telegram, li tiene in conversazioni collegabili ai clienti del negozio, e il team risponde dall'API, una sola volta per risposta.

**Architettura:** modulo Medusa nuovo `conversazioni` (identità del contatto, conversazioni, messaggi, risposte rapide, cursori dei canali), regole pure separate e provate a parte, adattatore Telegram con `fetch`, un job che legge Telegram ogni minuto (getUpdates) e un aiuto d'invio idempotente usato dalla rotta. Le credenziali restano nel modulo connettori, che dà ai canali un accesso solo lato server.

**Tecnologie:** Medusa 2.22.3 e Mercur 2.4.1 già installati, TypeScript, jest con la configurazione `backend/infra/jest-security.cjs`. Nessuna dipendenza nuova.

**Progetto:** [[CRM omnicanale - progetto]] (stessa cartella).

## Vincoli globali

- Ramo `crm-tappa1` dal main 3d8a0f3. Non toccare `LICENSE.md`, `LICENSING-SCOPE.md`, `THIRD_PARTY_NOTICES.md`, `licensing/`, `frontend/legal/`.
- Percorsi del backend relativi a `backend/piattaforma/packages/api/`.
- Chiavi del servizio del modulo (`MedusaService({ ... })`) che finiscono in «a» o in «e»: per le parole in «o» il plurale dei tipi (`Messaggioes`) è diverso da quello a runtime (`Messaggios`), e i metodi generati non esisterebbero.
- Testi per l'interfaccia e messaggi d'errore delle rotte in inglese, commenti in italiano, come il resto del backend.
- Il token Telegram sta nell'indirizzo delle chiamate: non deve mai finire in un messaggio d'errore, in un log o in una risposta.
- `TELEGRAM_API_BASE` (indirizzo dell'API Telegram, predefinito `https://api.telegram.org`) si usa solo per le prove; in produzione un valore non HTTPS si ignora.
- Identificativo di una risposta mandato dal pannello: `^[A-Za-z0-9_-]{8,80}$` (lo stesso delle correzioni del Magazzino).
- Lunghezza di una risposta: da 1 a 4000 caratteri (Telegram ne accetta 4096).
- Test: da `backend/`, `node piattaforma/packages/api/node_modules/jest/bin/jest.js --config infra/jest-security.cjs --runInBand`; typecheck: `node piattaforma/node_modules/typescript/bin/tsc -p piattaforma/packages/api/tsconfig.json --noEmit --incremental false`.
- Prove dal vivo solo sull'istanza locale: backup del database prima (`pg_dump`), ripristino alla fine con il metodo del database separato e dello scambio dei nomi.
- Commit con l'email noreply di satria64 e la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; descrizione della PR con la dichiarazione di `CONTRIBUTING.md` e la riga finale di Claude Code.

## Da tenere d'occhio nella revisione

1. **Lo stesso aggiornamento Telegram letto due volte** (il job si ferma dopo aver registrato e prima di salvare il cursore, oppure due giri si sovrappongono): un solo messaggio nella conversazione. Prova nel compito 3 (registrazione ripetuta) e nel compito 5 (cursore salvato solo dopo la registrazione).
2. **Doppio clic su «Invia»** (due richieste uguali insieme): il cliente riceve un solo messaggio. Prova nel compito 8 (due chiamate parallele, il server finto conta un solo sendMessage).
3. **Token nei messaggi d'errore o nei log**: mai. Prova nel compito 2 (ogni errore del client senza il token) e nel compito 8 (errore del job salvato nel connettore senza il token).
4. **Il cliente riscrive dopo la chiusura**: la stessa conversazione si riapre con il messaggio non letto, invece di una conversazione nuova nascosta. Prova nel compito 3.
5. **Bot con un webhook impostato (409) o token revocato (401)**: il connettore passa in errore con un messaggio chiaro e il job si ferma fino a una nuova prova dalla console, senza tentativi a raffica. Prova nel compito 2 (codici) e nel compito 8 (server finto che risponde 409).

---

### Compito 1: regole pure della casella

**File:**
- Crea: `src/modules/conversazioni/tipi.ts`, `src/modules/conversazioni/regole.ts`
- Test: `src/modules/conversazioni/__tests__/regole.unit.spec.ts`
- Modifica: `backend/infra/jest-security.cjs` (aggiungere a `testMatch` `'**/conversazioni/__tests__/*.unit.spec.ts'` e `'**/admin/conversazioni/__tests__/*.unit.spec.ts'`)

**Interfacce:**
- Produce (`tipi.ts`):
  - `type Canale = "telegram" | "email" | "sito" | "whatsapp" | "instagram" | "messenger"`
  - `type StatoConversazione = "aperta" | "in_attesa" | "chiusa"`
  - `type Direzione = "entrata" | "uscita"`
  - `type StatoConsegna = "ricevuto" | "in_coda" | "inviato" | "fallito"`
  - `type InArrivo = { canale: Canale; account: string; id_contatto: string; nome: string | null; recapito: string | null; id_messaggio: string; testo: string; quando: Date; oggetto?: string | null }`
- Produce (`regole.ts`):
  - `ID_CLIENT: RegExp` = `/^[A-Za-z0-9_-]{8,80}$/`
  - `estratto(testo: string, massimo = 140): string`: spazi e a capo compressi in uno spazio, oltre `massimo` taglia e finisce con «…» (lunghezza totale `massimo`)
  - `chiaveInArrivo(e: Pick<InArrivo, "canale" | "account" | "id_messaggio">): string` → `${canale}:${account}:${id_messaggio}`
  - `chiaveUscita(id_client: string): string` → `uscita:${id_client}`
  - `statoDopo(stato: StatoConversazione, direzione: Direzione): StatoConversazione`: entrata → `aperta` (anche da chiusa); uscita da aperta o in_attesa → `in_attesa`; uscita da chiusa → errore `MedusaError NOT_ALLOWED` «This conversation is closed: reopen it to reply»
  - `decidiInvio(esistente: { stato_consegna: StatoConsegna } | null): "invia" | "gia_inviato" | "in_corso"`: null o fallito → invia; inviato → gia_inviato; in_coda → in_corso

- [ ] **Passo 1: test che falliscono**

```ts
import { chiaveInArrivo, chiaveUscita, decidiInvio, estratto, ID_CLIENT, statoDopo } from "../regole"

describe("regole della casella", () => {
  it("estratto: spazi compressi e taglio con i puntini", () => {
    expect(estratto("Ciao\n\n  come   va?")).toBe("Ciao come va?")
    const lungo = estratto("a".repeat(200))
    expect(lungo).toHaveLength(140)
    expect(lungo.endsWith("…")).toBe(true)
  })
  it("chiavi uniche di entrata e di uscita", () => {
    expect(chiaveInArrivo({ canale: "telegram", account: "negozio_bot", id_messaggio: "123:45" })).toBe("telegram:negozio_bot:123:45")
    expect(chiaveUscita("abc12345")).toBe("uscita:abc12345")
  })
  it("stato dopo un messaggio", () => {
    expect(statoDopo("chiusa", "entrata")).toBe("aperta")
    expect(statoDopo("in_attesa", "entrata")).toBe("aperta")
    expect(statoDopo("aperta", "uscita")).toBe("in_attesa")
    expect(statoDopo("in_attesa", "uscita")).toBe("in_attesa")
    expect(() => statoDopo("chiusa", "uscita")).toThrow(/closed/)
  })
  it("decisione d'invio: si manda solo ciò che non è già partito o in partenza", () => {
    expect(decidiInvio(null)).toBe("invia")
    expect(decidiInvio({ stato_consegna: "fallito" })).toBe("invia")
    expect(decidiInvio({ stato_consegna: "inviato" })).toBe("gia_inviato")
    expect(decidiInvio({ stato_consegna: "in_coda" })).toBe("in_corso")
  })
  it("identificativo di una risposta", () => {
    expect(ID_CLIENT.test("a1B2c3D4")).toBe(true)
    expect(ID_CLIENT.test("abc")).toBe(false)
    expect(ID_CLIENT.test("a b c d e f g h")).toBe(false)
  })
})
```

- [ ] **Passo 2:** da `backend/`, eseguire jest su `regole.unit.spec.ts`. Atteso: FAIL, modulo `../regole` mancante.
- [ ] **Passo 3:** scrivere `tipi.ts` e `regole.ts` con le firme sopra.
- [ ] **Passo 4:** jest sullo stesso file. Atteso: 5 test superati.
- [ ] **Passo 5:** commit `feat(conversazioni): regole pure della casella`.

### Compito 2: adattatore Telegram

**File:**
- Crea: `src/modules/conversazioni/canali/telegram.ts`
- Test: `src/modules/conversazioni/__tests__/telegram.unit.spec.ts`
- Modifica: `src/modules/connectors/catalogo.ts` (voce `telegram`: la prova usa `baseTelegram()`)

**Interfacce:**
- Consuma: `InArrivo` (compito 1).
- Produce:
  - `baseTelegram(): string`: `TELEGRAM_API_BASE` se impostata e (HTTPS oppure `NODE_ENV !== "production"`), altrimenti `https://api.telegram.org`; senza la barra finale
  - `class ErroreCanale extends Error { codice: "credenziali" | "webhook" | "limite" | "bloccato" | "richiesta" | "servizio" | "rete" }` (con `name = "ErroreCanale"`)
  - `normalizzaAggiornamento(u: unknown, account: string): InArrivo | null`
  - `clientTelegram(token: string, chiama: typeof fetch = fetch): { account(): Promise<string>; leggi(offset: number | null, attesa: number): Promise<AggiornamentoTelegram[]>; invia(chat_id: string, testo: string): Promise<{ id_esterno: string }> }`
  - `type AggiornamentoTelegram = { update_id: number; [k: string]: unknown }`

Regole che i test fissano:
- solo `message` di chat private (`chat.type === "private"`) e non di bot (`from.is_bot`); `edited_message`, gruppi e altri aggiornamenti danno null;
- `id_contatto` = `String(chat.id)`, `id_messaggio` = `${chat.id}:${message_id}`, `quando` = `new Date(date * 1000)`, `recapito` null;
- `nome` = nome e cognome; se mancano, lo username; altrimenti null;
- testo = `text`, altrimenti `caption`; senza testo: «[Photo]», «[Sticker]», «[Voice message]», «[Document]», altrimenti «[Attachment]»;
- chiamate POST JSON a `${baseTelegram()}/bot${token}/<metodo>`: `getUpdates` con `{ offset?, timeout: attesa, allowed_updates: ["message"] }` (senza `offset` quando è null), `sendMessage` con `{ chat_id, text }`, `getMe`;
- risposte: 401 o 404 → `credenziali` («Telegram refused the bot token»); 403 → `bloccato` («The customer blocked the bot or never started it»); 409 → `webhook` («A webhook is set on this bot: remove it to read messages here»); 429 → `limite` («Telegram is limiting requests: try again shortly»); altri 4xx → `richiesta` («Telegram refused the message: <description>»); 5xx → `servizio`; `fetch` che lancia → `rete` («Telegram can't be reached»).

- [ ] **Passo 1: test che falliscono** (`fetch` finto che registra indirizzo e corpo; token di prova `123456:SEGRETO-di-prova`)

```ts
describe("normalizzaAggiornamento", () => {
  const base = { update_id: 10, message: { message_id: 45, date: 1794560000, chat: { id: 123, type: "private" }, from: { id: 123, is_bot: false, first_name: "Mario", last_name: "Rossi" }, text: "Ciao" } }
  it("messaggio privato di testo", () => {
    expect(normalizzaAggiornamento(base, "negozio_bot")).toEqual({
      canale: "telegram", account: "negozio_bot", id_contatto: "123", nome: "Mario Rossi", recapito: null,
      id_messaggio: "123:45", testo: "Ciao", quando: new Date(1794560000 * 1000),
    })
  })
  it("didascalia, poi segnaposto per foto, sticker, vocale, documento e altro", () => { /* caption → testo; photo → "[Photo]"; sticker → "[Sticker]"; voice → "[Voice message]"; document → "[Document]"; location → "[Attachment]" */ })
  it("username se mancano nome e cognome; null se manca tutto", () => { /* from { id: 123, is_bot: false, username: "mrossi" } → nome "mrossi"; from { id: 123, is_bot: false } → nome null */ })
  it("ignora gruppi, bot e messaggi modificati", () => { /* chat.type "group" → null; from.is_bot → null; { update_id, edited_message } → null */ })
})

describe("clientTelegram", () => {
  it("getUpdates con offset, attesa e solo i messaggi; senza offset quando è null", async () => { /* corpo { offset: 11, timeout: 25, allowed_updates: ["message"] }; poi senza la chiave offset */ })
  it("sendMessage restituisce l'id esterno chat:messaggio", async () => { /* risposta { ok: true, result: { message_id: 99, chat: { id: 123 } } } → { id_esterno: "123:99" } */ })
  it("usa TELEGRAM_API_BASE fuori produzione", async () => { /* process.env.TELEGRAM_API_BASE = "http://127.0.0.1:9999" → indirizzo che inizia così */ })
  it.each([[401, "credenziali"], [404, "credenziali"], [403, "bloccato"], [409, "webhook"], [429, "limite"], [400, "richiesta"], [502, "servizio"]])(
    "risposta %i → %s, senza il token nel messaggio", async (stato, codice) => {
      // expect(errore).toBeInstanceOf(ErroreCanale); expect(errore.codice).toBe(codice); expect(errore.message).not.toContain("SEGRETO")
    })
  it("rete irraggiungibile → «rete», senza il token", async () => { /* fetch che lancia TypeError("fetch failed https://.../bot123456:SEGRETO-di-prova/getMe") */ })
})
```

- [ ] **Passo 2:** jest su `telegram.unit.spec.ts`. Atteso: FAIL, modulo mancante.
- [ ] **Passo 3:** scrivere `canali/telegram.ts`; nel catalogo dei connettori, `prova` di `telegram` usa `${baseTelegram()}/bot${v.bot_token}/getMe`.
- [ ] **Passo 4:** jest su tutto. Atteso: tutto verde (il test del catalogo dei connettori resta verde).
- [ ] **Passo 5:** commit `feat(conversazioni): adattatore Telegram senza il token negli errori`.

### Compito 3: modulo conversazioni

**File:**
- Crea: `src/modules/conversazioni/index.ts`, `models/identita.ts`, `models/conversazione.ts`, `models/messaggio.ts`, `models/risposta-rapida.ts`, `models/cursore.ts`, `service.ts`, `src/links/identita-cliente.ts`, migrazione generata in `src/modules/conversazioni/migrations/`
- Modifica: `medusa-config.ts` (`MODULI_SEZIONI` con `'conversazioni'`)

**Interfacce:**
- Consuma: `tipi.ts`, `regole.ts` (compito 1).
- Produce:
  - `CONVERSAZIONI_MODULE = "conversazioni"`; `ConversazioniModuleService extends MedusaService({ Conversazione, Battuta: Messaggio, Identita, RispostaRapida, Cursore })`
  - Modelli (tabella, prefisso dell'id):
    - `identita_contatto` («idc»): `canale` enum dei canali, `account` testo, `id_contatto` testo, `nome` e `recapito` testo nullable, `cliente_id` testo nullable; indice unico `(canale, account, id_contatto)`, indice `cliente_id`
    - `conversazione_cliente` («conv»): `canale`, `identita` (belongsTo), `stato` enum default `aperta`, `oggetto` nullable, `ultimo_messaggio_il` dateTime, `ultimo_estratto` testo, `non_letti` numero default 0; indici `stato`, `ultimo_messaggio_il`
    - `messaggio_cliente` («msgc»): `conversazione` (belongsTo, cancellazione a cascata dalla conversazione), `direzione` enum, `testo`, `quando` dateTime, `chiave_unica` testo con indice unico, `id_esterno` nullable, `stato_consegna` enum, `errore` nullable, `autore_id` e `autore_nome` nullable
    - `risposta_rapida` («rrap»): `titolo`, `testo`
    - `cursore_canale` («cur»): `canale`, `account`, `valore`; indice unico `(canale, account)`
  - Metodi del servizio:
    - `type MessaggioDTO = InferTypeOf<typeof Messaggio>` (esportato da `service.ts`)
    - `registraInArrivo(e: InArrivo): Promise<{ conversazione_id: string; messaggio_id: string; nuovo: boolean }>`: messaggio già registrato (stessa `chiave_unica`) → `nuovo: false` senza scrivere; identità per `(canale, account, id_contatto)` creata o aggiornata (nome e recapito); conversazione = l'ultima dell'identità, riaperta se chiusa, altrimenti nuova; messaggio `entrata` con stato `ricevuto`; conversazione con `statoDopo`, `ultimo_messaggio_il`, `ultimo_estratto`, `non_letti + 1`. Un errore di unicità (due registrazioni insieme) si tratta come «già registrato».
    - `preparaUscita(conversazione_id: string, u: { testo: string; id_client: string; autore: { id: string; nome: string } }): Promise<{ messaggio: MessaggioDTO; decisione: "invia" | "gia_inviato" | "in_corso" }>`: conversazione chiusa → NOT_ALLOWED; `id_client` già usato in un'altra conversazione → INVALID_DATA «This message id was already used»; altrimenti messaggio `uscita` in coda (o quello esistente secondo `decidiInvio`, un `fallito` torna in coda), conversazione `in_attesa`, `non_letti` 0.
    - `esitoUscita(messaggio_id: string, esito: { stato: "inviato"; id_esterno: string } | { stato: "fallito"; errore: string }): Promise<void>`
    - `cambiaStato(id: string, stato: "aperta" | "chiusa"): Promise<void>`; `segnaLetta(id: string): Promise<void>`; `collegaCliente(identita_id: string, cliente_id: string | null): Promise<void>`
    - `leggiCursore(canale: Canale, account: string): Promise<string | null>`; `salvaCursore(canale: Canale, account: string, valore: string): Promise<void>`
  - Legame di sola lettura `identita_contatto.cliente_id` → cliente Medusa, come `src/links/outfit-capo-prodotto.ts`.

- [ ] **Passo 1:** scrivere modelli, servizio e `index.ts`; aggiungere il modulo a `MODULI_SEZIONI`; typecheck. Atteso: 0 errori.
- [ ] **Passo 2:** generare la migrazione con l'API ferma: da `backend/`, `node infra/runtime.mjs generate conversazioni`; controllare il file (tabelle, indici unici); applicarla con `node infra/runtime.mjs migrate`; riavviare l'API (`node infra/runtime.mjs start`).
- [ ] **Passo 3: prova dal vivo che fallisce prima** — script temporaneo `src/scripts/_prova-crm.ts` (`medusa exec`) con queste verifiche, eseguito prima di scrivere `registraInArrivo` e gli altri metodi (atteso: errore «is not a function»), poi dopo:
  - stesso `InArrivo` registrato due volte → la seconda `nuovo: false`, un solo messaggio, `non_letti` 1;
  - secondo messaggio dello stesso contatto → stessa conversazione, `non_letti` 2, estratto aggiornato;
  - `cambiaStato(id, "chiusa")`, poi un messaggio nuovo → stessa conversazione, di nuovo `aperta`, `non_letti` 3;
  - `preparaUscita` due volte con lo stesso `id_client` → «invia» e poi «in_corso», un solo messaggio; dopo `esitoUscita(inviato)` → «gia_inviato»; dopo un `fallito` → di nuovo «invia» sullo stesso messaggio;
  - `preparaUscita` su una conversazione chiusa → NOT_ALLOWED; stesso `id_client` su un'altra conversazione → INVALID_DATA;
  - `salvaCursore` e `leggiCursore` restituiscono l'ultimo valore.
- [ ] **Passo 4:** jest e typecheck verdi; commit `feat(conversazioni): modulo con identità, conversazioni, messaggi e cursori` (migrazione compresa, script temporaneo escluso).

### Compito 4: credenziali dei canali dal modulo connettori

**File:**
- Modifica: `src/modules/connectors/service.ts`

**Interfacce:**
- Produce:
  - `credenzialiCollegate(id: string): Promise<{ valori: Valori; token?: Token; account: string | null } | null>`: solo se il conto esiste ed è `collegato` e le credenziali si leggono; mai esposto da una rotta
  - `segnaErrore(id: string, messaggio: string): Promise<void>`: stato `errore`, `last_error`, `last_checked_at`

- [ ] **Passo 1:** nello script temporaneo, verifiche che falliscono: con un server Telegram finto su 127.0.0.1 e `TELEGRAM_API_BASE`, `salva("telegram", { bot_token })` porta il conto a `collegato` con l'account del finto `getMe`; `credenzialiCollegate("telegram")` restituisce token e account; dopo `segnaErrore` restituisce null e l'elenco dei connettori mostra l'errore senza il token.
- [ ] **Passo 2:** scrivere i due metodi; rieseguire. Atteso: verifiche superate.
- [ ] **Passo 3:** commit `feat(connectors): credenziali per i canali, solo lato server`.

### Compito 5: lettura di Telegram

**File:**
- Crea: `src/modules/conversazioni/ricezione.ts`, `src/jobs/ricevi-telegram.ts`
- Test: `src/modules/conversazioni/__tests__/ricezione.unit.spec.ts`

**Interfacce:**
- Consuma: `clientTelegram`, `normalizzaAggiornamento`, `ErroreCanale` (compito 2); `registraInArrivo`, `leggiCursore`, `salvaCursore` (compito 3); `credenzialiCollegate`, `segnaErrore` (compito 4).
- Produce:
  - `elaboraAggiornamenti(aggiornamenti: { update_id: number }[], registra: (u: { update_id: number }) => Promise<void>): Promise<{ prossimo: number | null; errore: unknown | null }>`: in ordine; al primo errore si ferma e `prossimo` è l'`update_id` fallito (riletto la volta dopo); se tutto va, `prossimo` = ultimo `update_id` + 1; lista vuota → `{ prossimo: null, errore: null }`
  - `riceviDaTelegram(container: MedusaContainer, opzioni: { giri: number; attesa: number }): Promise<"spento" | "occupato" | "fatto" | "errore">`: lucchetto `conversazioni:ricevi:telegram` (attesa 1 s; se occupato, «occupato»); senza credenziali collegate, «spento»; per ogni giro: cursore → `leggi` → `elaboraAggiornamenti` (aggiornamenti non normalizzabili si saltano ma il cursore avanza) → cursore salvato; `ErroreCanale` `credenziali` o `webhook` → `segnaErrore("telegram", messaggio)` e «errore»; nei log solo testi senza token
  - job `ricevi-telegram`, ogni minuto (`"* * * * *"`), con `{ giri: 2, attesa: 25 }`

- [ ] **Passo 1: test che falliscono** per `elaboraAggiornamenti`: tutti registrati → `prossimo` 13 per gli id 10, 11, 12 e tre chiamate in ordine; errore sull'11 → `prossimo` 11, `errore` presente, due chiamate; lista vuota → null.
- [ ] **Passo 2:** jest. Atteso: FAIL, modulo mancante.
- [ ] **Passo 3:** scrivere `ricezione.ts` e il job.
- [ ] **Passo 4:** jest verde; nello script dal vivo: il server finto restituisce due aggiornamenti → due messaggi e cursore all'id + 1; un secondo giro con lo stesso offset non duplica; risposta 409 → connettore in errore con il messaggio del webhook, giro successivo «spento».
- [ ] **Passo 5:** commit `feat(conversazioni): lettura di Telegram ogni minuto con il cursore`.

### Compito 6: invio delle risposte

**File:**
- Crea: `src/modules/conversazioni/invio.ts`

**Interfacce:**
- Consuma: `preparaUscita`, `esitoUscita` (compito 3); `clientTelegram`, `ErroreCanale` (compito 2); `credenzialiCollegate`, `segnaErrore` (compito 4).
- Produce: `inviaRisposta(scope: MedusaContainer, conversazione_id: string, u: { testo: string; id_client: string; autore: { id: string; nome: string } }): Promise<MessaggioDTO>`: sotto il lucchetto `conversazioni:uscita:<id_client>` (30 s); se la decisione non è «invia» restituisce il messaggio com'è; Telegram → `invia(id_contatto, testo)` → `esitoUscita(inviato)`; `ErroreCanale` → `esitoUscita(fallito, messaggio)` (e `segnaErrore` se `credenziali`); Telegram non collegato → fallito «Telegram is not connected»; altri canali → fallito «Replies on this channel are not available yet».

- [ ] **Passo 1:** nello script dal vivo, verifiche che falliscono: risposta inviata → il server finto riceve `sendMessage` con chat e testo, messaggio `inviato` con `id_esterno`; stessa risposta rimandata → nessun secondo `sendMessage`; server finto che risponde 403 → messaggio `fallito` con «blocked»; rimandata dopo → nuovo tentativo sullo stesso messaggio.
- [ ] **Passo 2:** scrivere `invio.ts`; rieseguire. Atteso: superate.
- [ ] **Passo 3:** commit `feat(conversazioni): invio delle risposte una sola volta`.

### Compito 7: rotte della casella, permesso e ruoli

**File:**
- Crea: `src/api/admin/conversazioni/route.ts` (GET elenco), `[id]/route.ts` (GET), `[id]/messaggi/route.ts`, `[id]/stato/route.ts`, `[id]/letta/route.ts`, `[id]/cliente/route.ts` (POST), `src/api/admin/conversazioni/lib/elenco.ts`, `src/api/admin/conversazioni/lib/schemi.ts`, `src/api/admin/risposte-rapide/route.ts` (GET, POST), `src/api/admin/risposte-rapide/[id]/route.ts` (POST, DELETE), `src/api/rotte/conversazioni.ts`
- Test: `src/api/admin/conversazioni/__tests__/elenco.unit.spec.ts`
- Modifica: `src/api/middlewares.ts` (`...rotteConversazioni`), `src/modules/permessi/permessi-extra.ts`, `src/modules/permessi/ruoli.ts`

**Interfacce:**
- Consuma: servizio del compito 3, `inviaRisposta` del compito 6, `ID_CLIENT` del compito 1.
- Produce:
  - permesso `{ key: "conversazioni", group: "clienti", surface: ["admin"], rights: ["view", "edit", "manage"], label: "Customer messages" }`; ruolo `ordini` con `conversazioni: "edit"`; riga «Customers» di `AREE_ADMIN` con `["customers", "conversazioni"]`
  - `filtriElenco(query: Record<string, unknown>): { stato: "aperte" | "chiuse"; canale: Canale | null; q: string | null; limit: number; offset: number }`: stato predefinito «aperte», canale sconosciuto → errore 400 «Unknown channel», `limit` predefinito 50 e fra 1 e 200, `offset` ≥ 0, `q` senza spazi ai lati o null
  - `GET /admin/conversazioni` → `{ conversazioni: RigaConversazione[]; conteggi: { aperte: number; chiuse: number; non_lette: number }; totale: number }`, con `RigaConversazione = { id, canale, stato, nome, recapito, estratto, oggetto, non_letti, ultimo_messaggio_il, cliente_id }`, «aperte» = `aperta` e `in_attesa`, ordinate dall'ultimo messaggio
  - `GET /admin/conversazioni/:id` → `{ conversazione: RigaConversazione; messaggi: { id, direzione, testo, quando, stato_consegna, errore, autore_nome }[] (gli ultimi 200, dal più vecchio); identita: { id, canale, nome, recapito, cliente_id } }`
  - `POST /admin/conversazioni/:id/messaggi` `{ testo, id }` → `{ messaggio }` (200 anche se la consegna è fallita: lo dice `stato_consegna`); `POST .../stato` `{ stato: "aperta" | "chiusa" }`; `POST .../letta`; `POST .../cliente` `{ cliente_id: string | null }` (cliente inesistente → 404)
  - risposte rapide: `GET /admin/risposte-rapide` → `{ risposte: { id, titolo, testo }[] }`; `POST` `{ titolo 1-60, testo 1-1000 }`; `POST /:id`, `DELETE /:id`
  - permessi per rotta: le due GET view; `messaggi`, `stato`, `letta` e `cliente` edit (`cliente` anche `customers` view); risposte rapide: GET view, scritture manage; regole del registro delle attività per le POST e la DELETE

- [ ] **Passo 1: test che falliscono** per `filtriElenco`: vuoto → `{ stato: "aperte", canale: null, q: null, limit: 50, offset: 0 }`; `limit: "500"` → 200; `limit: "0"` → 1; `offset: "-3"` → 0; `canale: "fax"` → errore «Unknown channel»; `q: "  mario "` → «mario».
- [ ] **Passo 2:** jest. Atteso: FAIL.
- [ ] **Passo 3:** scrivere `elenco.ts`, `schemi.ts` (zod, con `ID_CLIENT` e i limiti sopra), le rotte, i permessi e i ruoli.
- [ ] **Passo 4:** jest e typecheck verdi; nello script dal vivo le rotte chiamate con una richiesta finta (come nella PR #8, errori tradotti con `getHttpResponseFromError`): elenco con conteggi e filtri, dettaglio, risposta, chiusura e riapertura, letta, collegamento a un cliente vero e a uno inesistente (404), risposte rapide; corpo senza `id` o con un testo di 4001 caratteri → 400.
- [ ] **Passo 5:** commit `feat(conversazioni): rotte della casella, permesso e ruoli`.

### Compito 8: prova completa, documenti e pull request

**File:**
- Crea: `verifiche/crm-tappa1-<data>.json`
- Modifica: `PROJECT.md`, `CHANGELOG.md`, `piani di implementazione/00 Quadro generale/Stato delle funzioni.md`, `tools/prepara-consegna.py`, `backend/README.md` (migrazione da eseguire dopo l'unione)

- [ ] **Passo 1:** backup del database, API riavviata con il codice nuovo, script dal vivo completo con il server Telegram finto: due chiamate parallele alla rotta di risposta con lo stesso `id` → un solo `sendMessage`; job con 409 → connettore in errore senza il token in `last_error` e nei log dell'API; il cliente riscrive dopo la chiusura → stessa conversazione riaperta.
- [ ] **Passo 2:** se Marco ha creato il bot di prova del negozio e inserito il token nella console: un messaggio vero da Telegram arriva entro un minuto e la risposta dall'API arriva sul telefono.
- [ ] **Passo 3:** jest, typecheck, test di `verifiche/`, prove del pannello (`strumenti-prova/e2e-*.mjs`): nessuna regressione.
- [ ] **Passo 4:** revisione avversariale a più agenti; correzioni con test che falliscono prima.
- [ ] **Passo 5:** ripristino del database; script temporanei tolti; documenti e rapporto; controllo dei file di licenza e dei segreti; commit, push sul fork, PR verso il main; recap breve a Reda.

## Dopo la revisione

La revisione avversariale (quattro revisori e quattro verificatori) ha confermato 27 rilievi su 29, 18 distinti, tutti corretti. Il codice finale differisce dal piano in questi punti:

- **Nessun cursore salvato per Telegram.** Ogni lettura parte senza offset e lo usa solo al suo interno: dopo una settimana senza messaggi Telegram ricomincia gli identificativi da un numero a caso, anche più basso, e un offset salvato scartava i messaggi nuovi. Il modello `cursore_canale` e i metodi relativi sono stati tolti (la tappa dell'email aggiungerà ciò che le serve).
- **Stato «incerto» delle risposte** e momento del tentativo (`tentato_il`): una risposta forse arrivata (Telegram senza risposta chiara, processo fermato durante l'invio) non si rimanda mai con lo stesso id; si rimanda solo ciò che certamente non è partito. Al cliente parte sempre il testo salvato con quell'id.
- **Ultimo messaggio visto** (`ultimo_visto`) in risposta, «letta» e chiusura: i messaggi del cliente arrivati dopo restano non letti e la chiusura risponde 412.
- **Registrazione in una transazione** (messaggio, identità e conversazione), con un secondo tentativo se due registrazioni si incrociano.
- Una risposta non consegnata rimette la conversazione al team; i 409 di Telegram (webhook o altro programma) hanno motivi distinti; i messaggi di servizio della chat non entrano nella casella; quattro letture da 12 secondi invece di due da 25.

