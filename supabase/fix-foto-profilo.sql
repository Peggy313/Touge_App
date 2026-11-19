-- TOUGE App · correzione: permesso di salvare foto profilo e foto dell'auto.
-- Serve se v3.sql è stato eseguito dopo v4.sql (la v3 reimposta i permessi del profilo).
-- Supabase → SQL Editor → New query → incolla → Run. Si può rieseguire.
grant update (name, car, avatar, intro_seen, photo, car_photo) on public.profiles to authenticated;
