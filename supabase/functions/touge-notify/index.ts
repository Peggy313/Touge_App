// TOUGE App · servizio notifiche push "touge-notify" (Supabase Edge Function, Deno).
// Lo avvia ogni giorno il Cron di Supabase (vedi NOTIFICHE-SETUP.md). Controlla, per ogni pilota con le push accese:
//  - riapre un preferito        (ogni giorno)  stato "aperta" recente su un passo stagionale salvato col ♥
//  - weekend di sole preferiti  (giovedì)      sabato o domenica bel tempo in vetta su un preferito aperto
//  - weekend di sole vicino     (giovedì)      passi aperti e col sole entro 1/2/3 h dalla partenza (~10 km)
//  - novità sui preferiti       (ogni giorno)  foto e recensioni di altri piloti nelle ultime 24 ore
// Ogni avviso parte una volta sola (tabella notify_log).
//
// Segreti richiesti (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase da sé dentro la funzione: non vanno copiati da nessuna parte.
// Prova: POST con header x-touge-cron e corpo {"test": true} → manda una notifica di prova a chi ha le push accese.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SITE = Deno.env.get('TOUGE_SITE') ?? 'https://peggy313.github.io/Touge_App/';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:touge.app@gmail.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

type Road = { id: string; name: string; closure: string | null; wp: number[][] };
const T = {
  it: {
    reopen: (n: string) => [`${n} ha riaperto`, 'Uno dei tuoi preferiti è di nuovo aperto. Buona strada!'],
    wxFav: (n: string, k: number, d: string) => [k > 2 ? `Weekend di sole su ${n} e altri ${k - 1} preferiti` : k === 2 ? `Weekend di sole su ${n} e un altro preferito` : `Weekend di sole su ${n}`, `Bel tempo in vetta ${d}.`],
    wxNear: (k: number, h: number) => [`Weekend di sole: ${k} ${k === 1 ? 'passo' : 'passi'} entro ${h}h`, 'Aperti e col sole in vetta, dalla tua partenza.'],
    news: (p: number, r: number) => ['Novità sui tuoi preferiti', `${p} nuove foto e ${r} nuove recensioni dei piloti.`],
    days: { sat: 'sabato', sun: 'domenica', and: 'e' },
    test: ['TOUGE · notifiche attive', 'Ti avviseremo quando i tuoi passi riaprono e quando il weekend promette sole.'],
  },
  en: {
    reopen: (n: string) => [`${n} has reopened`, 'One of your favourites is open again. Enjoy the drive!'],
    wxFav: (n: string, k: number, d: string) => [k > 2 ? `Sunny weekend on ${n} and ${k - 1} more favourites` : k === 2 ? `Sunny weekend on ${n} and one more favourite` : `Sunny weekend on ${n}`, `Fine weather at the top on ${d}.`],
    wxNear: (k: number, h: number) => [`Sunny weekend: ${k} ${k === 1 ? 'pass' : 'passes'} within ${h}h`, 'Open and sunny at the top, from where you start.'],
    news: (p: number, r: number) => ['News on your favourites', `${p} new photos and ${r} new reviews from drivers.`],
    days: { sat: 'Saturday', sun: 'Sunday', and: 'and' },
    test: ['TOUGE · notifications on', 'We will let you know when your passes reopen and when the weekend looks sunny.'],
  },
};

// ── strade: lette dal file dell'app pubblicato (js/data.js), così le nuove strade arrivano da sole
async function loadRoads(): Promise<Road[]> {
  const code = await (await fetch(SITE + 'js/data.js', { cache: 'no-store' })).text();
  const win: Record<string, unknown> = {};
  new Function('window', code)(win);
  return win.ROADS as Road[];
}
const rad = Math.PI / 180;
function hav(a: number[], b: number[]) {
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const estMin = (km: number) => { const road = km * 1.3, v = road < 30 ? 40 : road < 100 ? 60 : 80; return (road / v) * 60; };
const summit = (r: Road) => r.wp[Math.min(1, r.wp.length - 1)];
const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
function seasonClosed(r: Road, m: number) {
  if (!r.closure) return false;
  const [a, b] = r.closure.split(/[–-]/).map((s) => MONTHS.indexOf(s.trim()));
  if (a < 0 || b < 0) return false;
  return a <= b ? m > a && m < b : m > a || m < b;
}
// stessa regola dell'app (js/store.js computeStatus)
const DAY = 864e5;
type St = { status: string; at: string } | null;
function computeStatus(list: { status: string; at: string }[], off?: { status: string; at: string }): St {
  const now = Date.now();
  const recent = (list || []).filter((r) => now - Date.parse(r.at) < 14 * DAY).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  let pilots: St = null;
  if (recent.length) {
    const newest = Date.parse(recent[0].at);
    const win = recent.filter((r) => newest - Date.parse(r.at) < 3 * DAY);
    const open = win.filter((r) => r.status === 'open').length, closed = win.length - open;
    pilots = { status: open === closed ? recent[0].status : open > closed ? 'open' : 'closed', at: recent[0].at };
  }
  if (off && (!pilots || Date.parse(off.at) >= Date.parse(pilots.at))) return { status: off.status, at: off.at };
  return pilots;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function weather(roads: Road[]) {
  const out: Record<string, { day: string; code: number; pop: number; snow: number }[]> = {};
  for (let i = 0; i < roads.length; i += 40) {
    const part = roads.slice(i, i + 40), p = part.map(summit);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.map((x) => x[0].toFixed(3)).join(',') + '&longitude=' + p.map((x) => x[1].toFixed(3)).join(',') +
      '&daily=weather_code,precipitation_probability_max,snowfall_sum&timezone=Europe%2FRome&forecast_days=4';
    try {
      const j = await (await fetch(url)).json();
      (Array.isArray(j) ? j : [j]).forEach((w, k) => {
        out[part[k].id] = (w.daily?.time || []).map((day: string, n: number) => ({ day, code: w.daily.weather_code[n], pop: w.daily.precipitation_probability_max[n] ?? 0, snow: w.daily.snowfall_sum[n] ?? 0 }));
      });
    } catch (_) { /* meteo non disponibile: niente avvisi meteo */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-touge-cron') !== Deno.env.get('CRON_SECRET')) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => ({}));

  const { data: prefs } = await sb.from('notify_prefs').select('*').eq('push', true);
  if (!prefs?.length) return Response.json({ sent: 0, note: 'nessun pilota con le push accese' });
  const uids = prefs.map((p) => p.user_id);
  const { data: subs } = await sb.from('push_subs').select('*').in('user_id', uids);
  const subsBy: Record<string, typeof subs> = {};
  (subs || []).forEach((s) => (subsBy[s.user_id] ||= []).push(s));

  let sent = 0;
  const send = async (uid: string, title: string, text: string, url: string, tag: string) => {
    for (const s of subsBy[uid] || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body: text, url, tag }), { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from('push_subs').delete().eq('endpoint', s.endpoint); // telefono non più iscritto
      }
    }
  };

  if (body?.test) {
    for (const p of prefs) { const L = T[p.lang === 'en' ? 'en' : 'it']; await send(p.user_id, L.test[0], L.test[1], SITE + '#explore', 'test'); }
    return Response.json({ sent, test: true });
  }

  const roads = await loadRoads(), byId: Record<string, Road> = Object.fromEntries(roads.map((r) => [r.id, r]));
  const now = new Date(), month = now.getMonth(), isThursday = now.getDay() === 4;
  const sat = new Date(now.getTime() + 2 * DAY), sun = new Date(now.getTime() + 3 * DAY);

  const since14 = new Date(Date.now() - 14 * DAY).toISOString(), since1 = new Date(Date.now() - DAY).toISOString();
  const [{ data: favs }, { data: reps }, { data: offs }, { data: logs }] = await Promise.all([
    sb.from('favorites').select('user_id, road_id').in('user_id', uids),
    sb.from('road_reports').select('road_id, status, created_at').gte('created_at', since14).limit(5000),
    sb.from('road_status').select('road_id, status, updated_at'),
    sb.from('notify_log').select('user_id, key').in('user_id', uids).gte('sent_at', new Date(Date.now() - 400 * DAY).toISOString()),
  ]);
  const favBy: Record<string, string[]> = {};
  (favs || []).forEach((f) => byId[f.road_id] && (favBy[f.user_id] ||= []).push(f.road_id));
  const repBy: Record<string, { status: string; at: string }[]> = {};
  (reps || []).forEach((r) => (repBy[r.road_id] ||= []).push({ status: r.status, at: r.created_at }));
  const offBy: Record<string, { status: string; at: string }> = {};
  (offs || []).forEach((o) => (offBy[o.road_id] = { status: o.status, at: o.updated_at }));
  const status = (id: string) => computeStatus(repBy[id] || [], offBy[id]);
  const openish = (r: Road) => { const st = status(r.id); return st ? st.status === 'open' : !seasonClosed(r, month); };
  const logged = new Set((logs || []).map((l) => l.user_id + '|' + l.key));
  const newLogs: { user_id: string; key: string }[] = [];
  const once = (uid: string, key: string) => { if (logged.has(uid + '|' + key)) return false; logged.add(uid + '|' + key); newLogs.push({ user_id: uid, key }); return true; };

  // meteo (solo il giovedì) per i preferiti e per i passi vicini a chi ha "vicino a te"
  let wx: Awaited<ReturnType<typeof weather>> = {};
  const nearBy: Record<string, Road[]> = {};
  if (isThursday) {
    const need = new Set<string>();
    prefs.forEach((p) => {
      if (p.wx_fav) (favBy[p.user_id] || []).forEach((id) => need.add(id));
      if (p.wx_near && p.near_lat != null && p.near_lng != null) {
        const o = [Number(p.near_lat), Number(p.near_lng)];
        nearBy[p.user_id] = roads.filter((r) => estMin(Math.min(hav(o, r.wp[0]), hav(o, r.wp[r.wp.length - 1]))) <= p.near_min);
        nearBy[p.user_id].forEach((r) => need.add(r.id));
      }
    });
    wx = await weather([...need].map((id) => byId[id]).filter(Boolean));
  }
  const sunny = (id: string) => (['sat', 'sun'] as const).filter((k) => {
    const d = (wx[id] || []).find((x) => x.day === ymd(k === 'sat' ? sat : sun));
    return d && d.code <= 2 && !d.snow && d.pop < 40;
  });

  // novità delle ultime 24 ore sui passi preferiti di qualcuno
  const allFav = [...new Set(Object.values(favBy).flat())];
  let news: { road_id: string; user_id: string; kind: string }[] = [];
  if (allFav.length) {
    const [a, b] = await Promise.all([
      sb.from('road_photos').select('road_id, user_id').in('road_id', allFav).gt('created_at', since1).eq('hidden', false),
      sb.from('reviews').select('road_id, user_id').in('road_id', allFav).gt('created_at', since1),
    ]);
    news = [...(a.data || []).map((x) => ({ ...x, kind: 'photo' })), ...(b.data || []).map((x) => ({ ...x, kind: 'review' }))];
  }

  for (const p of prefs) {
    const uid = p.user_id, L = T[p.lang === 'en' ? 'en' : 'it'], mine = favBy[uid] || [];
    if (p.reopen) for (const id of mine) {
      const r = byId[id], st = status(id);
      if (r.closure && st && st.status === 'open' && Date.now() - Date.parse(st.at) < 1.5 * DAY && once(uid, `reopen:${id}:${st.at.slice(0, 10)}`)) {
        const [ti, tx] = L.reopen(r.name); await send(uid, ti, tx, `${SITE}#road-${id}`, 'reopen-' + id);
      }
    }
    if (isThursday && p.wx_fav) {
      const ok = mine.map((id) => [id, sunny(id)] as const).filter(([id, ds]) => ds.length && openish(byId[id]));
      if (ok.length && once(uid, `wxfav:${ymd(sat)}`)) {
        const d = ok[0][1].map((k) => L.days[k]).join(` ${L.days.and} `);
        const [ti, tx] = L.wxFav(byId[ok[0][0]].name, ok.length, d); await send(uid, ti, tx, `${SITE}#road-${ok[0][0]}`, 'wxfav');
      }
    }
    if (isThursday && p.wx_near && nearBy[uid]) {
      const ok = nearBy[uid].filter((r) => openish(r) && sunny(r.id).length);
      if (ok.length && once(uid, `wxnear:${ymd(sat)}`)) {
        const [ti, tx] = L.wxNear(ok.length, p.near_min / 60); await send(uid, ti, tx, `${SITE}#explore`, 'wxnear');
      }
    }
    if (p.news) {
      const n = news.filter((x) => x.user_id !== uid && mine.includes(x.road_id));
      if (n.length && once(uid, `news:${ymd(now)}`)) {
        const ph = n.filter((x) => x.kind === 'photo').length;
        const [ti, tx] = L.news(ph, n.length - ph); await send(uid, ti, tx, `${SITE}#road-${n[0].road_id}`, 'news');
      }
    }
  }
  if (newLogs.length) await sb.from('notify_log').insert(newLogs);
  return Response.json({ sent, users: prefs.length, thursday: isThursday });
});
