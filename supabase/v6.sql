-- ═══════════════════════════════════════════════════════════════════
-- TOUGE App · aggiornamento V6 · NOTIFICHE (da eseguire UNA volta, DOPO v3, v4 e v5)
-- Supabase → SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi: non cancella dati esistenti.
--
--  push_subs     telefoni iscritti alle notifiche (uno per dispositivo)
--  notify_prefs  quali avvisi vuole ogni pilota (+ partenza arrotondata a ~10 km per "vicino a te")
--  notify_log    avvisi già spediti (per non ripeterli). Lo usa solo il servizio touge-notify.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_subs (
  endpoint   text primary key check (char_length(endpoint) <= 1000),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;
drop policy if exists "push: le mie" on public.push_subs;
drop policy if exists "push: elimino le mie" on public.push_subs;
create policy "push: le mie" on public.push_subs for select using (auth.uid() = user_id);
create policy "push: elimino le mie" on public.push_subs for delete using (auth.uid() = user_id);
grant select, delete on public.push_subs to authenticated;

-- l'app registra il telefono tramite questa funzione (se il telefono era di un altro account, passa a te)
create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_endpoint !~ '^https://' then raise exception 'bad endpoint'; end if;
  select count(*) into n from public.push_subs where user_id = auth.uid();
  if n >= 10 then delete from public.push_subs where endpoint in (select endpoint from public.push_subs where user_id = auth.uid() order by created_at limit 1); end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth) values (left(p_endpoint, 1000), auth.uid(), left(p_p256dh, 200), left(p_auth, 100))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke all on function public.save_push_sub(text, text, text) from public, anon;
grant execute on function public.save_push_sub(text, text, text) to authenticated;

create table if not exists public.notify_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  push       boolean not null default false,
  reopen     boolean not null default true,
  wx_fav     boolean not null default true,
  wx_near    boolean not null default true,
  news       boolean not null default true,
  near_min   smallint not null default 120 check (near_min in (60, 120, 180)),
  near_lat   numeric(4, 1) check (near_lat between -90 and 90),
  near_lng   numeric(4, 1) check (near_lng between -180 and 180),
  lang       text not null default 'it' check (lang in ('it', 'en')),
  updated_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists "notifiche: le mie" on public.notify_prefs;
create policy "notifiche: le mie" on public.notify_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.notify_prefs to authenticated;

-- solo per il servizio (nessuna regola = l'app non lo vede)
create table if not exists public.notify_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notify_log enable row level security;
