// Guided first mission: defend Kyiv in February 2022.
// A coach card walks the player through the controls one step at a time,
// then the mission runs until 1 April 2022 (win) or the fall of Kyiv (loss).
window.IM = window.IM || {};

(function () {
  const T = IM.Tutorial = {};
  const h = (...a) => IM.UI.h(...a);
  const R = IM.Render;
  const END = Date.UTC(2022, 3, 1);
  let card = null, glowEl = null, stepStart = null, objEl = null;

  const kyiv = G => G.W.stateByName.Kyiv.cityHex;
  const me = G => G.countries[G.player];
  const mine = G => G.divisions.filter(d => d.owner === G.player && !d.dead);
  const touch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const STEPS = [
    {
      title: 'Kyiv, 24 February 2022',
      text: () => 'Russian columns are driving on Kyiv from Belarus, along both banks of the Dnipro. Your mission: hold the capital until 1 April 2022. This short briefing shows you how to command your army.',
      next: 'Begin',
    },
    {
      title: 'Look around',
      text: () => touch() ? 'Drag with one finger to move the map, and pinch to zoom. Kyiv is marked with a gold ring.' : 'Drag the map (or use W A S D) and use the mouse wheel to zoom. Kyiv is marked with a gold ring.',
      mark: true,
      done: (G, s) => Math.abs(R.cam.x - s.cx) + Math.abs(R.cam.y - s.cy) > 40 || Math.abs(R.cam.z / s.cz - 1) > 0.15,
      next: 'Skip',
    },
    {
      title: 'Select your troops',
      text: () => touch() ? 'Tap one of your division counters: the ones with the Ukrainian flag. The number is how many divisions are in the stack.' : 'Click one of your division counters: the ones with the Ukrainian flag. The number is how many divisions are in the stack. Shift-drag a box to select several stacks.',
      done: () => R.selected.size > 0,
    },
    {
      title: 'Give an order',
      text: () => touch() ? 'Now long-press on Kyiv, or tap Move and then tap Kyiv. A green line shows the route your troops will take.' : 'Now right-click on Kyiv. A green line shows the route your troops will take. Right-click an enemy counter to attack it.',
      mark: true,
      done: (G, s) => (IM.UI.orders || 0) > s.orders,
    },
    {
      title: 'Start the clock',
      text: () => 'The game is paused. Press Space, or the ▶ button at the top right, to let time run. Keys 1–5 set the speed; pause whenever you need to think.',
      glow: '.clock .pausebtn',
      done: () => !IM.UI.paused,
    },
    {
      title: 'Battles',
      text: () => 'Crossed swords on the map are battles. Under each counter, the green bar is organisation and the yellow bar is strength. A unit whose organisation runs out retreats; one with nowhere to go is destroyed. Keep your lines unbroken.',
      done: (G, s) => G.hour - s.hour > 36,
      next: 'Got it',
    },
    {
      title: 'Raise more divisions',
      text: () => 'Open Recruit (the ⚑ button, or T) and train a new division. Territorial defence brigades are cheap; mechanised brigades hit harder but need equipment.',
      glow: '.sidebtn[title^="Recruit"]',
      done: (G, s) => me(G).recruit.length > s.recruit,
      next: 'Skip',
    },
    {
      title: 'Feed the front',
      text: () => 'Open Production (⚙, or Q). Factories turn out the rifles, artillery and drones your divisions consume. Idle factories should always be working on something.',
      glow: '.sidebtn[title^="Produce"]',
      done: () => IM.UI.panel === 'production',
      next: 'Skip',
    },
    {
      title: 'Supply',
      text: () => 'Pick the Supply map mode at the bottom of the screen. Troops far from a supply hub fight worse, and red land means cut off. Encirclement kills more divisions than battle does.',
      glow: '.mapmodes .btn:last-child',
      done: () => R.mode === 'supply',
      next: 'Skip',
    },
    {
      title: 'Hand over a front',
      text: () => 'Too many counters to manage? The Army panel (⚔, or G) can hand every division to an AI general with "Delegate all". You can take any of them back by giving them an order.',
      glow: '.sidebtn[title^="Army"]',
      next: 'Got it',
    },
    {
      title: 'Hold Kyiv',
      text: () => 'That is everything you need. Hold Kyiv until 1 April 2022. The objective bar at the top shows how long is left. Good luck.',
      next: 'To the front',
    },
  ];

  // ------------------------------------------------------------------ lifecycle
  T.start = function () {
    IM.UI.startGame('2022', 'UKR', 'historical');
    const G = IM.UI.G;
    G.flags = G.flags || {};
    G.flags.tutorial = { step: 0 };
    // a fairer fight for a first game: the northern Russian axis is worn down
    const k = kyiv(G), rus = G.tagId.RUS, blr = G.tagId.BLR;
    for (const d of G.divisions) if ((d.owner === rus || d.owner === blr) && G.W.hexDist(d.hex, k) <= 10) { d.org *= 0.6; d.str *= 0.8; }
    const u = me(G);
    ['1st', '2nd', '3rd'].forEach(n => { const d = IM.War.spawnDivision(G, u, 'gar', k, 1); d.name = `${n} Kyiv Territorial Defence`; d.entrench = 0.5; });
    // the city and its approaches are dug in
    for (const h of G.W.stateByName.Kyiv.hexes) G.fort[h] = Math.max(G.fort[h], G.W.hexDist(h, k) <= 1 ? 3 : 2);
    T.attach(G);
  };

  T.attach = function (G) {
    T.detach();
    if (!G || !G.flags || !G.flags.tutorial) return;
    R.marks = [{ hex: kyiv(G), label: 'Kyiv' }];
    objEl = h('div', { class: 'tut-obj' });
    document.getElementById('ui').appendChild(objEl);
  };
  T.detach = function () {
    if (card) card.remove(); card = null;
    if (objEl) objEl.remove(); objEl = null;
    if (glowEl) glowEl.classList.remove('tut-glow'); glowEl = null;
    R.marks = null; stepStart = null;
  };
  T.active = () => !!objEl;

  // called every frame from the game loop
  T.update = function (G) {
    const tut = G && G.flags && G.flags.tutorial;
    if (!tut || !objEl) return;
    const now = IM.Game.dateOf(G).getTime();
    const days = Math.max(0, Math.ceil((END - now) / 864e5));
    const held = G.ctrl[kyiv(G)] === G.player;
    objEl.innerHTML = '';
    objEl.appendChild(h('span', { class: 'lbl' }, 'Objective'));
    objEl.appendChild(h('b', null, 'Hold Kyiv'));
    objEl.appendChild(h('span', { class: held ? 'ok' : 'bad' }, tut.result ? (tut.result === 'won' ? 'Achieved' : 'Failed') : `${days} day${days === 1 ? '' : 's'} left`));
    if (!tut.result && !held) return finish(G, 'lost');
    if (!tut.result && now >= END) return finish(G, 'won');
    if (tut.step >= STEPS.length || IM.News.busy() || document.querySelector('.modal-bg')) { if (card && tut.step >= STEPS.length) { card.remove(); card = null; } return; }
    const st = STEPS[tut.step];
    if (!card || card.dataset.step !== String(tut.step)) show(G, tut.step);
    // on small screens the card shrinks to its title while a panel is open
    card.classList.toggle('mini', (window.innerWidth < 760 || window.innerHeight < 480) && !!IM.UI.panel);
    if (st.done && st.done(G, stepStart)) advance(G);
  };

  function show(G, i) {
    const st = STEPS[i];
    if (card) card.remove();
    if (glowEl) glowEl.classList.remove('tut-glow');
    glowEl = st.glow ? document.querySelector(st.glow) : null;
    if (glowEl) glowEl.classList.add('tut-glow');
    stepStart = { cx: R.cam.x, cy: R.cam.y, cz: R.cam.z, hour: G.hour, recruit: me(G).recruit.length, orders: IM.UI.orders || 0 };
    R.marks = [{ hex: kyiv(G), label: 'Kyiv', pulse: !!st.mark }];
    const buttons = [];
    if (st.next) buttons.push(h('button', { class: 'btn small primary', onclick: () => advance(G) }, st.next));
    buttons.push(h('button', { class: 'btn small', onclick: () => { G.flags.tutorial.step = STEPS.length; card.remove(); card = null; if (glowEl) glowEl.classList.remove('tut-glow'); } }, 'End briefing'));
    card = h('div', { class: 'coach', role: 'dialog', 'aria-label': 'Tutorial', 'data-step': String(i) },
      h('div', { class: 'coach-n' }, `Briefing ${i + 1} / ${STEPS.length}`),
      h('h3', null, st.title),
      h('p', null, st.text()),
      st.done && !st.next ? h('div', { class: 'coach-wait' }, h('i'), 'Waiting for you…') : null,
      h('div', { class: 'coach-b' }, buttons));
    document.getElementById('ui').appendChild(card);
  }
  function advance(G) {
    const tut = G.flags.tutorial;
    tut.step++;
    if (card) { card.classList.add('done'); }
    if (glowEl) glowEl.classList.remove('tut-glow'); glowEl = null;
    if (tut.step >= STEPS.length && card) { card.remove(); card = null; R.marks = [{ hex: kyiv(G), label: 'Kyiv' }]; }
    R.dirty = true;
  }

  function finish(G, result) {
    const tut = G.flags.tutorial;
    tut.result = result;
    IM.UI.paused = true;
    if (card) { card.remove(); card = null; }
    const won = result === 'won';
    IM.UI.modal(won ? 'Kyiv Holds' : 'Kyiv Has Fallen', h('div', null,
      h('p', null, won ? 'It is 1 April 2022. Battered and short of fuel, the Russian columns north of the capital are pulling back toward Belarus. Kyiv has held.'
        : 'Russian troops have entered Kyiv. The government fights on from the west, but the war has taken a darker turn.'),
      h('p', { class: 'muted' }, won ? 'In our history, Russian forces withdrew from the Kyiv, Chernihiv and Sumy regions at the end of March 2022.'
        : 'Tip: keep a continuous line north of the city, pull encircled units back early, and use the Army panel\'s AI general if the front gets too busy.'),
    ), won ? [{ label: 'Keep playing', primary: true }, { label: 'Main menu', fn: IM.UI.showMenu }]
      : [{ label: 'Try again', primary: true, fn: T.start }, { label: 'Keep playing' }, { label: 'Main menu', fn: IM.UI.showMenu }]);
  }
})();
