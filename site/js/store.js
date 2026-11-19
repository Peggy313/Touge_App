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

  // Impostazioni comuni a entrambe le modalità
  const Common = {
    lang() { return read(K.lang, 'it'); },
    setLang(l) { write(K.lang, l); },
    onboarded() { return read(K.onboarded, false); },
    setOnboarded() { write(K.onboarded, true); },
    cachedRoute(id) { return read(K.routes, {})[id] || null; },
    cacheRoute(id, coords) { const all = read(K.routes, {}); all[id] = coords; write(K.routes, all); },
  };

  // ═════════════════════════ MODALITÀ LOCALE ═════════════════════════
  function buildLocal() {
    const Auth = {
      cloud: false,
      init: async () => {},
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
        const local = (read(K.reviews, {})[roadId] || []).map((r) => Object.assign({ mine: !!me && r.email === me.email }, r));
        const seed = (window.SEED_REVIEWS[roadId] || []).map((r) => Object.assign({ seed: true }, r));
        return [...local, ...seed].sort((a, b) => (b.date > a.date ? 1 : -1));
      },
      loadReviews: async (roadId) => Store.reviews(roadId),
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
    });
    return { Auth, Store };
  }

  // ═════════════════════════ MODALITÀ CLOUD (Supabase) ═════════════════════════
  function buildCloud(cfg) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const siteUrl = location.origin + location.pathname;
    const empty = () => ({ user: null, profile: null, favorites: [], driven: {}, myReviews: 0 });
    let C = empty();
    const reviewsByRoad = {};   // road_id → [recensioni]
    const ratings = {};         // road_id → { sum, count }

    const fail = (where) => (err) => { console.warn('[TOUGE sync]', where, err); emit('touge:sync-error', where); };
    const run = (where, p) => p.then((res) => { if (res && res.error) fail(where)(res.error); return res; }, fail(where));

    function mapReview(r) {
      return {
        id: r.id, user: r.author_name || 'Pilota', car: r.author_car || '', rating: r.rating, text: r.text,
        date: (r.created_at || '').slice(0, 10), mine: !!C.user && r.user_id === C.user.id,
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
      async init() {
        sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') emit('touge:recovery'); });
        const { data } = await sb.auth.getSession();
        await Promise.all([data.session ? loadUser(data.session.user) : null, loadRatings()]);
      },
      current() {
        if (!C.user || !C.profile) return null;
        return { id: C.user.id, email: C.user.email, name: C.profile.name, car: C.profile.car, avatar: C.profile.avatar, createdAt: C.profile.created_at || C.user.created_at };
      },
      async register({ name, email, password, car }) {
        const avatar = Math.floor(Math.random() * 6);
        const { data, error } = await sb.auth.signUp({
          email: norm(email), password,
          options: { data: { name: name.trim(), car: (car || '').trim(), avatar }, emailRedirectTo: siteUrl },
        });
        if (error) throw new Error(/registered|exists/i.test(error.message) ? 'errExists' : /password/i.test(error.message) ? 'errPwd' : 'errNetwork');
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('errExists');
        if (!data.session) throw new Error('checkEmail'); // conferma email attiva su Supabase
        await loadUser(data.user);
        return this.current();
      },
      async login(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email: norm(email), password });
        if (error) throw new Error(/confirm/i.test(error.message) ? 'errConfirm' : /invalid/i.test(error.message) ? 'errLogin' : 'errNetwork');
        await loadUser(data.user);
        return this.current();
      },
      // In cloud il reset avviene via email: qui si invia il link.
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(norm(email), { redirectTo: siteUrl });
        if (error) throw new Error('errNetwork');
      },
      async setNewPassword(password) {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) throw new Error('errPwd');
        if (data.user) await loadUser(data.user);
      },
      async update(fields) {
        if (!C.user) return;
        Object.assign(C.profile, fields);
        await run('profile', sb.from('profiles').update(fields).eq('id', C.user.id));
      },
      async logout() { C = empty(); await sb.auth.signOut(); },
      async deleteAccount() {
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
      reviews(roadId) { return (reviewsByRoad[roadId] || []).map((r) => Object.assign({}, r, { mine: r.mine })); },
      async loadReviews(roadId) {
        const { data, error } = await sb.from('reviews').select('*').eq('road_id', roadId).order('created_at', { ascending: false }).limit(100);
        if (!error) {
          reviewsByRoad[roadId] = data.map(mapReview);
          ratings[roadId] = data.length ? { sum: data.reduce((s, r) => s + r.rating, 0), count: data.length } : undefined;
        }
        return Store.reviews(roadId);
      },
      addReview(roadId, { rating, text }) {
        if (!C.user) return;
        const tmp = { id: 'tmp-' + randomHex(4), user: C.profile.name, car: C.profile.car, rating, text: text.trim(), date: new Date().toISOString().slice(0, 10), mine: true };
        reviewsByRoad[roadId] = [tmp, ...(reviewsByRoad[roadId] || [])];
        const x = (ratings[roadId] = ratings[roadId] || { sum: 0, count: 0 }); x.sum += rating; x.count += 1;
        C.myReviews += 1;
        run('review', sb.from('reviews').insert({ road_id: roadId, user_id: C.user.id, rating, text: text.trim(), author_name: C.profile.name, author_car: C.profile.car }).select().single())
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
    });
    return { Auth, Store };
  }

  const cfg = window.TOUGE_CONFIG || {};
  const useCloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  const impl = useCloud ? buildCloud(cfg) : buildLocal();
  window.Auth = impl.Auth;
  window.Store = impl.Store;
})();
