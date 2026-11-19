-- ═══════════════════════════════════════════════════════════════════
-- TOUGE App · V2 · schema Supabase
-- Da incollare in Supabase → SQL Editor → New query → Run (una volta sola).
-- Crea: profili pilota, strade guidate, preferiti, recensioni + regole di sicurezza (RLS).
-- ═══════════════════════════════════════════════════════════════════

-- Profilo pilota (1 riga per utente, creata in automatico alla registrazione)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default 'Pilota' check (char_length(name) between 1 and 40),
  car         text not null default '' check (char_length(car) <= 60),
  avatar      smallint not null default 0,
  intro_seen  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Strade guidate (la collezione)
create table if not exists public.driven (
  user_id    uuid not null references auth.users (id) on delete cascade,
  road_id    text not null check (char_length(road_id) <= 60),
  driven_at  timestamptz not null default now(),
  primary key (user_id, road_id)
);

-- Preferiti
create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  road_id    text not null check (char_length(road_id) <= 60),
  created_at timestamptz not null default now(),
  primary key (user_id, road_id)
);

-- Recensioni (pubbliche in lettura, ognuno gestisce solo le proprie)
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  road_id     text not null check (char_length(road_id) <= 60),
  user_id     uuid not null references auth.users (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null check (char_length(text) between 5 and 500),
  author_name text not null default '' check (char_length(author_name) <= 40),
  author_car  text not null default '' check (char_length(author_car) <= 60),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_road_idx on public.reviews (road_id, created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

-- ── Sicurezza: Row Level Security ─────────────────────────────────
alter table public.profiles  enable row level security;
alter table public.driven    enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews   enable row level security;

drop policy if exists "profilo: leggo il mio"     on public.profiles;
drop policy if exists "profilo: modifico il mio"  on public.profiles;
create policy "profilo: leggo il mio"    on public.profiles for select using (auth.uid() = id);
create policy "profilo: modifico il mio" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "guidate: solo le mie" on public.driven;
create policy "guidate: solo le mie" on public.driven for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "preferiti: solo i miei" on public.favorites;
create policy "preferiti: solo i miei" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recensioni: lettura pubblica"   on public.reviews;
drop policy if exists "recensioni: scrivo le mie"      on public.reviews;
drop policy if exists "recensioni: elimino le mie"     on public.reviews;
create policy "recensioni: lettura pubblica" on public.reviews for select using (true);
create policy "recensioni: scrivo le mie"    on public.reviews for insert with check (auth.uid() = user_id);
create policy "recensioni: elimino le mie"   on public.reviews for delete using (auth.uid() = user_id);

-- ── Profilo creato in automatico alla registrazione ───────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, car, avatar)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'name', 40), ''), 'Pilota'),
    coalesce(left(new.raw_user_meta_data ->> 'car', 60), ''),
    coalesce((new.raw_user_meta_data ->> 'avatar')::smallint, 0)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── "Elimina account" dall'app: cancella l'utente e (a cascata) tutti i suoi dati ──
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Permessi (inclusi qui anche da grants.sql) ──
grant usage on schema public to anon, authenticated;

grant select on public.reviews to anon;                              -- recensioni leggibili da tutti
grant select, insert, delete on public.reviews to authenticated;     -- (le regole RLS: solo le proprie)
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.driven to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;

