// Screens (menu, era and country selection), input handling and the game loop.
window.IM = window.IM || {};

(function () {
  const UI = IM.UI = {};
  const R = IM.Render;
  let root, canvas;
  UI.G = null;
  UI.screen = 'menu';
  UI.panel = null;
  UI.speed = 2;
  UI.paused = true;
  UI.nukeMode = false;

  // ------------------------------------------------------------------ tiny DOM helper
  const h = UI.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(3)) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  UI.fmt = function (n) {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(0) + 'k';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(Math.round(n));
  };
  UI.pct = v => Math.round(v * 100) + '%';
  UI.flag = (c, big) => h('div', { class: 'flag', 'data-tag': c.tag.slice(0, 3), style: { background: c.color, width: big ? '64px' : null, height: big ? '42px' : null } });

  // tooltips
  let tipEl = null;
  UI.tip = function (el, fn) {
    el.addEventListener('mouseenter', e => { tipEl = h('div', { class: 'tooltip', html: typeof fn === 'function' ? fn() : fn }); document.body.appendChild(tipEl); moveTip(e); });
    el.addEventListener('mousemove', moveTip);
    el.addEventListener('mouseleave', () => { if (tipEl) tipEl.remove(); tipEl = null; });
    return el;
  };
  function moveTip(e) { if (!tipEl) return; const x = Math.min(e.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8); tipEl.style.left = x + 'px'; tipEl.style.top = Math.min(e.clientY + 16, window.innerHeight - tipEl.offsetHeight - 8) + 'px'; }
  UI.clearTip = () => { if (tipEl) tipEl.remove(); tipEl = null; };

  // ------------------------------------------------------------------ boot
  UI.init = function () {
    root = document.getElementById('ui');
    canvas = document.getElementById('map');
    IM.world = IM.world || IM.buildWorld();
    R.init(canvas, IM.world);
    bindInput();
    UI.showMenu();
    requestAnimationFrame(loop);
  };

  function clear() { UI.clearTip(); root.innerHTML = ''; R.showUnits = false; R.dirty = true; }

  // A backdrop game (no player) so the menu has a live world map behind it.
  function backdrop(eraId) {
    if (!UI.G || UI.G.eraId !== eraId || UI.G.player !== null) UI.G = IM.Game.create(eraId, null);
    R.mode = 'political';
    R.selected.clear(); R.selectedState = -1;
    R.dirty = true;
  }

  UI.showMenu = function () {
    UI.screen = 'menu'; UI.paused = true;
    backdrop('1939');
    R.centerOn(R.hexAtIndex ? 0 : IM.world.hexAt(20, 45), canvas.clientHeight / R.worldH * 2.2);
    clear();
    const saves = IM.Save.list();
    root.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'title' }, 'IRON MERIDIAN'),
      h('div', { class: 'subtitle' }, 'Grand strategy across eight eras · 1939 – 2026'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: UI.showEras }, 'New Campaign'),
        h('button', { class: 'btn', disabled: !saves.length, onclick: UI.showLoad }, 'Load Game'),
        h('button', { class: 'btn', onclick: () => UI.showHelp(UI.showMenu) }, 'How to Play'),
      ),
      h('div', { class: 'menu-foot' }, 'Map data: Natural Earth. Iron Meridian is an independent fan-made strategy game inspired by the grand strategy genre.'),
    ));
  };

  UI.showEras = function () {
    UI.screen = 'eras';
    clear();
    root.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'screen-head' }, h('h2', null, 'Choose Your Era'), h('div', { class: 'muted' }, 'Each era starts on a real date with the borders, alliances and wars of its time.')),
      h('div', { class: 'era-grid' }, IM.ERAS.map(e => h('div', { class: 'era-card', onclick: () => UI.showPick(e.id) },
        h('div', { class: 'tag' }, e.modern ? 'Modern' : 'World War II'),
        h('div', { class: 'year' }, e.id),
        h('div', { class: 'etitle' }, e.title),
        h('div', { class: 'blurb' }, e.blurb)))),
      h('div', { style: { marginTop: '18px' } }, h('button', { class: 'btn', onclick: UI.showMenu }, '‹ Back')),
    ));
  };

  UI.pickTag = null;
  UI.showPick = function (eraId) {
    UI.screen = 'pick';
    backdrop(eraId);
    const G = UI.G;
    const era = G.era;
    const majors = G.countries.filter(c => c.alive && (era.countries[c.tag] && (era.countries[c.tag].div || 0) >= 8)).sort((a, b) => (b.divTarget || 0) - (a.divTarget || 0));
    if (!UI.pickTag || !IM.Game.byTag(G, UI.pickTag) || !IM.Game.byTag(G, UI.pickTag).alive) UI.pickTag = majors[0].tag;
    R.centerOn(G.W.states[IM.Game.byTag(G, UI.pickTag).capital].cityHex, Math.max(1.4, canvas.clientHeight / R.worldH * 3));
    let aiMode = 'historical';
    const render = () => {
      clear();
      const c = IM.Game.byTag(G, UI.pickTag);
      R.selectedState = -1;
      const st = IM.Game.countryStats(G, c);
      const divs = G.divisions.filter(d => d.owner === c.id).length;
      const wars = G.wars.filter(w => w.att.includes(c.id) || w.def.includes(c.id));
      root.appendChild(h('div', { class: 'pick-hint' }, `${era.id} · ${era.title} — click any nation on the map, or pick a major power`));
      root.appendChild(h('div', { class: 'pick-panel' },
        h('div', { class: 'ph' },
          h('div', { class: 'row' }, UI.flag(c, true), h('div', null, h('h2', { style: { fontSize: '19px' } }, c.name), h('div', { class: 'muted small' }, IM.Game.ideoName(G, c.ideo), ' · ', c.leader)))),
        h('div', { class: 'pb' },
          h('div', { class: 'muted small' }, 'MAJOR POWERS'),
          h('div', { class: 'majors' }, majors.slice(0, 16).map(m => h('span', { class: 'chip' + (m.tag === c.tag ? ' on' : ''), onclick: () => { UI.pickTag = m.tag; R.centerOn(G.W.states[m.capital].cityHex); render(); } }, h('i', { class: 'swatch', style: { background: m.color } }), m.name.length > 18 ? m.tag : m.name))),
          h('div', { class: 'kv' },
            h('span', null, 'Faction'), h('span', null, c.faction >= 0 ? G.factions[c.faction].name : '—'),
            h('span', null, 'Factories'), h('span', null, `${st.civ} civilian · ${st.mil} military`),
            h('span', null, 'Divisions'), h('span', null, String(divs)),
            h('span', null, 'Manpower'), h('span', null, UI.fmt(st.mp)),
            h('span', null, 'Aircraft / Navy'), h('span', null, `${UI.fmt(c.stock.air)} / ${UI.fmt(c.stock.nav)}`),
            c.stock.nuk ? h('span', null, 'Nuclear warheads') : null, c.stock.nuk ? h('span', { class: 'warn' }, String(c.stock.nuk)) : null,
            h('span', null, 'Tech level'), h('span', null, String(c.techYear)),
            h('span', null, 'At war'), h('span', { class: wars.length ? 'bad' : '' }, wars.length ? wars.map(w => w.name).join(', ') : 'No'),
          ),
          h('div', { class: 'sec', style: { marginTop: '14px' } }, h('div', { class: 'muted small' }, era.blurb)),
          h('div', { class: 'row small', style: { marginTop: '6px' } }, h('span', { class: 'muted' }, 'AI behaviour'),
            h('select', { onchange: e => { aiMode = e.target.value; } }, h('option', { value: 'historical' }, 'Historical'), h('option', { value: 'unpredictable' }, 'Unpredictable (AI starts wars)'))),
        ),
        h('div', { class: 'pf' },
          h('button', { class: 'btn', onclick: UI.showEras }, '‹ Eras'),
          h('button', { class: 'btn primary grow', onclick: () => UI.startGame(eraId, UI.pickTag, aiMode) }, `Play as ${c.tag}`)),
      ));
    };
    UI._pickRender = render;
    render();
  };

  UI.startGame = function (eraId, tag, aiMode) {
    UI.G = IM.Game.create(eraId, tag);
    UI.G.aiMode = aiMode || 'historical';
    enterGame();
  };
  function enterGame() {
    const G = UI.G;
    UI.screen = 'game'; UI.paused = true; UI.panel = null;
    R.selected.clear(); R.selectedState = -1;
    const c = G.countries[G.player];
    R.centerOn(G.W.states[c.capital].cityHex, 2.2);
    IM.Panels.buildHUD();
    R.showUnits = true;
    IM.Game.news(G, `You lead ${c.name}. The game is paused — press Space to begin.`, 'major');
    setTimeout(() => IM.Panels.toast({ text: 'Tip: select divisions and right-click to move. Army → "Delegate all" hands your fronts to an AI general.', kind: 'info' }), 400);
  }

  UI.showLoad = function () {
    clear();
    const list = IM.Save.list();
    root.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'screen-head' }, h('h2', null, 'Load Game')),
      h('div', { style: { width: 'min(520px, 92vw)' } }, list.map(e => h('div', { class: 'list-item click', onclick: () => {
        const G = IM.Save.load(e.name);
        if (!G) { UI.modal('Load failed', h('div', null, 'This save could not be read. It may come from an older version of the game.'), [{ label: 'OK', primary: true }]); return; }
        UI.G = G; enterGame();
      } }, h('div', { class: 'grow' }, h('b', null, e.name), h('div', { class: 'muted small' }, `${e.era} era · ${e.date}`)),
      h('button', { class: 'btn small danger', onclick: ev => { ev.stopPropagation(); IM.Save.remove(e.name); UI.showLoad(); } }, 'Delete')))),
      h('div', { style: { marginTop: '16px' } }, h('button', { class: 'btn', onclick: UI.showMenu }, '‹ Back')),
    ));
  };

  UI.showHelp = function (back) {
    const body = h('div', { class: 'help' },
      h('p', null, 'Iron Meridian is a real-time-with-pause grand strategy game. Pick an era and a nation, then build your economy, research technology and command your divisions on a hex map of the whole world.'),
      h('h3', { class: 'gold' }, 'Controls'),
      h('ul', null,
        h('li', null, h('kbd', null, 'Space'), ' pause / resume · ', h('kbd', null, '1'), '–', h('kbd', null, '5'), ' game speed · ', h('kbd', null, '+'), h('kbd', null, '-'), ' speed up / down'),
        h('li', null, 'Drag or ', h('kbd', null, 'W A S D'), ' / arrow keys to pan, mouse wheel to zoom'),
        h('li', null, 'Left-click your units to select them, ', h('kbd', null, 'Shift'), '-drag to box-select, ', h('kbd', null, 'Ctrl'), '+click to select all your divisions on screen'),
        h('li', null, 'Right-click a hex to move selected divisions there. Moving into enemy divisions starts a battle.'),
        h('li', null, 'Left-click land to inspect a state: build factories and forts there, or open diplomacy with its owner'),
        h('li', null, h('kbd', null, 'F'), ' focus · ', h('kbd', null, 'R'), ' research · ', h('kbd', null, 'P'), ' politics · ', h('kbd', null, 'E'), ' diplomacy · ', h('kbd', null, 'Q'), ' production · ', h('kbd', null, 'B'), ' construction · ', h('kbd', null, 'T'), ' recruit · ', h('kbd', null, 'G'), ' army · ', h('kbd', null, 'Esc'), ' close / deselect'),
      ),
      h('h3', { class: 'gold' }, 'How war works'),
      h('ul', null,
        h('li', null, 'Divisions have ', h('b', null, 'organisation'), ' (green bar) and ', h('b', null, 'strength'), ' (yellow bar). Battles drain organisation; the side that runs out retreats. Units with nowhere to retreat are destroyed.'),
        h('li', null, 'Attack with soft/hard attack against the enemy\'s defence; attackers defend with breakthrough. Armour is hard to hurt without anti-tank weapons. Terrain, forts, entrenchment, air superiority and drones all matter.'),
        h('li', null, 'Supply flows from your victory-point cities through friendly land. Encircled divisions (red dot) lose organisation and wither.'),
        h('li', null, 'Take enough victory points — especially the capital — and a nation capitulates. When a war ends, winners annex the enemy states they occupy.'),
        h('li', null, 'Select divisions and press ', h('b', null, 'Delegate to AI general'), ' to let the AI manage that front for you.'),
      ),
      h('h3', { class: 'gold' }, 'Iron Meridian features'),
      h('ul', null,
        h('li', null, h('b', null, 'Eight eras'), ': 1939, 1941, 1945, 1991, 2000, 2021, 2022 and 2026 with historical events that fire on their dates.'),
        h('li', null, h('b', null, 'Economic sanctions'), ' cut a rival\'s factory output.'),
        h('li', null, h('b', null, 'Cyber operations'), ' (modern tech) cripple enemy research and coordination.'),
        h('li', null, h('b', null, 'Drone warfare'), ' — produce drones to boost your divisions\' combat power.'),
        h('li', null, h('b', null, 'Nuclear weapons'), ' — research the bomb, build warheads, strike enemy territory... and face retaliation.'),
        h('li', null, h('b', null, 'Negotiated peace'), ' — offer white peace or demand concessions instead of fighting to the bitter end.'),
        h('li', null, h('b', null, 'Lend-lease'), ' — arm your friends without joining their war.'),
      ),
    );
    UI.modal('How to Play', body, [{ label: 'Close', primary: true, fn: () => { if (back) back(); } }]);
  };

  UI.modal = function (title, body, buttons, art) {
    const bg = h('div', { class: 'modal-bg' });
    const close = () => bg.remove();
    bg.appendChild(h('div', { class: 'modal', style: { width: title === 'How to Play' ? 'min(780px, 94vw)' : null } },
      h('div', { class: 'mh' }, h('h2', null, title)),
      h('div', { class: 'mb', style: { maxHeight: '64vh', overflowY: 'auto' } }, art ? (art instanceof Node ? art : h('div', { class: 'event-art' }, art)) : null, body),
      h('div', { class: 'mf' }, buttons.map(b => h('button', { class: 'btn' + (b.primary ? ' primary' : ''), onclick: () => { close(); b.fn && b.fn(); } }, b.label)))));
    root.appendChild(bg);
    return bg;
  };

  UI.onNews = function (G, n) { if (UI.screen === 'game' && IM.Panels) IM.Panels.toast(n); };
  UI.onWarEnded = function (G, w, result) {
    const title = result === 'won' ? 'Victory!' : result === 'lost' ? 'Defeat' : 'Peace';
    const text = result === 'won' ? `The ${w.name} is over and we stand victorious. Occupied enemy states have been annexed at the peace conference.`
      : result === 'lost' ? `The ${w.name} has ended in defeat. The victors have carved up the territory they occupy.`
      : `A white peace ends the ${w.name}. Borders return to where they stood before the war.`;
    UI.paused = true;
    setTimeout(() => UI.modal(title, UI.h('div', null, text), [{ label: 'Continue', primary: true }]), 30);
  };
  UI.onPlayerCapitulated = function (G) {
    UI.paused = true;
    setTimeout(() => UI.modal('Capitulation', UI.h('div', null, `${G.countries[G.player].name} has capitulated. Our government fights on in exile — if our allies win the war, our lands will be restored.`),
      [{ label: 'Continue in exile', primary: true }, { label: 'Main menu', fn: UI.showMenu }]), 30);
  };
  UI.onPlayerDefeated = function (G) {
    UI.paused = true;
    setTimeout(() => UI.modal('Defeat', h('div', null, `${G.countries[G.player].name} has been wiped from the map. You may continue watching the world, or return to the menu.`),
      [{ label: 'Keep watching', fn: () => {} }, { label: 'Main menu', primary: true, fn: UI.showMenu }]), 50);
  };

  // ------------------------------------------------------------------ loop
  const RATES = [0, 2, 6, 14, 30, 72]; // game hours per real second
  let last = performance.now(), carry = 0, lastUI = 0, lastDraw = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const G = UI.G;
    let ticked = false;
    if (G && UI.screen === 'game' && !UI.paused) {
      carry += RATES[UI.speed] * dt;
      let n = Math.min(Math.floor(carry), 96);
      carry -= Math.floor(carry);
      const t0 = performance.now();
      while (n-- > 0) {
        IM.Game.tick(G);
        ticked = true;
        if (G.pendingEvents.length) { UI.paused = true; IM.Panels.showEvent(G.pendingEvents.shift()); break; }
        if (performance.now() - t0 > 40) { carry = 0; break; }
      }
    }
    if (ticked) R.dirty = true;
    if (R.dirty && now - lastDraw > 30) { R.draw(G); R.dirty = false; lastDraw = now; }
    if (UI.screen === 'game' && now - lastUI > 250) { IM.Panels.refresh(); lastUI = now; }
    requestAnimationFrame(loop);
  }

  UI.togglePause = function () { if (UI.screen !== 'game') return; UI.paused = !UI.paused; IM.Panels.refresh(true); };
  UI.setSpeed = function (s) { UI.speed = Math.max(1, Math.min(5, s)); IM.Panels.refresh(true); };

  // ------------------------------------------------------------------ input
  function bindInput() {
    let down = null, panning = false;
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => {
      const [x, y] = pos(e);
      down = { x, y, cx: R.cam.x, cy: R.cam.y, btn: e.button, shift: e.shiftKey, moved: false };
      if (e.button === 0 && e.shiftKey && UI.screen === 'game') R.boxSel = { x0: x, y0: y, x1: x, y1: y };
    });
    window.addEventListener('mousemove', e => {
      const [x, y] = pos(e);
      if (down) {
        if (Math.abs(x - down.x) + Math.abs(y - down.y) > 4) down.moved = true;
        if (R.boxSel) { R.boxSel.x1 = x; R.boxSel.y1 = y; R.dirty = true; return; }
        if (down.moved && (down.btn === 0 || down.btn === 1 || down.btn === 2)) {
          panning = true;
          R.cam.x = down.cx - (x - down.x) / R.cam.z; R.cam.y = down.cy - (y - down.y) / R.cam.z;
          R.clampCam(); R.dirty = true;
        }
      } else if (e.target === canvas) {
        const hx = R.hexAtScreen(x, y);
        if (hx !== R.hoverHex) { R.hoverHex = hx; R.dirty = true; if (IM.Panels && UI.screen === 'game') IM.Panels.hover(hx, e); }
      }
    });
    window.addEventListener('mouseup', e => {
      if (!down) return;
      const [x, y] = pos(e);
      const d = down; down = null;
      if (R.boxSel) { finishBox(e); R.boxSel = null; R.dirty = true; return; }
      if (panning) { panning = false; if (d.moved) return; }
      if (e.target !== canvas) return;
      const hex = R.hexAtScreen(x, y);
      if (d.btn === 0) onLeftClick(hex, e);
      else if (d.btn === 2) onRightClick(hex, e);
    });
    canvas.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e); R.zoomAt(x, y, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
    // touch: one finger pans / taps, two fingers pinch
    let touch = null;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, t: performance.now() }; }
      else if (e.touches.length === 2) { const [a, b] = e.touches; touch = { pinch: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: R.cam.z, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 }; }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (!touch) return;
      if (touch.pinch && e.touches.length === 2) {
        const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const f = (touch.z * d / touch.pinch) / R.cam.z; R.zoomAt(touch.mx, touch.my, f);
      } else if (!touch.pinch && e.touches.length === 1) {
        const t = e.touches[0];
        if (Math.abs(t.clientX - touch.x) + Math.abs(t.clientY - touch.y) > 8) touch.moved = true;
        R.cam.x = touch.cx - (t.clientX - touch.x) / R.cam.z; R.cam.y = touch.cy - (t.clientY - touch.y) / R.cam.z; R.clampCam(); R.dirty = true;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      if (touch && !touch.pinch && !touch.moved) {
        const hex = R.hexAtScreen(touch.x, touch.y);
        const long = performance.now() - touch.t > 450;
        if (long && R.selected.size) onRightClick(hex, {}); else onLeftClick(hex, {});
      }
      if (e.touches.length === 0) touch = null;
    });
    window.addEventListener('keydown', onKey);
    // keyboard panning
    const held = new Set();
    window.addEventListener('keydown', e => { if (!e.target.matches('input,select,textarea')) held.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => held.clear());
    setInterval(() => {
      if (!held.size || UI.screen === 'menu') return;
      const s = 14 / R.cam.z;
      if (held.has('w') || held.has('arrowup')) R.cam.y -= s;
      if (held.has('s') || held.has('arrowdown')) R.cam.y += s;
      if (held.has('a') || held.has('arrowleft')) R.cam.x -= s;
      if (held.has('d') && !held.has('control') || held.has('arrowright')) R.cam.x += s;
      R.clampCam(); R.dirty = true;
    }, 16);
  }

  function onKey(e) {
    if (e.target.matches && e.target.matches('input,select,textarea')) return;
    if (UI.screen !== 'game') { if (e.key === 'Escape' && UI.screen !== 'menu') UI.showMenu(); return; }
    const k = e.key.toLowerCase();
    if (e.key === ' ') { e.preventDefault(); UI.togglePause(); }
    else if (k >= '1' && k <= '5') UI.setSpeed(+k);
    else if (k === '+' || k === '=') UI.setSpeed(UI.speed + 1);
    else if (k === '-') UI.setSpeed(UI.speed - 1);
    else if (e.key === 'Escape') { if (UI.nukeMode) { UI.nukeMode = false; canvas.style.cursor = ''; } else if (UI.panel) IM.Panels.open(null); else { R.selected.clear(); R.selectedState = -1; IM.Panels.selectionChanged(); } R.dirty = true; }
    else if (k === 'f') IM.Panels.open('focus');
    else if (k === 'r') IM.Panels.open('research');
    else if (k === 'p') IM.Panels.open('politics');
    else if (k === 'q') IM.Panels.open('production');
    else if (k === 'b') IM.Panels.open('construction');
    else if (k === 't') IM.Panels.open('recruit');
    else if (k === 'g') IM.Panels.open('army');
    else if (k === 'e' ) IM.Panels.open('diplomacy');
    else if (k === 'delete' || k === 'backspace') { const G = UI.G; IM.War.stop(G, G.divisions.filter(d => R.selected.has(d.id))); R.dirty = true; }
  }

  function playerDivsAt(hex) {
    const G = UI.G; if (!G) return [];
    return G.divisions.filter(d => d.hex === hex && d.owner === G.player);
  }

  function onLeftClick(hex, e) {
    const G = UI.G;
    if (UI.screen === 'pick') {
      if (hex < 0 || !G.W.region[hex]) return;
      const c = G.countries[G.owner[G.W.stateOf[hex]]];
      if (c && c.alive) { UI.pickTag = c.tag; UI._pickRender(); }
      return;
    }
    if (UI.screen !== 'game' || hex < 0) return;
    if (UI.nukeMode) {
      const me = G.countries[G.player];
      const err = IM.Diplo.nuke(G, me, hex);
      if (err) IM.Panels.toast({ text: err, kind: 'bad' });
      UI.nukeMode = false; canvas.style.cursor = ''; R.dirty = true; IM.Panels.refresh(true);
      return;
    }
    const mine = playerDivsAt(hex);
    if (e.ctrlKey || e.metaKey) {
      // select all own divisions currently on screen
      const vw = canvas.clientWidth, vh = canvas.clientHeight;
      if (!e.shiftKey) R.selected.clear();
      for (const d of G.divisions) {
        if (d.owner !== G.player) continue;
        const [sx, sy] = R.worldToScreen(R.cx[d.hex], R.cy[d.hex]);
        if (sx >= 0 && sy >= 0 && sx <= vw && sy <= vh) R.selected.add(d.id);
      }
      R.selectedState = -1;
    } else if (mine.length) {
      if (!e.shiftKey) R.selected.clear();
      for (const d of mine) R.selected.add(d.id);
      R.selectedState = -1;
    } else {
      R.selected.clear();
      R.selectedState = G.W.region[hex] ? G.W.stateOf[hex] : -1;
    }
    IM.Panels.selectionChanged();
    R.dirty = true;
  }

  function onRightClick(hex, e) {
    const G = UI.G;
    if (UI.screen !== 'game' || hex < 0 || !R.selected.size) return;
    const divs = G.divisions.filter(d => R.selected.has(d.id));
    for (const d of divs) d.auto = false;
    const n = IM.War.orderMove(G, divs, hex);
    if (!n) IM.Panels.toast({ text: 'No route: that territory is neutral, or you lack the naval capacity to get there.', kind: 'bad' });
    R.dirty = true;
    IM.Panels.selectionChanged();
  }

  function finishBox(e) {
    const G = UI.G, b = R.boxSel;
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    R.selected.clear();
    for (const d of G.divisions) {
      if (d.owner !== G.player) continue;
      let [sx, sy] = R.worldToScreen(R.cx[d.hex], R.cy[d.hex]);
      if (sx < x0) { const alt = R.worldToScreen(R.cx[d.hex] + R.worldW, 0)[0]; if (alt >= x0 && alt <= x1) sx = alt; }
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) R.selected.add(d.id);
    }
    R.selectedState = -1;
    IM.Panels.selectionChanged();
  }
})();
