# Attivare le notifiche push di TOUGE

La campanella con gli avvisi dentro l'app funziona già, senza configurare nulla.
Questa guida serve per le **notifiche sul telefono anche ad app chiusa**. Ci vogliono circa 15 minuti, tutti nella dashboard di Supabase.

Prima di iniziare:
- le query `v3.sql`, `v4.sql`, `v5.sql` devono essere già eseguite;
- i file dell'app devono essere caricati su GitHub.

> Se nella dashboard un nome è leggermente diverso da quello scritto qui, cerca la voce più simile. Supabase rinomina spesso i menu.

---

## 1 · Genera le chiavi (sul tuo PC)
1. Apri la cartella del progetto → `tools` → doppio clic su **`chiavi-notifiche.html`**. Si apre nel browser.
2. Tocca **Genera le chiavi**. Compaiono 4 valori: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `VAPID_SUBJECT`.
3. **Non chiudere la pagina** finché non hai finito i punti 3, 4 e 6: le chiavi non vengono salvate da nessuna parte.
   - Quelle in rosso sono **segrete**: non mandarle a nessuno.

## 2 · Crea le tabelle
Supabase → **SQL Editor** → **New query** → incolla tutto `supabase/v6.sql` → **Run**.

## 3 · Salva le chiavi segrete su Supabase
1. Supabase → **Edge Functions** (menu a sinistra) → **Secrets**.
2. Aggiungi questi 4 segreti, uno per riga: a sinistra il nome, a destra il valore copiato dalla pagina del punto 1.
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `CRON_SECRET`
3. **Save**.

`SUPABASE_URL` e la chiave di servizio **non** vanno aggiunte: Supabase le dà alla funzione da sé.

## 4 · Crea il servizio "touge-notify"
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Come nome scrivi esattamente: `touge-notify`.
3. Nell'editor cancella il codice di esempio e incolla tutto il file `supabase/functions/touge-notify/index.ts`.
4. **Deploy function**.
5. Apri la funzione → scheda **Details** (o **Settings**) → spegni **Enforce JWT verification** (o **Verify JWT**) → **Save**.
   - Al suo posto la protezione è il `CRON_SECRET`.

## 5 · Fai partire il servizio ogni giorno
1. Supabase → **Integrations** → **Cron**. Se è la prima volta: **Enable pg_cron**.
2. **Jobs** → **Create job**:
   - **Name**: `touge-notify`
   - **Schedule**: `0 17 * * *` (ogni giorno alle 17:00 UTC, cioè le 18 d'inverno e le 19 d'estate in Italia; il giovedì partono anche gli avvisi del weekend)
   - **Type**: **Supabase Edge Function**
   - **Method**: `POST`
   - **Edge Function**: `touge-notify`
   - **HTTP Headers** → aggiungi: nome `x-touge-cron`, valore = il tuo `CRON_SECRET`
   - **Body**: `{}`
3. **Create cron job**.

## 6 · Metti la chiave pubblica nell'app
Scrivi a Claude: *"ecco la chiave pubblica: …"* incollando **solo** `VAPID_PUBLIC_KEY`.

Claude la mette in `js/config.js` e ti dice cosa ricaricare su GitHub.

(La chiave pubblica non è segreta: può stare nel codice.)

## 7 · Prova
1. Su iPhone apri l'app **in Safari** → **Condividi** → **Aggiungi alla schermata Home**.
2. Apri TOUGE **dall'icona sulla Home**, entra col tuo account.
3. **Pilota → Notifiche** → accendi **Notifiche sul telefono** → **Consenti**.
4. Supabase → **Edge Functions** → `touge-notify` → **Test** (o **Invoke**):
   - Method `POST`
   - Header `x-touge-cron` = il tuo `CRON_SECRET`
   - Body `{"test": true}`
   - → **Send**.
5. Sul telefono deve arrivare **"TOUGE · notifiche attive"**.

## Se qualcosa non va
- **401 unauthorized**: l'header `x-touge-cron` non è uguale al segreto `CRON_SECRET`.
- **"nessun pilota con le push accese"**: sul telefono non hai acceso le notifiche, oppure manca la chiave pubblica nell'app (punto 6).
- **Su iPhone l'interruttore non compare**: l'app è aperta in Safari e non dall'icona sulla Home. Serve iOS 16.4 o più recente.
