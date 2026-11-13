---
title: "CRM omnicanale - progetto"
updated: 2026-11-13
type: documentazione-progetto
tags: [ishtar-lab]
---

# CRM omnicanale - progetto

Proposta di satria64 per la richiesta del titolare del 13 novembre 2026: un'interfaccia per parlare con i clienti da tutte le piattaforme, partendo da ciò che c'è già. Le scelte tecniche sono di satria64, su indicazione di Marco («vai tu con le scelte migliori»); il titolare può cambiarle.

## Perché

Reda vuole una sola casella per i messaggi dei clienti (sito, Telegram, WhatsApp, Instagram, Facebook, TikTok, email), con accanto la scheda del cliente e i suoi ordini. Il riferimento è la schermata «Chats» che ha mandato (foto del 13/11, usata solo come riferimento delle funzioni: ha la firma di un altro autore). Ha chiesto di partire dalla chat e dall'email della «versione 2».

La ricognizione del 13 novembre (codice di v1 e v2, documentazione ufficiale dei canali) ha trovato:

- **nessun canale riceve messaggi**, né nella v1 né nella v2: i connettori salvano le credenziali cifrate e fanno una prova di accesso, senza webhook, letture o invii;
- la «chat» della v2 è l'**assistenza fra staff e aziende**, non una chat con i clienti; l'email esce solo via SMTP e non si riceve;
- il **modulo connettori della v1 è già il migliore**: la v2 ha la stessa base senza le correzioni di sicurezza, quindi non c'è backend da copiare;
- la **scheda cliente** con ordini, speso, ultimo ordine e ordini recenti esiste già come API (`GET /admin/clienti/:id`); nel primo pannello clienti e ordini sono ancora dimostrativi.

## Obiettivi

1. Una casella unica nel primo pannello: elenco delle conversazioni (canale, aperte e chiuse, non lette, ricerca), la conversazione con risposte rapide e invio, la scheda del cliente con i suoi ordini.
2. Canali, in quest'ordine: Telegram, email, chat del sito, WhatsApp, Instagram, Messenger.
3. Ogni messaggio in arrivo registrato una volta sola; ogni risposta inviata una volta sola, anche con un doppio clic o un nuovo tentativo.
4. Il contatto di un canale collegato al cliente del negozio, così la scheda mostra i suoi ordini.

## Non obiettivi

- **TikTok:** l'API dei messaggi diretti non è disponibile per gli account business registrati nello Spazio economico europeo (fonti concordi di Chatwoot, respond.io, Infobip, SleekFlow; il portale TikTok non si legge senza JavaScript). Si riconsidera se TikTok la apre.
- Campagne e newsletter (il marketing della v2 è un lavoro a parte), risposte automatiche e assistente IA, app per il telefono.
- Le aziende venditrici che rispondono ai clienti: nella prima versione risponde solo il team Ishtar Lab.

## Da non fare mai (anti-obiettivi)

- Mandare due volte la stessa risposta a un cliente, o perdere o duplicare un messaggio in arrivo.
- Collegare in automatico un contatto al cliente sbagliato: con un collegamento errato una persona vedrebbe ordini e indirizzi di un'altra. Il collegamento automatico solo con prove forti (stessa email verificata dal canale email); per gli altri canali lo fa una persona del team.
- Esporre token o chiavi: niente segreti in risposte, log o messaggi d'errore (il token Telegram sta nell'indirizzo delle chiamate).
- Mettere messaggi o clienti veri nello stato dimostrativo del pannello (salvato nel browser ed esportabile).
- Sostituire il primo pannello o pubblicarlo su Internet.

## Vincoli

- Si lavora sulla **versione 1** (backend Mercur/Medusa 2.22.3 in `backend/piattaforma`, primo pannello in `frontend/ishtar-lab`). Licenza, titolarità e avvisi dei terzi non si toccano.
- Il primo pannello è compilato (React minificato, senza sorgenti): una pagina nuova si aggiunge come il catalogo, con un adattatore, i componenti e i token originali (`.ai-style-rules.md`) e modifiche minime a router e menu.
- Le credenziali dei canali restano nel modulo connettori (AES-256-GCM con `CONNECTORS_KEY`); solo il server le legge.
- WhatsApp, Instagram, Messenger e la chat del sito in produzione richiedono un indirizzo HTTPS pubblico con certificato valido per i webhook; Telegram e l'email funzionano anche senza, leggendo a intervalli.
- Gli account di prova li creano Marco e Reda; satria64 dice quali servono e non inserisce password o token.
- I messaggi sono dati personali: vanno inclusi nell'esportazione dei dati del cliente e cancellati con lui (da completare in una tappa successiva).

## Scelte (di satria64)

- **Costruire la casella dentro il backend Medusa**, non affiancare Chatwoot. Chatwoot (licenza MIT) ha già quasi tutti i canali, ma è un secondo sistema Rails con almeno 4 GB di RAM, con un'interfaccia sua diversa dal pannello e con i clienti in due database. Resta un riferimento per i dettagli dei canali.
- **Modulo nuovo «conversazioni»**, separato dall'assistenza (che è un help-desk fra staff e aziende e dà a ogni ruolo il diritto di scrivere). Contiene identità del contatto per canale, conversazioni, messaggi con stato di consegna, risposte rapide e i cursori di lettura dei canali.
- **Canali come adattatori**: ognuno sa ricevere (lettura a intervalli o webhook) e inviare; le regole comuni (deduplica, stati, idempotenza) stanno nel modulo.
- **Prima la lettura a intervalli** (Telegram getUpdates, email IMAP), poi i webhook quando ci sarà l'indirizzo HTTPS pubblico. Per Telegram ogni lettura parte senza offset: dopo una settimana senza messaggi Telegram ricomincia gli identificativi da un numero a caso, e un offset salvato scarterebbe i messaggi nuovi.
- **Risposte mai doppie**: una risposta certamente non partita si può ritentare; una forse arrivata (Telegram non ha risposto) resta «incerta» e si ripete solo come risposta nuova.
- **Permesso nuovo** `conversazioni` (vedere, rispondere, gestire le risposte rapide), dato al proprietario e all'operatore degli ordini.
- **Un account per canale**, come oggi nei connettori.
- **Il bot collegato nei Connettori è il bot della casella**: le sue chat private entrano nella casella e va usato solo per quello (un bot usato per altro porterebbe nella casella anche le sue chat).

## Tappe

| Tappa | Contenuto | Serve da Marco e Reda |
|---|---|---|
| 1 | Nucleo delle conversazioni nel backend, API per la casella, permesso, risposte rapide; canale Telegram (lettura a intervalli e invio) | un bot Telegram di prova del negozio, creato con @BotFather e usato solo per i clienti, con il token inserito da Marco nella console › Connettori › Telegram |
| 2 | Pagina «Chats» nel primo pannello con la scheda cliente, attraverso il ponte (fatta il 13/11: [[CRM omnicanale - piano tappa 2]]) | niente |
| 3 | Email: lettura IMAP della casella del negozio, risposte via SMTP nello stesso filo (fatta il 13/11: [[CRM omnicanale - piano tappa 3]]) | una casella email di prova con IMAP attivo e password per app, inserita da Marco nella console |
| 4 | Chat del sito: rotte pubbliche per il negozio, aggiornamento in tempo reale, piccolo widget | il sito del negozio su cui provarla |
| 5 | WhatsApp, Instagram, Messenger: webhook firmati, finestra di 24 ore, modelli WhatsApp | app Meta per sviluppatori, portafoglio business, numero di prova WhatsApp, Pagina Facebook e profilo Instagram professionale di prova, un indirizzo HTTPS pubblico |
| 6 | Connettori per spedizioni (Sendcloud), pagamenti (Stripe), Google Analytics e Search Console per SEO e GEO | account di prova dei servizi scelti |

Ogni tappa è una pull request con test, prove dal vivo, revisione avversariale e rapporto in `verifiche/`.

## Lasciato a chi costruisce

Nomi interni, struttura dei file, messaggi dell'interfaccia (in inglese come il resto della console), intervalli di lettura, limiti di lunghezza: decisi nei piani di ogni tappa. Piani: [[CRM omnicanale - piano tappa 1]], [[CRM omnicanale - piano tappa 2]], [[CRM omnicanale - piano tappa 3]].
