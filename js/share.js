/* TOUGE App — cartolina della strada (2:3, 1200×1800) e storia Instagram (9:16, 1080×1920).
 * Tutto è disegnato in SVG: la stessa grafica serve per l'anteprima nella pagina, per il file SVG
 * scaricabile e (rasterizzata su canvas) per il PNG. Nei file esportati i caratteri vengono
 * incorporati (Google Fonts, solo le lettere usate); se non si riesce si usano quelli di sistema.
 *
 * Stili: retro (cartolina d'epoca giapponese) · vapor (vaporwave) · cyber (cyberpunk notte).
 * Elementi accendibili: stamp (francobollo 峠) · postmark (timbro) · greet ("Saluti da…") · plate (placca rally).
 */
(function () {
  const PW = 1200, PH = 1800; // cartolina
  const SW = 1080, SH = 1920; // storia
  const AX = 40, AY = 40, AW = 1120, AH = 1300; // finestra dell'illustrazione
  const PLATE = 'M8 60 L91 60 A160 60 0 0 1 411 60 L494 60 Q502 60 502 68 L502 218 Q502 226 494 226 L8 226 Q0 226 0 218 L0 68 Q0 60 8 60 Z';
  const RED = '#e3262c', CREAM = '#f6efe0';
  const F = {
    anton: "Anton, Impact, 'Arial Narrow', sans-serif",
    league: "'League Gothic', 'Arial Narrow', sans-serif",
    josefin: "'Josefin Sans', Futura, sans-serif",
    mono: "'Space Mono', ui-monospace, Consolas, monospace",
    jp: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
    bodoni: "'Bodoni Moda', Didot, 'Times New Roman', serif",
  };
  const THEMES = {
    retro: { art: 'retro', inLetters: 'dusk', card: '#f6efe0', band: '#f6efe0', title: '#1d1a16', shadow: RED, sub: '#7a705f', data: '#1d1a16', greet: '#1d1a16', post: '#a8322b', stampBg: RED, stampFg: CREAM, frame: '#1d1a16', logo: '#1d1a16', bars: ['#1b3a8c', '#3fa9f5', RED], storyBg: '#efe6d2', storyInk: '#1d1a16', storyMuted: '#7a705f' },
    vapor: { art: 'vapor', inLetters: 'retro', card: '#fff4fb', band: '#2a0e5c', title: '#fff4fb', shadow: '#ff4fb0', sub: '#c9a6ff', data: '#3ff5ff', greet: '#2a0e5c', post: '#2a0e5c', stampBg: '#3ff5ff', stampFg: '#2a0e5c', frame: '#2a0e5c', logo: '#fff4fb', bars: ['#3ff5ff', '#ff9fc4', '#ff4fb0'], storyBg: '#1c0b3a', storyInk: '#fff4fb', storyMuted: '#2a0e5c', scan: true },
    cyber: { art: 'cyber', inLetters: 'vapor', card: '#0b0c16', band: '#0b0c16', title: '#e8f7ff', shadow: '#ff2bd6', sub: '#8a93c4', data: '#00e5ff', greet: '#ff2bd6', post: '#00e5ff', stampBg: '#ff2bd6', stampFg: '#060714', frame: '#00e5ff', logo: '#e8f7ff', bars: ['#00e5ff', '#0b0c16', '#ff2bd6'], storyBg: '#05060f', storyInk: '#e8f7ff', storyMuted: '#8a93c4', scan: true, glow: true },
  };
  let uid = 0;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let mctx = null;
  function measure(text, weight, size, family, italic) {
    mctx = mctx || document.createElement('canvas').getContext('2d');
    mctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
    return mctx.measureText(text).width;
  }
  // <text>: se il testo supera max viene compresso in orizzontale (come sulle placche)
  function T(x, y, text, o) {
    const wt = o.weight || 400;
    const tooWide = o.max && measure(text, wt, o.size, o.family, o.italic) > o.max;
    return `<text x="${x}" y="${y}" font-family="${esc(o.family)}" font-size="${o.size}" font-weight="${wt}"` +
      (o.italic ? ' font-style="italic"' : '') + ` fill="${o.fill || 'none'}" text-anchor="${o.anchor || 'middle'}"` +
      (o.ls ? ` letter-spacing="${o.ls}"` : '') + (tooWide ? ` textLength="${o.max}" lengthAdjust="spacingAndGlyphs"` : '') +
      (o.extra || '') + `>${esc(text)}</text>`;
  }

  // ── terreno delle atmosfere (inserito da roadArt tra montagne e strada)
  function vaporGrid(w, h, hz, sc) {
    let g = '';
    for (let i = 1; i <= 9; i++) { const t = i / 9, y = hz + (h - hz) * t * t; g += `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}"/>`; }
    for (let i = -8; i <= 8; i++) g += `<line x1="${(w / 2 + i * w * 0.02).toFixed(1)}" y1="${hz.toFixed(1)}" x2="${(w / 2 + i * w * 0.16).toFixed(1)}" y2="${h}"/>`;
    return `<g stroke="#3ff5ff" stroke-width="${(1.6 * sc).toFixed(2)}" opacity=".5">${g}</g>`;
  }
  function cityLights(w, h, hz, sc, r) {
    const cols = ['#00e5ff', '#ff2bd6', '#ffcc00'];
    let g = '';
    for (let i = 0; i < 70; i++) {
      const s = (1.5 + r() * 2.5) * sc;
      g += `<rect x="${(r() * w).toFixed(0)}" y="${(hz - h * 0.02 + r() * 0.25 * (h - hz)).toFixed(0)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${cols[i % 3]}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
    }
    return g;
  }
  function art(road, mood, x, y, w, h, extra) {
    const ground = mood === 'vapor' ? vaporGrid : mood === 'cyber' ? cityLights : null;
    return window.roadArt(road, { w, h, mood, ground })
      .replace(/<svg class="[^"]*"/, `<svg x="${x}" y="${y}" width="${w}" height="${h}"${extra || ''}`);
  }

  // ── placca rally (stessa forma della pagina strada)
  function plate(cx, cy, width, no, ddmm, year, title) {
    const s = width / 514;
    return `<g transform="translate(${cx} ${cy}) rotate(-6) scale(${s.toFixed(4)}) translate(-251 -113)">
      <path d="${PLATE}" transform="translate(6 8)" fill="#000" fill-opacity=".55" stroke="#000" stroke-opacity=".55" stroke-width="10" stroke-linejoin="round"/>
      <path d="${PLATE}" fill="${RED}" stroke="${CREAM}" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>
      <rect x="172" y="16" width="158" height="70" rx="8" fill="${CREAM}"/>
      ${T(251, 77, String(no), { size: 72, family: F.josefin, weight: 700, fill: RED, max: 136 })}
      ${T(164, 92, ddmm, { size: 50, family: F.league, fill: CREAM, anchor: 'end', max: 74 })}
      ${T(338, 92, year, { size: 50, family: F.league, fill: CREAM, anchor: 'start', max: 74 })}
      <text x="251" y="205" font-family="${esc(F.league)}" font-size="140" fill="${CREAM}" text-anchor="middle" textLength="470" lengthAdjust="spacingAndGlyphs">${esc(title)}</text>
    </g>`;
  }

  // ── francobollo dentellato con 峠
  function stamp(th, no, id) {
    const w = 208, h = 260, R = 9, step = 26;
    let holes = '';
    for (let i = step / 2; i < w; i += step) holes += `<circle cx="${i}" cy="0" r="${R}"/><circle cx="${i}" cy="${h}" r="${R}"/>`;
    for (let i = step / 2; i < h; i += step) holes += `<circle cx="0" cy="${i}" r="${R}"/><circle cx="${w}" cy="${i}" r="${R}"/>`;
    return `<g transform="translate(930 70) rotate(4 ${w / 2} ${h / 2})">
      <mask id="${id}sm" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 40}"><rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${holes}</g></mask>
      <g transform="translate(7 9)" mask="url(#${id}sm)"><rect width="${w}" height="${h}" fill="#000" opacity=".35"/></g>
      <g mask="url(#${id}sm)">
        <rect width="${w}" height="${h}" fill="#fbf7ee"/>
        <rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="${th.stampBg}"/>
        ${T(w / 2, 50, 'TOUGE POST', { size: 17, family: F.mono, weight: 700, fill: th.stampFg, ls: 2 })}
        ${T(w / 2, 172, '峠', { size: 118, family: F.jp, weight: 900, fill: th.stampFg })}
        ${T(w / 2, 224, 'No.' + no, { size: 42, family: F.league, fill: th.stampFg, max: 150 })}
      </g>
    </g>`;
  }

  // ── timbro postale tondo con annullo a onde
  function postmark(th, road, date, id) {
    const cx = 900, cy = 330, R = 112, rr = 90;
    const ring = `M ${cx - rr} ${cy} a ${rr} ${rr} 0 1 1 ${2 * rr} 0 a ${rr} ${rr} 0 1 1 ${-2 * rr} 0`;
    const label = `峠郵便 · ${road.name.toUpperCase()} · TOUGE · `;
    let waves = '';
    for (let i = 0; i < 4; i++) {
      const y = cy - 40 + i * 26;
      let d = `M ${cx - R - 300} ${y}`;
      for (let k = 0; k < 6; k++) d += ` q 25 ${k % 2 ? 12 : -12} 50 0`;
      waves += `<path d="${d}"/>`;
    }
    const dd = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    return `<g opacity=".88"${th.glow ? ` filter="url(#${id}g)"` : ''}>
      <g fill="none" stroke="${th.post}" stroke-width="5">${waves}<circle cx="${cx}" cy="${cy}" r="${R}"/><circle cx="${cx}" cy="${cy}" r="66" stroke-width="3"/></g>
      <path id="${id}ring" d="${ring}" fill="none"/>
      <text font-family="${esc(F.mono)}" font-size="19" font-weight="700" fill="${th.post}" textLength="${(2 * Math.PI * rr * 0.97).toFixed(0)}" lengthAdjust="spacingAndGlyphs"><textPath href="#${id}ring" xlink:href="#${id}ring">${esc(label)}</textPath></text>
      ${T(cx, cy - 8, dd, { size: 23, family: F.mono, weight: 700, fill: th.post, max: 118 })}
      ${T(cx, cy + 40, road.alt + ' M', { size: 46, family: F.league, fill: th.post, max: 112 })}
    </g>`;
  }

  // ── "Saluti da…" con il nome in lettere giganti piene di illustrazione
  function greetings(th, road, info, id) {
    const name = road.name.toUpperCase();
    let size = 230;
    const nat = measure(name, 400, size, F.anton);
    if (nat > 1040 * 1.35) size = Math.max(140, Math.round(size * (1040 * 1.35) / nat));
    const y = 520 + size * 0.95;
    const txt = (extra, fill) => T(600, y.toFixed(0), name, { size, family: F.anton, fill, max: 1040, extra });
    const shadowCol = th.glow ? '#060714' : th.frame;
    // dentro le lettere: il cielo (fasce del tramonto + sole) di un'altra atmosfera, schiacciato in altezza
    const sky = window.roadArt(road, { w: AW, h: AH, mood: th.inLetters })
      .replace(/<svg class="[^"]*"/, `<svg x="${AX}" y="520" width="${AW}" height="${Math.round(size * 1.05)}"`)
      .replace(`viewBox="0 0 ${AW} ${AH}" preserveAspectRatio="xMidYMid slice"`, `viewBox="0 40 ${AW} 640" preserveAspectRatio="none"`);
    return `
      ${T(600, 505, info.greet, { size: 78, family: F.bodoni, italic: true, fill: th.greet, max: 900,
        extra: th.glow ? ` filter="url(#${id}g)"` : ` stroke="${th.card}" stroke-width="10" stroke-linejoin="round" paint-order="stroke"` })}
      <clipPath id="${id}gt">${txt('', '#000')}</clipPath>
      <g transform="translate(12 12)">${txt(` stroke="${shadowCol}" stroke-width="8" stroke-linejoin="round"`, shadowCol)}</g>
      <g clip-path="url(#${id}gt)">${sky}</g>
      ${txt(` stroke="${th.glow ? '#00e5ff' : th.frame}" stroke-width="7" stroke-linejoin="round"${th.glow ? ` filter="url(#${id}g)"` : ''}`, 'none')}`;
  }

  // ── insegna al neon (solo cyberpunk)
  function neonSign(id) {
    return `<g filter="url(#${id}g)">
      <rect x="70" y="90" width="104" height="320" rx="14" fill="#060714" fill-opacity=".65" stroke="#ff2bd6" stroke-width="5"/>
      ${T(122, 196, '峠', { size: 84, family: F.jp, weight: 900, fill: '#ff2bd6' })}
      ${T(122, 296, '道', { size: 84, family: F.jp, weight: 900, fill: '#ff2bd6' })}
      ${T(122, 382, '走り屋', { size: 26, family: F.jp, weight: 900, fill: '#00e5ff' })}
    </g>`;
  }

  /* road · info: { drivenAt, plateLabel, hairpinsLabel, country, region, greet } · style · els */
  function body(road, info, style, els, id) {
    const th = THEMES[style] || THEMES.vapor;
    const date = new Date(info.drivenAt || Date.now());
    const ddmm = String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
    const place = (info.country + ' · ' + info.region).toUpperCase();
    const data = `${road.alt} M  ·  ${road.km} KM  ·  ≈${road.hairpins} ${info.hairpinsLabel.toUpperCase()}`;
    const name = road.name.toUpperCase();
    const BY = AY + AH; // inizio della fascia testi

    let s = `<defs>
      <filter id="${id}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <pattern id="${id}sl" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#000" opacity=".2"/></pattern>
    </defs>
    <rect width="${PW}" height="${PH}" rx="10" fill="${th.card}"/>`;
    if (th.glow) s += `<rect x="18" y="18" width="${PW - 36}" height="${PH - 36}" rx="6" fill="none" stroke="#ff2bd6" stroke-width="2" opacity=".7"/>`;

    // illustrazione (+ stampa fuori registro per lo stile d'epoca)
    s += art(road, th.art, AX, AY, AW, AH);
    if (style === 'retro') s += `<g transform="translate(7 -5)" opacity=".22" style="mix-blend-mode:multiply">${art(road, 'dusk', AX, AY, AW, AH)}</g>`;
    if (th.scan) s += `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}sl)"/>`;
    if (style === 'cyber') s += neonSign(id);
    s += `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="none" stroke="${th.frame}" stroke-width="4"/>`;

    if (els.greet) s += greetings(th, road, info, id);
    if (els.stamp) s += stamp(th, road.no, id);
    if (els.postmark) s += postmark(th, road, date, id);

    // fascia testi
    s += `<rect x="${AX}" y="${BY}" width="${AW}" height="${PH - BY - AY}" fill="${th.band}"/>`;
    [[0, 16], [22, 10], [38, 16]].forEach(([off, h], i) => { s += `<rect x="${AX}" y="${BY + off}" width="${AW}" height="${h}" fill="${th.bars[i]}"/>`; });
    const shadowed = (y, text, size) =>
      T(606, y + 6, text, { size, family: F.anton, fill: th.shadow, max: 1040 }) + T(600, y, text, { size, family: F.anton, fill: th.title, max: 1040 });
    if (!els.greet) {
      s += shadowed(1515, name, 118);
      s += T(600, 1570, place, { size: 30, family: F.mono, weight: 700, fill: th.sub, max: 1000, ls: 3 });
    } else {
      s += shadowed(1500, place, 72);
      s += T(600, 1565, 'トウゲ · 峠道 · 走り屋', { size: 30, family: F.jp, weight: 900, fill: th.sub, max: 1000 });
    }
    s += T(600, 1648, data, { size: 40, family: F.mono, weight: 700, fill: th.data, max: 1040 });
    s += `<circle cx="92" cy="1716" r="27" fill="${RED}"/>` + T(92, 1728, '峠', { size: 32, family: F.jp, weight: 900, fill: CREAM });
    s += T(132, 1734, 'TOUGE', { size: 44, family: F.anton, fill: th.logo, anchor: 'start' });
    s += T(1120, 1730, 'No.' + road.no, { size: 26, family: F.mono, weight: 700, fill: th.sub, anchor: 'end' });

    if (els.plate) s += plate(600, 1190, 680, road.no, ddmm, String(date.getFullYear()), info.plateLabel.toUpperCase());

    // grana lo-fi
    s += `<rect width="${PW}" height="${PH}" filter="url(#${id}n)" opacity=".07"/>`;
    return s;
  }

  const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
  const styleTag = (css) => (css ? `<style><![CDATA[${css}]]></style>` : '');

  function postcardSVG(road, info, style, els, css) {
    return `<svg ${NS} viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}">${styleTag(css)}${body(road, info, style, els, 'c' + ++uid)}</svg>`;
  }

  function storySVG(road, info, style, els, css) {
    const th = THEMES[style] || THEMES.vapor;
    const id = 's' + ++uid;
    let bg = `<rect width="${SW}" height="${SH}" fill="${th.storyBg}"/>`;
    if (style === 'retro') {
      bg += `<circle cx="540" cy="820" r="480" fill="${RED}" opacity=".9"/>
        <pattern id="${id}h" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#1d1a16" opacity=".25"/></pattern>
        <rect width="${SW}" height="${SH}" fill="url(#${id}h)"/>`;
    } else {
      const grid = style === 'vapor' ? '#3ff5ff' : '#ff2bd6';
      if (style === 'vapor') bg += `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0b3a"/><stop offset=".55" stop-color="#7b2cbf"/><stop offset="1" stop-color="#ff4fb0"/></linearGradient><rect width="${SW}" height="${SH}" fill="url(#${id}v)"/>`;
      let g = '';
      for (let i = 1; i <= 8; i++) { const t = i / 8, y = 1480 + 440 * t * t; g += `<line x1="0" y1="${y.toFixed(0)}" x2="${SW}" y2="${y.toFixed(0)}"/>`; }
      for (let i = -9; i <= 9; i++) g += `<line x1="${540 + i * 30}" y1="1480" x2="${540 + i * 190}" y2="${SH}"/>`;
      bg += `<g stroke="${grid}" stroke-width="2.5" opacity=".55">${g}</g>`;
    }
    const pcW = 860, pcH = 1290, pcX = 110, pcY = 210;
    return `<svg ${NS} viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}">${styleTag(css)}${bg}
      ${T(48, 110, '峠道 · TOUGE CULTURE', { size: 30, family: F.mono, weight: 700, fill: th.storyInk, anchor: 'start' })}
      ${T(1032, 110, 'No.' + road.no, { size: 30, family: F.mono, weight: 700, fill: th.storyInk, anchor: 'end' })}
      <g transform="rotate(-3 540 855)">
        <rect x="${pcX + 18}" y="${pcY + 20}" width="${pcW}" height="${pcH}" rx="8" fill="#000" opacity=".45"/>
        <svg x="${pcX}" y="${pcY}" width="${pcW}" height="${pcH}" viewBox="0 0 ${PW} ${PH}">${body(road, info, style, els, id)}</svg>
      </g>
      <circle cx="120" cy="1745" r="52" fill="${RED}"/>
      ${T(120, 1766, '峠', { size: 56, family: F.jp, weight: 900, fill: CREAM })}
      ${T(196, 1776, 'TOUGE', { size: 84, family: F.anton, fill: th.storyInk, anchor: 'start' })}
      ${T(1032, 1766, info.tagline.toUpperCase(), { size: 24, family: F.mono, weight: 700, fill: th.storyMuted, anchor: 'end', max: 520 })}
    </svg>`;
  }

  // ── caratteri: precaricati nella pagina (anteprima e misure) e incorporati nei file
  async function ready() {
    if (!document.fonts || !document.fonts.load) return;
    const specs = ['400 140px "League Gothic"', '700 72px "Josefin Sans"', '400 120px Anton', '700 40px "Space Mono"', 'italic 400 70px "Bodoni Moda"', '900 60px "Noto Sans JP"'];
    await Promise.all(specs.map((s) => document.fonts.load(s, s.includes('Noto') ? '峠道走り屋郵便トウゲ' : 'A1').catch(() => {})));
  }
  const GF = ['Anton', 'League+Gothic', 'Josefin+Sans:wght@700', 'Space+Mono:wght@400;700', 'Noto+Sans+JP:wght@900', 'Bodoni+Moda:ital,wght@1,400'];
  const cssCache = {};
  const toDataURL = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  async function embedFonts(svg) {
    const chars = new Set();
    svg.replace(/>([^<>]+)</g, (_, s) => { for (const c of s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')) if (c.trim()) chars.add(c); return ''; });
    const text = [...chars].sort().join('');
    if (cssCache[text] != null) return cssCache[text];
    const parts = await Promise.all(GF.map(async (fam) => {
      try {
        let css = await fetch(`https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(text)}`).then((r) => (r.ok ? r.text() : ''));
        const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
        for (const u of urls) css = css.split(u).join(await toDataURL(await fetch(u).then((r) => r.blob())));
        return css.includes('url(https:') ? '' : css;
      } catch (e) { return ''; }
    }));
    return (cssCache[text] = parts.join('\n'));
  }

  const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  async function toPng(svg, w, h) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      let img = await loadImg(url);
      if (img.decode) await img.decode().catch(() => {});
      await new Promise((r) => setTimeout(r, 120));
      img = await loadImg(url); // Safari: i caratteri incorporati sono pronti solo dal secondo caricamento
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      return await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }

  async function withFonts(make) {
    const draft = make('');
    return make(await embedFonts(draft));
  }

  window.TougeShare = {
    STYLES: ['retro', 'vapor', 'cyber'],
    ELEMENTS: ['stamp', 'postmark', 'greet', 'plate'],
    ready,
    // anteprima nella pagina (usa i caratteri già caricati)
    preview: (road, info, style, els) =>
      `<svg ${NS} viewBox="0 0 ${PW} ${PH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(road.name)}">${body(road, info, style, els, 'v' + ++uid)}</svg>`,
    async postcardSvg(road, info, style, els) {
      const svg = await withFonts((css) => postcardSVG(road, info, style, els, css));
      return new Blob([svg], { type: 'image/svg+xml' });
    },
    async postcardPng(road, info, style, els) {
      return toPng(await withFonts((css) => postcardSVG(road, info, style, els, css)), PW, PH);
    },
    async storyPng(road, info, style, els) {
      return toPng(await withFonts((css) => storySVG(road, info, style, els, css)), SW, SH);
    },
  };
})();
