/* TOUGE App — poster illustrati generati per ogni strada.
 * Stile: manifesti racing/rally anni '80–'90 + touge culture.
 * Ogni strada ha un'atmosfera (giorno / tramonto / notte), una serpentina in prospettiva
 * con linea di mezzeria gialla, boschi o neve in base alla quota e il numero di collezione.
 */
(function () {
  let uid = 0;

  function rng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  // atmosfere: colori piatti, palette limitata come una serigrafia
  const MOODS = {
    day: { sky: ['#efe6d2', '#efe6d2'], sun: '#ffcc00', back: '#9fb4c7', mid: '#55708a', front: '#24402e', tree: '#1d3a24', treeHi: '#2f6b3a', asphalt: '#34343a', num: '#ffffff', numOp: 0.55 },
    dusk: { sky: ['#ffcc00', '#f2542d', '#c2185b', '#3a1450'], sun: '#fff3c4', back: '#7a2e5a', mid: '#3e1a42', front: '#1b1026', tree: '#120a1a', treeHi: '#2a1636', asphalt: '#26222c', num: '#fff3c4', numOp: 0.35 },
    night: { sky: ['#0d1026', '#0d1026'], sun: '#efe6d2', back: '#1d2547', mid: '#141a33', front: '#0b1f14', tree: '#06130b', treeHi: '#0f2e18', asphalt: '#1b1b22', num: '#efe6d2', numOp: 0.12 },
  };

  function ridge(r, w, h, baseY, peakY, roughness) {
    const n = 10;
    const peakAt = 0.25 + r() * 0.5;
    let d = `M0 ${h} L0 ${(baseY + (r() - 0.5) * 16).toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const x = (i / n) * w;
      const dist = Math.abs(i / n - peakAt);
      const y = peakY + dist * (baseY - peakY) * 1.7 + (r() - 0.5) * roughness;
      d += ` L${x.toFixed(1)} ${Math.min(h, Math.max(peakY, y)).toFixed(1)}`;
    }
    return d + ` L${w} ${h} Z`;
  }

  // serpentina in prospettiva: larga in basso, stretta verso l'orizzonte
  // La carreggiata non è più un poligono "offset" (che nelle curve strette si ripiegava su sé
  // stesso creando linee che sbordano e si incrociano): è la mezzeria disegnata con tratti
  // sovrapposti, larghi quanto la strada. L'unione di tratti con estremi arrotondati è sempre
  // una forma pulita, anche nei tornanti. La larghezza è limitata dalla distanza tra i bracci
  // della serpentina, così i rettilinei vicini non si fondono.
  function roadGeometry(r, w, h, horizon, turns) {
    const N = 120, cx = w * (0.44 + r() * 0.12), amp = w * (0.28 + r() * 0.08), phase = r() * Math.PI;
    const span = h + 30 - horizon;
    const armGap = (2 * span) / turns; // distanza verticale tra due bracci in primo piano
    const W0 = Math.min(w * 0.26, armGap * 0.5), pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, k = 1 - t;
      const y = horizon + span * k * k;
      const x = cx + amp * Math.pow(k, 0.8) * Math.sin(phase + t * turns * Math.PI);
      pts.push({ x, y, wd: W0 * Math.pow(k, 1.5) + 1 });
    }
    return { center: pts };
  }

  // Disegna la mezzeria come nastro: tratti consecutivi raggruppati per larghezza simile.
  function ribbon(pts, extra, color, from, to, runs) {
    from = from || 0; to = to == null ? pts.length - 1 : to; runs = runs || 18;
    const per = Math.max(1, Math.ceil((to - from) / runs));
    let out = '';
    for (let a = from; a < to; a += per) {
      const b = Math.min(to, a + per);
      const seg = pts.slice(a, b + 1);
      const wd = seg.reduce((s, p) => s + p.wd, 0) / seg.length + extra;
      if (wd <= 0.2) continue;
      out += `<path d="M${seg.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L')}" fill="none" stroke="${color}" stroke-width="${wd.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return out;
  }

  function centerSegments(pts, color, scale) {
    // mezzeria a tratti, spessore decrescente con la distanza
    const parts = 5, per = Math.floor(pts.length / parts);
    let out = '';
    for (let s = 0; s < parts; s++) {
      const seg = pts.slice(s * per, (s + 1) * per + 1);
      const k = 1 - s / parts;
      const d = 'M' + seg.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L');
      out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(3.2 * k * scale + 0.4).toFixed(2)}" stroke-dasharray="${(14 * k * scale + 2).toFixed(1)} ${(12 * k * scale + 2).toFixed(1)}" stroke-linecap="butt"/>`;
    }
    return out;
  }

  function tree(x, y, s, c, hi) {
    return `<g><circle cx="${x.toFixed(1)}" cy="${(y - s * 0.9).toFixed(1)}" r="${(s * 0.75).toFixed(1)}" fill="${c}"/>` +
      `<circle cx="${(x - s * 0.55).toFixed(1)}" cy="${(y - s * 0.35).toFixed(1)}" r="${(s * 0.6).toFixed(1)}" fill="${c}"/>` +
      `<circle cx="${(x + s * 0.55).toFixed(1)}" cy="${(y - s * 0.4).toFixed(1)}" r="${(s * 0.62).toFixed(1)}" fill="${c}"/>` +
      `<circle cx="${(x - s * 0.2).toFixed(1)}" cy="${(y - s * 1.15).toFixed(1)}" r="${(s * 0.28).toFixed(1)}" fill="${hi}"/></g>`;
  }

  // usati anche dallo splash animato
  window.roadParts = { ribbon, centerSegments };

  window.roadArt = function (road, opts) {
    opts = opts || {};
    const w = opts.w || 400, h = opts.h || 240;
    const r = rng(road.id);
    const id = 'p' + ++uid;
    const roll = r();
    const moodKey = opts.mood || (roll < 0.34 ? 'day' : roll < 0.67 ? 'dusk' : 'night');
    const m = MOODS[moodKey];
    const altNorm = Math.min(1, Math.max(0, (road.alt - 400) / 2400));
    const peakY = h * (0.5 - altNorm * 0.3);
    const horizon = peakY + h * 0.22;
    const turns = Math.max(2, Math.min(6, Math.round(road.hairpins / 10) + 1));
    const snow = road.alt > 1900;
    const forest = road.alt < 2200;
    const sunX = w * (0.2 + r() * 0.6), sunY = h * (moodKey === 'dusk' ? 0.36 : 0.2 + r() * 0.08), sunR = h * (moodKey === 'dusk' ? 0.16 : 0.08);

    const back = ridge(r, w, h, h * 0.62, peakY, 26);
    const mid = ridge(r, w, h, h * 0.72, peakY + h * 0.1, 20);
    const front = ridge(r, w, h, h * 0.84, horizon - h * 0.02, 12);
    const rd = roadGeometry(r, w, h, horizon, turns);
    const sc = w / 400;

    let sky;
    if (m.sky.length > 2) {
      const band = (sunY + sunR) / m.sky.length;
      sky = m.sky.map((c, i) => `<rect y="${(i * band).toFixed(1)}" width="${w}" height="${(i === m.sky.length - 1 ? h : band + 1).toFixed(1)}" fill="${c}"/>`).join('');
    } else sky = `<rect width="${w}" height="${h}" fill="${m.sky[0]}"/>`;

    // sole a strisce in stile anni '80 (tramonto) o disco pieno
    const sunStripes = moodKey === 'dusk'
      ? Array.from({ length: 5 }, (_, i) => `<rect x="${(sunX - sunR).toFixed(1)}" y="${(sunY + sunR * (0.1 + i * 0.18)).toFixed(1)}" width="${(sunR * 2).toFixed(1)}" height="${(sunR * (0.03 + i * 0.025)).toFixed(1)}" fill="${m.sky[2]}"/>`).join('')
      : '';
    const stars = moodKey === 'night' ? Array.from({ length: 26 }, () => `<rect x="${(r() * w).toFixed(0)}" y="${(r() * h * 0.45).toFixed(0)}" width="1.4" height="1.4" fill="#efe6d2" opacity="${(r() * 0.6 + 0.3).toFixed(2)}"/>`).join('') : '';

    // alberi lungo i bordi della strada e sul fronte
    let trees = '';
    if (forest) {
      const count = Math.round(14 + (1 - altNorm) * 18);
      for (let i = 0; i < count; i++) {
        const t = r();
        const y = horizon + (h - horizon) * Math.pow(t, 0.8);
        const side = r() < 0.5 ? -1 : 1;
        const x = side < 0 ? r() * w * 0.32 : w - r() * w * 0.32;
        trees += tree(x, y, (4 + t * 22) * sc, m.tree, m.treeHi);
      }
    }
    // fogliame in primo piano negli angoli (stile poster touge)
    const foliage = forest
      ? `<g fill="${m.tree}">${[0, 1].map((side) => Array.from({ length: 5 }, () => `<circle cx="${(side ? w - r() * w * 0.12 : r() * w * 0.12).toFixed(0)}" cy="${(r() * h * 0.35).toFixed(0)}" r="${((14 + r() * 26) * sc).toFixed(0)}"/>`).join('')).join('')}</g>`
      : '';

    // scia di fanali posteriori (lunga esposizione) di notte
    const trail = moodKey === 'night'
      ? `<path d="M${rd.center.slice(10, 95).map((p) => (p.x + p.wd * 0.18).toFixed(1) + ' ' + p.y.toFixed(1)).join(' L')}" fill="none" stroke="#ff2a3c" stroke-width="${(3 * sc).toFixed(1)}" opacity=".9" filter="url(#${id}b)"/>
         <path d="M${rd.center.slice(10, 95).map((p) => (p.x + p.wd * 0.18).toFixed(1) + ' ' + p.y.toFixed(1)).join(' L')}" fill="none" stroke="#ff8a8a" stroke-width="${(1 * sc).toFixed(1)}"/>`
      : '';

    // carreggiata: un nastro crema appena più largo sotto l'asfalto = una sola linea di bordo
    // per lato. Tratti molto corti (2 punti) così la larghezza cala senza scalini visibili.
    const runs = Math.ceil(rd.center.length / 2);
    const roadLayers =
      ribbon(rd.center, 2.4 * sc, '#efe6d2', 0, null, runs) +
      ribbon(rd.center, 0, m.asphalt, 0, null, runs);

    const num = opts.num ? `<text x="${(w / 2).toFixed(0)}" y="${(h * 0.47).toFixed(0)}" text-anchor="middle" class="art-num" font-size="${(h * 0.56).toFixed(0)}" fill="${m.num}" opacity="${m.numOp}">${opts.num}</text>` : '';

    // livrea: tre fasce diagonali (blu / azzurro / rosso)
    const stripes = opts.stripes
      ? `<g transform="translate(0 ${(h * 0.66).toFixed(0)}) skewY(-14)">
           <rect x="-10" y="0" width="${(w * 0.62).toFixed(0)}" height="${(h * 0.04).toFixed(1)}" fill="#1b3a8c"/>
           <rect x="-10" y="${(h * 0.05).toFixed(1)}" width="${(w * 0.62).toFixed(0)}" height="${(h * 0.028).toFixed(1)}" fill="#3fa9f5"/>
           <rect x="-10" y="${(h * 0.088).toFixed(1)}" width="${(w * 0.62).toFixed(0)}" height="${(h * 0.04).toFixed(1)}" fill="#e2231a"/>
         </g>`
      : '';

    return `<svg class="art mood-${moodKey}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="${id}b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(3 * sc).toFixed(1)}"/></filter>
        <pattern id="${id}h" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#000" opacity=".22"/></pattern>
        ${snow ? `<clipPath id="${id}c"><rect width="${w}" height="${(peakY + h * 0.08).toFixed(0)}"/></clipPath>` : ''}
      </defs>
      ${sky}${stars}
      <circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${sunR.toFixed(0)}" fill="${m.sun}"/>${sunStripes}
      ${num}
      <path d="${back}" fill="${m.back}"/>
      ${snow ? `<path d="${back}" fill="#f7f3ea" clip-path="url(#${id}c)"/>` : ''}
      <path d="${mid}" fill="${m.mid}"/>
      <path d="${front}" fill="${m.front}"/>
      ${trees}
      ${roadLayers}
      ${centerSegments(rd.center, '#ffcc00', sc)}
      ${trail}
      ${foliage}
      ${stripes}
      <rect width="${w}" height="${h}" fill="url(#${id}h)"/>
    </svg>`;
  };
})();
