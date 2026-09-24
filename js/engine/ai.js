// Computer opponents: economy, research, focus, recruitment, fronts and attacks.
// The same front logic also drives player divisions put under AI command.
window.IM = window.IM || {};

(function () {
  const AI = IM.AI = {};
  const War = () => IM.War;
  const Game = () => IM.Game;
  let MOVE_COST = null;
  const initCosts = W => { if (!MOVE_COST) MOVE_COST = W.terrainNames.map(t => 1 / IM.TERRAIN[t].move); };

  AI.daily = function (G) {
    initCosts(G.W);
    const day = Math.floor(G.hour / 24);
    for (const c of G.countries) {
      if (!c.alive || c.capitulated) continue;
      if (c._retaliate !== undefined) { IM.Diplo.nuke(G, c, c._retaliate); delete c._retaliate; }
      const atWar = War().atWar(G, c.id);
      if (c.isPlayer) {
        if (atWar && G.divisions.some(d => d.owner === c.id && d.auto)) military(G, c, d => d.auto);
        continue;
      }
      if ((day + c.id) % 7 === 0) economy(G, c, atWar);
      if (atWar && (day + c.id) % 3 === 0 && c.pp >= Game().MILITIA_PP && Game().raiseMilitia(G, c, 3)) c.pp -= Game().MILITIA_PP;
      if (atWar && (c.divTarget >= 8 || (day + c.id) % 2 === 0)) military(G, c, () => true);
      else if ((day + c.id) % 10 === 0) peacetime(G, c);
      if ((day + c.id) % 15 === 0) diplomacy(G, c, atWar, day);
    }
  };

  // ------------------------------------------------------------------ economy
  function economy(G, c, atWar) {
    const st = c._st || Game().countryStats(G, c);
    // production lines
    const w = { inf: 0.34, art: 0.14, arm: c.armFrac > 0.1 ? 0.2 : 0.08, mot: c.mods.motorized ? 0.08 : 0, air: 0.14, nav: 0, drn: 0 };
    if (G.W.states[c.capital].coastal && st.mil >= 10) w.nav = 0.06;
    if (c.mods.drones) { w.drn = 0.14; w.inf -= 0.08; }
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    const lines = [];
    let left = st.mil;
    for (const [eq, wt] of Object.entries(w).sort((a, b) => b[1] - a[1])) {
      const f = Math.min(left, Math.max(wt > 0 && st.mil >= 4 ? 1 : 0, Math.round(st.mil * wt / tot)));
      if (f <= 0) continue;
      const old = c.lines.find(l => l.eq === eq);
      lines.push({ eq, fac: f, eff: old ? old.eff : 0.3, prog: old ? old.prog : 0 });
      left -= f;
    }
    if (left > 0 && lines.length) lines[0].fac += left;
    c.lines = lines;
    // construction
    if (c.cons.length < 2 && st.freeCiv > 0) {
      const enemies = War().enemiesOf(G, c.id);
      if (atWar && Math.random() < 0.3) {
        const border = G.W.states.filter(s => G.owner[s.id] === c.id && G.ctrl[s.cityHex] === c.id && s.neighbors.some(n => enemies.includes(G.owner[n])));
        if (border.length) { const s = border[(Math.random() * border.length) | 0]; if (s.hexes.some(h => G.fort[h] < 3)) Game().queueBuild(G, c, 'fort', s.id); }
      }
      if (c.cons.length < 2) {
        const type = atWar || st.civ > st.mil * 2.2 ? 'mil' : 'civ';
        const cand = G.W.states.filter(s => G.owner[s.id] === c.id && G.ctrl[s.cityHex] === c.id && G.civ[s.id] + G.mil[s.id] + c.cons.filter(p => p.state === s.id).length < G.slots[s.id]);
        if (cand.length) Game().queueBuild(G, c, type, cand.sort((a, b) => b.pop - a.pop)[0].id);
      }
    }
    // laws
    if (atWar) {
      if (c.laws.econ < 2) Game().setLaw(G, c, 'econ', 2);
      if (c.laws.draft < 2) Game().setLaw(G, c, 'draft', 2);
      else if (st.mp < 50000 && c.laws.draft < 3) Game().setLaw(G, c, 'draft', 3);
    } else if (G.tension > 50 && c.laws.econ < 1) Game().setLaw(G, c, 'econ', 1);
    // research
    const pri = atWar ? ['inf', 'arm', 'art', 'doc', 'air', 'ind', 'mob', 'ele', 'nav', 'nuc'] : ['ind', 'ele', 'inf', 'doc', 'arm', 'art', 'air', 'mob', 'nav', 'nuc'];
    while (c.research.length < c.slots) {
      const av = Game().availableTechs(G, c);
      if (!av.length) break;
      av.sort((a, b) => (a.year - b.year) * 0.2 + (pri.indexOf(a.cat) - pri.indexOf(b.cat)));
      if (!Game().startResearch(G, c, av[0].id)) break;
    }
    // focus
    if (!c.focus) {
      const order = atWar ? ['army1', 'mob', 'doct', 'ind1', 'ind2', 'elite', 'armor', 'pol1', 'pol2', 'total', 'fort', 'air', 'ind3', 'res1', 'res2', 'ind4', 'con', 'cyber', 'drone', 'nuke', 'navy', 'prop', 'dipl', 'claims']
        : ['ind1', 'ind2', 'res1', 'con', 'ind3', 'pol1', 'army1', 'res2', 'ind4', 'prop', 'cyber', 'drone', 'nuke', 'mob', 'armor', 'doct', 'air', 'navy', 'fort', 'pol2', 'elite', 'dipl', 'claims', 'total'];
      const f = order.map(id => IM.FOCUS_BY_ID[id]).find(f => Game().focusAvailable(G, c, f));
      if (f) c.focus = { id: f.id, prog: 0 };
    }
    // recruitment
    const divs = G.divisions.filter(d => d.owner === c.id).length;
    const cap = Math.max(c.divTarget * (atWar ? 2.2 : 1.2), 2);
    const maxQueue = atWar ? Math.max(4, Math.ceil(st.mil / 3)) : 2;
    for (let tries = 0; tries < maxQueue && c.recruit.length < maxQueue && divs + c.recruit.length < cap; tries++) {
      let tpl = 'inf';
      if (c.stock.arm >= 250 && c.stock.mot >= 150 && Math.random() < 0.5) tpl = 'arm';
      else if (G.modern && c.mods.mechanized && c.stock.mot >= 300 && c.stock.arm >= 40) tpl = 'mec';
      else if (c.tier === 'D') tpl = Math.random() < 0.5 ? 'gar' : 'inf';
      const T = IM.TEMPLATES[tpl];
      const queued = c.recruit.filter(r => r.tpl === tpl).length + 1;
      const enough = Object.entries(T.eq).every(([eq, amt]) => c.stock[eq] >= amt * 0.7 * queued);
      if (!enough || st.mp < T.mp * 2 || Game().recruit(G, c, tpl, 1)) break;
    }
  }

  // ------------------------------------------------------------------ fronts
  // Land hexes bordering a hex held by someone else; recomputed each day.
  function contactHexes(G) {
    const day = Math.floor(G.hour / 24);
    if (G._contact && G._contactDay === day) return G._contact;
    const W = G.W, out = [];
    for (const h of W.land) {
      const o = G.ctrl[h];
      for (let k = 0; k < 6; k++) { const j = W.nb[h * 6 + k]; if (j >= 0 && W.region[j] && G.ctrl[j] !== o) { out.push(h); break; } }
    }
    G._contact = out; G._contactDay = day;
    return out;
  }
  function power(G, d) { const s = War().stats(G, d); return (s.sa + s.ha + s.def * 0.5) * d.str * (0.3 + 0.7 * d.org / s.org); }

  function military(G, c, filter) {
    const W = G.W;
    War().relation(G, 0, 0); // ensure relation matrix is current
    const R = G.rel, RB = c.id * G.relN;
    const rel = (o) => o < 0 ? 0 : R[RB + o];
    const byHex = War().byHex(G);
    const mine = G.divisions.filter(d => d.owner === c.id && filter(d) && !d.dead);
    if (!mine.length) return;
    const avgPow = mine.reduce((a, d) => a + power(G, d), 0) / mine.length || 1;
    const enemySet = new Set(War().enemiesOf(G, c.id));
    const tc = new Map();
    const threatCache = o => { if (o < 0) return false; let v = tc.get(o); if (v === undefined) tc.set(o, v = War().threatening(G, c.id, o)); return v; };
    // front hexes
    const need = new Map(), foreign = new Set();
    for (const h of contactHexes(G)) {
      const o = G.ctrl[h];
      if (rel(o) !== 1) continue;
      let threat = 0, touches = false;
      for (let k = 0; k < 6; k++) {
        const j = W.nb[h * 6 + k];
        if (j < 0 || !W.region[j]) continue;
        const oj = G.ctrl[j];
        if (rel(oj) !== 2) {
          if (rel(oj) === 0 && threatCache(oj)) { touches = true; const ds = byHex.get(j); if (ds) for (const d of ds) if (enemySet.has(d.owner)) threat += power(G, d); }
          continue;
        }
        touches = true;
        const ds = byHex.get(j); if (ds) for (const d of ds) if (rel(d.owner) === 2) threat += power(G, d);
      }
      if (!touches) continue;
      const own = G.owner[W.stateOf[h]];
      const home = own === c.id || G.countries[own].overlord === c.id;
      if (!home && G.countries[own].capitulated) continue;
      let n = Math.min(threat > avgPow * 6 ? 5 : 3, Math.max(1, Math.round(threat / avgPow * 0.7 + 0.6)));
      const st = W.states[W.stateOf[h]];
      if (h === st.cityHex && st.vp >= 5) n = Math.min(5, n + (st.id === c.capital ? 2 : 1));
      if (!home) n = Math.max(1, Math.round(n * 0.6));
      need.set(h, n);
      if (!home) foreign.add(h);
    }
    const capHex = W.states[c.capital].cityHex;
    if (G.ctrl[capHex] === c.id && !need.has(capHex)) {
      let near = false;
      const seen = new Set([capHex]); let ring = [capHex];
      for (let r = 0; r < 3 && !near; r++) { const nx = []; for (const x of ring) for (const j of W.neighbors(x)) if (!seen.has(j)) { seen.add(j); nx.push(j); if (W.region[j] && rel(G.ctrl[j]) === 2) near = true; } ring = nx; }
      if (near) need.set(capHex, 2);
    }
    if (!need.size) { if ((G.hour / 24 + c.id) % 20 === 0) navalInvasion(G, c, mine); return; }
    // pull back from salients that are about to be pocketed
    const exposed = h => { let e = 0, land = 0; for (let k = 0; k < 6; k++) { const j = W.nb[h * 6 + k]; if (j < 0 || !W.region[j]) continue; land++; if (rel(G.ctrl[j]) === 2) e++; } return land >= 3 && e >= land - 1; };
    const safe = [];
    for (const h of need.keys()) if (!exposed(h)) safe.push(h);
    if (safe.length) {
      const pocketed = mine.filter(d => !d.path.length && d.battle < 0 && W.region[d.hex] && (exposed(d.hex) || !d.supplied));
      if (pocketed.length) {
        const f = flowField(G, c, safe, pocketed.map(d => d.hex), 10);
        for (const d of pocketed) {
          const path = f.pathFrom(d.hex);
          if (path && path.length) War().setPath(G, d, path);
        }
      }
    }
    // current coverage
    const cover = new Map();
    for (const d of G.divisions) {
      if (d.owner !== c.id) continue;
      const t = d.path.length ? d.path[d.path.length - 1] : d.hex;
      if (need.has(t)) cover.set(t, (cover.get(t) || 0) + 1);
    }
    const deficit = new Map();
    for (const [h, n] of need) { const cv = cover.get(h) || 0; if (cv < n) deficit.set(h, n - cv); }
    // idle units: not moving, not fighting, and either off the front or in surplus there
    const idle = [];
    const surplus = new Map();
    for (const [h, n] of need) surplus.set(h, (cover.get(h) || 0) - n);
    for (const d of mine) {
      if (d.path.length || d.battle >= 0) continue;
      if (need.has(d.hex)) {
        if (surplus.get(d.hex) > 0) { idle.push(d); surplus.set(d.hex, surplus.get(d.hex) - 1); }
        continue;
      }
      idle.push(d);
    }
    if (deficit.size && idle.length) {
      const f = flowField(G, c, [...deficit.keys()], idle.map(d => d.hex), 60);
      idle.sort((a, b) => f.distOf(a.hex) - f.distOf(b.hex));
      let abroad = G.divisions.filter(d => d.owner === c.id && foreign.has(d.path.length ? d.path[d.path.length - 1] : d.hex)).length;
      const abroadCap = Math.floor(mine.length * (foreign.size === need.size ? 1 : 0.3));
      for (const d of idle) {
        if (!isFinite(f.distOf(d.hex))) continue;
        const src = f.srcOf(d.hex);
        if (!(deficit.get(src) > 0)) continue;
        if (foreign.has(src) && abroad >= abroadCap) continue;
        const path = f.pathFrom(d.hex);
        if (!path) continue;
        if (foreign.has(src)) abroad++;
        War().setPath(G, d, path);
        deficit.set(src, deficit.get(src) - 1);
      }
    }
    if (!deficit.size && !idle.length) { /* fully deployed */ }
    attacks(G, c, mine, need, byHex);
  }

  // Multi-source Dijkstra from targets over hexes this country can move through.
  // Buffers are reused between calls; the search stops once every wanted hex
  // is settled or the distance limit is reached.
  let buf = null;
  function flowField(G, c, sources, wanted, maxDist) {
    const W = G.W, n = W.n;
    maxDist = maxDist || 45;
    if (!buf || buf.n !== n) buf = { n, dist: new Float64Array(n), next: new Int32Array(n), src: new Int32Array(n), stamp: new Uint32Array(n), done: new Uint32Array(n), want: new Uint32Array(n), gen: 0 };
    const gen = ++buf.gen, { dist, next, src, stamp, done, want } = buf;
    War().relation(G, 0, 0);
    const R = G.rel, RB = c.id * G.relN;
    let remaining = 0;
    if (wanted) for (const h of wanted) if (want[h] !== gen) { want[h] = gen; remaining++; }
    const canSea = c.stock.nav > 0 || c.faction >= 0;
    const heap = new IM.Heap();
    for (const s of sources) { stamp[s] = gen; dist[s] = 0; src[s] = s; next[s] = -1; heap.push(s, 0); }
    while (heap.size) {
      const h = heap.pop();
      if (done[h] === gen) continue;
      done[h] = gen;
      if (wanted && want[h] === gen && --remaining <= 0) break;
      const dh = dist[h];
      for (let k = 0; k < 6; k++) {
        const j = W.nb[h * 6 + k];
        if (j < 0 || done[j] === gen) continue;
        let cost;
        if (!W.region[j]) { if (!canSea) continue; cost = 0.8 + (W.region[h] ? 4 : 0); }
        else {
          const o = G.ctrl[j];
          if (o < 0 || R[RB + o] !== 1) continue;
          cost = MOVE_COST[W.terrain[j]];
          if (!W.region[h]) cost += 4;
        }
        const nd = dh + cost;
        if (nd > maxDist) continue;
        if (stamp[j] !== gen || nd < dist[j]) { stamp[j] = gen; dist[j] = nd; next[j] = h; src[j] = src[h]; heap.push(j, nd); }
      }
    }
    const distOf = h => (stamp[h] === gen && done[h] === gen ? dist[h] : Infinity);
    // Path from hex h to its nearest source (excluding h itself), or null.
    const pathFrom = h => {
      if (!isFinite(distOf(h))) return null;
      const target = src[h], path = [];
      let x = h, guard = 0;
      while (x !== target && guard++ < 4000) { x = next[x]; if (x < 0) return null; path.push(x); }
      return x === target ? path : null;
    };
    return { distOf, pathFrom, srcOf: h => src[h] };
  }

  function attacks(G, c, mine, need, byHex) {
    const W = G.W;
    const targets = new Set();
    for (const h of need.keys()) for (const j of W.neighbors(h)) if (W.region[j] && War().isEnemy(G, c.id, G.ctrl[j])) targets.add(j);
    const used = new Set();
    const list = [...targets].sort(() => Math.random() - 0.5);
    for (const e of list) {
      const cand = [];
      for (const j of W.neighbors(e)) {
        const ds = byHex.get(j); if (!ds) continue;
        for (const d of ds) {
          if (d.owner !== c.id || used.has(d.id) || d.path.length || d.battle >= 0 || mine.indexOf(d) < 0) continue;
          const s = War().stats(G, d);
          if (d.org < s.org * 0.7 || d.str < 0.5) continue;
          cand.push(d);
        }
      }
      if (!cand.length) continue;
      const defs = (byHex.get(e) || []).filter(d => War().isEnemy(G, c.id, d.owner));
      if (!defs.length) {
        const d = cand.sort((a, b) => War().stats(G, b).speed - War().stats(G, a).speed)[0];
        // don't strip a hex bare if it's the only unit there
        War().setPath(G, d, [e]); used.add(d.id);
        continue;
      }
      const est = War().estimateBattle(G, cand, defs, e);
      const need = (c.ideo === 'fascist' ? 1.15 : 1.35) * (G.modern ? 1.15 : 1);
      if (est.ratio > need) {
        for (const d of cand) { War().setPath(G, d, [e]); used.add(d.id); }
      }
    }
  }

  function navalInvasion(G, c, mine) {
    const W = G.W;
    const enemies = War().enemiesOf(G, c.id);
    if (!enemies.length) return;
    const ownNav = c.stock.nav, foeNav = enemies.reduce((a, e) => a + G.countries[e].stock.nav, 0);
    if (ownNav <= 0 || ownNav < foeNav * 0.6) return;
    const idle = mine.filter(d => !d.path.length && d.battle < 0 && d.org > War().stats(G, d).org * 0.8);
    if (idle.length < 3) return;
    const byHex = War().byHex(G);
    const capHex = W.states[c.capital].cityHex;
    let best = -1, bs = Infinity;
    for (const s of W.states) {
      if (!s.coastal) continue;
      const o = G.ctrl[s.cityHex];
      if (!War().isEnemy(G, c.id, o)) continue;
      for (const h of s.hexes) {
        if (!W.coastal[h] || !War().isEnemy(G, c.id, G.ctrl[h])) continue;
        const defs = (byHex.get(h) || []).length;
        const sc = W.hexDist(capHex, h) + defs * 25 - s.vp;
        if (sc < bs) { bs = sc; best = h; }
      }
    }
    if (best < 0) return;
    const force = idle.slice(0, Math.min(6, Math.max(3, Math.floor(idle.length / 3))));
    const n = War().orderMove(G, force, best);
    if (n) Game().news(G, `${c.name} launches a naval invasion toward ${W.states[W.stateOf[best]].name}.`, 'info');
  }

  // ------------------------------------------------------------------ peacetime
  function peacetime(G, c) {
    const W = G.W;
    const threats = new Set();
    for (const o of G.countries) {
      if (!o.alive || o.id === c.id) continue;
      if (o.wargoals.has(c.id) || (o.justify && o.justify.target === c.id) || c.wargoals.has(o.id)) threats.add(o.id);
    }
    for (const t of c.watchThreats || []) {
      threats.add(t);
      for (const o of G.countries) if (o.alive && o.id !== c.id && War().relation(G, t, o.id) === 1 && War().relation(G, c.id, o.id) === 0) threats.add(o.id);
    }
    const mine = G.divisions.filter(d => d.owner === c.id && !d.path.length && !d.staged);
    // anyone stranded in foreign land goes home
    for (const d of mine) if (G.ctrl[d.hex] !== c.id && War().relation(G, c.id, G.ctrl[d.hex]) !== 1) War().orderMove(G, [d], Game().deployHex(G, c));
    if (!threats.size) return;
    const border = [];
    for (const s of W.states) {
      if (G.owner[s.id] !== c.id) continue;
      for (const h of s.hexes) {
        if (G.ctrl[h] !== c.id) continue;
        for (const j of W.neighbors(h)) if (W.region[j] && threats.has(G.ctrl[j])) { border.push(h); break; }
      }
    }
    if (!border.length) return;
    const borderSet = new Set(border);
    const idle = mine.filter(d => !borderSet.has(d.hex)).slice(0, Math.ceil(mine.length * 0.7));
    const f = flowField(G, c, border, idle.map(d => d.hex), 40);
    const taken = new Map();
    for (const d of idle) {
      const src = f.srcOf(d.hex);
      if (!isFinite(f.distOf(d.hex)) || (taken.get(src) || 0) >= 2) continue;
      const path = f.pathFrom(d.hex);
      if (path) { War().setPath(G, d, path); taken.set(src, (taken.get(src) || 0) + 1); }
    }
  }

  // ------------------------------------------------------------------ diplomacy
  function strength(G, id) {
    return G.divisions.reduce((a, d) => a + (d.owner === id ? power(G, d) : 0), 0);
  }
  function diplomacy(G, c, atWar, day) {
    // declare prepared wars
    for (const t of [...c.wargoals]) {
      const T = G.countries[t];
      if (!T.alive || T.capitulated) { c.wargoals.delete(t); continue; }
      if (!atWar) { IM.Diplo.declare(G, c, T); return; }
    }
    // foreign aid: powers at peace arm like-minded nations fighting their rivals
    if (!atWar && (c._st?.mil || 0) >= 8) aid(G, c);
    // opportunistic wars (only with the "unpredictable" AI setting)
    if (G.aiMode !== 'unpredictable' || atWar || c.justify || c.aggr < 0.3 || Math.random() > c.aggr * 0.5) return;
    const own = strength(G, c.id);
    const neigh = new Set();
    for (const s of G.W.states) if (G.owner[s.id] === c.id) for (const n of s.neighbors) { const o = G.owner[n]; if (o !== c.id) neigh.add(o); }
    let best = null, bv = 0;
    for (const id of neigh) {
      const T = G.countries[id];
      if (!T.alive || T.faction >= 0 && T.faction === c.faction) continue;
      if (IM.Diplo.canJustify(G, c, T)) continue;
      let foe = strength(G, id);
      if (T.faction >= 0) for (const m of G.factions[T.faction].members) if (m !== id) foe += strength(G, m) * 0.5;
      for (const g of G.countries) if (g.alive && g.guarantees.has(id)) foe += strength(G, g.id) * 0.5;
      const ratio = own / (foe + 1);
      if (ratio > 2.5 && ratio > bv) { bv = ratio; best = T; }
    }
    if (best) IM.Diplo.justify(G, c, best);
  }

  function aid(G, c) {
    const recipients = [];
    for (const o of G.countries) {
      if (!o.alive || o.capitulated || o.id === c.id || o.isPlayer && false) continue;
      const foes = War().enemiesOf(G, o.id);
      if (!foes.length) continue;
      const friendly = War().relation(G, c.id, o.id) === 1 || o.ideo === c.ideo;
      const rivalFoe = foes.some(e => G.countries[e].ideo !== c.ideo && War().relation(G, c.id, e) !== 1);
      if (!friendly || !rivalFoe || foes.some(e => War().relation(G, c.id, e) === 1)) continue;
      recipients.push(o);
    }
    if (!recipients.length) return;
    recipients.sort((a, b) => War().surrenderProgress(G, b) - War().surrenderProgress(G, a));
    for (const o of recipients.slice(0, 2)) {
      let sent = [];
      for (const [eq, share] of [['inf', 0.2], ['art', 0.15], ['arm', 0.08], ['drn', 0.2], ['air', 0.04]]) {
        const amt = Math.floor(c.stock[eq] * share);
        if (amt < (eq === 'inf' ? 200 : 5)) continue;
        c.stock[eq] -= amt; o.stock[eq] += amt; sent.push(eq);
      }
      if (sent.length && (o.isPlayer || c.tier === 'A')) Game().news(G, `${c.name} sends military aid to ${o.name}.`, o.isPlayer ? 'good' : 'info');
    }
  }

  AI.military = military;
})();
