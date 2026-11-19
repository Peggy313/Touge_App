-- ═══════════════════════════════════════════════════════════════════
-- TOUGE App · aggiornamento V4 · FOTO (da eseguire UNA volta, DOPO v3.sql)
-- Supabase → SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi: non cancella dati esistenti.
--
--  1. Spazio file "photos" (pubblico in lettura): ogni pilota scrive solo nella sua cartella.
--  2. Profilo: foto profilo e foto dell'auto.
--  3. Recensioni: mostrano anche la foto profilo dell'autore.
--  4. Foto delle strade: 1 per pilota per strada, solo se l'ha segnata come guidata,
--     "verificata" se scattata/caricata vicino al tracciato, nascosta dopo 3 segnalazioni.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Spazio file ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "foto: carico nella mia cartella" on storage.objects;
drop policy if exists "foto: vedo la mia cartella" on storage.objects;
drop policy if exists "foto: elimino nella mia cartella" on storage.objects;
create policy "foto: carico nella mia cartella" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto: vedo la mia cartella" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "foto: elimino nella mia cartella" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 2 · Profilo: foto profilo e auto ──────────────────────────────
alter table public.profiles add column if not exists photo text not null default '';
alter table public.profiles add column if not exists car_photo text not null default '';
alter table public.profiles drop constraint if exists profiles_photo_path;
alter table public.profiles add constraint profiles_photo_path check (
  (photo = '' or photo like id::text || '/%') and (car_photo = '' or car_photo like id::text || '/%')
  and char_length(photo) <= 200 and char_length(car_photo) <= 200);
grant update (name, car, avatar, intro_seen, photo, car_photo) on public.profiles to authenticated;

-- ── 3 · Recensioni con la foto dell'autore ────────────────────────
alter table public.reviews add column if not exists author_photo text not null default '';

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; n int;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    select name, car, photo into p from public.profiles where id = auth.uid();
    new.author_name  := coalesce(p.name, 'Pilota');
    new.author_car   := coalesce(p.car, '');
    new.author_photo := coalesce(p.photo, '');
    new.hidden := false;
    select count(*) into n from public.reviews where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 10 then raise exception 'too_many_reviews'; end if;
  end if;
  return new;
end $$;

-- ── 4 · Foto delle strade ─────────────────────────────────────────
create table if not exists public.road_photos (
  id           uuid primary key default gen_random_uuid(),
  road_id      text not null check (char_length(road_id) <= 60),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path         text not null check (char_length(path) <= 200),
  verified     boolean not null default false,
  verified_by  text not null default '' check (verified_by in ('', 'photo', 'phone')),
  author_name  text not null default '',
  author_car   text not null default '',
  author_photo text not null default '',
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (road_id, user_id)
);
create index if not exists road_photos_road_idx on public.road_photos (road_id, created_at desc);
alter table public.road_photos enable row level security;
drop policy if exists "foto strade: lettura pubblica" on public.road_photos;
drop policy if exists "foto strade: pubblico le mie" on public.road_photos;
drop policy if exists "foto strade: elimino le mie" on public.road_photos;
create policy "foto strade: lettura pubblica" on public.road_photos for select using (not hidden or auth.uid() = user_id);
create policy "foto strade: pubblico le mie" on public.road_photos for insert with check (auth.uid() = user_id);
create policy "foto strade: elimino le mie"  on public.road_photos for delete using (auth.uid() = user_id);
grant select on public.road_photos to anon, authenticated;
grant insert, delete on public.road_photos to authenticated;

-- controlli all'invio: autore dal profilo, file nella sua cartella, strada segnata come guidata, anti-spam
create or replace function public.road_photos_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; n int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  new.user_id := auth.uid();
  if new.path not like auth.uid()::text || '/%' then raise exception 'bad_path'; end if;
  if not exists (select 1 from public.driven where user_id = auth.uid() and road_id = new.road_id) then
    raise exception 'not_driven';
  end if;
  select count(*) into n from public.road_photos where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= 20 then raise exception 'too_many_photos'; end if;
  select name, car, photo into p from public.profiles where id = auth.uid();
  new.author_name  := coalesce(p.name, 'Pilota');
  new.author_car   := coalesce(p.car, '');
  new.author_photo := coalesce(p.photo, '');
  new.hidden := false;
  if not new.verified then new.verified_by := ''; end if;
  return new;
end $$;
drop trigger if exists road_photos_before_insert on public.road_photos;
create trigger road_photos_before_insert before insert on public.road_photos
  for each row execute function public.road_photos_before_insert();

-- se il pilota cambia nome, auto o foto: si aggiornano recensioni e foto
create or replace function public.profiles_sync_reviews()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name or new.car is distinct from old.car or new.photo is distinct from old.photo then
    update public.reviews set author_name = new.name, author_car = new.car, author_photo = new.photo where user_id = new.id;
    update public.road_photos set author_name = new.name, author_car = new.car, author_photo = new.photo where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_reviews on public.profiles;
create trigger profiles_sync_reviews after update on public.profiles
  for each row execute function public.profiles_sync_reviews();

-- segnalazioni delle foto (una per pilota per foto): con 3 la foto si nasconde per tutti
create table if not exists public.photo_reports (
  photo_id   uuid not null references public.road_photos (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);
alter table public.photo_reports enable row level security;
drop policy if exists "segnalazioni foto: le mie" on public.photo_reports;
drop policy if exists "segnalazioni foto: invio" on public.photo_reports;
create policy "segnalazioni foto: le mie" on public.photo_reports for select using (auth.uid() = user_id);
create policy "segnalazioni foto: invio"  on public.photo_reports for insert with check (auth.uid() = user_id);
grant select, insert on public.photo_reports to authenticated;

create or replace function public.photo_reported()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.photo_reports where photo_id = new.photo_id) >= 3 then
    update public.road_photos set hidden = true where id = new.photo_id;
  end if;
  return new;
end $$;
drop trigger if exists photo_reported on public.photo_reports;
create trigger photo_reported after insert on public.photo_reports
  for each row execute function public.photo_reported();
