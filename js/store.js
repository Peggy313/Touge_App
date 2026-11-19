/* TOUGE App — dati e autenticazione.
 * Due modalità con la stessa interfaccia (Auth / Store):
 *  - CLOUD  (V2): Supabase. Account veri, collezione sincronizzata, recensioni condivise.
 *  - LOCALE (V1): tutto in localStorage sul dispositivo. Usata se js/config.js è vuoto
 *                 (es. la versione pubblicata come Artifact claude.ai, che blocca i servizi esterni).
 * In modalità cloud i dati dell'utente stanno in una cache in memoria: le letture sono immediate,
 * le modifiche aggiornano subito la cache e vengono inviate a Supabase in background.
 */
(function () {
  const K = {
    users: 'touge.users',
    session: 'touge.session',
    lang: 'touge.lang',
    onboarded: 'touge.onboarded',
    reviews: 'touge.reviews',
    routes: 'touge.routes',
    data: (uid) => 'touge.data.' + uid,
  };

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage pieno o bloccato */ }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256));
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function hash(password, salt) {
    const input = salt + ':' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (let r = 0; r < 1000; r++) for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'fnv' + h.toString(16);
  }
  const norm = (email) => String(email || '').trim().toLowerCase();
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const today = () => new Date().toISOString().slice(0, 10);

  // Stato di una strada: segnalazioni dei piloti (ultimi 14 giorni) + conferma ufficiale.
  // Vale la maggioranza dei 3 giorni attorno alla segnalazione più recente; a parità, l'ultima.
  // La conferma ufficiale vince se è più recente delle segnalazioni.
  const DAY = 864e5;
  function computeStatus(list, off) {
    const now = Date.now();
    const recent = (list || []).filter((r) => now - Date.parse(r.at) < 14 * DAY).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    let pilots = null;
    if (recent.length) {
      const newest = Date.parse(recent[0].at);
      const win = recent.filter((r) => newest - Date.parse(r.at) < 3 * DAY);
      const open = win.filter((r) => r.status === 'open').length, closed = win.length - open;
      const status = open === closed ? recent[0].status : open > closed ? 'open' : 'closed';
      pilots = { by: 'pilots', status, at: recent[0].at, count: status === 'open' ? open : closed };
    }
    if (off && (!pilots || Date.parse(off.at) >= Date.parse(pilots.at))) {
      return { by: 'official', status: off.status, at: off.at, note: off.note || '', source: off.source || '' };
    }
    return pilots;
  }
  // la mia segnalazione di oggi per ogni strada (per mostrare "hai segnalato…")
  function myRoadReports(who) { const all = read('touge.myroad', {}); const mine = all[who] || {}; return { all, mine }; }
  function rememberRoadReport(who, roadId, status) {
    const { all, mine } = myRoadReports(who);
    mine[roadId] = { status, day: today() }; all[who] = mine; write('touge.myroad', all);
  }
  function myRoadReport(who, roadId) {
    const x = myRoadReports(who).mine[roadId];
    return x && x.day === today() ? x.status : null;
  }

  // preferenze notifiche (valori di partenza)
  const NOTIFY_DEFAULT = { push: false, reopen: true, wxFav: true, wxNear: true, news: true, nearMin: 120 };
  window.TOUGE_NOTIFY_DEFAULT = NOTIFY_DEFAULT;

  // Impostazioni comuni a entrambe le modalità
  const Common = {
    lang() { return read(K.lang, 'it'); },
    setLang(l) { write(K.lang, l); },
    onboarded() { return read(K.onboarded, false); },
    setOnboarded() { write(K.onboarded, true); },
    // su questo dispositivo c'è già stato un account? (decide registrazione vs accesso)
    hadAccount() { return read('touge.hadAccount', false); },
    setHadAccount() { if (!read('touge.hadAccount', false)) write('touge.hadAccount', true); },
    cachedRoute(id) { return read(K.routes, {})[id] || null; },
    cacheRoute(id, coords) { const all = read(K.routes, {}); all[id] = coords; write(K.routes, all); },
  };

  // ═════════════════════════ MODALITÀ LOCALE ═════════════════════════
  // Le foto restano nel telefono (localStorage, chiave touge.img.<id>): riferimento "local:<id>".
  const IMG = 'touge.img.';
  function saveImg(dataUrl) {
    const id = randomHex(8);
    try { localStorage.setItem(IMG + id, dataUrl); } catch (e) { throw new Error('errStorage'); }
    return 'local:' + id;
  }
  const dropImg = (ref) => { if (ref && String(ref).startsWith('local:')) remove(IMG + ref.slice(6)); };
  const localUrl = (ref) => (!ref ? '' : String(ref).startsWith('local:') ? (localStorage.getItem(IMG + ref.slice(6)) || '') : ref);

  function buildLocal() {
    const Auth = {
      cloud: false,
      google: false,
      init: async () => {},
      current() {
        const s = read(K.session, null);
        if (!s) return null;
        const u = read(K.users, {})[s.email];
        return u ? { email: s.email, name: u.name, car: u.car, createdAt: u.createdAt, avatar: u.avatar, photo: u.photo || '', carPhoto: u.carPhoto || '' } : null;
      },
      async register({ name, email, password, car }) {
        email = norm(email);
        const users = read(K.users, {});
        if (users[email]) throw new Error('errExists');
        const salt = randomHex(16);
        users[email] = { name: name.trim(), car: (car || '').trim(), salt, hash: await hash(password, salt), createdAt: new Date().toISOString(), avatar: Math.floor(Math.random() * 6) };
        write(K.users, users);
        write(K.session, { email, at: Date.now() });
        return this.current();
      },
      async login(email, password) {
        email = norm(email);
        const u = read(K.users, {})[email];
        if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error('errLogin');
        write(K.session, { email, at: Date.now() });
        return this.current();
      },
      async resetPassword(email, password) {
        email = norm(email);
        const users = read(K.users, {});
        if (!users[email]) throw new Error('errNotFound');
        users[email].salt = randomHex(16);
        users[email].hash = await hash(password, users[email].salt);
        write(K.users, users);
      },
      async update(fields) {
        const s = read(K.session, null);
        if (!s) return;
        const users = read(K.users, {});
        Object.assign(users[s.email], fields);
        write(K.users, users);
      },
      async logout() { remove(K.session); },
      async deleteAccount() {
        const s = read(K.session, null);
        if (!s) return;
        const users = read(K.users, {});
        if (users[s.email]) { dropImg(users[s.email].photo); dropImg(users[s.email].carPhoto); (users[s.email].cars || []).forEach((c) => dropImg(c.photo)); }
        delete users[s.email];
        write(K.users, users);
        remove(K.data(s.email));
        const photos = read('touge.photos', {});
        Object.keys(photos).forEach((rid) => (photos[rid] = photos[rid].filter((p) => (p.email === s.email ? (dropImg(p.img), false) : true))));
        write('touge.photos', photos);
        write('touge.trips', read('touge.trips', []).filter((x) => x.email !== s.email));
        const reviews = read(K.reviews, {});
        Object.keys(reviews).forEach((rid) => (reviews[rid] = reviews[rid].filter((r) => r.email !== s.email)));
        write(K.reviews, reviews);
        remove(K.session);
      },
    };

    function userData() {
      const s = read(K.session, null);
      if (!s) return { favorites: [], driven: {} };
      return Object.assign({ favorites: [], driven: {} }, read(K.data(s.email), {}));
    }
    function saveUserData(d) {
      const s = read(K.session, null);
      if (s) write(K.data(s.email), d);
    }

    const Store = Object.assign({}, Common, {
      introSeen() { return !!userData().introSeen; },
      setIntroSeen() { const d = userData(); d.introSeen = true; saveUserData(d); },
      favorites() { return userData().favorites; },
      isFav(id) { return userData().favorites.includes(id); },
      toggleFav(id) {
        const d = userData();
        d.favorites = d.favorites.includes(id) ? d.favorites.filter((x) => x !== id) : [id, ...d.favorites];
        saveUserData(d);
        return d.favorites.includes(id);
      },
      driven() { return userData().driven; },
      isDriven(id) { return !!userData().driven[id]; },
      toggleDriven(id) {
        const d = userData();
        if (d.driven[id]) delete d.driven[id]; else d.driven[id] = new Date().toISOString();
        saveUserData(d);
        return !!d.driven[id];
      },
      reviews(roadId) {
        const me = Auth.current();
        const hidden = read('touge.reported', []);
        const users = read(K.users, {});
        const local = (read(K.reviews, {})[roadId] || []).map((r) => Object.assign({ mine: !!me && r.email === me.email, photo: localUrl((users[r.email] || {}).photo) }, r));
        const seed = (window.SEED_REVIEWS[roadId] || []).map((r, i) => Object.assign({ seed: true, id: 'seed-' + roadId + '-' + i }, r));
        return [...local, ...seed].filter((r) => !hidden.includes(r.id)).sort((a, b) => (b.date > a.date ? 1 : -1));
      },
      async reportReview(roadId, reviewId) {
        const hidden = read('touge.reported', []);
        if (!hidden.includes(reviewId)) { hidden.push(reviewId); write('touge.reported', hidden); }
      },
      roadStatus(roadId) {
        const all = read('touge.roadreports', {});
        return computeStatus(all[roadId] || [], null);
      },
      myRoadReport(roadId) { const me = Auth.current(); return me ? myRoadReport(me.email, roadId) : null; },
      async reportRoad(roadId, status) {
        const me = Auth.current();
        if (!me) throw new Error('auth');
        const all = read('touge.roadreports', {});
        const list = (all[roadId] || []).filter((r) => !(r.email === me.email && r.at.slice(0, 10) === today()));
        list.unshift({ status, at: new Date().toISOString(), email: me.email });
        all[roadId] = list.slice(0, 50); write('touge.roadreports', all);
        rememberRoadReport(me.email, roadId, status);
      },
      loadReviews: async (roadId) => Store.reviews(roadId),
      addReview(roadId, { rating, text, carId }) {
        const me = Auth.current();
        const all = read(K.reviews, {});
        const car = (this.cars().find((c) => c.id === carId) || {}).model || me.car;
        all[roadId] = all[roadId] || [];
        all[roadId].unshift({ id: randomHex(6), email: me.email, user: me.name, car, rating, text: text.trim(), date: new Date().toISOString().slice(0, 10) });
        write(K.reviews, all);
      },
      deleteReview(roadId, reviewId) {
        const all = read(K.reviews, {});
        all[roadId] = (all[roadId] || []).filter((r) => r.id !== reviewId);
        write(K.reviews, all);
      },
      myReviewCount(email) {
        const all = read(K.reviews, {});
        return Object.values(all).reduce((n, arr) => n + arr.filter((r) => r.email === email).length, 0);
      },
      rating(roadId) {
        const rs = this.reviews(roadId);
        if (!rs.length) return null;
        return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
      },

      // ── foto ──
      photoUrl: localUrl,
      async setProfilePhoto(kind, blob) {
        const me = Auth.current();
        if (!me) throw new Error('auth');
        const ref = blob ? saveImg(await window.TougePhoto.toDataURL(blob)) : '';
        dropImg(me[kind]);
        await Auth.update({ [kind]: ref });
      },

      // ── garage: fino a 5 auto, la prima è la principale (= car / carPhoto del profilo) ──
      _carsRaw() {
        const s = read(K.session, null), u = s && read(K.users, {})[s.email];
        if (!u) return [];
        return u.cars || (u.car ? [{ id: 'c0', model: u.car, note: '', photo: u.carPhoto || '' }] : []);
      },
      _saveCars(list) {
        const s = read(K.session, null), users = read(K.users, {}), u = s && users[s.email];
        if (!u) return;
        u.cars = list; u.car = list[0] ? list[0].model : ''; u.carPhoto = list[0] ? list[0].photo : '';
        write(K.users, users);
      },
      cars() { return this._carsRaw().map((c, i) => Object.assign({}, c, { main: i === 0 })); },
      // photo: undefined = lascia, null = togli, Blob = sostituisci
      async saveCar(car, photo) {
        const list = this._carsRaw();
        let c = car.id ? list.find((x) => x.id === car.id) : null;
        if (!c) { if (list.length >= 5) throw new Error('errTooManyCars'); c = { id: 'c' + randomHex(4), model: '', note: '', photo: '' }; list.push(c); }
        c.model = String(car.model || '').trim().slice(0, 60); c.note = String(car.note || '').trim().slice(0, 80);
        if (photo !== undefined) { const ref = photo ? saveImg(await window.TougePhoto.toDataURL(photo)) : ''; dropImg(c.photo); c.photo = ref; }
        this._saveCars(list);
        return c.id;
      },
      async deleteCar(id) {
        const list = this._carsRaw(), c = list.find((x) => x.id === id);
        if (c) dropImg(c.photo);
        this._saveCars(list.filter((x) => x.id !== id));
      },
      async setMainCar(id) {
        const list = this._carsRaw(), i = list.findIndex((x) => x.id === id);
        if (i > 0) { list.unshift(list.splice(i, 1)[0]); this._saveCars(list); }
      },
      roadPhotos(roadId) {
        const me = Auth.current(), users = read(K.users, {}), hidden = read('touge.reportedPhotos', []);
        return (read('touge.photos', {})[roadId] || []).filter((p) => !hidden.includes(p.id)).map((p) => {
          const u = users[p.email] || {};
          return { id: p.id, url: localUrl(p.img), user: u.name || 'Pilota', car: p.car || u.car || '', userPhoto: localUrl(u.photo), avatar: u.avatar || 0,
            verified: !!p.verified, date: p.date, mine: !!me && p.email === me.email };
        });
      },
      loadRoadPhotos: async (roadId) => Store.roadPhotos(roadId),
      myPhoto(roadId) {
        const me = Auth.current();
        return me ? (read('touge.photos', {})[roadId] || []).find((p) => p.email === me.email) || null : null;
      },
      isVerified(roadId) { const p = this.myPhoto(roadId); return !!(p && p.verified); },
      async addRoadPhoto(roadId, blob, verifiedBy, carId) {
        const me = Auth.current();
        if (!me) throw new Error('auth');
        if (!this.isDriven(roadId)) throw new Error('errPhotoDriven');
        const img = saveImg(await window.TougePhoto.toDataURL(blob));
        const car = (this.cars().find((c) => c.id === carId) || {}).model || '';
        await this.deleteRoadPhoto(roadId);
        const all = read('touge.photos', {});
        all[roadId] = [{ id: randomHex(6), email: me.email, img, car, verified: !!verifiedBy, by: verifiedBy || '', date: today() }, ...(all[roadId] || [])];
        write('touge.photos', all);
      },
      async deleteRoadPhoto(roadId) {
        const me = Auth.current();
        if (!me) return;
        const all = read('touge.photos', {});
        all[roadId] = (all[roadId] || []).filter((p) => (p.email === me.email ? (dropImg(p.img), false) : true));
        write('touge.photos', all);
      },
      async reportPhoto(roadId, photoId) {
        const hidden = read('touge.reportedPhotos', []);
        if (!hidden.includes(photoId)) { hidden.push(photoId); write('touge.reportedPhotos', hidden); }
      },

      // ── itinerari (sul dispositivo: quelli pubblici li vedono gli altri account dello stesso telefono) ──
      _trip(x) {
        const me = Auth.current(), u = read(K.users, {})[x.email] || {};
        return { id: x.id, title: x.title, stops: x.stops, hours: x.hours || 5, manual: !!x.manual, public: !!x.public,
          mine: !!me && x.email === me.email, user: u.name || 'Pilota', car: u.car || '', date: x.date };
      },
      myTrips() { const me = Auth.current(); return me ? read('touge.trips', []).filter((x) => x.email === me.email).map((x) => this._trip(x)) : []; },
      publicTrips() {
        const me = Auth.current(), hidden = read('touge.reportedTrips', []);
        return read('touge.trips', []).filter((x) => x.public && !hidden.includes(x.id) && (!me || x.email !== me.email)).map((x) => this._trip(x));
      },
      loadPublicTrips: async () => Store.publicTrips(),
      async getTrip(id) {
        const me = Auth.current(), x = read('touge.trips', []).find((y) => y.id === id);
        return x && (x.public || (me && x.email === me.email)) ? this._trip(x) : null;
      },
      async saveTrip(tr) {
        const me = Auth.current();
        if (!me) throw new Error('auth');
        const all = read('touge.trips', []);
        const row = { title: tr.title, stops: tr.stops.map((s) => ({ r: s.r })), hours: tr.hours || 5, manual: !!tr.manual, public: !!tr.public, date: today() };
        const i = tr.id ? all.findIndex((x) => x.id === tr.id && x.email === me.email) : -1;
        if (i >= 0) Object.assign(all[i], row); else all.unshift(Object.assign({ id: randomHex(6), email: me.email }, row));
        write('touge.trips', all);
        return i >= 0 ? tr.id : all[0].id;
      },
      async deleteTrip(id) { const me = Auth.current(); write('touge.trips', read('touge.trips', []).filter((x) => !(x.id === id && me && x.email === me.email))); },
      async reportTrip(id) { const h = read('touge.reportedTrips', []); if (!h.includes(id)) { h.push(id); write('touge.reportedTrips', h); } },

      // ── notifiche (qui solo avvisi in app: niente push senza Supabase) ──
      notifyPrefs() { const me = Auth.current(); return Object.assign({}, NOTIFY_DEFAULT, me ? read('touge.notify', {})[me.email] : null); },
      async setNotifyPrefs(p) {
        const me = Auth.current(); if (!me) return;
        const all = read('touge.notify', {}); all[me.email] = Object.assign({}, this.notifyPrefs(), p, { push: false }); write('touge.notify', all);
      },
      // nuove foto e recensioni di altri piloti su queste strade dopo "since"
      async newsSince(roadIds, since) {
        const me = Auth.current(), set = new Set(roadIds), out = [];
        Object.entries(read('touge.photos', {})).forEach(([rid, list]) => set.has(rid) && list.forEach((p) => { if ((!me || p.email !== me.email) && p.date >= since.slice(0, 10)) out.push({ kind: 'photo', road: rid, at: p.date }); }));
        Object.entries(read(K.reviews, {})).forEach(([rid, list]) => set.has(rid) && list.forEach((r) => { if ((!me || r.email !== me.email) && r.date >= since.slice(0, 10)) out.push({ kind: 'review', road: rid, at: r.date }); }));
        return out;
      },
      async savePushSub() { throw new Error('unsupported'); },
      async removePushSub() {},
    });
    return { Auth, Store };
  }

  // ═════════════════════════ MODALITÀ CLOUD (Supabase) ═════════════════════════
  function buildCloud(cfg) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const siteUrl = location.origin + location.pathname;
    const empty = () => ({ user: null, profile: null, favorites: [], driven: {}, myReviews: 0, photos: {}, trips: [], notify: null, cars: null });
    let publicTripsList = [];
    let reportedTrips = new Set();
    function mapTrip(x) {
      return { id: x.id, title: x.title, stops: Array.isArray(x.stops) ? x.stops : [], hours: x.hours || 5, manual: !!x.manual, public: !!x.public,
        hidden: !!x.hidden, mine: !!C.user && x.user_id === C.user.id, user: x.author_name || 'Pilota', car: x.author_car || '', date: (x.updated_at || '').slice(0, 10) };
    }
    let C = empty();
    const photosByRoad = {};      // road_id → [foto]
    let reportedPhotos = new Set(); // foto che ho segnalato
    const bucket = () => sb.storage.from('photos');
    const photoUrl = (ref) => (!ref ? '' : /^(https?:|data:)/.test(ref) ? ref : bucket().getPublicUrl(ref).data.publicUrl);
    function mapPhoto(p) {
      return { id: p.id, url: photoUrl(p.path), user: p.author_name || 'Pilota', car: p.author_car || '', userPhoto: photoUrl(p.author_photo), avatar: 0,
        verified: !!p.verified, date: (p.created_at || '').slice(0, 10), mine: !!C.user && p.user_id === C.user.id, path: p.path };
    }
    async function upload(path, blob) {
      const { error } = await bucket().upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (error) { fail('upload')(error); throw new Error('errPhotoUpload'); }
    }
    const dropFile = (path) => { if (path) bucket().remove([path]).catch(() => {}); };
    const reviewsByRoad = {};   // road_id → [recensioni]
    const ratings = {};         // road_id → { sum, count }
    const roadReports = {};     // road_id → [{ status, at }] ultimi 14 giorni
    const official = {};        // road_id → { status, note, source, at } (tabella road_status)
    let reported = new Set();   // recensioni che ho segnalato (nascoste per me)

    async function loadStatuses() {
      const since = new Date(Date.now() - 14 * DAY).toISOString();
      const [a, b] = await Promise.all([
        sb.from('road_reports').select('road_id, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
        sb.from('road_status').select('road_id, status, note, source, updated_at'),
      ]);
      if (!a.error) {
        Object.keys(roadReports).forEach((k) => delete roadReports[k]);
        a.data.forEach((r) => (roadReports[r.road_id] = roadReports[r.road_id] || []).push({ status: r.status, at: r.created_at }));
      }
      if (!b.error) b.data.forEach((r) => (official[r.road_id] = { status: r.status, note: r.note, source: r.source, at: r.updated_at }));
    }

    const fail = (where) => (err) => { console.warn('[TOUGE sync]', where, err); emit('touge:sync-error', where); };
    const run = (where, p) => p.then((res) => { if (res && res.error) fail(where)(res.error); return res; }, fail(where));

    // Traduce gli errori di Supabase Auth in messaggi dell'app; se sconosciuti mostra il testo originale.
    function authError(error) {
      const code = error.code || '', msg = error.message || '', st = error.status || 0;
      console.warn('[TOUGE auth]', st, code, msg);
      if (code === 'user_already_exists' || code === 'email_exists' || /already registered|exists/i.test(msg)) return 'errExists';
      if (code === 'invalid_credentials') return 'errLogin';
      if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'errConfirm';
      if (code === 'weak_password' || /password/i.test(msg) && st === 422) return 'errPwd';
      if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'errEmail';
      if (code === 'email_address_not_authorized' || /not authorized/i.test(msg)) return 'errEmailNotAuth';
      if (/rate limit/i.test(msg) || code.startsWith('over_') || st === 429) return 'errRateLimit';
      if (/sending.*email|confirmation email|smtp/i.test(msg)) return 'errEmailSend';
      if (!st || error.name === 'AuthRetryableFetchError') return 'errNetwork';
      return 'raw:' + msg;
    }

    function mapReview(r) {
      return {
        id: r.id, user: r.author_name || 'Pilota', car: r.author_car || '', rating: r.rating, text: r.text,
        date: (r.created_at || '').slice(0, 10), mine: !!C.user && r.user_id === C.user.id, photo: photoUrl(r.author_photo),
      };
    }

    async function loadRatings() {
      const { data, error } = await sb.from('reviews').select('road_id, rating').limit(5000);
      if (error) return;
      Object.keys(ratings).forEach((k) => delete ratings[k]);
      data.forEach((r) => { const x = (ratings[r.road_id] = ratings[r.road_id] || { sum: 0, count: 0 }); x.sum += r.rating; x.count += 1; });
    }

    // Carica profilo + collezione dell'utente. Al primo accesso cloud importa i dati della V1 locale (stessa email).
    async function loadUser(user) {
      C = empty();
      C.user = user;
      const [p, d, f, m] = await Promise.all([
        sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        sb.from('driven').select('road_id, driven_at').eq('user_id', user.id),
        sb.from('favorites').select('road_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        sb.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      const meta = user.user_metadata || {};
      C.profile = p.data || { id: user.id, name: meta.name || 'Pilota', car: meta.car || '', avatar: meta.avatar || 0, intro_seen: false, created_at: user.created_at };
      (d.data || []).forEach((r) => (C.driven[r.road_id] = r.driven_at));
      C.favorites = (f.data || []).map((r) => r.road_id);
      C.myReviews = m.count || 0;
      sb.from('review_reports').select('review_id').eq('user_id', user.id)
        .then((res) => { if (res && !res.error) reported = new Set(res.data.map((x) => x.review_id)); }, () => {});
      // le mie foto delle strade (per la placca VERIFICATO) e le foto che ho segnalato
      await Promise.all([
        sb.from('road_photos').select('id, road_id, path, verified').eq('user_id', user.id)
          .then((res) => { if (res && !res.error) res.data.forEach((p) => (C.photos[p.road_id] = p)); }, () => {}),
        sb.from('photo_reports').select('photo_id').eq('user_id', user.id)
          .then((res) => { if (res && !res.error) reportedPhotos = new Set(res.data.map((x) => x.photo_id)); }, () => {}),
        sb.from('trips').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
          .then((res) => { if (res && !res.error) C.trips = res.data.map(mapTrip); }, () => {}),
        sb.from('trip_reports').select('trip_id').eq('user_id', user.id)
          .then((res) => { if (res && !res.error) reportedTrips = new Set(res.data.map((x) => x.trip_id)); }, () => {}),
        sb.from('notify_prefs').select('*').eq('user_id', user.id).maybeSingle()
          .then((res) => { if (res && !res.error && res.data) C.notify = res.data; }, () => {}),
        // garage (null = tabella cars non ancora creata: si usa l'auto del profilo)
        sb.from('cars').select('*').eq('user_id', user.id).order('position').order('created_at')
          .then((res) => { C.cars = res && !res.error ? res.data : null; }, () => { C.cars = null; }),
      ]);
      // chi aveva già un'auto nel profilo la ritrova nel garage
      if (C.cars && !C.cars.length && C.profile.car) {
        const res = await sb.from('cars').insert({ user_id: user.id, model: C.profile.car.slice(0, 60), photo: C.profile.car_photo || '', position: 0 }).select().single();
        if (!res.error) C.cars = [res.data];
      }

      const legacy = read(K.data(norm(user.email)), null);
      if (legacy && !legacy.migrated && (Object.keys(legacy.driven || {}).length || (legacy.favorites || []).length)) {
        const dr = Object.entries(legacy.driven || {}).filter(([id]) => !C.driven[id]).map(([road_id, driven_at]) => ({ user_id: user.id, road_id, driven_at }));
        const fv = (legacy.favorites || []).filter((id) => !C.favorites.includes(id)).map((road_id) => ({ user_id: user.id, road_id }));
        dr.forEach((r) => (C.driven[r.road_id] = r.driven_at));
        fv.forEach((r) => C.favorites.push(r.road_id));
        if (dr.length) run('import-driven', sb.from('driven').upsert(dr));
        if (fv.length) run('import-favorites', sb.from('favorites').upsert(fv));
        legacy.migrated = true; write(K.data(norm(user.email)), legacy);
      }
    }

    const Auth = {
      cloud: true,
      google: !!cfg.googleLogin, // si accende in js/config.js dopo aver configurato Google su Supabase
      async signInWithGoogle() {
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } });
        if (error) throw new Error(authError(error));
      },
      async init() {
        sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') emit('touge:recovery'); });
        const { data } = await sb.auth.getSession();
        await Promise.all([data.session ? loadUser(data.session.user) : null, loadRatings(), loadStatuses().catch(() => {})]);
      },
      current() {
        if (!C.user || !C.profile) return null;
        return { id: C.user.id, email: C.user.email, name: C.profile.name, car: C.profile.car, avatar: C.profile.avatar, createdAt: C.profile.created_at || C.user.created_at,
          photo: C.profile.photo || '', carPhoto: C.profile.car_photo || '' };
      },
      async register({ name, email, password, car }) {
        const avatar = Math.floor(Math.random() * 6);
        const { data, error } = await sb.auth.signUp({
          email: norm(email), password,
          options: { data: { name: name.trim(), car: (car || '').trim(), avatar }, emailRedirectTo: siteUrl },
        });
        if (error) throw new Error(authError(error));
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('errExists');
        if (!data.session) throw new Error('checkEmail'); // conferma email attiva su Supabase
        await loadUser(data.user);
        return this.current();
      },
      async login(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email: norm(email), password });
        if (error) throw new Error(authError(error));
        await loadUser(data.user);
        return this.current();
      },
      // In cloud il reset avviene via email: qui si invia il link.
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(norm(email), { redirectTo: siteUrl });
        if (error) throw new Error(authError(error));
      },
      async setNewPassword(password) {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(authError(error));
        if (data.user) await loadUser(data.user);
      },
      async update(fields) {
        if (!C.user) return;
        Object.assign(C.profile, fields);
        await run('profile', sb.from('profiles').update(fields).eq('id', C.user.id));
      },
      async logout() { C = empty(); reported = new Set(); reportedPhotos = new Set(); reportedTrips = new Set(); await sb.auth.signOut(); },
      async deleteAccount() {
        // prima i file delle foto (non si cancellano da soli con l'account)
        try {
          const uid = C.user && C.user.id;
          const { data } = uid ? await bucket().list(uid, { limit: 1000 }) : { data: null };
          if (data && data.length) await bucket().remove(data.map((f) => uid + '/' + f.name));
        } catch (e) { /* si prosegue comunque */ }
        const { error } = await sb.rpc('delete_my_account');
        if (error) { fail('delete')(error); throw new Error('errNetwork'); }
        C = empty();
        await sb.auth.signOut();
      },
    };

    const Store = Object.assign({}, Common, {
      introSeen() { return !!(C.profile && C.profile.intro_seen); },
      setIntroSeen() { if (C.profile && !C.profile.intro_seen) { C.profile.intro_seen = true; run('intro', sb.from('profiles').update({ intro_seen: true }).eq('id', C.user.id)); } },
      favorites() { return C.favorites; },
      isFav(id) { return C.favorites.includes(id); },
      toggleFav(id) {
        if (!C.user) return false;
        if (C.favorites.includes(id)) {
          C.favorites = C.favorites.filter((x) => x !== id);
          run('fav', sb.from('favorites').delete().eq('user_id', C.user.id).eq('road_id', id));
          return false;
        }
        C.favorites = [id, ...C.favorites];
        run('fav', sb.from('favorites').upsert({ user_id: C.user.id, road_id: id }));
        return true;
      },
      driven() { return C.driven; },
      isDriven(id) { return !!C.driven[id]; },
      toggleDriven(id) {
        if (!C.user) return false;
        if (C.driven[id]) {
          delete C.driven[id];
          run('driven', sb.from('driven').delete().eq('user_id', C.user.id).eq('road_id', id));
          return false;
        }
        C.driven[id] = new Date().toISOString();
        run('driven', sb.from('driven').upsert({ user_id: C.user.id, road_id: id, driven_at: C.driven[id] }));
        return true;
      },
      reviews(roadId) { return (reviewsByRoad[roadId] || []).filter((r) => !reported.has(r.id)).map((r) => Object.assign({}, r, { mine: r.mine })); },
      // segnala una recensione: sparisce subito per me, con 3 segnalazioni si nasconde per tutti
      async reportReview(roadId, reviewId) {
        if (!C.user) throw new Error('auth');
        reported.add(reviewId);
        const res = await sb.from('review_reports').insert({ review_id: reviewId, user_id: C.user.id });
        if (res.error && res.error.code !== '23505') { reported.delete(reviewId); fail('report')(res.error); throw new Error('errNetwork'); }
      },
      roadStatus(roadId) { return computeStatus(roadReports[roadId], official[roadId]); },
      myRoadReport(roadId) { return C.user ? myRoadReport(C.user.id, roadId) : null; },
      async reportRoad(roadId, status) {
        if (!C.user) throw new Error('auth');
        const { error } = await sb.rpc('report_road', { p_road: roadId, p_status: status });
        if (error) { fail('road-report')(error); throw new Error(/too_many/.test(error.message || '') ? 'errRateLimit' : 'errNetwork'); }
        // aggiorna la cache: sostituisce la mia segnalazione di oggi
        const prev = myRoadReport(C.user.id, roadId);
        const list = roadReports[roadId] || [];
        if (prev) { const i = list.findIndex((r) => r.status === prev && r.at.slice(0, 10) === today()); if (i >= 0) list.splice(i, 1); }
        list.unshift({ status, at: new Date().toISOString() });
        roadReports[roadId] = list;
        rememberRoadReport(C.user.id, roadId, status);
      },
      async loadReviews(roadId) {
        const { data, error } = await sb.from('reviews').select('*').eq('road_id', roadId).order('created_at', { ascending: false }).limit(100);
        if (!error) {
          reviewsByRoad[roadId] = data.map(mapReview);
          ratings[roadId] = data.length ? { sum: data.reduce((s, r) => s + r.rating, 0), count: data.length } : undefined;
        }
        return Store.reviews(roadId);
      },
      addReview(roadId, { rating, text, carId }) {
        if (!C.user) return;
        const car = (C.cars || []).find((c) => c.id === carId);
        const tmp = { id: 'tmp-' + randomHex(4), user: C.profile.name, car: car ? car.model : C.profile.car, photo: photoUrl(C.profile.photo), rating, text: text.trim(), date: new Date().toISOString().slice(0, 10), mine: true };
        reviewsByRoad[roadId] = [tmp, ...(reviewsByRoad[roadId] || [])];
        const x = (ratings[roadId] = ratings[roadId] || { sum: 0, count: 0 }); x.sum += rating; x.count += 1;
        C.myReviews += 1;
        const row = { road_id: roadId, user_id: C.user.id, rating, text: text.trim(), author_name: C.profile.name, author_car: tmp.car };
        if (car) row.car_id = car.id;
        run('review', sb.from('reviews').insert(row).select().single())
          .then((res) => { if (res && res.data) tmp.id = res.data.id; });
      },
      deleteReview(roadId, reviewId) {
        const r = (reviewsByRoad[roadId] || []).find((x) => x.id === reviewId);
        reviewsByRoad[roadId] = (reviewsByRoad[roadId] || []).filter((x) => x.id !== reviewId);
        if (r && ratings[roadId]) { ratings[roadId].sum -= r.rating; ratings[roadId].count -= 1; }
        C.myReviews = Math.max(0, C.myReviews - 1);
        if (!String(reviewId).startsWith('tmp-')) run('review-delete', sb.from('reviews').delete().eq('id', reviewId));
      },
      myReviewCount() { return C.myReviews; },
      rating(roadId) {
        const x = ratings[roadId];
        return x && x.count > 0 ? { avg: x.sum / x.count, count: x.count } : null;
      },

      // ── foto ──
      photoUrl,
      async setProfilePhoto(kind, blob) {
        if (!C.user) throw new Error('auth');
        const col = kind === 'photo' ? 'photo' : 'car_photo', old = C.profile[col] || '';
        let path = '';
        if (blob) { path = `${C.user.id}/${kind === 'photo' ? 'avatar' : 'car'}-${randomHex(6)}.jpg`; await upload(path, blob); }
        const { error } = await sb.from('profiles').update({ [col]: path }).eq('id', C.user.id);
        if (error) { dropFile(path); fail('profile-photo')(error); throw new Error('errPhotoUpload'); }
        C.profile[col] = path;
        dropFile(old);
      },
      // ── garage: fino a 5 auto; la prima è la principale e resta copiata nel profilo (car / car_photo) ──
      cars() {
        const list = C.cars || (C.profile && C.profile.car ? [{ id: 'profile', model: C.profile.car, note: '', photo: C.profile.car_photo || '' }] : []);
        return list.map((c, i) => ({ id: c.id, model: c.model, note: c.note || '', photo: c.photo || '', main: i === 0 }));
      },
      async _syncMain() {
        const m = (C.cars || [])[0], car = m ? m.model : '', photo = m ? m.photo : '';
        if (car === (C.profile.car || '') && photo === (C.profile.car_photo || '')) return;
        const { error } = await sb.from('profiles').update({ car, car_photo: photo }).eq('id', C.user.id);
        if (error) { fail('main-car')(error); throw new Error('errNetwork'); }
        C.profile.car = car; C.profile.car_photo = photo;
      },
      // photo: undefined = lascia, null = togli, Blob = sostituisci
      async saveCar(car, photo) {
        if (!C.user) throw new Error('auth');
        if (!C.cars) throw new Error('errGarageSetup');
        const old = car.id ? C.cars.find((c) => c.id === car.id) : null;
        if (!old && C.cars.length >= 5) throw new Error('errTooManyCars');
        const row = { model: String(car.model || '').trim().slice(0, 60), note: String(car.note || '').trim().slice(0, 80) };
        let path = null;
        if (photo) { path = `${C.user.id}/car-${randomHex(6)}.jpg`; await upload(path, photo); row.photo = path; }
        else if (photo === null) row.photo = '';
        if (!old) row.position = C.cars.length ? Math.max(...C.cars.map((c) => c.position || 0)) + 1 : 0;
        const q = old ? sb.from('cars').update(row).eq('id', old.id) : sb.from('cars').insert(Object.assign({ user_id: C.user.id }, row));
        const { data, error } = await q.select().single();
        if (error) { if (path) dropFile(path); fail('car')(error); throw new Error(/too_many/.test(error.message || '') ? 'errTooManyCars' : 'errNetwork'); }
        if (old && photo !== undefined && old.photo) dropFile(old.photo);
        C.cars = old ? C.cars.map((c) => (c.id === old.id ? data : c)) : C.cars.concat(data);
        await Store._syncMain();
        return data.id;
      },
      async deleteCar(id) {
        const old = (C.cars || []).find((c) => c.id === id);
        if (!old) return;
        const { error } = await sb.from('cars').delete().eq('id', id);
        if (error) { fail('car-delete')(error); throw new Error('errNetwork'); }
        if (old.photo) dropFile(old.photo);
        C.cars = C.cars.filter((c) => c.id !== id);
        await Store._syncMain();
      },
      async setMainCar(id) {
        const list = (C.cars || []).slice(), i = list.findIndex((c) => c.id === id);
        if (i <= 0) return;
        list.unshift(list.splice(i, 1)[0]);
        const res = await Promise.all(list.map((c, k) => sb.from('cars').update({ position: k }).eq('id', c.id)));
        if (res.some((r) => r.error)) { fail('car-order')(res.find((r) => r.error).error); throw new Error('errNetwork'); }
        C.cars = list.map((c, k) => Object.assign({}, c, { position: k }));
        await Store._syncMain();
      },

      roadPhotos(roadId) { return (photosByRoad[roadId] || []).filter((p) => !reportedPhotos.has(p.id)); },
      async loadRoadPhotos(roadId) {
        const { data, error } = await sb.from('road_photos').select('*').eq('road_id', roadId).order('created_at', { ascending: false }).limit(60);
        if (!error) photosByRoad[roadId] = data.map(mapPhoto);
        return Store.roadPhotos(roadId);
      },
      myPhoto(roadId) { return C.photos[roadId] || null; },
      isVerified(roadId) { return !!(C.photos[roadId] && C.photos[roadId].verified); },
      async addRoadPhoto(roadId, blob, verifiedBy, carId) {
        if (!C.user) throw new Error('auth');
        if (!C.driven[roadId]) throw new Error('errPhotoDriven');
        const path = `${C.user.id}/road-${roadId}-${randomHex(6)}.jpg`;
        await upload(path, blob);
        await Store.deleteRoadPhoto(roadId); // una sola foto per strada: la nuova sostituisce la vecchia
        const row = { road_id: roadId, user_id: C.user.id, path, verified: !!verifiedBy, verified_by: verifiedBy || '' };
        if ((C.cars || []).some((c) => c.id === carId)) row.car_id = carId;
        const { data, error } = await sb.from('road_photos').insert(row).select().single();
        if (error) {
          dropFile(path); fail('road-photo')(error);
          const m = error.message || '';
          throw new Error(/too_many/.test(m) ? 'errPhotoMany' : /not_driven/.test(m) ? 'errPhotoDriven' : 'errPhotoUpload');
        }
        C.photos[roadId] = { id: data.id, road_id: roadId, path, verified: data.verified };
        photosByRoad[roadId] = [mapPhoto(data), ...(photosByRoad[roadId] || []).filter((p) => !p.mine)];
      },
      async deleteRoadPhoto(roadId) {
        const mine = C.photos[roadId];
        if (!mine) return;
        const { error } = await sb.from('road_photos').delete().eq('id', mine.id);
        if (error) { fail('road-photo-delete')(error); throw new Error('errNetwork'); }
        delete C.photos[roadId];
        photosByRoad[roadId] = (photosByRoad[roadId] || []).filter((p) => p.id !== mine.id);
        dropFile(mine.path);
      },
      async reportPhoto(roadId, photoId) {
        if (!C.user) throw new Error('auth');
        reportedPhotos.add(photoId);
        const res = await sb.from('photo_reports').insert({ photo_id: photoId, user_id: C.user.id });
        if (res.error && res.error.code !== '23505') { reportedPhotos.delete(photoId); fail('photo-report')(res.error); throw new Error('errNetwork'); }
      },

      // ── itinerari ──
      myTrips() { return C.trips; },
      publicTrips() { return publicTripsList.filter((x) => !reportedTrips.has(x.id) && !x.mine); },
      async loadPublicTrips() {
        const { data, error } = await sb.from('trips').select('*').eq('public', true).eq('hidden', false).order('updated_at', { ascending: false }).limit(30);
        if (!error) publicTripsList = data.map(mapTrip);
        return Store.publicTrips();
      },
      async getTrip(id) {
        const mine = C.trips.find((x) => x.id === id);
        if (mine) return mine;
        if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
        const { data, error } = await sb.from('trips').select('*').eq('id', id).maybeSingle();
        return !error && data ? mapTrip(data) : null;
      },
      async saveTrip(tr) {
        if (!C.user) throw new Error('auth');
        const row = { title: tr.title, stops: tr.stops.map((s) => ({ r: s.r })), hours: tr.hours || 5, manual: !!tr.manual, public: !!tr.public };
        const q = tr.id ? sb.from('trips').update(row).eq('id', tr.id) : sb.from('trips').insert(Object.assign({ user_id: C.user.id }, row));
        const { data, error } = await q.select().single();
        if (error) { fail('trip')(error); throw new Error(/too_many/.test(error.message || '') ? 'errRateLimit' : 'errNetwork'); }
        const t = mapTrip(data);
        C.trips = [t, ...C.trips.filter((x) => x.id !== t.id)];
        return t.id;
      },
      async deleteTrip(id) {
        const { error } = await sb.from('trips').delete().eq('id', id);
        if (error) { fail('trip-delete')(error); throw new Error('errNetwork'); }
        C.trips = C.trips.filter((x) => x.id !== id);
      },
      async reportTrip(id) {
        if (!C.user) throw new Error('auth');
        reportedTrips.add(id);
        const res = await sb.from('trip_reports').insert({ trip_id: id, user_id: C.user.id });
        if (res.error && res.error.code !== '23505') { reportedTrips.delete(id); fail('trip-report')(res.error); throw new Error('errNetwork'); }
      },

      // ── notifiche: preferenze sul database (servono al servizio che spedisce le push) ──
      notifyPrefs() {
        const n = C.notify;
        return n ? { push: !!n.push, reopen: n.reopen, wxFav: n.wx_fav, wxNear: n.wx_near, news: n.news, nearMin: n.near_min || 120 } : Object.assign({}, NOTIFY_DEFAULT);
      },
      // near: [lat, lng] della partenza, arrotondata a ~10 km (solo per "Weekend di sole vicino a te" via push)
      async setNotifyPrefs(p, near, lang) {
        if (!C.user) return;
        const cur = Object.assign(Store.notifyPrefs(), p);
        const row = { user_id: C.user.id, push: !!cur.push, reopen: !!cur.reopen, wx_fav: !!cur.wxFav, wx_near: !!cur.wxNear, news: !!cur.news, near_min: cur.nearMin,
          near_lat: near && cur.wxNear ? Math.round(near[0] * 10) / 10 : null, near_lng: near && cur.wxNear ? Math.round(near[1] * 10) / 10 : null,
          lang: lang === 'en' ? 'en' : 'it', updated_at: new Date().toISOString() };
        C.notify = row;
        const { error } = await sb.from('notify_prefs').upsert(row);
        if (error) { fail('notify')(error); throw new Error('errNetwork'); }
      },
      async newsSince(roadIds, since) {
        if (!roadIds.length) return [];
        const me = C.user && C.user.id;
        const [a, b] = await Promise.all([
          sb.from('road_photos').select('road_id, user_id, created_at').in('road_id', roadIds).gt('created_at', since).limit(100),
          sb.from('reviews').select('road_id, user_id, created_at').in('road_id', roadIds).gt('created_at', since).limit(100),
        ]);
        const out = [];
        if (!a.error) a.data.forEach((x) => x.user_id !== me && out.push({ kind: 'photo', road: x.road_id, at: x.created_at }));
        if (!b.error) b.data.forEach((x) => x.user_id !== me && out.push({ kind: 'review', road: x.road_id, at: x.created_at }));
        return out;
      },
      async savePushSub(sub) {
        const { error } = await sb.rpc('save_push_sub', { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth });
        if (error) { fail('push-sub')(error); throw new Error('errNetwork'); }
      },
      async removePushSub(endpoint) { if (C.user) await sb.from('push_subs').delete().eq('endpoint', endpoint); },
    });
    return { Auth, Store };
  }

  const cfg = window.TOUGE_CONFIG || {};
  const useCloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  const impl = useCloud ? buildCloud(cfg) : buildLocal();
  window.Auth = impl.Auth;
  window.Store = impl.Store;
})();
