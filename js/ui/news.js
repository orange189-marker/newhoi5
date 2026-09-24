// News panel (half the screen) and full-screen super events, with
// procedurally drawn artwork and a little synthesized sound.
window.IM = window.IM || {};

(function () {
  const N = IM.News = {};
  const h = (...a) => IM.UI.h(...a);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ironMeridian.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ironMeridian.' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  N.pref = store.get('newsPref', 'all');       // all | major | off
  N.muted = store.get('muted', '0') === '1';
  N.queue = [];
  let newsEl = null, superEl = null, anim = null;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ queue
  N.reset = function () { N.queue = []; closeNews(); closeSuper(true); };
  N.pump = function (G) {
    if (G.headlines && G.headlines.length) {
      for (const it of G.headlines.splice(0)) {
        if (it.type === 'news' && (N.pref === 'off' || (N.pref === 'major' && !it.major))) continue;
        N.queue.push(it);
      }
      if (newsEl) updateMore();
    }
    if (superEl) return;
    const si = N.queue.findIndex(x => x.type === 'super');
    if (si >= 0) { showSuper(G, N.queue.splice(si, 1)[0]); return; }
    if (!newsEl && N.queue.length) showNews(G, N.queue.shift());
  };
  N.busy = () => !!superEl;

  const dateText = (G, it) => {
    const d = new Date(G.startMs + (it.hour ?? G.hour) * 3600e3);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  const tagC = (G, t) => IM.Game.byTag(G, t) || { tag: t, name: IM.COUNTRY_NAMES[t] || t, color: IM.COUNTRY_COLORS[t] || '#777', flag: t };
  const flagOf = (G, t) => { const c = tagC(G, t); return IM.UI.flag(c, 'md'); };

  // ------------------------------------------------------------------ news panel
  function showNews(G, it) {
    const ww2 = !G.modern;
    const root = document.getElementById('ui');
    const art = h('canvas', { class: 'np-art', width: 880, height: 420 });
    const more = h('span', { class: 'np-more' });
    const pref = h('select', { id: 'news-pref', title: 'Which stories open the news panel', onchange: e => { N.pref = e.target.value; store.set('newsPref', N.pref); } },
      h('option', { value: 'all', selected: N.pref === 'all' }, 'All news'), h('option', { value: 'major', selected: N.pref === 'major' }, 'Major news only'), h('option', { value: 'off', selected: N.pref === 'off' }, 'News off'));
    const flags = (it.tags || []).filter(Boolean).slice(0, 4).map(t => flagOf(G, t));
    newsEl = h('aside', { class: 'newsp ' + (ww2 ? 'ww2' : 'modern'), role: 'dialog', 'aria-label': 'News' },
      ww2 ? h('header', { class: 'np-mast' }, h('div', { class: 'np-rule' }, h('span', null, 'Late City Edition'), h('span', null, dateText(G, it)), h('span', null, 'One Penny')), h('div', { class: 'np-name' }, 'The Evening Dispatch'), h('div', { class: 'np-rule thin' }))
        : h('header', { class: 'np-mast' }, h('div', { class: 'np-logo' }, h('b', null, 'MNN'), h('span', null, 'Meridian News Network')), h('div', { class: 'np-breaking tone-' + (it.tone || 'alarm') }, h('span', { class: 'live' }, 'LIVE'), it.tone === 'calm' ? 'TOP STORY' : it.tone === 'warn' ? 'DEVELOPING STORY' : 'BREAKING NEWS', h('span', { class: 'np-date' }, dateText(G, it)))),
      h('div', { class: 'np-body' },
        h('h2', { class: 'np-head' }, it.title),
        art,
        flags.length ? h('div', { class: 'np-flags' }, flags) : null,
        h('p', { class: 'np-text' }, it.text)),
      h('footer', { class: 'np-foot' }, pref, more, h('button', { class: 'btn primary', onclick: () => { closeNews(); } }, 'Noted')));
    root.appendChild(newsEl);
    updateMore();
    const t0 = performance.now();
    const loop = () => {
      if (!newsEl || !art.isConnected) return;
      const t = (performance.now() - t0) / 1000;
      drawArt(art, it.art || { kind: 'flags', flags: it.tags }, G, ww2 ? 'ww2' : 'modern', Math.min(1, t / 1.6), t);
      if (t < 2 && !reduced()) requestAnimationFrame(loop);
    };
    if (reduced()) drawArt(art, it.art || { kind: 'flags', flags: it.tags }, G, ww2 ? 'ww2' : 'modern', 1, 3); else loop();
    if (!N.muted) sound(ww2 ? 'press' : 'chime');
  }
  function updateMore() {
    if (!newsEl) return;
    const n = N.queue.filter(x => x.type === 'news').length;
    const m = newsEl.querySelector('.np-more');
    m.textContent = n ? `+${n} more ${n > 1 ? 'stories' : 'story'}` : '';
    const b = newsEl.querySelector('.np-foot .btn.primary');
    b.textContent = n ? 'Next story' : 'Noted';
  }
  function closeNews() { if (newsEl) newsEl.remove(); newsEl = null; }

  // ------------------------------------------------------------------ super events
  function showSuper(G, it) {
    const base = it.key ? IM.SUPERS[it.key] : null;
    const me = G.countries[G.player];
    const S = base ? {
      title: (base.titleFor && base.titleFor[me.tag]) || base.title,
      text: (base.textFor && base.textFor[me.tag]) || base.text,
      quote: base.quote, quoteBy: base.quoteBy, time: base.time, art: base.art,
      prelude: base.prelude, feed: (base.feedFor && base.feedFor[me.tag]) || base.feed,
      tags: base.art && base.art.red ? [base.art.red[0], base.art.blue[0]] : (base.art && base.art.flags) || it.tags,
    } : { title: it.title, text: it.text, quote: it.quote, quoteBy: it.quoteBy, art: it.art, tags: it.tags };
    const wasPaused = IM.UI.paused;
    IM.UI.paused = true;
    const root = document.getElementById('ui');
    const art = h('canvas', { class: 'sup-art', width: 1600, height: 900 });
    const text = h('p', { class: 'sup-text' });
    const tags = (S.tags || []).filter(Boolean);
    const flags = tags.length >= 2 && S.art && S.art.kind === 'map'
      ? h('div', { class: 'sup-flags' }, flagOf(G, tags[0]), h('span', null, 'vs'), flagOf(G, tags[1]))
      : tags.length ? h('div', { class: 'sup-flags' }, tags.slice(0, 3).map(t => flagOf(G, t))) : null;
    const mute = h('button', { class: 'btn small sup-mute', title: 'Sound', onclick: () => { N.muted = !N.muted; store.set('muted', N.muted ? '1' : '0'); mute.textContent = N.muted ? '🔇 Sound off' : '🔊 Sound on'; if (N.muted) stopSound(); } }, N.muted ? '🔇 Sound off' : '🔊 Sound on');
    let typing = null;
    const timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const finishTyping = () => { if (typing) { clearInterval(typing); typing = null; } text.textContent = S.text; text.classList.add('done'); };
    const close = () => { timers.forEach(clearTimeout); finishTyping(); closeSuper(); IM.UI.paused = wasPaused; if (IM.Panels) IM.Panels.refresh(true); };
    const feed = S.feed ? h('aside', { class: 'sup-feed', 'aria-label': 'Live updates' }, h('div', { class: 'sf-head' }, h('span', { class: 'live' }, 'LIVE'), 'Updates')) : null;
    const content = h('div', { class: 'sup-content', onclick: finishTyping },
      h('div', { class: 'sup-kicker' }, dateText(G, it).toUpperCase() + (S.time ? ` · ${S.time}` : '')),
      h('h1', { class: 'sup-title' }, S.title.split('').map((ch, i) => h('span', { style: { animationDelay: `${0.4 + i * 0.035}s` } }, ch))),
      flags,
      S.quote ? h('blockquote', { class: 'sup-quote' }, `“${S.quote}”`, h('cite', null, '— ' + S.quoteBy)) : null,
      text,
      h('div', { class: 'sup-actions' }, mute, h('button', { class: 'btn primary', onclick: close }, 'Continue')));
    superEl = h('div', { class: 'super', role: 'dialog', 'aria-label': S.title }, art, h('div', { class: 'sup-shade' }), feed, content, h('div', { class: 'sup-grain' }));
    root.appendChild(superEl);
    const artSpec = S.art || { kind: 'flags', flags: tags };
    const strikes = (artSpec.strikes || []).length;

    // main sequence: map, missile strikes, advancing arrows, live feed, typed account
    const startMain = () => {
      if (!superEl) return;
      content.classList.add('go');
      if (reduced()) { finishTyping(); drawArt(art, artSpec, G, 'super', 1, 12); if (feed) S.feed.forEach(f => feed.appendChild(feedItem(f))); return; }
      later(1600 + strikes * 250, () => { let i = 0; typing = setInterval(() => { i += 2; text.textContent = S.text.slice(0, i); if (i >= S.text.length) finishTyping(); }, 26); });
      if (feed) S.feed.forEach((f, i) => later(900 + i * 1500, () => { if (superEl) { feed.appendChild(feedItem(f)); feed.scrollTop = feed.scrollHeight; } }));
      const t0 = performance.now();
      const impacts = (artSpec.strikes || []).map((_, i) => 0.4 + i * 0.32 + 1.1);
      let nextImpact = 0;
      const arrowsFrom = strikes ? 0.6 + strikes * 0.32 + 1.2 : 0.6;
      const loop = () => {
        if (!superEl) return;
        const t = (performance.now() - t0) / 1000;
        drawArt(art, artSpec, G, 'super', Math.min(1, Math.max(0, (t - arrowsFrom) / 4)), t);
        // screen shake and a thud on each missile impact
        let shake = 0;
        for (const ti of impacts) if (t >= ti && t < ti + 0.35) shake = Math.max(shake, 1 - (t - ti) / 0.35);
        art.style.transform = shake ? `translate(${(Math.random() - 0.5) * 14 * shake}px, ${(Math.random() - 0.5) * 10 * shake}px) scale(1.01)` : '';
        while (nextImpact < impacts.length && t >= impacts[nextImpact]) { if (!N.muted) sound('impact'); nextImpact++; }
        anim = requestAnimationFrame(loop);
      };
      loop();
      if (!N.muted) sound(artSpec.kind === 'nuke' ? 'nuke' : artSpec.kind === 'map' ? 'war' : 'toll');
    };

    // optional prelude: black screen, a clock ticking toward the hour
    if (S.prelude && !reduced()) {
      const clock = h('div', { class: 'sp-clock num' }, S.prelude.clock[0]);
      const pre = h('div', { class: 'sup-prelude' }, h('div', { class: 'sp-place' }, S.prelude.place), clock, h('div', { class: 'sp-line' }, S.prelude.line || ''), h('button', { class: 'btn small sp-skip', onclick: () => { timers.forEach(clearTimeout); pre.remove(); startMain(); } }, 'Skip'));
      superEl.appendChild(pre);
      S.prelude.clock.forEach((c, i) => later(i * 1100, () => { clock.textContent = c; clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick'); if (i && !N.muted) sound('tick'); }));
      later(S.prelude.clock.length * 1100 + 200, () => { pre.classList.add('flash'); if (!N.muted) sound('impact'); later(700, () => { pre.remove(); startMain(); }); });
    } else startMain();
  }
  function feedItem([time, msg]) { return h('div', { class: 'sf-item' }, h('b', { class: 'num' }, time), h('span', null, msg)); }
  function closeSuper(silent) {
    if (anim) cancelAnimationFrame(anim); anim = null;
    if (superEl) superEl.remove(); superEl = null;
    stopSound();
  }

  // ------------------------------------------------------------------ artwork
  const PAL = {
    ww2: { sea: '#c9ba98', land: '#ab9a74', red: '#5e3c28', blue: '#8f7b5b', border: 'rgba(40,28,18,0.55)', arrow: '#2b1a10', arrowEdge: '#e9dcc0', text: '#1b120a', halo: 'rgba(233,220,192,0.9)' },
    modern: { sea: '#0d2232', land: '#3b4652', red: '#b4302a', blue: '#2e6fb3', border: 'rgba(5,10,14,0.8)', arrow: '#ff4a30', arrowEdge: '#2a0804', text: '#fff', halo: 'rgba(0,0,0,0.85)' },
    super: { sea: '#04080c', land: '#1a2127', red: '#7d1b14', blue: '#1b3a58', border: 'rgba(0,0,0,0.9)', arrow: '#ff3b1f', arrowEdge: '#1a0300', text: '#f3e6c8', halo: 'rgba(0,0,0,0.9)' },
  };

  function drawArt(cv, art, G, style, prog, t) {
    const ctx = cv.getContext('2d');
    const cw = cv.width, ch = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const kind = art && art.kind;
    if (kind === 'map') drawMap(ctx, cw, ch, art, G, style, prog, t);
    else if (kind === 'nuke') drawNuke(ctx, cw, ch, style, t);
    else if (kind === 'navy') drawNavy(ctx, cw, ch, style, t);
    else if (kind === 'city') drawCity(ctx, cw, ch, style, t);
    else if (kind === 'satellite') drawSatellite(ctx, cw, ch, art, G, t);
    else drawFlags(ctx, cw, ch, art || {}, G, style, t);
    if (style === 'ww2') newsprint(ctx, cw, ch);
    if (style === 'super') { const g = ctx.createRadialGradient(cw / 2, ch * 0.45, ch * 0.2, cw / 2, ch / 2, cw * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); }
  }

  function hexPath(p, x, y, s) {
    p.moveTo(x, y - s); p.lineTo(x + s * 0.866, y - s * 0.5); p.lineTo(x + s * 0.866, y + s * 0.5);
    p.lineTo(x, y + s); p.lineTo(x - s * 0.866, y + s * 0.5); p.lineTo(x - s * 0.866, y - s * 0.5); p.closePath();
  }

  function drawMap(ctx, cw, ch, art, G, style, prog, t) {
    const W = G.W, R = IM.Render, P = PAL[style];
    const st = W.stateByName[art.focus];
    const fh = st ? st.cityHex : W.states[G.countries[G.player].capital].cityHex;
    const zoom = style === 'super' ? 1 + Math.min(t / 25, 1) * 0.1 : 1;
    const viewW = (art.span || 24) * R.HW * 1.35 / zoom, viewH = viewW * ch / cw;
    const x0 = R.cx[fh] - viewW / 2, y0 = R.cy[fh] - viewH * (style === 'super' ? 0.33 : 0.5), sc = cw / viewW;
    const S = R.HW / Math.sqrt(3) * sc * 1.04;
    ctx.fillStyle = P.sea; ctx.fillRect(0, 0, cw, ch);
    const red = new Set(art.red || []), blue = new Set(art.blue || []);
    const groups = { land: new Path2D(), red: new Path2D(), blue: new Path2D() };
    const X = i => { let dx = R.cx[i] - x0; if (dx < -R.worldW / 2) dx += R.worldW; if (dx > R.worldW / 2) dx -= R.worldW; return dx * sc; };
    const Y = i => (R.cy[i] - y0) * sc;
    const side = i => { const tg = G.countries[G.ctrl[i]]?.tag; return red.has(tg) ? 'red' : blue.has(tg) ? 'blue' : 'land'; };
    const visible = [];
    for (const i of W.land) {
      const x = X(i), y = Y(i);
      if (x < -S * 2 || y < -S * 2 || x > cw + S * 2 || y > ch + S * 2) continue;
      visible.push(i);
      hexPath(groups[side(i)], x, y, S);
    }
    ctx.fillStyle = P.land; ctx.fill(groups.land);
    ctx.fillStyle = P.red; ctx.fill(groups.red);
    ctx.fillStyle = P.blue; ctx.fill(groups.blue);
    // borders between controllers
    const b = new Path2D();
    const V = [[0, -1], [0.866, -0.5], [0.866, 0.5], [0, 1], [-0.866, 0.5], [-0.866, -0.5]], pairs = [[1, 2], [4, 5], [0, 1], [5, 0], [2, 3], [3, 4]];
    for (const i of visible) for (let k = 0; k < 6; k++) {
      const j = W.nb[i * 6 + k]; if (j < 0 || !W.region[j] || G.ctrl[j] === G.ctrl[i]) continue;
      const x = X(i), y = Y(i), [a, c] = pairs[k];
      b.moveTo(x + V[a][0] * S, y + V[a][1] * S); b.lineTo(x + V[c][0] * S, y + V[c][1] * S);
    }
    ctx.strokeStyle = P.border; ctx.lineWidth = Math.max(1.2, S * 0.12); ctx.stroke(b);
    // arrows
    const labels = new Set(art.mark ? [art.mark] : []);
    if (style === 'super') for (const [, to] of art.strikes || []) labels.add(to);
    (art.axes || []).forEach(([from, to], n) => {
      const A = W.stateByName[from], B = W.stateByName[to];
      if (!A || !B) return;
      labels.add(to);
      const p = Math.max(0, Math.min(1, prog * 1.35 - n * 0.07));
      if (p <= 0) return;
      arrow(ctx, X(A.cityHex), Y(A.cityHex), X(B.cityHex), Y(B.cityHex), p, P, cw, style, t, n);
    });
    // missile strikes: trails from launch areas, then impacts that burn on
    (art.strikes || []).forEach(([from, to], i) => {
      if (style !== 'super') return;
      const A = W.stateByName[from], B = W.stateByName[to];
      if (!A || !B) return;
      const t0 = 0.4 + i * 0.32, t1 = t0 + 1.1;
      if (t < t0) return;
      const x1 = X(A.cityHex), y1 = Y(A.cityHex), x2 = X(B.cityHex) + ((i * 37) % 11 - 5) * S * 0.25, y2 = Y(B.cityHex) + ((i * 53) % 9 - 4) * S * 0.25;
      const u = Math.min(1, (t - t0) / (t1 - t0));
      const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * 0.35;
      const at = v => [(1 - v) * (1 - v) * x1 + 2 * (1 - v) * v * cx + v * v * x2, (1 - v) * (1 - v) * y1 + 2 * (1 - v) * v * cy + v * v * y2];
      if (u < 1) {
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) { const v = Math.max(0, u - 0.35) + (u - Math.max(0, u - 0.35)) * k / 24; const [px, py] = at(v); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.strokeStyle = 'rgba(255,230,190,0.55)'; ctx.lineWidth = cw * 0.0025; ctx.stroke();
        const [hx, hy] = at(u);
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, cw * 0.008); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, cw * 0.008, 0, 7); ctx.fill();
      } else {
        const age = t - t1, flare = Math.max(0, 1 - age / 0.8), glow = 0.35 + 0.15 * Math.sin(t * 9 + i);
        const rad = cw * (0.012 + flare * 0.05);
        const g = ctx.createRadialGradient(x2, y2, 0, x2, y2, rad);
        g.addColorStop(0, `rgba(255,250,220,${0.4 + flare * 0.6})`); g.addColorStop(0.35, `rgba(255,140,40,${glow + flare * 0.5})`); g.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x2, y2, rad, 0, 7); ctx.fill();
        if (flare > 0) { ctx.strokeStyle = `rgba(255,220,180,${flare})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x2, y2, cw * 0.06 * (1 - flare), 0, 7); ctx.stroke(); }
      }
    });
    // city labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const fs = Math.round(cw * (style === 'super' ? 0.0145 : 0.022));
    ctx.font = `700 ${fs}px Georgia, serif`;
    const placed = [];
    const order = [...labels].sort((a, b) => (b === art.focus) - (a === art.focus));
    for (const name of order) {
      const s = W.stateByName[name]; if (!s) continue;
      const x = X(s.cityHex), y = Y(s.cityHex);
      ctx.fillStyle = P.text; ctx.strokeStyle = P.halo; ctx.lineWidth = fs * 0.28;
      ctx.beginPath(); ctx.arc(x, y, fs * 0.25, 0, 7); ctx.fill(); ctx.stroke();
      const w = ctx.measureText(name).width, box = [x - w / 2 - 4, y - fs * 1.5, x + w / 2 + 4, y - fs * 0.3];
      if (placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
      placed.push(box);
      ctx.strokeText(name, x, y - fs * 0.45); ctx.fillText(name, x, y - fs * 0.45);
    }
    if (style === 'super') { // flashes along the front
      for (let k = 0; k < 6; k++) {
        const ax = (art.axes || [])[k % Math.max(1, (art.axes || []).length)];
        if (!ax) break;
        const B = W.stateByName[ax[1]]; if (!B) continue;
        const f = (Math.sin(t * 3.1 + k * 1.7) + 1) / 2;
        if (f < 0.75) continue;
        const x = X(B.cityHex) + Math.sin(k * 12.9 + Math.floor(t * 2)) * cw * 0.04, y = Y(B.cityHex) + Math.cos(k * 7.3 + Math.floor(t * 2)) * ch * 0.05;
        const g = ctx.createRadialGradient(x, y, 0, x, y, cw * 0.03);
        g.addColorStop(0, `rgba(255,220,150,${(f - 0.75) * 3})`); g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, cw * 0.03, 0, 7); ctx.fill();
      }
    }
  }

  function arrow(ctx, x1, y1, x2, y2, p, P, cw, style, t, n) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bend = (n % 2 ? -1 : 1) * 0.18;
    const cx = mx - dy / len * len * bend, cy = my + dx / len * len * bend;
    const pt = u => [(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2];
    const steps = 40, pts = [];
    for (let i = 0; i <= steps * p; i++) pts.push(pt(i / steps));
    if (pts.length < 2) return;
    const w = cw * (style === 'super' ? 0.011 : 0.013);
    const trace = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (style === 'super') { ctx.shadowColor = 'rgba(255,60,20,0.9)'; ctx.shadowBlur = cw * 0.02; }
    trace(); ctx.strokeStyle = P.arrowEdge; ctx.lineWidth = w * 1.6; ctx.stroke();
    trace(); ctx.strokeStyle = P.arrow; ctx.lineWidth = w; ctx.stroke();
    ctx.shadowBlur = 0;
    const [ex, ey] = pts[pts.length - 1], [px, py] = pts[Math.max(0, pts.length - 3)];
    const ang = Math.atan2(ey - py, ex - px), L = w * 1.9;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(ang) * L * 0.6, ey + Math.sin(ang) * L * 0.6);
    ctx.lineTo(ex + Math.cos(ang + 2.4) * L, ey + Math.sin(ang + 2.4) * L);
    ctx.lineTo(ex + Math.cos(ang - 2.4) * L, ey + Math.sin(ang - 2.4) * L);
    ctx.closePath();
    ctx.fillStyle = P.arrow; ctx.strokeStyle = P.arrowEdge; ctx.lineWidth = w * 0.3; ctx.fill(); ctx.stroke();
  }

  function sky(ctx, cw, ch, top, bottom, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, ch * horizon);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch * horizon);
  }
  function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function drawNuke(ctx, cw, ch, style, t) {
    const grow = Math.min(1, t / 6);
    sky(ctx, cw, ch, '#12060a', '#b8441a', 0.78);
    ctx.fillStyle = '#1a0f0a'; ctx.fillRect(0, ch * 0.78, cw, ch * 0.22);
    const cx = cw / 2, base = ch * 0.78, top = base - ch * (0.25 + 0.4 * grow);
    // stem
    const sg = ctx.createLinearGradient(cx - cw * 0.03, 0, cx + cw * 0.03, 0);
    sg.addColorStop(0, '#6b2a10'); sg.addColorStop(0.5, '#ffb35a'); sg.addColorStop(1, '#6b2a10');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(cx - cw * 0.05, base); ctx.quadraticCurveTo(cx - cw * 0.02, (base + top) / 2, cx - cw * 0.03, top + ch * 0.05);
    ctx.lineTo(cx + cw * 0.03, top + ch * 0.05); ctx.quadraticCurveTo(cx + cw * 0.02, (base + top) / 2, cx + cw * 0.05, base); ctx.fill();
    // cap
    const r = rnd(7);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI, d = r() * cw * 0.12 * (0.6 + grow * 0.6);
      const x = cx + Math.cos(a) * d * 1.6, y = top + Math.sin(a) * d * 0.25 - r() * ch * 0.04, rad = cw * (0.04 + r() * 0.05) * (0.5 + grow * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.45, 'rgba(255,140,50,0.85)'); g.addColorStop(1, 'rgba(90,30,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    }
    // shock ring and ground glow
    ctx.strokeStyle = `rgba(255,220,180,${Math.max(0, 0.6 - grow * 0.5)})`; ctx.lineWidth = ch * 0.01;
    ctx.beginPath(); ctx.ellipse(cx, base, cw * 0.1 + grow * cw * 0.35, ch * 0.03 + grow * ch * 0.04, 0, 0, 7); ctx.stroke();
    const flash = Math.max(0, 1 - t * 1.2);
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,240,${flash})`; ctx.fillRect(0, 0, cw, ch); }
    if (style === 'ww2') { ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#a58a60'; ctx.fillRect(0, 0, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
  }

  function drawNavy(ctx, cw, ch, style, t) {
    sky(ctx, cw, ch, '#2a1c2c', '#e08a4a', 0.62);
    const sg = ctx.createLinearGradient(0, ch * 0.62, 0, ch);
    sg.addColorStop(0, '#2b3a44'); sg.addColorStop(1, '#0c141a');
    ctx.fillStyle = sg; ctx.fillRect(0, ch * 0.62, cw, ch * 0.38);
    const r = rnd(3);
    for (let s = 0; s < 4; s++) {
      const x = cw * (0.12 + s * 0.22), y = ch * (0.66 + (s % 2) * 0.04), L = cw * 0.17;
      for (let k = 0; k < 7; k++) { // smoke
        const sx = x + L * 0.4 + Math.sin(t * 0.3 + k) * 6, sy = y - ch * (0.05 + k * 0.05) - (t * 4 % 20);
        ctx.fillStyle = `rgba(30,30,34,${0.55 - k * 0.06})`; ctx.beginPath(); ctx.arc(sx, sy, cw * (0.02 + k * 0.008), 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#10161b';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y); ctx.lineTo(x + L * 0.93, y + ch * 0.03); ctx.lineTo(x + L * 0.05, y + ch * 0.03); ctx.fill();
      ctx.fillRect(x + L * 0.3, y - ch * 0.03, L * 0.35, ch * 0.03); ctx.fillRect(x + L * 0.45, y - ch * 0.07, L * 0.06, ch * 0.04);
      ctx.fillRect(x + L * 0.2, y - ch * 0.05, L * 0.03, ch * 0.02);
      const fg = ctx.createRadialGradient(x + L * 0.5, y, 0, x + L * 0.5, y, cw * 0.05);
      fg.addColorStop(0, `rgba(255,170,60,${0.5 + 0.3 * Math.sin(t * 5 + s)})`); fg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + L * 0.5, y, cw * 0.05, 0, 7); ctx.fill();
    }
    for (let p = 0; p < 9; p++) { // aircraft
      const x = ((r() * cw + t * cw * 0.05 * (0.8 + r() * 0.4)) % (cw * 1.1)) - cw * 0.05, y = ch * (0.08 + r() * 0.3), s = cw * 0.012;
      ctx.fillStyle = '#15100f'; ctx.fillRect(x - s * 1.4, y - s * 0.12, s * 2.8, s * 0.24); ctx.fillRect(x - s * 0.15, y - s * 0.5, s * 0.3, s);
    }
  }

  function drawCity(ctx, cw, ch, style, t) {
    sky(ctx, cw, ch, '#0b1020', '#3c2a3a', 0.7);
    const r = rnd(11);
    const smoke = (x, y, k) => { for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(40,40,44,${0.6 - i * 0.04})`; ctx.beginPath(); ctx.arc(x + i * cw * 0.012 + Math.sin(t * 0.4 + i + k) * 5, y - i * ch * 0.05 - (t * 3 % 10), cw * (0.02 + i * 0.01), 0, 7); ctx.fill(); } };
    let x = 0;
    ctx.fillStyle = '#07090c';
    const towers = [];
    while (x < cw) { const w = cw * (0.025 + r() * 0.05), hh = ch * (0.12 + r() * 0.3); towers.push([x, w, hh]); x += w + cw * 0.004; }
    const tall = towers.slice().sort((a, b) => b[2] - a[2]).slice(0, 2);
    for (const [tx, w, hh] of towers) ctx.fillRect(tx, ch * 0.78 - hh, w, hh + ch * 0.22);
    for (const [tx, w, hh] of tall) {
      const y = ch * 0.78 - hh;
      const g = ctx.createRadialGradient(tx + w / 2, y + hh * 0.2, 0, tx + w / 2, y + hh * 0.2, cw * 0.05);
      g.addColorStop(0, 'rgba(255,190,90,0.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx + w / 2, y + hh * 0.2, cw * 0.05, 0, 7); ctx.fill();
      smoke(tx + w / 2, y + hh * 0.15, tx);
    }
    ctx.fillStyle = 'rgba(255,210,120,0.5)';
    for (const [tx, w, hh] of towers) for (let i = 0; i < 6; i++) if (r() > 0.6) ctx.fillRect(tx + w * r() * 0.8, ch * 0.78 - hh * r(), 2, 2);
  }

  // Commercial-satellite style photo of a field camp: rows of vehicles and tents.
  let satTex = null;
  function drawSatellite(ctx, cw, ch, art, G, t) {
    if (!satTex || satTex.width !== cw) {
      satTex = document.createElement('canvas'); satTex.width = cw; satTex.height = ch;
      const x = satTex.getContext('2d'), r = rnd(5);
      x.fillStyle = '#6d7560'; x.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${40 + r() * 60},${50 + r() * 50},${35 + r() * 40},${0.08 + r() * 0.15})`; x.fillRect(r() * cw, r() * ch, 2 + r() * 30, 2 + r() * 30); }
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(30,40,25,${0.25 + r() * 0.3})`; x.beginPath(); x.arc(r() * cw, r() * ch * 0.35, 4 + r() * 14, 0, 7); x.fill(); } // tree line
      x.strokeStyle = 'rgba(190,180,150,0.7)'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(0, ch * 0.42); x.bezierCurveTo(cw * 0.3, ch * 0.38, cw * 0.6, ch * 0.5, cw, ch * 0.46); x.stroke();
    }
    ctx.drawImage(satTex, 0, 0);
    const r = rnd(9), total = art.vehicles || 200;
    const shown = Math.floor(total * Math.min(1, 0.35 + t / 2.5));
    const rows = Math.ceil(Math.sqrt(total / 3)), cols = Math.ceil(total / rows);
    const x0 = cw * 0.1, y0 = ch * 0.5, dx = (cw * 0.62) / cols, dy = (ch * 0.42) / rows;
    for (let i = 0; i < shown; i++) {
      const c = i % cols, rr = Math.floor(i / cols);
      const x = x0 + c * dx + (rr % 2) * dx * 0.3, y = y0 + rr * dy;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1.5, y + 1.5, dx * 0.55, dy * 0.32);
      ctx.fillStyle = r() > 0.8 ? '#4e5540' : '#3a3f2e'; ctx.fillRect(x, y, dx * 0.55, dy * 0.32);
    }
    for (let i = 0; i < Math.min(40, total / 8); i++) { // tents
      const x = cw * 0.77 + (i % 5) * cw * 0.035, y = ch * 0.52 + Math.floor(i / 5) * ch * 0.05;
      ctx.fillStyle = '#b7b39a'; ctx.fillRect(x, y, cw * 0.022, ch * 0.028);
    }
    // analyst annotations
    const box = (x, y, w, hh, label) => {
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; const k = 12;
      ctx.beginPath(); ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y); ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + hh - k); ctx.lineTo(x + w, y + hh); ctx.lineTo(x + w - k, y + hh); ctx.moveTo(x + k, y + hh); ctx.lineTo(x, y + hh); ctx.lineTo(x, y + hh - k); ctx.stroke();
      ctx.font = `700 ${Math.round(cw * 0.018)}px system-ui, sans-serif`; ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(label, x, y - 4);
    };
    box(x0 - 10, y0 - 10, cw * 0.62 + 10, ch * 0.44, `ARMOURED VEHICLES (${total}+)`);
    box(cw * 0.76, ch * 0.5, cw * 0.2, ch * 0.4, 'TENTS / FIELD HOSPITAL');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, cw, ch * 0.075);
    ctx.font = `600 ${Math.round(cw * 0.017)}px ui-monospace, Menlo, monospace`; ctx.fillStyle = '#e6e6e6'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(`COMMERCIAL SATELLITE IMAGE · ${(art.place || '').toUpperCase()} · ${dateText(G, {}).toUpperCase()}`, cw * 0.02, ch * 0.0375);
    ctx.fillStyle = '#fff'; ctx.fillRect(cw * 0.04, ch * 0.93, cw * 0.1, 3); ctx.fillText('100 m', cw * 0.15, ch * 0.935);
  }

  function drawFlags(ctx, cw, ch, art, G, style, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, style === 'ww2' ? '#d8cbab' : '#18212a'); bg.addColorStop(1, style === 'ww2' ? '#b9a883' : '#0b1015');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    const tags = (art.flags || []).filter(Boolean).slice(0, 3);
    const n = tags.length || 1, fw = Math.min(cw * 0.36, cw * 0.8 / n), fh = fw * 2 / 3;
    const gap = (cw - fw * n) / (n + 1);
    tags.forEach((tg, i) => {
      const c = tagC(G, tg);
      const img = IM.flagImage(c);
      const x = gap + i * (fw + gap), y = (ch - fh) / 2;
      // waving: draw in vertical strips with a sine offset
      const strips = 40;
      for (let k = 0; k < strips; k++) {
        const off = Math.sin(t * 2.2 + k * 0.35) * fh * 0.035 * (k / strips);
        const shade = 0.12 * Math.sin(t * 2.2 + k * 0.35 + 1);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, img.naturalWidth * k / strips, 0, img.naturalWidth / strips + 0.5, img.naturalHeight, x + fw * k / strips, y + off, fw / strips + 1, fh);
        else { ctx.fillStyle = c.color; ctx.fillRect(x + fw * k / strips, y + off, fw / strips + 1, fh); }
        ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`; ctx.fillRect(x + fw * k / strips, y + off, fw / strips + 1, fh);
      }
      ctx.fillStyle = style === 'ww2' ? '#3b2a1a' : '#8a939a'; ctx.fillRect(x - fw * 0.03, y - fh * 0.1, fw * 0.02, fh * 1.6);
    });
    if (art.vs && tags.length === 2) {
      ctx.font = `700 ${Math.round(cw * 0.05)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = style === 'ww2' ? '#2a1a10' : '#f2d27d'; ctx.fillText('vs', cw / 2, ch / 2);
    }
    if (style === 'ww2') { ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#a58a60'; ctx.fillRect(0, 0, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
  }

  // newsprint: sepia tone and halftone grain
  let grain = null;
  function newsprint(ctx, cw, ch) {
    ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#a0845a'; ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'multiply';
    if (!grain) {
      const g = document.createElement('canvas'); g.width = g.height = 6;
      const x = g.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 6, 6); x.fillStyle = 'rgba(60,40,20,0.35)'; x.beginPath(); x.arc(3, 3, 1.3, 0, 7); x.fill();
      grain = ctx.createPattern(g, 'repeat');
    }
    ctx.fillStyle = grain; ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ sound (synthesized, no files)
  let actx = null, live = [];
  function sound(kind) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const now = actx.currentTime, out = actx.createGain();
      out.gain.value = 0.0001; out.connect(actx.destination); live.push(out);
      const env = (peak, attack, hold, rel) => { out.gain.setValueAtTime(0.0001, now); out.gain.exponentialRampToValueAtTime(peak, now + attack); out.gain.setValueAtTime(peak, now + attack + hold); out.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + rel); };
      const noise = (dur, freq) => {
        const b = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = b.getChannelData(0);
        let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        const src = actx.createBufferSource(); src.buffer = b;
        const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
        src.connect(f); f.connect(out); src.start(now); return src;
      };
      if (kind === 'war') {
        env(0.5, 0.8, 3, 3); noise(7, 180);
        const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(260, now + 0.5); o.frequency.linearRampToValueAtTime(620, now + 2.6); o.frequency.linearRampToValueAtTime(260, now + 5);
        const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        g.gain.value = 0.06; o.connect(f); f.connect(g); g.connect(out); o.start(now + 0.5); o.stop(now + 6.5);
      } else if (kind === 'nuke') {
        env(0.9, 0.05, 1.5, 5); noise(7, 120);
      } else if (kind === 'toll') {
        env(0.35, 0.02, 0.3, 4);
        for (const [fq, gv] of [[110, 0.5], [220, 0.25], [331, 0.15], [440, 0.08]]) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = fq; g.gain.value = gv; o.connect(g); g.connect(out); o.start(now); o.stop(now + 5); }
      } else if (kind === 'impact') {
        env(0.6, 0.005, 0.1, 1.4); noise(2, 260);
      } else if (kind === 'tick') {
        env(0.08, 0.002, 0.02, 0.08);
        const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = 1400; o.connect(out); o.start(now); o.stop(now + 0.05);
      } else if (kind === 'press') {
        env(0.12, 0.01, 0.4, 0.4); noise(1, 2500);
      } else {
        env(0.15, 0.01, 0.15, 0.6);
        [[880, 0], [1320, 0.12]].forEach(([fq, dl]) => { const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = fq; o.connect(out); o.start(now + dl); o.stop(now + dl + 0.6); });
      }
    } catch (e) { /* audio unavailable */ }
  }
  function stopSound() {
    for (const g of live) { try { g.gain.cancelScheduledValues(0); g.gain.value = 0; g.disconnect(); } catch (e) { /* gone */ } }
    live = [];
  }
  N.drawArt = drawArt;
})();
