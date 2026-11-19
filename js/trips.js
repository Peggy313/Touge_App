/* TOUGE App — itinerari che concatenano i passi.
 *  - TRIPS: itinerari curati (solo l'elenco dei passi: ordine e lato d'ingresso li calcola l'app)
 *  - TougeTrip.order(): ordine più comodo (meno trasferimenti) e lato d'ingresso di ogni passo
 *  - TougeTrip.plan(): km e tempi (OSRM se risponde, altrimenti stima), divisione in giorni,
 *    link Google Maps per ogni giorno (spezzati in tappe: Maps regge ~10 punti per percorso)
 */
window.TRIPS = [
  { id: 'c-bormio', stops: ['stelvio', 'umbrail', 'gavia', 'mortirolo'], hours: 5,
    it: { title: 'I re di Bormio', desc: 'Stelvio, Umbrail, Gavia e Mortirolo: quattro leggende attorno a Bormio, tra tornanti numerati e asfalto stretto d\'alta quota.' },
    en: { title: 'The kings of Bormio', desc: 'Stelvio, Umbrail, Gavia and Mortirolo: four legends around Bormio, numbered hairpins and narrow high-altitude tarmac.' } },
  { id: 'c-dolomiti', stops: ['gardena', 'sella', 'pordoi', 'campolongo', 'valparola', 'falzarego', 'giau', 'fedaia'], hours: 5,
    it: { title: 'Giro delle Dolomiti', desc: 'Il Sella Ronda e i grandi passi attorno: Gardena, Sella, Pordoi, Campolongo, poi Valparola, Falzarego, Giau e Fedaia sotto la Marmolada.' },
    en: { title: 'Dolomites loop', desc: 'The Sella Ronda and the great passes around it: Gardena, Sella, Pordoi, Campolongo, then Valparola, Falzarego, Giau and Fedaia under the Marmolada.' } },
  { id: 'c-svizzera', stops: ['grimsel', 'furka', 'susten', 'tremola', 'nufenen'], hours: 5,
    it: { title: 'Triangolo svizzero', desc: 'Grimsel, Furka e Susten, più il pavé della Tremola sul Gottardo e il Nufenen: il cuore delle Alpi svizzere.' },
    en: { title: 'Swiss triangle', desc: 'Grimsel, Furka and Susten, plus the Tremola cobbles on the Gotthard and the Nufenen: the heart of the Swiss Alps.' } },
  { id: 'c-grandes-alpes', stops: ['iseran', 'galibier', 'izoard', 'vars', 'cayolle', 'bonette', 'turini'], hours: 5,
    it: { title: 'Route des Grandes Alpes', desc: 'Dalla Savoia al mare: Iseran, Galibier, Izoard, Vars, Cayolle, Bonette e il Turini del rally di Monte Carlo… in più giorni.' },
    en: { title: 'Route des Grandes Alpes', desc: 'From Savoie to the sea: Iseran, Galibier, Izoard, Vars, Cayolle, Bonette and the rally-famous Turini, over several days.' } },
  { id: 'c-alto-adige', stops: ['giovo', 'rombo', 'pennes', 'palade', 'mendola'], hours: 5,
    it: { title: 'Alto Adige selvaggio', desc: 'Giovo e Rombo verso l\'Austria, il Pennes tra i pascoli, poi Palade e Mendola sopra la valle dell\'Adige.' },
    en: { title: 'Wild South Tyrol', desc: 'Jaufen and Timmelsjoch towards Austria, Penser Joch among the pastures, then Gampen and Mendola above the Adige valley.' } },
  { id: 'c-appennino', stops: ['futa', 'raticosa', 'giogo', 'muraglione', 'mandrioli'], hours: 5,
    it: { title: 'Appennino della Mille Miglia', desc: 'Futa e Raticosa, le curve della Mille Miglia, poi Giogo, Muraglione e Mandrioli tra Toscana e Romagna.' },
    en: { title: 'Mille Miglia Apennines', desc: 'Futa and Raticosa, the Mille Miglia bends, then Giogo, Muraglione and Mandrioli between Tuscany and Romagna.' } },
  { id: 'c-giulie', stops: ['predel', 'mangart', 'vrsic', 'korensko'], hours: 5,
    it: { title: 'Alpi Giulie', desc: 'Predil, la strada del Mangart, i 50 tornanti in pavé del Vršič e il Korensko verso l\'Austria.' },
    en: { title: 'Julian Alps', desc: 'Predil, the Mangart road, the 50 cobbled hairpins of Vršič and Korensko towards Austria.' } },
  { id: 'c-austria', stops: ['grossglockner', 'nockalm', 'turracher'], hours: 5,
    it: { title: 'Carinzia panoramica', desc: 'La Grossglockner sotto i ghiacciai, poi le curve morbide della Nockalmstraße e il Turracher Höhe.' },
    en: { title: 'Scenic Carinthia', desc: 'The Grossglockner under the glaciers, then the soft bends of the Nockalmstraße and Turracher Höhe.' } },
  { id: 'c-piemonte', stops: ['agnello', 'lombarda', 'maddalena', 'fauniera'], hours: 5,
    it: { title: 'Confine occidentale', desc: 'Agnello, Lombarda, Maddalena e Fauniera: passi alti e solitari tra Piemonte e Francia.' },
    en: { title: 'Western border', desc: 'Agnello, Lombarda, Maddalena and Fauniera: high, lonely passes between Piedmont and France.' } },
];

window.TougeTrip = (() => {
  const rad = Math.PI / 180;
  function hav(a, b) {
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  // stessa stima di "Partiamo!": strade reali ≈ +30%, più veloci sulle lunghe distanze
  const estMin = (km) => { const road = km * 1.3, v = road < 30 ? 40 : road < 100 ? 60 : 80; return Math.round((road / v) * 60); };
  const passMin = (r) => Math.round((r.km / 35) * 60); // su un passo ≈ 35 km/h di media
  const pts = (r, rev) => (rev ? r.wp.slice().reverse() : r.wp.slice());
  const entry = (r, rev) => (rev ? r.wp[r.wp.length - 1] : r.wp[0]);
  const exit = (r, rev) => (rev ? r.wp[0] : r.wp[r.wp.length - 1]);

  // ordine + lato: "vicino più vicino" provando ogni passo e lato come partenza, si tiene il giro con meno trasferimenti
  function order(roads, start) {
    if (!roads.length) return [];
    let best = null;
    roads.forEach((r0, i0) => [false, true].forEach((rev0) => {
      const used = new Set([i0]), seq = [{ r: r0, rev: rev0 }];
      let cur = exit(r0, rev0), cost = start ? hav(start, entry(r0, rev0)) : 0;
      while (seq.length < roads.length) {
        let bj = -1, brev = false, bd = Infinity;
        roads.forEach((r, j) => { if (used.has(j)) return; [false, true].forEach((rv) => { const d = hav(cur, entry(r, rv)); if (d < bd) { bd = d; bj = j; brev = rv; } }); });
        used.add(bj); seq.push({ r: roads[bj], rev: brev }); cur = exit(roads[bj], brev); cost += bd;
      }
      if (!best || cost < best.cost - 1e-9) best = { cost, seq };
    }));
    return best.seq;
  }
  // ordine deciso dal pilota: sceglie solo il lato d'ingresso più comodo di ogni passo
  function orient(roads, start) {
    let cur = start || null;
    return roads.map((r, i) => {
      let rev;
      if (cur) rev = hav(cur, entry(r, true)) < hav(cur, entry(r, false));
      else { const next = roads[i + 1]; rev = next ? Math.min(hav(r.wp[0], next.wp[0]), hav(r.wp[0], next.wp[next.wp.length - 1])) < Math.min(hav(r.wp[r.wp.length - 1], next.wp[0]), hav(r.wp[r.wp.length - 1], next.wp[next.wp.length - 1])) : false; }
      cur = exit(r, rev);
      return { r, rev };
    });
  }

  // km/tempi con OSRM (un'unica richiesta per tutto il giro); null se non risponde
  const cache = {};
  async function osrm(seq, start) {
    const coords = [];
    if (start) coords.push(start);
    const marks = []; // indice del primo punto di ogni passo
    seq.forEach(({ r, rev }) => { marks.push(coords.length); (r.noRouting ? [entry(r, rev), exit(r, rev)] : pts(r, rev)).forEach((p) => coords.push(p)); });
    const key = coords.map((p) => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(';');
    if (cache[key] !== undefined) return cache[key];
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch('https://router.project-osrm.org/route/v1/driving/' + coords.map(([la, ln]) => `${ln},${la}`).join(';') + '?overview=full&geometries=geojson', { signal: ctl.signal });
      clearTimeout(timer);
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error(j.code);
      const legs = j.routes[0].legs;
      const out = seq.map(({ r }, i) => {
        const a = marks[i], b = (i + 1 < marks.length ? marks[i + 1] : coords.length) - 1; // punti del passo: a..b
        const inner = legs.slice(a, b), before = a > 0 ? legs[a - 1] : null;
        return {
          inKm: before ? before.distance / 1000 : 0, inMin: before ? Math.round(before.duration / 60) : 0,
          roadKm: r.noRouting ? r.km : inner.reduce((s, l) => s + l.distance, 0) / 1000,
          roadMin: r.noRouting ? passMin(r) : Math.round(inner.reduce((s, l) => s + l.duration, 0) / 60),
        };
      });
      cache[key] = { legs: out, line: j.routes[0].geometry.coordinates.map(([ln, la]) => [la, ln]) };
    } catch (e) { cache[key] = null; }
    return cache[key];
  }

  // punti per Google Maps: ingresso, vetta (se c'è un punto intermedio), uscita
  const mapsPts = ({ r, rev }) => { const p = pts(r, rev); return p.length >= 3 ? [p[0], p[Math.floor(p.length / 2)], p[p.length - 1]] : [p[0], p[p.length - 1]]; };
  const gmaps = (list) => {
    const dest = list[list.length - 1], via = list.slice(0, -1);
    return 'https://www.google.com/maps/dir/?api=1&destination=' + dest.map((x) => x.toFixed(5)).join(',') +
      (via.length ? '&waypoints=' + via.map((p) => p.map((x) => x.toFixed(5)).join(',')).join('%7C') : '') + '&travelmode=driving';
  };

  /* seq: [{ r, rev }] già ordinata · start: [lat,lng] o null · hours: ore di guida al giorno · exact: prova OSRM */
  async function plan(seq, start, hours, exact) {
    const real = exact ? await osrm(seq, start) : null;
    const stops = seq.map((s, i) => {
      const prev = i ? exit(seq[i - 1].r, seq[i - 1].rev) : start;
      const km0 = prev ? hav(prev, entry(s.r, s.rev)) : 0;
      const x = real && real.legs[i];
      return Object.assign({}, s, {
        inKm: x ? x.inKm : km0 * 1.3, inMin: x ? x.inMin : prev ? estMin(km0) : 0,
        roadKm: x ? x.roadKm : s.r.km, roadMin: x ? x.roadMin : passMin(s.r),
      });
    });
    const budget = (hours || 5) * 60, days = [];
    let day = null;
    stops.forEach((s) => {
      const cost = s.inMin + s.roadMin;
      if (!day || (day.stops.length && day.min + cost > budget)) { day = { stops: [], min: 0, km: 0 }; days.push(day); }
      day.stops.push(s); day.min += cost; day.km += s.inKm + s.roadKm;
    });
    days.forEach((d) => {
      d.links = []; let chunk = [];
      d.stops.forEach((s) => {
        const p = mapsPts(s);
        if (chunk.length && chunk.length + p.length > 10) { d.links.push(gmaps(chunk)); chunk = []; }
        chunk = chunk.concat(p);
      });
      if (chunk.length) d.links.push(gmaps(chunk));
    });
    return {
      stops, days, exact: !!real, line: real ? real.line : null,
      km: stops.reduce((s, x) => s + x.inKm + x.roadKm, 0), min: stops.reduce((s, x) => s + x.inMin + x.roadMin, 0),
    };
  }

  return { order, orient, plan, entry, exit, hav, MAX: 15 };
})();
