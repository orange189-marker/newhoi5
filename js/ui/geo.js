// Map geometry: turns the logical hex grid into organic, province-like cells
// clipped to real coastlines. Game logic still uses the hex grid; this only
// changes what the tiles look like.
//  - every shared corner is nudged by a deterministic hash, so neighbours agree
//  - every edge gets two wobble points, computed the same way from both sides
//  - coastal sea cells borrow a land neighbour ("proxy") so the real coastline
//    is fully covered once the map is clipped to the land shape
window.IM = window.IM || {};

(function () {
  const Geo = IM.Geo = {};
  const SUB = 3;                         // points per edge (corner + 2 wobble points)
  const V = [[0, -1], [0.866, -0.5], [0.866, 0.5], [0, 1], [-0.866, 0.5], [-0.866, -0.5]];

  function hash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  Geo.init = function (W, R) {
    const n = W.n, S = R.HW / Math.sqrt(3), WW = R.worldW;
    Geo.S = S;
    // coastal sea cells take the colour of a land neighbour
    // (breadth-first out to three tiles, so small islands off the coast get coloured too)
    const proxy = new Int32Array(n).fill(-1);
    let ring = [];
    for (let i = 0; i < n; i++) if (W.region[i]) { proxy[i] = i; ring.push(i); }
    for (let depth = 0; depth < 3; depth++) {
      const next = [];
      for (const i of ring) for (let k = 0; k < 6; k++) {
        const j = W.nb[i * 6 + k];
        if (j < 0 || proxy[j] >= 0) continue;
        let best = -1, bd = Infinity;
        if (depth === 0) {
          // right off the coast: take the state that dominates the nearby land, so a
          // big island's shore is not handed to a tiny neighbour across the strait
          const score = new Map();
          for (let m = 0; m < 6; m++) {
            const q = W.nb[j * 6 + m]; if (q < 0) continue;
            for (const x of [q, ...[0, 1, 2, 3, 4, 5].map(t => W.nb[q * 6 + t])]) {
              if (x < 0 || !W.region[x]) continue;
              const st = W.stateOf[x]; score.set(st, (score.get(st) || 0) + (x === q ? 3 : 1));
            }
          }
          let top = -1, ts = -1;
          for (const [st, v] of score) if (v > ts) { ts = v; top = st; }
          for (let m = 0; m < 6; m++) { const q = W.nb[j * 6 + m]; if (q >= 0 && W.region[q] && W.stateOf[q] === top) { best = q; break; } }
          if (best >= 0) { proxy[j] = best; next.push(j); continue; }
        }
        for (let m = 0; m < 6; m++) { // nearest already-coloured neighbour
          const q = W.nb[j * 6 + m]; if (q < 0 || proxy[q] < 0) continue;
          let dx = Math.abs(R.cx[q] - R.cx[j]); if (dx > WW / 2) dx = WW - dx;
          const d = dx * dx + (R.cy[q] - R.cy[j]) ** 2 + hash(j, q) * 0.1 + (W.region[q] ? 0 : 1);
          if (d < bd) { bd = d; best = proxy[q]; }
        }
        proxy[j] = best; next.push(j);
      }
      ring = next;
    }
    Geo.proxy = proxy;
    // corner positions, jittered by a hash of the (wrapped) corner location
    const corner = (x, y) => {
      const kx = Math.round(((x % WW) + WW) % WW * 4), ky = Math.round(y * 4);
      const a = hash(kx, ky, 1) * Math.PI * 2, r = hash(kx, ky, 2) * S * 0.34;
      return [x + Math.cos(a) * r, y + Math.sin(a) * r, kx * 100003 + ky];
    };
    const wobble = (P, Q) => {
      // canonical direction so both cells sharing the edge get identical points
      if (P[2] > Q[2]) return wobble(Q, P).reverse();
      const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, out = [];
      for (let s = 1; s < SUB; s++) {
        const t = s / SUB, amp = (hash(P[2] % 1000003, Q[2] % 1000003, s) - 0.5) * len * 0.36;
        out.push([P[0] + dx * t + nx * amp, P[1] + dy * t + ny * amp]);
      }
      return out;
    };
    // cell outlines (only where something is drawn)
    const cells = new Array(n);
    for (let i = 0; i < n; i++) {
      if (proxy[i] < 0) continue;
      const cs = V.map(([vx, vy]) => corner(R.cx[i] + vx * S, R.cy[i] + vy * S));
      const pts = new Float32Array(6 * SUB * 2);
      let o = 0;
      for (let a = 0; a < 6; a++) {
        const P = cs[a], Q = cs[(a + 1) % 6];
        pts[o++] = P[0]; pts[o++] = P[1];
        for (const [x, y] of wobble(P, Q)) { pts[o++] = x; pts[o++] = y; }
      }
      cells[i] = pts;
    }
    // ghost copies of the two edge columns, shifted across the seam, so each copy of the
    // world can tile its band right up to the edge (index n + row: last column shifted
    // left; n + rows + row: first column shifted right)
    const rows = W.rows, cols = W.cols, gp = new Int32Array(n + rows * 2);
    gp.set(proxy);
    for (let r = 0; r < rows; r++) for (const [g, c, sx] of [[n + r, cols - 1, -WW], [n + rows + r, 0, WW]]) {
      const src = cells[r * cols + c]; gp[g] = proxy[r * cols + c];
      if (!src) continue;
      const pts = Float32Array.from(src); for (let k = 0; k < pts.length; k += 2) pts[k] += sx;
      cells[g] = pts;
    }
    Geo.proxy = gp;
    Geo.cells = cells;
    // real coastline in world pixels
    const q = IM.COAST.q, coast = new Path2D();
    const lonX = lon => (lon + 180) / W.hexW * R.HW, latY = lat => (W.latTop - lat) / W.hexH * R.RH + R.RH * 0.5;
    Geo.lonX = lonX; Geo.latY = latY;
    for (const ring of IM.COAST.rings) {
      const d = ring.split(','), pts = [];
      let x = 0, y = 0, lo = Infinity, hi = -Infinity;
      for (let k = 0; k < d.length; k += 2) {
        x += parseInt(d[k], 36); y += parseInt(d[k + 1], 36);
        const px = lonX(x / q); pts.push(px, latY(y / q));
        if (px < lo) lo = px; if (px > hi) hi = px;
      }
      // shapes that cross the 180th meridian also get a copy on the other side of the seam
      const shifts = [0]; if (hi > WW) shifts.push(-WW); if (lo < 0) shifts.push(WW);
      for (const sx of shifts) {
        for (let k = 0; k < pts.length; k += 2) if (k) coast.lineTo(pts[k] + sx, pts[k + 1]); else coast.moveTo(pts[k] + sx, pts[k + 1]);
        coast.closePath();
      }
    }
    Geo.coast = coast;
  };

  // Append cell i's outline to a path. Low detail uses corners only.
  Geo.cellPath = function (p, i, lowDetail) {
    const c = Geo.cells[i]; if (!c) return;
    const step = lowDetail ? SUB * 2 : 2;
    p.moveTo(c[0], c[1]);
    for (let k = step; k < c.length; k += step) p.lineTo(c[k], c[k + 1]);
    p.closePath();
  };

  // Append edge k of cell i (neighbour direction order as in world.js).
  const EDGE_START = [1, 4, 0, 5, 2, 3]; // E, W, NE, NW, SE, SW -> starting corner
  Geo.edgePath = function (p, i, k, lowDetail) {
    const c = Geo.cells[i]; if (!c) return;
    const a = EDGE_START[k], len = c.length;
    const i0 = a * SUB * 2, i1 = ((a + 1) % 6) * SUB * 2;
    p.moveTo(c[i0], c[i0 + 1]);
    if (!lowDetail) for (let s = 1; s < SUB; s++) p.lineTo(c[(i0 + s * 2) % len], c[(i0 + s * 2 + 1) % len]);
    p.lineTo(c[i1], c[i1 + 1]);
  };
})();
