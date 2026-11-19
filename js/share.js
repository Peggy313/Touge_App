/* TOUGE App — immagine "storia" 1080×1920 con la placca STRADA GUIDATA.
 * Disegnata su canvas: illustrazione della strada (SVG → immagine), placca rally,
 * nome della strada, dati e firma TOUGE. I caratteri sono quelli della pagina (Google Fonts).
 */
(function () {
  const W = 1080, H = 1920;
  const C = { ink: '#141414', paper: '#efe6d2', cream: '#f6efe0', red: '#e3262c', yellow: '#ffcc00', blue: '#1b3a8c', sky: '#3fa9f5', bg: '#0f0f11', muted: '#9a9384' };
  const PLATE = 'M8 60 L91 60 A160 60 0 0 1 411 60 L494 60 Q502 60 502 68 L502 218 Q502 226 494 226 L8 226 Q0 226 0 218 L0 68 Q0 60 8 60 Z';

  function loadSvg(svg) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }
  async function fonts() {
    if (!document.fonts || !document.fonts.load) return;
    const specs = ['400 140px "League Gothic"', '700 72px "Josefin Sans"', '400 120px Anton', '700 40px "Space Mono"', '400 40px "Space Mono"', '900 60px "Noto Sans JP"'];
    await Promise.all(specs.map((s) => document.fonts.load(s, s.includes('Noto') ? '峠走り屋' : 'A1').catch(() => {})));
  }
  // testo che si adatta in larghezza (scala orizzontale se troppo lungo)
  function fitText(ctx, text, x, y, maxW, align) {
    const w = ctx.measureText(text).width;
    ctx.textAlign = align || 'center';
    if (w <= maxW) { ctx.fillText(text, x, y); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(maxW / w, 1); ctx.fillText(text, 0, 0); ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawPlate(ctx, cx, cy, width, no, ddmm, year, title) {
    const s = width / 514;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-6 * Math.PI / 180); ctx.scale(s, s); ctx.translate(-251, -113);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8; ctx.shadowBlur = 0;
    const p = new Path2D(PLATE);
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = C.cream; ctx.stroke(p);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.red; ctx.fill(p);
    ctx.fillStyle = C.cream; roundRect(ctx, 172, 16, 158, 70, 8); ctx.fill();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.red; ctx.font = '700 72px "Josefin Sans", Futura, sans-serif'; fitText(ctx, no, 251, 77, 136);
    ctx.fillStyle = C.cream; ctx.font = '400 50px "League Gothic", "Arial Narrow", sans-serif';
    fitText(ctx, ddmm, 164, 92, 74, 'right'); fitText(ctx, year, 338, 92, 74, 'left');
    ctx.font = '400 140px "League Gothic", "Arial Narrow", sans-serif';
    const w = ctx.measureText(title).width; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(251, 205); ctx.scale(470 / w, 1); ctx.fillText(title, 0, 0); ctx.restore();
    ctx.restore();
  }

  /* road: oggetto strada · info: { drivenAt, drivenLabel, hairpinsLabel, region, country, tagline } */
  async function plateStory(road, info) {
    await fonts();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // illustrazione
    const artH = 1200;
    try { ctx.drawImage(await loadSvg(window.roadArt(road, { w: W, h: artH, stripes: true })), 0, 0, W, artH); } catch (e) { /* senza illustrazione */ }
    const fade = ctx.createLinearGradient(0, artH - 380, 0, artH);
    fade.addColorStop(0, 'rgba(15,15,17,0)'); fade.addColorStop(1, C.bg);
    ctx.fillStyle = fade; ctx.fillRect(0, artH - 380, W, 380);

    // fascia alta
    ctx.fillStyle = C.yellow; ctx.fillRect(0, 0, W, 96);
    ctx.fillStyle = C.ink; ctx.fillRect(0, 96, W, 6);
    ctx.font = '700 32px "Space Mono", monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('峠道 · TOUGE CULTURE', 48, 50);
    ctx.textAlign = 'right'; ctx.fillText('No.' + road.no, W - 48, 50);
    ctx.textBaseline = 'alphabetic';

    // placca
    const d = new Date(info.drivenAt || Date.now());
    const ddmm = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    drawPlate(ctx, W / 2, 1060, 880, road.no, ddmm, String(d.getFullYear()), info.drivenLabel.toUpperCase());

    // nome e dati
    ctx.fillStyle = C.paper; ctx.font = '400 128px Anton, Impact, sans-serif';
    ctx.shadowColor = C.ink; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;
    fitText(ctx, road.name.toUpperCase(), W / 2, 1400, W - 96);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.muted; ctx.font = '700 34px "Space Mono", monospace';
    fitText(ctx, (info.country + ' · ' + info.region).toUpperCase(), W / 2, 1466, W - 120);
    ctx.fillStyle = C.yellow; ctx.font = '700 46px "Space Mono", monospace';
    fitText(ctx, `${road.alt} M  ·  ${road.km} KM  ·  ≈${road.hairpins} ${info.hairpinsLabel.toUpperCase()}`, W / 2, 1556, W - 120);

    // livrea + firma
    const yS = 1660;
    [[C.blue, 0, 22], [C.sky, 30, 14], [C.red, 52, 22]].forEach(([col, off, h]) => { ctx.fillStyle = col; ctx.fillRect(0, yS + off, W, h); });
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(110, 1820, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.paper; ctx.font = '900 56px "Noto Sans JP", "Yu Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('峠', 110, 1822);
    ctx.textAlign = 'left'; ctx.font = '400 84px Anton, Impact, sans-serif'; ctx.fillText('TOUGE', 186, 1816);
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = '700 28px "Space Mono", monospace';
    fitText(ctx, info.tagline.toUpperCase(), W - 48, 1816, 560, 'right');

    return new Promise((resolve, reject) => {
      try { cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'); } catch (e) { reject(e); }
    });
  }

  window.TougeShare = { plateStory };
})();
