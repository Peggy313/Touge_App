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
  // time: minuti massimi di guida da "Da dove parti" (0 = nessun limite)
  const filters = { q: '', sel: { exp: [], country: [], diff: [], len: [], hair: [], alt: [] }, sort: 'name', open: false, noToll: false, time: 0 };

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
    go: '<path d="M21.5 2.5 2.5 10.4l7.6 3.5 3.5 7.6 7.9-19Z"/>',
    story: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm5.3-4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/>',
  };
  I.bell = '<path d="M12 2a1.5 1.5 0 0 0-1.5 1.5v.7A6.5 6.5 0 0 0 5.5 10.5V15L3.5 17.5V19h17v-1.5L18.5 15v-4.5a6.5 6.5 0 0 0-5-6.3v-.7A1.5 1.5 0 0 0 12 2Zm-2.5 18a2.5 2.5 0 0 0 5 0h-5Z"/>';
  I.plus ='<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z"/>';
  I.route = '<path d="M6 2.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM9 4.5v2h9a1.5 1.5 0 0 1 0 3H6a3.5 3.5 0 0 0 0 7h9v-2H6a1.5 1.5 0 0 1 0-3h12a3.5 3.5 0 0 0 0-7H9Z"/>';
  I.camera ='<path d="M9 3 7.2 5.5H4A2 2 0 0 0 2 7.5V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>';
  I.clock ='<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.7-4-2.4V7h-2Z"/>';
  I.spark = '<path d="M12 1.5c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9Z"/><path d="M19.5 15.5c.4 2.3 1.5 3.4 3.5 3.8-2 .4-3.1 1.5-3.5 3.7-.4-2.2-1.5-3.3-3.5-3.7 2-.4 3.1-1.5 3.5-3.8Z"/>';
  // meteo (icone piene, a un colore)
  const CLOUD = (y) => `<path d="M6.5 ${19 - y}a4.5 4.5 0 0 1-.6-9A6.5 6.5 0 0 1 18.3 ${9 - y}a5 5 0 0 1-.3 ${10}H6.5Z"/>`;
  const WX = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4zM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z"/>',
    part: '<circle cx="8" cy="8" r="3.4"/><path d="M7 .8h2v2.6H7zM.8 7h2.6v2H.8zM2.4 3.8l1.4-1.4 1.8 1.8-1.4 1.4zM12.2 2.4l1.4 1.4-1.8 1.8-1.4-1.4z"/><path d="M8.5 21.5a4 4 0 0 1-.5-8 5.8 5.8 0 0 1 11-.1 4.1 4.1 0 0 1 0 8.1H8.5Z" stroke="var(--wx-bg, #f3ead8)" stroke-width="1.6"/>',
    cloud: CLOUD(0),
    fog: '<path d="M3 6h18v2.2H3zM5 10.6h14v2.2H5zM3 15.2h18v2.2H3zM7 19.8h10V22H7z"/>',
    rain: CLOUD(4) + '<path d="M7 17h2.2l-1.6 5H5.4zM11.9 17h2.2l-1.6 5h-2.2zM16.8 17H19l-1.6 5h-2.2z"/>',
    snow: CLOUD(4) + '<circle cx="7.5" cy="19" r="1.6"/><circle cx="12" cy="21.4" r="1.6"/><circle cx="16.5" cy="19" r="1.6"/>',
    storm: CLOUD(4) + '<path d="M11.2 15.5h4.3l-2 3.2h3L10 24l1.7-4.1H9z"/>',
  };
  const icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const wxIcon = (k) => `<svg class="ic wx-ic" viewBox="0 0 24 24" role="img" aria-label="${t('wxK')[k] || ''}">${WX[k] || ''}</svg>`;

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
  // con la foto verificata (posizione vicina al tracciato) la scritta diventa "VERIFICATO"
  function drivenPlate(r, verified) {
    if (verified == null) verified = !!(Store.isVerified && Store.isVerified(r.id));
    const label = t(verified ? 'verified' : 'driven');
    const d = new Date(Store.driven()[r.id] || Date.now());
    const ddmm = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    // Geometria ricalcata sulla placca di riferimento (504×226): spalle a y=60, cupola ellittica
    // da x=91 a x=411, riquadro crema 150×68, scritta in basso alta quasi metà placca.
    const shape = 'M8 60 L91 60 A160 60 0 0 1 411 60 L494 60 Q502 60 502 68 L502 218 Q502 226 494 226 L8 226 Q0 226 0 218 L0 68 Q0 60 8 60 Z';
    return `<svg viewBox="-6 -6 514 238" aria-label="${esc(label)} ${ddmm}/${d.getFullYear()}">
      <path d="${shape}" fill="#e3262c" stroke="#f6efe0" stroke-width="8" paint-order="stroke" stroke-linejoin="round"/>
      <rect x="172" y="16" width="158" height="70" rx="8" fill="#f6efe0"/>
      <text x="251" y="77" text-anchor="middle" class="pl-num" data-fit="136">${r.no}</text>
      <text x="164" y="92" text-anchor="end" class="pl-side" data-fit="74">${ddmm}</text>
      <text x="338" y="92" text-anchor="start" class="pl-side" data-fit="74">${d.getFullYear()}</text>
      <text x="251" y="205" text-anchor="middle" class="pl-title" data-fit="470" data-fill="1">${esc(label.toUpperCase())}</text>
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

  // user.photoUrl (già un indirizzo) oppure user.photo (riferimento salvato nel profilo)
  function avatar(user, size) {
    const url = user.photoUrl != null ? user.photoUrl : user.photo ? Store.photoUrl(user.photo) : '';
    if (url) return `<div class="avatar photo" style="--s:${size || 44}px"><img src="${esc(url)}" alt="" loading="lazy" decoding="async" /></div>`;
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

  // Strada del giorno: solo tra quelle aperte. Vale lo stato segnalato (piloti / ufficiale);
  // senza segnalazioni si escludono le strade nel periodo di chiusura tipica, mesi di inizio e fine compresi.
  const CLOSE_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  function surelyOpen(r, d) {
    const st = Store.roadStatus(r.id);
    if (st) return st.status === 'open';
    if (!r.closure) return true;
    const [a, b] = r.closure.split(/[–-]/).map((s) => CLOSE_MONTHS.indexOf(s.trim()));
    if (a < 0 || b < 0) return true;
    const m = d.getMonth();
    return !(a <= b ? m >= a && m <= b : m >= a || m <= b);
  }
  function roadOfDay() {
    const d = new Date();
    const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    let list = ROADS.filter((r) => surelyOpen(r, d));
    if (!list.length) list = ROADS.filter((r) => !r.closure);
    return list[n % list.length];
  }

  // ───────────── router ─────────────
  // Flusso: splash animato → (prima volta) "Cos'è TOUGE?" → Esplora, anche senza account.
  // Senza account si vede tutto; salvare (preferiti, strade guidate, recensioni, segnalazioni)
  // e le schede Le tue strade / Pilota aprono l'invito a registrarsi, che poi completa l'azione.
  const PUBLIC = ['login', 'register', 'forgot'];
  const BARE = ['intro', 'reset', ...PUBLIC];          // schermate senza barra delle schede
  const OPEN = ['intro', 'reset', 'privacy'];
  const GUEST = ['explore', 'map', 'road', 'trip', 'tripedit']; // visibili anche senza account (tripedit invita a registrarsi)
  const LOCKED = ['garage', 'profile'];                // senza account: invito a registrarsi
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } };

  // ───────────── DA DOVE PARTI ("Vicino a te" / "Parto da…") ─────────────
  // Resta solo sul telefono: { kind: 'gps', ll, at } (arrotondata a ~1 km) oppure { kind: 'city', ll, it, en }.
  let origin = lsGet('touge.origin', null);
  let driveCache = {};
  const setOrigin = (o) => {
    origin = o; driveCache = {}; lsSet('touge.origin', o);
    // con le push accese, il servizio usa la partenza (arrotondata a ~10 km) per "Weekend di sole vicino a te"
    if (Auth.current() && Store.notifyPrefs().push) Store.setNotifyPrefs({}, o && o.ll, lang).catch(() => {});
  };
  const cityName = (o) => (lang === 'en' && o.en ? o.en.split('|')[0] : o.it);
  const originLabel = () => (!origin ? '' : origin.kind === 'gps' ? t('fromHere') : t('fromCity').replace('{c}', cityName(origin)));
  // minuti di guida stimati fino al più vicino dei due capi della strada
  function driveMin(r) {
    if (!origin) return null;
    if (driveCache[r.id] == null) driveCache[r.id] = estDrive(Math.min(haversine(origin.ll, r.wp[0]), haversine(origin.ll, r.wp[r.wp.length - 1])));
    return driveCache[r.id];
  }
  function locateMe() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(false);
      navigator.geolocation.getCurrentPosition((p) => {
        setOrigin({ kind: 'gps', ll: [+p.coords.latitude.toFixed(2), +p.coords.longitude.toFixed(2)], at: Date.now() });
        res(true);
      }, () => res(false), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
  }
  // se la posizione è già permessa e vecchia di oltre 30 minuti, la aggiorna senza chiedere nulla
  async function refreshGps(onDone) {
    if (!origin || origin.kind !== 'gps' || Date.now() - (origin.at || 0) < 30 * 60e3) return;
    try {
      const p = navigator.permissions && (await navigator.permissions.query({ name: 'geolocation' }));
      if (p && p.state === 'granted' && (await locateMe())) onDone();
    } catch (e) { /* ok */ }
  }
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function findCities(q) {
    q = norm(q.trim());
    if (q.length < 2) return [];
    const hit = [];
    (window.CITIES || []).forEach((c) => {
      const names = [c[0]].concat(c[4] ? c[4].split('|') : []).map(norm);
      const rank = names.some((n) => n.startsWith(q)) ? 0 : names.some((n) => n.includes(q)) ? 1 : -1;
      if (rank >= 0) hit.push([rank, c]);
    });
    return hit.sort((a, b) => a[0] - b[0] || a[1][0].localeCompare(b[1][0])).slice(0, 6).map((h) => h[1]);
  }

  // ───────────── METEO IN VETTA ─────────────
  function wxPill(id) {
    const w = window.TougeWx && TougeWx.get(id);
    return w && w.now ? `${wxIcon(w.now.k)}<b>${w.now.t}°</b>` : '';
  }
  // scarica il meteo (una volta ogni 3 ore) e riempie ciò che è a schermo
  function loadWx() {
    if (!window.TougeWx) return;
    const paint = () => {
      $$('[data-wx]').forEach((el) => (el.innerHTML = wxPill(el.dataset.wx)));
      const box = $('#wx-box');
      if (box) renderWxBox(byId[box.dataset.road]);
    };
    if (TougeWx.ready()) return;
    TougeWx.load(ROADS, summit).then(paint);
  }
  function renderWxBox(r) {
    const box = $('#wx-box');
    if (!box || !r) return;
    const w = TougeWx.get(r.id);
    if (!w || !w.days.length) { box.hidden = true; return; }
    const today = w.days[0], soon = w.days.slice(0, 2);
    const ice = soon.some((d) => d.snow > 0 || d.min <= 0);
    const extra = [t('wxWind').replace('{v}', today.wind)];
    if (today.pop >= 20) extra.push(t('wxRain').replace('{v}', today.pop));
    if (today.snow > 0) extra.push(t('wxSnow').replace('{v}', today.snow.toFixed(today.snow < 1 ? 1 : 0)));
    box.hidden = false;
    box.innerHTML = `
      <div class="wx-head"><h2 class="h2">${icon('mountain')} ${t('wxTitle')}</h2>
        ${w.now ? `<span class="wx-now">${t('wxNow')} ${wxIcon(w.now.k)}<b>${w.now.t}°</b></span>` : ''}</div>
      <div class="wx-days">${w.days.map((d, i) => `
        <div class="wx-day"><span>${i ? t('wxDays')[new Date(d.day + 'T12:00').getDay()] : t('wxToday')}</span>${wxIcon(d.k)}<b>${d.max}°</b><small>${d.min}°</small></div>`).join('')}
      </div>
      <p class="wx-line">${extra.join(' · ')}</p>
      ${ice ? `<p class="wx-warn">${icon('snow')}<span>${t('wxIce')}</span></p>` : ''}
      <p class="wx-src">${t('wxSource').replace('{alt}', fmt(r.alt))}</p>`;
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || '';
    const name = hash.startsWith('road-') ? 'road' : hash.startsWith('tripedit') ? 'tripedit' : hash.startsWith('trip-') ? 'trip' : hash;
    const param = name === 'road' || name === 'trip' ? hash.slice(5) : name === 'tripedit' ? hash.slice(9) : '';
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

    const views = { intro: viewIntro, reset: viewReset, login: viewLogin, register: viewRegister, forgot: viewForgot, privacy: viewPrivacy, explore: viewExplore, map: viewMap, road: viewRoad, trip: viewTrip, tripedit: viewTripEdit, garage: viewGarage, profile: viewProfile };
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
    if (!isAuth) renderTabbar(name === 'road' || name === 'trip' ? 'explore' : name === 'tripedit' ? 'garage' : name === 'privacy' ? 'profile' : name);
    else renderJoinbar(false);
    if (name !== 'map') window.scrollTo(0, 0);
    // dopo la registrazione: una volta sola, invito (facoltativo) ad aggiungere la foto profilo
    if (user && !isAuth && !user.photo && lsGet('touge.askPhoto', false)) {
      lsSet('touge.askPhoto', false);
      setTimeout(() => { if (Auth.current()) openPhotoAsk(); }, 900);
    }
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
    const keys = { fav: 'joinFav', driven: 'joinDriven', review: 'joinReview', report: 'joinReport', flag: 'joinFlag', garage: 'joinGarage', profile: 'joinProfile', remind: 'joinRemind', photo: 'joinPhoto', trip: 'joinTrip' };
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
      try { const u = await Auth.register(d); toast(`${t('hello')}, ${u.name}!`); lsSet('touge.askPhoto', true); goAfterAuth(); }
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
  const hasTag = (r, list) => r.tags.some((x) => list.includes(x));
  const FILTER_DEFS = {
    // esperienze: raggruppano tag e numeri che ci sono già
    exp: { icon: 'spark', label: 'experience', opts: () => [
      { v: 'view', label: t('expView'), short: t('expView'), test: (r) => hasTag(r, ['panoramica', 'lago', 'ghiacciai', 'costa', 'dolomiti']) },
      { v: 'hair', label: t('expHair'), short: t('expHair'), test: (r) => r.hairpins >= 30 || hasTag(r, ['tornanti']) },
      { v: 'legend', label: t('expLegend'), short: t('expLegend'), test: (r) => hasTag(r, ['leggenda', 'rally', 'mille-miglia', 'cronoscalata', 'cinema', 'storica', 'record']) },
      { v: 'easy', label: t('expEasy'), short: t('expEasy'), test: (r) => r.diff <= 2 && !r.toll && !hasTag(r, ['stretta', 'pavé']) }] },
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
  const activeCount = () => Object.values(filters.sel).reduce((n, a) => n + a.length, 0) + (filters.open ? 1 : 0) + (filters.noToll ? 1 : 0) + (filters.time && origin ? 1 : 0);

  function applyFilters() {
    const q = filters.q.trim().toLowerCase();
    const groups = Object.entries(filters.sel).filter(([, vals]) => vals.length)
      .map(([k, vals]) => FILTER_DEFS[k].opts().filter((o) => vals.includes(o.v)));
    let list = ROADS.filter((r) => {
      if (groups.some((opts) => !opts.some((o) => o.test(r)))) return false;
      if (filters.open && r.closure) return false;
      if (filters.noToll && r.toll) return false;
      if (filters.time && origin && driveMin(r) > filters.time) return false;
      if (q && !(r.name + ' ' + r.region + ' ' + cname(r.country) + ' ' + r.tags.map(tag).join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
    const s = filters.sort;
    list.sort((a, b) =>
      s === 'near' && origin ? driveMin(a) - driveMin(b) || a.name.localeCompare(b.name) :
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
        `<button class="chip fchip${g} ${filters.time && origin ? 'on' : ''}" data-time aria-haspopup="dialog">${icon('clock')}<span>${filters.time && origin ? t('within').replace('{t}', fmtDur(filters.time)) : t('fromYou')}</span>${icon('chev', 'chev')}</button>` +
        Object.keys(FILTER_DEFS).map((k) => `<button class="chip fchip${g} ${filters.sel[k].length ? 'on' : ''}" data-f="${k}" aria-haspopup="dialog">${icon(FILTER_DEFS[k].icon)}<span>${label(k)}</span>${icon('chev', 'chev')}</button>`).join('') +
        `<button class="chip fchip${g} ${filters.open ? 'on' : ''}" data-t="open" aria-pressed="${filters.open}">${icon('snow')}<span>${t('openNow')}</span></button>` +
        `<button class="chip fchip${g} ${filters.noToll ? 'on' : ''}" data-t="noToll" aria-pressed="${filters.noToll}">${icon('euro')}<span>${t('noToll')}</span></button>`;
      $$('[data-f]', box).forEach((b) => (b.onclick = () => openFilterSheet(b.dataset.f, () => { paint(); onChange(); })));
      $$('[data-t]', box).forEach((b) => (b.onclick = () => { filters[b.dataset.t] = !filters[b.dataset.t]; paint(); onChange(); }));
      $('[data-time]', box).onclick = () => openOriginSheet(true, () => { paint(); onChange(); });
      const r = $('[data-reset]', box);
      if (r) r.onclick = () => { Object.keys(filters.sel).forEach((k) => (filters.sel[k] = [])); filters.open = filters.noToll = false; filters.time = 0; paint(); onChange(); };
    };
    paint();
  }

  function roadCard(r) {
    const fav = Store.isFav(r.id), dr = Store.isDriven(r.id), rt = Store.rating(r.id);
    const st = Store.roadStatus(r.id), dm = driveMin(r);
    const badge = st && (st.by === 'official' || Date.now() - Date.parse(st.at) < 7 * 864e5)
      ? `<span class="st-badge ${st.status}">${t(st.status === 'open' ? 'stOpen' : 'stClosed')}</span>` : '';
    return `
      <article class="card ${dr ? 'is-driven' : ''}" data-go="${r.id}">
        <div class="card-art">${roadArt(r, { w: 320, h: 190, num: r.no })}${badge}
          <span class="wx-pill" data-wx="${r.id}">${wxPill(r.id)}</span>
          <span class="card-alt"><b>${fmt(r.alt)}</b><small>m</small></span>
          ${dr ? `<span class="stamp">${drivenPlate(r)}</span>` : ''}
          <button class="fav-btn ${fav ? 'on' : ''}" data-fav="${r.id}" aria-label="${t('favorite')}">${icon('heart')}</button>
        </div>
        <div class="card-body">
          <div class="card-kicker">${flag(r.country)} <span class="kick-reg">${esc(r.region)}</span>${dm != null ? `<span class="kick-time">${icon('clock')}≈ ${fmtDur(dm)}</span>` : ''}</div>
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
      if (on) maybeAskNotify();
    }));
    $$('[data-go]', root).forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
  }

  function viewExplore(_, user) {
    const rod = roadOfDay();
    app.innerHTML = `
      <header class="top">
        <div><p class="muted small">${t('exploreSub')}</p><h1 class="h1">${user ? `${t('hello')}, ${esc(user.name)}` : t('helloGuest')}</h1></div>
        ${user ? `<div class="top-right"><button class="bell" id="bell" aria-label="${t('alerts')}">${icon('bell')}<span class="bell-n" hidden></span></button><a href="#profile" aria-label="${t('profile')}">${avatar(user, 44)}</a></div>` : `<button class="enter-btn" id="enter">${t('register')}</button>`}
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

      <section class="near" id="near"></section>
      <section class="near trips-row" id="trips-row"></section>

      <div class="list-head"><h2 class="h2" id="list-title">${t('explore')}</h2><span class="muted small" id="count"></span></div>
      <div class="grid" id="list"></div>
      <div class="sheet-wrap" id="sheet" hidden></div>`;

    const renderList = () => {
      const list = applyFilters();
      // con filtri o ricerca attivi la pagina diventa "risultati": sparisce la strada del giorno
      const filtered = activeCount() > 0 || !!filters.q.trim();
      $('.featured').hidden = filtered;
      $('#near').hidden = filtered;
      $('#trips-row').hidden = filtered;
      $('#open-filters').classList.toggle('dot', filters.sort !== 'name');
      $('#list-title').textContent = filtered ? t('filteredTitle') : t('explore');
      $('#count').textContent = `${list.length} ${list.length === 1 ? t('result1') : t('results')}`;
      $('#list').innerHTML = list.length ? list.map(roadCard).join('') : `<p class="empty">${t('noResults')}</p>`;
      bindCards($('#list'));
    };
    // "Vicino a te": invito a scegliere la partenza, oppure le strade più vicine in tempo di guida
    const renderNear = () => {
      const box = $('#near');
      if (!box) return;
      if (!origin) {
        box.innerHTML = `
          <div class="near-cta">
            <h2 class="h2">${icon('pin')} ${t('nearYou')}</h2>
            <p>${t('nearSub')}</p>
            <div class="near-btns">
              <button class="btn primary sm" data-gps>${icon('locate')} ${t('useGps')}</button>
              <button class="btn ghost sm" data-city>${icon('search')} ${t('pickCity')}</button>
            </div>
          </div>`;
        $('[data-gps]', box).onclick = async (e) => {
          const b = e.currentTarget; b.classList.add('loading');
          if (await locateMe()) refresh(); else { b.classList.remove('loading'); toast(t('gpsDenied')); }
        };
        $('[data-city]', box).onclick = () => openOriginSheet(false, refresh, true);
        return;
      }
      const near = ROADS.slice().sort((a, b) => driveMin(a) - driveMin(b)).slice(0, 10);
      box.innerHTML = `
        <div class="list-head"><h2 class="h2">${t('nearYou')}</h2><button class="near-from" data-change>${icon('pin')}<span>${esc(originLabel())}</span>${icon('chev', 'chev')}</button></div>
        <div class="hscroll">${near.map((x) => miniCard(x, `≈ ${fmtDur(driveMin(x))} · ${fmt(x.alt)} m`)).join('')}</div>`;
      $('[data-change]', box).onclick = () => openOriginSheet(false, refresh);
      $$('[data-go]', box).forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
    };
    // itinerari: curati (prima i più vicini alla tua partenza) + quelli pubblicati dai piloti + "Crea il tuo"
    const renderTrips = () => {
      const box = $('#trips-row');
      if (!box) return;
      let cur = allCurated();
      if (origin) {
        const d = (tr) => Math.min(...tripRoads(tr).map((r) => haversine(origin.ll, summit(r))));
        cur = cur.sort((a, b) => d(a) - d(b));
      }
      const list = cur.concat(Store.publicTrips());
      box.innerHTML = `<div class="list-head"><h2 class="h2">${t('itineraries')}</h2></div>
        <div class="hscroll trips">${list.map(tripCard).join('')}${newTripCard()}</div>`;
      bindTripCards(box);
    };
    renderTrips();
    Store.loadPublicTrips().then(() => { if (location.hash === '#explore' || !location.hash) renderTrips(); }).catch(() => {});
    // il chip "Da te" può cambiare la partenza: ridisegna anche "Vicino a te"
    const onFilter = () => { renderNear(); renderTrips(); renderList(); };
    const refresh = () => { onFilter(); filterChips($('#chips'), onFilter); };
    renderNear();
    renderList();
    loadWx();
    refreshGps(refresh);
    $('.featured').onclick = () => go('road-' + rod.id);
    if (!user) $('#enter').onclick = () => startJoin();
    if (user) {
      $('#bell').onclick = () => openAlerts();
      refreshBell();
    }

    $('#q').oninput = (e) => { filters.q = e.target.value; renderList(); };
    filterChips($('#chips'), onFilter);
    $('#open-filters').onclick = () => openSortSheet(() => { renderList(); $('#open-filters').classList.toggle('dot', filters.sort !== 'name'); });
  }

  function miniCard(x, sub) {
    const dr = Store.isDriven(x.id);
    return `
      <article class="mini-card ${dr ? 'is-driven' : ''}" data-go="${x.id}"><div class="mini-art">${roadArt(x, { w: 220, h: 130 })}<span class="wx-pill sm" data-wx="${x.id}">${wxPill(x.id)}</span></div>
        <div><h4>${dr ? CHK : ''}${esc(x.name)}</h4><span class="muted xs">${sub}</span></div>
      </article>`;
  }

  // "Da dove parti?": posizione attuale o città, e (dai filtri) quanto vuoi guidare
  function openOriginSheet(withTime, onChange, focus) {
    const times = [60, 120, 180, 0];
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('pin')} ${t('originTitle')}</h2><button class="link" data-close>${t('close')}</button></div>
      <button class="org-gps" data-gps>${icon('locate')}<span>${t('myPosition')}</span>${icon('check', 'org-ok')}</button>
      <label class="search org-q">${icon('search')}<input id="org-q" type="search" placeholder="${t('cityPh')}" autocomplete="off" enterkeyhint="search" /></label>
      <div class="org-list" id="org-list"></div>
      ${withTime ? `
        <h3 class="org-h">${t('howLong')}</h3>
        <div class="chips wrap" id="org-time">${times.map((v) => `<button class="chip ${filters.time === v ? 'on' : ''}" data-tv="${v}">${v ? t('within').replace('{t}', fmtDur(v)) : t('anyTime')}</button>`).join('')}</div>
        <p class="muted small org-hint">${t('driveHint')}</p>
        <button class="btn primary" data-close>${t('showResults')} <span data-n></span></button>` : ''}`);
    sh.classList.add('org-sheet');
    const q = $('#org-q', sh), list = $('#org-list', sh);
    const paint = () => {
      $('[data-gps]', sh).classList.toggle('on', !!origin && origin.kind === 'gps');
      q.placeholder = origin && origin.kind === 'city' ? `${t('pickCity')} ${cityName(origin)} ✓` : t('cityPh');
      q.classList.toggle('set', !!origin && origin.kind === 'city');
      const n = $('[data-n]', sh);
      if (n) n.textContent = `(${applyFilters().length})`;
      $$('[data-tv]', sh).forEach((b) => b.classList.toggle('on', +b.dataset.tv === filters.time));
    };
    const picked = () => { paint(); onChange(); if (!withTime) $('[data-close]', sh).click(); };
    $('[data-gps]', sh).onclick = async (e) => {
      const b = e.currentTarget; b.classList.add('loading');
      const ok = await locateMe();
      b.classList.remove('loading');
      if (!ok) return toast(t('gpsDenied'));
      q.value = ''; list.innerHTML = ''; picked();
    };
    q.oninput = () => {
      const found = findCities(q.value);
      list.innerHTML = q.value.trim().length < 2 ? '' : found.length
        ? found.map((c, i) => `<button class="org-city" data-i="${i}">${FLAGS[c[3]] ? flag(c[3]) : '<span class="flag-x"></span>'}<span>${esc(lang === 'en' && c[4] ? c[4].split('|')[0] : c[0])}</span></button>`).join('')
        : `<p class="muted small">${t('noCity')}</p>`;
      $$('[data-i]', list).forEach((b) => (b.onclick = () => {
        const c = found[+b.dataset.i];
        setOrigin({ kind: 'city', ll: [c[1], c[2]], it: c[0], en: c[4] || '' });
        q.value = ''; list.innerHTML = ''; q.blur(); picked();
      }));
    };
    $$('[data-tv]', sh).forEach((b) => (b.onclick = () => {
      if (!origin) { toast(t('needOrigin')); q.focus(); return; }
      filters.time = +b.dataset.tv;
      if (filters.time && filters.sort === 'name') filters.sort = 'near';
      paint(); onChange();
    }));
    paint();
    if (focus) setTimeout(() => q.focus(), 300);
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
    const sorts = (origin ? [['near', 'sortNear']] : []).concat([['name', 'sortName'], ['alt', 'sortAlt'], ['km', 'sortKm'], ['hair', 'sortHair'], ['rating', 'sortRating']]);
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
    const similar = similarRoads(r);

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
          <button class="act ${dr ? 'on' : ''}" id="a-drv">${icon('flag')}<span>${dr ? t(Store.isVerified(r.id) ? 'isVerified' : 'isDriven') : t('markDriven')}</span></button>
          <button class="act go" id="a-go">${icon('go')}<span>${t('letsGo')}</span></button>
        </div>
        <div class="share-row">
          <button class="act share" id="a-share-road">${icon('share')}<span>${t('shareRoad')}</span></button>
          <button class="act share story" id="a-share-story">${icon('story')}<span>${t('sharePlate')}</span></button>
        </div>
        <button class="add-trip" id="a-trip">${icon('route')}<span>${t('addToTrip')}</span>${icon('plus')}</button>

        <section class="status" id="road-status" aria-live="polite"></section>
        <section class="wx" id="wx-box" data-road="${r.id}" hidden></section>

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

          <h2 class="h2">${t('photos')} <span class="muted small" id="ph-count"></span></h2>
          <div id="ph-box"></div>

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

          <h2 class="h2">${t('similar')}</h2>
          <div class="hscroll">${similar.map(([x, km]) => miniCard(x, `${t('simAway').replace('{km}', Math.round(km))} · ${fmt(x.alt)} m`)).join('')}</div>
          ${(() => {
            const withRoad = allCurated().concat(Store.myTrips(), Store.publicTrips()).filter((tr) => tr.stops.some((s) => s.r === r.id));
            return withRoad.length ? `<h2 class="h2">${t('tripsWithRoad')}</h2><div class="hscroll trips" id="road-trips">${withRoad.map(tripCard).join('')}</div>` : '';
          })()}

          <p class="disclaimer">${t('disclaimer')}</p>
        </div>
      </section>`;

    $$('[data-go]').forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
    $('#a-fav').onclick = (e) => {
      if (!user) return openJoinSheet('fav', r, { road: r.id, act: 'fav' });
      const on = Store.toggleFav(r.id);
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t('removeFav') : t('addFav');
      if (on) maybeAskNotify();
    };
    $('#a-drv').onclick = (e) => {
      if (!user) return openJoinSheet('driven', r, { road: r.id, act: 'driven' });
      const on = Store.toggleDriven(r.id);
      $('#hero-plate').innerHTML = (on ? CHK : '') + 'No.' + r.no;
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.querySelector('span').textContent = on ? t(Store.isVerified(r.id) ? 'isVerified' : 'isDriven') : t('markDriven');
      if (on) toast('🏁 ' + r.name);
      renderPhotos();
    };

    // foto dei piloti: una per pilota, solo per chi l'ha guidata
    const renderPhotos = () => {
      const box = $('#ph-box');
      if (!box) return;
      const list = Store.roadPhotos(r.id), me = Auth.current(), drv = Store.isDriven(r.id), mine = !!Store.myPhoto(r.id);
      $('#ph-count').textContent = list.length ? `· ${list.length}` : '';
      const cta = !me ? `<button class="btn ghost ph-cta" data-ph-guest>${icon('camera')} ${t('addPhoto')}</button>`
        : !drv ? `<p class="ph-need">${icon('camera')}<span>${t('photoNeedDriven')}</span></p>`
        : `<button class="btn primary sm ph-cta" data-ph-add>${icon('camera')} ${t(mine ? 'changePhoto' : 'addPhoto')}</button>`;
      box.innerHTML = (list.length ? `<div class="ph-row">${list.map((p) => `
        <figure class="ph ${p.verified ? 'ver' : ''}">
          <button class="ph-img" data-open="${p.id}" aria-label="${esc(t('photoBy') + ' ' + p.user)}"><img src="${esc(p.url)}" alt="" loading="lazy" decoding="async" />
            ${p.verified ? `<span class="ph-ver">${icon('check')}${t('verified')}</span>` : ''}</button>
          <figcaption>${avatar({ name: p.user, avatar: p.avatar, photoUrl: p.userPhoto }, 32)}
            <div class="ph-who"><b>${esc(p.user)}</b><span>${esc(p.car)}</span></div>
            ${p.mine ? `<button class="link xs" data-ph-del>${t('deletePhoto')}</button>` : `<button class="link xs rv-flag" data-ph-flag="${p.id}">${t('reportPhoto')}</button>`}
          </figcaption>
        </figure>`).join('')}</div>` : `<p class="empty ph-empty">${t('noPhotos')}</p>`) + cta;
      const g = $('[data-ph-guest]', box); if (g) g.onclick = () => openJoinSheet('photo', r);
      const a = $('[data-ph-add]', box); if (a) a.onclick = () => pickImage().then((file) => openPhotoSheet(r, file, () => { renderPhotos(); refreshDriven(); }));
      $$('[data-open]', box).forEach((b) => (b.onclick = () => { const p = list.find((x) => x.id === b.dataset.open); if (p) openViewer(p); }));
      const del = $('[data-ph-del]', box);
      if (del) del.onclick = async () => {
        if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = t('confirmReport'); setTimeout(() => { del.classList.remove('armed'); del.textContent = t('deletePhoto'); }, 4000); return; }
        try { await Store.deleteRoadPhoto(r.id); renderPhotos(); refreshDriven(); } catch (err) { toast(t('syncError')); }
      };
      $$('[data-ph-flag]', box).forEach((b) => (b.onclick = async () => {
        if (!Auth.current()) return openJoinSheet('flag', r);
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('confirmReport'); setTimeout(() => { b.classList.remove('armed'); b.textContent = t('reportPhoto'); }, 4000); return; }
        try { await Store.reportPhoto(r.id, b.dataset.phFlag); toast(t('reported')); renderPhotos(); } catch (err) { toast(t('syncError')); }
      }));
    };
    // il bottone "Strada guidata" diventa "Strada verificata" con la foto verificata
    const refreshDriven = () => {
      const b = $('#a-drv');
      if (b && Store.isDriven(r.id)) b.querySelector('span').textContent = t(Store.isVerified(r.id) ? 'isVerified' : 'isDriven');
    };
    renderPhotos();
    Store.loadRoadPhotos(r.id).then(() => { if (location.hash === '#road-' + r.id) renderPhotos(); }).catch(() => {});
    $('#a-go').onclick = () => openGoSheet(r);
    $('#a-trip').onclick = () => openAddToTrip(r);
    if ($('#road-trips')) bindTripCards($('#road-trips'));
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
    renderWxBox(r);
    loadWx();

    // recensioni
    let rating = 0;
    const paintStars = () => $$('#rv-stars button').forEach((b) => b.classList.toggle('on', +b.dataset.v <= rating));
    $$('#rv-stars button').forEach((b) => (b.onclick = () => { rating = +b.dataset.v; paintStars(); }));
    const renderReviews = () => {
      const list = Store.reviews(r.id), rt = Store.rating(r.id);
      $('#rv-sum').innerHTML = rt ? `${stars(rt.avg, 'sm')} ${rt.avg.toFixed(1)} · ${rt.count}` : '';
      $('#rv-list').innerHTML = list.length ? list.map((v) => `
        <div class="review">
          <div class="row between"><div class="rv-who">${avatar({ name: v.user, photoUrl: v.photo || '' , avatar: (v.user || '').length }, 32)}<div><b>${esc(v.user)}</b> <span class="muted xs">${esc(v.car || '')}</span></div></div>${stars(v.rating, 'sm')}</div>
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

  // strade simili: carattere (tag, difficoltà, quota, tornanti) + un premio per quelle vicine
  function similarRoads(r, n) {
    const s = summit(r), tg = new Set(r.tags);
    return ROADS.filter((x) => x.id !== r.id).map((x) => {
      const shared = x.tags.filter((k) => tg.has(k)).length, union = new Set(r.tags.concat(x.tags)).size || 1;
      const km = haversine(s, summit(x));
      const score = 3 * shared / union + 1.2 * (1 - Math.abs(x.diff - r.diff) / 4) +
        (1 - Math.min(1, Math.abs(x.alt - r.alt) / 1500)) + 0.8 * (1 - Math.min(1, Math.abs(x.hairpins - r.hairpins) / 40)) +
        2.5 * Math.exp(-km / 120);
      return [x, km, score];
    }).sort((a, b) => b[2] - a[2]).slice(0, n || 6);
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

  // ───────────── FOTO ─────────────
  // apre la scelta della foto del telefono (va chiamata dentro il tocco dell'utente)
  function pickImage() {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.style.cssText = 'position:fixed;left:-999px;opacity:0';
      document.body.appendChild(inp);
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) res(f); };
      inp.click();
    });
  }
  const fmtKm1 = (d) => (d < 0.1 ? '< 0.1' : d < 10 ? d.toFixed(1) : String(Math.round(d))).replace('.', lang === 'it' ? ',' : '.');
  const phoneSpot = () => new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res([p.coords.latitude, p.coords.longitude]), () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });

  // "La tua foto della strada": cerca la posizione nella foto, poi (se serve) quella del telefono.
  // Basta una delle due vicina al tracciato (~2 km) per la placca VERIFICATO.
  async function openPhotoSheet(r, file, onDone) {
    const prevUrl = URL.createObjectURL(file);
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('camera')} ${t('photoTitle')}</h2><button class="link" data-close>${t('close')}</button></div>
      <div class="ph-prev"><img src="${prevUrl}" alt="" /></div>
      <ul class="ph-checks"><li class="wait">${t('phChecking')}</li></ul>
      <div class="ph-result" hidden></div>
      <p class="muted small ph-note">${t('phPublic')}</p>
      <button class="btn primary" id="ph-pub" disabled>${t('publishPhoto')}</button>`, () => URL.revokeObjectURL(prevUrl));
    sh.classList.add('ph-sheet');
    const checks = $('.ph-checks', sh);
    const line = (cls, txt) => { const li = document.createElement('li'); li.className = cls; li.textContent = txt; checks.appendChild(li); return li; };
    const open = () => document.body.contains(sh);
    let by = '';
    const [coords, spot] = await Promise.all([loadRoute(r).then((x) => x.coords), TougePhoto.gps(file)]);
    if (!open()) return;
    checks.innerHTML = '';
    if (spot) {
      const d = TougePhoto.distKm(spot, coords);
      if (d <= TougePhoto.NEAR_KM) { by = 'photo'; line('ok', t('phExifNear').replace('{km}', fmtKm1(d))); }
      else line('no', t('phExifFar').replace('{km}', fmtKm1(d)));
    } else line('no', t('phNoExif'));
    if (!by) {
      const li = line('wait', t('phGpsChecking'));
      const me = await phoneSpot();
      if (!open()) return;
      if (!me) { li.className = 'no'; li.textContent = t('phGpsNo'); }
      else {
        const d = TougePhoto.distKm(me, coords);
        if (d <= TougePhoto.NEAR_KM) { by = 'phone'; li.className = 'ok'; li.textContent = t('phGpsNear').replace('{km}', fmtKm1(d)); }
        else { li.className = 'no'; li.textContent = t('phGpsFar').replace('{km}', fmtKm1(d)); }
      }
    }
    const res = $('.ph-result', sh);
    res.hidden = false;
    res.className = 'ph-result ' + (by ? 'yes' : 'no');
    res.innerHTML = `<span class="join-plate ph-plate">${drivenPlate(r, !!by)}</span><p>${by ? `<b>${t('phYes')}</b>` : t('phNo')}</p>`;
    fitPlates(res);
    const pub = $('#ph-pub', sh);
    pub.disabled = false;
    pub.onclick = async () => {
      pub.classList.add('loading'); pub.textContent = t('uploading');
      try {
        const blob = await TougePhoto.resize(file, Auth.cloud ? 1600 : 1000, Auth.cloud ? 0.82 : 0.72);
        await Store.addRoadPhoto(r.id, blob, by);
        toast(by ? '🏁 ' + t('phVerifiedToast') : t('phDone'));
        $('[data-close]', sh).click();
        if (onDone) onDone();
      } catch (err) {
        pub.classList.remove('loading'); pub.textContent = t('publishPhoto');
        toast(t(/^err/.test(err.message) ? err.message : 'errPhotoUpload'));
      }
    };
  }

  // foto a schermo intero (tocca per chiudere)
  function openViewer(p) {
    const el = document.createElement('div');
    el.className = 'ph-view';
    el.innerHTML = `<img src="${esc(p.url)}" alt="" /><div class="ph-view-cap">${p.verified ? `<span class="ph-ver">${icon('check')}${t('verified')}</span>` : ''}<b>${esc(p.user)}</b> ${esc(p.car)} · ${esc(p.date)}</div><button class="round-btn" aria-label="${t('close')}">${icon('close')}</button>`;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }

  // foto profilo / auto: rimpicciolita sul telefono e salvata nel profilo
  async function saveProfilePhoto(kind, file) {
    try {
      const blob = file ? (kind === 'photo'
        ? await TougePhoto.resize(file, Auth.cloud ? 480 : 320, 0.85, true)
        : await TougePhoto.resize(file, Auth.cloud ? 1400 : 900, Auth.cloud ? 0.82 : 0.72)) : null;
      await Store.setProfilePhoto(kind, blob);
      toast(t('photoSaved'));
      route();
    } catch (err) { toast(t(/^err/.test(err.message) ? err.message : 'errPhotoUpload')); }
  }
  function openPhotoAsk() {
    const u = Auth.current();
    if (!u) return;
    const sh = openSheet(`
      <div class="join">
        <div class="ask-avatar">${avatar(u, 92)}<span class="cam">${icon('camera')}</span></div>
        <h2 class="h2">${t('photoAskTitle')}</h2>
        <p class="join-text">${t('photoAskText')}</p>
        <button class="btn primary" id="pa-go">${icon('camera')} ${t('photoAskCta')}</button>
        <div class="join-foot"><span></span><button class="link muted" data-close>${t('later')}</button></div>
      </div>`);
    sh.classList.add('join-sheet');
    $('#pa-go', sh).onclick = () => { pickImage().then((f) => saveProfilePhoto('photo', f)); sh.remove(); };
  }

  // ───────────── AVVISI E NOTIFICHE ─────────────
  // Gli avvisi della campanella si calcolano sul telefono all'apertura (stato strade, meteo, novità).
  // Le push (app chiusa) le spedisce il servizio Supabase "touge-notify" con le stesse regole.
  const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  // chiusura stagionale: chiusa di sicuro nei mesi interni (il primo e l'ultimo mese sono di passaggio)
  function seasonClosed(r, d) {
    if (!r.closure) return false;
    const [a, b] = r.closure.split(/[–-]/).map((s) => MONTHS_IT.indexOf(s.trim()));
    if (a < 0 || b < 0) return false;
    const m = (d || new Date()).getMonth();
    return a <= b ? m > a && m < b : m > a || m < b;
  }
  const openish = (r) => { const st = Store.roadStatus(r.id); return st ? st.status === 'open' : !seasonClosed(r); };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // giovedì, venerdì e sabato: le date del weekend in arrivo
  function weekendDays() {
    const d = new Date(), dow = d.getDay();
    if (![4, 5, 6].includes(dow)) return null;
    const add = (n) => { const x = new Date(d); x.setDate(d.getDate() + n); return ymd(x); };
    return { sat: add(6 - dow), sun: add(7 - dow) };
  }
  function sunny(r, wk) {
    const w = window.TougeWx && TougeWx.get(r.id);
    if (!w) return [];
    return ['sat', 'sun'].filter((k) => { const d = w.days.find((x) => x.day === wk[k]); return d && (d.k === 'sun' || d.k === 'part') && !d.snow && d.pop < 40; });
  }
  async function computeAlerts() {
    const user = Auth.current();
    if (!user) return [];
    const P = Store.notifyPrefs(), favs = Store.favorites().map((id) => byId[id]).filter(Boolean), out = [], now = new Date().toISOString();
    if (P.reopen) favs.forEach((r) => {
      const st = Store.roadStatus(r.id);
      if (r.closure && st && st.status === 'open' && Date.now() - Date.parse(st.at) < 14 * 864e5) {
        out.push({ id: 'reopen:' + r.id + ':' + st.at.slice(0, 10), icon: icon('flag'), road: r.id, at: st.at, title: t('alReopen').replace('{n}', r.name), sub: t('alReopenSub') });
      }
    });
    const wk = weekendDays();
    if (wk && (P.wxFav || (P.wxNear && origin)) && window.TougeWx && (await TougeWx.load(ROADS, summit))) {
      const label = (ds) => ds.map((k) => t(k)).join(' ' + t('and') + ' ');
      if (P.wxFav) {
        const ok = favs.map((r) => [r, sunny(r, wk)]).filter(([r, ds]) => ds.length && openish(r));
        if (ok.length) out.push({ id: 'wxfav:' + wk.sat, icon: wxIcon('sun'), road: ok[0][0].id, at: now,
          title: t(ok.length > 2 ? 'alWxFavMore' : ok.length === 2 ? 'alWxFav2' : 'alWxFav').replace('{n}', ok[0][0].name).replace('{k}', ok.length - 1), sub: t('alWxFavSub').replace('{d}', label(ok[0][1])) });
      }
      if (P.wxNear && origin) {
        const ok = ROADS.filter((r) => driveMin(r) <= P.nearMin && openish(r) && sunny(r, wk).length);
        if (ok.length) out.push({ id: 'wxnear:' + wk.sat, icon: wxIcon('sun'), near: P.nearMin, at: now,
          title: (ok.length === 1 ? t('alWxNear1') : t('alWxNear')).replace('{k}', ok.length).replace('{t}', fmtDur(P.nearMin)), sub: t('alWxNearSub').replace('{c}', originLabel()) });
      }
    }
    if (P.news && favs.length) {
      try {
        const n = await Store.newsSince(favs.map((r) => r.id), new Date(Date.now() - 7 * 864e5).toISOString());
        if (n.length) {
          n.sort((a, b) => (b.at > a.at ? 1 : -1));
          const p = n.filter((x) => x.kind === 'photo').length;
          out.push({ id: 'news:' + String(n[0].at).slice(0, 16), icon: icon('camera'), road: n[0].road, at: n[0].at,
            title: t('alNews'), sub: t('alNewsSub').replace('{p}', p).replace('{r}', n.length - p).replace('{n}', (byId[n[0].road] || {}).name || '') });
        }
      } catch (e) { /* senza novità */ }
    }
    return out.sort((a, b) => (String(b.at) > String(a.at) ? 1 : -1));
  }
  let alertsCache = null;
  async function refreshBell() {
    const list = (alertsCache = await computeAlerts());
    const read = lsGet('touge.alertsRead', []), n = list.filter((a) => !read.includes(a.id)).length;
    const b = $('#bell .bell-n');
    if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  }
  function openAlerts() {
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('bell')} ${t('alerts')}</h2><button class="link" data-close>${t('close')}</button></div>
      <div class="al-list" id="al-list"><p class="muted small">${t('alertsLoading')}</p></div>`);
    sh.classList.add('al-sheet');
    const paint = (list) => {
      const read = lsGet('touge.alertsRead', []);
      $('#al-list', sh).innerHTML = list.length ? list.map((a, i) => `
        <button class="al ${read.includes(a.id) ? '' : 'new'}" data-i="${i}"><span class="al-ic">${a.icon}</span>
          <span class="al-txt"><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span>${icon('chev', 'day-chev')}</button>`).join('')
        : `<p class="empty">${t('noAlerts')}</p>`;
      lsSet('touge.alertsRead', [...new Set(read.concat(list.map((a) => a.id)))].slice(-200));
      const bn = $('#bell .bell-n'); if (bn) bn.hidden = true;
      $$('[data-i]', sh).forEach((b) => (b.onclick = () => {
        const a = list[+b.dataset.i];
        sh.remove();
        if (a.road) return go('road-' + a.road);
        if (a.near) { filters.time = a.near; filters.sort = 'near'; if (location.hash === '#explore') route(); else go('explore'); }
      }));
    };
    if (alertsCache) paint(alertsCache);
    computeAlerts().then((l) => { alertsCache = l; if (document.body.contains(sh)) paint(l); });
  }

  // push: possibili solo nell'app online, con il servizio configurato (chiave pubblica in config.js)
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const vapidKey = () => (window.TOUGE_CONFIG && window.TOUGE_CONFIG.vapidPublicKey) || '';
  function pushState() {
    if (window.TOUGE_ARTIFACT || !Auth.cloud) return 'nobrowser';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS && !standalone() ? 'ios' : 'nobrowser';
    if (!vapidKey()) return 'soon';
    if (Notification.permission === 'denied') return 'denied';
    return Store.notifyPrefs().push && Notification.permission === 'granted' ? 'on' : 'off';
  }
  const b64u = (s) => { const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  // da chiamare direttamente nel tocco: il permesso va chiesto subito
  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast(t('pushDenied')); return false; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(vapidKey()) }));
      await Store.savePushSub(sub.toJSON());
      await Store.setNotifyPrefs({ push: true }, startLL(), lang);
      toast(t('pushDone'));
      return true;
    } catch (e) { toast(t('syncError')); return false; }
  }
  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if (sub) { await Store.removePushSub(sub.endpoint); await sub.unsubscribe(); }
    } catch (e) { /* ok */ }
    await Store.setNotifyPrefs({ push: false }, startLL(), lang).catch(() => {});
    toast(t('pushStopped'));
  }
  // al primo ♥: invito (una volta sola) ad accendere le notifiche
  function maybeAskNotify() {
    if (lsGet('touge.notifyAsked', false) || Store.favorites().length !== 1) return;
    lsSet('touge.notifyAsked', true);
    setTimeout(openNotifyAsk, 700);
  }
  function openNotifyAsk() {
    const st = pushState(), can = st === 'off';
    const why = { ios: 'pushIos', soon: 'pushSoon', nobrowser: 'pushNoBrowser', denied: 'pushDenied' }[st];
    const sh = openSheet(`
      <div class="join">
        <div class="ask-bell">${icon('bell')}</div>
        <h2 class="h2">${t('askNotifyTitle')}</h2>
        <p class="join-text">${t('askNotifyText')}</p>
        ${can ? `<button class="btn primary" id="an-go">${icon('bell')} ${t('askNotifyCta')}</button>` : why ? `<p class="ask-why">${t(why)}</p>` : ''}
        <p class="muted small ask-inapp">${t('askNotifyInApp')}</p>
        <div class="join-foot"><span></span><button class="link muted" data-close>${can ? t('later') : 'OK'}</button></div>
      </div>`);
    sh.classList.add('join-sheet');
    const b = $('#an-go', sh);
    if (b) b.onclick = () => { enablePush().then(() => sh.remove()); };
  }
  // Pilota → Notifiche
  function renderNotif(box) {
    const st = pushState(), P = Store.notifyPrefs();
    const msg = { on: 'pushOn', off: 'pushOff', ios: 'pushIos', nobrowser: 'pushNoBrowser', soon: 'pushSoon', denied: 'pushDenied' }[st];
    const sw = (attr, on) => `<label class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''} /><span></span></label>`;
    const near = `<div class="chips wrap nt-near">${[60, 120, 180].map((v) => `<button class="chip ${P.nearMin === v ? 'on' : ''}" data-nm="${v}">${t('within').replace('{t}', fmtDur(v))}</button>`).join('')}</div>
      <small>${origin ? `${icon('pin')} ${esc(originLabel())} · <button class="link" data-org>${t('change')}</button>` : `${t('nNearNeed')} <button class="link" data-org>${t('setOrigin')}</button>`}</small>`;
    box.innerHTML = `
      <div class="nt-row nt-push"><span class="nt-ic">${icon('bell')}</span><div class="nt-txt"><b>${t('pushTitle')}</b><small>${t(msg)}</small></div>${st === 'on' || st === 'off' ? sw('data-push', st === 'on') : ''}</div>
      ${[['reopen', 'nReopen', 'nReopenSub'], ['wxFav', 'nWxFav', 'nWxFavSub'], ['wxNear', 'nWxNear', 'nWxNearSub'], ['news', 'nNews', 'nNewsSub']].map(([k, a, b]) => `
        <div class="nt-row"><div class="nt-txt"><b>${t(a)}</b><small>${t(b)}</small>${k === 'wxNear' && P.wxNear ? near : ''}</div>${sw(`data-k="${k}"`, P[k])}</div>`).join('')}`;
    const save = (p) => Store.setNotifyPrefs(p, startLL(), lang).then(() => renderNotif(box), () => toast(t('syncError')));
    $$('[data-k]', box).forEach((i) => (i.onchange = () => save({ [i.dataset.k]: i.checked })));
    $$('[data-nm]', box).forEach((b) => (b.onclick = () => save({ nearMin: +b.dataset.nm })));
    $$('[data-org]', box).forEach((b) => (b.onclick = () => openOriginSheet(false, () => renderNotif(box))));
    const p = $('[data-push]', box);
    if (p) p.onchange = () => (p.checked ? enablePush() : disablePush()).then(() => renderNotif(box));
  }

  // ───────────── ITINERARI ─────────────
  let draft = null; // itinerario in modifica (anche nuovo, non ancora salvato)
  const curated = (id) => {
    const c = (window.TRIPS || []).find((x) => x.id === id);
    return c && { id: c.id, curated: true, title: c[lang].title, desc: c[lang].desc, stops: c.stops.map((r) => ({ r })), hours: c.hours || 5, public: true, user: 'TOUGE' };
  };
  const allCurated = () => (window.TRIPS || []).map((c) => curated(c.id));
  const tripRoads = (tr) => tr.stops.map((s) => byId[s.r]).filter(Boolean);
  const startLL = () => (origin ? origin.ll : null);
  // curati: l'app sceglie ordine e lati (dalla tua partenza, se c'è); dei piloti: ordine salvato, lati calcolati
  const tripSeq = (tr) => (tr.curated ? TougeTrip.order(tripRoads(tr), startLL()) : TougeTrip.orient(tripRoads(tr), startLL()));
  const r5 = (m) => Math.max(5, Math.round(m / 5) * 5);
  function tripQuick(tr) {
    let km = 0, cur = null;
    const seq = tripSeq(tr);
    seq.forEach((s) => { if (cur) km += TougeTrip.hav(cur, TougeTrip.entry(s.r, s.rev)) * 1.3; km += s.r.km; cur = TougeTrip.exit(s.r, s.rev); });
    return { n: seq.length, km: Math.round(km) };
  }
  function tripCard(tr) {
    const roads = tripRoads(tr);
    if (!roads.length) return '';
    const q = tripQuick(tr), who = tr.curated ? t('byTouge') : t('byPilot').replace('{n}', tr.user);
    return `<article class="trip-card ${tr.curated ? 'cur' : ''}" data-trip="${esc(tr.id)}">
      <div class="trip-art">${roadArt(roads[0], { w: 260, h: 150 })}<span class="trip-n"><b>${q.n}</b> ${t('passesN')}</span>
        ${tr.mine ? `<span class="trip-vis ${tr.public ? 'pub' : ''}">${t(tr.public ? 'tripPublicOn' : 'tripPrivateOn')}</span>` : ''}</div>
      <div><h4>${esc(tr.title)}</h4><span class="muted xs">≈ ${fmt(q.km)} km · ${esc(who)}</span></div></article>`;
  }
  const newTripCard = () => `<button class="trip-card trip-new" data-newtrip>${icon('plus')}<b>${t('createTrip')}</b><span>${t('createTripSub')}</span></button>`;
  function bindTripCards(root) {
    $$('[data-trip]', root).forEach((c) => (c.onclick = () => go('trip-' + c.dataset.trip)));
    $$('[data-newtrip]', root).forEach((b) => (b.onclick = () => startNewTrip()));
  }
  function startNewTrip(firstRoad) {
    if (!Auth.current()) return openJoinSheet('trip', firstRoad);
    draft = { title: '', stops: firstRoad ? [{ r: firstRoad.id }] : [], hours: 5, manual: false, public: false };
    go('tripedit');
  }
  const autoOrder = (stops) => TougeTrip.order(stops.map((s) => byId[s.r]).filter(Boolean), null).map((s) => ({ r: s.r.id }));

  // "Aggiungi a un itinerario" dalla pagina strada
  function openAddToTrip(r) {
    if (!Auth.current()) return openJoinSheet('trip', r);
    const mine = Store.myTrips();
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('route')} ${t('addToTrip')}</h2><button class="link" data-close>${t('close')}</button></div>
      <div class="att-list">${mine.map((tr) => `<button class="att" data-id="${esc(tr.id)}"><b>${esc(tr.title)}</b><span>${tr.stops.length} ${t('passesN')}${tr.stops.some((s) => s.r === r.id) ? ' · ✓' : ''}</span></button>`).join('')}</div>
      <button class="btn primary" id="att-new">${icon('plus')} ${t('newTripWith')}</button>`);
    $('#att-new', sh).onclick = () => { sh.remove(); startNewTrip(r); };
    $$('[data-id]', sh).forEach((b) => (b.onclick = async () => {
      const tr = mine.find((x) => x.id === b.dataset.id);
      if (tr.stops.some((s) => s.r === r.id)) return toast(t('alreadyIn').replace('{t}', tr.title));
      if (tr.stops.length >= TougeTrip.MAX) return toast(t('tripMax'));
      let stops = tr.stops.concat({ r: r.id });
      if (!tr.manual) stops = autoOrder(stops);
      try { await Store.saveTrip(Object.assign({}, tr, { stops })); toast(t('addedTo').replace('{t}', tr.title)); sh.remove(); }
      catch (e) { toast(t('syncError')); }
    }));
  }

  // pagina itinerario: riepilogo, mappa, giorni con i bottoni Google Maps
  async function viewTrip(id, user) {
    app.innerHTML = `<p class="empty">${t('tripLoading')}</p>`;
    const tr = id.startsWith('c-') ? curated(id) : await Store.getTrip(id).catch(() => null);
    if (location.hash !== '#trip-' + id) return;
    const backBtn = `<button class="round-btn back" onclick="history.length > 1 ? history.back() : (location.hash='#explore')" aria-label="back">${icon('back')}</button>`;
    if (!tr || tripRoads(tr).length < 1) { app.innerHTML = `<header class="top">${backBtn}</header><p class="empty">${t('tripNotFound')}</p>`; return; }
    let hours = tr.hours || 5;
    const seq = tripSeq(tr), first = seq[0].r;
    const who = tr.curated ? t('byTouge') : t('byPilot').replace('{n}', tr.user) + (tr.car ? ' · ' + tr.car : '');
    app.innerHTML = `
      <section class="detail trip">
        <div class="detail-hero trip-hero">${roadArt(first, { w: 400, h: 300, stripes: true })}<div class="hero-shade"></div>
          ${backBtn}
          <div class="detail-title">
            <span class="kicker">峠 ${t('itinerary')}</span>
            <h1>${esc(tr.title)}</h1>
            <div class="small trip-who">${esc(who)}</div>
          </div>
        </div>
        <div class="stats four trip-stats">
          <div class="stat">${icon('mountain')}<b>${seq.length}</b><span>${t('passesN')}</span></div>
          <div class="stat">${icon('road')}<b id="ts-km">—</b><span>km</span></div>
          <div class="stat">${icon('clock')}<b id="ts-time">—</b><span>${t('drive')}</span></div>
          <div class="stat">${icon('flag')}<b id="ts-days">—</b><span>${t('daysN')}</span></div>
        </div>
        <div class="pad">
          ${tr.desc ? `<p class="desc">${esc(tr.desc)}</p>` : ''}
          <div class="trip-hours"><span>${t('hoursPerDay')}</span><div class="chips wrap">${[3, 5, 7].map((h) => `<button class="chip ${h === hours ? 'on' : ''}" data-h="${h}">${h}h</button>`).join('')}</div></div>
          <p class="trip-from">${origin ? t('tripFrom').replace('{c}', esc(originLabel())) : t('tripNoOrigin')} <button class="link" id="trip-org">${t(origin ? 'change' : 'setOrigin')}</button></p>
          <div class="mini-map" id="tripmap"></div>
          <p class="muted small" id="trip-note">${t('tripLoading')}</p>
          <div id="trip-days"></div>
          <div class="trip-actions" id="trip-actions"></div>
          <p class="disclaimer">${t('disclaimer')}</p>
        </div>
      </section>`;

    // mappa: tracciati dei passi in rosso, trasferimenti tratteggiati
    let tmap = null, linkLayer = null;
    if (window.L) {
      tmap = map = L.map('tripmap', { zoomControl: true, scrollWheelZoom: false, preferCanvas: true });
      baseLayer(map);
      tmap.fitBounds(L.latLngBounds(seq.flatMap((s) => s.r.wp)), { padding: [24, 24] });
      linkLayer = L.layerGroup().addTo(tmap);
      seq.forEach((s, i) => {
        L.marker(summit(s.r), { icon: L.divIcon({ className: '', html: `<div class="wp trip-wp">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(tmap).bindTooltip(`${i + 1}. ${s.r.name}`);
        loadRoute(s.r).then(({ coords }) => { if (map === tmap) L.polyline(coords, { color: '#e2231a', weight: 4 }).addTo(tmap); });
      });
    }
    const drawLinks = (p) => {
      if (!linkLayer || map !== tmap) return;
      linkLayer.clearLayers();
      if (p.line) L.polyline(p.line, { color: '#ffcc00', weight: 3, opacity: 0.8, dashArray: '2 7' }).addTo(linkLayer);
      else p.stops.forEach((s, i) => { if (i) L.polyline([TougeTrip.exit(p.stops[i - 1].r, p.stops[i - 1].rev), TougeTrip.entry(s.r, s.rev)], { color: '#ffcc00', weight: 3, dashArray: '2 7' }).addTo(linkLayer); });
    };

    const dirOf = (s) => {
      const a = s.r.wp[0], b = s.r.wp[s.r.wp.length - 1];
      return compass(bearing([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], TougeTrip.entry(s.r, s.rev)));
    };
    let last = null;
    const renderPlan = (p) => {
      last = p;
      $('#ts-km').innerHTML = fmt(Math.round(p.km));
      $('#ts-time').textContent = fmtDur(r5(p.min));
      $('#ts-days').textContent = p.days.length;
      $('#trip-note').textContent = p.exact ? t('tripExact') : t('tripEstimate');
      $('#trip-days').innerHTML = p.days.map((d, i) => `
        <section class="day">
          <header class="day-head"><b>${t('day')} ${i + 1}</b><span>≈ ${fmtDur(r5(d.min))} ${t('drive')} · ${fmt(Math.round(d.km))} km</span></header>
          <ol class="day-stops">${d.stops.map((s) => `
            ${s.inMin ? `<li class="day-move">${icon('go')}<span>${t('transfer')} ≈ ${fmtDur(r5(s.inMin))} · ${fmt(Math.round(s.inKm))} km</span></li>` : ''}
            <li class="day-stop ${Store.isDriven(s.r.id) ? 'is-driven' : ''}" data-go="${s.r.id}"><span class="day-no">${Store.isDriven(s.r.id) ? CHK : ''}${s.r.no}</span>
              <div><b>${esc(s.r.name)}</b><small>${t('entryFrom').replace('{d}', dirOf(s))} · ${fmt(s.r.alt)} m · ${Math.round(s.roadKm)} km</small></div>${icon('chev', 'day-chev')}</li>`).join('')}
          </ol>
          <div class="day-go">${d.links.map((u, k) => `<a class="btn primary sm" href="${u}" target="_blank" rel="noopener">${icon('go')} ${t('letsGo')}${d.links.length > 1 ? ` · ${t('legN')} ${k + 1}` : ''}</a>`).join('')}</div>
        </section>`).join('');
      $$('#trip-days [data-go]').forEach((c) => (c.onclick = () => go('road-' + c.dataset.go)));
      drawLinks(p);
    };
    const plan = async (exact) => {
      const p = await TougeTrip.plan(seq, startLL(), hours, exact);
      if (location.hash === '#trip-' + id) renderPlan(p);
    };
    plan(false).then(() => { if (!OFFLINE_MAP) plan(true); });

    $$('[data-h]').forEach((b) => (b.onclick = () => {
      hours = +b.dataset.h;
      $$('[data-h]').forEach((x) => x.classList.toggle('on', x === b));
      plan(!!(last && last.exact));
      if (tr.mine) Store.saveTrip(Object.assign({}, tr, { hours })).catch(() => {});
    }));
    $('#trip-org').onclick = () => openOriginSheet(false, () => route());

    // azioni: proprietario → modifica / pubblica / elimina; altri → copia, segnala; per tutti → invia link
    const acts = $('#trip-actions');
    const link = location.origin + location.pathname + '#trip-' + id;
    acts.innerHTML = (tr.mine ? `
        <button class="btn ghost" id="ta-edit">${icon('edit')} ${t('tripEditBtn')}</button>
        <label class="te-pub"><input type="checkbox" id="ta-pub" ${tr.public ? 'checked' : ''} /><span>${t('tripPublic')}</span></label>`
      : `<button class="btn ghost" id="ta-copy">${icon('plus')} ${t('copyTrip')}</button>`) +
      `<button class="btn ghost" id="ta-link">${icon('share')} ${t('shareRoad')}</button>` +
      (tr.mine ? `<button class="link danger" id="ta-del">${t('deleteTrip')}</button>` : !tr.curated ? `<button class="link rv-flag" id="ta-flag">${t('reportTrip')}</button>` : '');
    const on = (sel, fn) => { const el = $(sel, acts); if (el) el.onclick = fn; };
    on('#ta-edit', () => { draft = JSON.parse(JSON.stringify(tr)); go('tripedit-' + tr.id); });
    const pub = $('#ta-pub', acts);
    if (pub) pub.onchange = async () => {
      try { await Store.saveTrip(Object.assign({}, tr, { public: pub.checked, hours })); tr.public = pub.checked; toast(t('tripSaved')); }
      catch (e) { pub.checked = !pub.checked; toast(t('syncError')); }
    };
    on('#ta-copy', async () => {
      if (!Auth.current()) return openJoinSheet('trip', first);
      try {
        const nid = await Store.saveTrip({ title: tr.title.slice(0, 60), stops: seq.map((s) => ({ r: s.r.id })), hours, manual: false, public: false });
        toast(t('tripCopied')); go('trip-' + nid);
      } catch (e) { toast(t('syncError')); }
    });
    on('#ta-link', () => {
      if (navigator.share) navigator.share({ title: 'TOUGE · ' + tr.title, text: t('shareRoadText'), url: link }).catch(() => {});
      else copyLink(link);
    });
    on('#ta-del', async (e) => {
      const b = e.currentTarget;
      if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('confirmReport'); setTimeout(() => { b.classList.remove('armed'); b.textContent = t('deleteTrip'); }, 4000); return; }
      try { await Store.deleteTrip(tr.id); garageTab = 'trip'; go('garage'); } catch (err) { toast(t('syncError')); }
    });
    on('#ta-flag', async (e) => {
      if (!Auth.current()) return openJoinSheet('flag', first);
      const b = e.currentTarget;
      if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = t('confirmReport'); setTimeout(() => { b.classList.remove('armed'); b.textContent = t('reportTrip'); }, 4000); return; }
      try { await Store.reportTrip(tr.id); toast(t('reported')); go('explore'); } catch (err) { toast(t('syncError')); }
    });
  }

  // editor: nome, passi (ordine automatico finché non li sposti a mano), pubblico/privato
  function viewTripEdit(id, user) {
    if (!user) { go('explore'); setTimeout(() => openJoinSheet('trip'), 400); return; }
    if (id) {
      if (!draft || draft.id !== id) {
        const tr = Store.myTrips().find((x) => x.id === id);
        if (!tr) return go('garage');
        draft = JSON.parse(JSON.stringify(tr));
      }
    } else if (!draft || draft.id) draft = { title: '', stops: [], hours: 5, manual: false, public: false };
    app.innerHTML = `
      <header class="top te-top"><button class="round-btn" id="te-back" aria-label="back">${icon('back')}</button><h1 class="h1">${t(id ? 'editTrip' : 'newTrip')}</h1></header>
      <div class="pad te">
        <div class="field"><div class="field-top"><label for="te-title">${t('tripTitle')}</label></div>
          <input id="te-title" type="text" maxlength="60" placeholder="${t('tripTitlePh')}" value="${esc(draft.title)}" /></div>
        <h2 class="h2">${t('tripStops')} <span class="muted small" id="te-n"></span></h2>
        <ol class="te-stops" id="te-stops"></ol>
        <button class="btn ghost te-add" id="te-add">${icon('plus')} ${t('addPass')}</button>
        <p class="muted small te-hint">${t('autoOrderHint')} <button class="link" id="te-auto">${t('autoOrder')}</button></p>
        <label class="te-pub"><input type="checkbox" id="te-pub" ${draft.public ? 'checked' : ''} /><span>${t('tripPublic')}</span></label>
        <button class="btn primary" id="te-save">${t('saveTrip')}</button>
        ${id ? `<button class="link danger te-del" id="te-del">${t('deleteTrip')}</button>` : ''}
      </div>`;
    const renderStops = () => {
      const n = draft.stops.length;
      $('#te-n').textContent = n ? `· ${n}` : '';
      $('#te-stops').innerHTML = n ? draft.stops.map((s, i) => {
        const r = byId[s.r];
        if (!r) return '';
        return `<li class="te-stop"><span class="te-no">${i + 1}</span>
          <div class="te-info"><b>${esc(r.name)}</b><small>${flag(r.country)} ${esc(r.region)} · ${fmt(r.alt)} m</small></div>
          <div class="te-btns"><button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="su">▲</button><button data-down="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="giù">▼</button><button data-x="${i}" aria-label="${t('close')}">✕</button></div></li>`;
      }).join('') : `<p class="empty">${t('tripMin')}</p>`;
      const move = (i, d) => { const a = draft.stops; [a[i], a[i + d]] = [a[i + d], a[i]]; draft.manual = true; renderStops(); };
      $$('[data-up]').forEach((b) => (b.onclick = () => move(+b.dataset.up, -1)));
      $$('[data-down]').forEach((b) => (b.onclick = () => move(+b.dataset.down, 1)));
      $$('[data-x]').forEach((b) => (b.onclick = () => { draft.stops.splice(+b.dataset.x, 1); renderStops(); }));
    };
    renderStops();
    $('#te-title').oninput = (e) => (draft.title = e.target.value);
    $('#te-pub').onchange = (e) => (draft.public = e.target.checked);
    $('#te-back').onclick = () => (history.length > 1 ? history.back() : go('garage'));
    $('#te-auto').onclick = () => { draft.stops = autoOrder(draft.stops); draft.manual = false; renderStops(); };
    $('#te-add').onclick = () => openPassPicker(() => { if (!draft.manual) draft.stops = autoOrder(draft.stops); renderStops(); });
    $('#te-save').onclick = async (e) => {
      const b = e.currentTarget;
      draft.title = $('#te-title').value.trim();
      if (!draft.title) { toast(t('errTripTitle')); return $('#te-title').focus(); }
      if (draft.stops.length < 2) return toast(t('tripMin'));
      b.classList.add('loading');
      try { const nid = await Store.saveTrip(draft); draft = null; toast(t('tripSaved')); go('trip-' + nid); }
      catch (err) { b.classList.remove('loading'); toast(t(err.message === 'errRateLimit' ? 'errRateLimit' : 'syncError')); }
    };
    const del = $('#te-del');
    if (del) del.onclick = async () => {
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = t('confirmReport'); setTimeout(() => { del.classList.remove('armed'); del.textContent = t('deleteTrip'); }, 4000); return; }
      try { await Store.deleteTrip(id); draft = null; garageTab = 'trip'; go('garage'); } catch (err) { toast(t('syncError')); }
    };
  }

  // scelta dei passi: ricerca, e senza ricerca prima quelli vicini all'ultimo passo
  function openPassPicker(onChange) {
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('plus')} ${t('addPass')}</h2><button class="link" data-close>OK</button></div>
      <label class="search org-q">${icon('search')}<input id="pp-q" type="search" placeholder="${t('searchPass')}" autocomplete="off" /></label>
      <p class="pp-h" id="pp-h"></p>
      <div class="pp-list" id="pp-list"></div>`);
    sh.classList.add('pp-sheet');
    const paint = () => {
      const q = norm($('#pp-q', sh).value.trim()), inTrip = new Set(draft.stops.map((s) => s.r));
      const lastR = draft.stops.length ? byId[draft.stops[draft.stops.length - 1].r] : null;
      const dist = (r) => (lastR ? TougeTrip.hav(summit(lastR), summit(r)) : 0);
      let list = ROADS.filter((r) => !q || norm(r.name + ' ' + r.region).includes(q));
      list = lastR && !q ? list.sort((a, b) => dist(a) - dist(b)) : list.sort((a, b) => a.name.localeCompare(b.name));
      $('#pp-h', sh).textContent = lastR && !q ? t('nearLast') : '';
      $('#pp-list', sh).innerHTML = list.slice(0, 40).map((r) => `
        <button class="pp-item ${inTrip.has(r.id) ? 'on' : ''}" data-r="${r.id}">${flag(r.country)}
          <div><b>${esc(r.name)}</b><small>${esc(r.region)} · ${fmt(r.alt)} m${lastR && !q && r.id !== lastR.id ? ` · ${Math.round(dist(r))} km` : ''}</small></div>${icon(inTrip.has(r.id) ? 'check' : 'plus', 'pp-ic')}</button>`).join('');
      $$('[data-r]', sh).forEach((b) => (b.onclick = () => {
        const i = draft.stops.findIndex((s) => s.r === b.dataset.r);
        if (i >= 0) draft.stops.splice(i, 1);
        else if (draft.stops.length >= TougeTrip.MAX) return toast(t('tripMax'));
        else { draft.stops.push({ r: b.dataset.r }); toast('+ ' + byId[b.dataset.r].name); }
        onChange(); paint();
      }));
    };
    $('#pp-q', sh).oninput = paint;
    paint();
  }

  // ───────────── PARTIAMO! ─────────────
  // Chiede ogni volta da che lato entrare (suggerendo il più vicino) e apre Google Maps:
  // partenza dalla posizione attuale (Google la usa da sé), poi ingresso → vetta → uscita.
  function bearing(a, b) {
    const rad = Math.PI / 180, y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  }
  const compass = (deg) => t('dirs')[Math.round(deg / 45) % 8];
  // tempo di guida stimato da una distanza in linea d'aria (strade reali ≈ +30%, più veloci sulle lunghe distanze)
  function estDrive(km) {
    const road = km * 1.3, v = road < 30 ? 40 : road < 100 ? 60 : 80;
    return Math.max(5, Math.round((road / v) * 60 / 5) * 5);
  }
  const fmtDur = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`);
  const gmapsRoute = (pts) => {
    const dest = pts[pts.length - 1], via = pts.slice(0, -1);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.join(',')}&waypoints=${via.map((p) => p.join(',')).join('%7C')}&travelmode=driving`;
  };

  function openGoSheet(r) {
    const a = r.wp[0], b = r.wp[r.wp.length - 1];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const sides = [
      { entry: a, exit: b, pts: r.wp.slice() },
      { entry: b, exit: a, pts: r.wp.slice().reverse() },
    ].map((x) => Object.assign(x, { from: compass(bearing(mid, x.entry)), to: compass(bearing(mid, x.exit)) }));
    const other = (p) => `<a href="https://waze.com/ul?ll=${p.join(',')}&navigate=yes" target="_blank" rel="noopener" class="link">Waze</a> · <a href="https://maps.apple.com/?daddr=${p.join(',')}&dirflg=d" target="_blank" rel="noopener" class="link">Apple Mappe</a>`;
    const sh = openSheet(`
      <div class="sheet-head"><h2 class="h2">${icon('go')} ${t('goTitle')}</h2><button class="link" data-close>${t('close')}</button></div>
      <p class="go-hint">${t('goHint')}</p>
      <div class="go-opts">${sides.map((x, i) => `
        <a class="go-opt" data-side="${i}" href="${gmapsRoute(x.pts)}" target="_blank" rel="noopener">
          <span class="go-badge" hidden>${t('goNearest')}</span>
          <span class="go-dir">${t('goFrom')} ${x.from}</span>
          <span class="go-path">${t('goPath').replace('{dir}', x.to).replace('{km}', r.km)}</span>
          <span class="go-eta" data-eta="${i}">${t('goLocating')}</span>
        </a>`).join('')}
      </div>
      <p class="go-other">${t('goOther')}<br><span id="go-other">${other(sides[0].entry)}</span></p>`);
    sh.classList.add('go-sheet');
    $$('.go-opt', sh).forEach((el) => (el.onclick = () => setTimeout(() => sh.remove(), 300)));
    const noLoc = () => $$('[data-eta]', sh).forEach((el) => (el.textContent = t('goNoLoc')));
    if (!navigator.geolocation) return noLoc();
    navigator.geolocation.getCurrentPosition((p) => {
      const me = [p.coords.latitude, p.coords.longitude];
      const km = sides.map((x) => haversine(me, x.entry));
      const near = km[0] <= km[1] ? 0 : 1;
      sides.forEach((x, i) => {
        const el = $(`[data-eta="${i}"]`, sh);
        if (el) el.textContent = t('goEta').replace('{t}', fmtDur(estDrive(km[i]))).replace('{km}', fmt(Math.round(km[i] * 1.3)));
      });
      const best = $(`.go-opt[data-side="${near}"]`, sh);
      if (best) { best.classList.add('near'); $('.go-badge', best).hidden = false; $('.go-opts', sh).prepend(best); }
      const o = $('#go-other', sh); if (o) o.innerHTML = other(sides[near].entry);
    }, noLoc, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
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
    const els = { stamp: true, postmark: true, greet: true, plate: true, car: true };
    if (saved.els) TS.ELEMENTS.forEach((k) => { if (typeof saved.els[k] === 'boolean') els[k] = saved.els[k]; });
    const info = {
      drivenAt: Store.driven()[r.id], plateLabel: Store.isDriven(r.id) ? t(Store.isVerified(r.id) ? 'verified' : 'driven') : t('markDriven'), hairpinsLabel: t('hairpins'),
      region: r.region, country: cname(r.country), tagline: t('tagline'), greet: t('pcGreet'),
    };
    // la foto dell'auto entra nella cartolina come data URL (serve anche per PNG e SVG scaricati)
    const me = Auth.current();
    const carUrl = me && me.carPhoto ? Store.photoUrl(me.carPhoto) : '';
    const elList = TS.ELEMENTS.filter((k) => k !== 'car' || carUrl);
    info.carName = (me && me.car) || t('yourCar');

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
        <div class="pc-els">${elList.map((k) => `<button class="chip pc-el" data-el="${k}">${t('pcEl_' + k)}</button>`).join('')}</div>
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
    const key = () => style + JSON.stringify(els) + (info.carPhoto ? 'c' : '');
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
    if (carUrl) {
      try {
        info.carPhoto = carUrl.startsWith('data:') ? carUrl : await TougePhoto.toDataURL(await fetch(carUrl).then((x) => x.blob()));
        if (document.body.contains(wrap)) draw();
      } catch (e) { /* senza auto */ }
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
        <button class="${garageTab === 'trip' ? 'on' : ''}" data-t="trip">${icon('route')} ${t('tripsTab')} (${Store.myTrips().length})</button>
      </div>
      <div class="grid" id="glist"></div>`;
    const render = () => {
      if (garageTab === 'trip') {
        const mine = Store.myTrips();
        $('#glist').innerHTML = newTripCard() + (mine.length ? mine.map(tripCard).join('') : `<p class="empty">${t('emptyTrips')}</p>`);
        $('#glist').classList.add('trip-grid');
        return bindTripCards($('#glist'));
      }
      $('#glist').classList.remove('trip-grid');
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
          <button class="lic-photo" id="p-photo" aria-label="${t('profilePhoto')}">${avatar(user, 78)}<span class="cam">${icon('camera')}</span></button>
          <div><h1 class="h1">${esc(user.name)}</h1><p>${t('car').toUpperCase()}: ${esc(user.car || '—')}</p><p>${t('memberSince').toUpperCase()}: ${since}</p></div>
        </div>
        <div class="livery"></div>
      </section>
      ${user.photo ? `<p class="pad-x lic-rm"><button class="link" id="p-photo-rm">${t('removePhoto')}</button></p>` : ''}

      <h2 class="h2 pad-x">${t('yourCar')}</h2>
      <section class="car-card">
        ${user.carPhoto
          ? `<button class="car-img" id="p-car" aria-label="${t('changeCarPhoto')}"><img src="${esc(Store.photoUrl(user.carPhoto))}" alt="${esc(user.car || t('yourCar'))}" /></button>`
          : `<button class="car-empty" id="p-car">${icon('camera')}<span>${t('addCarPhoto')}</span></button>`}
        <div class="car-info"><b>${esc(user.car || t('carNoName'))}</b>
          ${user.carPhoto ? `<span><button class="link" id="p-car2">${t('changeCarPhoto')}</button> · <button class="link" id="p-car-rm">${t('removePhoto')}</button></span>` : ''}</div>
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

      <h2 class="h2 pad-x">${t('notifications')}</h2>
      <section class="notif" id="notif"></section>

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
    renderNotif($('#notif'));
    const ef = $('#edit-form');
    ef.name.value = user.name; ef.car.value = user.car || '';
    $('#m-edit').onclick = () => (ef.hidden = !ef.hidden);
    $('#p-photo').onclick = () => pickImage().then((f) => saveProfilePhoto('photo', f));
    $$('#p-car, #p-car2').forEach((b) => (b.onclick = () => pickImage().then((f) => saveProfilePhoto('carPhoto', f))));
    const rmP = $('#p-photo-rm'); if (rmP) rmP.onclick = () => saveProfilePhoto('photo', null);
    const rmC = $('#p-car-rm'); if (rmC) rmC.onclick = () => saveProfilePhoto('carPhoto', null);
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
