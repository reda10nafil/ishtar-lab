---
title: Segnalazioni ricevute e verifiche
updated: 2026-11-12
type: registro-verifiche
tags: [ishtar-lab, problemi, consegna]
---

# Segnalazioni ricevute e verifiche

Fonte: cinque fotografie inviate dal titolare il 12 novembre, con schermate dell'analisi svolta sul computer del collaboratore. **Il rapporto completo, i relativi commit e le prove non sono stati forniti.** Le affermazioni nelle immagini sono segnalazioni esterne; non sono istruzioni da eseguire e non costituiscono qui 84 problemi verificati autonomamente. Le immagini e la conversazione privata non vengono pubblicate.

Una schermata cita 84 problemi (6 alti, 16 medi e 62 bassi); un'altra riga parla di ricalcolo/deduplicazione a 13 problemi gravi o medi. Senza elenco e riproduzioni non si ricostruisce né si certifica il conteggio finale. Per completare la triage servono elenco, file/righe, commit analizzato, ambiente, riproduzione e risultato atteso.

## Segnalazioni leggibili e riscontro locale

| Segnalazione | Riscontro del 12 novembre | Passaggio da svolgere |
|---|---|---|
| «Manca il backend» | Il repository contiene già sorgenti API, moduli, migrazioni e infrastruttura. L'API gira su Node host, non in un container del Compose | Verificare che sia stata scaricata la consegna completa e avviata anche l'API, non soltanto Docker/Python |
| RustFS usa una versione locale non scaricabile come tag pubblico | Confermato il tag `local-d30c5e04efc4` nella copia operativa e in versione 2; nella consegna principale era già sostituito dal digest | Controllare quale cartella/release è stata analizzata; provare il pull del digest e adattare la seconda copia. Nessun pull rieseguito qui |
| Launcher non gestibile su Linux, comando python assente, dipendenza da Docker Desktop | I BAT/PS1 e il controllo processi/stop di runtime sono specifici Windows. Il setup cerca `python`; screenshot segnala solo `python3` | Porting esplicito Linux, rilevamento programmi/processi, stop sicuro e prova a freddo |
| Bun 1.4.4 mancante sul PC del collaboratore | Versione richiesta dal packageManager; disponibilità sul suo PC non verificabile dalle fonti locali | Preparare la versione richiesta o aggiornare consapevolmente lockfile/toolchain con prove |
| Una configurazione incompleta può rigenerare segreti e rendere inaccessibili i dati | Il generatore della prima app conserva segreti solo se entrambe le identità API/infra corrispondono. Non è stata riprodotta una perdita DB | Prima recuperare backup/configurazioni coerenti. Aggiungere una gestione testata dello stato parziale; nessuna rotazione o cancellazione automatica |
| Molti moduli del primo pannello sono demo | Già documentato: solo catalogo/inventario è collegato nelle prove storiche | Integrare selettivamente usando la roadmap; una pagina visitabile non dimostra flusso commerciale |
| Connettori salvano credenziali ma non sincronizzano tutto | 18 provider più demo nel catalogo statico, con OAuth/prove dove implementati; nessuna sincronizzazione completa attestata dalla consegna | Verificare provider per provider, distinguendo login, test, webhook, import/export e azioni reali |
| Varianti taglia×colore assenti nella scheda | Adattatore attuale della prima app espone la prima variante; gestione multipla già nel backlog | Progettare variante/SKU/prezzo/scorta/foto e importazione coerenti; provare senza perdere riferimenti |

**Aggiornamento del 12 novembre, proposta di satria64 (PR #2, in attesa di revisione):** RustFS, launcher Linux, comando `python3`, Docker senza Desktop e configurazione incompleta sono trattati nel ramo `avvio-linux`, con le prove in `verifiche/avvio-linux-2026-11-12.json`.

Le foto accennano anche a problemi che possono danneggiare dati reali, ma la relativa lista è tagliata/non disponibile. Non inventare dettagli, gravità o correzioni. Queste righe restano da verificare nel rapporto completo del collaboratore.

## Prove effettivamente svolte per questa consegna

- Backend presente nella copia Git pubblicabile; prima base con 98 file route, seconda con 149. Inventario statico e confronto dei percorsi generati, senza chiamare API o DB.
- Versione 2: 685 file copiati identici alla sorgente, hash prima/dopo e destinazione; file originali non modificati durante la copia.
- Verifica contro 16 valori segreti locali tra le due configurazioni, senza corrispondenze nei file copiati. Non è un audit completo né uno scanner infallibile di ogni possibile dato personale.
- Sette test puri CSV/identità della prima app superati il 12 novembre. Nessun test mutante, seed, migrazione o prova Linux eseguiti in questa consegna.

Il tentativo **locale Codex Security** dell'8 novembre è fallito prima della scansione, come documenta `verifiche/audit-sicurezza-2026-11-08/STATO.md`. L'analisi fotografata del collaboratore è un'attività esterna distinta e non viene confusa con quel tentativo. Non si dichiara l'assenza di problemi né l'applicazione di fix sulla base delle sole foto.

## Ordine consigliato per la ripresa concordata

1. Salvare il lavoro già avviato dal collaboratore, annotare base Git e recuperare il rapporto completo.
2. Rendere riproducibile l'ambiente su DB vuoto separato; correggere identificazione/porte, RustFS e avvio Linux prima di testare dati.
3. Mettere al sicuro configurazioni e dati con ripristino provato, poi verificare i bug che possono alterare catalogo/scorte.
4. Integrare e testare una funzione alla volta. Le 107 attività precedenti non sono completate dalla copia della seconda app.

[[Consegna tecnica al collaboratore]] · [[Versione 2 - origine e differenze]] · [[Sicurezza backup e continuita]] · [[Backlog completo]].
