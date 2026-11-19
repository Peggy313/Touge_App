/* TOUGE App — interfaccia e router */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const app = $('#app');
  const tabbar = $('#tabbar');
  const ROADS = window.ROADS;
  const byId = Object.fromEntries(ROADS.map((r) => [r.id, r]));
  ROADS.forEach((r, i) => (r.no = String(i + 1).padStart(2, '0'))); // numero di collezione

  let lang = Store.lang();
  let map = null; // istanza Leaflet attiva
  // filtri: dentro una categoria vale "o" (es. Italia o Slovenia), tra categorie "e"
  const filters = { q: '', sel: { country: [], diff: [], len: [], hair: [], alt: [] }, sort: 'name', open: false, noToll: false };

  const t = (k) => (I18N[lang] && I18N[lang][k] != null ? I18N[lang][k] : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tag = (k) => (TAGS[k] ? TAGS[k][lang === 'it' ? 0 : 1] : k);
  const cname = (c) => COUNTRIES[c][lang];
  const FLAGS = {
    IT: '<rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/>',
    FR: '<rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/>',
    AT: '<rect width="3" height="2" fill="#ed2939"/><rect y=".667" width="3" height=".667" fill="#fff"/>',
    SI: '<rect width="3" height="2" fill="#fff"/><rect y=".667" width="3" height=".667" fill="#0057b8"/><rect y="1.333" width="3" height=".667" fill="#ed1c24"/><path d="M.55 .35h.6v.55q0 .3-.3.42-.3-.12-.3-.42Z" fill="#0057b8" stroke="#ed1c24" stroke-width=".05"/><path d="M.62 .82l.12-.2.11.12.12-.22.13.3" fill="none" stroke="#fff" stroke-width=".05"/>',
    CH: '<rect width="3" height="2" fill="#da291c"/><rect x="1.3" y=".45" width=".4" height="1.1" fill="#fff"/><rect x=".95" y=".8" width="1.1" height=".4" fill="#fff"/>',
  };
  const flag = (c) => `<svg class="flag" viewBox="0 0 3 2" aria-label="${c}">${FLAGS[c] || ''}</svg>`;
  const fmt = (n) => n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB');

  // ───────────── icone ─────────────
  const I = {
    explore: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.2 5.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z"/>',
    map: '<path d="M9 3 3 5.5v15.5l6-2.5 6 2.5 6-2.5V3l-6 2.5L9 3Zm0 2.2 6 2.5v11.1l-6-2.5V5.2Z"/>',
    // "Le tue strade": curva stilizzata con cordolo a blocchi alterni sul lato interno
    garage: '<path d="M7 23c0-6 2.4-8.6 6.6-10.6C17.2 10.7 19 8.4 19 1h4c0 9.4-3 12.4-7.6 14.6C12.2 17.1 11 18.6 11 23H7Z"/>' +
      '<path d="M3.2 23c0-7.6 3.4-11 8.6-13.4C15 8.1 15.6 6 15.6 1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="2.4 2.4"/>' +
      '<path d="M3.2 23c0-7.6 3.4-11 8.6-13.4C15 8.1 15.6 6 15.6 1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="2.4 2.4" stroke-dashoffset="2.4" opacity=".35"/>' +
      '<path d="M9 22.5c.2-4.3 1.9-6.3 5.4-8M18 10.6c1.6-2 2.5-4.6 2.6-9" fill="none" stroke="var(--icon-bg, #141414)" stroke-width="1" stroke-dasharray="1.6 1.6"/>',
    profile: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-9 2.2-9 5.5V22h18v-2.5c0-3.3-4.6-5.5-9-5.5Z"/>',
    heart: '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4 6.9 4c2.2 0 3.6 1.2 5.1 3 1.5-1.8 2.9-3 5.1-3C21 4 23.1 8.2 21.6 11.7 19.5 16.4 12 21 12 21Z"/>',
    flag: '<path d="M5 2v20h2v-7h11l-2-4 2-4H7V2H5Z"/>',
    back: '<path d="M15.5 4 7.5 12l8 8 1.5-1.5L10.5 12 17 5.5 15.5 4Z"/>',
    search: '<path d="M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
    sliders: '<path d="M3 6h10v2H3V6Zm14 0h4v2h-4v2h-2V4h2v2ZM3 16h4v-2h2v6H7v-2H3v-2Zm8 0h10v2H11v-2Zm-8-5h14v2H3v-2Zm16 0h2v2h-2v-2Z"/>',
    mountain: '<path d="m14 6-3.8 5 2.9 3.8-1.6 1.2L7 10l-6 8h22L14 6Z"/>',
    road: '<path d="M10.5 2h3l.3 4h-3.6l.3-4Zm-.6 7h4.2l.4 5H9.5l.4-5Zm-.7 8h5.6l.5 5H8.7l.5-5ZM4 2h2L3 22H1L4 2Zm14 0h2l3 20h-2L18 2Z"/>',
    hairpin: '<path d="M6 21V8a4 4 0 0 1 8 0v8a2 2 0 0 0 4 0V3h2v13a4 4 0 0 1-8 0V8a2 2 0 0 0-4 0v13H6Z"/>',
    snow: '<path d="M11 2h2v4.6l2.8-1.7 1 1.7L13 9v2h2l2.4-3.8 1.7 1L17.4 11H22v2h-4.6l1.7 2.8-1.7 1L15 13h-2v2l3.8 2.4-1 1.7L13 17.4V22h-2v-4.6l-2.8 1.7-1-1.7L11 15v-2H9l-2.4 3.8-1.7-1L6.6 13H2v-2h4.6L4.9 8.2l1.7-1L9 11h2V9L7.2 6.6l1-1.7L11 6.6V2Z"/>',
    euro: '<path d="M15 4a8 8 0 0 0-7.4 5H5v2h2.1a8 8 0 0 0 0 2H5v2h2.6A8 8 0 0 0 19 18.5l-1.4-1.4A6 6 0 0 1 9.8 15H14v-2H9.1a6 6 0 0 1 0-2H14V9H9.8a6 6 0 0 1 7.8-2.1L19 5.5A8 8 0 0 0 15 4Z"/>',
    pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>',
    locate: '<path d="M11 2v2.1A8 8 0 0 0 4.1 11H2v2h2.1a8 8 0 0 0 6.9 6.9V22h2v-2.1a8 8 0 0 0 6.9-6.9H22v-2h-2.1A8 8 0 0 0 13 4.1V2h-2Zm1 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>',
    star: '<path d="m12 2 3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.5l-6.4 3.7 1.6-7.1L1.8 9.3 9 8.6 12 2Z"/>',
    logout: '<path d="M10 3H4v18h6v-2H6V5h4V3Zm5.5 4-1.4 1.4 2.6 2.6H8v2h8.7l-2.6 2.6 1.4 1.4 5-5-5-5Z"/>',
    trash: '<path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"/>',
    edit: '<path d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8L4 17.2ZM17.7 9.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.1 1.1 2.8 2.8 1.1-1.1Z"/>',
    globe: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15 15 0 0 0-1.3-3.8A8 8 0 0 1 18.9 8ZM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4ZM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4H4.3Zm.8 2h3a15 15 0 0 0 1.3 3.8A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.3-3.8C8.9 5.4 8.4 6.7 8.1 8ZM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4Zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4Zm.3 5.8c.6-1.2 1-2.5 1.3-3.8h3a8 8 0 0 1-4.3 3.8Zm1.7-5.8a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4Z"/>',
    external: '<path d="M14 3v2h3.6l-9.3 9.3 1.4 1.4L19 6.4V10h2V3h-7ZM5 5v14h14v-5h-2v3H7V7h3V5H5Z"/>',
    check: '<path d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/>',
    gauge: '<path d="M12 4A10 10 0 0 0 3.4 19.1l1.7-1A8 8 0 1 1 18.9 18l1.7 1A10 10 0 0 0 12 4Zm5.3 4.6-6.2 4.6a1.9 1.9 0 1 0 2.4 2.2l3.8-6.8Z"/>',
    chev: '<path d="M7 10h10l-5 5-5-5Z"/>',
    close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/>',
    share: '<path d="M18 16a3 3 0 0 0-2.4 1.2L8.9 13.7a3 3 0 0 0 0-3.4l6.7-3.5A3 3 0 1 0 15 5c0 .2 0 .5.1.7L8.4 9.2a3 3 0 1 0 0 5.6l6.7 3.5A3 3 0 1 0 18 16Z"/>',
    story: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm5.3-4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/>',
  };
  const icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

  // bandiera a scacchi: icona delle strade guidate
  const CHK = (() => {
    let cells = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) cells += `<rect x="${6 + c * 4}" y="${3 + r * 3.4}" width="4" height="3.4"/>`;
    return `<svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="2.2" height="20" fill="currentColor"/><rect x="6" y="3" width="16" height="10.2" fill="#fff" stroke="currentColor" stroke-width="1"/><g fill="#141414">${cells}</g></svg>`;
  })();

  // targa da rally per la mappa (ispirata alle placche dei rally anni '80/'90)
  const DIFF_COL = ['', '#2fa84f', '#3fa9f5', '#d9a300', '#ff7a00', '#e2231a'];
  function rallyPlate(r, driven) {
    const arch = 'M4 17 Q4 4 23 4 Q42 4 42 17 L42 43 L4 43 Z';
    const inner = 'M7.5 18 Q7.5 7.5 23 7.5 Q38.5 7.5 38.5 18 L38.5 39.5 L7.5 39.5 Z';
    const bg = driven ? '#141414' : '#efe6d2', fg = driven ? '#ffcc00' : '#141414', rim = driven ? '#ffcc00' : '#e2231a';
    const top = driven
      ? `<clipPath id="ac"><path d="${inner}"/></clipPath><rect x="7" y="7" width="32" height="10" fill="url(#chkp)" clip-path="url(#ac)"/>`
      : `<text x="23" y="17" text-anchor="middle" class="kj" fill="#e2231a">峠</text>`;
    return `<div class="rp"><svg viewBox="0 0 46 56">
      <path d="${arch}" fill="${bg}" stroke="#141414" stroke-width="2.4"/>
      <path d="${inner}" fill="none" stroke="${rim}" stroke-width="1.6"/>
      ${top}
      <text x="23" y="33" text-anchor="middle" class="num" fill="${fg}">${r.no}</text>
      <rect x="7.5" y="35" width="31" height="4.5" fill="${DIFF_COL[r.diff]}"/>
      <path d="M17 43 L23 53 L29 43 Z" fill="#141414"/>
    </svg></div>`;
  }
  // Placca "Strada guidata" in stile rally storico: spalle piatte e cupola centrale,
  // riquadro crema con il numero di collezione, anno in cui l'hai guidata ai lati.
  function drivenPlate(r) {
    const d = new Date(Store.driven()[r.id] || Date.now());
    const ddmm = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    // Geometria ricalcata sulla placca di riferimento (504×226): spalle a y=60, cupola ellittica
    // da x=91 a x=411, riquadro crema 150×68, scritta in basso alta quasi metà placca.
    const shape = 'M8 60 L91 60 A160 60 0 0 1 411 60 L494 60 Q502 60 502 68 L502 218 Q502 226 494 226 L8 226 Q0 226 0 218 L0 68 Q0 60 8 60 Z';
    return `<svg viewBox="-6 -6 514 238" aria-label="${esc(t('driven'))} ${ddmm}/${d.getFullYear()}">
      <path d="${shape}" fill="#e3262c" stroke="#f6efe0" stroke-width="8" paint-order="stroke" stroke-linejoin="round"/>
      <rect x="172" y="16" width="158" height="70" rx="8" fill="#f6efe0"/>
      <text x="251" y="77" text-anchor="middle" class="pl-num" data-fit="136">${r.no}</text>
      <text x="164" y="92" text-anchor="end" class="pl-side" data-fit="74">${ddmm}</text>
      <text x="338" y="92" text-anchor="start" class="pl-side" data-fit="74">${d.getFullYear()}</text>
      <text x="251" y="205" text-anchor="middle" class="pl-title" data-fit="470" data-fill="1">${esc(t('driven').toUpperCase())}</text>
    </svg>`;
  }

  // Adatta i testi delle placche alla loro area: restringe (o allarga, per la scritta in basso)
  // in orizzontale attorno al punto di ancoraggio, così la composizione resta uguale con ogni font.
  function fitPlates(root) {
    $$('.stamp text[data-fit], .join-plate text[data-fit]', root || document).forEach((el) => {
      el.removeAttribute('transform');
      let w = 0;
      try { w = el.getComputedTextLength(); } catch (e) { return; }
      if (!w) return;
      const max = +el.dataset.fit, x = +el.getAttribute('x');
      const s = el.dataset.fill ? max / w : Math.min(1, max / w);
      if (Math.abs(s - 1) > 0.01) el.setAttribute('transform', `translate(${x} 0) scale(${s.toFixed(3)} 1) translate(${-x} 0)`);
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitPlates());
  if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => fitPlates());

  // pattern a scacchi condiviso dalle targhe
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="chkp" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#efe6d2"/><rect width="3" height="3" fill="#141414"/><rect x="3" y="3" width="3" height="3" fill="#141414"/></pattern></defs></svg>');

  const LOGO =`<div class="logo"><span class="logo-kanji">峠</span><span class="logo-word"><b>TOUGE</b><i>APP · 走り屋</i></span></div>`;

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function avatar(user, size) {
    const grads = [['#ff3b1f', '#ff8a3d'], ['#ff2d55', '#7c3aed'], ['#06b6d4', '#3b82f6'], ['#f59e0b', '#ef4444'], ['#10b981', '#0ea5e9'], ['#e11d48', '#f97316']];
    const g = grads[(user.avatar || 0) % grads.length];
    const ini = (user.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="avatar" style="--s:${size || 44}px;background:linear-gradient(135deg,${g[0]},${g[1]})">${esc(ini)}</div>`;
  }

  function diffBars(d) {
    return `<span class="diff d${d}" title="${t('difficulty')}: ${t('diffLabels')[d]}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function stars(v, cls) {
    return `<span class="stars ${cls || ''}">${[1, 2, 3, 4, 5].map((i) => `<svg viewBox="0 0 24 24" class="${i <= Math.round(v) ? 'on' : ''}">${I.star}</svg>`).join('')}</span>`;
  }

  function haversine(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const summit = (r) => r.wp[Math.min(1, r.wp.length - 1)];

  // "oggi", "ieri", "3 giorni fa"
  function ago(iso) {
    const d0 = new Date(iso); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(); d1.setHours(0, 0, 0, 0);
    const n = Math.round((d1 - d0) / 864e5);
    return n <= 0 ? t('agoToday') : n === 1 ? t('agoYesterday') : t('agoDays').replace('{n}', n);
  }

  function roadOfDay() {
    const d = new Date();
    const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    return ROADS[n % ROADS.length];
  }

  // ───────────── router ─────────────
  // Flusso: splash animato → (prima volta) "Cos'è TOUGE?" → Esplora, anche senza account.
  // Senza account si vede tutto; salvare (preferiti, strade guidate, recensioni, segnalazioni)
  // e le schede Le tue strade / Pilota aprono l'invito a registrarsi, che poi completa l'azione.
  const PUBLIC = ['login', 'register', 'forgot'];
  const BARE = ['intro', 'reset', ...PUBLIC];          // schermate senza barra delle schede
  const OPEN = ['intro', 'reset', 'privacy'];
  const GUEST = ['explore', 'map', 'road'];            // visibili anche senza account
  const LOCKED = ['garage', 'profile'];                // senza account: invito a registrarsi
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } };

  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || '';
    const name = hash.startsWith('road-') ? 'road' : hash; const param = name === 'road' ? hash.slice(5) : '';
    const user = Auth.current();

    if (map) { map.remove(); map = null; }
    document.documentElement.lang = lang;

    if (name === 'welcome') return go('intro'); // vecchi link
    if (!user && name === 'reset') return go('login');
    if (!user && ![...PUBLIC, ...OPEN, ...GUEST, ...LOCKED].includes(name)) {
      return go(lsGet('touge.guestIntro', false) ? 'explore' : 'intro'); // la prima volta: "Cos'è TOUGE?"
    }
    if (user) Store.setHadAccount();
    if (user && (PUBLIC.includes(name) || !name)) return go('explore');

    const views = { intro: viewIntro, reset: viewReset, login: viewLogin, register: viewRegister, forgot: viewForgot, privacy: viewPrivacy, explore: viewExplore, map: viewMap, road: viewRoad, garage: viewGarage, profile: viewProfile };
    let view = views[name];
    if (!view) return go('explore');
    if (!user && LOCKED.includes(name)) view = viewLocked;

    const isAuth = BARE.includes(name);
    tabbar.hidden = isAuth;
    document.body.classList.toggle('auth-mode', isAuth);
    document.documentElement.classList.toggle('auth-mode', isAuth);
    document.body.classList.toggle('map-mode', name === 'map');
    document.body.classList.toggle('guest', !user && !isAuth);
    view(param, user);
    if (!isAuth) renderTabbar(name === 'road' ? 'explore' : name === 'privacy' ? 'profile' : name);
    else renderJoinbar(false);
    if (name !== 'map') window.scrollTo(0, 0);
  }
  function go(path) { location.hash = '#' + path; }

  function renderTabbar(active) {
    const tabs = ['explore', 'map', 'garage', 'profile'];
    const guest = !Auth.current();
    tabbar.innerHTML = tabs.map((k) => `<a href="#${k}" class="tab ${k === active ? 'active' : ''}"${guest && LOCKED.includes(k) ? ` data-lock="${k}"` : ''}>${icon(k)}<span>${t(k)}</span></a>`).join('');
    $$('[data-lock]', tabbar).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openJoinSheet(a.dataset.lock, null, { go: a.dataset.lock }); }));
    renderJoinbar(guest);
  }

  // ───────────── INVITI A REGISTRARSI (modalità ospite) ─────────────
  // barra fissa sopra le schede, sempre visibile finché non ci si registra
  function renderJoinbar(show) {
    let bar = $('#joinbar');
    if (!show) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'joinbar'; bar.className = 'joinbar'; document.body.appendChild(bar); }
    bar.innerHTML = `<span class="jb-k" aria-hidden="true">峠</span><span class="jb-t">${t('joinBar')}</span><button class="jb-btn" id="jb-go">${t('register')}</button>`;
    $('#jb-go', bar).onclick = () => startJoin();
  }
  // porta alla registrazione ricordando dove si era e cosa si voleva fare
  function startJoin(pending, toLogin) {
    try {
      const h = location.hash.replace(/^#\/?/, '');
      if (h && !BARE.includes(h)) sessionStorage.setItem('touge.next', h); else sessionStorage.removeItem('touge.next');
      if (pending) sessionStorage.setItem('touge.pending', JSON.stringify(pending)); else sessionStorage.removeItem('touge.pending');
    } catch (e) { /* ok */ }
    go(toLogin ? 'login' : 'register');
  }
  // foglio dal basso con la placca: "Crea la tua licenza pilota"
  function openJoinSheet(reason, r, pending) {
    const keys = { fav: 'joinFav', driven: 'joinDriven', review: 'joinReview', report: 'joinReport', flag: 'joinFlag', garage: 'joinGarage', profile: 'joinProfile', remind: 'joinRemind' };
    const pr = r || roadOfDay();
    const seen = lsGet('touge.guestViews', []).length;
    const sh = openSheet(`
      <div class="join">
        <div class="join-plate">${drivenPlate(pr)}</div>
        <h2 class="h2">${t('joinTitle')}</h2>
        <p class="join-text">${esc(t(keys[reason] || 'joinGarage').replace('{n}', seen))}</p>
        <button class="btn primary" id="j-reg">${t('joinCta')}</button>
        <div class="join-foot"><button class="link" id="j-log">${t('yesAccount')} <b>${t('login')}</b></button><button class="link muted" data-close>${t('notNow')}</button></div>
      </div>`);
    sh.classList.add('join-sheet');
    fitPlates(sh);
    $('#j-reg', sh).onclick = () => { sh.remove(); startJoin(pending); };
    $('#j-log', sh).onclick = () => { sh.remove(); startJoin(pending, true); };
  }
  // schermata delle schede bloccate se ci si arriva da un link
  function viewLocked() {
    const k = location.hash.slice(1);
    app.innerHTML = `
      <header class="top"><h1 class="h1">${t(k)}</h1></header>
      <section class="locked">
        <div class="join-plate">${drivenPlate(roadOfDay())}</div>
        <h2 class="h2">${t('joinTitle')}</h2>
        <p class="join-text">${t(k === 'profile' ? 'joinProfile' : 'joinGarage')}</p>
        <button class="btn primary" id="l-reg">${t('joinCta')}</button>
        <button class="link" id="l-log">${t('yesAccount')} <b>${t('login')}</b></button>
      </section>`;
    fitPlates(app);
    $('#l-reg').onclick = () => startJoin({ go: k });
    $('#l-log').onclick = () => startJoin({ go: k }, true);
  }

  // ───────────── PRIVACY ─────────────
  function privacyHTML() {
    const P = window.PRIVACY || {};
    const email = (window.TOUGE_CONFIG && window.TOUGE_CONFIG.contactEmail) || '';
    const contact = email ? `<a class="link" href="mailto:${esc(email)}">${esc(email)}</a>` : `<mark>${t('privacyNoEmail')}</mark>`;
    return (P[lang] || P.it || '').replace(/\{EMAIL\}/g, contact);
  }
  function viewPrivacy() {
    app.innerHTML = `
      <section class="doc">
        <header class="top doc-top">
          <button class="round-btn back-inline" id="doc-back" aria-label="back">${icon('back')}</button>
          <h1 class="h1">${t('privacy')}</h1>
        </header>
        <article class="doc-body">${privacyHTML()}</article>
      </section>`;
    $('#doc-back').onclick = () => (history.length > 1 ? history.back() : go('explore'));
  }
  // dalla registrazione: l'informativa si apre in un foglio sopra il modulo, così i campi restano compilati
  function openPrivacySheet() {
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${t('privacy')}</h2><button class="link" data-close>${t('close')}</button></div>
      <article class="doc-body in-sheet">${privacyHTML()}</article>
      <button class="btn primary" data-close>${t('close')}</button>`);
    sh.classList.add('privacy-sheet');
  }

  // ───────────── AUTH ─────────────
  // ───────────── 0 · SPLASH ANIMATO ─────────────
  // La strada si disegna dal basso fino a metà schermo, il sole sorge a sinistra dietro
  // le montagne, poi la scritta TOUGE si compone lettera per lettera. Tocco = salta.
  function viewSplash(done) {
    tabbar.hidden = true;
    document.body.classList.add('auth-mode');
    const N = 110, pts = [];
    for (let i = 0; i <= N; i++) {
      const tt = i / N, k = 1 - tt;
      pts.push({ x: 200 + 118 * Math.pow(k, 0.85) * Math.sin(0.5 + tt * 4 * Math.PI), y: 432 + 400 * k * k, wd: 92 * Math.pow(k, 1.5) + 1.2 });
    }
    const center = 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L');
    const RP = window.roadParts;
    const road = RP.ribbon(pts, 3.4, '#efe6d2', 0, null, 55) + RP.ribbon(pts, 0, '#26222c', 0, null, 55) + RP.centerSegments(pts, '#ffcc00', 1.25);
    const W = 'x="-2000" width="4400"';
    app.innerHTML = `
      <section class="splash" id="splash" role="button" tabindex="0" aria-label="TOUGE · ${t('tapToSkip')}">
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid meet" overflow="visible" aria-hidden="true">
          <defs><mask id="sp-mask" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4400" height="4800">
            <path id="sp-mask-path" d="${center}" fill="none" stroke="#fff" stroke-width="150" stroke-linecap="round" stroke-linejoin="round"/>
          </mask></defs>
          <rect ${W} y="-2000" height="2160" fill="#0d1026"/>
          <rect ${W} y="160" height="110" fill="#3a1450"/>
          <rect ${W} y="270" height="80" fill="#c2185b"/>
          <rect ${W} y="350" height="60" fill="#f2542d"/>
          <rect ${W} y="410" height="2400" fill="#ffcc00"/>
          <g class="sp-sun">
            <circle cx="105" cy="372" r="52" fill="#fff3c4"/>
            ${[0, 1, 2, 3].map((i) => `<rect x="50" y="${380 + i * 11}" width="110" height="${2 + i * 1.6}" fill="#f2542d"/>`).join('')}
          </g>
          <path d="M-1800 800 L-1800 470 L-300 430 L20 372 L140 418 L250 340 L410 425 L640 380 L2200 455 L2200 800 Z" fill="#7a2e5a"/>
          <path d="M-1800 900 L-1800 492 L-60 470 L110 436 L220 462 L330 428 L520 476 L2200 486 L2200 900 Z" fill="#3e1a42"/>
          <path d="M-1800 2800 L-1800 520 L-100 505 L130 470 L270 498 L420 474 L2200 520 L2200 2800 Z" fill="#1b1026"/>
          <g mask="url(#sp-mask)">${road}</g>
        </svg>
        <div class="sp-title"><h1>${'TOUGE'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</h1></div>
        <p class="sp-skip">${t('tapToSkip')}</p>
      </section>`;
    const el = $('#splash'), mp = $('#sp-mask-path');
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      el.classList.add('out');
      setTimeout(done, reduce ? 0 : 380);
    };
    try {
      const L = mp.getTotalLength();
      mp.style.strokeDasharray = L + ' ' + L;
      if (reduce) mp.style.strokeDashoffset = 0;
      else mp.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1700, delay: 150, easing: 'cubic-bezier(.45,0,.15,1)', fill: 'both' });
    } catch (e) { /* senza animazione la strada è già visibile */ }
    el.classList.toggle('still', reduce);
    requestAnimationFrame(() => el.classList.add('go'));
    setTimeout(() => el.classList.add('go'), 60); // anche se rAF è in pausa
    // a fine composizione blocca le lettere nitide (alcuni browser lasciano una lettera sfocata)
    const lastLetter = el.querySelector('.sp-title h1 span:last-child');
    if (lastLetter) lastLetter.addEventListener('animationend', () => el.classList.add('letters-done'));
    setTimeout(() => el.classList.add('letters-done'), 2600);
    // si entra solo con un tocco (o Invio/Spazio da tastiera)
    el.addEventListener('click', finish);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } });
    el.focus({ preventScroll: true });
  }

  // ───────────── 2 · LANDING "COS'È TOUGE" ─────────────
  // Seconda schermata dopo accesso/registrazione: scheda centrata che presenta TOUGE,
  // poi AVANTI scorre i tre step (Scopri, Pianifica, Colleziona) e infine apre l'app.
  function viewIntro(_, user) {
    const slides = [
      { mark: '<span class="jp">峠</span>', kicker: t('whatIsTouge'), title: 'TOUGE', text: t('introLead') },
      { mark: '1', kicker: t('howItWorks') + ' · 1/3', title: t('ob1t'), text: t('ob1d') },
      { mark: '2', kicker: t('howItWorks') + ' · 2/3', title: t('ob2t'), text: t('ob2d') },
      { mark: '3', kicker: t('howItWorks') + ' · 3/3', title: t('ob3t'), text: t('ob3d') },
    ];
    const hero = ROADS.find((r) => r.id === 'stelvio');
    let i = 0;
    app.innerHTML = `
      <section class="intro">
        <div class="intro-card">
          <div class="intro-top"><span>峠道 · Touge Culture</span><button class="intro-skip" id="in-skip">${t('skip')}</button></div>
          <div class="intro-art">${roadArt(hero, { w: 400, h: 200, stripes: true, mood: 'dusk' })}</div>
          <div class="intro-body" id="in-body" aria-live="polite"></div>
          <div class="dots" id="in-dots">${slides.map(() => '<i></i>').join('')}</div>
          <button class="btn primary" id="in-next"></button>
          ${user ? '' : `<button class="link intro-guest" id="in-guest">${t('exploreFirst')} →</button>`}
        </div>
      </section>`;
    // in fondo: chi non è dentro va alla registrazione (o esplora senza account con il link sotto)
    lsSet('touge.guestIntro', true);
    const finish = () => { if (user) { Store.setIntroSeen(); go('explore'); } else startJoin(); };
    if (!user) $('#in-guest').onclick = () => go('explore');
    const render = () => {
      const s = slides[i];
      $('#in-body').innerHTML = `
        <div class="intro-slide ${i === 0 ? 'first' : ''}">
          <span class="intro-mark">${s.mark}</span>
          <span class="kicker">${s.kicker}</span>
          <h1>${esc(s.title)}</h1>
          <p>${s.text}</p>
        </div>`;
      $$('#in-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
      $('#in-next').textContent = i === slides.length - 1 ? (user ? t('startDriving') : t('createAccount')) : t('next');
    };
    $('#in-next').onclick = () => { if (i < slides.length - 1) { i++; render(); } else finish(); };
    $('#in-skip').onclick = () => go('explore');
    render();
  }

  function langSwitch() {
    return `<div class="lang-switch">${['it', 'en'].map((l) => `<button data-lang="${l}" class="${l === lang ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>`;
  }
  function bindLangSwitch() {
    $$('[data-lang]').forEach((b) => (b.onclick = () => { lang = b.dataset.lang; Store.setLang(lang); route(); }));
  }

  // opts.full = registrazione a tutto schermo (fascia illustrata sottile) · opts.social = bottone Google
  function authShell(title, sub, form, foot, opts) {
    opts = opts || {};
    const r = ROADS[Math.floor(Math.random() * ROADS.length)];
    const social = opts.social && Auth.google
      ? `<button type="button" class="btn social" id="g-btn">${GOOGLE_G}<span>${t('continueGoogle')}</span></button>
         <div class="or"><span>${t('orEmail')}</span></div>`
      : '';
    app.innerHTML = `
      <section class="auth ${opts.full ? 'full' : ''}">
        <div class="auth-art">${roadArt(r, { w: 400, h: 300, num: r.no, stripes: true })}
          <div class="auth-top">${LOGO}${langSwitch()}</div>
        </div>
        <div class="auth-card">
          <div class="form-tab"><span>${t('entryForm')}</span></div>
          <h1>${title}</h1>
          <p class="muted">${sub}</p>
          ${social}
          <form id="auth-form" novalidate>${form}<p class="form-error" id="form-error" role="alert"></p></form>
          <div class="auth-foot">${foot}</div>
        </div>
      </section>`;
    bindLangSwitch();
    const g = $('#g-btn');
    if (g) g.onclick = async () => {
      g.disabled = true; g.classList.add('loading');
      try { await Auth.signInWithGoogle(); } // reindirizza a Google e poi torna nell'app
      catch (err) { showErr(err.message); g.disabled = false; g.classList.remove('loading'); }
    };
    return $('#auth-form');
  }
  // logo "G" multicolore di Google (uso previsto dalle linee guida del pulsante "Accedi con Google")
  const GOOGLE_G = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  const field = (name, label, type, ph, auto, extra) => `<div class="field"><div class="field-top"><label for="f-${name}">${label}</label>${extra || ''}</div><input id="f-${name}" name="${name}" type="${type}" placeholder="${ph || ''}" autocomplete="${auto || 'off'}" /></div>`;
  const showErr = (k) => { const el = $('#form-error'); el.classList.remove('info'); el.textContent = !k ? '' : k.startsWith('raw:') ? k.slice(4) : t(k); };
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function viewLogin() {
    const f = authShell(t('welcomeBack'), t('loginSub'),
      field('email', t('email'), 'email', 'nome@email.it', 'email') +
      field('password', t('password'), 'password', '••••••', 'current-password', `<a href="#forgot" class="link">${t('forgot')}</a>`) +
      `<button class="btn primary" type="submit">${t('login')}</button>`,
      `<span>${t('noAccount')} <a href="#register" class="link">${t('register')}</a></span><a href="#explore" class="link muted">${t('exploreFirst')} →</a>`, { social: true });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!validEmail(d.email)) return showErr('errEmail');
      busy(f, true);
      try { const u = await Auth.login(d.email, d.password); toast(`${t('hello')}, ${u.name}!`); goAfterAuth(); }
      catch (err) { showErr(err.message); }
      busy(f, false);
    };
  }
  // pulsante "in corso" durante le chiamate al server
  function busy(form, on) { const b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.classList.toggle('loading', on); } }
  // dopo l'accesso torna alla pagina che si voleva aprire (es. link condiviso a una strada)
  // e completa l'azione che aveva aperto l'invito (♥ o "Strada guidata")
  function goAfterAuth() {
    let next = null, pending = null;
    try {
      next = sessionStorage.getItem('touge.next'); pending = JSON.parse(sessionStorage.getItem('touge.pending') || 'null');
      sessionStorage.removeItem('touge.next'); sessionStorage.removeItem('touge.pending');
    } catch (e) { /* ok */ }
    if (pending && pending.road && byId[pending.road]) {
      if (pending.act === 'fav' && !Store.isFav(pending.road)) { Store.toggleFav(pending.road); toast('♥ ' + byId[pending.road].name); }
      if (pending.act === 'driven' && !Store.isDriven(pending.road)) { Store.toggleDriven(pending.road); toast('🏁 ' + byId[pending.road].name); }
    }
    go((pending && pending.go) || next || 'explore');
  }

  function viewRegister() {
    const f = authShell(t('createAccount'), t('registerSub'),
      `<div class="field-row">${field('name', t('name'), 'text', t('namePh'), 'nickname')}${field('car', t('car'), 'text', t('carPh'))}</div>` +
      field('email', t('email'), 'email', 'nome@email.it', 'email') +
      `<div class="field-row">${field('password', t('password'), 'password', '••••••', 'new-password')}${field('password2', t('confirmShort'), 'password', '••••••', 'new-password')}</div>` +
      `<label class="check"><input type="checkbox" name="terms" id="f-terms" /><span>${t('acceptTerms')}</span></label>
       <button class="btn primary" type="submit">${t('register')}</button>`,
      `<span>${t('yesAccount')} <a href="#login" class="link">${t('login')}</a></span><a href="#explore" class="link muted">${t('exploreFirst')} →</a>`, { social: true, full: true });
    $$('a[href="#privacy"]', f).forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPrivacySheet(); }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!d.name.trim()) return showErr('errName');
      if (!validEmail(d.email)) return showErr('errEmail');
      if (d.password.length < 6) return showErr('errPwd');
      if (d.password !== d.password2) return showErr('errMatch');
      if (!d.terms) return showErr('errTerms');
      busy(f, true);
      try { const u = await Auth.register(d); toast(`${t('hello')}, ${u.name}!`); goAfterAuth(); }
      catch (err) {
        if (err.message === 'checkEmail') { showInfo('checkEmail'); f.reset(); }
        else showErr(err.message);
      }
      busy(f, false);
    };
  }
  const showInfo = (k) => { const el = $('#form-error'); el.textContent = t(k); el.classList.add('info'); };

  function viewForgot() {
    if (Auth.cloud) {
      // online: Supabase manda un'email con il link per scegliere la nuova password
      const f = authShell(t('resetTitle'), t('resetInfoCloud'),
        field('email', t('email'), 'email', 'nome@email.it', 'email') +
        `<button class="btn primary" type="submit">${t('sendLink')}</button>`,
        `<a href="#login" class="link">${t('login')}</a>`);
      f.onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f));
        if (!validEmail(d.email)) return showErr('errEmail');
        busy(f, true);
        try { await Auth.resetPassword(d.email); showInfo('linkSent'); }
        catch (err) { showErr(err.message); }
        busy(f, false);
      };
      return;
    }
    const f = authShell(t('resetTitle'), t('resetInfo'),
      field('email', t('email'), 'email', 'nome@email.it', 'email') +
      field('password', t('newPassword'), 'password', '••••••', 'new-password') +
      `<button class="btn primary" type="submit">${t('resetBtn')}</button>`,
      `<a href="#login" class="link">${t('login')}</a>`);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!validEmail(d.email)) return showErr('errEmail');
      if (d.password.length < 6) return showErr('errPwd');
      try { await Auth.resetPassword(d.email, d.password); toast(t('resetDone')); go('login'); }
      catch (err) { showErr(err.message); }
    };
  }

  // arrivo dal link "reimposta password" ricevuto via email (solo modalità online)
  function viewReset() {
    const f = authShell(t('newPasswordTitle'), t('newPasswordSub'),
      field('password', t('newPassword'), 'password', '••••••', 'new-password') +
      field('password2', t('confirmPassword'), 'password', '••••••', 'new-password') +
      `<button class="btn primary" type="submit">${t('save')}</button>`, '');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (d.password.length < 6) return showErr('errPwd');
      if (d.password !== d.password2) return showErr('errMatch');
      busy(f, true);
      try { await Auth.setNewPassword(d.password); toast(t('resetDone')); go('explore'); }
      catch (err) { showErr(err.message); }
      busy(f, false);
    };
  }

  // ───────────── EXPLORE ─────────────
  // categorie di filtro: icona, etichetta e opzioni (con la regola che le verifica)
  const FILTER_DEFS = {
    country: { icon: 'globe', label: 'country', opts: () => Object.keys(COUNTRIES).map((c) => ({ v: c, label: flag(c) + ' ' + cname(c), short: cname(c), test: (r) => r.country === c })) },
    diff: { icon: 'gauge', label: 'difficulty', opts: () => [1, 2, 3, 4, 5].map((d) => ({ v: d, label: diffBars(d) + ' ' + t('diffLabels')[d], short: t('diffLabels')[d], test: (r) => r.diff === d })) },
    len: { icon: 'road', label: 'length', opts: () => [
      { v: 's', label: '&lt; 20 km', short: '&lt; 20 km', test: (r) => r.km < 20 },
      { v: 'm', label: '20–40 km', short: '20–40 km', test: (r) => r.km >= 20 && r.km <= 40 },
      { v: 'l', label: '&gt; 40 km', short: '&gt; 40 km', test: (r) => r.km > 40 }] },
    hair: { icon: 'hairpin', label: 'hairpins', opts: () => [
      { v: 'few', label: t('hairFew') + ' · &lt; 10', short: '&lt; 10', test: (r) => r.hairpins < 10 },
      { v: 'mid', label: t('hairMid') + ' · 10–29', short: '10–29', test: (r) => r.hairpins >= 10 && r.hairpins < 30 },
      { v: 'many', label: t('hairMany') + ' · 30+', short: '30+', test: (r) => r.hairpins >= 30 }] },
    alt: { icon: 'mountain', label: 'altitude', opts: () => [
      { v: 'low', label: '&lt; 1500 m', short: '&lt; 1500 m', test: (r) => r.alt < 1500 },
      { v: 'mid', label: '1500–2200 m', short: '1500–2200 m', test: (r) => r.alt >= 1500 && r.alt <= 2200 },
      { v: 'high', label: '&gt; 2200 m', short: '&gt; 2200 m', test: (r) => r.alt > 2200 }] },
  };
  const activeCount = () => Object.values(filters.sel).reduce((n, a) => n + a.length, 0) + (filters.open ? 1 : 0) + (filters.noToll ? 1 : 0);

  function applyFilters() {
    const q = filters.q.trim().toLowerCase();
    const groups = Object.entries(filters.sel).filter(([, vals]) => vals.length)
      .map(([k, vals]) => FILTER_DEFS[k].opts().filter((o) => vals.includes(o.v)));
    let list = ROADS.filter((r) => {
      if (groups.some((opts) => !opts.some((o) => o.test(r)))) return false;
      if (filters.open && r.closure) return false;
      if (filters.noToll && r.toll) return false;
      if (q && !(r.name + ' ' + r.region + ' ' + cname(r.country) + ' ' + r.tags.map(tag).join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
    const s = filters.sort;
    list.sort((a, b) =>
      s === 'alt' ? b.alt - a.alt : s === 'km' ? b.km - a.km : s === 'hair' ? b.hairpins - a.hairpins :
      s === 'rating' ? ((Store.rating(b.id) || { avg: 0 }).avg - (Store.rating(a.id) || { avg: 0 }).avg) : a.name.localeCompare(b.name));
    return list;
  }

  // riga di chip filtro (stessa in Esplora e Mappa): ogni chip apre le sue opzioni
  function filterChips(box, onChange, glass) {
    const g = glass ? ' glass' : '';
    const label = (k) => {
      const vals = filters.sel[k];
      if (!vals.length) return t(FILTER_DEFS[k].label);
      if (vals.length === 1) return FILTER_DEFS[k].opts().find((o) => o.v === vals[0]).short;
      return `${t(FILTER_DEFS[k].label)} · ${vals.length}`;
    };
    const paint = () => {
      const n = activeCount();
      box.innerHTML =
        (n ? `<button class="chip fchip reset${g}" data-reset>${icon('close')}<span>${t('reset')}</span></button>` : '') +
        Object.keys(FILTER_DEFS).map((k) => `<button class="chip fchip${g} ${filters.sel[k].length ? 'on' : ''}" data-f="${k}" aria-haspopup="dialog">${icon(FILTER_DEFS[k].icon)}<span>${label(k)}</span>${icon('chev', 'chev')}</button>`).join('') +
        `<button class="chip fchip${g} ${filters.open ? 'on' : ''}" data-t="open" aria-pressed="${filters.open}">${icon('snow')}<span>${t('openNow')}</span></button>` +
        `<button class="chip fchip${g} ${filters.noToll ? 'on' : ''}" data-t="noToll" aria-pressed="${filters.noToll}">${icon('euro')}<span>${t('noToll')}</span></button>`;
      $$('[data-f]', box).forEach((b) => (b.onclick = () => openFilterSheet(b.dataset.f, () => { paint(); onChange(); })));
      $$('[data-t]', box).forEach((b) => (b.onclick = () => { filters[b.dataset.t] = !filters[b.dataset.t]; paint(); onChange(); }));
      const r = $('[data-reset]', box);
      if (r) r.onclick = () => { Object.keys(filters.sel).forEach((k) => (filters.sel[k] = [])); filters.open = filters.noToll = false; paint(); onChange(); };
    };
    paint();
  }

  function roadCard(r) {
    const fav = Store.isFav(r.id), dr = Store.isDriven(r.id), rt = Store.rating(r.id);
    const st = Store.roadStatus(r.id);
    const badge = st && (st.by === 'official' || Date.now() - Date.parse(st.at) < 7 * 864e5)
      ? `<span class="st-badge ${st.status}">${t(st.status === 'open' ? 'stOpen' : 'stClosed')}</span>` : '';
    return `
      <article class="card ${dr ? 'is-driven' : ''}" data-go="${r.id}">
        <div class="card-art">${roadArt(r, { w: 320, h: 190, num: r.no })}${badge}
          <span class="card-alt"><b>${fmt(r.alt)}</b><small>m</small></span>
          ${dr ? `<span class="stamp">${drivenPlate(r)}</span>` : ''}
          <button class="fav-btn ${fav ? 'on' : ''}" data-fav="${r.id}" aria-label="${t('favorite')}">${icon('heart')}</button>
        </div>
        <div class="card-body">
          <div class="card-kicker">${flag(r.country)} ${esc(r.region)}</div>
          <div class="card-title"><h3>${esc(r.name)}</h3>${diffBars(r.diff)}</div>
          <div class="card-meta">
            <span>${r.km}<em>km</em></span>
            <span>≈${r.hairpins}<em>${t('hairpins')}</em></span>
            ${rt ? `<span class="rt">★ ${rt.avg.toFixed(1)}<em>${t('sortRating')}</em></span>` : `<span>${r.closure || '365'}<em>${r.closure ? t('closure') : t('openShort')}</em></span>`}
          </div>
        </div>
      </article>`;
  }

  function bindCards(root) {
    fitPlates(root);
    $$('[data-fav]', root).forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      if (!Auth.current()) return openJoinSheet('fav', byId[b.dataset.fav], { road: b.dataset.fav, act: 'fav' });
      const on = Store.toggleFav(b.dataset.fav);
      b.classList.toggle('on', on);
      toast(on ? '♥ ' + byId[b.dataset.fav].name : t('removeFav') + ' ✕');
    }));
    $$('[data-go]', root).forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
  }

  function viewExplore(_, user) {
    const rod = roadOfDay();
    app.innerHTML = `
      <header class="top">
        <div><p class="muted small">${t('exploreSub')}</p><h1 class="h1">${user ? `${t('hello')}, ${esc(user.name)}` : t('helloGuest')}</h1></div>
        ${user ? `<a href="#profile" aria-label="${t('profile')}">${avatar(user, 44)}</a>` : `<button class="enter-btn" id="enter">${t('register')}</button>`}
      </header>
      <div class="search-row">
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="${t('search')}" value="${esc(filters.q)}" /></label>
        <button class="icon-btn ${filters.sort !== 'name' ? 'dot' : ''}" id="open-filters" aria-label="${t('sort')}">${icon('sliders')}</button>
      </div>
      <div class="chips" id="chips"></div>

      <section class="featured ${Store.isDriven(rod.id) ? 'is-driven' : ''}" data-go="${rod.id}">
        ${roadArt(rod, { w: 400, h: 230, num: rod.no, stripes: true })}
        <div class="featured-info">
          <span class="kicker">峠 ${t('roadOfDay')}</span>
          <h2>${esc(rod.name)}</h2>
          <p>${flag(rod.country)} ${esc(rod.region)} · ${fmt(rod.alt)} m · ≈${rod.hairpins} ${t('hairpins').toLowerCase()}</p>
        </div>
      </section>

      <div class="list-head"><h2 class="h2" id="list-title">${t('explore')}</h2><span class="muted small" id="count"></span></div>
      <div class="grid" id="list"></div>
      <div class="sheet-wrap" id="sheet" hidden></div>`;

    const renderList = () => {
      const list = applyFilters();
      // con filtri o ricerca attivi la pagina diventa "risultati": sparisce la strada del giorno
      const filtered = activeCount() > 0 || !!filters.q.trim();
      $('.featured').hidden = filtered;
      $('#list-title').textContent = filtered ? t('filteredTitle') : t('explore');
      $('#count').textContent = `${list.length} ${list.length === 1 ? t('result1') : t('results')}`;
      $('#list').innerHTML = list.length ? list.map(roadCard).join('') : `<p class="empty">${t('noResults')}</p>`;
      bindCards($('#list'));
    };
    renderList();
    $('.featured').onclick = () => go('road-' + rod.id);
    if (!user) $('#enter').onclick = () => startJoin();

    $('#q').oninput = (e) => { filters.q = e.target.value; renderList(); };
    filterChips($('#chips'), renderList);
    $('#open-filters').onclick = () => openSortSheet(() => { renderList(); $('#open-filters').classList.toggle('dot', filters.sort !== 'name'); });
  }

  // foglio dal basso generico (filtri, ordinamento)
  function openSheet(html, onClose) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-bg" data-close></div><div class="sheet" role="dialog">${html}</div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 250); if (onClose) onClose(); };
    $$('[data-close]', wrap).forEach((b) => (b.onclick = close));
    return wrap;
  }

  // opzioni di una categoria di filtro (selezione multipla, si applica subito)
  function openFilterSheet(key, onChange) {
    const def = FILTER_DEFS[key];
    const sel = filters.sel[key];
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon(def.icon)} ${t(def.label)}</h2><button class="link" data-clear>${t('reset')}</button></div>
      <p class="muted small sheet-hint">${t('multiHint')}</p>
      <div class="chips wrap">${def.opts().map((o) => `<button class="chip ${sel.includes(o.v) ? 'on' : ''}" data-v="${o.v}">${o.label}</button>`).join('')}</div>
      <button class="btn primary" data-close>${t('showResults')} <span data-n></span></button>`);
    const count = () => { $('[data-n]', sh).textContent = `(${applyFilters().length})`; };
    $$('[data-v]', sh).forEach((b) => (b.onclick = () => {
      const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
      const i = filters.sel[key].indexOf(v);
      if (i >= 0) filters.sel[key].splice(i, 1); else filters.sel[key].push(v);
      b.classList.toggle('on', i < 0); count(); onChange();
    }));
    $('[data-clear]', sh).onclick = () => { filters.sel[key] = []; $$('[data-v]', sh).forEach((b) => b.classList.remove('on')); count(); onChange(); };
    count();
  }

  // ordinamento (bottone con i cursori accanto alla ricerca)
  function openSortSheet(onChange) {
    const sorts = [['name', 'sortName'], ['alt', 'sortAlt'], ['km', 'sortKm'], ['hair', 'sortHair'], ['rating', 'sortRating']];
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('sliders')} ${t('sort')}</h2></div>
      <div class="chips wrap">${sorts.map(([v, k]) => `<button class="chip ${filters.sort === v ? 'on' : ''}" data-s="${v}">${t(k)}</button>`).join('')}</div>
      <button class="btn primary" data-close>OK</button>`);
    $$('[data-s]', sh).forEach((b) => (b.onclick = () => {
      filters.sort = b.dataset.s;
      $$('[data-s]', sh).forEach((x) => x.classList.toggle('on', x === b)); onChange();
    }));
  }

  // ───────────── MAP ─────────────
  // Nella versione pubblicata (Artifact) le risorse esterne sono bloccate: niente tile OSM né OSRM.
  // Lì si usa una mappa vettoriale (confini Natural Earth) + tracciati pre-calcolati (data/routes.json).
  const OFFLINE_MAP = !!window.TOUGE_ARTIFACT;
  let routesP = null, europeP = null;
  const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  function allRoutes() {
    if (!routesP) routesP = getJSON('data/routes.json').catch(() => ({}));
    return routesP;
  }
  function europe() {
    if (!europeP) {
      europeP = getJSON('data/europe.json').then((topo) => {
        const fc = topojson.feature(topo, topo.objects.countries);
        const inBox = (f) => {
          let hit = false;
          const walk = (a) => { if (hit) return; if (typeof a[0] === 'number') { if (a[0] > -12 && a[0] < 35 && a[1] > 30 && a[1] < 60) hit = true; } else a.forEach(walk); };
          walk(f.geometry.coordinates);
          return hit;
        };
        return { type: 'FeatureCollection', features: fc.features.filter((f) => f.geometry && inBox(f)) };
      }).catch(() => null);
    }
    return europeP;
  }
  function tiles() {
    // tile OpenStreetMap standard, scurite via CSS (.dark-tiles) per il tema racing
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19, className: 'dark-tiles',
    });
  }
  function baseLayer(m, exceptId) {
    if (!OFFLINE_MAP) { tiles().addTo(m); return; }
    m.attributionControl.addAttribution('Natural Earth · OSRM/OpenStreetMap');
    europe().then((geo) => {
      if (!geo || map !== m) return;
      L.geoJSON(geo, { interactive: false, style: { color: '#4a4a55', weight: 1, fillColor: '#1d1d23', fillOpacity: 1 } }).addTo(m).bringToBack();
    });
    // tutti i tracciati della collezione come "strade" di contesto
    allRoutes().then((rs) => {
      if (map !== m) return;
      Object.entries(rs).forEach(([id, c]) => { if (id !== exceptId && c.length > 3) L.polyline(c, { color: '#ffcc00', weight: 2, opacity: 0.45, interactive: false }).addTo(m); });
    });
  }
  function markerIcon(r) {
    return L.divIcon({ className: '', html: rallyPlate(r, Store.isDriven(r.id)), iconSize: [46, 56], iconAnchor: [23, 53], popupAnchor: [0, -48] });
  }
  // targhe più piccole quando la mappa è lontana, per non sovrapporsi
  function scaleMarkers(m) {
    const apply = () => {
      const z = m.getZoom(), el = m.getContainer();
      el.classList.toggle('mk-tiny', z <= 6);
      el.classList.toggle('mk-small', z === 7 || z === 8);
    };
    m.on('zoomend', apply); apply();
  }

  function viewMap() {
    if (!window.L) { app.innerHTML = `<p class="empty">Map library unavailable (offline?).</p>`; return; }
    app.innerHTML = `
      <div class="map-full" id="bigmap"></div>
      <div class="map-overlay">
        <div class="chips" id="mchips"></div>
      </div>
      <div class="map-legend"><span>${rallyPlate({ no: '', diff: 3 }, false)}${t('legendPass')}</span><span>${rallyPlate({ no: '', diff: 3 }, true)}${t('driven')}</span></div>
      <button class="fab" id="locate" aria-label="${t('locate')}" ${OFFLINE_MAP ? 'hidden' : ''}>${icon('locate')}</button>`;
    map = L.map('bigmap', { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([46.2, 9.8], 6);
    baseLayer(map);
    scaleMarkers(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    const layer = L.layerGroup().addTo(map);

    const draw = (fit) => {
      layer.clearLayers();
      const list = applyFilters();
      list.forEach((r) => {
        const dr = Store.isDriven(r.id);
        const m = L.marker(summit(r), { icon: markerIcon(r), title: r.name, zIndexOffset: dr ? 500 : 0 }).addTo(layer);
        m.bindPopup(`<div class="pop">${dr ? `<span class="pop-driven">${CHK} ${t('driven')}</span>` : ''}<strong>${esc(r.name)}</strong><span>${flag(r.country)} ${esc(r.region)}</span><span>${fmt(r.alt)} m · ${r.km} km · ≈${r.hairpins} ${t('hairpins').toLowerCase()}</span><a href="#road-${r.id}" class="btn primary sm">${t('route')} →</a></div>`);
      });
      if (fit && list.length) map.fitBounds(L.latLngBounds(list.map(summit)), { padding: [40, 40], maxZoom: 9 });
    };
    draw(true);
    filterChips($('#mchips'), () => draw(true), true);
    $('#locate').onclick = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((p) => {
        const ll = [p.coords.latitude, p.coords.longitude];
        L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map);
        map.setView(ll, 8);
      }, () => toast('GPS ✕'));
    };
  }

  // ───────────── ROAD DETAIL ─────────────
  function viewRoad(id, user) {
    const r = byId[id];
    if (!r) return go('explore');
    const fav = Store.isFav(r.id), dr = Store.isDriven(r.id);
    const s = summit(r);
    const nearby = ROADS.filter((x) => x.id !== r.id).map((x) => [x, haversine(s, summit(x))]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    const gmaps = `https://www.google.com/maps/dir/${r.wp.map((p) => p.join(',')).join('/')}`;

    app.innerHTML = `
      <section class="detail">
        <div class="detail-hero">${roadArt(r, { w: 400, h: 360, num: r.no, stripes: true })}<div class="hero-shade"></div>
          <span class="plate" id="hero-plate">${dr ? CHK : ''}No.${r.no}</span>
          <button class="round-btn back" onclick="history.length > 1 ? history.back() : (location.hash='#explore')" aria-label="back">${icon('back')}</button>
          <div class="detail-title">
            <span class="kicker">${flag(r.country)} ${esc(r.region)}</span>
            <h1>${esc(r.name)}</h1>
            <div class="row gap">${diffBars(r.diff)}<span class="small">${t('diffLabels')[r.diff]}</span></div>
          </div>
        </div>

        <div class="actions">
          <button class="act ${fav ? 'on' : ''}" id="a-fav">${icon('heart')}<span>${fav ? t('removeFav') : t('addFav')}</span></button>
          <button class="act ${dr ? 'on' : ''}" id="a-drv">${icon('flag')}<span>${dr ? t('isDriven') : t('markDriven')}</span></button>
          <a class="act" href="${gmaps}" target="_blank" rel="noopener">${icon('external')}<span>${t('openMaps')}</span></a>
        </div>
        <div class="share-row">
          <button class="act share" id="a-share-road">${icon('share')}<span>${t('shareRoad')}</span></button>
          <button class="act share story" id="a-share-story">${icon('story')}<span>${t('sharePlate')}</span></button>
        </div>

        <section class="status" id="road-status" aria-live="polite"></section>

        <div class="stats">
          <div class="stat">${icon('mountain')}<b>${fmt(r.alt)}<small> m</small></b><span>${t('altitude')}</span></div>
          <div class="stat">${icon('road')}<b>${r.km}<small> km</small></b><span>${t('length')}</span></div>
          <div class="stat">${icon('hairpin')}<b>≈${r.hairpins}</b><span>${t('hairpins')}</span></div>
          <div class="stat">${icon('snow')}<b class="sm">${r.closure || '—'}</b><span>${r.closure ? t('closure') + ' ' + t('typical') : t('openAllYear')}</span></div>
          <div class="stat">${icon('euro')}<b class="sm">${r.toll ? t('yes') : t('no')}</b><span>${t('toll')}</span></div>
        </div>

        <div class="pad">
          <p class="desc">${esc(r[lang])}</p>
          <div class="tags">${r.tags.map((x) => `<span class="tag">#${esc(tag(x))}</span>`).join('')}</div>

          <h2 class="h2">${t('route')}</h2>
          <div class="mini-map" id="roadmap"></div>
          <p class="muted small" id="route-note">${t('routeLoading')}</p>

          <h2 class="h2">${t('reviews')} <span class="muted small" id="rv-sum"></span></h2>
          ${user ? `<form class="review-form" id="rv-form">
            <div class="row between"><span class="small">${t('yourRating')}</span><span class="stars input" id="rv-stars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i}"><svg viewBox="0 0 24 24">${I.star}</svg></button>`).join('')}</span></div>
            <textarea id="rv-text" rows="3" maxlength="500" placeholder="${t('reviewPh')}"></textarea>
            <div class="row between"><span class="muted xs">${Auth.cloud ? t('reviewPublic') : t('reviewLocal')}</span><button class="btn primary sm" type="submit">${t('publish')}</button></div>
          </form>` : `<button class="btn ghost rv-guest" id="rv-guest">${icon('star')} ${t('writeReview')}</button>`}
          <div id="rv-list"></div>

          <h2 class="h2">${t('nearby')}</h2>
          <div class="hscroll">${nearby.map(([x, km]) => `
            <article class="mini-card ${Store.isDriven(x.id) ? 'is-driven' : ''}" data-go="${x.id}">${roadArt(x, { w: 220, h: 130 })}
              <div><h4>${Store.isDriven(x.id) ? CHK : ''}${esc(x.name)}</h4><span class="muted xs">${Math.round(km)} km · ${fmt(x.alt)} m</span></div>
            </article>`).join('')}</div>

          <p class="disclaimer">${t('disclaimer')}</p>
        </div>
      </section>`;

    $$('[data-go]').forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
    $('#a-fav').onclick = (e) => {
      if (!user) return openJoinSheet('fav', r, { road: r.id, act: 'fav' });
      const on = Store.toggleFav(r.id);
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t('removeFav') : t('addFav');
    };
    $('#a-drv').onclick = (e) => {
      if (!user) return openJoinSheet('driven', r, { road: r.id, act: 'driven' });
      const on = Store.toggleDriven(r.id);
      $('#hero-plate').innerHTML = (on ? CHK : '') + 'No.' + r.no;
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t('isDriven') : t('markDriven');
      if (on) toast('🏁 ' + r.name);
    };
    $('#a-share-road').onclick = () => shareRoad(r);
    // la storia si può condividere sempre: con la placca "Strada guidata" se l'hai percorsa, "Strada da guidare" altrimenti
    $('#a-share-story').onclick = () => openStorySheet(r);

    // stato della strada: segnalazioni dei piloti + conferma ufficiale
    const renderStatus = () => {
      const box = $('#road-status');
      if (!box) return;
      const st = Store.roadStatus(r.id), mine = user ? Store.myRoadReport(r.id) : null;
      const who = st && (st.by === 'official'
        ? t('stOfficial') + (st.source ? ' · ' + esc(st.source) : '')
        : t(st.count === 1 ? 'stPilot1' : 'stPilots').replace('{n}', st.count));
      box.className = 'status ' + (st ? st.status : 'none');
      box.innerHTML = `
        <div class="st-head">
          <span class="st-dot" aria-hidden="true"></span>
          <div class="st-txt">
            <b>${st ? t(st.status === 'open' ? 'stOpen' : 'stClosed') : t('stUnknown')}</b>
            <span>${st ? `${who} · ${ago(st.at)}` : (r.closure ? `${t('closure')} ${t('typical')}: ${esc(r.closure)}` : t('openAllYear'))}</span>
          </div>
        </div>
        ${st && st.note ? `<p class="st-note">${esc(st.note)}</p>` : ''}
        <div class="st-ask">
          <span>${mine ? t('stYouSaid').replace('{s}', t(mine === 'open' ? 'stOpen' : 'stClosed').toLowerCase()) : t('stAsk')}</span>
          <div class="st-btns">
            <button class="st-btn open ${mine === 'open' ? 'on' : ''}" data-st="open">${t('stOpenBtn')}</button>
            <button class="st-btn closed ${mine === 'closed' ? 'on' : ''}" data-st="closed">${t('stClosedBtn')}</button>
          </div>
        </div>`;
      $$('[data-st]', box).forEach((b) => (b.onclick = async () => {
        if (!Auth.current()) return openJoinSheet('report', r);
        b.classList.add('loading');
        try { await Store.reportRoad(r.id, b.dataset.st); toast(t('stThanks')); renderStatus(); }
        catch (err) { b.classList.remove('loading'); toast(t(err.message === 'errRateLimit' ? 'errRateLimit' : 'syncError')); }
      }));
    };
    renderStatus();

    // recensioni
    let rating = 0;
    const paintStars = () => $$('#rv-stars button').forEach((b) => b.classList.toggle('on', +b.dataset.v <= rating));
    $$('#rv-stars button').forEach((b) => (b.onclick = () => { rating = +b.dataset.v; paintStars(); }));
    const renderReviews = () => {
      const list = Store.reviews(r.id), rt = Store.rating(r.id);
      $('#rv-sum').innerHTML = rt ? `${stars(rt.avg, 'sm')} ${rt.avg.toFixed(1)} · ${rt.count}` : '';
      $('#rv-list').innerHTML = list.length ? list.map((v) => `
        <div class="review">
          <div class="row between"><div><b>${esc(v.user)}</b> <span class="muted xs">${esc(v.car || '')}</span></div>${stars(v.rating, 'sm')}</div>
          <p>${esc(v.text)}</p>
          <div class="row between"><span class="muted xs">${v.date}</span>${v.mine
            ? `<button class="link xs" data-del="${v.id}">${t('deleteReview')}</button>`
            : `<button class="link xs rv-flag" data-flag="${v.id}">${t('reportReview')}</button>`}</div>
        </div>`).join('') : `<p class="empty">${t('noReviews')}</p>`;
      $$('[data-del]').forEach((b) => (b.onclick = () => { Store.deleteReview(r.id, b.dataset.del); renderReviews(); }));
      // segnala: due tocchi (il primo chiede conferma)
      $$('[data-flag]').forEach((b) => (b.onclick = async () => {
        if (!Auth.current()) return openJoinSheet('flag', r);
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('confirmReport'); setTimeout(() => { b.classList.remove('armed'); b.textContent = t('reportReview'); }, 4000); return; }
        try { await Store.reportReview(r.id, b.dataset.flag); toast(t('reported')); renderReviews(); }
        catch (err) { toast(t('syncError')); }
      }));
    };
    renderReviews();
    // online: scarica le recensioni aggiornate di tutti i piloti e ridisegna
    Store.loadReviews(r.id).then(() => { if ($('#rv-list') && location.hash === '#road-' + r.id) renderReviews(); });

    // senza account: invito al posto del modulo + promemoria dopo 3 strade viste
    if (!user) {
      $('#rv-guest').onclick = () => openJoinSheet('review', r);
      const views = lsGet('touge.guestViews', []);
      if (!views.includes(r.id)) { views.push(r.id); lsSet('touge.guestViews', views.slice(-50)); }
      if (views.length >= 3 && !lsGet('touge.reminded', false)) {
        lsSet('touge.reminded', true);
        setTimeout(() => { if (location.hash === '#road-' + r.id && !Auth.current()) openJoinSheet('remind', r); }, 1800);
      }
    }
    if (user) $('#rv-form').onsubmit = (e) => {
      e.preventDefault();
      const text = $('#rv-text').value;
      if (!rating || text.trim().length < 5) return toast(t('errReview'));
      Store.addReview(r.id, { rating, text });
      $('#rv-text').value = ''; rating = 0; paintStars(); renderReviews(); toast('✓ ' + t('publish'));
    };

    // mappa + tracciato
    if (window.L) {
      map = L.map('roadmap', { zoomControl: true, scrollWheelZoom: false, preferCanvas: true }).setView(s, 11);
      baseLayer(map, r.id);
      L.marker(r.wp[0], { icon: L.divIcon({ className: '', html: '<div class="wp start">A</div>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(map);
      L.marker(r.wp[r.wp.length - 1], { icon: L.divIcon({ className: '', html: '<div class="wp end">B</div>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(map);
      L.marker(s, { icon: markerIcon(r) }).addTo(map).bindTooltip(`${r.name} · ${fmt(r.alt)} m`);
      const thisMap = map;
      loadRoute(r).then(({ coords, approx }) => {
        if (map !== thisMap) return; // la vista è cambiata
        L.polyline(coords, { color: '#e2231a', weight: 10, opacity: 0.3 }).addTo(map);
        const line = L.polyline(coords, { color: '#e2231a', weight: 4, dashArray: approx ? '6 8' : null }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [24, 24] });
        $('#route-note').textContent = approx ? t('routeApprox') : 'Routing © OSRM · OpenStreetMap' + (OFFLINE_MAP ? ' · ' + t('roadbook') : '');
      });
    } else {
      $('#route-note').textContent = t('routeApprox');
    }
  }

  async function loadRoute(r) {
    if (r.noRouting) return { coords: r.wp, approx: true }; // strada non instradabile su OSRM (es. a pedaggio stagionale)
    const pre = (await allRoutes())[r.id]; // tracciati pre-calcolati (tools/build-data.ps1)
    if (pre && pre.length > 3) return { coords: pre, approx: false };
    const cached = Store.cachedRoute(r.id);
    if (cached) return { coords: cached, approx: false };
    if (OFFLINE_MAP) return { coords: r.wp, approx: true };
    try {
      const pts = r.wp.map(([la, ln]) => `${ln},${la}`).join(';');
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`, { signal: ctl.signal });
      clearTimeout(timer);
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error(j.code);
      const coords = j.routes[0].geometry.coordinates.map(([ln, la]) => [+la.toFixed(5), +ln.toFixed(5)]);
      Store.cacheRoute(r.id, coords);
      return { coords, approx: false };
    } catch (e) {
      return { coords: r.wp, approx: true };
    }
  }

  // ───────────── CONDIVISIONE ─────────────
  function roadLink(r) { return location.origin + location.pathname + '#road-' + r.id; }

  // link a una strada: menu Condividi del telefono, altrimenti copia negli appunti
  function shareRoad(r) {
    const url = roadLink(r);
    const data = { title: `${r.name} · TOUGE`, text: t('shareRoadText').replace('{name}', r.name), url };
    if (navigator.share) {
      navigator.share(data).catch((e) => { if (e && e.name !== 'AbortError') copyLink(url); });
    } else copyLink(url);
  }
  function copyLink(url) {
    const done = () => toast(t('linkCopied'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => toast(url));
    else toast(url);
  }

  // Cartolina: stile (Retrò / Vaporwave / Cyberpunk) + elementi accendibili, poi Instagram o Salva PNG/SVG.
  // La storia per Instagram viene preparata in anticipo: su iPhone navigator.share va chiamato subito al tocco.
  const PC_KEY = 'touge.postcard';
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function openStorySheet(r) {
    const TS = window.TougeShare;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PC_KEY)) || {}; } catch (e) { /* niente preferenze */ }
    let style = TS.STYLES.includes(saved.style) ? saved.style : 'vapor';
    const els = { stamp: true, postmark: true, greet: true, plate: true };
    if (saved.els) TS.ELEMENTS.forEach((k) => { if (typeof saved.els[k] === 'boolean') els[k] = saved.els[k]; });
    const info = {
      drivenAt: Store.driven()[r.id], plateLabel: Store.isDriven(r.id) ? t('driven') : t('markDriven'), hairpinsLabel: t('hairpins'),
      region: r.region, country: cname(r.country), tagline: t('tagline'), greet: t('pcGreet'),
    };

    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap story-sheet';
    wrap.innerHTML = `
      <div class="sheet-bg" data-close></div>
      <div class="sheet pc-sheet" role="dialog" aria-label="${t('pcTitle')}">
        <div class="sheet-head"><h2 class="h2">${t('pcTitle')}</h2><button class="link" data-close>${t('close')}</button></div>
        <div class="pc-styles">
          <button class="pc-arrow" data-step="-1" aria-label="${t('pcPrev')}">‹</button>
          <div class="pc-style-row" role="tablist">${TS.STYLES.map((s) => `<button class="pc-style" role="tab" data-style="${s}">${t('pcStyle_' + s)}</button>`).join('')}</div>
          <button class="pc-arrow" data-step="1" aria-label="${t('pcNext')}">›</button>
        </div>
        <div class="pc-preview" id="pc-prev"><span class="kicker">${t('preparing')}</span></div>
        <div class="pc-els">${TS.ELEMENTS.map((k) => `<button class="chip pc-el" data-el="${k}">${t('pcEl_' + k)}</button>`).join('')}</div>
        <div class="pc-actions" id="pc-actions">
          <button class="btn pc-ig" id="pc-ig">${icon('story')} Instagram</button>
          <button class="btn pc-save" id="pc-save" aria-label="${t('saveImage')}">${t('pcSave')} <span aria-hidden="true">▾</span></button>
          <button class="btn pc-fmt" data-fmt="png">PNG</button>
          <button class="btn pc-fmt" data-fmt="svg">SVG</button>
          <button class="btn pc-fmt pc-x" data-fmt="" aria-label="${t('close')}">✕</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 250); };
    $$('[data-close]', wrap).forEach((b) => (b.onclick = close));

    const prev = $('#pc-prev', wrap), actions = $('#pc-actions', wrap), igBtn = $('#pc-ig', wrap);
    let story = null; // { key, promise, blob }
    const key = () => style + JSON.stringify(els);
    const prepareStory = () => {
      const k = key();
      if (story && story.key === k) return story;
      const s = { key: k, blob: null };
      s.promise = TS.storyPng(r, info, style, els).then((b) => (s.blob = b));
      s.promise.catch(() => {});
      return (story = s);
    };
    let storyTimer = 0;
    const draw = () => {
      prev.innerHTML = TS.preview(r, info, style, els);
      $$('.pc-style', wrap).forEach((b) => { const on = b.dataset.style === style; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      $$('.pc-el', wrap).forEach((b) => { b.classList.toggle('on', !!els[b.dataset.el]); b.setAttribute('aria-pressed', !!els[b.dataset.el]); });
      try { localStorage.setItem(PC_KEY, JSON.stringify({ style, els })); } catch (e) { /* ok */ }
      clearTimeout(storyTimer); storyTimer = setTimeout(prepareStory, 500);
    };
    const step = (dir) => { const L = TS.STYLES; style = L[(L.indexOf(style) + dir + L.length) % L.length]; draw(); };

    $$('.pc-style', wrap).forEach((b) => (b.onclick = () => { style = b.dataset.style; draw(); }));
    $$('.pc-arrow', wrap).forEach((b) => (b.onclick = () => step(+b.dataset.step)));
    $$('.pc-el', wrap).forEach((b) => (b.onclick = () => { els[b.dataset.el] = !els[b.dataset.el]; draw(); }));
    // scorrere sull'anteprima cambia stile
    let x0 = null;
    prev.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    prev.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    });

    // Instagram: foglio di condivisione del telefono con la storia 9:16 (lì si sceglie Instagram)
    igBtn.onclick = async () => {
      const s = prepareStory();
      const name = `touge-${r.id}-story.png`;
      const shareNow = (blob) => {
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file] }).catch((e) => {
            if (e && e.name === 'NotAllowedError') toast(t('pcTapAgain'));
            else if (e && e.name !== 'AbortError') toast(t('storyError'));
          });
        }
        downloadBlob(blob, name); toast(t('pcIgFallback'));
      };
      if (s.blob) return shareNow(s.blob);
      igBtn.classList.add('loading');
      try { shareNow(await s.promise); } catch (e) { toast(t('storyError')); } finally { igBtn.classList.remove('loading'); }
    };
    // Salva → scelta PNG / SVG
    $('#pc-save', wrap).onclick = () => actions.classList.add('choose');
    $$('.pc-fmt', wrap).forEach((b) => (b.onclick = async () => {
      const fmt = b.dataset.fmt;
      if (!fmt) { actions.classList.remove('choose'); return; }
      b.classList.add('loading');
      try {
        const blob = fmt === 'svg' ? await TS.postcardSvg(r, info, style, els) : await TS.postcardPng(r, info, style, els);
        downloadBlob(blob, `touge-${r.id}-${style}.${fmt}`);
        toast(t('imageSaved'));
        actions.classList.remove('choose');
      } catch (e) { toast(t('storyError')); } finally { b.classList.remove('loading'); }
    }));

    try { await TS.ready(); draw(); } catch (e) { prev.innerHTML = `<p class="empty">${t('storyError')}</p>`; }
  }

  // ───────────── GARAGE ─────────────
  let garageTab = 'fav';
  function viewGarage() {
    const drivenIds = Object.keys(Store.driven()).filter((id) => byId[id]);
    const pct = drivenIds.length / ROADS.length;
    const C = 2 * Math.PI * 52;
    const kmTot = ROADS.reduce((s, r) => s + r.km, 0);
    const kmDone = drivenIds.reduce((s, id) => s + byId[id].km, 0);
    const kmPct = kmTot ? kmDone / kmTot : 0;
    app.innerHTML = `
      <header class="top"><h1 class="h1">${t('garage')}</h1></header>
      <div class="progress-row">
        <section class="progress-card">
          <svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg>
          <div class="ring-label"><b>${drivenIds.length}</b><span>${t('of')} ${ROADS.length}</span></div>
          <div><span class="kicker">${t('progress')}</span><h2>${Math.round(pct * 100)}%</h2><p class="muted small">${t('roadsDriven')}</p></div>
        </section>
        <section class="progress-card km">
          <svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="${(C * kmPct).toFixed(1)} ${C.toFixed(1)}"/></svg>
          <div class="ring-label"><b>${Math.round(kmPct * 100)}%</b><span>${t('of')} ${fmt(kmTot)} km</span></div>
          <div><span class="kicker">${t('kmTitle')}</span><h2>${fmt(kmDone)}<small> km</small></h2><p class="muted small">${t('kmDrivenSub')}</p></div>
        </section>
      </div>
      <div class="seg">
        <button class="${garageTab === 'fav' ? 'on' : ''}" data-t="fav">${icon('heart')} ${t('favorites')} (${Store.favorites().filter((id) => byId[id]).length})</button>
        <button class="${garageTab === 'drv' ? 'on' : ''}" data-t="drv">${icon('flag')} ${t('drivenList')} (${drivenIds.length})</button>
      </div>
      <div class="grid" id="glist"></div>`;
    const render = () => {
      const ids = garageTab === 'fav' ? Store.favorites() : drivenIds;
      const list = ids.map((id) => byId[id]).filter(Boolean);
      $('#glist').innerHTML = list.length ? list.map(roadCard).join('') : `<p class="empty">${garageTab === 'fav' ? t('emptyFav') : t('emptyDriven')}</p>`;
      bindCards($('#glist'));
    };
    $$('.seg button').forEach((b) => (b.onclick = () => { garageTab = b.dataset.t; viewGarage(); }));
    render();
  }

  // ───────────── PROFILE ─────────────
  function computeStats(user) {
    const driven = Object.keys(Store.driven()).map((id) => byId[id]).filter(Boolean);
    return {
      count: driven.length,
      km: driven.reduce((s, r) => s + r.km, 0),
      maxAlt: driven.reduce((m, r) => Math.max(m, r.alt), 0),
      hair: driven.reduce((s, r) => s + r.hairpins, 0),
      countries: new Set(driven.map((r) => r.country)).size,
      legends: driven.filter((r) => r.tags.includes('leggenda')).length,
      reviews: Store.myReviewCount(user.email),
    };
  }

  function viewProfile(_, user) {
    const st = computeStats(user);
    const badges = [
      ['b_first', '🏁', st.count >= 1], ['b_five', '🗂️', st.count >= 5], ['b_2500', '☁️', st.maxAlt >= 2500],
      ['b_hair', '🌀', st.hair >= 200], ['b_countries', '🌍', st.countries >= 3], ['b_legend', '👑', st.legends >= 5], ['b_critic', '✍️', st.reviews >= 3],
    ];
    const since = new Date(user.createdAt).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' });
    app.innerHTML = `
      <section class="license">
        <div class="license-band"><span>${t('license')}</span><span>走り屋</span></div>
        <div class="license-body">
          ${avatar(user, 78)}
          <div><h1 class="h1">${esc(user.name)}</h1><p>${t('car').toUpperCase()}: ${esc(user.car || '—')}</p><p>${t('memberSince').toUpperCase()}: ${since}</p></div>
        </div>
        <div class="livery"></div>
      </section>

      <h2 class="h2 pad-x">${t('stats')}</h2>
      <div class="stats four">
        <div class="stat"><b>${st.count}</b><span>${t('roadsDriven')}</span></div>
        <div class="stat"><b>${fmt(st.km)}</b><span>${t('kmDriven')}</span></div>
        <div class="stat"><b>${st.maxAlt ? fmt(st.maxAlt) : '—'}</b><span>${t('maxAlt')}</span></div>
        <div class="stat"><b>${fmt(st.hair)}</b><span>${t('hairpinsDone')}</span></div>
      </div>

      <h2 class="h2 pad-x">${t('badges')}</h2>
      <div class="badges">${badges.map(([k, e, ok]) => `<div class="bdg ${ok ? 'ok' : ''}"><span class="e">${e}</span><b>${t(k)}</b><small>${t(k + '_d')}</small></div>`).join('')}</div>

      <h2 class="h2 pad-x">${t('settings')}</h2>
      <div class="menu">
        <div class="menu-item">${icon('globe')}<span>${t('language')}</span>${langSwitch()}</div>
        <a class="menu-item" href="#intro">${icon('explore')}<span>${t('whatIsTouge')}</span></a>
        <a class="menu-item" href="#privacy">${icon('check')}<span>${t('privacy')}</span></a>
        <button class="menu-item" id="m-edit">${icon('edit')}<span>${t('editProfile')}</span></button>
        <form class="edit-form" id="edit-form" hidden>
          ${field('name', t('name'), 'text', t('namePh'))}
          ${field('car', t('car'), 'text', t('carPh'))}
          <button class="btn primary sm" type="submit">${t('save')}</button>
        </form>
        <button class="menu-item" id="m-logout">${icon('logout')}<span>${t('logout')}</span></button>
        <button class="menu-item danger" id="m-del">${icon('trash')}<span>${t('deleteAccount')}</span></button>
      </div>
      <p class="disclaimer pad-x">TOUGE App v1.0 · ${t('disclaimer')}</p>`;

    bindLangSwitch();
    const ef = $('#edit-form');
    ef.name.value = user.name; ef.car.value = user.car || '';
    $('#m-edit').onclick = () => (ef.hidden = !ef.hidden);
    ef.onsubmit = async (e) => {
      e.preventDefault();
      if (!ef.name.value.trim()) return toast(t('errName'));
      await Auth.update({ name: ef.name.value.trim(), car: ef.car.value.trim() });
      toast(t('saved')); route();
    };
    $('#m-logout').onclick = async () => { await Auth.logout(); go('explore'); };
    // conferma in due tocchi dentro la pagina (confirm() non è disponibile ovunque)
    let armed = null;
    $('#m-del').onclick = (e) => {
      const btn = e.currentTarget;
      if (armed) { clearTimeout(armed); armed = null; Auth.deleteAccount().then(() => go('explore'), () => toast(t('errNetwork'))); return; }
      btn.querySelector('span').textContent = t('confirmDeleteTap');
      btn.classList.add('armed');
      armed = setTimeout(() => { armed = null; btn.classList.remove('armed'); btn.querySelector('span').textContent = t('deleteAccount'); }, 4000);
    };
  }

  // ───────────── avvio ─────────────
  window.addEventListener('hashchange', route);
  // avvio: in parallelo all'animazione si ripristina la sessione (online: da Supabase)
  const ready = Promise.resolve().then(() => Auth.init()).catch((e) => console.warn('[TOUGE init]', e));
  window.addEventListener('touge:recovery', () => go('reset'));
  let lastSyncToast = 0;
  window.addEventListener('touge:sync-error', () => { if (Date.now() - lastSyncToast > 8000) { lastSyncToast = Date.now(); toast(t('syncError')); } });
  viewSplash(() => ready.then(route));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.TOUGE_ARTIFACT) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
