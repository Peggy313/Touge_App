# Da caricare su GitHub

Elenco dei file cambiati e **non ancora caricati** su https://github.com/Peggy313/Touge_App.
Claude lo aggiorna a ogni modifica. Quando hai caricato, dillo a Claude ("caricato") e lo svuota.

Come caricare: repo → entra nella cartella indicata → **Add file → Upload files** → trascina i file
(dalla cartella `site`, che è sempre aggiornata) → **Commit changes**.
In alternativa trascina tutto il contenuto di `site` nella pagina principale del repo.

_Ultimo aggiornamento: 19/11/2026 — modalità ospite, privacy, stato strade, testi 13 px_

| Cartella sul repo | File | Novità |
|---|---|---|
| root (pagina principale) | `index.html` | carica `js/privacy.js` |
| root (pagina principale) | `sw.js` | cache aggiornata (v4) |
| `css` | `style.css` | barra ospite, foglio invito, stato strade, privacy, testi min 13 px, foglio privacy |
| `js` | `app.js` | modalità ospite, inviti, privacy, stato strade, Segnala, bottone Registrati, privacy dalla registrazione senza perdere i campi |
| `js` | `store.js` | segnalazioni recensioni e stato strade |
| `js` | `i18n.js` | testi nuovi IT/EN |
| `js` | `config.js` | email di contatto touge.app@gmail.com |
| `js` | `privacy.js` | **file nuovo**: testo dell'informativa |

## Da fare su Supabase (non si carica su GitHub)
- [ ] SQL Editor → New query → incolla tutto `supabase/v3.sql` → **Run**
