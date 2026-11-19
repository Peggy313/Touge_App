-- ═══════════════════════════════════════════════════════════════════
-- TOUGE App · aggiornamento V3 (da eseguire UNA volta, dopo schema.sql)
-- Supabase → SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi: non cancella dati esistenti.
--
--  1. Recensioni: nome e auto dell'autore presi dal profilo (non più dal telefono),
--     limite anti-spam, nascoste in automatico dopo 3 segnalazioni.
--  2. Profili: si possono modificare solo nome, auto, avatar e intro.
--  3. Stato delle strade: segnalazioni "aperta / chiusa" dei piloti
--     + tabella road_status che compili tu (conferma ufficiale, vince sulle segnalazioni più vecchie).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Recensioni ────────────────────────────────────────────────
alter table public.reviews add column if not exists hidden boolean not null default false;

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; n int;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    select name, car into p from public.profiles where id = auth.uid();
    new.author_name := coalesce(p.name, 'Pilota');
    new.author_car  := coalesce(p.car, '');
    new.hidden := false;
    select count(*) into n from public.reviews where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 10 then raise exception 'too_many_reviews'; end if;
  end if;
  return new;
end $$;
drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- se il pilota cambia nome o auto, le sue recensioni si aggiornano
create or replace function public.profiles_sync_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name or new.car is distinct from old.car then
    update public.reviews set author_name = new.name, author_car = new.car where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_reviews on public.profiles;
create trigger profiles_sync_reviews after update on public.profiles
  for each row execute function public.profiles_sync_reviews();

-- le recensioni nascoste le vede solo chi le ha scritte (e tu dalla dashboard)
drop policy if exists "recensioni: lettura pubblica" on public.reviews;
create policy "recensioni: lettura pubblica" on public.reviews for select using (not hidden or auth.uid() = user_id);

-- segnalazioni delle recensioni (una per pilota per recensione)
create table if not exists public.review_reports (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_reports enable row level security;
drop policy if exists "segnalazioni: le mie" on public.review_reports;
drop policy if exists "segnalazioni: invio" on public.review_reports;
create policy "segnalazioni: le mie" on public.review_reports for select using (auth.uid() = user_id);
create policy "segnalazioni: invio"  on public.review_reports for insert with check (auth.uid() = user_id);
grant select, insert on public.review_reports to authenticated;

create or replace function public.review_reported()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.review_reports where review_id = new.review_id) >= 3 then
    update public.reviews set hidden = true where id = new.review_id;
  end if;
  return new;
end $$;
drop trigger if exists review_reported on public.review_reports;
create trigger review_reported after insert on public.review_reports
  for each row execute function public.review_reported();

-- ── 2 · Profili: colonne modificabili dall'app ────────────────────
revoke update on public.profiles from authenticated;
grant update (name, car, avatar, intro_seen) on public.profiles to authenticated;
-- se v4 (foto) è già stata eseguita, ridà anche il permesso sulle colonne delle foto
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'car_photo') then
    grant update (photo, car_photo) on public.profiles to authenticated;
  end if;
end $$;

-- ── 3 · Stato delle strade ────────────────────────────────────────
-- segnalazioni dei piloti: una per strada per giorno (si può cambiare idea nello stesso giorno)
create table if not exists public.road_reports (
  id         bigint generated always as identity primary key,
  road_id    text not null check (char_length(road_id) <= 60),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status     text not null check (status in ('open', 'closed')),
  day        date not null default current_date,
  created_at timestamptz not null default now(),
  unique (road_id, user_id, day)
);
create index if not exists road_reports_recent_idx on public.road_reports (created_at desc);
alter table public.road_reports enable row level security;
drop policy if exists "stato: lettura pubblica" on public.road_reports;
create policy "stato: lettura pubblica" on public.road_reports for select using (true);
-- in lettura solo strada, stato e data: chi ha segnalato resta anonimo
revoke all on public.road_reports from anon, authenticated;
grant select (road_id, status, created_at) on public.road_reports to anon, authenticated;

-- l'app segnala tramite questa funzione (max 30 segnalazioni al giorno per pilota)
create or replace function public.report_road(p_road text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_status not in ('open', 'closed') then raise exception 'bad status'; end if;
  if (select count(*) from public.road_reports where user_id = auth.uid() and day = current_date) >= 30 then
    raise exception 'too_many_reports';
  end if;
  insert into public.road_reports (road_id, user_id, status) values (left(p_road, 60), auth.uid(), p_status)
  on conflict (road_id, user_id, day) do update set status = excluded.status, created_at = now();
end $$;
revoke all on function public.report_road(text, text) from public, anon;
grant execute on function public.report_road(text, text) to authenticated;

-- stato confermato da te: lo compili da Table Editor → road_status
-- road_id = id della strada (es. stelvio), status = open / closed, note e source facoltativi
create table if not exists public.road_status (
  road_id    text primary key check (char_length(road_id) <= 60),
  status     text not null check (status in ('open', 'closed')),
  note       text not null default '',
  source     text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.road_status enable row level security;
drop policy if exists "stato ufficiale: lettura pubblica" on public.road_status;
create policy "stato ufficiale: lettura pubblica" on public.road_status for select using (true);
grant select on public.road_status to anon, authenticated;

create or replace function public.road_status_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists road_status_touch on public.road_status;
create trigger road_status_touch before insert or update on public.road_status
  for each row execute function public.road_status_touch();
