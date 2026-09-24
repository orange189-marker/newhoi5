// In-game HUD and management panels.
window.IM = window.IM || {};

(function () {
  const P = IM.Panels = {};
  const UI = IM.UI, R = IM.Render;
  const h = (...a) => UI.h(...a);
  const G = () => UI.G;
  const me = () => G().countries[G().player];
  let els = {};
  let hoverEl = null;

  // ------------------------------------------------------------------ HUD
  P.buildHUD = function () {
    const root = document.getElementById('ui');
    UI.clearTip();
    root.innerHTML = '';
    els = {};
    const c = me();
    const stat = (key, label, tip) => {
      const v = h('div', { class: 'v' }, '–');
      const el = h('div', { class: 'stat' }, h('div', { class: 'l' }, label), v);
      els[key] = v;
      if (tip) UI.tip(el, tip);
      return el;
    };
    els.flag = UI.flag(c);
    els.name = h('div', { class: 'nm' }, c.name);
    els.date = h('div', { class: 'date' });
    els.pause = h('button', { class: 'pausebtn', title: 'Pause (Space)', onclick: UI.togglePause }, '⏸');
    els.spd = [1, 2, 3, 4, 5].map(s => h('button', { class: 'spd', title: `Speed ${s}`, onclick: () => UI.setSpeed(s) }));
    root.appendChild(h('div', { class: 'topbar' },
      h('div', { class: 'me', onclick: () => P.open('politics') }, els.flag, els.name),
      h('div', { class: 'stats' },
        stat('pp', 'Political Power', () => `<b>Political power</b><br>Spent on laws, war goals, diplomacy and focuses.<br>+${(2 + me().mods.ppGain).toFixed(1)} per day`),
        stat('stab', 'Stability', () => `<b>Stability</b><br>Below 50% reduces factory output. Higher stability makes capitulation less likely.`),
        stat('ws', 'War Support', () => `<b>War support</b><br>Required for harsher conscription and economy laws.`),
        stat('mp', 'Manpower', () => { const s = me()._st || IM.Game.countryStats(G(), me()); return `<b>Manpower</b><br>Available: ${UI.fmt(s.mp)}<br>Recruitable total: ${UI.fmt(s.mpTotal)}<br>Law: ${IM.LAWS.draft.levels[me().laws.draft].name}`; }),
        stat('fac', 'Factories', () => { const s = me()._st || IM.Game.countryStats(G(), me()); return `<b>Factories</b><br>Civilian: ${s.civ} (consumer goods −${s.consumer}${s.sanctionLoss ? `, sanctions −${s.sanctionLoss}` : ''})<br>Free for construction: ${s.freeCiv}<br>Military: ${s.mil}`; }),
        stat('div', 'Divisions'),
        stat('air', 'Aircraft'),
        stat('nav', 'Navy'),
        stat('nuk', 'Warheads'),
        stat('ten', 'World Tension', () => '<b>World tension</b><br>Rises with aggression. Democracies need high tension to justify wars.'),
      ),
      h('button', { class: 'pausebtn', title: 'Game menu', style: { margin: 'auto 6px' }, onclick: P.gameMenu }, '☰'),
      h('div', { class: 'clock' }, els.pause, els.date, ...els.spd),
    ));
    const side = [
      ['focus', '★', 'Focus', 'F'], ['research', '⚗', 'Tech', 'R'], ['politics', '⚖', 'Politics', 'P'], ['diplomacy', '✉', 'Diplo', 'E'],
      ['production', '⚙', 'Produce', 'Q'], ['construction', '⌂', 'Build', 'B'], ['recruit', '⚑', 'Recruit', 'T'], ['army', '⚔', 'Army', 'G'],
    ];
    els.side = {};
    root.appendChild(h('div', { class: 'sidebar' }, side.map(([id, icon, label, key]) => {
      const b = h('button', { class: 'sidebtn', title: `${label} (${key})`, onclick: () => P.open(UI.panel === id ? null : id) }, icon, h('span', null, label));
      els.side[id] = b;
      return b;
    })));
    els.outliner = h('div', { class: 'outliner' });
    root.appendChild(els.outliner);
    els.sel = h('div', { class: 'selpanel', style: { display: 'none' } });
    root.appendChild(els.sel);
    els.panel = h('div', { class: 'panel', style: { display: 'none' } });
    root.appendChild(els.panel);
    const modes = [['political', 'Political'], ['diplomatic', 'Diplomatic'], ['ideology', 'Ideology'], ['terrain', 'Terrain']];
    els.modes = h('div', { class: 'mapmodes' }, modes.map(([m, l]) => h('button', { class: 'btn' + (R.mode === m ? ' active' : ''), onclick: e => { R.mode = m; R.dirty = true; [...els.modes.children].forEach(b => b.classList.remove('active')); e.target.classList.add('active'); } }, l)));
    root.appendChild(els.modes);
    els.ticker = h('div', { class: 'ticker' });
    root.appendChild(els.ticker);
    hoverEl = h('div', { class: 'tooltip', style: { display: 'none' } });
    document.body.appendChild(hoverEl);
    P.refresh(true);
  };

  P.toast = function (n) {
    if (!els.ticker) return;
    const t = h('div', { class: 'toast ' + (n.kind || '') }, n.text);
    els.ticker.appendChild(t);
    while (els.ticker.children.length > 5) els.ticker.firstChild.remove();
    setTimeout(() => t.remove(), n.kind === 'major' || n.kind === 'nuke' ? 9000 : 6000);
  };

  P.refresh = function (force) {
    if (!els.pp || !G()) return;
    const g = G(), c = me();
    const st = c._st || IM.Game.countryStats(g, c);
    els.pp.textContent = Math.floor(c.pp);
    els.stab.textContent = UI.pct(c.stab); els.stab.className = 'v ' + (c.stab < 0.4 ? 'bad' : '');
    els.ws.textContent = UI.pct(c.ws);
    els.mp.textContent = UI.fmt(st.mp);
    els.fac.innerHTML = `${st.civ}<span class="muted"> / </span>${st.mil}`;
    els.div.textContent = g.divisions.filter(d => d.owner === c.id).length + (c.recruit.length ? ` (+${c.recruit.length})` : '');
    els.air.textContent = UI.fmt(c.stock.air);
    els.nav.textContent = UI.fmt(c.stock.nav);
    els.nuk.textContent = c.mods.nukes || c.stock.nuk ? String(Math.floor(c.stock.nuk)) : '—';
    els.ten.textContent = UI.pct(g.tension / 100); els.ten.className = 'v ' + (g.tension > 70 ? 'bad' : g.tension > 40 ? 'warn' : '');
    els.date.textContent = IM.Game.fmtDate(g, true);
    els.date.className = 'date' + (UI.paused ? ' paused' : '');
    els.pause.textContent = UI.paused ? '▶' : '⏸';
    els.spd.forEach((b, i) => b.classList.toggle('on', i < UI.speed));
    els.flag.style.background = c.color; els.name.textContent = c.name;
    for (const [id, b] of Object.entries(els.side)) b.classList.toggle('on', UI.panel === id);
    // attention dots
    const dot = (id, on) => { const b = els.side[id]; let d = b.querySelector('.dot'); if (on && !d) b.appendChild(h('i', { class: 'dot' })); else if (!on && d) d.remove(); };
    dot('focus', !c.focus && IM.FOCUSES.some(f => IM.Game.focusAvailable(g, c, f)));
    dot('research', c.research.length < c.slots && IM.Game.availableTechs(g, c).length > 0);
    dot('production', c.lines.reduce((a, l) => a + l.fac, 0) < st.mil);
    renderOutliner();
    if (UI.panel && (force || (!UI.paused && g.hour % 24 === 0) || P._panelStale)) renderPanel();
    P._panelStale = false;
    if (R.selected.size || R.selectedState >= 0) renderSel();
  };

  P.hover = function (hex, e) {
    const g = G();
    if (!hoverEl || hex < 0 || !g.W.region[hex] || UI.panel) { if (hoverEl) hoverEl.style.display = 'none'; return; }
    const W = g.W, s = W.states[W.stateOf[hex]];
    const own = g.countries[g.owner[s.id]], ctl = g.countries[g.ctrl[hex]];
    const divs = g.divisions.filter(d => d.hex === hex);
    const lines = [`<b>${s.name}</b> <span class="muted">(${own.name})</span>`];
    if (ctl !== own) lines.push(`Occupied by <span class="bad">${ctl.name}</span>`);
    lines.push(`${IM.TERRAIN[W.terrainName(hex)].name}${g.fort[hex] ? ` · Fort ${g.fort[hex]}` : ''} · VP ${s.vp}`);
    if (divs.length) {
      const byOwner = {};
      for (const d of divs) byOwner[g.countries[d.owner].name] = (byOwner[g.countries[d.owner].name] || 0) + 1;
      lines.push(Object.entries(byOwner).map(([n, k]) => `${k} × ${n} division${k > 1 ? 's' : ''}`).join('<br>'));
    }
    const b = g.battles.get(hex);
    if (b) lines.push('<span class="warn">⚔ Battle in progress</span>');
    if (R.selected.size && divs.some(d => IM.War.isEnemy(g, g.player, d.owner))) {
      const sel = g.divisions.filter(d => R.selected.has(d.id));
      const est = IM.War.estimateBattle(g, sel, divs.filter(d => IM.War.isEnemy(g, g.player, d.owner)), hex);
      const r = est.ratio;
      lines.push(`Attack odds: <b class="${r > 1.3 ? 'good' : r > 0.9 ? 'warn' : 'bad'}">${r > 1.3 ? 'Favourable' : r > 0.9 ? 'Even' : 'Unfavourable'}</b> <span class="muted">(${r.toFixed(2)})</span>`);
    }
    hoverEl.innerHTML = lines.join('<br>');
    hoverEl.style.display = 'block';
    hoverEl.style.left = Math.min(e.clientX + 16, window.innerWidth - hoverEl.offsetWidth - 8) + 'px';
    hoverEl.style.top = Math.min(e.clientY + 18, window.innerHeight - hoverEl.offsetHeight - 8) + 'px';
  };

  // ------------------------------------------------------------------ outliner
  let outState = { wars: true, battles: true, army: true, news: false };
  function renderOutliner() {
    const g = G(), c = me();
    const box = (key, title, count, body) => h('div', { class: 'obox' },
      h('div', { class: 'oh', onclick: () => { outState[key] = !outState[key]; renderOutliner(); } }, h('span', null, title), h('span', { class: 'muted' }, count)),
      outState[key] ? h('div', { class: 'ob' }, body) : null);
    const wars = g.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id));
    const myBattles = [...g.battles.values()].filter(b => {
      const ds = g.divisions.filter(d => d.hex === b.hex || b.att.has(d.id));
      return ds.some(d => d.owner === c.id);
    });
    const mine = g.divisions.filter(d => d.owner === c.id);
    const auto = mine.filter(d => d.auto).length;
    els.outliner.innerHTML = '';
    els.outliner.appendChild(box('wars', 'Wars', wars.length, wars.length ? wars.map(w => {
      const mySide = w.att.includes(c.id) ? 'att' : 'def';
      const foes = w[mySide === 'att' ? 'def' : 'att'].filter(x => g.countries[x].alive && !w.cap.has(x));
      const sc = IM.Diplo.warScore(g, w);
      return h('div', { class: 'oitem', onclick: () => P.open('diplomacy') }, h('span', { class: 'grow' }, w.name, h('div', { class: 'muted small' }, 'vs ', foes.slice(0, 3).map(x => g.countries[x].tag).join(', '), foes.length > 3 ? '…' : '')),
        h('span', { class: 'small ' + (sc[mySide] > sc[mySide === 'att' ? 'def' : 'att'] ? 'bad' : 'good') }, UI.pct(sc[mySide === 'att' ? 'def' : 'att'])));
    }) : h('div', { class: 'muted small' }, 'At peace')));
    els.outliner.appendChild(box('battles', 'Battles', myBattles.length, myBattles.length ? myBattles.slice(0, 12).map(b => {
      const s = g.W.states[g.W.stateOf[b.hex]];
      const atk = g.divisions.filter(d => b.att.has(d.id)), def = g.divisions.filter(d => d.hex === b.hex);
      const weAttack = atk.some(d => d.owner === c.id);
      const est = IM.War.estimateBattle(g, atk, def, b.hex);
      const good = weAttack ? est.ratio > 1 : est.ratio < 1;
      return h('div', { class: 'oitem', onclick: () => R.centerOn(b.hex) }, h('span', { class: good ? 'good' : 'bad' }, '⚔'), h('span', { class: 'grow' }, s.name), h('span', { class: 'muted small' }, `${atk.length} v ${def.length}`));
    }) : h('div', { class: 'muted small' }, 'No battles')));
    els.outliner.appendChild(box('army', 'Army', `${mine.length}`, h('div', null,
      h('div', { class: 'small' }, `${mine.filter(d => d.battle >= 0).length} fighting · ${mine.filter(d => d.path.length).length} moving · ${mine.filter(d => !d.supplied).length} cut off`),
      h('div', { class: 'small muted' }, `${auto} under AI command`),
      h('div', { class: 'row', style: { marginTop: '5px', flexWrap: 'wrap' } },
        h('button', { class: 'btn small', onclick: () => { R.selected = new Set(mine.map(d => d.id)); R.selectedState = -1; P.selectionChanged(); R.dirty = true; } }, 'Select all'),
        h('button', { class: 'btn small', title: 'Hand every division to the AI general', onclick: () => { for (const d of mine) d.auto = true; P.toast({ text: 'All divisions delegated to the AI general.', kind: 'good' }); } }, 'Delegate all')))));
    els.outliner.appendChild(box('news', 'News', '', g.news.slice(0, 12).map(n => h('div', { class: 'small', style: { padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } }, h('span', { class: n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : n.kind === 'major' ? 'gold' : '' }, n.text)))));
  }

  // ------------------------------------------------------------------ selection panel
  P.selectionChanged = function () { renderSel(); };
  function renderSel() {
    const g = G();
    if (!els.sel) return;
    if (R.selected.size) { renderUnits(g); return; }
    if (R.selectedState >= 0) { renderState(g, R.selectedState); return; }
    els.sel.style.display = 'none';
  }

  function renderUnits(g) {
    const divs = g.divisions.filter(d => R.selected.has(d.id));
    if (!divs.length) { R.selected.clear(); els.sel.style.display = 'none'; return; }
    const auto = divs.every(d => d.auto);
    const scroll = els.sel.scrollTop;
    els.sel.innerHTML = '';
    els.sel.style.display = 'block';
    els.sel.appendChild(h('div', { class: 'row' }, h('h3', { class: 'grow' }, `${divs.length} division${divs.length > 1 ? 's' : ''} selected`), h('button', { class: 'x', onclick: () => { R.selected.clear(); renderSel(); R.dirty = true; } }, '×')));
    els.sel.appendChild(h('div', { class: 'muted small', style: { margin: '2px 0 8px' } }, 'Right-click the map to move. Moving onto enemy troops attacks them.'));
    els.sel.appendChild(h('div', { class: 'row', style: { marginBottom: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn small', onclick: () => { IM.War.stop(g, divs); for (const d of divs) d.auto = false; R.dirty = true; renderSel(); } }, 'Halt'),
      h('button', { class: 'btn small' + (auto ? ' active' : ''), onclick: () => { for (const d of divs) d.auto = !auto; if (!auto) IM.War.stop(g, divs.filter(d => d.battle < 0)); renderSel(); } }, auto ? 'AI general in command' : 'Delegate to AI general'),
      h('button', { class: 'btn small', onclick: () => R.centerOn(divs[0].hex) }, 'Locate'),
    ));
    const rows = divs.slice(0, 60).map(d => {
      const s = IM.War.stats(g, d);
      return h('div', { class: 'divrow' },
        h('div', null, h('div', null, d.name), h('div', { class: 'muted', style: { fontSize: '10.5px' } }, d.battle >= 0 ? (d.battleRole === 'att' ? '⚔ attacking' : '⛨ defending') : d.path.length ? `moving (${d.path.length} hex)` : d.entrench > 0.3 ? 'dug in' : 'holding', !d.supplied ? ' · ' : '', !d.supplied ? h('span', { class: 'bad' }, 'OUT OF SUPPLY') : (d.supply ?? 1) < 1 ? h('span', { class: 'warn' }, ` · supply ${UI.pct(d.supply)}`) : null)),
        UI.tip(h('div', { class: 'bar g' }, h('i', { style: { width: UI.pct(Math.max(0, d.org / s.org)) } })), `Organisation ${d.org.toFixed(0)} / ${s.org.toFixed(0)}`),
        UI.tip(h('div', { class: 'bar' }, h('i', { style: { width: UI.pct(Math.max(0, d.str)) } })), `Strength ${UI.pct(d.str)}<br>Soft attack ${s.sa.toFixed(1)} · Hard attack ${s.ha.toFixed(1)}<br>Defense ${s.def.toFixed(1)} · Breakthrough ${s.brk.toFixed(1)}<br>Armor ${UI.pct(s.hard)} · Speed ${s.speed.toFixed(1)} km/h`));
    });
    els.sel.appendChild(h('div', null, rows));
    if (divs.length > 60) els.sel.appendChild(h('div', { class: 'muted small' }, `…and ${divs.length - 60} more`));
    els.sel.scrollTop = scroll;
  }

  function renderState(g, sid) {
    const W = g.W, s = W.states[sid], c = me();
    const own = g.countries[g.owner[sid]], ctl = g.countries[g.ctrl[s.cityHex]];
    const mine = own.id === c.id;
    const queued = c.cons.filter(p => p.state === sid);
    els.sel.innerHTML = '';
    els.sel.style.display = 'block';
    const build = (type, label) => h('button', { class: 'btn small', onclick: () => { const e = IM.Game.queueBuild(g, c, type, sid); if (e) P.toast({ text: e, kind: 'bad' }); renderSel(); P._panelStale = true; } }, label);
    const relTxt = own.id === c.id ? 'Your territory' : IM.War.isEnemy(g, c.id, own.id) ? 'At war' : IM.War.isFriend(g, c.id, own.id) ? 'Ally' : 'Neutral';
    els.sel.appendChild(h('div', { class: 'row' }, UI.flag(own), h('div', { class: 'grow' }, h('h3', null, s.name), h('div', { class: 'muted small' }, `${own.name} · ${relTxt}`)), h('button', { class: 'x', onclick: () => { R.selectedState = -1; renderSel(); R.dirty = true; } }, '×')));
    els.sel.appendChild(h('div', { class: 'kv' },
      h('span', null, 'Controller'), h('span', { class: ctl !== own ? 'bad' : '' }, ctl.name),
      h('span', null, 'Victory points'), h('span', null, String(s.vp)),
      h('span', null, 'Population'), h('span', null, UI.fmt((s._pop || s.pop) * 1e6)),
      h('span', null, 'Factories'), h('span', null, `${g.civ[sid]} civilian · ${g.mil[sid]} military · ${g.slots[sid]} slots`),
      h('span', null, 'Fortification'), h('span', null, String(Math.max(...s.hexes.map(x => g.fort[x])))),
      h('span', null, 'Terrain'), h('span', null, IM.TERRAIN[W.terrainName(s.cityHex)].name),
      h('span', null, 'Cores'), h('span', null, (g.core[sid] || []).map(t => (IM.Game.byTag(g, t) || { name: IM.COUNTRY_NAMES[t] || t }).name).join(', ')),
    ));
    if (mine) {
      els.sel.appendChild(h('div', { class: 'row', style: { marginTop: '10px', flexWrap: 'wrap' } },
        build('civ', '+ Civilian factory'), build('mil', '+ Military factory'), build('fort', '+ Fort level')));
      if (queued.length) els.sel.appendChild(h('div', { class: 'muted small', style: { marginTop: '6px' } }, `${queued.length} project(s) queued here`));
    } else {
      const row = h('div', { class: 'row', style: { marginTop: '10px', flexWrap: 'wrap' } },
        h('button', { class: 'btn small', onclick: () => { P.diploTarget = own.id; P.open('diplomacy'); } }, `Diplomacy with ${own.tag}`));
      if (c.mods.nukes && IM.War.isEnemy(g, c.id, g.ctrl[s.cityHex])) {
        row.appendChild(h('button', { class: 'btn small danger', disabled: c.stock.nuk < 1, onclick: () => confirmNuke(s) }, `☢ Nuclear strike (${Math.floor(c.stock.nuk)})`));
      }
      els.sel.appendChild(row);
    }
  }

  function confirmNuke(s) {
    const g = G(), c = me();
    const err = IM.Diplo.canNuke(g, c, s.cityHex);
    if (err) { P.toast({ text: err, kind: 'bad' }); return; }
    UI.paused = true;
    UI.modal('Authorise Nuclear Strike?', h('div', null,
      h('p', null, `Target: ${s.name}. The blast will annihilate divisions in and around the city, wreck its factories and kill hundreds of thousands.`),
      h('p', { class: 'warn' }, 'World tension will reach 100%. Democracies will sanction you, and nuclear-armed enemies will retaliate.')),
      [{ label: '☢ Launch', primary: true, fn: () => { const e = IM.Diplo.nuke(g, c, s.cityHex); if (e) P.toast({ text: e, kind: 'bad' }); R.dirty = true; P.refresh(true); } }, { label: 'Stand down' }], '☢');
  }

  // ------------------------------------------------------------------ panels
  P.open = function (id) {
    UI.panel = id;
    if (hoverEl) hoverEl.style.display = 'none';
    if (!id) { els.panel.style.display = 'none'; P.refresh(true); return; }
    renderPanel();
    P.refresh(true);
  };
  function renderPanel() {
    const id = UI.panel;
    const body = els.panel.querySelector('.pbd');
    const scroll = body ? body.scrollTop : 0;
    const titles = { focus: 'National Focus', research: 'Research', politics: 'Politics', diplomacy: 'Diplomacy', production: 'Production', construction: 'Construction', recruit: 'Recruit & Deploy', army: 'Army Overview' };
    els.panel.innerHTML = '';
    els.panel.className = 'panel' + (id === 'focus' ? ' wide' : '');
    els.panel.style.display = 'flex';
    const b = h('div', { class: 'pbd' });
    els.panel.appendChild(h('div', { class: 'phd' }, h('h2', null, titles[id]), h('button', { class: 'x', onclick: () => P.open(null) }, '×')));
    els.panel.appendChild(b);
    ({ focus: focusPanel, research: researchPanel, politics: politicsPanel, diplomacy: diploPanel, production: productionPanel, construction: constructionPanel, recruit: recruitPanel, army: armyPanel })[id](b);
    b.scrollTop = scroll;
  }

  function focusPanel(b) {
    const g = G(), c = me();
    if (c.focus) {
      const f = IM.FOCUS_BY_ID[c.focus.id];
      b.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, `Current focus: ${f.name}`), h('span', { class: 'muted' }, `${f.days - c.focus.prog} days left`), h('button', { class: 'btn small', onclick: () => { c.focus = null; renderPanel(); } }, 'Cancel')),
        h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: UI.pct(c.focus.prog / f.days) } }))));
    } else b.appendChild(h('div', { class: 'card warn' }, 'No focus selected — pick one below.'));
    const NW = 100, NH = 70, GX = 108, GY = 92;
    const maxX = Math.max(...IM.FOCUSES.map(f => f.x)), maxY = Math.max(...IM.FOCUSES.map(f => f.y));
    const tree = h('div', { class: 'ftree', style: { width: `${(maxX + 1) * GX}px`, height: `${(maxY + 1) * GY + 20}px`, margin: '18px auto 0' } });
    [['Industry', 0], ['Military', 4], ['Politics', 8]].forEach(([t, x]) => tree.appendChild(h('div', { class: 'branch-title', style: { left: `${x * GX}px`, top: '-16px' } }, t)));
    for (const f of IM.FOCUSES) for (const r of f.req || []) {
      const p = IM.FOCUS_BY_ID[r];
      const x1 = p.x * GX + NW / 2, y1 = p.y * GY + NH, x2 = f.x * GX + NW / 2, y2 = f.y * GY;
      const midY = (y1 + y2) / 2;
      tree.appendChild(h('div', { class: 'fline', style: { left: `${x1 - 1}px`, top: `${y1}px`, width: '2px', height: `${midY - y1}px` } }));
      tree.appendChild(h('div', { class: 'fline', style: { left: `${Math.min(x1, x2) - 1}px`, top: `${midY - 1}px`, width: `${Math.abs(x2 - x1) + 2}px`, height: '2px' } }));
      tree.appendChild(h('div', { class: 'fline', style: { left: `${x2 - 1}px`, top: `${midY}px`, width: '2px', height: `${y2 - midY}px` } }));
    }
    for (const f of IM.FOCUSES) {
      const done = c.done.has(f.id), cur = c.focus && c.focus.id === f.id;
      const avail = IM.Game.focusAvailable(g, c, f);
      const cls = 'fnode ' + (done ? 'done' : cur ? 'cur avail' : avail ? 'avail' : 'locked');
      const node = h('div', { class: cls, style: { left: `${f.x * GX}px`, top: `${f.y * GY}px` }, onclick: () => { if (avail && !c.focus) { c.focus = { id: f.id, prog: 0 }; renderPanel(); P.refresh(true); } } },
        h('div', { class: 'fn' }, f.name), h('div', { class: 'muted', style: { fontSize: '10px' } }, done ? '✔ Completed' : cur ? `${f.days - c.focus.prog} days` : `${f.days} days`));
      UI.tip(node, `<b>${f.name}</b><br>${f.desc}${f.minYear ? `<br><span class="muted">Available from ${f.minYear}</span>` : ''}${f.req ? `<br><span class="muted">Requires: ${f.req.map(r => IM.FOCUS_BY_ID[r].name).join(', ')}</span>` : ''}`);
      tree.appendChild(node);
    }
    b.appendChild(h('div', { style: { overflowX: 'auto', paddingTop: '10px' } }, tree));
  }

  function researchPanel(b) {
    const g = G(), c = me();
    const yr = IM.Game.year(g);
    const speed = (1 + c.mods.research) * (c.cyberDays > 0 ? 0.85 : 1);
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, `Research slots (${c.research.length}/${c.slots}) · speed ${UI.pct(speed)}`),
      Array.from({ length: c.slots }, (_, i) => {
        const r = c.research[i];
        if (!r) return h('div', { class: 'slot muted' }, 'Empty slot — choose a technology below');
        const t = IM.TECH_BY_ID[r.id], cost = IM.Game.techCost(g, c, t);
        return h('div', { class: 'slot' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, t.name), h('span', { class: 'muted small' }, `${Math.ceil((cost - r.prog) / speed)} days`), h('button', { class: 'x', title: 'Cancel', onclick: () => { c.research.splice(i, 1); renderPanel(); } }, '×')),
          h('div', { class: 'bar', style: { marginTop: '5px' } }, h('i', { style: { width: UI.pct(r.prog / cost) } })));
      })));
    const av = IM.Game.availableTechs(g, c);
    const byCat = Object.keys(IM.TECH_CATS);
    const grid = h('div', { class: 'tech-grid' });
    for (const cat of byCat) {
      const t = av.find(x => x.cat === cat);
      const count = [...c.researched].filter(id => id.startsWith(cat + '_')).length;
      const total = IM.TECHS.filter(x => x.cat === cat).length;
      if (!t) { grid.appendChild(h('div', { class: 'tech', style: { opacity: 0.55, cursor: 'default' } }, h('div', { class: 'ty' }, IM.TECH_CATS[cat]), c.research.some(r => r.id.startsWith(cat + '_')) ? 'Researching…' : count === total ? 'All researched' : 'Locked', h('div', { class: 'ty' }, `${count}/${total}`))); continue; }
      const ahead = t.year > yr;
      const fx = Object.entries(t.fx).map(([k, v]) => k === 'unlock' ? `Unlocks <b>${v}</b>` : `${k} +${Math.round(v * 100)}%`).join(', ');
      const el = h('div', { class: 'tech' + (ahead ? ' ahead' : ''), onclick: () => { if (!IM.Game.startResearch(g, c, t.id)) P.toast({ text: 'No free research slot', kind: 'bad' }); renderPanel(); P.refresh(true); } },
        h('div', { class: 'ty' }, IM.TECH_CATS[cat], ' · ', `${count}/${total}`), h('b', null, t.name), h('div', { class: 'ty' }, `${t.year}${ahead ? ' · ahead of time' : ''} · ~${Math.round(IM.Game.techCost(g, c, t) / speed)} days`));
      UI.tip(el, `<b>${t.name}</b> (${t.year})<br>${fx || 'Foundation technology'}${ahead ? '<br><span class="warn">Researching ahead of time is slower.</span>' : ''}`);
      grid.appendChild(el);
    }
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Available technology'), grid));
    const doneList = [...c.researched].map(id => IM.TECH_BY_ID[id]).filter(Boolean).sort((a, b2) => b2.year - a.year).slice(0, 10);
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Recently researched'), h('div', { class: 'small muted' }, doneList.map(t => `${t.name} (${t.year})`).join(' · '))));
  }

  function politicsPanel(b) {
    const g = G(), c = me();
    b.appendChild(h('div', { class: 'row', style: { marginBottom: '12px' } }, UI.flag(c, true), h('div', null, h('h2', { style: { fontSize: '20px' } }, c.name), h('div', { class: 'muted' }, `${IM.Game.ideoName(g, c.ideo)} · led by ${c.leader}`),
      h('div', { class: 'small' }, c.faction >= 0 ? `Member of the ${g.factions[c.faction].name}` : 'Not in a faction', c.overlord !== null && c.overlord !== undefined ? ` · subject of ${g.countries[c.overlord].name}` : ''))));
    const meter = (label, v, cls) => h('div', { style: { marginBottom: '8px' } }, h('div', { class: 'row small' }, h('span', { class: 'grow' }, label), h('b', null, UI.pct(v))), h('div', { class: 'bar ' + (cls || '') }, h('i', { style: { width: UI.pct(v) } })));
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'National spirit'), meter('Stability', c.stab, c.stab < 0.4 ? 'r' : 'g'), meter('War support', c.ws), h('div', { class: 'small muted' }, `Political power: ${Math.floor(c.pp)} (+${(2 + c.mods.ppGain).toFixed(1)}/day)`),
      c.sanctionedBy.size ? h('div', { class: 'small bad' }, `Under sanctions from ${c.sanctionedBy.size} nation(s): −${Math.round(Math.min(0.3, c.sanctionedBy.size * 0.08) * 100)}% output`) : null,
      c.cyberDays > 0 ? h('div', { class: 'small bad' }, `Cyber attack: networks disrupted for ${c.cyberDays} more days`) : null));
    for (const [key, law] of Object.entries(IM.LAWS)) {
      b.appendChild(h('div', { class: 'sec' }, h('h3', null, law.name), law.levels.map((L, i) => {
        const active = c.laws[key] === i;
        const desc = key === 'draft' ? `${(L.recruit * 100).toFixed(1)}% of population recruitable` : `Consumer goods ${Math.round(L.consumer * 100)}% · military output ${L.milMod >= 0 ? '+' : ''}${Math.round(L.milMod * 100)}%`;
        const req = [L.cost && i > c.laws[key] ? `${L.cost} PP` : null, L.ws ? `${Math.round(L.ws * 100)}% war support or war` : null, L.war ? 'at war' : null].filter(Boolean).join(' · ');
        return h('div', { class: 'list-item' + (active ? '' : ' click'), style: active ? { borderColor: 'var(--gold)' } : null, onclick: () => { if (active) return; const e = IM.Game.setLaw(g, c, key, i); if (e) P.toast({ text: e, kind: 'bad' }); renderPanel(); P.refresh(true); } },
          h('div', { class: 'grow' }, h('b', { class: active ? 'gold' : '' }, L.name), h('div', { class: 'small muted' }, desc)), h('span', { class: 'small muted' }, active ? 'ACTIVE' : req));
      })));
    }
    if (c.mods.nukes || c.stock.nuk) {
      b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Strategic weapons'), h('div', { class: 'small' }, `Warheads: ${Math.floor(c.stock.nuk)}. Produce more in the Production panel. To strike, select an enemy-held state on the map and choose Nuclear strike.`)));
    }
  }

  P.diploTarget = null;
  function diploPanel(b) {
    const g = G(), c = me();
    const others = g.countries.filter(o => o.alive && o.id !== c.id).sort((a, b2) => a.name.localeCompare(b2.name));
    if (P.diploTarget === null || !g.countries[P.diploTarget] || !g.countries[P.diploTarget].alive || P.diploTarget === c.id) {
      const en = IM.War.enemiesOf(g, c.id);
      P.diploTarget = en.length ? en[0] : others.find(o => o.divTarget > 10)?.id ?? others[0].id;
    }
    const t = g.countries[P.diploTarget];
    const sel = h('select', { onchange: e => { P.diploTarget = +e.target.value; renderPanel(); } }, others.map(o => h('option', { value: o.id, selected: o.id === t.id }, o.name)));
    b.appendChild(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('span', { class: 'muted' }, 'Target nation'), sel));
    const rel = IM.War.relation(g, c.id, t.id);
    const tst = t._st || IM.Game.countryStats(g, t);
    b.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, UI.flag(t), h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'small muted' }, `${IM.Game.ideoName(g, t.ideo)} · ${t.leader}`)),
      h('span', { class: rel === 2 ? 'bad' : rel === 1 ? 'good' : 'muted' }, rel === 2 ? 'AT WAR' : rel === 1 ? 'FRIENDLY' : 'NEUTRAL')),
      h('div', { class: 'kv' },
        h('span', null, 'Faction'), h('span', null, t.faction >= 0 ? g.factions[t.faction].name : '—'),
        h('span', null, 'Army'), h('span', null, `${g.divisions.filter(d => d.owner === t.id).length} divisions`),
        h('span', null, 'Industry'), h('span', null, `${tst.civ} civ · ${tst.mil} mil`),
        h('span', null, 'Nuclear'), h('span', null, t.stock.nuk ? `${Math.floor(t.stock.nuk)} warheads` : 'None'),
        t.capitulated ? h('span', null, 'Status') : null, t.capitulated ? h('span', { class: 'bad' }, 'Capitulated (government in exile)') : null)));
    const act = (label, fn, why, cls) => {
      const btn = h('button', { class: 'btn ' + (cls || ''), disabled: !!why, onclick: () => { const e = fn(); if (e) P.toast({ text: e, kind: 'bad' }); renderPanel(); P.refresh(true); R.dirty = true; } }, label);
      return why ? UI.tip(h('span', null, btn), `<span class="bad">${why}</span>`) : btn;
    };
    const actions = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
    if (rel !== 2) {
      if (c.wargoals.has(t.id)) actions.appendChild(act('⚔ Declare war', () => IM.Diplo.declare(g, c, t), null, 'danger'));
      else if (c.justify && c.justify.target === t.id) actions.appendChild(h('span', { class: 'warn small' }, `Justifying war goal: ${c.justify.days} days left`));
      else actions.appendChild(act(`Justify war goal (${IM.Diplo.JUSTIFY_PP} PP)`, () => IM.Diplo.justify(g, c, t), IM.Diplo.canJustify(g, c, t)));
    }
    actions.appendChild(act(c.guarantees.has(t.id) ? 'Revoke guarantee' : 'Guarantee independence (25 PP)', () => IM.Diplo.guarantee(g, c, t), rel === 2 ? 'At war' : null));
    actions.appendChild(act(t.sanctionedBy.has(c.id) ? 'Lift sanctions' : 'Impose sanctions (25 PP)', () => IM.Diplo.sanction(g, c, t), rel === 1 && !t.sanctionedBy.has(c.id) ? 'Cannot sanction friends' : null));
    actions.appendChild(act('Cyber operation (40 PP)', () => IM.Diplo.cyber(g, c, t), !c.mods.cyber ? 'Requires Cyber Warfare technology' : null));
    const myF = c.faction >= 0 ? g.factions[c.faction] : null;
    if (myF && myF.leader === c.id && t.faction < 0) actions.appendChild(act(`Invite to ${myF.name}`, () => IM.Diplo.invite(g, c, t)));
    if (!myF && t.faction >= 0 && g.factions[t.faction].leader === t.id) actions.appendChild(act(`Ask to join ${g.factions[t.faction].name}`, () => IM.Diplo.joinFaction(g, c, t.faction)));
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Actions'), actions));
    if (IM.War.atWar(g, t.id) && rel !== 2) {
      b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Lend-lease'), h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Send 20% of your stockpile of an equipment type.'),
        h('div', { class: 'row', style: { flexWrap: 'wrap' } }, ['inf', 'art', 'arm', 'air', 'drn'].filter(k => c.stock[k] > 0).map(k => act(IM.Game.eqName(g, k), () => IM.Diplo.lendLease(g, c, t, k))))));
    }
    // factions
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Factions'),
      g.factions.filter(f => f.members.length).map(f => h('div', { class: 'card small' }, h('b', { class: 'gold' }, f.name), ` — led by ${g.countries[f.leader].name}`, h('div', { class: 'muted' }, f.members.map(m => g.countries[m].tag).join(', ')))),
      c.faction < 0 ? act('Found a faction (50 PP)', () => IM.Diplo.createFaction(g, c)) : act('Leave faction', () => IM.Diplo.leaveFaction(g, c), g.factions[c.faction].leader === c.id ? 'Leaders cannot leave' : null)));
    // wars & peace
    const wars = g.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id));
    if (wars.length) {
      b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Your wars'), wars.map(w => {
        const side = w.att.includes(c.id) ? 'att' : 'def', foe = side === 'att' ? 'def' : 'att';
        const sc = IM.Diplo.warScore(g, w);
        return h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, w.name), h('span', { class: 'small muted' }, `since ${Math.floor((g.hour - w.start) / 24)} days`)),
          h('div', { class: 'small' }, `Our occupied land: `, h('span', { class: 'bad' }, UI.pct(sc[side])), ' · Enemy occupied land: ', h('span', { class: 'good' }, UI.pct(sc[foe]))),
          h('div', { class: 'small muted' }, 'Enemies: ', w[foe].filter(x => g.countries[x].alive).map(x => g.countries[x].name + (w.cap.has(x) ? ' (capitulated)' : '')).join(', ')),
          h('div', { class: 'row', style: { marginTop: '6px' } }, act('Offer white peace', () => IM.Diplo.offerPeace(g, c, w, 'white')), act('Demand concessions', () => IM.Diplo.offerPeace(g, c, w, 'concession'))));
      })));
    }
  }

  function productionPanel(b) {
    const g = G(), c = me();
    const st = c._st || IM.Game.countryStats(g, c);
    const used = c.lines.reduce((a, l) => a + l.fac, 0);
    const out = IM.Game.outputMult(g, c);
    b.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, `Military factories: ${used} / ${st.mil} assigned`), h('span', { class: 'small muted' }, `output ${UI.pct(out)}`)),
      used > st.mil ? h('div', { class: 'small warn' }, 'More factories assigned than available — lines run slower.') : null));
    const lines = h('div', { class: 'sec' }, h('h3', null, 'Production lines'));
    c.lines.forEach((l, i) => {
      const eq = IM.EQUIP[l.eq];
      const locked = eq.requires && !c.mods[eq.requires];
      const perDay = l.fac * IM.Game.FACTORY_IC * l.eff * out / eq.cost;
      lines.appendChild(h('div', { class: 'list-item' },
        h('div', { class: 'grow' }, h('b', null, IM.Game.eqName(g, l.eq)), h('div', { class: 'small muted' }, locked ? h('span', { class: 'bad' }, 'Technology missing') : `${perDay >= 10 ? Math.round(perDay) : perDay.toFixed(1)} / day · efficiency ${UI.pct(l.eff)}`)),
        h('button', { class: 'btn small', onclick: () => { l.fac = Math.max(0, l.fac - 1); if (!l.fac) c.lines.splice(i, 1); renderPanel(); } }, '−'),
        h('b', { class: 'num', style: { minWidth: '26px', textAlign: 'center' } }, String(l.fac)),
        h('button', { class: 'btn small', onclick: () => { l.fac++; renderPanel(); } }, '+')));
    });
    const add = h('select', null, IM.EQUIP_ORDER.filter(k => !c.lines.some(l => l.eq === k)).map(k => h('option', { value: k }, IM.Game.eqName(g, k) + (IM.EQUIP[k].requires && !c.mods[IM.EQUIP[k].requires] ? ' (locked)' : ''))));
    lines.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } }, add, h('button', { class: 'btn small', onclick: () => { if (!add.value) return; c.lines.push({ eq: add.value, fac: Math.max(1, st.mil - used), eff: 0.2, prog: 0 }); renderPanel(); } }, 'Add production line')));
    b.appendChild(lines);
    // stockpile vs needs
    const need = {};
    for (const d of g.divisions) if (d.owner === c.id) for (const [eq, amt] of Object.entries(IM.TEMPLATES[d.tpl].eq)) need[eq] = (need[eq] || 0) + amt * (1 - d.str);
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Stockpile'), h('table', { class: 't' },
      h('tr', null, h('th', null, 'Equipment'), h('th', null, 'Stockpile'), h('th', null, 'Reinforcement need'), h('th', null, 'Unit cost')),
      IM.EQUIP_ORDER.map(k => h('tr', null, h('td', null, IM.Game.eqName(g, k)), h('td', { class: 'num' }, UI.fmt(c.stock[k])), h('td', { class: 'num ' + ((need[k] || 0) > c.stock[k] ? 'bad' : 'muted') }, need[k] ? UI.fmt(need[k]) : '—'), h('td', { class: 'num muted' }, IM.EQUIP[k].cost))))));
  }

  function constructionPanel(b) {
    const g = G(), c = me();
    const st = c._st || IM.Game.countryStats(g, c);
    b.appendChild(h('div', { class: 'card' }, `Civilian factories free for construction: `, h('b', null, String(st.freeCiv)), h('span', { class: 'muted small' }, ` (each project uses up to 15)`)));
    const q = h('div', { class: 'sec' }, h('h3', null, `Queue (${c.cons.length})`));
    const cp = 5 * (1 + c.mods.construction);
    let civLeft = st.freeCiv;
    c.cons.forEach((p, i) => {
      const use = Math.min(15, Math.max(0, civLeft)); civLeft -= use;
      const s = g.W.states[p.state];
      const days = use ? Math.ceil((p.cost - p.prog) / (use * cp)) : '∞';
      const name = p.type === 'civ' ? 'Civilian factory' : p.type === 'mil' ? 'Military factory' : 'Fortifications';
      q.appendChild(h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', null, name), h('span', { class: 'muted' }, ` in ${s.name}`), h('div', { class: 'bar', style: { marginTop: '4px' } }, h('i', { style: { width: UI.pct(p.prog / p.cost) } }))),
        h('span', { class: 'small muted' }, `${days} d`),
        h('button', { class: 'btn small', title: 'Move up', disabled: i === 0, onclick: () => { c.cons.splice(i - 1, 0, c.cons.splice(i, 1)[0]); renderPanel(); } }, '↑'),
        h('button', { class: 'x', onclick: () => { c.cons.splice(i, 1); renderPanel(); } }, '×')));
    });
    if (!c.cons.length) q.appendChild(h('div', { class: 'muted small' }, 'Nothing under construction.'));
    b.appendChild(q);
    const states = g.W.states.filter(s => g.owner[s.id] === c.id && g.ctrl[s.cityHex] === c.id).sort((a, b2) => b2.pop - a.pop);
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Your states'), h('table', { class: 't' },
      h('tr', null, h('th', null, 'State'), h('th', null, 'Civ'), h('th', null, 'Mil'), h('th', null, 'Slots'), h('th', null, '')),
      states.slice(0, 80).map(s => {
        const free = g.slots[s.id] - g.civ[s.id] - g.mil[s.id] - c.cons.filter(p => p.state === s.id && p.type !== 'fort').length;
        const bt = (type, l) => h('button', { class: 'btn small', disabled: type !== 'fort' && free <= 0, onclick: () => { const e = IM.Game.queueBuild(g, c, type, s.id); if (e) P.toast({ text: e, kind: 'bad' }); renderPanel(); } }, l);
        return h('tr', null, h('td', { style: { cursor: 'pointer' }, onclick: () => { R.selectedState = s.id; R.centerOn(s.cityHex); renderSel(); } }, s.name), h('td', { class: 'num' }, g.civ[s.id]), h('td', { class: 'num' }, g.mil[s.id]), h('td', { class: 'num muted' }, `${free} free`),
          h('td', null, h('div', { class: 'row', style: { gap: '3px' } }, bt('civ', '+Civ'), bt('mil', '+Mil'), bt('fort', '+Fort'))));
      }))));
  }

  function recruitPanel(b) {
    const g = G(), c = me();
    const st = c._st || IM.Game.countryStats(g, c);
    b.appendChild(h('div', { class: 'card' }, `Available manpower: `, h('b', null, UI.fmt(st.mp)), h('span', { class: 'muted small' }, ` · new divisions deploy at ${g.W.states[c.capital].name}`)));
    if (IM.War.atWar(g, c.id)) {
      const cities = IM.Game.threatenedCities(g, c);
      b.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', null, 'Emergency militia'), h('div', { class: 'small muted' }, cities.length ? `Threatened undefended cities: ${cities.slice(0, 5).map(s => s.name).join(', ')}` : 'No undefended city is under immediate threat.')),
        h('button', { class: 'btn small', disabled: !cities.length || c.pp < IM.Game.MILITIA_PP, onclick: () => { const n = IM.Game.raiseMilitia(g, c, 3); if (n) { c.pp -= IM.Game.MILITIA_PP; P.toast({ text: `${n} militia unit(s) raised.`, kind: 'good' }); } else P.toast({ text: 'Not enough manpower or small arms.', kind: 'bad' }); renderPanel(); R.dirty = true; } }, `Raise (${IM.Game.MILITIA_PP} PP)`))));
    }
    const tpls = h('div', { class: 'sec' }, h('h3', null, 'Division templates'));
    for (const id of IM.TEMPLATE_ORDER) {
      const T = IM.TEMPLATES[id];
      const locked = T.requires && !c.mods[T.requires];
      const s = IM.War.stats(g, { owner: c.id, tpl: id });
      const eqTxt = Object.entries(T.eq).map(([k, v]) => `${UI.fmt(v)} ${IM.Game.eqName(g, k)}`).join(', ');
      const short = Object.entries(T.eq).filter(([k, v]) => c.stock[k] < v).map(([k]) => IM.Game.eqName(g, k));
      tpls.appendChild(h('div', { class: 'list-item' },
        h('div', { class: 'grow' }, h('b', null, IM.Game.tplName(g, id)), locked ? h('span', { class: 'bad small' }, ' (needs technology)') : null,
          h('div', { class: 'small muted' }, `ATK ${s.sa.toFixed(0)}/${s.ha.toFixed(0)} · DEF ${s.def.toFixed(0)} · BRK ${s.brk.toFixed(0)} · ORG ${s.org.toFixed(0)} · ${s.speed.toFixed(1)} km/h · armor ${UI.pct(s.hard)}`),
          h('div', { class: 'small muted' }, `${UI.fmt(T.mp)} men · ${eqTxt} · ${T.days} days`),
          short.length ? h('div', { class: 'small warn' }, `Short on: ${short.join(', ')}`) : null),
        h('button', { class: 'btn small', disabled: locked, onclick: () => { const e = IM.Game.recruit(g, c, id, 1); if (e) P.toast({ text: e, kind: 'bad' }); renderPanel(); P.refresh(true); } }, '+1'),
        h('button', { class: 'btn small', disabled: locked, onclick: () => { const e = IM.Game.recruit(g, c, id, 5); if (e) P.toast({ text: e, kind: 'bad' }); renderPanel(); P.refresh(true); } }, '+5')));
    }
    b.appendChild(tpls);
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, `Training (${c.recruit.length})`),
      c.recruit.length ? c.recruit.map((r, i) => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', null, IM.Game.tplName(g, r.tpl)), h('div', { class: 'bar', style: { marginTop: '4px' } }, h('i', { style: { width: UI.pct(1 - r.days / r.total) } })), r.waiting ? h('div', { class: 'small warn' }, 'Waiting for equipment') : null),
        h('span', { class: 'small muted' }, r.days ? `${r.days} d` : 'ready'), h('button', { class: 'x', onclick: () => { c.recruit.splice(i, 1); c.mpUsed -= IM.TEMPLATES[r.tpl].mp; renderPanel(); } }, '×'))) : h('div', { class: 'muted small' }, 'No divisions in training.')));
  }

  function armyPanel(b) {
    const g = G(), c = me();
    const mine = g.divisions.filter(d => d.owner === c.id);
    const byTpl = {};
    for (const d of mine) byTpl[d.tpl] = (byTpl[d.tpl] || 0) + 1;
    b.appendChild(h('div', { class: 'card' }, `${mine.length} divisions: `, Object.entries(byTpl).map(([t, n]) => `${n} ${IM.Game.tplName(g, t)}`).join(', ') || 'none'));
    const groups = {};
    for (const d of mine) { const s = g.W.states[g.W.stateOf[d.hex]]; const k = s ? s.name : 'At sea'; (groups[k] = groups[k] || []).push(d); }
    b.appendChild(h('div', { class: 'sec' }, h('h3', null, 'Deployments'), Object.entries(groups).sort((a, b2) => b2[1].length - a[1].length).map(([name, ds]) => h('div', { class: 'list-item click', onclick: () => { R.selected = new Set(ds.map(d => d.id)); R.selectedState = -1; R.centerOn(ds[0].hex); renderSel(); R.dirty = true; } },
      h('b', { class: 'grow' }, name), h('span', { class: 'small muted' }, `${ds.filter(d => d.battle >= 0).length ? '⚔ ' : ''}${ds.length} div · avg str ${UI.pct(ds.reduce((a, d) => a + d.str, 0) / ds.length)}`)))));
  }

  // ------------------------------------------------------------------ events & menu
  P.showEvent = function (pe) {
    const g = G(), ev = IM.Events.get(pe.id);
    const actor = IM.Game.byTag(g, ev.actor);
    const art = h('div', { class: 'event-art' }, h('div', null, h('div', { class: 'ea-date' }, IM.Game.fmtDate(g).toUpperCase()), h('div', { class: 'ea-title' }, ev.title)));
    if (pe.actor) {
      UI.modal(ev.title, h('div', null, ev.text), ev.options.map((o, i) => ({ label: o.label, primary: i === 0, fn: () => { IM.Events.resolve(g, ev.id, i); R.dirty = true; P.refresh(true); } })), art);
    } else {
      UI.modal(ev.title, h('div', null, h('div', { class: 'muted small', style: { marginBottom: '6px' } }, `News from ${actor ? actor.name : 'abroad'}`), ev.text, h('div', { style: { marginTop: '8px' } }, h('b', null, `${actor ? actor.name : ''} chose: ${ev.options[0].label}`))), [{ label: 'Noted', primary: true }], art);
    }
  };

  P.gameMenu = function () {
    const g = G();
    UI.paused = true; P.refresh(true);
    const bg = UI.modal('Game Menu', h('div', { class: 'menu', style: { width: '100%' } },
      h('button', { class: 'btn', onclick: () => { const e = IM.Save.store(g); P.toast({ text: e || 'Game saved.', kind: e ? 'bad' : 'good' }); bg.remove(); } }, 'Save game'),
      h('button', { class: 'btn', onclick: () => { bg.remove(); UI.showHelp(); } }, 'How to play'),
      h('button', { class: 'btn danger', onclick: () => { bg.remove(); if (hoverEl) hoverEl.remove(); UI.showMenu(); } }, 'Quit to main menu')),
      [{ label: 'Resume' }]);
  };
})();
