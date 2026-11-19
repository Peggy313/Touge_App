/* TOUGE App — persistenza locale (localStorage) e autenticazione su dispositivo.
 * Struttura pronta per essere sostituita da un backend (Supabase/Firebase): basta
 * reimplementare le funzioni di Auth e Store mantenendo la stessa interfaccia.
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
    // fallback (contesti non sicuri): FNV-1a ripetuto, solo per prototipo
    let h = 0x811c9dc5;
    for (let r = 0; r < 1000; r++) for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'fnv' + h.toString(16);
  }

  const norm = (email) => String(email || '').trim().toLowerCase();

  const Auth = {
    current() {
      const s = read(K.session, null);
      if (!s) return null;
      const u = read(K.users, {})[s.email];
      return u ? { email: s.email, name: u.name, car: u.car, createdAt: u.createdAt, avatar: u.avatar } : null;
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
    update(fields) {
      const s = read(K.session, null);
      if (!s) return;
      const users = read(K.users, {});
      Object.assign(users[s.email], fields);
      write(K.users, users);
    },
    logout() { remove(K.session); },
    deleteAccount() {
      const s = read(K.session, null);
      if (!s) return;
      const users = read(K.users, {});
      delete users[s.email];
      write(K.users, users);
      remove(K.data(s.email));
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

  const Store = {
    lang() { return read(K.lang, 'it'); },
    setLang(l) { write(K.lang, l); },
    onboarded() { return read(K.onboarded, false); },
    setOnboarded() { write(K.onboarded, true); },

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
      const local = (read(K.reviews, {})[roadId] || []).map((r) => Object.assign({ local: true }, r));
      const seed = (window.SEED_REVIEWS[roadId] || []).map((r) => Object.assign({ seed: true }, r));
      return [...local, ...seed].sort((a, b) => (b.date > a.date ? 1 : -1));
    },
    addReview(roadId, { rating, text }) {
      const me = Auth.current();
      const all = read(K.reviews, {});
      all[roadId] = all[roadId] || [];
      all[roadId].unshift({ id: randomHex(6), email: me.email, user: me.name, car: me.car, rating, text: text.trim(), date: new Date().toISOString().slice(0, 10) });
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

    cachedRoute(id) { return read(K.routes, {})[id] || null; },
    cacheRoute(id, coords) {
      const all = read(K.routes, {});
      all[id] = coords;
      write(K.routes, all);
    },
  };

  window.Auth = Auth;
  window.Store = Store;
})();
