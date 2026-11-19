-- ═══════════════════════════════════════════════════════════════════
-- TOUGE App · aggiornamento V5 · ITINERARI (da eseguire UNA volta, DOPO v3.sql e v4.sql)
-- Supabase → SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi: non cancella dati esistenti.
--
-- Itinerari dei piloti: privati finché il pilota non li pubblica, segnalabili
-- (nascosti per tutti dopo 3 segnalazioni). Gli itinerari curati stanno nell'app (js/trips.js).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  -- elenco dei passi in ordine: [{"r": "stelvio"}, {"r": "gavia"}, …]
  stops       jsonb not null check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) between 2 and 15),
  hours       smallint not null default 5 check (hours between 1 and 12),
  manual      boolean not null default false,
  public      boolean not null default false,
  hidden      boolean not null default false,
  author_name text not null default '',
  author_car  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trips_public_idx on public.trips (updated_at desc) where public and not hidden;
create index if not exists trips_user_idx on public.trips (user_id);
alter table public.trips enable row level security;
drop policy if exists "itinerari: lettura" on public.trips;
drop policy if exists "itinerari: creo i miei" on public.trips;
drop policy if exists "itinerari: modifico i miei" on public.trips;
drop policy if exists "itinerari: elimino i miei" on public.trips;
create policy "itinerari: lettura" on public.trips for select using ((public and not hidden) or auth.uid() = user_id);
create policy "itinerari: creo i miei" on public.trips for insert with check (auth.uid() = user_id);
create policy "itinerari: modifico i miei" on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "itinerari: elimino i miei" on public.trips for delete using (auth.uid() = user_id);
grant select on public.trips to anon, authenticated;
grant insert, delete on public.trips to authenticated;
grant update (title, stops, hours, manual, public) on public.trips to authenticated;

-- autore dal profilo, anti-spam; chi modifica non può togliere il "nascosto" messo dalle segnalazioni
create or replace function public.trips_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; n int;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.hidden := false;
    select count(*) into n from public.trips where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 20 then raise exception 'too_many_trips'; end if;
  else
    new.hidden := old.hidden;
    new.user_id := old.user_id;
  end if;
  select name, car into p from public.profiles where id = auth.uid();
  new.author_name := coalesce(p.name, 'Pilota');
  new.author_car  := coalesce(p.car, '');
  new.updated_at  := now();
  return new;
end $$;
drop trigger if exists trips_before_write on public.trips;
create trigger trips_before_write before insert or update on public.trips
  for each row execute function public.trips_before_write();

-- segnalazioni (una per pilota per itinerario): con 3 l'itinerario si nasconde per tutti
create table if not exists public.trip_reports (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_reports enable row level security;
drop policy if exists "segnalazioni itinerari: le mie" on public.trip_reports;
drop policy if exists "segnalazioni itinerari: invio" on public.trip_reports;
create policy "segnalazioni itinerari: le mie" on public.trip_reports for select using (auth.uid() = user_id);
create policy "segnalazioni itinerari: invio"  on public.trip_reports for insert with check (auth.uid() = user_id);
grant select, insert on public.trip_reports to authenticated;

create or replace function public.trip_reported()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trip_reports where trip_id = new.trip_id) >= 3 then
    update public.trips set hidden = true where id = new.trip_id;
  end if;
  return new;
end $$;
drop trigger if exists trip_reported on public.trip_reports;
create trigger trip_reported after insert on public.trip_reports
  for each row execute function public.trip_reported();

-- se il pilota cambia nome, auto o foto: si aggiornano recensioni, foto e itinerari
create or replace function public.profiles_sync_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name or new.car is distinct from old.car or new.photo is distinct from old.photo then
    update public.reviews set author_name = new.name, author_car = new.car, author_photo = new.photo where user_id = new.id;
    update public.road_photos set author_name = new.name, author_car = new.car, author_photo = new.photo where user_id = new.id;
    update public.trips set author_name = new.name, author_car = new.car where user_id = new.id;
  end if;
  return new;
end $$;
