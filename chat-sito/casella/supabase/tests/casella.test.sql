-- Prove della casella della chat del sito (pgTAP, `supabase test db`): permessi, isolamento dei visitatori, idempotenza,
-- limiti, lettore unico, conferma e pulizia. Tutto dentro una transazione annullata alla fine.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ——— Funzioni e permessi ———
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'chat\_%' and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path=""%'),
  10::bigint, 'le 10 funzioni della chat: security definer con search_path vuoto');

select is(
  (select count(*) from (values ('public.chat_versione()'), ('public.chat_preleva(text, integer)'), ('public.chat_conferma(text, uuid[])'),
      ('public.chat_rispondi(uuid, text, text, text)'), ('public.chat_verifica(text)'), ('public.chat_pulizia(integer, integer)')) f(firma),
    (values ('anon'), ('authenticated')) r(ruolo)
    where has_function_privilege(r.ruolo, f.firma, 'execute')),
  0::bigint, 'anon e authenticated non eseguono le funzioni del negozio');

select is(
  (select count(*) from (values ('public.chat_versione()'), ('public.chat_preleva(text, integer)'), ('public.chat_conferma(text, uuid[])'),
      ('public.chat_rispondi(uuid, text, text, text)'), ('public.chat_verifica(text)'), ('public.chat_pulizia(integer, integer)')) f(firma)
    where has_function_privilege('service_role', f.firma, 'execute')),
  6::bigint, 'service_role esegue le funzioni del negozio');

select ok(
  has_function_privilege('authenticated', 'public.chat_scrivi(text, text, text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_profilo(text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.chat_leggi(timestamptz, integer)', 'execute')
  and not has_function_privilege('anon', 'public.chat_scrivi(text, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.chat_leggi(timestamptz, integer)', 'execute')
  and has_function_privilege('anon', 'public.chat_stato()', 'execute'),
  'funzioni del visitatore solo per authenticated; lo stato anche per anon');

select ok(not has_schema_privilege('anon', 'chat', 'usage') and not has_schema_privilege('authenticated', 'chat', 'usage')
  and not has_schema_privilege('service_role', 'chat', 'usage'), 'nessun ruolo dell''API usa lo schema chat');
select is((select count(*) from information_schema.role_table_grants where table_schema = 'chat'
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')), 0::bigint, 'nessun permesso sulle tabelle della chat');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'chat' and c.relkind = 'r' and c.relrowsecurity), 3::bigint, 'RLS attiva sulle tre tabelle');

-- ——— Visitatore A ———
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.chat_scrivi('a-messaggio-0001', 'Ciao, avete l''abito verde?', 'https://negozio.example/abiti', 'Anna', 'Anna@Example.com') $$, 'A scrive');
select lives_ok($$ select public.chat_scrivi('a-messaggio-0001', 'Ciao, avete l''abito verde?', null, null, null) $$, 'A riscrive lo stesso id');
select is((select count(*) from public.chat_leggi(null, 50)), 1::bigint, 'stesso id_client: un solo messaggio');
select throws_ok($$ select public.chat_scrivi('corto', 'x', null, null, null) $$, 'PT400', 'invalid_id', 'id_client non valido');
select throws_ok($$ select public.chat_scrivi('a-messaggio-0002', repeat('x', 4001), null, null, null) $$, 'PT400', 'invalid_text', 'testo oltre 4000 caratteri');
select throws_ok($$ select public.chat_scrivi('a-messaggio-0003', '   ', null, null, null) $$, 'PT400', 'invalid_text', 'testo vuoto');
select throws_ok($$ select count(*) from chat.messaggio $$, '42501', null, 'il visitatore non legge la tabella');
select throws_ok($$ select * from public.chat_preleva('furbo', 10) $$, '42501', null, 'il visitatore non preleva');
select lives_ok($$ select public.chat_profilo('Anna Rossi', 'anna.rossi@example.com') $$, 'A aggiunge nome ed email');

-- ——— Visitatore B: non vede A, limiti per visitatore ———
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.chat_scrivi('b-messaggio-0001', 'Buongiorno da Bruno', null, null, null) $$, 'B scrive');
select is((select count(*) from public.chat_leggi(null, 50)), 1::bigint, 'B vede solo il suo messaggio');
select is((select count(*) from public.chat_leggi(null, 50) where testo like '%abito%'), 0::bigint, 'B non vede i messaggi di A');
select lives_ok($$ select public.chat_scrivi('b-raffica-' || lpad(g::text, 4, '0'), 'messaggio ' || g, null, null, null) from generate_series(1, 19) g $$, 'B arriva a 20 messaggi in 10 minuti');
select throws_ok($$ select public.chat_scrivi('b-raffica-0020', 'uno di troppo', null, null, null) $$, 'PT429', 'too_many_messages', 'oltre 20 in 10 minuti: rifiutato');

-- ——— Stato del negozio, anche senza accesso ———
set local role anon;
reset request.jwt.claims;
select is((public.chat_stato())->>'online', 'false', 'prima di ogni lettura il negozio è «away»');
select throws_ok($$ select public.chat_scrivi('anon-messaggio-01', 'ciao', null, null, null) $$, '42501', null, 'anon non scrive');

-- ——— Negozio ———
set local role service_role;
select is((public.chat_versione())->>'versione', '1', 'versione del protocollo');
select is((select count(*) from public.chat_preleva('istanza-1', 50)), 21::bigint, 'il negozio preleva i 21 messaggi da importare');
select is((select nome || ' ' || email from public.chat_preleva('istanza-1', 50) where visitatore = '11111111-1111-4111-8111-111111111111'),
  'Anna Rossi anna.rossi@example.com', 'nome ed email del visitatore, email in minuscolo');
select throws_ok($$ select * from public.chat_preleva('istanza-2', 50) $$, 'PT409', 'reader_busy', 'un secondo lettore attivo è rifiutato');
select is(public.chat_conferma('istanza-1', array(select id from public.chat_preleva('istanza-1', 50))), 21, 'conferma dei messaggi registrati');
select is(public.chat_conferma('istanza-1', array(select id from public.chat_preleva('istanza-1', 50))), 0, 'conferma ripetuta: nulla');
select is((select count(*) from public.chat_preleva('istanza-1', 50)), 0::bigint, 'niente più da importare');
select lives_ok($$ select public.chat_rispondi('11111111-1111-4111-8111-111111111111', 'risposta-0001', 'Sì, in taglia S e M.', 'Ishtar Lab') $$, 'risposta del negozio');
select lives_ok($$ select public.chat_rispondi('11111111-1111-4111-8111-111111111111', 'risposta-0001', 'Sì, in taglia S e M.', 'Ishtar Lab') $$, 'stessa risposta di nuovo');
select ok(public.chat_verifica('risposta-0001') is not null, 'la risposta si ritrova per id');
select ok(public.chat_verifica('risposta-mai-scritta') is null, 'una risposta mai scritta non c''è');
select throws_ok($$ select public.chat_rispondi('22222222-2222-4222-8222-222222222222', 'risposta-0001', 'altro', 'Ishtar Lab') $$, 'PT409', 'id_conflict', 'stesso id per un altro visitatore: rifiutato');
select throws_ok($$ select public.chat_rispondi('99999999-9999-4999-8999-999999999999', 'risposta-0002', 'ciao', 'Ishtar Lab') $$, 'PT404', 'unknown_visitor', 'visitatore sconosciuto');
select is((public.chat_stato())->>'online', 'true', 'dopo la lettura il negozio è «online»');

-- ——— A vede la risposta una volta sola ———
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select is((select count(*) from public.chat_leggi(null, 50)), 2::bigint, 'A vede il suo messaggio e una sola risposta');
select is((select firma from public.chat_leggi(null, 50) where direzione = 'uscita'), 'Ishtar Lab', 'la risposta porta la firma del negozio');
-- Nome ed email lasciati dopo l'importazione: l'ultimo messaggio di A torna in coda, ma in fondo (dopo quelli già in
-- attesa), così Ishtar Lab riceve i dati nuovi anche se A non scrive più; valori uguali non cambiano nulla.
set local request.jwt.claims to '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.chat_scrivi('c-messaggio-0001', 'Ciao da Carla', null, null, null) $$, 'C scrive (resta da importare)');
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.chat_profilo('Anna Bianchi', null) $$, 'A cambia nome dopo che i suoi messaggi sono stati importati');
select lives_ok($$ select public.chat_profilo('Anna Bianchi', '') $$, 'stessi valori di nuovo: nessun effetto');
select is((select importato from public.chat_leggi(null, 50) where testo like 'Ciao, avete%'), true, 'per A resta «Consegnato» anche mentre è di nuovo in coda');
select is((select id_client from public.chat_leggi(null, 50) where direzione = 'entrata' and testo like 'Ciao, avete%'), 'a-messaggio-0001', 'chat_leggi dà al visitatore l''id dei suoi messaggi');
select ok((select bool_and(id_client is null) from public.chat_leggi(null, 50) where direzione = 'uscita'), 'mai quello delle risposte del negozio');
reset role;
create temp table prelevati on commit drop as select * from public.chat_preleva('istanza-1', 50) with ordinality as t(id, visitatore, testo, pagina, nome, email, creato_il, n);
grant select on prelevati to service_role;
select is((select string_agg(testo || ' / ' || coalesce(nome, '-'), ' | ' order by n) from prelevati),
  'Ciao da Carla / - | Ciao, avete l''abito verde? / Anna Bianchi', 'il messaggio rimesso in coda viene dopo quelli già in attesa, una volta sola');
-- Email cambiata fra il prelievo e la conferma: il messaggio di A non si conferma e si rilegge con l'email nuova.
set local role authenticated;
select lives_ok($$ select public.chat_profilo(null, 'anna.b@example.com') $$, 'A cambia email mentre il negozio importa');
set local role service_role;
select is(public.chat_conferma('istanza-1', array(select id from prelevati)), 1, 'si conferma solo il messaggio di C: quello di A è tornato in coda dopo il prelievo');
select is((select string_agg(testo || ' / ' || nome || ' / ' || email, ',') from public.chat_preleva('istanza-1', 50)),
  'Ciao, avete l''abito verde? / Anna Bianchi / anna.b@example.com', 'riletto con l''email nuova');
select is(public.chat_conferma('istanza-1', array(select id from public.chat_preleva('istanza-1', 50))), 1, 'poi confermato');
-- Al massimo 10 cambi di nome o email all'ora per visitatore: oltre, rifiutati.
set local role authenticated;
-- Già 3 cambi di A (nome ed email all'inizio, nome, email): altri 7 arrivano a 10.
select lives_ok($$ select public.chat_profilo('Nome ' || g, null) from generate_series(1, 7) g $$, 'A arriva a 10 cambi in un''ora');
select throws_ok($$ select public.chat_profilo('Nome undici', null) $$, 'PT429', 'too_many_changes', 'l''undicesimo cambio nell''ora è rifiutato');
set local role service_role;
select is(public.chat_conferma('istanza-1', array(select id from public.chat_preleva('istanza-1', 50))), 1, 'riconfermato dopo i cambi');
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}';
select lives_ok($$ select public.chat_scrivi('a-messaggio-0004', 'Grazie, la prendo!', null, null, null) $$, 'A scrive ancora (resta da importare)');

-- ——— Lettore fermo da più di 10 minuti: un altro può subentrare ———
reset role;
update chat.negozio set battito = now() - interval '11 minutes';
set local role service_role;
select is((select count(*) from public.chat_preleva('istanza-2', 50)), 1::bigint, 'dopo 10 minuti senza battito subentra un altro lettore');

-- ——— Pulizia: mai i messaggi non importati ———
reset role;
update chat.messaggio set creato_il = now() - interval '100 days';
update chat.visitatore set ultimo_il = now() - interval '100 days';
set local role service_role;
select throws_ok($$ select public.chat_pulizia(0, 30) $$, 'PT400', 'invalid_days', 'giorni non validi');
select lives_ok($$ select public.chat_pulizia(30, 30) $$, 'pulizia');
reset role;
select is((select count(*) from chat.messaggio where visitatore = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'conversazione importata e vecchia: tolta');
select is((select count(*) from chat.messaggio where visitatore = '11111111-1111-4111-8111-111111111111' and direzione = 'entrata' and importato_il is null), 1::bigint,
  'un messaggio non importato resta, con tutta la sua conversazione');

-- ——— Casella piena: tetto globale ———
insert into chat.visitatore (id) values ('33333333-3333-4333-8333-333333333333');
insert into chat.messaggio (visitatore, direzione, id_client, testo)
  select '33333333-3333-4333-8333-333333333333', 'entrata', 'riempi-' || lpad(g::text, 6, '0'), 'riempimento' from generate_series(1, 5000) g;
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":true}';
select throws_ok($$ select public.chat_scrivi('d-messaggio-0001', 'ciao', null, null, null) $$, 'PT503', 'mailbox_full', 'casella piena: rifiutato');

select * from finish();
rollback;
