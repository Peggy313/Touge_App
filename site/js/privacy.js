/* TOUGE App — informativa privacy (IT / EN), mostrata in #privacy.
 * {EMAIL} viene sostituito con contactEmail di js/config.js.
 * Testo scritto in modo semplice: non è una consulenza legale; se l'app cresce, fallo rivedere.
 */
window.PRIVACY = {
  it: `
<p class="doc-meta">Ultimo aggiornamento: 19 novembre 2026</p>

<h2>Chi siamo</h2>
<p>TOUGE è un progetto amatoriale e gratuito: <b>Progetto TOUGE</b> è il titolare del trattamento dei dati. Per qualsiasi domanda o richiesta sulla privacy scrivi a: {EMAIL}.</p>

<h2>Quali dati raccogliamo</h2>
<ul>
  <li><b>Account</b>: email e password. La password è gestita in forma cifrata dal nostro fornitore (Supabase): nessuno di noi può leggerla.</li>
  <li><b>Profilo pilota</b>: nome pilota, auto (facoltativa), colore dell'avatar e, se le aggiungi, foto profilo e foto dell'auto.</li>
  <li><b>Foto delle strade</b>: le foto che pubblichi sulle strade che hai guidato. Prima dell'invio l'app le rimpicciolisce sul telefono e <b>toglie i dati nascosti</b> (posizione GPS, modello del telefono, data): salviamo solo l'immagine e se la strada è "verificata" (sì/no), non la posizione. Per la verifica l'app confronta sul telefono la posizione della foto, o quella del telefono in quel momento, con il tracciato.</li>
  <li><b>La tua attività nell'app</b>: preferiti, strade guidate con la data, itinerari, recensioni, segnalazioni sullo stato delle strade e segnalazioni di recensioni.</li>
  <li><b>Dati tecnici sul tuo telefono</b>: la sessione (per restare collegato), la lingua e le preferenze della cartolina, salvate solo sul dispositivo.</li>
  <li><b>Posizione</b>: solo se la attivi tu (mappa, "Partiamo!", "Vicino a te"). Serve a calcolare sul telefono quanto sono lontane le strade e <b>non viene inviata</b> a noi. Per "Vicino a te" l'app ricorda sul dispositivo una posizione approssimata (circa 1 km) o la città da cui parti; puoi cambiarla quando vuoi.</li>
  <li><b>Notifiche</b>: se le accendi, salviamo quali avvisi vuoi, la lingua e l'indirizzo tecnico per recapitarle al tuo telefono (fornito dal servizio push di Apple, Google o Mozilla). Solo con le notifiche accese e "Weekend di sole vicino a te" attivo salviamo anche la tua partenza <b>arrotondata a circa 10 km</b>. Spegnendo le notifiche l'iscrizione del telefono viene cancellata.</li>
</ul>
<p>Senza account puoi usare l'app liberamente: in quel caso non raccogliamo dati personali.</p>

<h2>Perché li usiamo</h2>
<p>Solo per far funzionare TOUGE: tenere il tuo account, la tua collezione e le tue recensioni (base giuridica: esecuzione del servizio che chiedi, art. 6.1.b GDPR) e proteggere la community da spam e abusi (legittimo interesse, art. 6.1.f).</p>
<p><b>Cosa è pubblico</b>: nelle recensioni, nelle foto e negli itinerari che pubblichi gli altri piloti vedono il tuo nome pilota e la tua auto (gli itinerari restano privati finché non scegli "Pubblica"). La tua email non è mai visibile. Le segnalazioni "aperta / chiusa" sono mostrate in forma anonima.</p>
<p><b>Niente pubblicità, niente profilazione, niente vendita di dati, niente cookie di tracciamento.</b> Usiamo solo la memoria tecnica del browser necessaria al funzionamento, per questo non c'è un banner dei cookie.</p>

<h2>Dove sono i dati e chi ci aiuta</h2>
<ul>
  <li><b>Supabase</b> (database e account): server nell'Unione Europea, Irlanda.</li>
  <li><b>GitHub Pages</b> (pubblica il sito): può registrare l'indirizzo IP nei log tecnici.</li>
  <li><b>Servizi caricati dal browser</b>: Google Fonts (caratteri), unpkg e jsDelivr (librerie), OpenStreetMap (mappe), OSRM (percorsi), Open-Meteo (meteo in vetta: riceve solo le coordinate delle strade, non la tua posizione), servizi push di Apple / Google / Mozilla (solo se accendi le notifiche: recapitano il messaggio al telefono). Come per qualsiasi sito, ricevono l'indirizzo IP e le informazioni del browser necessarie a inviare i contenuti.</li>
</ul>
<p>Alcuni di questi fornitori possono trattare dati fuori dall'UE, con le garanzie previste dal GDPR (clausole contrattuali standard o EU-US Data Privacy Framework).</p>

<h2>Per quanto tempo</h2>
<p>Finché hai l'account. Con <b>Pilota → Elimina account</b> cancelli subito e definitivamente account, collezione, foto, recensioni e segnalazioni.</p>

<h2>Recensioni e segnalazioni</h2>
<p>Scrivi recensioni rispettose e utili. Ogni recensione può essere segnalata: dopo 3 segnalazioni di piloti diversi viene nascosta in attesa di controllo. Possiamo rimuovere contenuti offensivi, illegali o spam.</p>

<h2>I tuoi diritti</h2>
<p>Puoi chiedere di accedere ai tuoi dati, correggerli (anche da <b>Modifica profilo</b>), cancellarli (<b>Elimina account</b>), riceverne una copia, limitarne o opporti al trattamento, scrivendo a {EMAIL}. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>

<h2>Età minima</h2>
<p>Per creare un account devi avere almeno 14 anni.</p>

<h2>Guida responsabile</h2>
<p>I dati delle strade sono indicativi. Verifica sempre viabilità, chiusure e limiti prima di partire: le strade aperte non sono piste.</p>
`,
  en: `
<p class="doc-meta">Last updated: 19 November 2026</p>

<h2>Who we are</h2>
<p>TOUGE is a free, non-commercial project: <b>Progetto TOUGE</b> is the data controller. For any privacy question or request write to: {EMAIL}.</p>

<h2>What data we collect</h2>
<ul>
  <li><b>Account</b>: email and password. The password is stored encrypted by our provider (Supabase): nobody on our side can read it.</li>
  <li><b>Driver profile</b>: driver name, car (optional), avatar colour and, if you add them, profile photo and car photo.</li>
  <li><b>Road photos</b>: the photos you publish on roads you have driven. Before sending, the app shrinks them on your phone and <b>removes the hidden data</b> (GPS location, phone model, date): we only store the image and whether the road is "verified" (yes/no), not the location. For verification the app compares on your phone the photo's location, or the phone's location at that moment, with the route.</li>
  <li><b>Your activity</b>: favourites, driven roads with their date, road trips, reviews, road status reports and review reports.</li>
  <li><b>Technical data on your phone</b>: your session (to keep you signed in), language and postcard preferences, stored on the device only.</li>
  <li><b>Location</b>: only if you turn it on (map, "Let's go!", "Near you"). It is used on your phone to work out how far the roads are and is <b>never sent</b> to us. For "Near you" the app remembers on the device an approximate position (about 1 km) or the city you start from; you can change it any time.</li>
  <li><b>Notifications</b>: if you turn them on, we store which alerts you want, your language and the technical address used to deliver them to your phone (provided by Apple's, Google's or Mozilla's push service). Only with notifications on and "Sunny weekend near you" active do we also store your starting point <b>rounded to about 10 km</b>. Turning notifications off deletes your phone's subscription.</li>
</ul>
<p>You can use the app freely without an account: in that case we collect no personal data.</p>

<h2>Why we use it</h2>
<p>Only to run TOUGE: keeping your account, collection and reviews (legal basis: providing the service you ask for, art. 6.1.b GDPR) and protecting the community from spam and abuse (legitimate interest, art. 6.1.f).</p>
<p><b>What is public</b>: other drivers see your driver name and car on the reviews, photos and road trips you publish (road trips stay private until you choose "Publish"). Your email is never shown. Open / closed reports are shown anonymously.</p>
<p><b>No ads, no profiling, no selling of data, no tracking cookies.</b> We only use the technical browser storage needed for the app to work, which is why there is no cookie banner.</p>

<h2>Where the data lives and who helps us</h2>
<ul>
  <li><b>Supabase</b> (database and accounts): servers in the European Union, Ireland.</li>
  <li><b>GitHub Pages</b> (hosts the site): may log IP addresses in technical logs.</li>
  <li><b>Services loaded by your browser</b>: Google Fonts (typefaces), unpkg and jsDelivr (libraries), OpenStreetMap (maps), OSRM (routes), Open-Meteo (summit weather: it only receives the roads' coordinates, not your location), Apple / Google / Mozilla push services (only if you turn notifications on: they deliver the message to your phone). Like for any website, they receive your IP address and the browser information needed to deliver content.</li>
</ul>
<p>Some of these providers may process data outside the EU, with the safeguards required by the GDPR (standard contractual clauses or the EU-US Data Privacy Framework).</p>

<h2>How long</h2>
<p>As long as you keep your account. <b>Driver → Delete account</b> immediately and permanently deletes your account, collection, photos, reviews and reports.</p>

<h2>Reviews and reports</h2>
<p>Keep reviews respectful and useful. Any review can be reported: after 3 reports from different drivers it is hidden pending review. We may remove offensive, illegal or spam content.</p>

<h2>Your rights</h2>
<p>You can ask to access, correct (also via <b>Edit profile</b>), delete (<b>Delete account</b>), receive a copy of, restrict or object to the processing of your data by writing to {EMAIL}. You can also lodge a complaint with your data protection authority (in Italy: garanteprivacy.it).</p>

<h2>Minimum age</h2>
<p>You must be at least 14 to create an account.</p>

<h2>Drive responsibly</h2>
<p>Road data is indicative. Always check conditions, closures and limits before you go: public roads are not race tracks.</p>
`,
};
