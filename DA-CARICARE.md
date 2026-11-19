# Da caricare su GitHub

Elenco dei file cambiati e **non ancora caricati** su https://github.com/Peggy313/Touge_App.
Claude lo aggiorna a ogni modifica. Quando hai caricato, dillo a Claude ("caricato") e lo svuota.

Come caricare: repo → entra nella cartella indicata → **Add file → Upload files** → trascina i file
(dalla cartella `site`, che è sempre aggiornata) → **Commit changes**.
In alternativa trascina tutto il contenuto di `site` nella pagina principale del repo.

_Ultimo aggiornamento: 19/11/2026 — ospite, privacy, stato strade, 13 px, Partiamo!, Discovery, Foto + VERIFICATO, Itinerari, **Avvisi e notifiche**_

| Cartella sul repo | File | Novità |
|---|---|---|
| root (pagina principale) | `index.html` | carica `privacy.js`, `cities.js`, `weather.js`, `photos.js`, `trips.js` |
| root (pagina principale) | `sw.js` | cache v8 + **riceve le notifiche push** |
| `css` | `style.css` | tutte le novità, **campanella e notifiche** comprese |
| `js` | `app.js` | ospite, privacy, stato strade, Partiamo!, Discovery, foto, itinerari, **avvisi e notifiche** |
| `js` | `store.js` | segnalazioni, stato strade, foto, itinerari, **preferenze notifiche** |
| `js` | `i18n.js` | testi nuovi IT/EN |
| `js` | `share.js` | cartolina: polaroid della tua auto, placca VERIFICATO |
| `js` | `config.js` | email di contatto + posto per la chiave pubblica delle notifiche |
| `js` | `privacy.js` | **file nuovo**: informativa (posizione, meteo, foto, itinerari, notifiche) |
| `js` | `cities.js` | **file nuovo**: città per "Parto da…" |
| `js` | `weather.js` | **file nuovo**: meteo in vetta (Open-Meteo) |
| `js` | `photos.js` | **file nuovo**: posizione nella foto, rimpicciolimento, distanza dal tracciato |
| `js` | `trips.js` | **file nuovo**: itinerari curati, ordine automatico, giorni, link Maps |

## Da fare su Supabase (non si carica su GitHub) — query separate, in quest'ordine
- [ ] SQL Editor → New query → incolla tutto `supabase/v3.sql` → **Run**
- [ ] SQL Editor → New query → incolla tutto `supabase/v4.sql` → **Run** (foto)
- [ ] SQL Editor → New query → incolla tutto `supabase/v5.sql` → **Run** (itinerari)
- [ ] Notifiche push (facoltativo, quando vuoi): segui **NOTIFICHE-SETUP.md** (comprende `supabase/v6.sql`)
