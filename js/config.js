/* TOUGE App — configurazione.
 * Se supabaseUrl e supabaseAnonKey sono compilati l'app usa Supabase (account e dati online,
 * recensioni condivise tra utenti). Se sono vuoti funziona in modalità locale (tutto sul dispositivo).
 *
 * Dove trovarli: Supabase → Project Settings → API → "Project URL" e "anon public".
 * La chiave "anon public" è fatta per stare nel codice dell'app: i dati sono protetti dalle
 * regole RLS di supabase/schema.sql. NON inserire MAI qui la chiave "service_role".
 */
window.TOUGE_CONFIG = {
  supabaseUrl: 'https://lvjifupcmfbxmzjtpvry.supabase.co',
  supabaseAnonKey: 'sb_publishable_GPGYFRxwTkzN4vJeeQ0hEw_TUFAMesN', // chiave "publishable" (pubblica per design)
  // true solo dopo aver attivato il provider Google in Supabase (Authentication → Sign In / Providers → Google)
  googleLogin: false,
  // email di contatto mostrata nell'informativa privacy (#privacy). Obbligatoria prima di aprire l'app al pubblico.
  contactEmail: 'touge.app@gmail.com',
};
