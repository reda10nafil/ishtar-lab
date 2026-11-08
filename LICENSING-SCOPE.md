# Perimetro della licenza Ishtar

Aggiornato: 7 novembre 2026. Canonico: LICENSING-SCOPE.md nella radice del progetto.

Titolare dei contributi Ishtar nei limiti dei diritti disponibili: Reda Zahloul. Nome pubblico: Ishtar Hub. Consegna modifiche: ralreda54@gmail.com.

La licenza personalizzata è predisposta per i contributi originali Ishtar, nei limiti dei diritti effettivamente spettanti al titolare. Non si presume che tutto ciò che si trova nella cartella appartenga a Ishtar.

## Candidati al perimetro personalizzato

File aggiunti per la copia e l'integrazione locale, da includere con hash nel manifest di ogni futura consegna:

- avvia_pannello.py
- catalog_bridge.py
- Avvia Ishtar Lab.bat
- Avvia Ishtar Lab.cmd
- tools/apri-ishtar-lab.mjs
- tools/prepara-vault-ishtar.py
- frontend/ishtar-lab/catalogo/catalogo.js
- frontend/ishtar-lab/catalogo/catalogo.css
- frontend/ishtar-lab/catalogo/csv.mjs
- frontend/ishtar-lab/identita.mjs
- frontend/ishtar-lab/branding-ui.mjs
- La documentazione originale nella cartella piani di implementazione, escluse citazioni, licenze altrui, prove copiate e immagini di riferimento.

Questa lista è prudenziale, non una perizia di originalità. L'adattatore importa componenti del frontend recuperato: la sua separazione in file non prova da sola l'indipendenza giuridica del contributo. Verificare anche la compatibilità dei derivati con l'accordo sul frontend.

Le icone e il monogramma Ishtar sono trattati separatamente come materiale del brand fornito/adattato su richiesta dell'utente: uso limitato all'attribuzione e all'app, senza certificazione di registrazione del marchio o esclusività su forme generiche. Conservare le foto originali e verificare i diritti prima di una consegna pubblica.

## Esclusioni esplicite

| Materiale | Regime da preservare |
|---|---|
| frontend/ishtar-lab/assets, index.html e textures | Frontend recuperato con avviso © 2026 Hasib (OVERSHOOT), diritti riservati e rinvio a LICENSE.md; testo di licenza non trovato nella copia esaminata |
| Modifiche all'interno dei bundle recuperati | Non attribuiscono a Ishtar la titolarità del codice e del design preesistenti |
| backend/piattaforma, incluse aggiunte nei package già dichiarati MIT | Mantenute le dichiarazioni e licenze esistenti; non viene imposta retroattivamente la licenza personale su questo sottoalbero |
| Dipendenze Medusa 2.22.3 | Licenza mista: MIT per il perimetro core, termini Enterprise per i materiali specificamente elencati |
| Mercur, React e altre dipendenze | Rispettive licenze; MIT nei manifest campionati, non dichiarazione su tutte le dipendenze transitive |
| Font Urbanist, file esterni localizzati | Licenza e notice del font da raccogliere prima di una distribuzione |
| CSV, dati dei prodotti, fotografie, dati browser e backup | Non sono automaticamente concessi a terzi dalla licenza del software |
| Recupero-pannello-2026-11-06 e materiali storici | Conservazione, non pacchetto da distribuire |
| .env, credenziali, token, log, volumi e snapshot privati | Esclusi da qualsiasi consegna |

La dichiarazione MIT nel manifest API resta invariata. Un eventuale cambiamento futuro dei termini di propri contributi richiede una ricostruzione della titolarità e delle concessioni già avvenute; non può ritirare permessi precedentemente concessi.

## Verifica prima di consegnare una copia

1. Titolare e recapito compilati: Reda Zahloul, ralreda54@gmail.com. Verificare che siano aggiornati, indicare la versione dei termini e ottenere accettazione del destinatario.
2. Chiarire il diritto a usare, modificare e distribuire il frontend recuperato oppure realizzare una UI originale mantenendo i requisiti funzionali, previa decisione dell'utente.
3. Fare l'inventario delle licenze delle esatte versioni distribuite, inclusi font, immagini, dipendenze e moduli Enterprise. La sola presenza di un package non equivale ad autorizzazione a ogni funzione.
4. Preparare un pacchetto pulito di sorgenti e istruzioni, senza dati, segreti o archivio storico; allegare termini e avvisi originali.
5. Registrare manifest, hash e accettazione, senza affermare che l'app intera sia di proprietà esclusiva di Ishtar.
