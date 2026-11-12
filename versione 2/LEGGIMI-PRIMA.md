# Ishtar Lab — versione 2

Copia di sviluppo della seconda applicazione, richiesta dal titolare il 12 novembre 2026. **Non è una nuova release stabile né la sostituzione del primo pannello.**

Sono inclusi backend TypeScript Medusa/Mercur, console React con sorgenti, pannelli admin/vendor, migrazioni, lockfile, script e prove della sorgente. Sono esclusi credenziali, file .env (anche template/test originali), database, dipendenze, log e build. `MANIFEST-ORIGINE.json` elenca 685 file copiati senza modifiche, con hash verificati sulla sorgente prima e dopo la copia. I documenti di consegna aggiunti non fanno parte di quei 685 file.

## Da leggere prima di eseguire

1. [Consegna tecnica al collaboratore](../piani%20di%20implementazione/02%20Roadmap/Consegna%20tecnica%20al%20collaboratore.md).
2. [Versione 2 - origine e differenze](../piani%20di%20implementazione/02%20Roadmap/Versione%202%20-%20origine%20e%20differenze.md).
3. [Segnalazioni ricevute e verifiche](../piani%20di%20implementazione/02%20Roadmap/Segnalazioni%20ricevute%20e%20verifiche.md).

Il README.md e DECISIONI.md copiati sono documenti della sorgente. Non descrivono il setup aggiornato del primo pannello e possono includere scelte superate. I launcher originali usano API 9100, console 5180, progetto Docker `multi-outfit` e i suoi volumi. **Sul PC del titolare queste identità appartengono all'app originale: non eseguire i launcher della copia.** Su un altro PC occorre preparare le configurazioni e scegliere un ambiente separato; la compatibilità Linux non è pronta né verificata end-to-end.

Il backend del primo pannello è già disponibile in `../backend/`, con API 9273 e volumi distinti. La versione 2 non contiene l'adattatore `/admin/ishtar/catalogo` della prima app. Scambiare le due directory backend interromperebbe il collegamento del catalogo.

## Cosa è stato verificato qui

Copia di 685 file identica alla sorgente, nessuna corrispondenza con i segreti locali cercati, inventario statico API/moduli e controllo della documentazione. Nessun servizio avviato, nessun seed o test mutante eseguito, nessun DB copiato. Stato aggiornato e prossimi passi in PROJECT.md.

Per le licenze leggere anche [perimetro](../LICENSING-SCOPE.md) e [avvisi terzi](../THIRD_PARTY_NOTICES.md). I manifest upstream mantengono le proprie dichiarazioni; non si attribuisce l'intera applicazione al titolare dei contributi Ishtar.
