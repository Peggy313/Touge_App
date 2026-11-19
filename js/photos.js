/* TOUGE App — strumenti per le foto (tutto sul telefono, niente invii):
 *  - gps(file):  legge la posizione salvata nella foto (EXIF GPS dei JPEG), se c'è
 *  - resize(file, max, q, square): rimpicciolisce e ricomprime in JPEG. Ridisegnando l'immagine
 *    si perdono TUTTI i dati nascosti (posizione, modello del telefono…): si pubblica solo l'immagine.
 *  - distKm(punto, tracciato): distanza minima dal tracciato della strada, in km
 */
window.TougePhoto = (() => {
  function parseTiff(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = (o) => v.getUint16(o, le), u32 = (o) => v.getUint32(o, le);
    const ifd0 = t + u32(t + 4);
    let gpsOff = 0;
    for (let i = 0, n = u16(ifd0); i < n; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gpsOff = t + u32(e + 8); }
    if (!gpsOff) return null;
    const g = {};
    for (let i = 0, n = u16(gpsOff); i < n; i++) {
      const e = gpsOff + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
      if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(e + 8));
      if ((tag === 2 || tag === 4) && type === 5 && cnt === 3) {
        const o = t + u32(e + 8);
        g[tag] = [0, 1, 2].map((k) => u32(o + k * 8) / (u32(o + k * 8 + 4) || 1));
      }
    }
    if (!g[2] || !g[4]) return null;
    let lat = g[2][0] + g[2][1] / 60 + g[2][2] / 3600, lng = g[4][0] + g[4][1] / 60 + g[4][2] / 3600;
    if (g[1] === 'S') lat = -lat;
    if (g[3] === 'W') lng = -lng;
    if (!lat && !lng) return null;
    return [lat, lng];
  }

  async function gps(file) {
    try {
      const buf = await file.slice(0, 512 * 1024).arrayBuffer();
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return null; // non è un JPEG
      let off = 2;
      while (off < v.byteLength - 10) {
        const marker = v.getUint16(off);
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
        if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
        off += 2 + v.getUint16(off + 2);
      }
    } catch (e) { /* foto illeggibile: nessuna posizione */ }
    return null;
  }

  const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  async function resize(file, max, q, square) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url); // i browser applicano da soli la rotazione della foto
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
      const s = Math.min(1, max / Math.max(sw, sh));
      const cv = document.createElement('canvas');
      cv.width = Math.round(sw * s); cv.height = Math.round(sh * s);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      return await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q || 0.82));
    } finally { URL.revokeObjectURL(url); }
  }

  const toDataURL = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });

  function distKm(p, coords) {
    const kx = 111.32 * Math.cos(p[0] * Math.PI / 180), ky = 110.57;
    const xy = (c) => [(c[1] - p[1]) * kx, (c[0] - p[0]) * ky];
    if (!coords || !coords.length) return Infinity;
    if (coords.length === 1) return Math.hypot(...xy(coords[0]));
    let best = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const [ax, ay] = xy(coords[i]), [bx, by] = xy(coords[i + 1]);
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const tt = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      best = Math.min(best, Math.hypot(ax + tt * dx, ay + tt * dy));
    }
    return best;
  }

  return { gps, resize, toDataURL, distKm, NEAR_KM: 2 };
})();
