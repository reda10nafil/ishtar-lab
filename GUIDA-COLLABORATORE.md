# Lavorare su Ishtar Lab

## Accesso e permessi

Il repository è pubblico per scelta esplicita del titolare e appartiene all'account GitHub del titolare. Il titolare ha precisato di non invitare nessuno. Chiunque può leggere/scaricare i file pubblici; accessi di scrittura non sono stati assegnati.
Il semplice invito non trasferisce diritti né concede uso commerciale. Richiedere a Reda Zahloul il permesso scritto per l'attività e conservarne il riferimento nella proposta di modifica.
Un utilizzo commerciale richiede un accordo scritto separato.

## Preparazione

- Clonare il repository o estrarre lo ZIP in una propria cartella (Windows; per Linux e macOS vedere la sezione dedicata del README).
- Installare i prerequisiti indicati nel README dalle fonti ufficiali.
- Avviare Docker Desktop (su Linux il servizio docker). La preparazione richiede rete per immagini e dipendenze e può durare diversi minuti.
- Eseguire Prepara Ishtar Lab.bat una volta, poi Avvia Ishtar Lab.bat. Su Linux e macOS: `./prepara-ishtar-lab.sh`, poi `./avvia-ishtar-lab.sh`; arresto con `./ferma-ishtar-lab.sh`.
- Il database e le chiavi vengono creati localmente. Non chiedere né copiare le chiavi del PC del titolare.
- Il dataset CSV consegnato è esplicitamente dimostrativo e ripulito dai link foto remoti della sorgente; associarvi immagini autorizzate per le prove.

La configurazione usa la stessa identità tecnica e le stesse porte su ogni computer separato. Non eseguire questo setup sul PC del titolare da una seconda cartella: usare la sua copia già configurata.
Le API sono locali; questa consegna non espone un server pubblico.

## Regole di sviluppo

1. Leggere AGENTS.md, PROJECT.md, CHANGELOG.md, .ai-style-rules.md e la nota pertinente nel vault.
2. Creare un ramo per il lavoro autorizzato. Conservare dashboard, navigazione, tab, tabella e token del primo pannello.
3. Riutilizzare le API esistenti prima di riscriverle. Distinguere backend presente, UI collegata e flusso verificato.
4. Fare commit piccoli e aprire una pull request al titolare con problema, risultato, prove ed eventuali limiti.
5. Restituire codice modificabile, istruzioni, migrazioni senza dati e nuove licenze. Non inviare database, clienti o segreti.
6. Aggiornare i piani solo dopo verifiche effettive. Nessun azzeramento di liste per ripopolare i dati.

## Priorità di partenza

Backup con ripristino, varianti taglia/colore, import recuperabile; poi un singolo sito e le sue fonti autorevoli.
Le 107 attività sono una roadmap: non vanno attivate tutte insieme e non autorizzano acquisti o pubblicazioni.

## Condividere le note Obsidian

Le note e la configurazione essenziale del vault sono nel repository. Ogni persona apre la cartella come vault.
Prima di modificare le note aggiornare la propria copia; evitare di scrivere contemporaneamente sulla stessa nota e risolvere i conflitti prima di inviare.
Layout, cache, credenziali e impostazioni di sessione personali di Obsidian sono esclusi.
La sincronizzazione avviene con normali commit/push/pull: non è stato installato un plugin che acceda automaticamente al proprio account.

## Limiti della consegna

Non è un installer autonomo né un database completo del titolare. L'avvio già configurato è stato provato nelle fasi precedenti; il bootstrap completo su una macchina pulita è stato provato su Linux il 12 novembre 2026 e resta da verificare su Windows.
Le licenze dei componenti terzi rimangono applicabili; prima di redistribuire pubblicamente servono le verifiche descritte nei documenti legali.
