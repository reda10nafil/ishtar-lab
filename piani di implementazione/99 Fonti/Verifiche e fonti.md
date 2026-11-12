---
title: "Verifiche e fonti"
updated: 2026-11-07
type: documentazione-progetto
tags: [ishtar-lab]
---

# Verifiche e fonti

## Metodo e perimetro

Questa sessione ha letto memoria/cronologia, istruzioni di stile, route catalogo, ponte locale, route di magazzino/connettori/registro, moduli di connessione, manifest e alcuni LICENSE delle dipendenze installate. Ha riusato i rapporti delle prove già svolte. Non ha rifatto un audit completo del codice o tutte le prove dell'app.

Il backlog è una valutazione progettuale fondata su queste evidenze e sulla richiesta dell'utente. La presenza di un endpoint è registrata come codice presente, non come funzione già utilizzabile dal primo pannello. Le fonti web sono primarie e consultate il 7 novembre 2026.

## Prove locali selezionate

- [[qa-catalogo-operativo.json]] — persistenza, foto, campo, scorte e protezioni locali.
- [[pagine-ripristinate.json]] — 28 pagine con titolo/componenti, non 28 integrazioni reali.
- [[avvio-bat.json]] — launcher provato a servizi già attivi e limiti della prova.
- [[integrita-design.json]] — confronto stile di base e attribuzione.
- [[dashboard-ripristinata.jpg]] — immagine della UI originale ripristinata.

I documenti originali restano nella cartella verifiche della radice. Qui sono copie di consultazione, non una nuova esecuzione. Manifest e controllo di integrità della sessione: verifiche/vault-licenza.json nella radice.

## File canonici da consultare nella cartella superiore

PROJECT.md, CHANGELOG.md, AGENTS.md, .ai-style-rules.md, PIANO-INVENTARIO.md, LICENSE.md, LICENSING-SCOPE.md e THIRD_PARTY_NOTICES.md. Non spostati né sostituiti dal vault. Prima di aggiornare lo stato rileggere le relative fonti.

## Fonti web e perché sono pertinenti

| Fonte primaria | Uso nel piano |
|---|---|
| [Obsidian, gestione vault](https://help.obsidian.md/Files+and+folders/Manage+vaults) | Cartella locale con note e configurazione, apribile come vault |
| [Obsidian URI](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI) | Collegamento locale alla cartella/nota, non pubblicazione |
| [OSI, definizione Open Source](https://opensource.org/osd) | Una restrizione commerciale non è una licenza open source secondo OSI |
| [MIT, testo OSI](https://opensource.org/license/mit) | Conservazione dei permessi e degli avvisi preesistenti |
| [Direttiva 2009/24/CE](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32009L0024) | Distinzione tra espressione del programma, titolarità e diritti inderogabili |
| [Medusa LICENSE v2.22.3](https://github.com/medusajs/medusa/blob/v2.22.3/LICENSE) e [Enterprise v2.22.3](https://github.com/medusajs/medusa/blob/v2.22.3/ENTERPRISE-LICENSE.md) | Verifica del regime misto delle versioni installate |
| [Mercur ufficiale](https://github.com/mercurjs/mercur) | Riscontro dei termini del core, non di tutte le dipendenze |
| [Google Merchant Center, dati prodotto](https://support.google.com/merchants/answer/7052112?hl=it) | Attributi coerenti, varianti, foto, identificativi autentici per eventuali feed |
| [GA4, ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) | Eventi del percorso commerciale da configurare se viene scelto GA4 |
| [Shopify, webhook](https://shopify.dev/docs/apps/build/webhooks) | Meccanismo di aggiornamento se Shopify viene scelto come canale |

Le integrazioni proposte non obbligano a scegliere Google o Shopify: sono riferimenti concreti. Versioni e termini API vanno ricontrollati al momento dell'implementazione. Nessuna ricerca di mercato effettiva è stata eseguita per produrre questi piani.

## Consegna al collaboratore — 12 novembre 2026

- versione 2/MANIFEST-ORIGINE.json nella radice del progetto: hash di 685 file copiati dalla seconda app, con controlli di integrità prima/dopo; documentazione aggiunta separatamente.
- [[inventario-api-due-versioni.csv]]: metodi/percorso/file delle 98+149 route custom rilevate staticamente, non elenco dei soli endpoint framework né prova autorizzazioni.
- [[inventario-due-versioni.json]]: moduli, provider, TSX console e differenze dei percorsi. Foto dell'analisi esterna conservate fuori dalla consegna pubblica.
- [[Consegna tecnica al collaboratore]], [[Versione 2 - origine e differenze]], [[Segnalazioni ricevute e verifiche]]: guida, limiti e distinzione tra affermazioni esterne e controlli locali.
- Rapporto locale verifiche/consegna-versione2-2026-11-12.json: esito effettivo di pubblicazione e controlli. Nessun avvio di servizi o test mutante della seconda app.
