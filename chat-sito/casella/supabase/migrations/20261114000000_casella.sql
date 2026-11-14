-- Casella della chat del sito di Ishtar Lab, protocollo versione 1.
--
-- I messaggi dei visitatori aspettano qui finché Ishtar Lab (che gira su un PC senza indirizzo pubblico) non li legge.
-- Le tabelle stanno nello schema privato «chat»: nessun ruolo dell'API lo usa e PostgREST non lo espone. Si entra solo
-- dalle funzioni in «public», tutte security definer con search_path vuoto:
--   - visitatore (utente anonimo di Supabase Auth, ruolo authenticated): chat_scrivi, chat_profilo, chat_leggi;
--   - chiunque, anche senza accesso: chat_stato (negozio «online» o «away»);
--   - negozio (chiave segreta di Ishtar Lab, ruolo service_role): chat_versione, chat_preleva, chat_conferma,
--     chat_rispondi, chat_verifica, chat_pulizia.
-- Supabase dà per default EXECUTE ad anon e authenticated su ogni funzione nuova di public: qui i permessi si tolgono
-- e si ridanno uno per uno (le prove in supabase/tests lo controllano).

create schema if not exists chat;
revoke all on schema chat from public, anon, authenticated, service_role;

create table chat.negozio (
  id smallint primary key default 1 check (id = 1),
  versione smallint not null default 1,
  nome text not null default 'Shop' check (char_length(nome) between 1 and 100),
  lettore text check (lettore is null or char_length(lettore) between 1 and 100),
  battito timestamptz
);
insert into chat.negozio (id) values (1);

create table chat.visitatore (
  id uuid primary key,
  nome text check (nome is null or char_length(nome) <= 100),
  email text check (email is null or char_length(email) <= 254),
  creato_il timestamptz not null default now(),
  ultimo_il timestamptz not null default now(),
  -- Cambi di nome o email nell'ultima ora (al massimo 10): ogni cambio rimette in coda un messaggio per il negozio.
  profilo_cambi integer not null default 0,
  profilo_finestra timestamptz
);

create table chat.messaggio (
  id uuid primary key default gen_random_uuid(),
  visitatore uuid not null references chat.visitatore (id) on delete cascade,
  direzione text not null check (direzione in ('entrata', 'uscita')),
  id_client text not null check (id_client ~ '^[A-Za-z0-9_-]{8,80}$'),
  testo text not null check (char_length(testo) between 1 and 4000),
  pagina text check (pagina is null or char_length(pagina) <= 500),
  firma text check (firma is null or char_length(firma) <= 100),
  creato_il timestamptz not null default clock_timestamp(),
  importato_il timestamptz,
  -- Da quando aspetta il negozio (creazione, o nome ed email nuovi): l'ordine della coda. Un messaggio rimesso in coda va
  -- in fondo e non scavalca quelli già in attesa.
  in_coda_dal timestamptz not null default clock_timestamp(),
  -- Ultimo prelievo del negozio: un messaggio rimesso in coda dopo il prelievo non si conferma, si rilegge con i dati nuovi.
  prelevato_il timestamptz,
  -- Prima importazione: per il visitatore resta «Consegnato» anche se il messaggio torna in coda per un profilo nuovo.
  consegnato_il timestamptz
);
-- Lo stesso messaggio del visitatore (stesso id_client) e la stessa risposta del negozio non si scrivono due volte.
create unique index messaggio_entrata_unico on chat.messaggio (visitatore, id_client) where direzione = 'entrata';
create unique index messaggio_uscita_unico on chat.messaggio (id_client) where direzione = 'uscita';
create index messaggio_da_importare on chat.messaggio (in_coda_dal, id) where direzione = 'entrata' and importato_il is null;
create index messaggio_del_visitatore on chat.messaggio (visitatore, creato_il);

alter table chat.negozio enable row level security;
alter table chat.visitatore enable row level security;
alter table chat.messaggio enable row level security;
revoke all on all tables in schema chat from public, anon, authenticated, service_role;

-- ——— Visitatore ———

create function public.chat_scrivi(p_id_client text, p_testo text, p_pagina text default null, p_nome text default null, p_email text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_visitatore uuid := auth.uid();
  v_ora timestamptz := now();
  v_messaggio chat.messaggio;
  v_recenti integer;
  v_oggi integer;
begin
  if v_visitatore is null then raise exception 'not_signed_in' using errcode = 'PT401'; end if;
  if p_id_client is null or p_id_client !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid_id' using errcode = 'PT400'; end if;
  if p_testo is null or char_length(btrim(p_testo)) = 0 or char_length(p_testo) > 4000 then raise exception 'invalid_text' using errcode = 'PT400'; end if;
  -- Un visitatore alla volta: i limiti si contano senza gare fra due richieste insieme.
  perform pg_advisory_xact_lock(hashtextextended('chat:' || v_visitatore::text, 0));
  select * into v_messaggio from chat.messaggio m where m.visitatore = v_visitatore and m.id_client = p_id_client and m.direzione = 'entrata';
  if found then return json_build_object('id', v_messaggio.id, 'creato_il', v_messaggio.creato_il); end if;
  select count(*) filter (where m.creato_il > v_ora - interval '10 minutes'), count(*) into v_recenti, v_oggi
    from chat.messaggio m where m.visitatore = v_visitatore and m.direzione = 'entrata' and m.creato_il > v_ora - interval '1 day';
  if v_recenti >= 20 or v_oggi >= 200 then raise exception 'too_many_messages' using errcode = 'PT429'; end if;
  if (select count(*) from chat.messaggio m where m.direzione = 'entrata' and m.importato_il is null) >= 5000 then
    raise exception 'mailbox_full' using errcode = 'PT503';
  end if;
  insert into chat.visitatore as v (id, nome, email) values (v_visitatore, nullif(left(btrim(p_nome), 100), ''), nullif(left(lower(btrim(p_email)), 254), ''))
    on conflict (id) do update set
      nome = coalesce(excluded.nome, v.nome),
      email = coalesce(excluded.email, v.email),
      ultimo_il = v_ora;
  insert into chat.messaggio (visitatore, direzione, id_client, testo, pagina)
    values (v_visitatore, 'entrata', p_id_client, p_testo, nullif(left(p_pagina, 500), ''))
    returning * into v_messaggio;
  return json_build_object('id', v_messaggio.id, 'creato_il', v_messaggio.creato_il);
end $$;

create function public.chat_profilo(p_nome text, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_visitatore uuid := auth.uid();
  v_nome text := nullif(left(btrim(p_nome), 100), '');
  v_email text := nullif(left(lower(btrim(p_email)), 254), '');
  v_prima chat.visitatore;
begin
  if v_visitatore is null then raise exception 'not_signed_in' using errcode = 'PT401'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chat:' || v_visitatore::text, 0));
  select * into v_prima from chat.visitatore v where v.id = v_visitatore;
  if not found then return; end if;
  -- Valori vuoti o uguali a quelli salvati: niente cambia e nessun messaggio torna in coda.
  if coalesce(v_nome, v_prima.nome) is not distinct from v_prima.nome and coalesce(v_email, v_prima.email) is not distinct from v_prima.email then
    return;
  end if;
  if v_prima.profilo_finestra is null or v_prima.profilo_finestra < now() - interval '1 hour' then
    v_prima.profilo_cambi := 0;
    v_prima.profilo_finestra := now();
  end if;
  if v_prima.profilo_cambi >= 10 then raise exception 'too_many_changes' using errcode = 'PT429'; end if;
  update chat.visitatore v set
    nome = coalesce(v_nome, v.nome),
    email = coalesce(v_email, v.email),
    ultimo_il = now(),
    profilo_cambi = v_prima.profilo_cambi + 1,
    profilo_finestra = v_prima.profilo_finestra
  where v.id = v_visitatore;
  -- Nome ed email nuovi arrivano lo stesso a Ishtar Lab: l'ultimo messaggio del visitatore torna in coda, in fondo; se il
  -- negozio l'ha appena prelevato non lo conferma e lo rilegge (lo riconosce già registrato e aggiorna il contatto).
  update chat.messaggio m set importato_il = null, in_coda_dal = clock_timestamp()
  where m.id = (select x.id from chat.messaggio x where x.visitatore = v_visitatore and x.direzione = 'entrata' order by x.creato_il desc, x.id desc limit 1);
end $$;

create function public.chat_leggi(p_dopo timestamptz default null, p_limite integer default 50)
returns table (id uuid, direzione text, testo text, firma text, creato_il timestamptz, importato boolean, id_client text)
language plpgsql security definer set search_path = '' as $$
declare v_visitatore uuid := auth.uid();
begin
  if v_visitatore is null then raise exception 'not_signed_in' using errcode = 'PT401'; end if;
  return query
    select u.id, u.direzione, u.testo, u.firma, u.creato_il, u.importato, u.id_client from (
      -- id_client solo dei messaggi del visitatore (il suo valore): il widget riconosce i suoi messaggi anche se la
      -- risposta all'invio si è persa.
      select m.id, m.direzione, m.testo, m.firma, m.creato_il, (m.direzione = 'uscita' or m.consegnato_il is not null) as importato,
        case when m.direzione = 'entrata' then m.id_client end as id_client
      from chat.messaggio m
      where m.visitatore = v_visitatore and (p_dopo is null or m.creato_il > p_dopo)
      order by m.creato_il desc, m.id desc
      limit least(greatest(coalesce(p_limite, 50), 1), 50)
    ) u order by u.creato_il, u.id;
end $$;

create function public.chat_stato()
returns json language sql security definer set search_path = '' as $$
  select json_build_object('online', coalesce(n.battito > now() - interval '2 minutes', false), 'nome', n.nome) from chat.negozio n where n.id = 1;
$$;

-- ——— Negozio ———

create function public.chat_versione()
returns json language sql security definer set search_path = '' as $$
  select json_build_object('versione', n.versione, 'nome', n.nome) from chat.negozio n where n.id = 1;
$$;

create function public.chat_preleva(p_lettore text, p_limite integer default 50)
returns table (id uuid, visitatore uuid, testo text, pagina text, nome text, email text, creato_il timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_negozio chat.negozio;
begin
  if p_lettore is null or char_length(p_lettore) not between 1 and 100 then raise exception 'invalid_reader' using errcode = 'PT400'; end if;
  select * into v_negozio from chat.negozio n where n.id = 1 for update;
  -- Un solo lettore: due istanze di Ishtar Lab collegate alla stessa casella si dividerebbero i messaggi.
  if v_negozio.lettore is not null and v_negozio.lettore <> p_lettore and v_negozio.battito > now() - interval '10 minutes' then
    raise exception 'reader_busy' using errcode = 'PT409';
  end if;
  update chat.negozio n set lettore = p_lettore, battito = now() where n.id = 1;
  -- In ordine di coda; il prelievo si segna sui messaggi restituiti (chat_conferma lo confronta con in_coda_dal).
  return query
    with scelti as (
      select m.id from chat.messaggio m
      where m.direzione = 'entrata' and m.importato_il is null
      order by m.in_coda_dal, m.id
      limit least(greatest(coalesce(p_limite, 50), 1), 200)
    ), segnati as (
      update chat.messaggio m set prelevato_il = clock_timestamp() from scelti s where m.id = s.id
      returning m.id, m.visitatore, m.testo, m.pagina, m.creato_il, m.in_coda_dal
    )
    select g.id, g.visitatore, g.testo, g.pagina, v.nome, v.email, g.creato_il
    from segnati g join chat.visitatore v on v.id = g.visitatore
    order by g.in_coda_dal, g.id;
end $$;

create function public.chat_conferma(p_lettore text, p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_negozio chat.negozio; v_conferme integer;
begin
  select * into v_negozio from chat.negozio n where n.id = 1;
  if v_negozio.lettore is distinct from p_lettore then raise exception 'reader_busy' using errcode = 'PT409'; end if;
  -- Solo messaggi prelevati e non rimessi in coda dopo il prelievo (nome o email nuovi): quelli si rileggono.
  update chat.messaggio m set importato_il = now(), consegnato_il = coalesce(m.consegnato_il, now())
    where m.id = any (coalesce(p_ids, '{}')) and m.direzione = 'entrata' and m.importato_il is null
      and m.prelevato_il is not null and m.in_coda_dal <= m.prelevato_il;
  get diagnostics v_conferme = row_count;
  return v_conferme;
end $$;

create function public.chat_rispondi(p_visitatore uuid, p_id_client text, p_testo text, p_firma text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_messaggio chat.messaggio;
begin
  if p_id_client is null or p_id_client !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid_id' using errcode = 'PT400'; end if;
  if p_testo is null or char_length(btrim(p_testo)) = 0 or char_length(p_testo) > 4000 then raise exception 'invalid_text' using errcode = 'PT400'; end if;
  if not exists (select 1 from chat.visitatore v where v.id = p_visitatore) then raise exception 'unknown_visitor' using errcode = 'PT404'; end if;
  insert into chat.messaggio (visitatore, direzione, id_client, testo, firma)
    values (p_visitatore, 'uscita', p_id_client, p_testo, nullif(left(btrim(p_firma), 100), ''))
    on conflict (id_client) where direzione = 'uscita' do nothing
    returning * into v_messaggio;
  if v_messaggio.id is null then
    -- Stesso id: la stessa risposta già scritta (un nuovo tentativo). Per un altro visitatore è un errore.
    select * into v_messaggio from chat.messaggio m where m.id_client = p_id_client and m.direzione = 'uscita';
    if v_messaggio.visitatore <> p_visitatore then raise exception 'id_conflict' using errcode = 'PT409'; end if;
  end if;
  return json_build_object('id', v_messaggio.id, 'creato_il', v_messaggio.creato_il);
end $$;

create function public.chat_verifica(p_id_client text)
returns json language sql security definer set search_path = '' as $$
  select json_build_object('id', m.id, 'creato_il', m.creato_il) from chat.messaggio m where m.id_client = p_id_client and m.direzione = 'uscita';
$$;

create function public.chat_pulizia(p_giorni_importati integer, p_giorni_anonimi integer)
returns json language plpgsql security definer set search_path = '' as $$
declare v_conversazioni integer; v_anonimi integer;
begin
  if coalesce(p_giorni_importati, 0) < 1 or coalesce(p_giorni_anonimi, 0) < 1 then raise exception 'invalid_days' using errcode = 'PT400'; end if;
  -- Conversazioni ferme da più giorni del limite e già tutte importate: mai una con un messaggio da importare.
  delete from chat.visitatore v
    where v.ultimo_il < now() - make_interval(days => p_giorni_importati)
      and not exists (select 1 from chat.messaggio m where m.visitatore = v.id and m.creato_il >= now() - make_interval(days => p_giorni_importati))
      and not exists (select 1 from chat.messaggio m where m.visitatore = v.id and m.direzione = 'entrata' and m.importato_il is null);
  get diagnostics v_conversazioni = row_count;
  -- Utenti anonimi senza conversazione, più vecchi del limite.
  delete from auth.users u
    where u.is_anonymous and u.created_at < now() - make_interval(days => p_giorni_anonimi)
      and not exists (select 1 from chat.visitatore v where v.id = u.id);
  get diagnostics v_anonimi = row_count;
  return json_build_object('conversazioni', v_conversazioni, 'anonimi', v_anonimi);
end $$;

-- ——— Permessi delle funzioni, uno per uno ———
revoke execute on function public.chat_scrivi(text, text, text, text, text), public.chat_profilo(text, text),
  public.chat_leggi(timestamptz, integer), public.chat_stato(), public.chat_versione(), public.chat_preleva(text, integer),
  public.chat_conferma(text, uuid[]), public.chat_rispondi(uuid, text, text, text), public.chat_verifica(text),
  public.chat_pulizia(integer, integer) from public, anon, authenticated;
grant execute on function public.chat_scrivi(text, text, text, text, text) to authenticated;
grant execute on function public.chat_profilo(text, text) to authenticated;
grant execute on function public.chat_leggi(timestamptz, integer) to authenticated;
grant execute on function public.chat_stato() to anon, authenticated;
revoke execute on function public.chat_versione(), public.chat_preleva(text, integer), public.chat_conferma(text, uuid[]),
  public.chat_rispondi(uuid, text, text, text), public.chat_verifica(text), public.chat_pulizia(integer, integer) from service_role;
grant execute on function public.chat_versione(), public.chat_preleva(text, integer), public.chat_conferma(text, uuid[]),
  public.chat_rispondi(uuid, text, text, text), public.chat_verifica(text), public.chat_pulizia(integer, integer) to service_role;
