/* TOUGE App — meteo in quota (Open-Meteo, gratuito, senza chiave).
 * Una richiesta raggruppata per tutte le strade (punto della vetta + altitudine del passo),
 * salvata sul telefono per 3 ore. Se la rete è bloccata (es. Artifact) il meteo semplicemente non appare.
 */
window.TougeWx = (() => {
  const KEY = 'touge.wx', TTL = 3 * 3600e3, CHUNK = 40;
  let data = null, pending = null, failed = false;
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && Date.now() - j.at < TTL) data = j;
  } catch (e) { /* niente cache */ }

  // codice WMO → tipo di icona
  const kind = (c) => (c === 0 ? 'sun' : c <= 2 ? 'part' : c === 3 ? 'cloud' : c === 45 || c === 48 ? 'fog'
    : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'rain');

  function parse(j) {
    const d = j.daily || {};
    return {
      now: j.current ? { t: Math.round(j.current.temperature_2m), k: kind(j.current.weather_code) } : null,
      days: (d.time || []).map((day, i) => ({
        day, k: kind(d.weather_code[i]),
        max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
        snow: d.snowfall_sum[i] || 0, pop: d.precipitation_probability_max[i] || 0, wind: Math.round(d.wind_speed_10m_max[i] || 0),
      })),
    };
  }

  async function chunk(roads, point) {
    const p = roads.map(point);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.map((x) => x[0].toFixed(3)).join(',') +
      '&longitude=' + p.map((x) => x[1].toFixed(3)).join(',') + '&elevation=' + roads.map((r) => r.alt).join(',') +
      '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max,wind_speed_10m_max' +
      '&timezone=auto&forecast_days=4';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    return (Array.isArray(j) ? j : [j]).map(parse);
  }

  // scarica il meteo di tutte le strade (una volta ogni 3 ore); risolve con true se ci sono dati
  function load(roads, point) {
    if (data) return Promise.resolve(true);
    if (failed) return Promise.resolve(false);
    if (pending) return pending;
    const parts = [];
    for (let i = 0; i < roads.length; i += CHUNK) parts.push(roads.slice(i, i + CHUNK));
    pending = Promise.all(parts.map((p) => chunk(p, point))).then((res) => {
      const byId = {};
      res.flat().forEach((w, i) => (byId[roads[i].id] = w));
      data = { at: Date.now(), byId };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ok */ }
      return true;
    }).catch(() => { failed = true; return false; }).finally(() => { pending = null; });
    return pending;
  }

  const get = (id) => (data && data.byId[id]) || null;
  return { load, get, ready: () => !!data };
})();
