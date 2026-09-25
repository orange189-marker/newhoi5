// Divisions, movement, combat, supply, capitulation, wars and peace.
window.IM = window.IM || {};

(function () {
  const War = IM.War = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ORG_DMG = 0.3, STR_DMG = 0.025, MAX_FRONT = 6, SEA_SPEED = 12;

  // ------------------------------------------------------------------ relations
  // rel[a*N+b]: 0 neutral, 1 friendly (same country/faction/subject/co-belligerent), 2 enemy
  War.rebuildRelations = function (G) {
    const N = G.countries.length;
    const rel = new Uint8Array(N * N);
    const C = G.countries;
    const set = (a, b, v) => { rel[a * N + b] = v; rel[b * N + a] = v; };
    for (let a = 0; a < N; a++) {
      rel[a * N + a] = 1;
      for (let b = a + 1; b < N; b++) {
        const A = C[a], B = C[b];
        if ((A.faction >= 0 && A.faction === B.faction) || A.overlord === b || B.overlord === a ||
            (A.overlord !== null && A.overlord === B.overlord)) set(a, b, 1);
      }
    }
    for (const w of G.wars) {
      const att = w.att.filter(x => !w.cap.has(x) && C[x].alive), def = w.def.filter(x => !w.cap.has(x) && C[x].alive);
      for (const a of att) { for (const b of def) set(a, b, 2); for (const b of att) if (rel[a * N + b] === 0) set(a, b, 1); }
      for (const a of def) for (const b of def) if (rel[a * N + b] === 0) set(a, b, 1);
    }
    G.rel = rel; G.relN = N; G.relDirty = false;
  };
  War.relation = function (G, a, b) {
    if (a < 0 || b < 0) return 0;
    if (G.relDirty || G.relN !== G.countries.length) War.rebuildRelations(G);
    return G.rel[a * G.relN + b];
  };
  War.isEnemy = (G, a, b) => War.relation(G, a, b) === 2;
  War.isFriend = (G, a, b) => War.relation(G, a, b) === 1;
  War.atWar = function (G, id) {
    return G.wars.some(w => !w.cap.has(id) && (w.att.includes(id) || w.def.includes(id)));
  };
  // Neutral countries that are friendly with one of our enemies (e.g. an
  // enemy's faction partner who grants it passage) - their borders are threats.
  War.threatening = function (G, id, o) {
    if (o < 0 || o === id || War.relation(G, id, o) !== 0) return false;
    for (const e of War.enemiesOf(G, id)) if (War.relation(G, e, o) === 1) return true;
    return false;
  };
  War.enemiesOf = function (G, id) {
    const out = new Set();
    for (const w of G.wars) {
      if (w.cap.has(id)) continue;
      const side = w.att.includes(id) ? w.def : w.def.includes(id) ? w.att : null;
      if (side) for (const x of side) if (!w.cap.has(x) && G.countries[x].alive) out.add(x);
    }
    return [...out];
  };

  // ------------------------------------------------------------------ divisions
  War.spawnDivision = function (G, c, tpl, hex, str) {
    const T = IM.TEMPLATES[tpl];
    c.divCount = (c.divCount || 0) + 1;
    const d = {
      id: G.nextDiv++, owner: c.id, tpl, hex, str: str ?? 1, org: 0, path: [], prog: 0, entrench: 0,
      battle: -1, name: `${ordinal(c.divCount)} ${IM.Game.tplName(G, tpl).replace(' Division', '').replace(' Brigade Group', '')}`,
      auto: !c.isPlayer, supplied: true, atSea: false,
    };
    d.org = War.stats(G, d).org * 0.8;
    G.divisions.push(d);
    return d;
  };
  function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  const WEIGHTS = {
    inf: { inf: 0.7, art: 0.3, arm: 0 }, gar: { inf: 1, art: 0, arm: 0 }, mnt: { inf: 0.8, art: 0.2, arm: 0 },
    mar: { inf: 0.8, art: 0.2, arm: 0 }, mot: { inf: 0.7, art: 0.3, arm: 0 }, mec: { inf: 0.4, art: 0.2, arm: 0.4 },
    arm: { inf: 0.1, art: 0.1, arm: 0.8 },
  };
  War.stats = function (G, d) {
    const c = G.countries[d.owner];
    if (!c.statCache) c.statCache = {};
    let s = c.statCache[d.tpl];
    if (s) return s;
    const T = IM.TEMPLATES[d.tpl], m = c.mods, w = WEIGHTS[d.tpl];
    s = {
      sa: T.sa * (1 + m.inf * w.inf + m.art * w.art + m.arm * w.arm * 0.7),
      ha: T.ha * (1 + m.arm * w.arm + m.inf * w.inf * 0.5) + m.ha * 7 * w.inf,
      def: T.def * (1 + m.def + m.inf * w.inf + m.arm * w.arm * 0.5),
      brk: T.brk * (1 + m.brk + m.arm * w.arm * 0.45 + m.inf * w.inf * 0.3),
      org: T.org * (1 + m.org),
      speed: T.speed * (1 + m.speed),
      hard: T.hard, hp: T.hp,
    };
    c.statCache[d.tpl] = s;
    return s;
  };

  War.byHex = function (G) {
    if (G._byHex && G._byHexHour === G.hour && !G._byHexDirty) return G._byHex;
    const m = new Map();
    for (const d of G.divisions) { let a = m.get(d.hex); if (!a) m.set(d.hex, a = []); a.push(d); }
    G._byHex = m; G._byHexHour = G.hour; G._byHexDirty = false;
    return m;
  };

  // Movement cost callback for pathfinding (hours per hex).
  War.moveCost = function (G, cid, speed) {
    const W = G.W, c = G.countries[cid];
    const canSea = c.stock.nav > 0 || c.faction >= 0;
    return (from, to, isGoal) => {
      if (!W.region[to]) {
        if (!canSea) return Infinity;
        return IM.HEX_KM / SEA_SPEED + (W.region[from] ? 12 : 0); // embarking takes time
      }
      const o = G.ctrl[to];
      const r = War.relation(G, cid, o);
      if (r === 0 && o !== cid) return Infinity;
      const tm = IM.TERRAIN[W.terrainName(to)].move;
      let cost = IM.HEX_KM / (speed * tm);
      if (r === 2) cost *= 1.5;
      return cost;
    };
  };

  War.orderMove = function (G, divs, goal) {
    let ok = 0;
    const W = G.W;
    for (const d of divs) {
      const st = War.stats(G, d);
      const path = d.hex === goal ? [] : IM.findPath(W, d.hex, goal, War.moveCost(G, d.owner, st.speed), IM.HEX_KM / SEA_SPEED, 40000);
      if (path) { setPath(G, d, path); ok++; }
    }
    return ok;
  };
  function setPath(G, d, path) {
    if (d.path.length && path.length && d.path[0] !== path[0]) d.prog = 0;
    if (d.battle >= 0 && d.battleRole === 'att' && path[0] !== d.battle) leaveBattle(G, d);
    d.path = path;
  }
  War.setPath = setPath;
  War.stop = function (G, divs) { for (const d of divs) { if (d.battle >= 0 && d.battleRole === 'att') leaveBattle(G, d); d.path = []; d.prog = 0; } };

  // ------------------------------------------------------------------ hourly
  War.hourly = function (G) {
    const W = G.W;
    const byHex = War.byHex(G);
    // movement
    for (const d of G.divisions) {
      const st = War.stats(G, d);
      if (!d.path.length) {
        if (d.battle < 0 || d.battleRole === 'def') {
          d.entrench = Math.min(1, d.entrench + 1 / 144);
        }
        regen(G, d, st);
        continue;
      }
      const next = d.path[0];
      if (!W.region[next]) { // sea
        d.prog += SEA_SPEED;
        regen(G, d, st, 0.3);
        if (d.prog >= IM.HEX_KM) arrive(G, d, next, byHex);
        continue;
      }
      const ctl = G.ctrl[next];
      const r = War.relation(G, d.owner, ctl);
      if (r === 2) {
        const def = (byHex.get(next) || []).filter(x => War.isEnemy(G, d.owner, x.owner));
        if (def.length) {
          if (d.battle !== next) {
            if (d.org < st.org * 0.25) { d.path = []; d.prog = 0; continue; }
            joinBattle(G, d, next);
          }
          d.prog = Math.min(IM.HEX_KM * 0.9, d.prog + st.speed * 0.3);
          continue;
        }
      } else if (r === 0 && ctl !== d.owner) { d.path = []; d.prog = 0; continue; }
      if (d.battle >= 0 && d.battleRole === 'att') leaveBattle(G, d);
      const tm = IM.TERRAIN[W.terrainName(next)].move;
      d.prog += st.speed * tm * (d.supplied ? 1 : 0.6) * (d.org < st.org * 0.2 ? 0.7 : 1);
      regen(G, d, st, 0.5);
      if (d.prog >= IM.HEX_KM) arrive(G, d, next, byHex);
    }
    // interdiction at sea
    if (G.hour % 6 === 0) for (const d of G.divisions) {
      if (W.region[d.hex]) continue;
      const enemies = War.enemiesOf(G, d.owner);
      if (!enemies.length) continue;
      const own = G.countries[d.owner].stock.nav * (1 + G.countries[d.owner].mods.nav);
      const foe = enemies.reduce((a, e) => a + G.countries[e].stock.nav * (1 + G.countries[e].mods.nav), 0);
      if (foe <= 0) continue;
      const risk = 0.012 * foe / (own + foe);
      if (Math.random() < risk) { d.str -= 0.25 + Math.random() * 0.3; if (d.str <= 0.05) killDivision(G, d, 'lost at sea'); }
    }
    G.divisions = G.divisions.filter(d => !d.dead);
    // combat
    for (const b of [...G.battles.values()]) combatRound(G, b);
    G.divisions = G.divisions.filter(d => !d.dead);
  };

  function regen(G, d, st, f) {
    const c = G.countries[d.owner];
    if (!d.supplied) { d.org = Math.min(d.org, st.org * 0.5); return; }
    if (d.battle >= 0) return;
    d.org = Math.min(st.org, d.org + st.org * 0.009 * (f ?? 1) * (d.supply ?? 1) * (c.cyberDays > 0 ? 0.8 : 1));
  }

  function arrive(G, d, next, byHex) {
    const W = G.W;
    // remove from old hex list
    const old = byHex.get(d.hex); if (old) { const i = old.indexOf(d); if (i >= 0) old.splice(i, 1); }
    d.hex = next; d.path.shift(); d.prog = 0; d.entrench = 0;
    let arr = byHex.get(next); if (!arr) byHex.set(next, arr = []); arr.push(d);
    if (d.battle >= 0 && d.battleRole === 'att') leaveBattle(G, d);
    if (W.region[next]) {
      const ctl = G.ctrl[next];
      if (War.isEnemy(G, d.owner, ctl)) War.capture(G, next, d.owner);
    }
  }

  War.capture = function (G, hex, cid) {
    const W = G.W;
    const st = W.stateOf[hex];
    const ownerId = G.owner[st];
    const prev = G.ctrl[hex];
    // liberation: territory of a friendly owner returns to them
    let to = cid;
    if (ownerId !== cid && War.isFriend(G, cid, ownerId) && G.countries[ownerId].alive && !G.countries[ownerId].capitulated) to = ownerId;
    G.ctrl[hex] = to;
    G.fort[hex] = Math.max(0, G.fort[hex] - 1);
    G.mapDirty = true; G.supplyDirty = true;
    const s = W.states[st];
    if (hex === s.cityHex && G.countries[ownerId].capital === st && to !== ownerId && prev === ownerId && G.player !== null) {
      const owner = G.countries[ownerId], nc = G.countries[to];
      const key = st + ':' + to, seen = (G._fallen = G._fallen || {});
      if (!(seen[key] > G.hour - 24 * 90) && (IM.Game.notable(G, ownerId) || IM.Game.notable(G, to))) {
        seen[key] = G.hour;
        const big = s.vp >= 15 || ownerId === G.player;
        const hist = IM.historyOfFall ? IM.historyOfFall(G, s, nc, owner) : null;
        if (hist) { G.flags = G.flags || {}; G.flags.divergences = (G.flags.divergences || 0) + 1; }
        IM.Game.headline(G, {
          type: big ? 'super' : 'news', tags: [nc.tag, owner.tag], major: true, alt: !!hist, history: hist,
          title: big ? `The Fall of ${s.name}` : `${s.name.toUpperCase()} FALLS`,
          text: `${nc.name} troops have entered ${s.name}, the capital of ${owner.name}. ${owner.capitulated ? '' : `The government of ${owner.name} vows to fight on from the provinces.`} Across the world, the news is read as a turning point in the war.`,
          art: { kind: 'map', focus: s.name, span: 18, red: [nc.tag], blue: [owner.tag], mark: s.name },
        });
      }
    }
    else if (hex === s.cityHex && s.vp >= 10 && G.player !== null && (ownerId === G.player || to === G.player || prev === G.player) && G.hour - (G._cityNews || -1e9) > 24 * 5) {
      G._cityNews = G.hour;
      const owner = G.countries[ownerId], nc = G.countries[to];
      const ours = to === G.player;
      IM.Game.headline(G, {
        type: 'news', major: false, tags: [nc.tag, owner.tag],
        title: ours ? `${s.name.toUpperCase()} TAKEN` : to === ownerId ? `${s.name.toUpperCase()} LIBERATED` : `${s.name.toUpperCase()} FALLS TO ${nc.name.toUpperCase()}`,
        text: to === ownerId ? `${owner.name} forces have retaken ${s.name} after heavy fighting. Crowds greet the troops in the ruined streets.` : `After fierce fighting, ${nc.name} troops have captured ${s.name}, one of the most important cities of ${owner.name}. Refugees crowd the roads away from the front.`,
        art: { kind: 'map', focus: s.name, span: 20, red: [nc.tag], blue: [owner.tag], mark: s.name },
      });
    }
    if (hex === s.cityHex && s.vp >= 5) {
      const pc = G.countries[prev], nc = G.countries[to];
      const involvesPlayer = pc && (pc.isPlayer || nc.isPlayer);
      if (s.vp >= 15 || involvesPlayer) IM.Game.news(G, `${s.name} has fallen to ${nc.name}!`, involvesPlayer ? (nc.isPlayer ? 'good' : 'bad') : 'info');
    }
  };

  // ------------------------------------------------------------------ combat
  function joinBattle(G, d, hex) {
    if (d.battle >= 0 && d.battleRole === 'att') leaveBattle(G, d);
    let b = G.battles.get(hex);
    if (!b) { b = { hex, att: new Set(), hours: 0, attOwner: d.owner }; G.battles.set(hex, b); }
    b.att.add(d.id);
    d.battle = hex; d.battleRole = 'att';
  }
  function leaveBattle(G, d) {
    const b = G.battles.get(d.battle);
    if (b) b.att.delete(d.id);
    d.battle = -1; d.battleRole = null;
  }

  function sideAir(G, owners) {
    let a = 0;
    for (const o of owners) { const c = G.countries[o]; a += c.stock.air * (1 + c.mods.air); }
    return a;
  }

  function droneBonus(G, c, engaged) {
    if (!c.mods.drones || c.stock.drn <= 0) return 0;
    const need = engaged * 120;
    const cover = Math.min(1, c.stock.drn / need);
    c.stock.drn = Math.max(0, c.stock.drn - engaged * 3);
    return cover * (0.15 + c.mods.drone);
  }

  function combatRound(G, b) {
    const W = G.W;
    const byHex = War.byHex(G);
    const divById = G._divById && G._divByIdHour === G.hour ? G._divById : (G._divById = new Map(G.divisions.map(d => [d.id, d])), G._divByIdHour = G.hour, G._divById);
    let atk = [...b.att].map(id => divById.get(id)).filter(d => d && !d.dead && d.battle === b.hex && d.path[0] === b.hex);
    b.att = new Set(atk.map(d => d.id));
    const defAll = (byHex.get(b.hex) || []).filter(d => !d.dead && atk.some(a => War.isEnemy(G, a.owner, d.owner)));
    if (!atk.length || !defAll.length) { endBattle(G, b, atk, defAll); return; }
    b.hours++;
    b.lastDef = defAll;
    for (const d of defAll) { d.battle = b.hex; d.battleRole = 'def'; }
    const terr = W.terrainName(b.hex);
    const tAtk = IM.TERRAIN[terr].atk;
    const fort = G.fort[b.hex];
    // engaged units: best org first
    atk.sort((x, y) => y.org - x.org);
    const defSorted = defAll.slice().sort((x, y) => y.org - x.org);
    G_ = G;
    const A = engageAttackers(atk, b), D = defSorted.filter(d => d.org > 0.5).slice(0, 4);
    if (!D.length) { retreatAll(G, defAll, atk); endBattle(G, b, atk, []); return; } // overrun
    if (!A.length) { for (const a of atk) { a.path = []; a.prog = 0; } endBattle(G, b, atk, defAll); return; }
    const aOwners = [...new Set(A.map(d => d.owner))], dOwners = [...new Set(D.map(d => d.owner))];
    const airA = sideAir(G, aOwners), airD = sideAir(G, dOwners);
    const airAdv = (airA + airD > 0 ? (airA - airD) / (airA + airD) : 0) * (G.modern ? 0.6 : 1);
    const aDrone = droneBonus(G, G.countries[aOwners[0]], A.length), dDrone = droneBonus(G, G.countries[dOwners[0]], D.length);
    const countryMod = (c) => (c.cyberDays > 0 ? 0.9 : 1);
    // attackers fire
    for (const a of A) {
      const sa = War.stats(G, a), ac = G.countries[a.owner];
      const t = D[(Math.random() * D.length) | 0], ts = War.stats(G, t);
      let terrMod = tAtk;
      const T = IM.TEMPLATES[a.tpl];
      if (T.terrain && T.terrain.includes(terr)) terrMod = tAtk * 0.3 + 0.1;
      let mult = (1 + terrMod) * (1 + airAdv * 0.25) * (1 + aDrone) * supMult(a) * countryMod(ac) * (1 - fort * 0.08);
      if (!W.region[a.hex]) mult *= T.amphibious ? 0.75 : 0.45; // attacking from the sea
      const attacks = (sa.sa * (1 - ts.hard) + sa.ha * ts.hard) * a.str * mult;
      const defense = ts.def * (0.4 + 0.6 * t.str) * (1 + t.entrench * 0.3 + fort * 0.2) * (1 + dDrone * 0.5) * (G.modern ? 1.15 : 1);
      hit(t, attacks, defense, ts);
    }
    // defenders fire back (attackers defend with breakthrough)
    for (const d of D) {
      const sd = War.stats(G, d), dc = G.countries[d.owner];
      const t = A[(Math.random() * A.length) | 0], ts = War.stats(G, t);
      const mult = (1 - airAdv * 0.25) * (1 + dDrone) * supMult(d) * countryMod(dc);
      const attacks = (sd.sa * (1 - ts.hard) + sd.ha * ts.hard) * d.str * mult;
      const defense = ts.brk * (0.4 + 0.6 * t.str) * (1 + aDrone * 0.5);
      hit(t, attacks, defense, ts);
    }
    for (const d of [...A, ...D]) if (d.str <= 0.03) killDivision(G, d, 'destroyed in battle');
    // outcome
    const defLeft = defAll.filter(d => !d.dead && d.org > War.stats(G, d).org * 0.05);
    if (!defLeft.length) { retreatAll(G, defAll.filter(d => !d.dead), atk); endBattle(G, b, atk, []); return; }
    const atkLeft = atk.filter(d => !d.dead && d.org > War.stats(G, d).org * 0.1);
    if (!atkLeft.length) {
      for (const a of atk) if (!a.dead) { a.path = []; a.prog = 0; }
      endBattle(G, b, atk, defAll);
    }
  }
  // Combat width: at most two divisions fight from each direction, so
  // attacking from several sides at once pays off.
  function engageAttackers(atk, b) {
    const per = new Map(), out = [];
    const take = d => { const k = per.get(d.hex) || 0; if (k >= 2 || out.length >= MAX_FRONT) return; per.set(d.hex, k + 1); out.push(d); };
    // units already in the line stay there until worn down; reserves only fill gaps
    if (b && b.line) for (const d of atk) if (b.line.has(d.id) && d.org > War.stats(G_, d).org * 0.25) take(d);
    for (const d of atk) if (d.org > 0.5 && !out.includes(d)) take(d);
    if (b) b.line = new Set(out.map(d => d.id));
    return out;
  }
  let G_ = null;
  War.engageAttackers = engageAttackers;

  // Expected hours for each side to break the other; used by the AI and the UI.
  War.estimateBattle = function (G, atk, def, hex) {
    const W = G.W;
    if (!def.length) return { ratio: 99, tDef: 0, tAtk: 99 };
    if (!atk.length) return { ratio: 0, tDef: 99, tAtk: 0 };
    const terr = W.terrainName(hex), tAtk = IM.TERRAIN[terr].atk, fort = G.fort[hex];
    const hits = (attacks, defense) => attacks <= defense ? attacks * 0.1 : defense * 0.1 + (attacks - defense) * 0.4;
    G_ = G;
    const A = engageAttackers(atk.slice().sort((x, y) => y.org - x.org)), D = def.slice().sort((x, y) => y.org - x.org).slice(0, 4);
    if (!A.length) return { ratio: 0, tDef: 99, tAtk: 0 };
    const avg = (arr, f) => arr.reduce((a, d) => a + f(d), 0) / arr.length;
    const dHard = avg(D, d => War.stats(G, d).hard), aHard = avg(A, d => War.stats(G, d).hard);
    const dDef = avg(D, d => War.stats(G, d).def * (0.4 + 0.6 * d.str) * (1 + d.entrench * 0.3 + fort * 0.2)) * (G.modern ? 1.15 : 1);
    const aBrk = avg(A, d => War.stats(G, d).brk * (0.4 + 0.6 * d.str));
    let hA = 0, hD = 0;
    for (const a of A) {
      const s = War.stats(G, a), T = IM.TEMPLATES[a.tpl];
      let tm = tAtk; if (T.terrain && T.terrain.includes(terr)) tm = tAtk * 0.3 + 0.1;
      let m = (1 + tm) * (1 - fort * 0.08) * supMult(a);
      if (!W.region[a.hex]) m *= T.amphibious ? 0.75 : 0.45;
      hA += hits((s.sa * (1 - dHard) + s.ha * dHard) * a.str * m, dDef);
    }
    for (const d of D) { const s = War.stats(G, d); hD += hits((s.sa * (1 - aHard) + s.ha * aHard) * d.str * supMult(d), aBrk); }
    const orgD = def.reduce((a, d) => a + d.org, 0), orgA = A.reduce((a, d) => a + d.org, 0) + (atk.length - A.length) * 0.5 * A.reduce((a, d) => a + d.org, 0) / A.length;
    const tDef = orgD / Math.max(0.01, hA * ORG_DMG), tAt = orgA / Math.max(0.01, hD * ORG_DMG);
    return { ratio: tAt / tDef, tDef, tAtk: tAt };
  };

  function supMult(d) { return d.supplied ? 0.65 + 0.35 * (d.supply ?? 1) : 0.5; }

  function hit(t, attacks, defense, ts) {
    const hits = attacks <= defense ? attacks * 0.1 : defense * 0.1 + (attacks - defense) * 0.4;
    t.org = Math.max(0, t.org - hits * ORG_DMG);
    t.str = Math.max(0, t.str - hits * STR_DMG / ts.hp);
  }

  function endBattle(G, b, atk, def) {
    const won = !def.length;
    if (G.battleLog) G.battleLog.push({ hex: b.hex, hours: b.hours, won, att: [...new Set(atk.map(d => G.countries[d.owner].tag))].join('/'), def: [...new Set((won ? b.lastDef || [] : def).map(d => G.countries[d.owner].tag))].join('/'), na: atk.length, nd: (b.lastDef || def).length });
    for (const d of atk) if (d.battle === b.hex) { d.battle = -1; d.battleRole = null; if (won) d.prog = Math.min(d.prog, IM.HEX_KM * 0.35); }
    for (const d of def) if (d.battle === b.hex) { d.battle = -1; d.battleRole = null; }
    G.battles.delete(b.hex);
  }

  function retreatAll(G, defs, atk) {
    const W = G.W;
    const byHex = War.byHex(G);
    for (const d of defs) {
      d.battle = -1; d.battleRole = null;
      let best = -1, bs = -Infinity;
      for (const j of W.neighbors(d.hex)) {
        if (!W.region[j]) continue;
        const r = War.relation(G, d.owner, G.ctrl[j]);
        if (r !== 1) continue;
        const enemyThere = (byHex.get(j) || []).some(x => War.isEnemy(G, d.owner, x.owner));
        if (enemyThere) continue;
        // prefer hexes away from attackers
        let s = Math.random() * 0.5;
        for (const a of atk) if (a.hex === j) s -= 5;
        for (const k of W.neighbors(j)) if (G.ctrl[k] >= 0 && War.isEnemy(G, d.owner, G.ctrl[k])) s -= 1;
        if (s > bs) { bs = s; best = j; }
      }
      if (best < 0) { killDivision(G, d, 'encircled and destroyed'); continue; }
      const old = byHex.get(d.hex); if (old) { const i = old.indexOf(d); if (i >= 0) old.splice(i, 1); }
      d.hex = best; d.path = []; d.prog = 0; d.entrench = 0; d.org = Math.max(d.org, War.stats(G, d).org * 0.05);
      let arr = byHex.get(best); if (!arr) byHex.set(best, arr = []); arr.push(d);
    }
  }

  function killDivision(G, d, why) {
    if (d.dead) return;
    d.dead = true;
    const kl = G.killLog || (G.killLog = {});
    const key = G.countries[d.owner].tag + ' ' + why + (d.battleRole ? ' as ' + d.battleRole : '');
    kl[key] = (kl[key] || 0) + 1;
    if (d.battle >= 0) { const b = G.battles.get(d.battle); if (b) b.att.delete(d.id); }
    const c = G.countries[d.owner];
    if (c.isPlayer) IM.Game.news(G, `The ${d.name} was ${why}.`, 'bad', c.tag);
    G._byHexDirty = true;
  }
  War.killDivision = killDivision;

  // ------------------------------------------------------------------ daily
  War.daily = function (G) {
    War.computeSupply(G);
    for (const d of G.divisions) {
      if (!d.supplied) { d.str -= 0.008; if (d.str <= 0.05) killDivision(G, d, 'lost to attrition'); }
    }
    G.divisions = G.divisions.filter(d => !d.dead);
    // air & naval attrition in wartime
    for (const c of G.countries) {
      if (!c.alive || c.capitulated) continue;
      const en = War.enemiesOf(G, c.id);
      if (!en.length) continue;
      const foeAir = en.reduce((a, e) => a + G.countries[e].stock.air * (1 + G.countries[e].mods.air), 0);
      const ownAir = c.stock.air * (1 + c.mods.air);
      if (ownAir + foeAir > 0) c.stock.air = Math.max(0, Math.round(c.stock.air - c.stock.air * 0.004 * foeAir / (ownAir + foeAir)));
      const foeNav = en.reduce((a, e) => a + G.countries[e].stock.nav, 0);
      if (c.stock.nav + foeNav > 0) c.stock.nav = Math.max(0, c.stock.nav - c.stock.nav * 0.002 * foeNav / (c.stock.nav + foeNav));
    }
    War.checkCapitulation(G);
  };

  War.reinforce = function (G, c) {
    const st = c._st;
    for (const d of G.divisions) {
      if (d.owner !== c.id || d.str >= 1 || !d.supplied || (d.supply ?? 1) < 0.5) continue;
      const T = IM.TEMPLATES[d.tpl];
      let add = Math.min(0.1, 1 - d.str);
      const mpAvail = Math.max(0, st.mpTotal - c.mpUsed);
      add = Math.min(add, mpAvail / T.mp);
      for (const [eq, amt] of Object.entries(T.eq)) add = Math.min(add, c.stock[eq] / amt);
      if (add <= 0.001) continue;
      for (const [eq, amt] of Object.entries(T.eq)) c.stock[eq] -= amt * add;
      c.mpUsed += T.mp * add;
      d.str += add;
    }
    for (const k of IM.EQUIP_ORDER) c.stock[k] = Math.max(0, c.stock[k]);
  };

  // Supply: flows from hubs (own victory-point cities, ports with a navy,
  // captured cities as weaker hubs) through friendly land. The further a unit
  // is from a hub, the thinner its supply; cut off units starve.
  War.SUPPLY_RANGE = 10;
  // Distance (in hexes, 255 = cut off) from each hex to the nearest supply hub of country cid.
  War.supplyDepth = function (G, cid) {
    const W = G.W;
    War.relation(G, 0, 0);
    const R = G.rel, N = G.relN, MAXD = 40;
    const c = G.countries[cid], RB = cid * N;
    const depth = new Uint8Array(W.n).fill(255);
    const buckets = Array.from({ length: MAXD + 1 }, () => []);
    const seed = (h, d) => { if (d < depth[h]) { depth[h] = d; buckets[d].push(h); } };
    for (const s of W.states) {
      const h = s.cityHex, o = G.ctrl[h];
      if (o < 0 || R[RB + o] !== 1) continue;
      const owned = G.owner[s.id] === o || War.isFriend(G, G.owner[s.id], o);
      if (owned) seed(h, s.vp >= 3 ? 0 : 3);
      else if (s.coastal && c.stock.nav > 0 && s.vp >= 3) seed(h, 2);
      else if (s.vp >= 5) seed(h, 6);
      else seed(h, 9);
    }
    for (let d = 0; d < MAXD; d++) {
      const b = buckets[d];
      for (let i = 0; i < b.length; i++) {
        const h = b[i];
        if (depth[h] !== d) continue;
        for (let k = 0; k < 6; k++) {
          const j = W.nb[h * 6 + k];
          if (j < 0 || !W.region[j] || depth[j] <= d + 1) continue;
          const o = G.ctrl[j];
          if (o < 0 || R[RB + o] !== 1) continue;
          depth[j] = d + 1; buckets[d + 1].push(j);
        }
      }
    }
    return depth;
  };
  War.computeSupply = function (G) {
    const W = G.W;
    const activeOwners = new Set();
    for (const d of G.divisions) if (War.atWar(G, d.owner) || G.ctrl[d.hex] !== d.owner) activeOwners.add(d.owner);
    const cache = new Map();
    for (const cid of activeOwners) cache.set(cid, War.supplyDepth(G, cid));
    for (const d of G.divisions) {
      if (!W.region[d.hex]) { d.supplied = true; d.supply = 0.8; continue; }
      const dep = cache.get(d.owner);
      if (!dep) { d.supplied = true; d.supply = 1; continue; }
      const x = dep[d.hex];
      d.supplied = x !== 255;
      d.supply = x === 255 ? 0 : x <= War.SUPPLY_RANGE ? 1 : Math.max(0.35, 1 - (x - War.SUPPLY_RANGE) * 0.05);
    }
    // the Kerch bridge is down: Russian troops in the south run short
    if (G.flags && G.flags.kerchUntil > G.hour) {
      const south = ['Simferopol', 'Kherson', 'Zaporizhzhia'].map(n => W.stateByName[n] && W.stateByName[n].id);
      for (const d of G.divisions) if (d.owner === G.tagId.RUS && W.region[d.hex] && south.includes(W.stateOf[d.hex])) d.supply = Math.min(d.supply, 0.55);
    }
    G.supplyDirty = false;
  };

  // ------------------------------------------------------------------ capitulation & peace
  War.surrenderProgress = function (G, c) {
    let tot = 0, lost = 0;
    const W = G.W;
    for (const s of W.states) {
      if (G.owner[s.id] !== c.id) continue;
      const v = s.vp + 1;
      tot += v;
      const ctl = G.ctrl[s.cityHex];
      if (ctl !== c.id && War.isEnemy(G, c.id, ctl)) lost += v;
    }
    return tot ? lost / tot : 1;
  };

  War.checkCapitulation = function (G) {
    const W = G.W;
    for (const c of G.countries) {
      if (!c.alive || c.capitulated || !War.atWar(G, c.id)) continue;
      const p = War.surrenderProgress(G, c);
      const capLost = War.isEnemy(G, c.id, G.ctrl[W.states[c.capital].cityHex]);
      let thr = 0.55 + 0.3 * c.stab + (c.spec && c.spec.resist || 0);
      if (capLost) thr -= 0.1;
      const own = G.divisions.filter(d => d.owner === c.id).length;
      if (own === 0) thr -= 0.2;
      if (p >= thr) War.capitulate(G, c);
    }
  };

  War.capitulate = function (G, c) {
    const W = G.W;
    const enemies = War.enemiesOf(G, c.id);
    if (!enemies.length) return;
    c.capitulated = true;
    IM.Game.news(G, `${c.name} has capitulated!`, 'major');
    if (c.isPlayer && IM.UI && IM.UI.onPlayerCapitulated) IM.UI.onPlayerCapitulated(G);
    else if (IM.Game.notable(G, c.id)) {
      const cap = W.states[c.capital];
      IM.Game.headline(G, {
        type: 'news', major: true, tags: [c.tag],
        title: `${c.name.toUpperCase()} CAPITULATES`,
        text: `The armed forces of ${c.name} have laid down their arms. ${enemies.slice(0, 3).map(e => G.countries[e].name).join(', ')} now occupy the country. Its fate will be decided at the peace table.`,
        art: { kind: 'map', focus: cap.name, span: 22, red: enemies.map(e => G.countries[e].tag), blue: [c.tag], mark: cap.name },
      });
    }
    for (const w of G.wars) if (w.att.includes(c.id) || w.def.includes(c.id)) w.cap.add(c.id);
    for (const d of G.divisions) if (d.owner === c.id) d.dead = true;
    G.divisions = G.divisions.filter(d => !d.dead);
    // hand all territory it still controls to the enemy
    const lead = enemies.slice().sort((a, b) => G.divisions.filter(d => d.owner === b).length - G.divisions.filter(d => d.owner === a).length)[0];
    const ctlCount = new Map();
    for (let h = 0; h < W.n; h++) {
      const o = G.ctrl[h]; if (o < 0) continue;
      const st = W.stateOf[h];
      const key = st * 4096 + o;
      ctlCount.set(key, (ctlCount.get(key) || 0) + 1);
    }
    for (let h = 0; h < W.n; h++) {
      if (G.ctrl[h] !== c.id) continue;
      const st = W.stateOf[h];
      const owner = G.owner[st];
      if (owner !== c.id && G.countries[owner].alive && enemies.includes(owner)) { G.ctrl[h] = owner; continue; }
      let best = lead, bv = 0;
      for (const e of enemies) { const v = ctlCount.get(st * 4096 + e) || 0; if (v > bv) { bv = v; best = e; } }
      G.ctrl[h] = best;
    }
    G.relDirty = true; G.mapDirty = true; G.supplyDirty = true;
    War.rebuildRelations(G);
    for (const d of G.divisions) if (W.region[d.hex] && War.isEnemy(G, d.owner, G.ctrl[d.hex])) evacuate(G, d);
    G.divisions = G.divisions.filter(d => !d.dead);
    War.resolveWars(G);
  };

  War.resolveWars = function (G) {
    for (const w of [...G.wars]) {
      const attAlive = w.att.filter(x => !w.cap.has(x) && G.countries[x].alive);
      const defAlive = w.def.filter(x => !w.cap.has(x) && G.countries[x].alive);
      if (attAlive.length && defAlive.length) continue;
      const winners = attAlive.length ? w.att : w.def;
      const losers = attAlive.length ? w.def : w.att;
      War.peace(G, w, winners, losers, 'victory');
    }
  };

  // Peace conference: winners annex the loser states they occupy.
  War.peace = function (G, w, winners, losers, kind) {
    const W = G.W;
    G.wars = G.wars.filter(x => x !== w);
    War.rebuildRelations(G);
    const winSet = new Set(winners), loseSet = new Set(losers);
    if (kind === 'victory' || kind === 'concession') {
      for (const s of W.states) {
        const o = G.owner[s.id];
        if (!loseSet.has(o)) continue;
        const ctl = G.ctrl[s.cityHex];
        if (winSet.has(ctl) && G.countries[ctl].alive) transferState(G, s, ctl);
      }
    }
    // restore control inside every participant's territory unless still contested in another war
    for (const s of W.states) {
      const o = G.owner[s.id];
      if (!winSet.has(o) && !loseSet.has(o)) continue;
      for (const h of s.hexes) {
        const ctl = G.ctrl[h];
        if (ctl === o) continue;
        if ((winSet.has(ctl) || loseSet.has(ctl)) && !War.isEnemy(G, o, ctl)) G.ctrl[h] = o;
      }
    }
    for (const id of [...winners, ...losers]) {
      const c = G.countries[id];
      c.wargoals.delete(id);
      for (const e of [...winners, ...losers]) c.wargoals.delete(e);
      const owns = W.states.some(s => G.owner[s.id] === id);
      if (!owns) killCountry(G, c);
      else if (c.capitulated && !War.atWar(G, id)) {
        c.capitulated = false;
        c.stab = Math.max(0.2, c.stab - 0.1);
      }
      // units standing in now-foreign land walk home
      for (const d of G.divisions) if (d.owner === id && W.region[d.hex] && War.relation(G, id, G.ctrl[d.hex]) === 0) evacuate(G, d);
    }
    if (G.player !== null && IM.UI && IM.UI.onWarEnded) {
      if (winSet.has(G.player)) IM.UI.onWarEnded(G, w, kind === 'white' ? 'white' : 'won');
      else if (loseSet.has(G.player)) IM.UI.onWarEnded(G, w, kind === 'white' ? 'white' : 'lost');
    }
    const names = (arr) => arr.map(i => G.countries[i].name).slice(0, 3).join(', ') + (arr.length > 3 ? '…' : '');
    if ([...winners, ...losers].some(x => IM.Game.notable(G, x)) && !winSet.has(G.player) && !loseSet.has(G.player)) {
      IM.Game.headline(G, {
        type: 'news', major: false, tags: [G.countries[winners[0]].tag, G.countries[losers[0]].tag],
        title: kind === 'white' ? `PEACE SIGNED: ${w.name.toUpperCase()} ENDS` : `${w.name.toUpperCase()} IS OVER`,
        text: kind === 'white' ? `The belligerents of the ${w.name} have agreed to a white peace. Borders return to where they stood before the fighting.` : `${names(winners)} have prevailed over ${names(losers)}. The victors will annex the territory they hold.`,
        art: { kind: 'flags', flags: [G.countries[winners[0]].tag, G.countries[losers[0]].tag], vs: true },
      });
    }
    IM.Game.news(G, kind === 'white' ? `White peace ends the ${w.name}.` : `The ${w.name} is over: ${names(winners)} prevailed over ${names(losers)}.`, 'major');
    G.relDirty = true; G.mapDirty = true; G.supplyDirty = true;
    War.rebuildRelations(G);
  };

  function evacuate(G, d) {
    const c = G.countries[d.owner];
    const home = IM.Game.deployHex(G, c);
    if (home >= 0) { d.hex = home; d.path = []; d.prog = 0; d.battle = -1; } else d.dead = true;
    G._byHexDirty = true;
  }

  function transferState(G, s, to) {
    const from = G.owner[s.id];
    G.owner[s.id] = to;
    for (const h of s.hexes) if (!War.isEnemy(G, to, G.ctrl[h])) G.ctrl[h] = to;
    const fc = G.countries[from];
    if (fc.capital === s.id) {
      const alt = G.W.states.filter(x => G.owner[x.id] === from).sort((a, b) => b.vp - a.vp)[0];
      if (alt) fc.capital = alt.id;
    }
    G.mapDirty = true;
  }
  War.transferState = transferState;

  function killCountry(G, c) {
    if (!c.alive) return;
    c.alive = false;
    for (const d of G.divisions) if (d.owner === c.id) d.dead = true;
    G.divisions = G.divisions.filter(d => !d.dead);
    for (const f of G.factions) f.members = f.members.filter(m => m !== c.id);
    for (const o of G.countries) if (o.overlord === c.id) o.overlord = null;
    c.faction = -1;
    IM.Game.news(G, `${c.name} has ceased to exist.`, 'major');
    G.relDirty = true;
    if (c.isPlayer && IM.UI && IM.UI.onPlayerDefeated) IM.UI.onPlayerDefeated(G);
  }
  War.killCountry = killCountry;

  // ------------------------------------------------------------------ declaring war
  War.declare = function (G, attacker, target, name) {
    const A = G.countries[attacker], T = G.countries[target];
    if (War.isEnemy(G, attacker, target)) return 'Already at war';
    if (War.isFriend(G, attacker, target) && (A.faction >= 0 && A.faction === T.faction)) return 'Cannot attack a faction member';
    const att = new Set([attacker]), def = new Set([target]);
    const addSubjects = (set, id) => { for (const c of G.countries) if (c.alive && c.overlord === id) set.add(c.id); };
    addSubjects(att, attacker);
    if (A.faction >= 0 && G.factions[A.faction].leader === attacker) for (const m of G.factions[A.faction].members) att.add(m);
    // defenders: overlord, faction, guarantors
    let top = target;
    while (G.countries[top].overlord !== null && G.countries[top].overlord !== undefined) top = G.countries[top].overlord;
    def.add(top);
    addSubjects(def, top);
    if (T.faction >= 0) for (const m of G.factions[T.faction].members) def.add(m);
    for (const c of G.countries) if (c.alive && c.guarantees.has(target)) def.add(c.id);
    for (const x of def) att.delete(x);
    const attArr = [...att].filter(x => G.countries[x].alive && !G.countries[x].capitulated);
    const defArr = [...def].filter(x => G.countries[x].alive && !G.countries[x].capitulated && !att.has(x));
    const war = { id: (G.warSeq = (G.warSeq || G.wars.length) + 1), name: name || `${A.name.split(' ').pop()}-${T.name.split(' ').pop()} War`, att: attArr, def: defArr, start: G.hour, cap: new Set() };
    G.wars.push(war);
    A.wargoals.delete(target);
    G.tension = Math.min(100, G.tension + (T.divTarget > 20 || A.divTarget > 20 ? 12 : 5));
    for (const x of defArr) G.countries[x].ws = Math.min(1, G.countries[x].ws + 0.15);
    G.relDirty = true; G.mapDirty = true;
    War.rebuildRelations(G);
    const extra = defArr.length > 1 ? ` (${defArr.length - 1} allies join the defence)` : '';
    IM.Game.news(G, `${A.name} has declared war on ${T.name}!${extra}`, 'major');
    if (!G._eventFiring && (IM.Game.notable(G, attacker) || IM.Game.notable(G, target))) {
      const W = G.W, ac = W.states[A.capital], tc = W.states[T.capital];
      const near = W.hexDist(ac.cityHex, tc.cityHex) < 30;
      const allies = defArr.filter(x => x !== target).map(x => G.countries[x].name);
      IM.Game.headline(G, {
        type: 'news', major: true, tags: [A.tag, T.tag],
        title: `${A.name.toUpperCase()} DECLARES WAR ON ${T.name.toUpperCase()}`,
        text: `${A.name}, led by ${A.leader}, has declared war on ${T.name}. ${allies.length ? `${allies.slice(0, 4).join(', ')}${allies.length > 4 ? ' and others' : ''} have rallied to ${T.name}'s side.` : `${T.name} stands alone.`} The ${war.name} has begun.`,
        art: near ? { kind: 'map', focus: tc.name, span: 24, red: attArr.map(x => G.countries[x].tag), blue: defArr.map(x => G.countries[x].tag), axes: [[ac.name, tc.name]] } : { kind: 'flags', flags: [A.tag, T.tag], vs: true },
      });
    }
    return null;
  };

  War.joinWar = function (G, cid, war, side) {
    const arr = side === 'att' ? war.att : war.def;
    if (!arr.includes(cid)) arr.push(cid);
    G.relDirty = true;
    War.rebuildRelations(G);
  };
})();
