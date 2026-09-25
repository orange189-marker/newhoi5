// Canvas map renderer: hexes, borders, front lines, labels, units, battles.
window.IM = window.IM || {};

(function () {
  const R = IM.Render = {};
  const HW = 12;                     // hex width in world pixels at zoom 1
  const RH = HW * 0.8660254;         // row height
  const S = HW / Math.sqrt(3);       // hex radius
  R.HW = HW; R.RH = RH;

  let canvas, ctx, W, dpr = 1, visMark = null;
  const cam = R.cam = { x: 0, y: 0, z: 1 };  // x,y = world coords at screen top-left
  R.mode = 'political';
  R.selected = new Set();
  R.hoverHex = -1;
  R.dirty = true;
  R.boxSel = null;
  R.selectedState = -1;

  R.init = function (cv, world) {
    canvas = cv; ctx = canvas.getContext('2d'); W = world;
    R.worldW = W.cols * HW; R.worldH = W.rows * RH + RH;
    // precompute hex centres
    R.cx = new Float32Array(W.n); R.cy = new Float32Array(W.n);
    for (let i = 0; i < W.n; i++) {
      const r = (i / W.cols) | 0, c = i % W.cols;
      R.cx[i] = (c + 0.5 + (r & 1) * 0.5) * HW; R.cy[i] = (r + 0.5) * RH + RH * 0.5;
    }
    IM.Geo.init(W, R);
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  // ------------------------------------------------------------------ graphics quality
  // 'high' draws relief, glow, minor rivers and peaks at up to 2x pixel density;
  // 'low' draws at 1x with the essentials only. 'auto' picks by device and drops
  // to low by itself if the map is slow to redraw.
  const store = { get(k, d) { try { return localStorage.getItem('ironMeridian.' + k) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('ironMeridian.' + k, v); } catch (e) { /* unavailable */ } } };
  R.qualityPref = store.get('quality', 'auto');
  const weakDevice = () => {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return (coarse && Math.min(screen.width, screen.height) < 820) || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  };
  R.quality = R.qualityPref === 'auto' ? (weakDevice() ? 'low' : 'high') : R.qualityPref;
  let slowBuilds = 0;
  R.setQuality = function (pref) {
    R.qualityPref = pref; store.set('quality', pref);
    R.quality = pref === 'auto' ? (weakDevice() ? 'low' : 'high') : pref;
    slowBuilds = 0; base = null; R.resize();
  };

  R.resize = function () {
    dpr = Math.min(window.devicePixelRatio || 1, R.quality === 'low' ? 1 : 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    R.dirty = true;
  };

  R.screenToWorld = (sx, sy) => [cam.x + sx / cam.z, cam.y + sy / cam.z];
  R.worldToScreen = (wx, wy) => [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z];
  R.hexAtScreen = function (sx, sy) {
    let [wx, wy] = R.screenToWorld(sx, sy);
    wx = ((wx % R.worldW) + R.worldW) % R.worldW;
    const r0 = Math.floor((wy - RH * 0.5) / RH);
    let best = -1, bd = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= W.rows) continue;
      const c0 = Math.floor(wx / HW - (r & 1) * 0.5);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const cc = ((c % W.cols) + W.cols) % W.cols, i = r * W.cols + cc;
        let dx = Math.abs(R.cx[i] - wx); if (dx > R.worldW / 2) dx = R.worldW - dx;
        const dy = R.cy[i] - wy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  };
  R.centerOn = function (hex, z) {
    if (z) cam.z = z;
    cam.x = R.cx[hex] - canvas.clientWidth / 2 / cam.z;
    cam.y = R.cy[hex] - canvas.clientHeight / 2 / cam.z;
    R.clampCam(); R.dirty = true;
  };
  R.clampCam = function () {
    const vh = canvas.clientHeight / cam.z;
    const minZ = canvas.clientHeight / R.worldH;
    if (cam.z < minZ) cam.z = minZ;
    cam.y = Math.max(-40 / cam.z, Math.min(R.worldH - vh + 40 / cam.z, cam.y));
    cam.x = ((cam.x % R.worldW) + R.worldW) % R.worldW;
  };
  R.zoomAt = function (sx, sy, factor) {
    const [wx, wy] = R.screenToWorld(sx, sy);
    cam.z = Math.max(0.3, Math.min(9, cam.z * factor));
    cam.x = wx - sx / cam.z; cam.y = wy - sy / cam.z;
    R.clampCam(); R.dirty = true;
  };

  // ------------------------------------------------------------------ colours
  const patternCache = new Map();
  function stripes(color) {
    let p = patternCache.get(color);
    if (p) return p;
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(-2, 10); x.lineTo(10, -2); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
    p = ctx.createPattern(c, 'repeat');
    patternCache.set(color, p);
    return p;
  }

  function fillColor(G, i) {
    const W = G.W;
    if (R.mode === 'terrain') return IM.TERRAIN[W.terrainName(i)].color;
    const o = G.ctrl[i];
    const c = G.countries[o];
    if (!c) return '#555';
    if (R.mode === 'diplomatic' && G.player !== null) {
      if (o === G.player) return '#3f7fd6';
      const r = IM.War.relation(G, G.player, o);
      if (r === 2) return '#c0392b';
      if (r === 1) return '#3aa35a';
      const p = G.countries[G.player];
      if (c.faction >= 0 && c.faction === p.faction) return '#3aa35a';
      return '#7a7a70';
    }
    if (R.mode === 'ideology') return IM.IDEOLOGIES[c.ideo].color;
    if (R.mode === 'supply' && G.player !== null && R._supply) {
      if (o !== G.player && IM.War.relation(G, G.player, o) === 2) return '#6b3a36';
      if (o !== G.player && IM.War.relation(G, G.player, o) !== 1) return '#4f4f4a';
      const d = R._supply[i];
      return d <= IM.War.SUPPLY_RANGE ? '#3e8a4c' : d <= 16 ? '#a39a3a' : d < 255 ? '#b8742e' : '#b8322e';
    }
    return c.color;
  }

  // ------------------------------------------------------------------ labels
  R.computeLabels = function (G) {
    const W = G.W;
    const acc = new Map();
    for (const h of W.land) {
      const o = G.owner[W.stateOf[h]];
      let a = acc.get(o); if (!a) acc.set(o, a = { n: 0, sx: 0, sy: 0, sxs: 0, sxc: 0, hexes: [] });
      a.n++; a.sy += R.cy[h]; a.hexes.push(h);
      const ang = R.cx[h] / R.worldW * Math.PI * 2; a.sxs += Math.sin(ang); a.sxc += Math.cos(ang);
    }
    const labels = [];
    for (const [o, a] of acc) {
      const c = G.countries[o]; if (!c || !c.alive) continue;
      let ang = Math.atan2(a.sxs, a.sxc); if (ang < 0) ang += Math.PI * 2;
      let x = ang / (Math.PI * 2) * R.worldW, y = a.sy / a.n;
      // snap to nearest owned hex so labels stay on land
      let best = a.hexes[0], bd = Infinity;
      for (const h of a.hexes) { let dx = Math.abs(R.cx[h] - x); if (dx > R.worldW / 2) dx = R.worldW - dx; const d = dx * dx + (R.cy[h] - y) ** 2; if (d < bd) { bd = d; best = h; } }
      labels.push({ id: o, x: R.cx[best], y: R.cy[best], size: Math.sqrt(a.n) * HW * 0.42, n: a.n });
    }
    R.labels = labels;
    R.labelsHour = G.hour;
  };

  // ------------------------------------------------------------------ drawing
  function hexPath(p, x, y, s) {
    p.moveTo(x, y - s);
    p.lineTo(x + s * 0.866, y - s * 0.5); p.lineTo(x + s * 0.866, y + s * 0.5);
    p.lineTo(x, y + s); p.lineTo(x - s * 0.866, y + s * 0.5); p.lineTo(x - s * 0.866, y - s * 0.5);
    p.closePath();
  }
  // Edge k of a hex, matching neighbour direction order in world.js.
  function edgeCoords(i, k, off) {
    const x = R.cx[i] + off, y = R.cy[i], s = S * 1.0;
    const r = (i / W.cols) | 0;
    // neighbour order: E, W, NE/NW..., map to vertex pairs
    const odd = r & 1;
    // dirs (even): [1,0]E [-1,0]W [0,-1]NE [-1,-1]NW [0,1]SE [-1,1]SW ; odd: E W NE NW SE SW as well
    const V = [[0, -s], [s * 0.866, -s * 0.5], [s * 0.866, s * 0.5], [0, s], [-s * 0.866, s * 0.5], [-s * 0.866, -s * 0.5]];
    const pairs = [[1, 2], [4, 5], [0, 1], [5, 0], [2, 3], [3, 4]];
    void odd;
    const [a, b] = pairs[k];
    return [x + V[a][0], y + V[a][1], x + V[b][0], y + V[b][1]];
  }

  R.draw = function (G) {
    if (!ctx) return;
    const cw = canvas.width, ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16293a';
    ctx.fillRect(0, 0, cw, ch);
    if (!G) return;
    if (!R.labels || R.labelsFor !== G || G.mapDirty || G.hour - R.labelsHour > 24 * 7 || G.hour < R.labelsHour) { R.computeLabels(G); R.labelsFor = G; G.mapDirty = false; }
    const z = cam.z * dpr;
    const vw = canvas.clientWidth / cam.z, vh = canvas.clientHeight / cam.z;
    const base = ensureBase(G, vw, vh);
    if (base) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const off of [-R.worldW, 0, R.worldW]) {
        const sx = (base.x - cam.x + off) * z, sy = (base.y - cam.y) * z, sw = base.w * z, sh = base.h * z;
        if (sx > cw || sx + sw < 0) continue;
        ctx.drawImage(base.canvas, sx, sy, sw, sh);
      }
    }
    // draw the world up to twice for east-west wrap
    const offs = [0];
    if (cam.x + vw > R.worldW) offs.push(R.worldW);
    for (const off of offs) {
      ctx.setTransform(z, 0, 0, z, (-cam.x + off) * z, -cam.y * z);
      drawLayer(G, off === 0 ? 0 : 0, cam.x - off, cam.y, vw, vh);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (R.boxSel) {
      const b = R.boxSel;
      ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.strokeRect(Math.min(b.x0, b.x1) * dpr, Math.min(b.y0, b.y1) * dpr, Math.abs(b.x1 - b.x0) * dpr, Math.abs(b.y1 - b.y0) * dpr);
      ctx.setLineDash([]);
    }
  };

  // ------------------------------------------------------------------ terrain cache
  let base = null, gid = 0;
  function mapKey(G) {
    if (!G._rid) G._rid = ++gid;
    let h = G._rid * 7919;
    for (const i of W.land) h = (h * 31 + G.ctrl[i]) | 0;
    for (let i = 0; i < G.owner.length; i++) h = (h * 17 + G.owner[i]) | 0;
    if (R.mode === 'supply') h = (h * 31 + ((G.hour / 24) | 0)) | 0;
    return `${h}|${R.mode}|${R.focusOwner ?? -1}|${G.wars.length}|${G.factions.length}|${G.player}|${R.quality}`;
  }
  function ensureBase(G, vw, vh) {
    const now = performance.now(), key = mapKey(G), z = cam.z;
    const covers = b => b && cam.x >= b.x && cam.y >= b.y && cam.x + vw <= b.x + b.w && cam.y + vh <= b.y + b.h;
    const zoomOk = b => b && b.z / z < 1.3 && z / b.z < 1.3;
    if (base && base.G === G && covers(base) && zoomOk(base) && base.key === key) return base;
    // throttle rebuilds while territory churns or while zooming; show the stale image meanwhile
    const slow = R.quality === 'low' ? 1.6 : 1;
    if (base && base.G === G && covers(base) && now - base.t < (base.key !== key ? (z < 1.2 ? 900 : 400) : 140) * slow) { R.dirty = true; return base; }
    const mx = vw * 0.35, my = vh * 0.35;
    const rect = { x: cam.x - mx, y: cam.y - my, w: vw + mx * 2, h: vh + my * 2 };
    let scale = z * dpr;
    const maxPx = R.quality === 'low' ? 3000 : 5200;
    if (rect.w * scale > maxPx) scale = maxPx / rect.w;
    if (rect.h * scale > maxPx) scale = Math.min(scale, maxPx / rect.h);
    R._supply = R.mode === 'supply' && G.player !== null ? IM.War.supplyDepth(G, G.player) : null;
    const cv = base && base.canvas || document.createElement('canvas');
    cv.width = Math.ceil(rect.w * scale); cv.height = Math.ceil(rect.h * scale);
    const c = cv.getContext('2d');
    const saved = ctx; ctx = c;
    c.clearRect(0, 0, cv.width, cv.height);
    for (const off of [-R.worldW, 0, R.worldW]) {
      if (rect.x + rect.w < off || rect.x > off + R.worldW) continue;
      c.setTransform(scale, 0, 0, scale, (off - rect.x) * scale, -rect.y * scale);
      baseLayer(G, rect.x - off, rect.y, rect.w, rect.h, z);
    }
    ctx = saved;
    // on 'auto', repeated slow redraws switch to low quality
    if (R.qualityPref === 'auto' && R.quality === 'high') {
      c.getImageData(0, 0, 1, 1); // make the browser finish drawing before timing
      if (performance.now() - now > 450 && ++slowBuilds >= 3) { R.quality = 'low'; R.resize(); if (IM.Panels && IM.Panels.toast) IM.Panels.toast({ text: 'Graphics set to Low for a smoother map (Game menu → Graphics).', kind: 'info' }); }
    }
    base = { canvas: cv, x: rect.x, y: rect.y, w: rect.w, h: rect.h, z, key, t: now, G };
    return base;
  }

  function visibleHexes(x0, y0, vw, vh) {
    const out = [];
    const r0 = Math.max(0, Math.floor(y0 / RH) - 1), r1 = Math.min(W.rows - 1, Math.ceil((y0 + vh) / RH) + 1);
    const c0 = Math.floor(x0 / HW) - 1, c1 = Math.ceil((x0 + vw) / HW) + 1;
    for (let r = r0; r <= r1; r++) for (let c = Math.max(0, c0); c <= Math.min(W.cols - 1, c1); c++) out.push(r * W.cols + c);
    return out;
  }

  // Terrain layer: coloured cells, occupation stripes, borders and coastline.
  // Rendered into an offscreen cache and reused until territory changes.
  function baseLayer(G, x0, y0, vw, vh, px) {
    const hexPx = HW * px;
    const vis = visibleHexes(x0, y0, vw, vh);
    const Geo = IM.Geo, proxy = Geo.proxy, lowQ = R.quality === 'low', low = hexPx < (lowQ ? 14 : 11);
    const cells = [];
    for (const i of vis) if (proxy[i] >= 0) cells.push(i);
    // edge columns wrapped across the seam
    const r0 = Math.max(0, Math.floor(y0 / RH) - 1), r1 = Math.min(W.rows - 1, Math.ceil((y0 + vh) / RH) + 1);
    for (let r = r0; r <= r1; r++) {
      if (x0 < HW && proxy[W.n + r] >= 0) cells.push(W.n + r);
      if (x0 + vw > R.worldW - HW && proxy[W.n + W.rows + r] >= 0) cells.push(W.n + W.rows + r);
    }
    if (!visMark || visMark.length !== W.n) visMark = new Uint8Array(W.n);
    for (const i of cells) visMark[i] = 1;
    // each copy of the world paints only its own band, so shapes that cross the seam join up
    ctx.save();
    ctx.beginPath(); ctx.rect(-HW * 0.2, y0 - vh, R.worldW + HW * 0.4, vh * 3); ctx.clip();
    // shallow-water glow along the real coastline
    if (hexPx > 6 && !lowQ) { ctx.strokeStyle = 'rgba(110,160,190,0.16)'; ctx.lineWidth = Math.max(5 / px, HW * 0.45); ctx.lineJoin = 'round'; ctx.stroke(Geo.coast); }
    // everything below is clipped to the true shape of the land
    ctx.save();
    ctx.clip(Geo.coast);
    ctx.fillStyle = '#7b7768'; // land nobody holds (remote islands)
    ctx.fillRect(x0 - HW, y0 - HW, vw + HW * 2, vh + HW * 2);
    // --- fills grouped by colour
    const groups = new Map();
    const occupied = [];
    for (const i of cells) {
      const p = proxy[i];
      const col = fillColor(G, p);
      let path = groups.get(col); if (!path) groups.set(col, path = new Path2D());
      Geo.cellPath(path, i, low);
      if (R.mode === 'political' && G.ctrl[p] !== G.owner[W.stateOf[p]]) occupied.push(i);
    }
    for (const [col, path] of groups) { ctx.fillStyle = col; ctx.fill(path); if (!low) { ctx.strokeStyle = col; ctx.lineWidth = 0.6 / px; ctx.stroke(path); } }
    // relief: soft hillshade, slopes facing the north-west light brighter, the rest in shadow
    if (Geo.relief && R.quality !== 'low') {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(Geo.relief, 0, RH * 0.5, R.worldW, W.rows * RH);
    }
    // occupied territory: owner colour stripes over the occupier colour
    if (occupied.length) {
      const og = new Map();
      for (const i of occupied) { const oc = G.countries[G.owner[W.stateOf[proxy[i]]]].color; let path = og.get(oc); if (!path) og.set(oc, path = new Path2D()); Geo.cellPath(path, i, low); }
      ctx.save(); ctx.globalAlpha = 0.75;
      for (const [oc, path] of og) {
        const pat = stripes(oc);
        pat.setTransform && pat.setTransform(new DOMMatrix().scale(1 / cam.z * 1.2));
        ctx.fillStyle = pat; ctx.fill(path);
      }
      ctx.restore();
    }
    // lakes and rivers
    ctx.fillStyle = '#1a3042'; ctx.fill(Geo.lakes);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(14,22,30,0.9)'; ctx.lineWidth = Math.max(0.8 / px, HW * 0.04); ctx.stroke(Geo.lakes);
    ctx.strokeStyle = 'rgba(92,150,196,0.95)';
    if (hexPx > 3) { ctx.lineWidth = Math.max(1.5 / px, HW * 0.09); ctx.stroke(Geo.rivers[1]); }
    if (hexPx > (lowQ ? 14 : 7)) { ctx.lineWidth = Math.max(1.1 / px, HW * 0.06); ctx.stroke(Geo.rivers[2]); }
    if (hexPx > 15 && !lowQ) { ctx.lineWidth = Math.max(0.8 / px, HW * 0.04); ctx.stroke(Geo.rivers[3]); }
    // peaks and hills when zoomed in
    if (hexPx > 15 && !lowQ) drawRelief(cells, proxy, hexPx, px);
    // nation-selection highlight: dim everyone else
    const F = R.focusOwner ?? -1;
    if (F >= 0) {
      const dim = new Path2D();
      for (const i of cells) if (G.owner[W.stateOf[proxy[i]]] !== F) Geo.cellPath(dim, i, low);
      ctx.fillStyle = 'rgba(8,12,16,0.58)'; ctx.fill(dim);
    }
    // --- borders along the organic cell edges: state (thin), country (thick), fronts
    const stateB = new Path2D(), countryB = new Path2D(), front = new Path2D(), focusB = new Path2D();
    for (const i of cells) {
      if (i >= W.n) continue; // ghost cells: their edges are drawn from the other side
      const p = proxy[i], si = W.stateOf[p], oi = G.owner[si], ci = G.ctrl[p];
      for (let k = 0; k < 6; k++) {
        const j = W.nb[i * 6 + k];
        if (j < 0) continue;
        const q = proxy[j];
        if (q < 0 || q === p) continue;
        if (j < i && visMark[j]) continue; // each shared edge once
        const sj = W.stateOf[q], oj = G.owner[sj], cj = G.ctrl[q];
        if (F >= 0 && (oi === F) !== (oj === F)) Geo.edgePath(focusB, i, k, low);
        if (sj === si && cj === ci) continue;
        if (ci !== cj && ci >= 0 && cj >= 0 && IM.War.isEnemy(G, ci, cj)) Geo.edgePath(front, i, k, low);
        else if (oi !== oj) Geo.edgePath(countryB, i, k, low);
        else if (hexPx > 6) Geo.edgePath(stateB, i, k, low);
      }
    }
    for (const i of cells) visMark[i] = 0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (hexPx > 6) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.9 / px; ctx.stroke(stateB); }
    ctx.strokeStyle = 'rgba(12,10,8,0.85)'; ctx.lineWidth = Math.max(1.4 / px, HW * 0.08); ctx.stroke(countryB);
    ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = Math.max(2.2 / px, HW * 0.14); ctx.stroke(front);
    ctx.strokeStyle = 'rgba(40,0,0,0.9)'; ctx.lineWidth = Math.max(0.8 / px, HW * 0.04); ctx.stroke(front);
    ctx.restore();
    // coastline on top: the real outline of the land
    ctx.strokeStyle = 'rgba(14,22,30,0.9)'; ctx.lineWidth = Math.max(1 / px, HW * 0.05); ctx.stroke(Geo.coast);
    if (F >= 0) {
      ctx.save(); ctx.clip(Geo.coast);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(4 / px, HW * 0.2); ctx.stroke(focusB);
      ctx.strokeStyle = '#f2d27d'; ctx.lineWidth = Math.max(2 / px, HW * 0.09); ctx.stroke(focusB);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRelief(cells, proxy, hexPx, px) {
    const dark = new Path2D(), light = new Path2D(), snow = new Path2D(), hills = new Path2D();
    const rnd = (i, k) => ((Math.imul(i, 2654435761) ^ Math.imul(k + 1, 40503)) >>> 0) / 4294967296;
    for (const i of cells) {
      const h = proxy[i]; if (h !== i && !(i >= W.n && W.region[h])) continue;
      const t = W.terrainName(h);
      const x = i >= W.n ? IM.Geo.cells[i][0] : R.cx[h], y = i >= W.n ? IM.Geo.cells[i][1] + S : R.cy[h];
      if (t === 'mountain') {
        for (let k = 0; k < 2; k++) {
          const px0 = x + (rnd(h, k) - 0.5) * S * 0.9 + (k ? S * 0.25 : -S * 0.25), py0 = y + (rnd(h, k + 5) - 0.3) * S * 0.5;
          const w = S * (0.45 + rnd(h, k + 9) * 0.2), ht = w * 1.05;
          dark.moveTo(px0 - w / 2, py0); dark.lineTo(px0, py0 - ht); dark.lineTo(px0 + w / 2, py0); dark.closePath();
          light.moveTo(px0 - w / 2, py0); light.lineTo(px0, py0 - ht); light.lineTo(px0 - w * 0.08, py0); light.closePath();
          if (IM.Geo.height[h] > 0.75) { snow.moveTo(px0 - w * 0.13, py0 - ht * 0.72); snow.lineTo(px0, py0 - ht); snow.lineTo(px0 + w * 0.13, py0 - ht * 0.72); snow.closePath(); }
        }
      } else if (t === 'hills' && hexPx > 22) {
        const hx = x + (rnd(h, 3) - 0.5) * S * 0.6, hy = y + S * 0.2;
        hills.moveTo(hx - S * 0.35, hy); hills.quadraticCurveTo(hx, hy - S * 0.4, hx + S * 0.35, hy);
      }
    }
    ctx.fillStyle = 'rgba(30,20,10,0.2)'; ctx.fill(dark);
    ctx.fillStyle = 'rgba(255,250,235,0.16)'; ctx.fill(light);
    ctx.fillStyle = 'rgba(250,250,255,0.55)'; ctx.fill(snow);
    ctx.strokeStyle = 'rgba(30,20,10,0.25)'; ctx.lineWidth = Math.max(0.8 / px, HW * 0.03); ctx.stroke(hills);
  }

  function drawLayer(G, off, x0, y0, vw, vh) {
    const px = cam.z; // screen pixels per world pixel
    const hexPx = HW * px;
    const vis = visibleHexes(x0, y0, vw, vh);
    const Geo = IM.Geo, proxy = Geo.proxy, low = hexPx < 7;
    if (R.selectedState >= 0 || (R.hoverHex >= 0 && W.region[R.hoverHex])) {
      const cells = [];
      for (const i of vis) if (proxy[i] >= 0) cells.push(i);
      ctx.save(); ctx.clip(Geo.coast);
    // selected state and hovered tile
    if (R.selectedState >= 0) {
      const path = new Path2D();
      for (const i of cells) if (W.stateOf[proxy[i]] === R.selectedState) Geo.cellPath(path, i, low);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(path);
    }
    if (R.hoverHex >= 0 && W.region[R.hoverHex]) {
      const path = new Path2D();
      for (const i of cells) if (proxy[i] === R.hoverHex) Geo.cellPath(path, i, low);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(path);
    }
      ctx.restore();
    }
    // forts (when zoomed in)
    if (hexPx > 14) {
      ctx.fillStyle = 'rgba(40,30,20,0.55)';
      for (const i of vis) if (G.fort[i]) {
        const n = G.fort[i];
        for (let k = 0; k < n; k++) ctx.fillRect(R.cx[i] - S * 0.7 + k * S * 0.3, R.cy[i] + S * 0.55, S * 0.22, S * 0.22);
      }
    }
    drawCamps(G, hexPx, px);
    if (R.mode === 'supply' && G.player !== null) drawHubs(G, vis, px);
    drawCities(G, vis, hexPx, px);
    drawLabels(G, x0, y0, vw, vh, hexPx, px);
    if (R.showUnits !== false) {
      drawArrows(G, px);
      drawUnits(G, vis, hexPx, px);
      drawBattles(G, px, hexPx);
    }
    drawNukes(G, px);
    drawMarks(px);
  }

  // objective markers (tutorial): a gold ring, pulsing while the player is asked to look for it
  function drawMarks(px) {
    if (!R.marks) return;
    const t = performance.now() / 1000;
    for (const m of R.marks) {
      const x = R.cx[m.hex], y = R.cy[m.hex], r = Math.max(9 / px, S * 1.6);
      ctx.lineWidth = Math.max(2 / px, S * 0.18); ctx.strokeStyle = 'rgba(242,210,125,0.95)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      if (m.pulse) {
        const u = (t % 1.4) / 1.4;
        ctx.strokeStyle = `rgba(242,210,125,${1 - u})`; ctx.beginPath(); ctx.arc(x, y, r * (1 + u * 1.6), 0, 7); ctx.stroke();
      }
      const fs = Math.max(11 / px, S * 0.9);
      ctx.font = `700 ${fs}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = fs * 0.25; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#f2d27d';
      const label = `★ ${m.label}`;
      ctx.strokeText(label, x, y - r - 2 / px); ctx.fillText(label, x, y - r - 2 / px);
    }
  }

  // Supply hubs of the player: victory-point cities they hold
  function drawHubs(G, vis, px) {
    ctx.strokeStyle = '#e8f5d0'; ctx.fillStyle = 'rgba(30,60,30,0.85)';
    for (const s of W.states) {
      const h = s.cityHex;
      if (s.vp < 3 || G.ctrl[h] !== G.player || !inView(h, vis)) continue;
      const r = Math.max(3.5 / px, S * 0.45);
      ctx.lineWidth = Math.max(1.4 / px, r * 0.22);
      ctx.beginPath(); ctx.arc(R.cx[h], R.cy[h], r, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  // Field camps of a military buildup: clusters of tents that grow with each report.
  function drawCamps(G, hexPx, px) {
    if (!G.camps || !G.camps.length || hexPx < 4) return;
    for (const c of G.camps) {
      const s = W.stateByName[c.city]; if (!s) continue;
      const x0 = R.cx[s.cityHex], y0 = R.cy[s.cityHex] + S * 0.9;
      const n = 2 + c.level * 3, r = S * 0.2;
      ctx.fillStyle = 'rgba(40,20,10,0.35)';
      ctx.beginPath(); ctx.ellipse(x0, y0, S * (0.5 + c.level * 0.18), S * (0.3 + c.level * 0.08), 0, 0, 7); ctx.fill();
      for (let i = 0; i < n; i++) {
        const a = i * 2.4, d = S * 0.12 * Math.sqrt(i) * (1 + c.level * 0.25);
        const x = x0 + Math.cos(a) * d * 1.6, y = y0 + Math.sin(a) * d;
        ctx.fillStyle = i % 4 === 0 ? '#9a8f5e' : '#6f6a3e';
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.6); ctx.lineTo(x - r, y + r * 0.6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6 / px; ctx.stroke();
      }
      if (hexPx > 16) {
        const fs = Math.max(8, Math.min(12, hexPx * 0.45)) / px;
        ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 2.4 / px; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#e8c07a';
        const label = `Field camp · ${['', 'small', 'growing', 'large', 'massive'][Math.min(4, c.level)]}`;
        ctx.strokeText(label, x0, y0 + S * 0.55); ctx.fillText(label, x0, y0 + S * 0.55);
      }
    }
  }

  function drawCities(G, vis, hexPx, px) {
    if (hexPx < 5) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const s of W.states) {
      const h = s.cityHex;
      if (!inView(h, vis)) continue;
      const big = s.vp >= 10;
      if (!big && hexPx < 11) continue;
      const r = (big ? 2.6 : 1.8) / px * Math.min(2, hexPx / 10);
      ctx.fillStyle = big ? '#f4e6b0' : '#d8d0b0';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8 / px;
      ctx.beginPath();
      if (s.id === (G.countries[G.owner[s.id]] || {}).capital) { const q = r * 1.5; ctx.rect(R.cx[h] - q, R.cy[h] - q, q * 2, q * 2); }
      else ctx.arc(R.cx[h], R.cy[h], r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if ((big && hexPx > 9) || hexPx > 20) {
        const fs = Math.max(8, Math.min(13, hexPx * 0.55)) / px;
        ctx.font = `${big ? 600 : 500} ${fs}px system-ui, sans-serif`;
        ctx.lineWidth = 2.6 / px; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(s.name, R.cx[h], R.cy[h] - r - 1 / px);
        ctx.fillStyle = '#fff'; ctx.fillText(s.name, R.cx[h], R.cy[h] - r - 1 / px);
      }
    }
  }
  let visSetCache = null, visSetKey = null;
  function inView(h, vis) {
    if (visSetKey !== vis) { visSetCache = new Set(vis); visSetKey = vis; }
    return visSetCache.has(h);
  }

  function drawLabels(G, x0, y0, vw, vh, hexPx, px) {
    if (!R.labels || R.mode === 'terrain') return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const L of R.labels) {
      const c = G.countries[L.id]; if (!c || !c.alive) continue;
      const screenSize = L.size * px;
      if (screenSize < 9 || (hexPx > 22 && L.n > 40)) continue;
      if (L.x < x0 - 200 || L.x > x0 + vw + 200 || L.y < y0 - 100 || L.y > y0 + vh + 100) continue;
      let name = c.name.toUpperCase();
      let fs = Math.min(L.size, 40 / px);
      ctx.font = `700 ${fs}px Georgia, 'Times New Roman', serif`;
      // shrink long names so they fit the country's width
      const maxW = Math.max(L.size * 3.2, 60 / px);
      const w = ctx.measureText(name).width;
      if (w > maxW) { fs *= maxW / w; if (fs * px < 8) { name = c.tag; fs = Math.min(L.size, 40 / px); } ctx.font = `700 ${fs}px Georgia, 'Times New Roman', serif`; }
      ctx.lineWidth = fs * 0.1; ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeText(name, L.x, L.y);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(name, L.x, L.y);
    }
  }

  function drawArrows(G, px) {
    const me = G.player;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of G.divisions) {
      if (!d.path.length) continue;
      const sel = R.selected.has(d.id);
      if (d.owner !== me && !sel) continue;
      if (!sel && d.path.length === 1 && d.battle >= 0) continue;
      ctx.strokeStyle = sel ? 'rgba(255,230,90,0.95)' : 'rgba(120,220,120,0.65)';
      ctx.lineWidth = (sel ? 2.2 : 1.4) / px;
      ctx.beginPath();
      let px0 = R.cx[d.hex], py0 = R.cy[d.hex];
      ctx.moveTo(px0, py0);
      for (const h of d.path) {
        let x = R.cx[h]; if (Math.abs(x - px0) > R.worldW / 2) x += x < px0 ? R.worldW : -R.worldW;
        ctx.lineTo(x, R.cy[h]); px0 = x; py0 = R.cy[h];
      }
      ctx.stroke();
      // arrow head
      const n = d.path.length;
      const a = n >= 2 ? d.path[n - 2] : d.hex, b = d.path[n - 1];
      const ang = Math.atan2(R.cy[b] - R.cy[a], R.cx[b] - R.cx[a]);
      const L = 4 / px;
      ctx.beginPath(); ctx.moveTo(px0, py0);
      ctx.lineTo(px0 - L * Math.cos(ang - 0.5), py0 - L * Math.sin(ang - 0.5));
      ctx.moveTo(px0, py0); ctx.lineTo(px0 - L * Math.cos(ang + 0.5), py0 - L * Math.sin(ang + 0.5));
      ctx.stroke();
    }
  }

  function drawUnits(G, vis, hexPx, px) {
    const byHex = IM.War.byHex(G);
    const me = G.player;
    for (const i of vis) {
      const ds = byHex.get(i); if (!ds || !ds.length) continue;
      const live = ds.filter(d => !d.dead);
      if (!live.length) continue;
      // group by owner, draw largest stack
      const owners = new Map();
      for (const d of live) { let a = owners.get(d.owner); if (!a) owners.set(d.owner, a = []); a.push(d); }
      let k = 0;
      for (const [o, arr] of owners) {
        const c = G.countries[o];
        const x = R.cx[i], y = R.cy[i] - k * S * 0.9;
        k++;
        const anySel = arr.some(d => R.selected.has(d.id));
        if (hexPx < 7) {
          const r = 2.4 / px;
          ctx.fillStyle = o === me ? '#ffe070' : c.color;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6 / px; ctx.strokeRect(x - r, y - r, r * 2, r * 2);
          continue;
        }
        const w = Math.min(HW * 1.4, 40 / px), h = w * 0.46;
        const bx = x - w / 2, by = y - h / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx + 0.8 / px, by + 0.8 / px, w, h);
        ctx.fillStyle = 'rgba(20,20,20,0.88)'; ctx.fillRect(bx, by, w, h);
        const fimg = IM.flagImage(c);
        if (fimg.complete && fimg.naturalWidth) ctx.drawImage(fimg, bx, by, w * 0.34, h);
        else { ctx.fillStyle = c.color; ctx.fillRect(bx, by, w * 0.34, h); }
        ctx.lineWidth = (anySel ? 1.8 : 0.8) / px;
        ctx.strokeStyle = anySel ? '#ffe070' : (o === me ? '#d9f0ff' : '#000');
        ctx.strokeRect(bx, by, w, h);
        // icon: NATO-style box for main type
        const main = arr.reduce((m, d) => (d.tpl === 'arm' ? 'arm' : m === 'arm' ? m : d.tpl === 'mec' ? 'mec' : m), arr[0].tpl);
        drawNato(bx + w * 0.39, by + h * 0.22, w * 0.24, h * 0.56, main, px);
        const fs = h * 0.66;
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(arr.length), bx + w * 0.81, by + h * 0.5);
        // org / strength bars
        const org = arr.reduce((a, d) => a + d.org / IM.War.stats(G, d).org, 0) / arr.length;
        const str = arr.reduce((a, d) => a + d.str, 0) / arr.length;
        ctx.fillStyle = '#222'; ctx.fillRect(bx, by + h, w, h * 0.3);
        ctx.fillStyle = '#4fc35a'; ctx.fillRect(bx, by + h, w * Math.max(0, Math.min(1, org)), h * 0.15);
        ctx.fillStyle = '#d9c24a'; ctx.fillRect(bx, by + h * 1.15, w * Math.max(0, Math.min(1, str)), h * 0.15);
        if (arr.some(d => !d.supplied)) { ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(bx + w, by, h * 0.22, 0, 7); ctx.fill(); }
      }
    }
  }
  function drawNato(x, y, w, h, tpl, px) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 / px;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    if (tpl === 'inf' || tpl === 'mnt' || tpl === 'mar' || tpl === 'gar' || tpl === 'mot' || tpl === 'mec') { ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); }
    if (tpl === 'arm' || tpl === 'mec') ctx.ellipse(x + w / 2, y + h / 2, w * 0.32, h * 0.28, 0, 0, Math.PI * 2);
    if (tpl === 'mot') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); }
    if (tpl === 'mnt') { ctx.moveTo(x + w * 0.3, y + h); ctx.lineTo(x + w / 2, y + h * 0.7); ctx.lineTo(x + w * 0.7, y + h); }
    ctx.stroke();
  }

  function drawBattles(G, px, hexPx) {
    if (hexPx < 5) return;
    for (const b of G.battles.values()) {
      const x = R.cx[b.hex], y = R.cy[b.hex] - S * 0.9;
      const r = Math.max(3.2 / px, S * 0.42);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = Math.max(0.8 / px, r * 0.18);
      ctx.beginPath(); ctx.moveTo(x - r * 0.55, y - r * 0.55); ctx.lineTo(x + r * 0.55, y + r * 0.55);
      ctx.moveTo(x + r * 0.55, y - r * 0.55); ctx.lineTo(x - r * 0.55, y + r * 0.55); ctx.stroke();
    }
  }

  function drawNukes(G, px) {
    const now = performance.now();
    for (const f of G.nukeFlashes) {
      if (!f.real) f.real = now;
      const t = (now - f.real) / 2500;
      if (t > 1) continue;
      const rr = (f.r + 1) * HW * (0.5 + t * 1.5);
      const g = ctx.createRadialGradient(R.cx[f.hex], R.cy[f.hex], 0, R.cx[f.hex], R.cy[f.hex], rr);
      g.addColorStop(0, `rgba(255,255,230,${1 - t})`); g.addColorStop(0.4, `rgba(255,170,40,${0.8 * (1 - t)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(R.cx[f.hex], R.cy[f.hex], rr, 0, 7); ctx.fill();
      R.dirty = true;
    }
    G.nukeFlashes = G.nukeFlashes.filter(f => !f.real || now - f.real < 2600);
  }
})();
