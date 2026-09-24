// Diplomacy and Iron Meridian's custom features: sanctions, cyber operations,
// lend-lease, nuclear strikes and negotiated peace.
window.IM = window.IM || {};

(function () {
  const D = IM.Diplo = {};
  const War = () => IM.War;
  const Game = () => IM.Game;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  D.JUSTIFY_PP = 30;

  D.canJustify = function (G, c, t) {
    if (c.id === t.id || !t.alive) return 'Invalid target';
    if (War().isEnemy(G, c.id, t.id)) return 'Already at war';
    if (c.faction >= 0 && c.faction === t.faction) return 'Target is in your faction';
    if (t.overlord === c.id || c.overlord === t.id) return 'Cannot target your own subject or overlord';
    if (c.wargoals.has(t.id)) return 'War goal already justified';
    if (c.justify) return 'Already justifying a war goal';
    if (c.pp < D.JUSTIFY_PP) return `Needs ${D.JUSTIFY_PP} political power`;
    if (c.ideo === 'democratic' && G.tension < 60 && !['fascist', 'communist'].includes(t.ideo)) return 'Democracies need 60% world tension (or a totalitarian target)';
    if (c.ideo === 'democratic' && G.tension < 30) return 'Democracies need at least 30% world tension';
    return null;
  };
  D.justify = function (G, c, t) {
    const err = D.canJustify(G, c, t); if (err) return err;
    c.pp -= D.JUSTIFY_PP;
    const days = Math.round(35 * (1 - c.mods.justify) * (c.ideo === 'democratic' ? 1.4 : 1));
    c.justify = { target: t.id, days, total: days };
    G.tension = Math.min(100, G.tension + 2);
    if (t.isPlayer) Game().news(G, `${c.name} is justifying a war goal against us!`, 'bad');
    return null;
  };
  D.declare = function (G, c, t) {
    if (!c.wargoals.has(t.id)) return 'No war goal';
    return War().declare(G, c.id, t.id);
  };

  // ------------------------------------------------------------------ factions
  D.createFaction = function (G, c, name) {
    if (c.faction >= 0) return 'Already in a faction';
    if (c.pp < 50) return 'Needs 50 political power';
    c.pp -= 50;
    G.factions.push({ name: name || `${c.name} Pact`, leader: c.id, members: [c.id] });
    c.faction = G.factions.length - 1;
    G.relDirty = true;
    Game().news(G, `${c.name} has founded the ${G.factions[c.faction].name}.`, 'major');
    return null;
  };
  D.acceptsJoin = function (G, leader, applicant) {
    if (applicant.faction >= 0) return false;
    if (War().enemiesOf(G, applicant.id).some(e => G.factions[leader.faction].members.includes(e))) return false;
    if (leader.ideo === applicant.ideo) return true;
    // shared enemies make strange bedfellows
    const le = War().enemiesOf(G, leader.id), ae = War().enemiesOf(G, applicant.id);
    return le.some(e => ae.includes(e));
  };
  D.joinFaction = function (G, c, fi) {
    const f = G.factions[fi];
    const leader = G.countries[f.leader];
    if (!D.acceptsJoin(G, leader, c)) return `${leader.name} refuses: different ideology and no common enemy`;
    f.members.push(c.id); c.faction = fi;
    // join the faction's ongoing wars
    for (const w of G.wars) {
      if (w.att.includes(f.leader) && !w.cap.has(f.leader)) War().joinWar(G, c.id, w, 'att');
      else if (w.def.includes(f.leader) && !w.cap.has(f.leader)) War().joinWar(G, c.id, w, 'def');
    }
    G.relDirty = true;
    Game().news(G, `${c.name} has joined the ${f.name}.`, 'major');
    if (Game().notable(G, c.id) && !c.isPlayer) Game().headline(G, { type: 'news', tags: [c.tag], title: `${c.name.toUpperCase()} JOINS THE ${f.name.toUpperCase()}`, text: `${c.name} has formally joined the ${f.name} led by ${G.countries[f.leader].name}, pledging to stand with its members in war.`, art: { kind: 'flags', flags: [c.tag, G.countries[f.leader].tag] } });
    return null;
  };
  D.leaveFaction = function (G, c) {
    if (c.faction < 0) return 'Not in a faction';
    const f = G.factions[c.faction];
    if (f.leader === c.id) return 'The faction leader cannot leave';
    f.members = f.members.filter(m => m !== c.id);
    c.faction = -1; G.relDirty = true;
    return null;
  };
  D.invite = function (G, c, t) {
    if (c.faction < 0 || G.factions[c.faction].leader !== c.id) return 'Only faction leaders can invite';
    if (t.faction >= 0) return 'Already in a faction';
    if (t.overlord !== null && t.overlord !== undefined) return 'Subjects follow their overlord';
    const willing = t.isPlayer ? true : (t.ideo === c.ideo || War().enemiesOf(G, t.id).some(e => War().enemiesOf(G, c.id).includes(e))) && Math.random() < 0.8;
    if (!willing) return `${t.name} declined the invitation`;
    t.faction = c.faction; G.factions[c.faction].members.push(t.id);
    for (const w of G.wars) {
      if (w.att.includes(c.id)) War().joinWar(G, t.id, w, 'att');
      else if (w.def.includes(c.id)) War().joinWar(G, t.id, w, 'def');
    }
    G.relDirty = true;
    Game().news(G, `${t.name} has joined the ${G.factions[c.faction].name}.`, 'major');
    return null;
  };
  D.seekAlliance = function (G, c) {
    if (c.faction >= 0) return;
    let best = -1, bs = 0;
    G.factions.forEach((f, i) => {
      const L = G.countries[f.leader];
      if (!L.alive || !f.members.length) return;
      if (!D.acceptsJoin(G, L, c)) return;
      const s = f.members.reduce((a, m) => a + (G.countries[m]._st?.mil || 0), 0);
      if (s > bs) { bs = s; best = i; }
    });
    if (best >= 0) D.joinFaction(G, c, best);
  };

  D.guarantee = function (G, c, t) {
    if (c.guarantees.has(t.id)) { c.guarantees.delete(t.id); return null; }
    if (c.pp < 25) return 'Needs 25 political power';
    c.pp -= 25; c.guarantees.add(t.id);
    Game().news(G, `${c.name} guarantees the independence of ${t.name}.`, 'info');
    return null;
  };

  // ------------------------------------------------------------------ custom: sanctions
  D.sanction = function (G, c, t) {
    if (t.sanctionedBy.has(c.id)) { t.sanctionedBy.delete(c.id); Game().news(G, `${c.name} lifted sanctions on ${t.name}.`, 'info'); return null; }
    if (c.pp < 25) return 'Needs 25 political power';
    if (War().isFriend(G, c.id, t.id)) return 'Cannot sanction a friendly nation';
    c.pp -= 25; t.sanctionedBy.add(c.id);
    t.stab = clamp(t.stab - 0.03, 0, 1);
    Game().news(G, `${c.name} has imposed economic sanctions on ${t.name}.`, t.isPlayer ? 'bad' : 'info');
    return null;
  };

  // ------------------------------------------------------------------ custom: cyber operations
  D.cyber = function (G, c, t) {
    if (!c.mods.cyber) return 'Requires Cyber Warfare technology';
    if (c.pp < 40) return 'Needs 40 political power';
    if (t.cyberDays > 0) return 'Target is already crippled';
    c.pp -= 40;
    const defense = t.mods.cyber ? 0.35 : 0;
    if (Math.random() < defense) { Game().news(G, `A cyber attack on ${t.name} was detected and repelled.`, 'info'); G.tension += 1; return null; }
    t.cyberDays = 30;
    G.tension = Math.min(100, G.tension + 2);
    Game().news(G, `Cyber attack cripples ${t.name}: research and military coordination disrupted for 30 days.`, t.isPlayer ? 'bad' : 'info');
    return null;
  };

  // ------------------------------------------------------------------ custom: lend-lease
  D.lendLease = function (G, c, t, eq) {
    if (!War().atWar(G, t.id)) return 'Recipient must be at war';
    if (War().isEnemy(G, c.id, t.id)) return 'Cannot supply an enemy';
    const amt = Math.floor(c.stock[eq] * 0.2);
    if (amt < 1) return 'Nothing to send';
    c.stock[eq] -= amt; t.stock[eq] += amt;
    Game().news(G, `${c.name} sends ${amt.toLocaleString()} ${Game().eqName(G, eq)} to ${t.name}.`, 'info');
    return null;
  };

  // ------------------------------------------------------------------ custom: nuclear weapons
  D.canNuke = function (G, c, hex) {
    if (!c.mods.nukes) return 'Your nation has no nuclear capability';
    if (c.stock.nuk < 1) return 'No warheads available';
    if (c.nukeCooldown > 0) return `Launch systems cycling (${c.nukeCooldown} days)`;
    const ctl = G.ctrl[hex];
    if (ctl < 0 || !War().isEnemy(G, c.id, ctl)) return 'Target must be enemy-controlled territory';
    return null;
  };
  D.nuke = function (G, c, hex) {
    const err = D.canNuke(G, c, hex); if (err) return err;
    const W = G.W;
    c.stock.nuk -= 1; c.nukeCooldown = 7;
    const power = c.mods.nukePower;
    const radius = power >= 1.5 ? 2 : 1;
    const victim = G.countries[G.ctrl[hex]];
    const affected = new Set([hex]);
    let frontier = [hex];
    for (let r = 0; r < radius; r++) {
      const nx = [];
      for (const h of frontier) for (const j of W.neighbors(h)) if (!affected.has(j)) { affected.add(j); nx.push(j); }
      frontier = nx;
    }
    let killed = 0;
    for (const d of G.divisions) {
      if (!affected.has(d.hex)) continue;
      d.str *= d.hex === hex ? 0.1 : 0.45; d.org = 0;
      if (d.str < 0.08) { War().killDivision(G, d, 'annihilated by a nuclear blast'); killed++; }
    }
    G.divisions = G.divisions.filter(d => !d.dead);
    const st = W.states[W.stateOf[hex]];
    G.civ[st.id] = Math.floor(G.civ[st.id] * 0.4); G.mil[st.id] = Math.floor(G.mil[st.id] * 0.4);
    const owner = G.countries[G.owner[st.id]];
    owner.mpUsed += st.pop * 1e6 * 0.01 * power;
    victim.stab = clamp(victim.stab - 0.15, 0, 1);
    victim.ws = clamp(victim.ws + 0.1, 0, 1);
    c.stab = clamp(c.stab - 0.08, 0, 1);
    G.tension = 100;
    for (const o of G.countries) if (o.alive && o.id !== c.id && o.ideo === 'democratic' && !War().isFriend(G, o.id, c.id)) o.sanctionedBy && c.sanctionedBy.add(o.id);
    G.nukeFlashes.push({ hex, t: G.hour, r: radius });
    Game().news(G, `☢ ${c.name} has detonated a nuclear weapon over ${st.name}! ${killed} divisions annihilated.`, 'nuke');
    Game().headline(G, {
      type: 'super', tags: [c.tag, victim.tag],
      title: `Nuclear Fire over ${st.name}`,
      quote: 'I know not with what weapons World War III will be fought, but World War IV will be fought with sticks and stones.',
      quoteBy: 'Albert Einstein (attributed)',
      text: `A nuclear warhead launched by ${c.name} has detonated over ${st.name}. A fireball hotter than the surface of the sun has levelled the city centre; ${killed ? `${killed} division${killed > 1 ? 's were' : ' was'} annihilated outright and ` : ''}hundreds of thousands are dead or dying. Around the world, markets crash, governments convene in emergency session, and every nuclear power raises its alert level. The taboo that held since 1945 has been broken.`,
      art: { kind: 'nuke' },
    });
    // deterrence: retaliation by nuclear-armed enemies
    for (const e of War().enemiesOf(G, c.id)) {
      const E = G.countries[e];
      if (E.isPlayer || !E.mods.nukes || E.stock.nuk < 1 || E.nukeCooldown > 0) continue;
      const targets = W.states.filter(s => G.ctrl[s.cityHex] === c.id && G.owner[s.id] === c.id).sort((a, b) => b.vp - a.vp);
      if (targets.length) { E._retaliate = targets[0].cityHex; }
    }
    return null;
  };

  // ------------------------------------------------------------------ custom: negotiated peace
  // Score > 0 means side A is winning.
  D.warScore = function (G, w) {
    const side = arr => arr.filter(x => G.countries[x].alive && !w.cap.has(x));
    const lossOf = arr => {
      let tot = 0, lost = 0;
      for (const id of arr) { const c = G.countries[id]; if (!c.alive) continue; for (const s of G.W.states) if (G.owner[s.id] === id) { tot += s.vp + 1; if (War().isEnemy(G, id, G.ctrl[s.cityHex])) lost += s.vp + 1; } }
      return tot ? lost / tot : 0;
    };
    return { att: lossOf(side(w.att)), def: lossOf(side(w.def)) };
  };
  D.offerPeace = function (G, c, w, kind) {
    const mySide = w.att.includes(c.id) ? 'att' : 'def';
    const foeSide = mySide === 'att' ? 'def' : 'att';
    const lead = w[mySide][0];
    if (lead !== c.id && !(G.countries[lead].capitulated || !G.countries[lead].alive)) return 'Only the war leader can negotiate';
    if (G.hour - c.lastPeaceOffer < 24 * 30) return 'Peace can only be offered once a month';
    c.lastPeaceOffer = G.hour;
    const sc = D.warScore(G, w);
    const myLoss = sc[mySide], foeLoss = sc[foeSide];
    const foeLead = G.countries[w[foeSide].find(x => G.countries[x].alive && !w.cap.has(x))];
    const months = (G.hour - w.start) / 720;
    if (kind === 'white') {
      const accept = foeLead.isPlayer ? false : (foeLoss > myLoss + 0.05) || (months > 12 && Math.abs(foeLoss - myLoss) < 0.1 && Math.random() < 0.5) || foeLoss > 0.3;
      if (!accept) return `${foeLead.name} rejected white peace`;
      War().peace(G, w, w[mySide], w[foeSide], 'white');
      return null;
    }
    // concessions: enemy cedes occupied states
    const accept = !foeLead.isPlayer && foeLoss >= 0.3 && myLoss < 0.15 && foeLoss > myLoss * 2;
    if (!accept) return `${foeLead.name} refuses to cede territory`;
    War().peace(G, w, w[mySide], w[foeSide], 'concession');
    return null;
  };

  // ------------------------------------------------------------------ helpers for events
  D.transferByName = function (G, names, tag) {
    const c = Game().byTag(G, tag); if (!c) return;
    for (const n of names) { const s = G.W.stateByName[n]; if (s) War().transferState(G, s, c.id); }
  };
  // Release every state of the listed modern regions currently owned by `from` as their own nation.
  D.release = function (G, fromTag, codes, spec) {
    const from = Game().byTag(G, fromTag); if (!from || !from.alive) return [];
    const out = [];
    for (const code of codes) {
      const states = G.W.states.filter(s => s.code === code && G.owner[s.id] === from.id);
      if (!states.length) continue;
      let c = Game().byTag(G, code);
      const revived = c && !c.alive;
      if (!c) {
        c = Game().addCountry(G, code, Object.assign({ ideo: 'authoritarian' }, (spec && spec[code]) || {}));
      }
      if (revived) { c.alive = true; c.capitulated = false; }
      for (const s of states) {
        G.owner[s.id] = c.id;
        for (const h of s.hexes) if (G.ctrl[h] === from.id) G.ctrl[h] = c.id;
      }
      if (!c.lines.length) IM.Game.initReleased(G, c, states, from);
      // divisions standing in the new country become its army
      for (const d of G.divisions) if (d.owner === from.id && states.some(s => G.W.stateOf[d.hex] === s.id) && Math.random() < 0.6) d.owner = c.id;
      out.push(c);
    }
    if (from.capital !== undefined && G.owner[from.capital] !== from.id) {
      const alt = G.W.states.filter(s => G.owner[s.id] === from.id).sort((a, b) => b.vp - a.vp)[0];
      if (alt) from.capital = alt.id;
    }
    G.relDirty = true; G.mapDirty = true; G.supplyDirty = true;
    IM.War.rebuildRelations(G);
    return out;
  };
})();
