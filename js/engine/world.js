// Static world: hex grid, terrain, states (built from cities), adjacency, pathfinding.
window.IM = window.IM || {};

IM.HEX_KM = 100;

IM.buildWorld = function () {
  const M = IM.MAPDATA;
  const cols = M.cols, rows = M.rows, n = cols * rows;
  const W = { cols, rows, n, hexW: M.hexW, hexH: M.hexH, latTop: M.latTop };
  const region = new Uint8Array(n);      // 0 = sea, else index+1 into M.codes
  const terrain = new Uint8Array(n);
  M.cells.forEach((line, r) => {
    let c = 0;
    for (const part of line.split(' ')) {
      const [v, cnt] = part.split('.').map(x => parseInt(x, 36));
      for (let k = 0; k < cnt; k++) region[r * cols + c++] = v;
    }
  });
  M.terrain.forEach((line, r) => { for (let c = 0; c < cols; c++) terrain[r * cols + c] = +line[c]; });

  const lonOf = i => { const r = (i / cols) | 0, c = i % cols; let x = -180 + (c + 0.5 + (r & 1) * 0.5) * M.hexW; return x > 180 ? x - 360 : x; };
  const latOf = i => M.latTop - (((i / cols) | 0) + 0.5) * M.hexH;
  const hexAt = (lon, lat) => {
    const r = Math.max(0, Math.min(rows - 1, Math.round((M.latTop - lat) / M.hexH - 0.5)));
    let c = Math.round((lon + 180) / M.hexW - 0.5 - (r & 1) * 0.5);
    c = ((c % cols) + cols) % cols;
    return r * cols + c;
  };

  // Neighbours (odd-r offset layout, wrapping east-west).
  const nb = new Int32Array(n * 6).fill(-1);
  const EVEN = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  const ODD = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = (r & 1) ? ODD : EVEN, i = r * cols + c;
    for (let k = 0; k < 6; k++) {
      const rr = r + d[k][1]; if (rr < 0 || rr >= rows) continue;
      const cc = ((c + d[k][0]) % cols + cols) % cols;
      nb[i * 6 + k] = rr * cols + cc;
    }
  }

  // Cities: put islands with no hex onto the map, then assign states.
  const codeIdx = Object.fromEntries(M.codes.map((c, i) => [c, i + 1]));
  const TERR = M.terrainIds;
  const cityList = IM.CITIES.map(([name, code, lat, lon, vp, pop]) => ({ name, code, lat, lon, vp, pop }));
  const byCode = {};
  for (const ct of cityList) (byCode[ct.code] = byCode[ct.code] || []).push(ct);
  const dist2 = (lon1, lat1, lon2, lat2) => {
    let dx = Math.abs(lon1 - lon2); if (dx > 180) dx = 360 - dx;
    dx *= Math.cos((lat1 + lat2) * Math.PI / 360);
    const dy = lat1 - lat2; return dx * dx + dy * dy;
  };
  const stateOf = new Int16Array(n).fill(-1);
  function assign() {
    stateOf.fill(-1);
    for (let i = 0; i < n; i++) {
      if (!region[i]) continue;
      const list = byCode[M.codes[region[i] - 1]];
      if (!list) continue;
      const lo = lonOf(i), la = latOf(i);
      let best = null, bd = Infinity;
      for (const ct of list) { const d = dist2(lo, la, ct.lon, ct.lat); if (d < bd) { bd = d; best = ct; } }
      stateOf[i] = best.idx;
    }
  }
  cityList.forEach((c, i) => { c.idx = i; });
  assign();
  const counts = new Int32Array(cityList.length);
  for (let i = 0; i < n; i++) if (stateOf[i] >= 0) counts[stateOf[i]]++;
  let added = 0;
  for (const ct of cityList) {
    if (counts[ct.idx]) continue;
    const h = hexAt(ct.lon, ct.lat);
    if (!region[h]) { region[h] = codeIdx[ct.code]; terrain[h] = TERR.indexOf('plains'); added++; }
  }
  if (added) assign();

  // Build states.
  const states = cityList.map(c => ({
    id: c.idx, name: c.name, code: c.code, vp: c.vp, pop: c.pop, hexes: [], cityHex: -1, coastal: false,
    lat: c.lat, lon: c.lon, neighbors: new Set(),
  }));
  for (let i = 0; i < n; i++) if (stateOf[i] >= 0) states[stateOf[i]].hexes.push(i);
  for (const s of states) {
    if (!s.hexes.length) continue;
    const h = hexAt(s.lon, s.lat);
    if (stateOf[h] === s.id) s.cityHex = h;
    else { // nearest own hex to the city
      let bd = Infinity;
      for (const x of s.hexes) { const d = dist2(lonOf(x), latOf(x), s.lon, s.lat); if (d < bd) { bd = d; s.cityHex = x; } }
    }
  }
  // drop empty states but keep ids stable by remapping
  const live = states.filter(s => s.hexes.length);
  const remap = new Int16Array(states.length).fill(-1);
  live.forEach((s, i) => { remap[s.id] = i; s.id = i; });
  for (let i = 0; i < n; i++) if (stateOf[i] >= 0) stateOf[i] = remap[stateOf[i]];

  const coastal = new Uint8Array(n);
  const isLand = i => region[i] !== 0;
  for (let i = 0; i < n; i++) {
    if (!region[i]) continue;
    for (let k = 0; k < 6; k++) {
      const j = nb[i * 6 + k];
      if (j < 0) continue;
      if (!region[j]) coastal[i] = 1;
      else if (stateOf[j] !== stateOf[i]) live[stateOf[i]].neighbors.add(stateOf[j]);
    }
  }
  for (const s of live) {
    s.coastal = s.hexes.some(h => coastal[h]);
    s.neighbors = [...s.neighbors];
    if (s.vp >= 10) terrain[s.cityHex] = TERR.length; // 'urban' (appended to terrainNames below)
  }
  W.terrainNames = [...TERR, 'urban'];
  const stateByName = Object.fromEntries(live.map(s => [s.name, s]));

  const landList = [];
  for (let i = 0; i < n; i++) if (region[i]) landList.push(i);
  W.land = Int32Array.from(landList);
  Object.assign(W, {
    region, terrain, nb, stateOf, states: live, stateByName, coastal, codes: M.codes,
    lonOf, latOf, hexAt, isLand, codeOfHex: i => region[i] ? M.codes[region[i] - 1] : null,
    terrainName: i => W.terrainNames[terrain[i]],
  });

  // Cube coordinates for distance heuristics.
  const cx = new Int32Array(n), cz = new Int32Array(n);
  for (let i = 0; i < n; i++) { const r = (i / cols) | 0, c = i % cols; cx[i] = c - ((r - (r & 1)) >> 1); cz[i] = r; }
  W.hexDist = (a, b) => {
    let best = Infinity;
    for (const off of [0, cols, -cols]) {
      const dx = cx[a] - cx[b] - off, dz = cz[a] - cz[b], dy = -dx - dz;
      const d = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      if (d < best) best = d;
    }
    return best;
  };
  W.neighbors = function* (i) { for (let k = 0; k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0) yield j; } };
  return W;
};

// Binary heap keyed by numeric priority.
IM.Heap = class {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(v, p) {
    const k = this.k, vs = this.v; let i = k.length; k.push(p); vs.push(v);
    while (i > 0) { const pa = (i - 1) >> 1; if (k[pa] <= p) break; k[i] = k[pa]; vs[i] = vs[pa]; i = pa; }
    k[i] = p; vs[i] = v;
  }
  pop() {
    const k = this.k, vs = this.v, top = vs[0], lk = k.pop(), lv = vs.pop(), n = k.length;
    if (n) {
      let i = 0;
      while (true) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; vs[i] = vs[c]; i = c;
      }
      k[i] = lk; vs[i] = lv;
    }
    return top;
  }
};

// A* over the hex grid. cost(from, to) returns step cost or Infinity if blocked.
IM.findPath = function (W, start, goal, cost, minStep, maxNodes) {
  if (start === goal) return [];
  const g = new Map([[start, 0]]), came = new Map();
  const open = new IM.Heap();
  open.push(start, W.hexDist(start, goal) * minStep);
  let expanded = 0;
  maxNodes = maxNodes || 20000;
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (++expanded > maxNodes) return null;
    const gc = g.get(cur);
    for (let k = 0; k < 6; k++) {
      const nx = W.nb[cur * 6 + k];
      if (nx < 0) continue;
      const c = cost(cur, nx, nx === goal);
      if (c === Infinity) continue;
      const ng = gc + c;
      const old = g.get(nx);
      if (old !== undefined && old <= ng) continue;
      g.set(nx, ng); came.set(nx, cur);
      open.push(nx, ng + W.hexDist(nx, goal) * minStep);
    }
  }
  if (!came.has(goal)) return null;
  const path = [];
  for (let c = goal; c !== start; c = came.get(c)) path.push(c);
  return path.reverse();
};
