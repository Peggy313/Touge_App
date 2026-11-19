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
  const filters = { q: '', country: 'ALL', diff: [], sort: 'name', open: false, noToll: false };

  const t = (k) => (I18N[lang] && I18N[lang][k] != null ? I18N[lang][k] : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tag = (k) => (TAGS[k] ? TAGS[k][lang === 'it' ? 0 : 1] : k);
  const cname = (c) => COUNTRIES[c][lang];
  const FLAGS = {
    IT: '<rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/>',
    FR: '<rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/>',
    AT: '<rect width="3" height="2" fill="#ed2939"/><rect y=".667" width="3" height=".667" fill="#fff"/>',
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
    $$('.stamp text[data-fit]', root || document).forEach((el) => {
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

  function roadOfDay() {
    const d = new Date();
    const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    return ROADS[n % ROADS.length];
  }

  // ───────────── router ─────────────
  // Flusso: splash animato all'apertura → accesso/registrazione → app.
  // "intro" è la landing page di presentazione, raggiungibile da accesso e da Pilota.
  const PUBLIC = ['login', 'register', 'forgot'];
  const OPEN = ['intro'];

  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || '';
    const name = hash.startsWith('road-') ? 'road' : hash; const param = name === 'road' ? hash.slice(5) : '';
    const user = Auth.current();

    if (map) { map.remove(); map = null; }
    document.documentElement.lang = lang;

    if (name === 'welcome') return go('intro'); // vecchi link
    if (!user && !PUBLIC.includes(name) && !OPEN.includes(name)) return go('intro');
    if (user && (PUBLIC.includes(name) || !name)) return go('explore');

    const views = { intro: viewIntro, login: viewLogin, register: viewRegister, forgot: viewForgot, explore: viewExplore, map: viewMap, road: viewRoad, garage: viewGarage, profile: viewProfile };
    const view = views[name];
    if (!view) return go(user ? 'explore' : 'login');

    const isAuth = PUBLIC.includes(name) || OPEN.includes(name);
    tabbar.hidden = isAuth;
    document.body.classList.toggle('auth-mode', isAuth);
    document.documentElement.classList.toggle('auth-mode', isAuth);
    document.body.classList.toggle('map-mode', name === 'map');
    view(param, user);
    if (!isAuth) renderTabbar(name === 'road' ? 'explore' : name);
    if (name !== 'map') window.scrollTo(0, 0);
  }
  function go(path) { location.hash = '#' + path; }

  function renderTabbar(active) {
    const tabs = ['explore', 'map', 'garage', 'profile'];
    tabbar.innerHTML = tabs.map((k) => `<a href="#${k}" class="tab ${k === active ? 'active' : ''}">${icon(k)}<span>${t(k)}</span></a>`).join('');
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
        </div>
      </section>`;
    const finish = () => { if (user) Store.setIntroSeen(); go(user ? 'explore' : 'login'); };
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
      $('#in-next').textContent = i === slides.length - 1 ? (user ? t('startDriving') : t('enterApp')) : t('next');
    };
    $('#in-next').onclick = () => { if (i < slides.length - 1) { i++; render(); } else finish(); };
    $('#in-skip').onclick = finish;
    render();
  }

  function langSwitch() {
    return `<div class="lang-switch">${['it', 'en'].map((l) => `<button data-lang="${l}" class="${l === lang ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>`;
  }
  function bindLangSwitch() {
    $$('[data-lang]').forEach((b) => (b.onclick = () => { lang = b.dataset.lang; Store.setLang(lang); route(); }));
  }

  function authShell(title, sub, form, foot) {
    const r = ROADS[Math.floor(Math.random() * ROADS.length)];
    app.innerHTML = `
      <section class="auth">
        <div class="auth-art">${roadArt(r, { w: 400, h: 300, num: r.no, stripes: true })}
          <div class="auth-top">${LOGO}${langSwitch()}</div>
        </div>
        <div class="auth-card">
          <div class="form-tab"><span>${t('entryForm')}</span></div>
          <h1>${title}</h1>
          <p class="muted">${sub}</p>
          <form id="auth-form" novalidate>${form}<p class="form-error" id="form-error" role="alert"></p></form>
          <div class="auth-foot">${foot}</div>
        </div>
      </section>`;
    bindLangSwitch();
    return $('#auth-form');
  }
  const field = (name, label, type, ph, auto, extra) => `<div class="field"><div class="field-top"><label for="f-${name}">${label}</label>${extra || ''}</div><input id="f-${name}" name="${name}" type="${type}" placeholder="${ph || ''}" autocomplete="${auto || 'off'}" /></div>`;
  const showErr = (k) => { $('#form-error').textContent = k ? t(k) : ''; };
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function viewLogin() {
    const f = authShell(t('welcomeBack'), t('loginSub'),
      field('email', t('email'), 'email', 'nome@email.it', 'email') +
      field('password', t('password'), 'password', '••••••', 'current-password', `<a href="#forgot" class="link">${t('forgot')}</a>`) +
      `<button class="btn primary" type="submit">${t('login')}</button>`,
      `<span>${t('noAccount')} <a href="#register" class="link">${t('register')}</a></span>`);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!validEmail(d.email)) return showErr('errEmail');
      try { const u = await Auth.login(d.email, d.password); toast(`${t('hello')}, ${u.name}!`); go('explore'); }
      catch (err) { showErr(err.message); }
    };
  }

  function viewRegister() {
    const f = authShell(t('createAccount'), t('registerSub'),
      `<div class="field-row">${field('name', t('name'), 'text', t('namePh'), 'nickname')}${field('car', t('car'), 'text', t('carPh'))}</div>` +
      field('email', t('email'), 'email', 'nome@email.it', 'email') +
      `<div class="field-row">${field('password', t('password'), 'password', '••••••', 'new-password')}${field('password2', t('confirmShort'), 'password', '••••••', 'new-password')}</div>` +
      `<label class="check"><input type="checkbox" name="terms" id="f-terms" /><span>${t('acceptTerms')}</span></label>
       <button class="btn primary" type="submit">${t('register')}</button>`,
      `<span>${t('yesAccount')} <a href="#login" class="link">${t('login')}</a></span>`);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!d.name.trim()) return showErr('errName');
      if (!validEmail(d.email)) return showErr('errEmail');
      if (d.password.length < 6) return showErr('errPwd');
      if (d.password !== d.password2) return showErr('errMatch');
      if (!d.terms) return showErr('errTerms');
      try { const u = await Auth.register(d); toast(`${t('hello')}, ${u.name}!`); go('explore'); }
      catch (err) { showErr(err.message); }
    };
  }

  function viewForgot() {
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

  // ───────────── EXPLORE ─────────────
  function applyFilters() {
    const q = filters.q.trim().toLowerCase();
    let list = ROADS.filter((r) => {
      if (filters.country !== 'ALL' && r.country !== filters.country) return false;
      if (filters.diff.length && !filters.diff.includes(r.diff)) return false;
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

  function roadCard(r) {
    const fav = Store.isFav(r.id), dr = Store.isDriven(r.id), rt = Store.rating(r.id);
    return `
      <article class="card ${dr ? 'is-driven' : ''}" data-go="${r.id}">
        <div class="card-art">${roadArt(r, { w: 320, h: 190, num: r.no })}
          <span class="plate">${dr ? CHK : ''}No.${r.no}</span>
          <span class="card-alt">${fmt(r.alt)}<small>m</small></span>
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
      const on = Store.toggleFav(b.dataset.fav);
      b.classList.toggle('on', on);
      toast(on ? '♥ ' + byId[b.dataset.fav].name : t('removeFav') + ' ✕');
    }));
    $$('[data-go]', root).forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
  }

  function viewExplore(_, user) {
    const rod = roadOfDay();
    const countries = ['ALL', ...Object.keys(COUNTRIES)];
    app.innerHTML = `
      <header class="top">
        <div><p class="muted small">${t('exploreSub')}</p><h1 class="h1">${t('hello')}, ${esc(user.name)}</h1></div>
        <a href="#profile" aria-label="${t('profile')}">${avatar(user, 44)}</a>
      </header>
      <div class="search-row">
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="${t('search')}" value="${esc(filters.q)}" /></label>
        <button class="icon-btn ${filters.diff.length || filters.open || filters.noToll || filters.sort !== 'name' ? 'dot' : ''}" id="open-filters" aria-label="${t('filters')}">${icon('sliders')}</button>
      </div>
      <div class="chips" id="chips">${countries.map((c) => `<button class="chip ${filters.country === c ? 'on' : ''}" data-c="${c}">${c === 'ALL' ? t('all') : flag(c) + ' ' + cname(c)}</button>`).join('')}</div>

      <section class="featured ${Store.isDriven(rod.id) ? 'is-driven' : ''}" data-go="${rod.id}">
        ${roadArt(rod, { w: 400, h: 230, num: rod.no, stripes: true })}
        <span class="plate">${Store.isDriven(rod.id) ? CHK : ''}No.${rod.no}</span>
        <div class="featured-info">
          <span class="kicker">峠 ${t('roadOfDay')}</span>
          <h2>${esc(rod.name)}</h2>
          <p>${flag(rod.country)} ${esc(rod.region)} · ${fmt(rod.alt)} m · ≈${rod.hairpins} ${t('hairpins').toLowerCase()}</p>
        </div>
      </section>

      <div class="list-head"><h2 class="h2">${t('explore')}</h2><span class="muted small" id="count"></span></div>
      <div class="grid" id="list"></div>
      <div class="sheet-wrap" id="sheet" hidden></div>`;

    const renderList = () => {
      const list = applyFilters();
      $('#count').textContent = `${list.length} ${t('results')}`;
      $('#list').innerHTML = list.length ? list.map(roadCard).join('') : `<p class="empty">${t('noResults')}</p>`;
      bindCards($('#list'));
    };
    renderList();
    $('.featured').onclick = () => go('road-' + rod.id);

    $('#q').oninput = (e) => { filters.q = e.target.value; renderList(); };
    $$('#chips .chip').forEach((b) => (b.onclick = () => {
      filters.country = b.dataset.c;
      $$('#chips .chip').forEach((x) => x.classList.toggle('on', x === b));
      renderList();
    }));
    $('#open-filters').onclick = () => openFilterSheet(() => { renderList(); $('#open-filters').classList.toggle('dot', !!(filters.diff.length || filters.open || filters.noToll || filters.sort !== 'name')); });
  }

  function openFilterSheet(onApply) {
    const sh = $('#sheet');
    const sorts = [['name', 'sortName'], ['alt', 'sortAlt'], ['km', 'sortKm'], ['hair', 'sortHair'], ['rating', 'sortRating']];
    sh.innerHTML = `
      <div class="sheet-bg" data-close></div>
      <div class="sheet" role="dialog" aria-label="${t('filters')}">
        <div class="sheet-grab"></div>
        <div class="sheet-head"><h2 class="h2">${t('filters')}</h2><button class="link" id="f-reset">${t('reset')}</button></div>
        <h4>${t('difficulty')}</h4>
        <div class="chips wrap">${[1, 2, 3, 4, 5].map((d) => `<button class="chip ${filters.diff.includes(d) ? 'on' : ''}" data-d="${d}">${diffBars(d)} ${t('diffLabels')[d]}</button>`).join('')}</div>
        <h4>${t('sort')}</h4>
        <div class="chips wrap">${sorts.map(([v, k]) => `<button class="chip ${filters.sort === v ? 'on' : ''}" data-s="${v}">${t(k)}</button>`).join('')}</div>
        <label class="toggle"><span>${t('onlyOpen')}</span><input type="checkbox" id="f-open" ${filters.open ? 'checked' : ''}/><i></i></label>
        <label class="toggle"><span>${t('noToll')}</span><input type="checkbox" id="f-toll" ${filters.noToll ? 'checked' : ''}/><i></i></label>
        <button class="btn primary" data-close>OK</button>
      </div>`;
    sh.hidden = false;
    requestAnimationFrame(() => sh.classList.add('open'));
    const close = () => { sh.classList.remove('open'); setTimeout(() => (sh.hidden = true), 250); onApply(); };
    $$('[data-close]', sh).forEach((b) => (b.onclick = close));
    $$('[data-d]', sh).forEach((b) => (b.onclick = () => {
      const d = +b.dataset.d;
      filters.diff = filters.diff.includes(d) ? filters.diff.filter((x) => x !== d) : [...filters.diff, d];
      b.classList.toggle('on'); onApply();
    }));
    $$('[data-s]', sh).forEach((b) => (b.onclick = () => {
      filters.sort = b.dataset.s;
      $$('[data-s]', sh).forEach((x) => x.classList.toggle('on', x === b)); onApply();
    }));
    $('#f-open', sh).onchange = (e) => { filters.open = e.target.checked; onApply(); };
    $('#f-toll', sh).onchange = (e) => { filters.noToll = e.target.checked; onApply(); };
    $('#f-reset', sh).onclick = () => { Object.assign(filters, { diff: [], sort: 'name', open: false, noToll: false }); close(); openFilterSheet(onApply); };
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
        <div class="chips" id="mchips">${['ALL', ...Object.keys(COUNTRIES)].map((c) => `<button class="chip glass ${filters.country === c ? 'on' : ''}" data-c="${c}">${c === 'ALL' ? t('all') : flag(c) + ' ' + cname(c)}</button>`).join('')}</div>
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
      const list = ROADS.filter((r) => filters.country === 'ALL' || r.country === filters.country);
      list.forEach((r) => {
        const dr = Store.isDriven(r.id);
        const m = L.marker(summit(r), { icon: markerIcon(r), title: r.name, zIndexOffset: dr ? 500 : 0 }).addTo(layer);
        m.bindPopup(`<div class="pop">${dr ? `<span class="pop-driven">${CHK} ${t('driven')}</span>` : ''}<strong>${esc(r.name)}</strong><span>${flag(r.country)} ${esc(r.region)}</span><span>${fmt(r.alt)} m · ${r.km} km · ≈${r.hairpins} ${t('hairpins').toLowerCase()}</span><a href="#road-${r.id}" class="btn primary sm">${t('route')} →</a></div>`);
      });
      if (fit && list.length) map.fitBounds(L.latLngBounds(list.map(summit)), { padding: [40, 40], maxZoom: 9 });
    };
    draw(true);
    $$('#mchips .chip').forEach((b) => (b.onclick = () => {
      filters.country = b.dataset.c;
      $$('#mchips .chip').forEach((x) => x.classList.toggle('on', x === b));
      draw(true);
    }));
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
          <form class="review-form" id="rv-form">
            <div class="row between"><span class="small">${t('yourRating')}</span><span class="stars input" id="rv-stars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i}"><svg viewBox="0 0 24 24">${I.star}</svg></button>`).join('')}</span></div>
            <textarea id="rv-text" rows="3" maxlength="500" placeholder="${t('reviewPh')}"></textarea>
            <div class="row between"><span class="muted xs">${t('reviewLocal')}</span><button class="btn primary sm" type="submit">${t('publish')}</button></div>
          </form>
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
      const on = Store.toggleFav(r.id);
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t('removeFav') : t('addFav');
    };
    $('#a-drv').onclick = (e) => {
      const on = Store.toggleDriven(r.id);
      $('#hero-plate').innerHTML = (on ? CHK : '') + 'No.' + r.no;
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t('isDriven') : t('markDriven');
      if (on) toast('🏁 ' + r.name);
    };

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
          <div class="row between"><span class="muted xs">${v.date}</span>${v.local && v.email === user.email ? `<button class="link xs" data-del="${v.id}">${t('deleteReview')}</button>` : ''}</div>
        </div>`).join('') : `<p class="empty">${t('noReviews')}</p>`;
      $$('[data-del]').forEach((b) => (b.onclick = () => { Store.deleteReview(r.id, b.dataset.del); renderReviews(); }));
    };
    renderReviews();
    $('#rv-form').onsubmit = (e) => {
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
    ef.onsubmit = (e) => {
      e.preventDefault();
      if (!ef.name.value.trim()) return toast(t('errName'));
      Auth.update({ name: ef.name.value.trim(), car: ef.car.value.trim() });
      toast(t('saved')); route();
    };
    $('#m-logout').onclick = () => { Auth.logout(); go('login'); };
    // conferma in due tocchi dentro la pagina (confirm() non è disponibile ovunque)
    let armed = null;
    $('#m-del').onclick = (e) => {
      const btn = e.currentTarget;
      if (armed) { clearTimeout(armed); Auth.deleteAccount(); go('login'); return; }
      btn.querySelector('span').textContent = t('confirmDeleteTap');
      btn.classList.add('armed');
      armed = setTimeout(() => { armed = null; btn.classList.remove('armed'); btn.querySelector('span').textContent = t('deleteAccount'); }, 4000);
    };
  }

  // ───────────── avvio ─────────────
  window.addEventListener('hashchange', route);
  viewSplash(route);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.TOUGE_ARTIFACT) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
