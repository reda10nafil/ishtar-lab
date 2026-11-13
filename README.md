# Ishtar Lab

Pannello locale per catalogo e inventario moda di **Reda Zahloul**, progetto **Ishtar Hub**.
Questa consegna, resa pubblica su richiesta esplicita del titolare, raccoglie il primo pannello scelto, il backend indipendente e il vault Obsidian.

**Aggiornamento del 12 novembre 2026:** inclusa anche la seconda applicazione in [versione 2](versione%202/LEGGIMI-PRIMA.md), con sorgenti e backend propri. Per il passaggio di lavoro partire dalla [guida tecnica al collaboratore](piani%20di%20implementazione/02%20Roadmap/Consegna%20tecnica%20al%20collaboratore.md). Il backend principale è già in `backend/`: Docker esegue i servizi dati, mentre l'API gira tramite Node sul computer. I launcher non sono ancora portati integralmente su Linux.

Scaricare il ramo main o la nuova consegna `v0.2.0-handoff-20261112` dalla pagina Releases; i vecchi ZIP dell'8 novembre non contengono questa seconda copia. La versione 2 è per sviluppo e confronto, non sostituisce il primo pannello e non è stata avviata in questa sessione.

## Avvio su questo computer

Se la copia è già configurata, doppio clic su **Avvia Ishtar Lab.bat**.
Indirizzo: http://127.0.0.1:4273/ishtar-lab/#/home.

## Primo utilizzo su un altro PC Windows

1. Scaricare lo ZIP della release o clonare il repository. Estrarre lo ZIP prima dell'avvio, preferibilmente in un percorso breve.
2. Sono necessari Node.js almeno 22.22, Python 3, Bun 1.4.4, Docker Desktop avviato e accesso Internet per scaricare dipendenze e immagini. Non è un EXE autonomo.
3. Leggere **GUIDA-COLLABORATORE.md**, quindi eseguire **Prepara Ishtar Lab.bat** una volta.
4. Usare **Avvia Ishtar Lab.bat**. La preparazione genera chiavi nuove sul PC: le credenziali del titolare non vengono distribuite.
5. Il database nuovo nasce senza l'inventario privato del titolare. Per le prove si può importare il CSV dimostrativo da frontend/catalogo/inventario-demo.csv.

Su Windows la preparazione su macchina pulita non è stata provata end-to-end; controlli e limiti sono in verifiche/consegna-github.json.
Su Linux è stata provata a macchina pulita il 12 novembre 2026: esiti in verifiche/avvio-linux-2026-11-12.json.
Il runtime mantiene porte fisse e si rifiuta di arrestare processi di cui non riconosce l'identità.
Non avviare due copie con le stesse porte sul medesimo PC.

## Linux e macOS

Provato su Ubuntu 26.04 il 12 novembre 2026; su macOS gli script sono predisposti ma non provati.

1. Clonare il repository oppure scaricare lo ZIP del ramo main: lo ZIP «Windows» delle release precedenti non contiene questi script né la correzione dell'immagine RustFS.
2. Prerequisiti: Docker Engine con il plugin compose (su macOS Docker Desktop avviato), Node.js almeno 22.22, `python3` e Bun 1.4.4. Su Linux l'utente deve essere nel gruppo `docker`, poi serve un nuovo accesso; l'appartenenza al gruppo concede privilegi equivalenti a root, mentre Docker rootless non è stato provato. Gli script aggiungono da soli `~/.bun/bin` al PATH.
3. Aprire un terminale nella cartella del progetto ed eseguire una sola volta `./prepara-ishtar-lab.sh`. Se si interrompe, rieseguirlo: riprende senza rigenerare le chiavi. Una preparazione rimasta a metà con una versione precedente si completa con `./prepara-ishtar-lab.sh --riprendi`.
4. Avvio: `./avvia-ishtar-lab.sh`, che apre anche il browser (`--no-browser` per non aprirlo).
5. Arresto di pannello, API e servizi: `./ferma-ishtar-lab.sh`. I dati restano nei volumi Docker.

Se compare «Permesso negato» (file estratti senza bit di esecuzione), usare `bash ./prepara-ishtar-lab.sh`, e allo stesso modo gli altri due script, oppure `chmod +x *.sh`.
Dati demo facoltativi, a pannello avviato: `python3 tools/importa_demo_ishtar.py`; scrive un rapporto locale in verifiche/.

## Cosa funziona e cosa resta dimostrativo

Catalogo/inventario sono collegati al backend: creazione/modifica, foto, campi personalizzati, CSV e quantità.
Dashboard, ordini, clienti, visite e altri moduli mantengono dati dimostrativi nel browser; non rappresentano risultati del sito reale.
Il catalogo sul computer del titolare contiene 82 articoli DEMO; un nuovo clone non è un backup del suo database.

## Documentazione e Obsidian

Aprire **piani di implementazione** come vault in Obsidian e partire da **00 Inizia qui.md**.
Le note sono leggibili anche direttamente su GitHub; i collegamenti in stile Obsidian funzionano nel vault.
Il vault contiene usi, architettura, stato reale, roadmap e attività per categoria.
Non sono necessari plugin della community o un abbonamento Obsidian Sync.

## Proprietà, modifiche e uso commerciale

Titolare dei contributi Ishtar nei limiti dei diritti disponibili: **Reda Zahloul**.
Prima di modificare i Materiali Ishtar occorre il suo permesso scritto.
Uso commerciale soltanto con il suo permesso e un accordo scritto separato.
Le modifiche autorizzate vanno restituite con i sorgenti a **ralreda54@gmail.com**.

Leggere LICENSE.md, LICENSING-SCOPE.md e THIRD_PARTY_NOTICES.md.
I diritti sui contributi Ishtar non trasferiscono la proprietà dei componenti recuperati di terzi.
Questo repository è pubblico su richiesta del titolare. La visibilità pubblica non equivale a una licenza open source: termini, perimetro e diritti dei terzi restano quelli indicati nei documenti legali.

## Contenuto escluso

Segreti, file .env effettivi, password, database/volumi, dati sorgenti privati, log, cache, dipendenze, foto di riferimento e archivio storico.
Le istruzioni PROJECT.md e CHANGELOG.md contengono anche storia delle fasi precedenti: per lo stato corrente leggere l'ultimo aggiornamento.
