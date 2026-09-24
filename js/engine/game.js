// Game state, scenario setup, and the daily economic simulation.
window.IM = window.IM || {};

(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  IM.clamp = clamp;

  // Region growth: fraction of today's population living there in each era.
  const WEST = ['USA', 'CAN', 'AUS', 'NZL', 'JPN', 'RUS', 'UKR', 'BLR', 'GRL', 'ISL', 'KAZ', 'GEO', 'ARM', 'AZE', 'ISR'];
  function growthGroup(code, lat, lon) {
    if (WEST.includes(code)) return 'eu';
    if (lon > -30 && lon < 45 && lat > 35) return 'eu';
    if (lon < -30) return lat > 15 && lon < -50 ? (['USA', 'CAN', 'MEX'].includes(code) ? (code === 'MEX' ? 'la' : 'eu') : 'la') : 'la';
    if (lat < -10 && lon > 110) return 'eu';
    if (lon >= -20 && lon <= 63 && lat >= 12 && lat <= 42) return 'me';
    if (lon >= -20 && lon <= 52 && lat < 20) return 'af';
    return 'as';
  }
  const GROWTH = { eu: [0.75, 0.95, 0.97, 1], la: [0.3, 0.75, 0.85, 1], as: [0.35, 0.75, 0.82, 1], me: [0.25, 0.55, 0.65, 1], af: [0.15, 0.45, 0.55, 1] };
  const eraBand = y => y < 1950 ? 0 : y < 1995 ? 1 : y < 2010 ? 2 : 3;
  const MODERN_A = ['ESP', 'PRT', 'GRC', 'POL', 'CZE', 'SVK', 'HUN', 'SVN', 'EST', 'LVA', 'LTU', 'KOR', 'TWN', 'ARE', 'QAT', 'KWT', 'BHR', 'CYP'];
  function tier(code, modern) { return modern && MODERN_A.includes(code) ? 'A' : IM.tierOf(code); }
  const IND_FACTOR = { ww: { A: 1.0, B: 0.1, C: 0.03, D: 0.01 }, mod: { A: 0.5, B: 0.18, C: 0.06, D: 0.02 } };
  const TECH_LAG = { ww: { A: 0, B: -2, C: -5, D: -8 }, mod: { A: 0, B: -3, C: -8, D: -15 } };

  const Game = IM.Game = {};
  Game.FACTORY_IC = 6.5; // industrial capacity per military factory per day

  Game.news = function (G, text, kind, tag) {
    G.news.unshift({ t: G.hour, text, kind: kind || 'info', tag });
    if (G.news.length > 80) G.news.length = 80;
    if (IM.UI && IM.UI.onNews) IM.UI.onNews(G, G.news[0]);
  };

  Game.dateOf = function (G) { return new Date(G.startMs + G.hour * 3600e3); };
  Game.year = function (G) { const d = Game.dateOf(G); return d.getUTCFullYear() + d.getUTCMonth() / 12; };
  Game.fmtDate = function (G, withHour) {
    const d = Game.dateOf(G);
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const s = `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return withHour ? `${String(d.getUTCHours()).padStart(2, '0')}:00, ${s}` : s;
  };

  // ------------------------------------------------------------------ countries
  Game.addCountry = function (G, tag, spec) {
    if (G.tagId[tag] !== undefined) return G.countries[G.tagId[tag]];
    spec = spec || {};
    const id = G.countries.length;
    const c = {
      id, tag, name: spec.name || IM.COUNTRY_NAMES[tag] || tag,
      color: spec.color || IM.COUNTRY_COLORS[tag] || IM.hashColor(tag),
      ideo: spec.ideo || 'authoritarian', leader: spec.leader || null,
      alive: true, capitulated: false, capital: -1,
      pp: 50, stab: spec.stab ?? 0.6, ws: spec.ws ?? 0.3, mpUsed: 0,
      stock: Object.fromEntries(IM.EQUIP_ORDER.map(k => [k, 0])),
      lines: [], cons: [], research: [], slots: 3, researched: new Set(),
      focus: null, done: new Set(), laws: { draft: spec.laws?.draft ?? 1, econ: spec.laws?.econ ?? 0 },
      fmods: {}, mods: {}, faction: -1, overlord: null, wargoals: new Set(), justify: null,
      guarantees: new Set(), sanctionedBy: new Set(), cyberDays: 0, recruit: [], aggr: spec.aggr || 0,
      isPlayer: false, spec, statCache: null, lastPeaceOffer: -1e9, nukeCooldown: 0,
    };
    G.countries.push(c);
    G.tagId[tag] = id;
    G.relDirty = true;
    return c;
  };
  Game.byTag = (G, tag) => G.countries[G.tagId[tag]];

  // ------------------------------------------------------------------ new game
  Game.create = function (eraId, playerTag, opts) {
    opts = opts || {};
    const era = IM.ERAS.find(e => e.id === eraId);
    const W = IM.world || (IM.world = IM.buildWorld());
    const G = {
      era, eraId, W, hour: 0, startMs: Date.UTC(era.start[0], era.start[1] - 1, era.start[2]),
      countries: [], tagId: {}, divisions: [], nextDiv: 1, battles: new Map(), wars: [], factions: [],
      news: [], tension: era.tension, rel: null, relDirty: true, firedEvents: new Set(), pendingEvents: [],
      nukeFlashes: [], supplyDirty: true, player: null, modern: !!era.modern, speed: 0,
    };
    const S = W.states;
    G.owner = new Int16Array(S.length);
    G.ctrl = new Int16Array(W.n).fill(-1);
    G.fort = new Uint8Array(W.n);
    G.civ = new Uint8Array(S.length);
    G.mil = new Uint8Array(S.length);
    G.slots = new Uint8Array(S.length);
    G.core = new Array(S.length);

    // ownership
    for (const s of S) {
      const tag = era.states[s.name] || era.owner[s.code] || s.code;
      const c = Game.addCountry(G, tag, era.countries[tag]);
      G.owner[s.id] = c.id;
      G.core[s.id] = [tag];
      if (s.code !== tag && !G.core[s.id].includes(s.code)) G.core[s.id].push(s.code);
      for (const h of s.hexes) G.ctrl[h] = c.id;
    }
    // fortification lines: [ownerTag, neighbourTag, level]
    for (const [ot, nt, lvl] of era.forts || []) {
      const o = G.tagId[ot], t = G.tagId[nt];
      if (o === undefined || t === undefined) continue;
      for (const h of W.land) {
        if (G.ctrl[h] !== o) continue;
        for (const j of W.neighbors(h)) if (G.ctrl[j] === t) { G.fort[h] = Math.max(G.fort[h], lvl); break; }
      }
    }
    // make sure specified countries that own nothing are not left dangling
    for (const c of G.countries) {
      const owned = S.filter(s => G.owner[s.id] === c.id);
      if (!owned.length) { c.alive = false; continue; }
      setupCountry(G, c, owned);
    }
    // factions, puppets, wars
    for (const f of era.factions) {
      const members = f.members.filter(t => G.tagId[t] !== undefined && Game.byTag(G, t).alive).map(t => G.tagId[t]);
      if (!members.length) continue;
      const fi = G.factions.length;
      G.factions.push({ name: f.name, leader: G.tagId[f.leader], members });
      members.forEach(m => { G.countries[m].faction = fi; });
    }
    for (const [p, o] of Object.entries(era.puppets || {})) {
      if (G.tagId[p] !== undefined && G.tagId[o] !== undefined) G.countries[G.tagId[p]].overlord = G.tagId[o];
    }
    for (const w of era.wars || []) {
      const att = w.att.filter(t => G.tagId[t] !== undefined && Game.byTag(G, t).alive).map(t => G.tagId[t]);
      const def = w.def.filter(t => G.tagId[t] !== undefined && Game.byTag(G, t).alive).map(t => G.tagId[t]);
      if (att.length && def.length) G.wars.push({ id: G.wars.length + 1, name: w.name, att, def, start: 0, cap: new Set() });
    }
    IM.War.rebuildRelations(G);
    for (const c of G.countries) if (c.alive) placeArmy(G, c);
    if (playerTag) Game.setPlayer(G, playerTag);
    IM.War.computeSupply(G);
    Game.news(G, `${era.title}: the campaign begins.`, 'major');
    return G;
  };

  Game.setPlayer = function (G, tag) {
    for (const c of G.countries) c.isPlayer = false;
    const c = Game.byTag(G, tag);
    c.isPlayer = true;
    G.player = c.id;
    for (const d of G.divisions) if (d.owner === c.id) d.auto = false;
  };

  function setupCountry(G, c, owned) {
    const era = G.era, W = G.W, spec = c.spec || {};
    const band = eraBand(era.start[0]);
    const modern = band >= 1;
    const key = modern ? 'mod' : 'ww';
    // population & tier
    let pop = 0, tierScore = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of owned) {
      const p = s.pop * GROWTH[growthGroup(s.code, s.lat, s.lon)][band];
      s._pop = p; pop += p;
      tierScore[tier(s.code, modern)] += p;
    }
    // Home tier = tier of the country's own heartland region if it has one.
    const homeCode = owned.find(s => s.code === c.tag) ? c.tag : Object.entries(owned.reduce((a, s) => { a[s.code] = (a[s.code] || 0) + s._pop; return a; }, {})).sort((a, b) => b[1] - a[1])[0][0];
    const ht = c.tag === 'SOV' ? 'B' : tier(homeCode, modern);
    c.tier = ht;
    c.basePop = pop;
    // capital
    let cap = spec.capital && W.stateByName[spec.capital];
    if (!cap || G.owner[cap.id] !== c.id) cap = owned.slice().sort((a, b) => b.vp - a.vp || b.pop - a.pop)[0];
    c.capital = cap.id;
    // industry
    const homePop = owned.filter(s => tier(s.code, modern) === ht || s.code === homeCode).reduce((a, s) => a + s._pop, 0) || pop;
    const civ = spec.civ ?? Math.max(1, Math.round(homePop * IND_FACTOR[key][ht] + (pop - homePop) * IND_FACTOR[key].D));
    const mil = spec.mil ?? Math.round(civ * 0.3);
    distributeFactories(G, c, owned, civ, mil);
    // tech
    c.techYear = era.techYear + (spec.tech ?? TECH_LAG[key][ht]);
    for (const t of IM.TECHS) if (t.year <= c.techYear && (t.cat !== 'nuc' || spec.nukes)) c.researched.add(t.id);
    c.slots = 3 + (ht === 'A' || civ >= 40 ? 1 : 0) + (civ >= 100 ? 1 : 0);
    Game.recomputeMods(G, c);
    // politics
    c.stab = spec.stab ?? (ht === 'A' ? 0.7 : ht === 'D' ? 0.45 : 0.55);
    c.ws = spec.ws ?? 0.25;
    c.pp = 60;
    if (!spec.ideo) c.ideo = modern ? (ht === 'A' ? 'democratic' : 'authoritarian') : (ht === 'A' ? 'democratic' : 'authoritarian');
    if (!c.leader) c.leader = `Government of ${c.name}`;
    // military stockpile
    const air = spec.air ?? Math.round(civ * (modern ? 12 : 35));
    const nav = spec.nav ?? (owned.some(s => s.coastal) ? Math.round(civ * 1.5) : 0);
    c.stock.air = air; c.stock.nav = nav; c.stock.nuk = spec.nukes || 0;
    c.divTarget = spec.div ?? clamp(Math.round(civ * 0.7 + pop * 0.035), 1, 40);
    c.armFrac = spec.armFrac ?? (modern ? { A: 0.15, B: 0.1, C: 0.06, D: 0.02 }[ht] : { A: 0.05, B: 0.03, C: 0, D: 0 }[ht]);
    // starting production lines
    const lines = [['inf', 0.35], ['art', 0.15], ['arm', c.armFrac > 0.05 ? 0.2 : 0.05], ['mot', 0.1], ['air', 0.15], ['nav', nav > 0 ? 0.05 : 0]];
    if (c.mods.drones) lines.push(['drn', 0.15]);
    let left = mil;
    for (const [eq, w] of lines) {
      const f = Math.min(left, Math.round(mil * w)); if (f <= 0) continue;
      c.lines.push({ eq, fac: f, eff: 0.6, prog: 0 }); left -= f;
    }
    if (left > 0) { const l = c.lines.find(l => l.eq === 'inf'); if (l) l.fac += left; else c.lines.push({ eq: 'inf', fac: left, eff: 0.6, prog: 0 }); }
    // AI aggression default
    if (!spec.aggr) c.aggr = c.ideo === 'fascist' ? 0.6 : c.ideo === 'communist' ? 0.3 : 0.05;
  }

  function distributeFactories(G, c, owned, civ, mil) {
    const W = G.W;
    const weights = owned.map(s => (s._pop + 0.2) * (s.id === c.capital ? 1.5 : 1) * (tier(s.code, G.modern) <= c.tier ? 1 : 0.3));
    const tot = weights.reduce((a, b) => a + b, 0);
    const give = (arr, total) => {
      let rem = total;
      const want = owned.map((s, i) => total * weights[i] / tot);
      owned.forEach((s, i) => { const k = Math.floor(want[i]); arr[s.id] += k; rem -= k; });
      const order = owned.map((s, i) => [i, want[i] - Math.floor(want[i])]).sort((a, b) => b[1] - a[1]);
      for (let j = 0; rem > 0; j = (j + 1) % order.length, rem--) arr[owned[order[j][0]].id]++;
    };
    give(G.civ, civ); give(G.mil, mil);
    for (const s of owned) {
      G.slots[s.id] = Math.max(G.civ[s.id] + G.mil[s.id] + 2, clamp(Math.round(3 + Math.sqrt(s._pop) * 2.2), 3, 25));
    }
  }

  // Place starting divisions on threatened borders.
  function placeArmy(G, c) {
    const W = G.W, n = c.divTarget;
    if (!n) return;
    const hexes = [];
    for (const s of W.states) if (G.owner[s.id] === c.id) for (const h of s.hexes) if (G.ctrl[h] === c.id) hexes.push(h);
    if (!hexes.length) return;
    const capHex = W.states[c.capital].cityHex;
    const score = new Map();
    for (const h of hexes) {
      let sc = 0.05;
      for (const j of W.neighbors(h)) {
        const o = G.ctrl[j];
        if (o < 0 || o === c.id) continue;
        const r = IM.War.relation(G, c.id, o);
        if (r === 2) sc = Math.max(sc, 12);
        else if (IM.War.threatening(G, c.id, o)) sc = Math.max(sc, 9);
        else if (r === 0) sc = Math.max(sc, G.countries[o].divTarget > 3 ? 2 : 0.6);
      }
      if (h === capHex) sc += 3;
      const st = W.states[W.stateOf[h]];
      if (h === st.cityHex) sc += st.vp * 0.05;
      score.set(h, sc);
    }
    const count = new Map();
    const arm = Math.round(n * c.armFrac);
    const mot = c.mods.motorized && !G.modern ? Math.round(n * (c.tier === 'A' ? 0.06 : 0.02)) : 0;
    const mec = G.modern && c.mods.mechanized ? Math.round(n * 0.35) : 0;
    const mar = ['USA', 'GBR', 'JPN'].includes(c.tag) ? 2 : 0;
    const tpls = [];
    for (let i = 0; i < n; i++) tpls.push(i < arm ? 'arm' : i < arm + mec ? 'mec' : i < arm + mec + mot ? 'mot' : i < arm + mec + mot + mar ? 'mar' : (c.tier === 'D' && i % 3 === 0 ? 'gar' : 'inf'));
    // scripted deployments abroad, e.g. Coalition forces in Saudi Arabia (1991)
    for (const [city, k] of Object.entries(c.spec.deploy || {})) {
      const st = W.stateByName[city];
      if (!st) continue;
      for (let i = 0; i < k && tpls.length; i++) {
        const tpl = tpls.pop();
        IM.War.spawnDivision(G, c, tpl, st.cityHex, 1).entrench = 0.5;
        c.mpUsed += IM.TEMPLATES[tpl].mp;
      }
    }
    for (const tpl of tpls) {
      let best = hexes[0], bs = -1;
      for (const h of hexes) { const v = score.get(h) / (1 + (count.get(h) || 0) * 1.6); if (v > bs) { bs = v; best = h; } }
      count.set(best, (count.get(best) || 0) + 1);
      const d = IM.War.spawnDivision(G, c, tpl, best, 1);
      c.mpUsed += IM.TEMPLATES[tpl].mp;
      d.entrench = score.get(best) >= 12 ? 0.5 : 0;
    }
    // Reserve stockpile: ~20% of the army's equipment plus consumable reserves.
    for (let i = 0; i < n; i++) for (const [eq, amt] of Object.entries(IM.TEMPLATES[i < arm ? 'arm' : 'inf'].eq)) c.stock[eq] += Math.round(amt * 0.25);
    if (c.mods.drones) c.stock.drn += n * 150 + (c.spec.drones || 0);
  }

  // ------------------------------------------------------------------ modifiers
  Game.recomputeMods = function (G, c) {
    const m = { inf: 0, art: 0, arm: 0, ha: 0, def: 0, brk: 0, org: 0, speed: 0, air: 0, nav: 0, industry: 0,
      construction: 0, research: 0, drone: 0, nukePower: 1, manpower: 0, ppGain: 0, justify: 0 };
    const add = fx => {
      for (const [k, v] of Object.entries(fx)) {
        if (k === 'unlock') m[v] = true;
        else if (typeof v === 'number' && k in m) m[k] += v;
      }
    };
    for (const id of c.researched) { const t = IM.TECH_BY_ID[id]; if (t) add(t.fx); }
    add(c.fmods);
    c.mods = m;
    c.statCache = null;
  };

  Game.countryStats = function (G, c) {
    // factories actually available
    let civ = 0, mil = 0, pop = 0, occCiv = 0, occMil = 0;
    const W = G.W;
    for (const s of W.states) {
      const own = G.owner[s.id];
      const ctl = G.ctrl[s.cityHex];
      if (own === c.id && ctl === c.id) { civ += G.civ[s.id]; mil += G.mil[s.id]; pop += s._pop || 0; }
      else if (ctl === c.id && own !== c.id) { occCiv += G.civ[s.id] * 0.25; occMil += G.mil[s.id] * 0.25; pop += (s._pop || 0) * 0.1; }
      else if (own === c.id) pop += (s._pop || 0) * 0.2;
    }
    civ += Math.floor(occCiv); mil += Math.floor(occMil);
    const law = IM.LAWS.econ.levels[c.laws.econ];
    const consumer = Math.round((civ + mil) * law.consumer);
    const sanctions = Math.min(0.3, c.sanctionedBy.size * 0.08);
    const sanctionLoss = Math.round(civ * sanctions);
    const freeCiv = Math.max(0, civ - consumer - sanctionLoss);
    const recruitRate = IM.LAWS.draft.levels[c.laws.draft].recruit * (1 + c.mods.manpower);
    const mpTotal = pop * 1e6 * recruitRate;
    return { civ, mil, consumer, sanctionLoss, freeCiv, mpTotal, mp: Math.max(0, mpTotal - c.mpUsed), pop };
  };

  Game.outputMult = function (G, c) {
    const law = IM.LAWS.econ.levels[c.laws.econ];
    const stabPen = c.stab < 0.5 ? (0.5 - c.stab) * 0.6 : 0;
    const sanctions = Math.min(0.3, c.sanctionedBy.size * 0.08);
    return Math.max(0.2, 1 + c.mods.industry + law.milMod - stabPen - sanctions);
  };

  // ------------------------------------------------------------------ daily economy
  Game.daily = function (G) {
    const yr = Game.year(G);
    for (const c of G.countries) {
      if (!c.alive || c.capitulated) continue;
      const st = Game.countryStats(G, c);
      c._st = st;
      // politics
      c.pp = Math.min(999, c.pp + 2 + c.mods.ppGain - (c.stab < 0.3 ? 0.5 : 0));
      const atWar = IM.War.atWar(G, c.id);
      c.ws = clamp(c.ws + (atWar ? 0.0008 : -0.0004), 0, 1);
      c.stab = clamp(c.stab + (c.stab < 0.5 ? 0.0005 : 0) - (c.laws.econ === 3 ? 0.0003 : 0), 0, 1);
      if (c.cyberDays > 0) c.cyberDays--;
      if (c.nukeCooldown > 0) c.nukeCooldown--;
      c.mpUsed = Math.max(0, c.mpUsed * 0.9997);
      // construction
      let civLeft = st.freeCiv;
      const cp = 5 * (1 + c.mods.construction);
      for (const p of c.cons) {
        if (civLeft <= 0) break;
        const use = Math.min(15, civLeft); civLeft -= use;
        if (G.owner[p.state] !== c.id || G.ctrl[G.W.states[p.state].cityHex] !== c.id) continue;
        p.prog += use * cp;
      }
      c.cons = c.cons.filter(p => {
        if (p.prog < p.cost) return true;
        if (p.type === 'civ') G.civ[p.state]++;
        else if (p.type === 'mil') G.mil[p.state]++;
        else if (p.type === 'fort') for (const h of G.W.states[p.state].hexes) G.fort[h] = Math.min(5, G.fort[h] + 1);
        return false;
      });
      // production
      const out = Game.outputMult(G, c);
      let totalFac = 0;
      for (const l of c.lines) {
        totalFac += l.fac;
      }
      const scale = totalFac > st.mil && totalFac > 0 ? st.mil / totalFac : 1;
      for (const l of c.lines) {
        const eq = IM.EQUIP[l.eq];
        if (eq.requires && !c.mods[eq.requires]) continue;
        l.eff = Math.min(1, l.eff + 0.01);
        l.prog += l.fac * scale * IM.Game.FACTORY_IC * l.eff * out;
        const made = Math.floor(l.prog / eq.cost);
        if (made > 0) { c.stock[l.eq] += made; l.prog -= made * eq.cost; }
      }
      // research
      const rs = (1 + c.mods.research) * (c.cyberDays > 0 ? 0.85 : 1);
      for (const r of c.research) r.prog += rs;
      const doneR = c.research.filter(r => r.prog >= Game.techCost(G, c, IM.TECH_BY_ID[r.id]));
      for (const r of doneR) {
        c.researched.add(r.id);
        if (c.isPlayer) Game.news(G, `Research complete: ${IM.TECH_BY_ID[r.id].name}`, 'good', c.tag);
      }
      if (doneR.length) { c.research = c.research.filter(r => !doneR.includes(r)); Game.recomputeMods(G, c); }
      // national focus
      if (c.focus) {
        c.focus.prog++;
        const f = IM.FOCUS_BY_ID[c.focus.id];
        if (c.focus.prog >= f.days) { Game.completeFocus(G, c, f); c.focus = null; }
      }
      // war goal justification
      if (c.justify) {
        c.justify.days--;
        if (c.justify.days <= 0) {
          const t = G.countries[c.justify.target];
          c.wargoals.add(t.id);
          Game.news(G, `${c.name} has justified a war goal against ${t.name}.`, c.isPlayer || t.isPlayer ? 'major' : 'info');
          c.justify = null;
        }
      }
      // recruitment
      Game.processRecruitment(G, c);
      // reinforcement
      IM.War.reinforce(G, c);
    }
    G.tension = Math.max(0, G.tension - 0.02);
    if (Math.floor(yr) !== G._lastYear) { G._lastYear = Math.floor(yr); }
  };

  Game.techCost = function (G, c, t) {
    const yr = Game.year(G);
    const ahead = t.year - yr;
    let days = 110;
    if (ahead > 0) days *= 1 + ahead * 0.35;
    else if (ahead < -2) days *= 0.55;
    return days;
  };

  Game.availableTechs = function (G, c) {
    const byCat = {};
    for (const t of IM.TECHS) {
      if (c.researched.has(t.id)) continue;
      if (c.research.some(r => r.id === t.id)) continue;
      if (byCat[t.cat]) continue;
      if (t.cat === 'nuc' && t.year === 1945 && !c.done.has('nuke') && Game.year(G) < 1945) continue;
      byCat[t.cat] = t;
    }
    return Object.values(byCat);
  };

  Game.startResearch = function (G, c, id) {
    if (c.research.length >= c.slots) return false;
    if (c.researched.has(id) || c.research.some(r => r.id === id)) return false;
    const t = IM.TECH_BY_ID[id];
    // must have previous rung of the ladder
    const prev = IM.TECHS.filter(x => x.cat === t.cat && x.year < t.year);
    if (prev.some(p => !c.researched.has(p.id))) return false;
    c.research.push({ id, prog: 0 });
    return true;
  };

  Game.focusAvailable = function (G, c, f) {
    if (c.done.has(f.id) || (c.focus && c.focus.id === f.id)) return false;
    if (f.minYear && Game.year(G) < f.minYear) return false;
    return (f.req || []).every(r => c.done.has(r));
  };

  Game.completeFocus = function (G, c, f) {
    c.done.add(f.id);
    const fx = f.fx;
    const capS = G.W.states[c.capital];
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'civ' || k === 'mil') {
        // place into owned states with free slots, capital first
        let left = v;
        const owned = G.W.states.filter(s => G.owner[s.id] === c.id).sort((a, b) => (b.id === c.capital) - (a.id === c.capital) || b.pop - a.pop);
        for (const s of owned) { while (left > 0 && G.civ[s.id] + G.mil[s.id] < G.slots[s.id]) { G[k][s.id]++; left--; } if (!left) break; }
        if (left > 0) G[k][capS.id] += left;
      } else if (k === 'slot') c.slots += v;
      else if (k === 'stab') c.stab = clamp(c.stab + v, 0, 1);
      else if (k === 'ws') c.ws = clamp(c.ws + v, 0, 1);
      else if (k === 'pp') c.pp += v;
      else if (k === 'tech') { c.researched.add(v); c.research = c.research.filter(r => r.id !== v); }
      else if (k === 'grant') for (const [eq, amt] of Object.entries(v)) c.stock[eq] += Math.round(amt * (G.modern ? 0.6 : 1));
      else if (k === 'forts') {
        for (const s of G.W.states) if (G.owner[s.id] === c.id) for (const h of s.hexes) {
          for (const j of G.W.neighbors(h)) if (G.ctrl[j] >= 0 && G.ctrl[j] !== c.id) { G.fort[h] = Math.min(5, G.fort[h] + v); break; }
        }
      } else if (k === 'joinFaction') IM.Diplo.seekAlliance(G, c);
      else c.fmods[k] = (c.fmods[k] || 0) + v;
    }
    Game.recomputeMods(G, c);
    Game.news(G, `${c.name} completed the national focus "${f.name}".`, c.isPlayer ? 'good' : 'info', c.tag);
  };

  Game.setLaw = function (G, c, law, level) {
    const L = IM.LAWS[law].levels[level];
    if (!L || c.laws[law] === level) return 'Already active';
    if (level > c.laws[law] && c.pp < L.cost) return 'Not enough political power';
    if (L.ws && c.ws < L.ws && !IM.War.atWar(G, c.id)) return `Requires ${Math.round(L.ws * 100)}% war support or being at war`;
    if (L.war && !IM.War.atWar(G, c.id)) return 'Requires being at war';
    if (level > c.laws[law]) c.pp -= L.cost;
    c.laws[law] = level;
    if (L.stab) c.stab = clamp(c.stab + L.stab, 0, 1);
    return null;
  };

  Game.queueBuild = function (G, c, type, stateId) {
    const s = G.W.states[stateId];
    if (G.owner[stateId] !== c.id) return 'Not your state';
    if (type !== 'fort') {
      const queued = c.cons.filter(p => p.state === stateId && p.type !== 'fort').length;
      if (G.civ[stateId] + G.mil[stateId] + queued >= G.slots[stateId]) return 'No free building slots';
    }
    const cost = type === 'civ' ? 10800 : type === 'mil' ? 7200 : Math.min(4000, 400 * s.hexes.length);
    c.cons.push({ type, state: stateId, prog: 0, cost });
    return null;
  };

  Game.processRecruitment = function (G, c) {
    const keep = [];
    for (const r of c.recruit) {
      if (r.days > 0) { r.days--; keep.push(r); continue; }
      const tpl = IM.TEMPLATES[r.tpl];
      let frac = 1;
      for (const [eq, amt] of Object.entries(tpl.eq)) frac = Math.min(frac, c.stock[eq] / amt);
      if (frac < 0.35) { keep.push(r); r.waiting = true; continue; }
      frac = Math.min(1, frac);
      for (const [eq, amt] of Object.entries(tpl.eq)) c.stock[eq] -= Math.round(amt * frac);
      const hex = Game.deployHex(G, c);
      if (hex < 0) { keep.push(r); continue; }
      IM.War.spawnDivision(G, c, r.tpl, hex, frac);
      if (c.isPlayer) Game.news(G, `A new ${Game.tplName(G, r.tpl)} has been deployed.`, 'good', c.tag);
    }
    c.recruit = keep;
  };

  Game.deployHex = function (G, c) {
    const W = G.W;
    const cap = W.states[c.capital];
    if (cap && G.ctrl[cap.cityHex] === c.id) return cap.cityHex;
    let best = -1, bv = -1;
    for (const s of W.states) if (G.owner[s.id] === c.id && G.ctrl[s.cityHex] === c.id && s.vp > bv) { bv = s.vp; best = s.cityHex; }
    return best;
  };

  Game.recruit = function (G, c, tplId, count) {
    const tpl = IM.TEMPLATES[tplId];
    if (tpl.requires && !c.mods[tpl.requires]) return 'Technology required';
    const st = Game.countryStats(G, c);
    count = count || 1;
    if (st.mp < tpl.mp * count) return 'Not enough manpower';
    c.mpUsed += tpl.mp * count;
    for (let i = 0; i < count; i++) c.recruit.push({ tpl: tplId, days: tpl.days, total: tpl.days });
    return null;
  };

  // Minimal economy/army for a nation released mid-game (e.g. Soviet dissolution).
  Game.initReleased = function (G, c, states, from) {
    c.capital = states.slice().sort((a, b) => b.vp - a.vp || b.pop - a.pop)[0].id;
    c.researched = new Set(from.researched);
    c.tier = from.tier || 'C';
    c.stab = 0.5; c.ws = 0.3; c.pp = 40;
    c.laws = { draft: 1, econ: 0 };
    c.slots = 3;
    Game.recomputeMods(G, c);
    const mil = states.reduce((a, s) => a + G.mil[s.id], 0);
    if (mil) c.lines.push({ eq: 'inf', fac: Math.ceil(mil * 0.6), eff: 0.5, prog: 0 }, { eq: 'art', fac: Math.floor(mil * 0.4), eff: 0.5, prog: 0 });
    const pop = states.reduce((a, s) => a + (s._pop || s.pop), 0);
    c.basePop = pop;
    c.divTarget = Math.max(1, Math.round(pop * 0.03));
    c.stock.inf = 2000; c.stock.art = 60;
    c.stock.air = Math.round(from.stock.air * pop / Math.max(1, from.basePop || pop) * 0.5);
    from.stock.air -= c.stock.air;
    if (!c.leader) c.leader = `Government of ${c.name}`;
    c.aggr = 0.05;
  };

  // Iron Meridian feature: emergency militia. Threatened victory-point cities
  // raise territorial-defence units from the national stockpile.
  Game.MILITIA_PP = 40;
  Game.threatenedCities = function (G, c) {
    const W = G.W, byHex = IM.War.byHex(G), out = [];
    for (const s of W.states) {
      if (G.owner[s.id] !== c.id || s.vp < 3 || G.ctrl[s.cityHex] !== c.id) continue;
      if ((byHex.get(s.cityHex) || []).some(d => d.owner === c.id && !d.dead)) continue;
      let near = false;
      for (const j of W.neighbors(s.cityHex)) {
        if (IM.War.isEnemy(G, c.id, G.ctrl[j]) || (byHex.get(j) || []).some(d => IM.War.isEnemy(G, c.id, d.owner))) { near = true; break; }
        for (const k of W.neighbors(j)) if ((byHex.get(k) || []).some(d => IM.War.isEnemy(G, c.id, d.owner))) { near = true; break; }
        if (near) break;
      }
      if (near) out.push(s);
    }
    return out.sort((a, b) => b.vp - a.vp);
  };
  Game.raiseMilitia = function (G, c, max) {
    const T = IM.TEMPLATES.gar;
    let n = 0;
    for (const s of Game.threatenedCities(G, c)) {
      if (n >= (max || 3)) break;
      const st = Game.countryStats(G, c);
      if (st.mp < T.mp || c.stock.inf < T.eq.inf * 0.5) break;
      const frac = Math.min(1, c.stock.inf / T.eq.inf);
      c.stock.inf -= Math.round(T.eq.inf * frac);
      c.mpUsed += T.mp;
      const d = IM.War.spawnDivision(G, c, 'gar', s.cityHex, frac);
      d.name = `${s.name} Militia`; d.entrench = 0.6; d.org = IM.War.stats(G, d).org * 0.7;
      n++;
    }
    return n;
  };

  Game.tplName = (G, id) => (G.modern ? IM.MODERN_TEMPLATE_NAMES[id] : null) || IM.TEMPLATES[id].name;
  Game.eqName = (G, id) => G.modern ? IM.EQUIP[id].modern : IM.EQUIP[id].name;
  Game.ideoName = (G, id) => (G.modern && IM.IDEOLOGIES[id].modernName) || IM.IDEOLOGIES[id].name;

  // ------------------------------------------------------------------ main loop
  Game.tick = function (G) {
    G.hour++;
    IM.War.hourly(G);
    if (G.hour % 24 === 0) {
      Game.daily(G);
      IM.War.daily(G);
      IM.Events.check(G);
      IM.AI.daily(G);
    }
  };
})();
