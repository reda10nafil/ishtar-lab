# Versione 2 — stato della copia

Aggiornato: 12 novembre 2026, Europe/Berlin.

## Obiettivo

Fornire al collaboratore la seconda applicazione Ishtar Lab/Multi Outfit nella cartella richiesta `versione 2`, insieme al backend, alle fonti e ai piani necessari per proseguire. Il primo pannello resta la copia principale scelta dal titolare. Nessun progetto originale viene spostato o modificato.

## Implementato e verificato

- Copiati 685 file di sorgenti/documentazione/configurazioni non segrete da `pannello di amministrazione del negozio/multi-outfit`; SHA-256 uguale prima/dopo la copia e nella destinazione. Revisione Git della sorgente non accertata: è uno snapshot dei file di lavoro, non un tag upstream.
- Rilevati 149 file `route.ts`, 9 directory moduli e 163 TSX della console. Numeri di inventario statico, non di flussi completi. Il backend principale ha 98 file route, 7 directory moduli e 112 TSX della console.
- Esclusi segreti/env, dipendenze, database, cache, log e build. Nessuna nuova connessione a provider o account.
- Aggiunte istruzioni di consegna e collegamenti al vault principale, senza creare un secondo vault. Manifest della provenienza in MANIFEST-ORIGINE.json; inventari nel vault `99 Fonti`.

## Decisioni

Conservare i sorgenti copiati invece di mescolarli con il backend isolato della prima app. Le differenze sono sostanziali: la seconda app aggiunge marketing/negozio-online e altre rotte, mentre la prima contiene l'API specifica del catalogo Ishtar e le correzioni documentate. Le API non sono intercambiabili automaticamente. Le vecchie decisioni in DECISIONI.md sono storia della sorgente, non un'autorizzazione a cambiare la UI principale.

Risorse condivise valutate: catalogo RISORSE.md consultato; REA e prompts.chat non necessari per la copia e l'inventario statico. Nessuna nuova dipendenza o integrazione installata. Strumenti riutilizzati: Python standard per copia/hash e Git per consegna.

## Da fare, in ordine

1. Collaboratore: scegliere su quale app lavorare e verificare i problemi ricevuti con il rapporto completo, non soltanto con le foto.
2. Preparare ambiente di test separato, segreti nuovi, identità/porte/volumi dedicati; adattare l'avvio al proprio sistema operativo.
3. Risolvere il tag locale RustFS e controllare disponibilità del digest prima del bootstrap; nessuna correzione incorporata di nascosto nei file copiati.
4. Installare dal lockfile e provare typecheck/build, migrazioni e flussi su database vuoto separato; i test mutanti richiedono dati di prova.
5. Portare modifiche selettive con test, migrazioni e piano di ripristino. Aggiornare PROJECT.md, CHANGELOG.md e note pertinenti del vault dopo verifiche reali.

## Limiti

Avvio completo, compatibilità Linux, account reali e comportamento delle funzioni di questa copia non verificati qui. Nessun dato del database originale incluso. L'esito GitHub della consegna è registrato nel rapporto locale `../verifiche/consegna-versione2-2026-11-12.json`; la sola presenza di questa nota non dimostra la pubblicazione.
