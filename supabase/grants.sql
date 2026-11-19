-- TOUGE App · permessi per l'app (da eseguire una volta nel SQL Editor, dopo schema.sql).
-- I progetti Supabase nuovi non danno più accesso automatico alle tabelle: questi GRANT
-- aprono solo ciò che serve, poi le regole RLS di schema.sql decidono riga per riga.
grant usage on schema public to anon, authenticated;

grant select on public.reviews to anon;                              -- recensioni leggibili da tutti
grant select, insert, delete on public.reviews to authenticated;     -- (le regole RLS: solo le proprie)
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.driven to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
