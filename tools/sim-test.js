// Headless smoke test: loads the engine, starts every era, simulates some days
// with the AI running every country, and reports what happened.
// Usage: node tools/sim-test.js [days] [eraId]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/(?:data|engine)\/[^"]+)"/g)].map(m => m[1]);
const ctx = { console, Math, Date, Set, Map, Uint8Array, Int16Array, Int32Array, Float32Array, JSON, Object, Array, Number, String, Infinity, isFinite };
ctx.window = ctx;
vm.createContext(ctx);
for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
const IM = ctx.IM;

const days = +(process.argv[2] || 90);
const only = process.argv[3];
let failed = false;
for (const era of IM.ERAS) {
  if (only && era.id !== only) continue;
  const t0 = Date.now();
  const G = IM.Game.create(era.id, null, {});
  const t1 = Date.now();
  const alive = () => G.countries.filter(c => c.alive).length;
  const summary = tags => tags.map(t => {
    const c = IM.Game.byTag(G, t); if (!c) return `${t}:-`;
    const divs = G.divisions.filter(d => d.owner === c.id).length;
    const states = G.W.states.filter(s => G.owner[s.id] === c.id).length;
    const ctl = G.W.states.filter(s => G.ctrl[s.cityHex] === c.id).length;
    return `${t}:${c.alive ? '' : '✝'}${c.capitulated ? 'CAP ' : ''}d${divs} s${states}/c${ctl}`;
  }).join(' ');
  const tags = { '1939': ['DEU', 'POL', 'FRA', 'GBR', 'SOV', 'ITA', 'JPN', 'CHN'], '1941': ['DEU', 'SOV', 'GBR', 'JPN', 'USA', 'CHN'], '1945': ['DEU', 'SOV', 'USA', 'GBR', 'JPN', 'CHN'], '1991': ['USA', 'IRQ', 'SOV', 'YUG', 'SAU'], '2000': ['RUS', 'ICH', 'USA', 'AFG', 'CHN'], '2021': ['RUS', 'UKR', 'USA', 'AFG', 'CHN'], '2022': ['RUS', 'UKR', 'BLR', 'USA'], '2026': ['RUS', 'UKR', 'CHN', 'TWN', 'USA'] }[era.id];
  console.log(`\n=== ${era.id} ${era.title}: setup ${t1 - t0}ms, ${alive()} countries, ${G.divisions.length} divisions, ${G.wars.length} wars`);
  console.log('  start', summary(tags));
  try {
    const t2 = Date.now();
    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) IM.Game.tick(G);
      G.pendingEvents.length = 0;
      if ((d + 1) % Math.max(30, Math.floor(days / 4)) === 0) console.log(`  ${IM.Game.fmtDate(G)}`, summary(tags), `battles ${G.battles.size}`);
    }
    const ms = Date.now() - t2;
    console.log(`  simulated ${days} days in ${ms}ms (${(ms / days).toFixed(1)} ms/day), divisions ${G.divisions.length}, wars: ${G.wars.map(w => w.name).join('; ')}`);
    console.log('  news:', G.news.filter(n => n.kind === 'major' || n.kind === 'event').slice(0, 8).map(n => n.text).join(' | '));
  } catch (e) {
    failed = true;
    console.error('  ERROR', e.stack);
  }
}
process.exit(failed ? 1 : 0);
