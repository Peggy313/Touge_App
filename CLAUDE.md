# TOUGE App — guida per Claude

App web mobile-first (installabile come PWA) che raccoglie passi di montagna e strade panoramiche da guidare in auto, con estetica **rally anni '80/'90 + cultura touge**. Claim: *"Attacca il passo. Colleziona la montagna."* · Messaggio di condivisione: *"Touge: guida, raccogli e conquista le tue strade"*.

## L'utente
- Scrive in italiano (a volte in inglese): rispondi nella lingua del messaggio.
- Prima di lavori grossi vuole **domande** (AskUserQuestion), poi si procede.
- Testa su **iPhone 16 (393×852)**: verifica sempre a quella misura (e a 375×667), niente scroll orizzontale; login/registrazione/intro devono stare in una schermata senza scorrere.
- **Leggibilità prima di tutto.**
- Sul PC **non ci sono Node, Python né Git**: niente build tool. Per dashboard esterne (Supabase, GitHub) dagli istruzioni click-per-click.
- Non è sviluppatore: alla fine di ogni modifica digli **quali file ricaricare su GitHub e in quale cartella**.

## Stack e file
HTML/CSS/JS puro, nessun bundler. Script caricati in ordine in `index.html`:
| File | Contenuto |
|---|---|
| `js/config.js` | URL Supabase + chiave *publishable* (pubblica per design) + `googleLogin: false` |
| `js/data.js` | `ROADS` (107 strade) e `COUNTRIES` (IT, CH, FR, AT, SI) + recensioni demo (solo modalità locale) |
| `js/i18n.js` | testi IT/EN (`I18N`) e `TAGS` |
| `js/store.js` | `Auth` + `Store`: modalità **cloud** (Supabase) o **locale** (localStorage) con la stessa interfaccia |
| `js/art.js` | `roadArt()`: illustrazioni SVG generate per ogni strada (giorno/tramonto/notte, serpentina, mezzeria gialla) + `roadParts` |
| `js/share.js` | `TougeShare`: cartolina 2:3 (1200×1800) tutta in SVG, 3 stili (retro / vapor / cyber, atmosfere in `art.js`) e 4 elementi accendibili (francobollo, timbro, "Saluti da…", placca). Anteprima in pagina, PNG e SVG scaricabili (caratteri incorporati da Google Fonts), storia Instagram 9:16 con la cartolina inclinata |
| `js/app.js` | router a hash (`#explore`, `#road-<id>`, ecc.), tutte le schermate, filtri, mappa, condivisione |
| `css/style.css` | tutto lo stile (le regole più recenti sono in coda e sovrascrivono) |
| `data/routes.json` | tracciati stradali reali pre-calcolati (OSRM) per ogni strada |
| `sw.js`, `manifest.json`, `icons/` | PWA (cache "rete prima") e icone PNG |
| `artifact.html` | versione per Artifact claude.ai (V1 demo, modalità locale, mappe vettoriali) |
| `js/privacy.js` | testo dell'informativa privacy IT/EN (`window.PRIVACY`) |
| `supabase/schema.sql`, `supabase/grants.sql` | tabelle, RLS, trigger profilo, `delete_my_account()`, GRANT |
| `supabase/v3.sql` | V3: recensioni (autore dal profilo, anti-spam, `hidden`, `review_reports`), colonne profilo modificabili, `road_reports` + `report_road()`, `road_status` |
| `.gitignore`, `GITHUB-DESKTOP.md` | pubblicazione con GitHub Desktop (commit + push) |
| `tools/build-data.ps1` | rigenera `data/routes.json` (+ europe.json, leaflet.css) da OSRM |
| `tools/build-site.ps1` | crea la cartella `site/` pulita per GitHub Pages |
| `serve.ps1` + `.claude/launch.json` | server locale su http://localhost:5173 (preview "touge") |
| `versions/V1` | copia congelata della V1 |

## Regole sui dati delle strade
- Ogni strada: `id, name, country, region, alt, km, hairpins, diff (1–5), closure, toll, tags, wp [[lat,lng]…], it, en` (`noRouting: true` se OSRM non la instrada, es. Silvretta).
- **Le nuove strade vanno in CODA all'array**: il numero di collezione `No.` è l'indice, le placche esistenti non devono cambiare numero.
- Dopo aver aggiunto strade: validare i waypoint con OSRM (distanza percorso vs `km`, snap < ~400 m), poi `tools\build-data.ps1`.
- Dati (km, tornanti, chiusure) sono **indicativi**; il disclaimer resta.

## Flusso e UX decisi
- Apertura animata (strada che si disegna, sole che sorge, TOUGE che si compone) → **si entra solo con un tocco**.
- **Modalità ospite (V3)**: senza account si vede tutto (Esplora, Mappa, pagina strada, recensioni, cartolina). Prima apertura: "Cos'è TOUGE?" (in fondo "Crea il tuo account" + link "Esplora senza account"), poi Esplora (`localStorage touge.guestIntro`).
- Inviti a registrarsi per l'ospite: barra gialla fissa sopra le tab (`#joinbar`, `body.guest` → `--joinbar: 46px`), bottone ENTRA in Esplora, foglio con la placca (`openJoinSheet`) al tocco di ♥ / Strada guidata / Recensisci / Segnala / È aperta-chiusa / tab Le tue strade e Pilota, promemoria una volta dopo 3 strade viste. Dopo la registrazione si torna dov'eri (`sessionStorage touge.next`) e l'azione ♥ / guidata viene completata (`touge.pending`).
- Utente loggato: apertura → Esplora. La sessione resta ricordata. Logout ed elimina account → Esplora da ospite.
- **Privacy** `#privacy` (testo in `js/privacy.js`, titolare "Progetto TOUGE", email da `contactEmail` in `config.js`): link nella registrazione (checkbox "ho letto… e ho almeno 14 anni") e in Pilota.
- **Stato strada** (box sotto i bottoni nella pagina strada + badge Aperta/Chiusa sulle card): segnalazioni dei piloti "È aperta / È chiusa" (una al giorno per strada, maggioranza nei 3 giorni attorno all'ultima, validità 14 giorni; badge solo se < 7 giorni) + conferma ufficiale dalla tabella `road_status` che compila l'utente su Supabase (vince se più recente).
- Recensioni: "Segnala" (due tocchi) → nascosta per chi segnala, per tutti dopo 3 segnalazioni. Autore e auto presi dal profilo lato database.
- Testi: **minimo 13 px** ovunque (eccezione: testo dentro i segnaposto SVG della mappa).
- Tab: **Esplora · Mappa · Le tue strade · Pilota**.
- Esplora: chip filtro **Paese, Difficoltà, Lunghezza, Tornanti, Altitudine** (multi-selezione in un foglio dal basso) + toggle "Aperte tutto l'anno", "Senza pedaggio", chip rosso "Azzera". Con filtri o ricerca attivi sparisce la Strada del giorno e il titolo diventa "Risultati". Il bottone con i cursori serve solo all'ordinamento. Stessi chip nella Mappa.
- Bottone pagina strada: "Strada da guidare" ↔ "Strada guidata ✓". "Invia link" (link alla strada) e "Condividi la strada" (**sempre attiva**: placca "Strada guidata" se guidata, "Strada da guidare" altrimenti) → foglio "La tua cartolina": stile in alto (Retrò · Vaporwave · Cyberpunk, anche scorrendo sull'anteprima), chip elementi sotto, bottoni **Instagram** (foglio di condivisione con la storia 9:16, preparata in anticipo perché iOS vuole `navigator.share` subito al tocco) e **Salva ▾** → PNG / SVG. Scelte ricordate in `localStorage touge.postcard`.
- Le tue strade: anelli Collezione (strade) e Chilometri.

## Stile visivo (non stravolgere)
- Asfalto scuro `--asphalt`, carta da poster `--paper`, giallo mezzeria `--yellow`, livrea blu/azzurro/rosso (`--livery`), ombre nette offset, angoli vivi, chip a parallelogramma.
- Font: Anton (titoli), Barlow (testo), Space Mono (dati), Bodoni Moda (numeri poster di sfondo), Alfa Slab One compresso (altitudini sulle card: `.card-alt b`), League Gothic + Josefin Sans (placca), Noto Sans JP (峠, 走り屋).
- **Placca "Strada guidata"**: forma delle placche dei rally storici tipo Monte Carlo (spalle piatte, cupola centrale, riquadro crema col numero, gg/mm a sinistra, anno a destra), piccola e inclinata sulle card. Solo la forma: **niente nomi o marchi Monte Carlo**.
- Segnaposto mappa = targa rally con cupola; strada guidata = targa nera a scacchi.
- Le card non mostrano più la targhetta "No.xx" (resta solo nella pagina strada).
- Posizionamento: **piacere di guida e scoperta, mai velocità** (niente cronometri o classifiche di tempi).

## Pubblicazione
- **Online (V2)**: https://peggy313.github.io/Touge_App/ — repo pubblico `Peggy313/Touge_App`, Pages da `main` / root. L'utente carica i file dal sito GitHub (Add file → Upload files → Commit) nelle cartelle giuste; la root del repo contiene l'intero progetto.
- **Supabase**: progetto `lvjifupcmfbxmzjtpvry` (eu-west-1). Tabelle `profiles, driven, favorites, reviews` con RLS. I progetti nuovi richiedono anche i **GRANT** (`grants.sql`). "Confirm email" è **disattivato** (il servizio email gratuito è limitato). Mai chiedere/usare la chiave `service_role`; il *client secret* di Google va solo su Supabase.
- **Ultima versione su Claude (fissata)**: Artifact "TOUGE App V2" https://claude.ai/artifact/8wBnk5Qdfo3AvLa4E5TNTV, pubblicato da `artifact.html` + `css/`, `js/` (senza config.js), `data/`. Lì i servizi esterni sono bloccati, quindi gira in modalità locale. Dopo ogni modifica ripubblicarlo (stesso file → stesso link).
- **V1 demo** (congelata, non più fissata): https://claude.ai/artifact/VYZd3sCTigt1S4JJv3AgQB.
- Verifica locale: se la porta 5173 è occupata da un'altra chat, usare la preview "touge-5174".
- Prima di dare i file da caricare: `tools\build-site.ps1`; verificare in locale con la preview "touge".

## In sospeso / idee
- **Login con Google**: codice pronto (`Auth.signInWithGoogle`, bottone in registrazione/accesso). Serve configurare Google Cloud (client OAuth web, redirect `https://lvjifupcmfbxmzjtpvry.supabase.co/auth/v1/callback`) + provider Google su Supabase, poi `googleLogin: true` in `config.js`. Apple richiede l'Apple Developer Program; Instagram non è possibile.
- Supabase → Authentication → URL Configuration: Site URL e Redirect URL `https://peggy313.github.io/Touge_App/**` (verificare che siano impostati).
- Roadmap: notifiche di riapertura passi, accessibilità (testi mono piccoli, contrasti), modalità Run con GPS e verifica della strada guidata, condizioni live/meteo, itinerari che concatenano passi, community (foto, segnalazioni, raduni), livelli della licenza pilota.
- Valutare GitHub Desktop al posto del caricamento manuale.
