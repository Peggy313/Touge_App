# TOUGE App 峠

Web app mobile-first (installabile come PWA) con una collezione di 59 passi di montagna e strade panoramiche tra Italia, Svizzera, Francia e Austria.

## Avvio

Non serve installare nulla. Da PowerShell, nella cartella del progetto:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Poi apri http://localhost:5173 (dal telefono: stessa rete + "Aggiungi a schermata Home").

## Funzioni

- **Onboarding → Registrazione / Login / Password dimenticata**: account salvati sul dispositivo, password con hash SHA-256 e salt
- **Esplora**: strada del giorno, ricerca, filtri per paese, difficoltà, apertura invernale e pedaggio, più l'ordinamento
- **Mappa**: tutti i passi su OpenStreetMap, colorati per difficoltà, più la posizione GPS
- **Dettaglio strada**: dati (quota, km, tornanti, chiusura, pedaggio), descrizione, tracciato reale calcolato con OSRM, link a Google Maps, recensioni e strade vicine
- **Garage**: preferiti, strade guidate e percentuale della collezione
- **Profilo**: statistiche, 7 traguardi, lingua IT/EN, modifica profilo, logout ed eliminazione dell'account

## Struttura

| File | Contenuto |
|---|---|
| `js/data.js` | Collezione strade (aggiungere qui nuovi passi) + recensioni demo |
| `js/i18n.js` | Testi IT / EN |
| `js/store.js` | Auth e persistenza (localStorage): da sostituire con Supabase/Firebase per account condivisi |
| `js/art.js` | Illustrazioni SVG generate per ogni strada |
| `js/app.js` | Router e schermate |
| `css/style.css` | Tema dark racing |

I dati (lunghezze, tornanti, chiusure) sono indicativi.
