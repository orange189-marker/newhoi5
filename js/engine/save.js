// Save / load: serialise the mutable game state (the static world is rebuilt).
window.IM = window.IM || {};

(function () {
  const S = IM.Save = {};
  const SET_FIELDS = ['researched', 'done', 'wargoals', 'guarantees', 'sanctionedBy'];
  const TYPED = ['owner', 'ctrl', 'fort', 'civ', 'mil', 'slots'];

  S.serialize = function (G) {
    const out = {
      v: 1, eraId: G.eraId, hour: G.hour, nextDiv: G.nextDiv, tension: G.tension, player: G.player,
      firedEvents: [...G.firedEvents], tlDone: G.tlDone, watch: G.watch, camps: G.camps, flags: G.flags, factions: G.factions, core: G.core, warSeq: G.warSeq, aiMode: G.aiMode,
      wars: G.wars.map(w => ({ ...w, cap: [...w.cap] })),
      news: G.news.slice(0, 30),
      divisions: G.divisions.filter(d => !d.dead).map(d => ({ ...d })),
      battles: [...G.battles.values()].map(b => ({ hex: b.hex, hours: b.hours, attOwner: b.attOwner, att: [...b.att] })),
      countries: G.countries.map(c => {
        const o = { ...c, statCache: null, _st: null };
        for (const f of SET_FIELDS) o[f] = [...c[f]];
        return o;
      }),
      statePop: G.W.states.map(s => s._pop || 0),
    };
    for (const k of TYPED) out[k] = Array.from(G[k]);
    return JSON.stringify(out);
  };

  S.deserialize = function (json) {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    const era = IM.ERAS.find(e => e.id === o.eraId);
    const W = IM.world || (IM.world = IM.buildWorld());
    const G = {
      era, eraId: o.eraId, W, hour: o.hour, startMs: Date.UTC(era.start[0], era.start[1] - 1, era.start[2]),
      countries: [], tagId: {}, divisions: o.divisions, nextDiv: o.nextDiv, battles: new Map(), wars: [],
      factions: o.factions, news: o.news, tension: o.tension, rel: null, relDirty: true,
      firedEvents: new Set(o.firedEvents), pendingEvents: [], nukeFlashes: [], supplyDirty: true,
      player: o.player, modern: !!era.modern, speed: 0, core: o.core, tlDone: o.tlDone, watch: o.watch, camps: o.camps, flags: o.flags, warSeq: o.warSeq, aiMode: o.aiMode,
    };
    G.owner = Int16Array.from(o.owner); G.ctrl = Int16Array.from(o.ctrl); G.fort = Uint8Array.from(o.fort);
    G.civ = Uint8Array.from(o.civ); G.mil = Uint8Array.from(o.mil); G.slots = Uint8Array.from(o.slots);
    W.states.forEach((s, i) => { s._pop = o.statePop[i]; });
    for (const c of o.countries) {
      for (const f of SET_FIELDS) c[f] = new Set(c[f]);
      G.countries.push(c); G.tagId[c.tag] = c.id;
      IM.Game.recomputeMods(G, c);
    }
    G.wars = o.wars.map(w => ({ ...w, cap: new Set(w.cap) }));
    for (const b of o.battles) G.battles.set(b.hex, { ...b, att: new Set(b.att) });
    IM.War.rebuildRelations(G);
    IM.War.computeSupply(G);
    return G;
  };

  S.KEY = 'ironMeridian.saves';
  S.list = function () {
    try { return JSON.parse(localStorage.getItem(S.KEY) || '[]'); } catch (e) { return []; }
  };
  S.store = function (G, name) {
    const c = G.countries[G.player];
    const entry = { name: name || `${c.name} - ${IM.Game.fmtDate(G)}`, era: G.eraId, tag: c.tag, date: IM.Game.fmtDate(G), at: Date.now() };
    try {
      const list = S.list().filter(e => e.name !== entry.name);
      localStorage.setItem('ironMeridian.save.' + entry.name, S.serialize(G));
      list.unshift(entry);
      localStorage.setItem(S.KEY, JSON.stringify(list.slice(0, 12)));
      return null;
    } catch (e) { return 'Could not save: ' + e.message; }
  };
  S.load = function (name) {
    try { const raw = localStorage.getItem('ironMeridian.save.' + name); return raw ? S.deserialize(raw) : null; } catch (e) { console.error(e); return null; }
  };
  S.remove = function (name) {
    try {
      localStorage.removeItem('ironMeridian.save.' + name);
      localStorage.setItem(S.KEY, JSON.stringify(S.list().filter(e => e.name !== name)));
    } catch (e) { /* storage unavailable */ }
  };
})();
