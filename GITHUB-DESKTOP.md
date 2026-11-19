# Pubblicare TOUGE con GitHub Desktop

Una volta impostato, non serve più caricare i file a mano: ogni modifica si pubblica con due clic
e GitHub tiene lo storico di tutte le versioni (si può tornare indietro).

## Impostazione (una volta sola)

1. Scarica **GitHub Desktop** da https://desktop.github.com e installalo.
2. Aprilo e accedi con il tuo account GitHub (**Peggy313**).
3. Menu **File → Clone repository…** → scheda **GitHub.com** → scegli **Peggy313/Touge_App**.
   Lascia il percorso proposto (di solito `C:\Users\pirat\Documents\GitHub\Touge_App`) → **Clone**.
4. Chiudi GitHub Desktop e dì a Claude **"clonato"**: sposta lui il collegamento con GitHub
   nella cartella `Desktop\Progetti Claude\Touge App`.
5. Riapri GitHub Desktop → **File → Add local repository…** → scegli la cartella
   `Desktop\Progetti Claude\Touge App` → **Add repository**.
   La copia in `Documents\GitHub\Touge_App` si può poi cancellare.

## Ogni volta che vuoi pubblicare

1. Apri GitHub Desktop: a sinistra vedi i file cambiati.
2. In basso a sinistra scrivi un titolo breve (es. "Modalità ospite e privacy").
3. **Commit to main** → poi in alto **Push origin**.
4. Dopo 1–2 minuti il sito https://peggy313.github.io/Touge_App/ è aggiornato.

## Tornare indietro

**History** (in alto a sinistra) → tasto destro sulla modifica da annullare → **Revert changes in commit** → **Push origin**.
