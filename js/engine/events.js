// Scripted historical events. The AI always picks the first option;
// the player gets a popup and chooses.
window.IM = window.IM || {};

(function () {
  const E = IM.Events = {};
  const byTag = (G, t) => IM.Game.byTag(G, t);
  const alive = (G, t) => { const c = byTag(G, t); return c && c.alive && !c.capitulated; };
  const exists = (G, t) => { const c = byTag(G, t); return c && c.alive; };

  // A war between just the named parties (no faction call-to-arms).
  E.limitedWar = function (G, name, att, def) {
    const a = att.filter(t => alive(G, t)).map(t => G.tagId[t]);
    const d = def.filter(t => alive(G, t)).map(t => G.tagId[t]);
    if (!a.length || !d.length) return;
    if (a.some(x => d.some(y => IM.War.isEnemy(G, x, y)))) return;
    G.wars.push({ id: (G.warSeq = (G.warSeq || G.wars.length) + 1), name, att: a, def: d, start: G.hour, cap: new Set() });
    G.relDirty = true; IM.War.rebuildRelations(G);
    G.tension = Math.min(100, G.tension + 8);
    IM.Game.news(G, `${name}: ${byTag(G, att[0]).name} attacks ${byTag(G, def[0]).name}!`, 'major');
  };
  const takeStates = (G, names, tag, onlyFrom) => {
    const c = byTag(G, tag); if (!c) return;
    for (const n of names) {
      const s = G.W.stateByName[n]; if (!s) continue;
      if (onlyFrom && !onlyFrom.includes(G.countries[G.owner[s.id]].tag)) continue;
      IM.War.transferState(G, s, c.id);
      for (const h of s.hexes) if (!IM.War.isEnemy(G, c.id, G.ctrl[h])) G.ctrl[h] = c.id;
    }
    G.mapDirty = true;
  };
  const annex = (G, victimTag, byTagName) => {
    const v = byTag(G, victimTag), c = byTag(G, byTagName);
    if (!v || !v.alive || !c) return;
    for (const s of G.W.states) if (G.owner[s.id] === v.id) IM.War.transferState(G, s, c.id);
    for (let h = 0; h < G.W.n; h++) if (G.ctrl[h] === v.id) G.ctrl[h] = c.id;
    IM.War.killCountry(G, v);
  };
  const factionOf = (G, name) => G.factions.findIndex(f => f.name === name);
  const joinFactionByName = (G, tag, name) => {
    const fi = factionOf(G, name), c = byTag(G, tag);
    if (fi < 0 || !c || c.faction >= 0) return;
    G.factions[fi].members.push(c.id); c.faction = fi;
    const leader = G.factions[fi].leader;
    for (const w of G.wars) {
      if (w.cap.has(leader)) continue;
      if (w.att.includes(leader)) IM.War.joinWar(G, c.id, w, 'att');
      else if (w.def.includes(leader)) IM.War.joinWar(G, c.id, w, 'def');
    }
    G.relDirty = true; IM.War.rebuildRelations(G);
  };
  const setGov = (G, tag, o) => { const c = byTag(G, tag); if (c) Object.assign(c, o); G.mapDirty = true; };

  const EV = [
    // ------------------------------------------------------------ WWII
    {
      id: 'sov_poland', eras: ['1939'], date: [1939, 9, 17], actor: 'SOV', title: 'The Fourth Partition',
      text: 'With the Polish army collapsing under the German onslaught, the secret protocol of the Molotov-Ribbentrop Pact gives us eastern Poland. Our troops stand ready on the border.',
      cond: G => exists(G, 'POL') && exists(G, 'SOV'),
      options: [
        { label: 'Occupy the Kresy', fx: G => takeStates(G, ['Lviv', 'Rivne', 'Brest-Litovsk', 'Grodno', 'Vilnius', 'Bialystok'], 'SOV', ['POL']) },
        { label: 'Honour Polish sovereignty', fx: G => {} },
      ],
    },
    {
      id: 'winter_war', eras: ['1939'], date: [1939, 11, 30], actor: 'SOV', title: 'The Winter War',
      text: 'Finland has refused our demands for territory on the Karelian Isthmus. Leningrad lies within artillery range of the border.',
      cond: G => alive(G, 'FIN') && alive(G, 'SOV'),
      options: [
        { label: 'Attack Finland', fx: G => E.limitedWar(G, 'Winter War', ['SOV'], ['FIN']) },
        { label: 'Leave Finland be', fx: G => {} },
      ],
    },
    {
      id: 'baltic', eras: ['1939'], date: [1940, 6, 15], actor: 'SOV', title: 'Ultimatum to the Baltic States',
      text: 'Europe is distracted by the fall of France. The Baltic governments, and Romania over Bessarabia, will not dare refuse us now.',
      cond: G => alive(G, 'SOV') && (alive(G, 'EST') || alive(G, 'LVA') || alive(G, 'LTU')),
      options: [
        { label: 'Annex the Baltics and Bessarabia', fx: G => { for (const t of ['EST', 'LVA', 'LTU']) if (alive(G, t) && byTag(G, t).faction < 0) annex(G, t, 'SOV'); takeStates(G, ['Chisinau', 'Chernivtsi'], 'SOV', ['ROU']); } },
        { label: 'Not yet', fx: G => {} },
      ],
    },
    {
      id: 'vichy', eras: ['1939'], date: [1940, 5, 1], actor: 'DEU', title: 'An Armistice at Compiègne',
      text: 'France has fallen. A rump French state under Marshal Pétain offers to administer the south and the empire in exchange for peace.',
      wait: 1200, cond: G => { const f = byTag(G, 'FRA'); return f && f.capitulated && alive(G, 'DEU') && !byTag(G, 'VIC'); },
      options: [
        {
          label: 'Accept the Vichy regime', fx: G => {
            const fra = byTag(G, 'FRA');
            const vic = IM.Game.addCountry(G, 'VIC', { ideo: 'fascist', leader: 'Philippe Pétain' });
            vic.alive = true;
            const states = G.W.states.filter(s => G.owner[s.id] === fra.id && (s.code !== 'FRA' || ['Vichy', 'Lyon', 'Marseille', 'Toulouse'].includes(s.name)));
            for (const s of states) { G.owner[s.id] = vic.id; for (const h of s.hexes) G.ctrl[h] = vic.id; }
            if (states.length) { IM.Game.initReleased(G, vic, states, fra); vic.overlord = G.tagId.DEU; }
            G.relDirty = true; G.mapDirty = true; IM.War.rebuildRelations(G);
          },
        },
        { label: 'Occupy all of France', fx: G => {} },
      ],
    },
    {
      id: 'italy_joins', eras: ['1939'], date: [1940, 6, 10], actor: 'ITA', title: 'The Hand That Held the Dagger',
      text: 'The Wehrmacht is at the gates of Paris. Il Duce believes that a few thousand dead will buy Italy a seat at the peace conference.',
      cond: G => alive(G, 'ITA') && alive(G, 'DEU') && alive(G, 'GBR') && !IM.War.atWar(G, G.tagId.ITA),
      options: [
        { label: 'Declare war on the Allies', fx: G => joinFactionByName(G, 'ITA', 'Axis') },
        { label: 'Remain non-belligerent', fx: G => {} },
      ],
    },
    {
      id: 'barbarossa', eras: ['1939'], date: [1941, 6, 22], actor: 'DEU', title: 'Operation Barbarossa',
      text: 'The Führer\'s long-awaited war of annihilation in the East is ready. Three army groups await the signal.',
      cond: G => alive(G, 'DEU') && alive(G, 'SOV') && !IM.War.isEnemy(G, G.tagId.DEU, G.tagId.SOV),
      options: [
        { label: 'Launch Barbarossa', fx: G => IM.War.declare(G, G.tagId.DEU, G.tagId.SOV, 'Operation Barbarossa') },
        { label: 'Postpone the invasion', fx: G => {} },
      ],
    },
    {
      id: 'pearl_harbor', eras: ['1939', '1941'], date: [1941, 12, 7], actor: 'JPN', title: 'Climb Mount Niitaka',
      text: 'The American oil embargo is strangling the Empire. The carrier strike force is in position north of Hawaii.',
      cond: G => alive(G, 'JPN') && alive(G, 'USA') && !IM.War.isEnemy(G, G.tagId.JPN, G.tagId.USA),
      options: [
        {
          label: 'Strike Pearl Harbor', fx: G => {
            const usa = byTag(G, 'USA'); usa.stock.nav = Math.round(usa.stock.nav * 0.8);
            IM.War.declare(G, G.tagId.JPN, G.tagId.USA, 'Pacific War');
            joinFactionByName(G, 'USA', 'Allies');
            if (alive(G, 'GBR') && !IM.War.isEnemy(G, G.tagId.JPN, G.tagId.GBR)) IM.War.declare(G, G.tagId.JPN, G.tagId.GBR, 'War in Southeast Asia');
            usa.laws.econ = Math.max(usa.laws.econ, 2); usa.ws = 0.9;
          },
        },
        { label: 'Seek a diplomatic solution', fx: G => {} },
      ],
    },
    {
      id: 'manhattan', eras: ['1939', '1941', '1945'], date: [1945, 7, 16], actor: 'USA', title: 'Trinity',
      text: 'In the New Mexico desert, a light brighter than a thousand suns. The Manhattan Project has succeeded.',
      cond: G => alive(G, 'USA'),
      options: [{ label: '"Now I am become Death..."', fx: G => { const u = byTag(G, 'USA'); u.researched.add('nuc_1945'); IM.Game.recomputeMods(G, u); u.stock.nuk += 2; } }],
    },
    {
      id: 'august_storm', eras: ['1945'], date: [1945, 8, 9], actor: 'SOV', title: 'Operation August Storm',
      text: 'As promised at Yalta, three months after the defeat of Germany we turn east against Japan\'s Kwantung Army.',
      cond: G => alive(G, 'SOV') && alive(G, 'JPN') && !IM.War.isEnemy(G, G.tagId.SOV, G.tagId.JPN) && !IM.War.atWar(G, G.tagId.SOV),
      options: [
        { label: 'Attack Manchuria', fx: G => IM.War.declare(G, G.tagId.SOV, G.tagId.JPN, 'Soviet-Japanese War') },
        { label: 'Stay out of the Pacific', fx: G => {} },
      ],
    },
    // ------------------------------------------------------------ 1991
    {
      id: 'warsaw_dissolve', eras: ['1991'], date: [1991, 7, 1], actor: 'SOV', title: 'The Warsaw Pact Dissolves',
      text: 'In Prague, the members of the Warsaw Treaty Organization formally dissolve the alliance.',
      cond: G => factionOf(G, 'Warsaw Pact') >= 0,
      options: [{ label: 'An era ends', fx: G => { const fi = factionOf(G, 'Warsaw Pact'); for (const m of G.factions[fi].members) G.countries[m].faction = -1; G.factions[fi].members = []; G.relDirty = true; } }],
    },
    {
      id: 'yugo_breakup', eras: ['1991'], date: [1991, 6, 25], actor: 'YUG', title: 'Slovenia and Croatia Secede',
      text: 'Ljubljana and Zagreb have declared independence. The Yugoslav People\'s Army is mobilising.',
      cond: G => exists(G, 'YUG'),
      options: [
        { label: 'Let them go, but fight for Croatia', fx: G => { IM.Diplo.release(G, 'YUG', ['SVN', 'HRV', 'MKD'], { HRV: { ideo: 'democratic', leader: 'Franjo Tuđman' }, SVN: { ideo: 'democratic', leader: 'Milan Kučan' }, MKD: { ideo: 'democratic', leader: 'Kiro Gligorov' } }); setGov(G, 'YUG', { name: 'FR Yugoslavia', ideo: 'authoritarian', leader: 'Slobodan Milošević' }); E.limitedWar(G, 'Croatian War of Independence', ['YUG'], ['HRV']); } },
        { label: 'Accept a peaceful dissolution', fx: G => { IM.Diplo.release(G, 'YUG', ['SVN', 'HRV', 'MKD', 'BIH'], {}); setGov(G, 'YUG', { name: 'FR Yugoslavia', ideo: 'authoritarian' }); } },
      ],
    },
    {
      id: 'bosnia', eras: ['1991'], date: [1992, 4, 6], actor: 'YUG', title: 'War in Bosnia',
      text: 'Bosnia and Herzegovina has declared independence. Sarajevo is under siege.',
      cond: G => exists(G, 'YUG') && G.W.states.some(s => s.code === 'BIH' && G.countries[G.owner[s.id]].tag === 'YUG'),
      options: [{ label: 'Release Bosnia', fx: G => IM.Diplo.release(G, 'YUG', ['BIH'], { BIH: { ideo: 'democratic', leader: 'Alija Izetbegović' } }) }],
    },
    {
      id: 'ussr_end', eras: ['1991'], date: [1991, 12, 26], actor: 'SOV', title: 'The End of the Soviet Union',
      text: 'The Belavezha Accords have been signed. Gorbachev prepares a resignation speech. The red flag over the Kremlin will come down tonight - unless we act.',
      cond: G => exists(G, 'SOV'),
      options: [
        {
          label: 'Dissolve the Union', fx: G => {
            IM.Diplo.release(G, 'SOV', ['UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'TJK', 'KGZ', 'GEO', 'ARM', 'AZE', 'MDA', 'EST', 'LVA', 'LTU'], {
              UKR: { ideo: 'democratic', leader: 'Leonid Kravchuk' }, BLR: { leader: 'Stanislav Shushkevich' }, KAZ: { leader: 'Nursultan Nazarbayev' },
              EST: { ideo: 'democratic' }, LVA: { ideo: 'democratic' }, LTU: { ideo: 'democratic' }, GEO: { leader: 'Zviad Gamsakhurdia' },
            });
            setGov(G, 'SOV', { name: 'Russian Federation', ideo: 'democratic', leader: 'Boris Yeltsin', color: IM.COUNTRY_COLORS.RUS });
          },
        },
        {
          label: 'Preserve the Union at any cost', fx: G => {
            IM.Diplo.release(G, 'SOV', ['EST', 'LVA', 'LTU'], { EST: { ideo: 'democratic' }, LVA: { ideo: 'democratic' }, LTU: { ideo: 'democratic' } });
            const s = byTag(G, 'SOV'); s.stab = Math.max(0, s.stab - 0.25); s.ideo = 'communist';
          },
        },
      ],
    },
    {
      id: 'czech_split', eras: ['1991'], date: [1993, 1, 1], actor: 'CZS', title: 'The Velvet Divorce',
      text: 'Czech and Slovak leaders have agreed to dissolve the federation peacefully.',
      cond: G => exists(G, 'CZS'),
      options: [{ label: 'Go our separate ways', fx: G => { IM.Diplo.release(G, 'CZS', ['SVK'], { SVK: { ideo: 'democratic', leader: 'Michal Kováč' } }); setGov(G, 'CZS', { name: 'Czech Republic' }); } }],
    },
    // ------------------------------------------------------------ 2000
    {
      id: '911', eras: ['2000'], date: [2001, 9, 11], actor: 'USA', title: 'September 11',
      text: 'Hijacked airliners have struck the World Trade Center and the Pentagon. The trail leads to al-Qaeda camps in Taliban-ruled Afghanistan.',
      cond: G => alive(G, 'USA') && alive(G, 'AFG'),
      options: [
        { label: 'Invoke Article 5 - invade Afghanistan', fx: G => { IM.War.declare(G, G.tagId.USA, G.tagId.AFG, 'War in Afghanistan'); byTag(G, 'USA').ws = 0.85; } },
        { label: 'Limited strikes only', fx: G => { byTag(G, 'USA').stab -= 0.1; } },
      ],
    },
    {
      id: 'iraq2003', eras: ['2000'], date: [2003, 3, 20], actor: 'USA', title: 'Shock and Awe',
      text: 'The ultimatum to Saddam Hussein has expired. A coalition force waits in Kuwait.',
      cond: G => alive(G, 'USA') && alive(G, 'IRQ'),
      options: [
        { label: 'Invade Iraq', fx: G => E.limitedWar(G, 'Iraq War', ['USA', 'GBR', 'AUS', 'POL'], ['IRQ']) },
        { label: 'Continue containment', fx: G => {} },
      ],
    },
    {
      id: 'montenegro', eras: ['2000'], date: [2006, 6, 3], actor: 'SRB', title: 'Montenegrin Independence',
      text: 'Montenegro has voted narrowly for independence.',
      cond: G => exists(G, 'SRB'),
      options: [{ label: 'Accept the result', fx: G => { IM.Diplo.release(G, 'SRB', ['MNE'], { MNE: { ideo: 'democratic' } }); setGov(G, 'SRB', { name: 'Serbia' }); } }],
    },
    {
      id: 'georgia2008', eras: ['2000'], date: [2008, 8, 8], actor: 'RUS', title: 'The Five-Day War',
      text: 'Georgian forces have moved into South Ossetia. Our 58th Army is at the Roki Tunnel.',
      cond: G => alive(G, 'RUS') && alive(G, 'GEO') && byTag(G, 'GEO').faction < 0,
      options: [
        { label: 'Strike Georgia', fx: G => E.limitedWar(G, 'Russo-Georgian War', ['RUS'], ['GEO']) },
        { label: 'Diplomatic protest', fx: G => {} },
      ],
    },
    {
      id: 'south_sudan', eras: ['2000'], date: [2011, 7, 9], actor: 'SDN', title: 'South Sudan Independence',
      text: 'After decades of war, South Sudan becomes the world\'s newest nation.',
      cond: G => exists(G, 'SDN'),
      options: [{ label: 'Recognise Juba', fx: G => IM.Diplo.release(G, 'SDN', ['SSD'], { SSD: { leader: 'Salva Kiir' } }) }],
    },
    {
      id: 'crimea', eras: ['2000'], date: [2014, 2, 27], actor: 'RUS', title: 'Polite People',
      text: 'Ukraine\'s president has fled Kyiv. Unmarked soldiers are ready to seize Crimea, and separatists in the Donbas await our support.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && !IM.War.isEnemy(G, G.tagId.RUS, G.tagId.UKR),
      options: [
        {
          label: 'Annex Crimea, back the separatists', fx: G => {
            takeStates(G, ['Simferopol'], 'RUS', ['UKR']);
            const ukr = byTag(G, 'UKR');
            for (const [tag, city, leader] of [['DPR', 'Donetsk', 'Alexander Zakharchenko'], ['LPR', 'Luhansk', 'Igor Plotnitsky']]) {
              const s = G.W.stateByName[city]; if (G.owner[s.id] !== ukr.id) continue;
              const c = IM.Game.addCountry(G, tag, { ideo: 'authoritarian', leader }); c.alive = true;
              G.owner[s.id] = c.id; for (const h of s.hexes) G.ctrl[h] = c.id;
              IM.Game.initReleased(G, c, [s], ukr); c.overlord = G.tagId.RUS;
            }
            for (const t of G.countries) if (t.alive && t.faction >= 0 && G.factions[t.faction].name === 'NATO') byTag(G, 'RUS').sanctionedBy.add(t.id);
            G.relDirty = true; G.mapDirty = true; G.tension += 10;
          },
        },
        { label: 'Respect Ukrainian sovereignty', fx: G => {} },
      ],
    },
    // ------------------------------------------------------------ 2021-2026
    {
      id: 'taliban', eras: ['2021'], date: [2021, 8, 15], actor: 'AFG', title: 'The Fall of Kabul',
      text: 'The last Western troops are leaving. Provincial capitals have fallen one after another, and the Taliban are at the gates of Kabul.',
      cond: G => exists(G, 'AFG'),
      options: [{ label: 'The Islamic Emirate returns', fx: G => setGov(G, 'AFG', { name: 'Islamic Emirate of Afghanistan', ideo: 'authoritarian', leader: 'Hibatullah Akhundzada', stab: 0.5 }) }],
    },
    {
      id: 'invasion2022', eras: ['2021'], date: [2022, 2, 24], actor: 'RUS', title: 'Special Military Operation',
      text: 'Our forces are massed on three sides of Ukraine. The General Staff promises Kyiv in three days.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && !IM.War.isEnemy(G, G.tagId.RUS, G.tagId.UKR),
      options: [
        { label: 'Begin the operation', fx: G => { E.limitedWar(G, 'Russo-Ukrainian War', ['RUS', 'DPR', 'LPR'], ['UKR']); for (const t of G.countries) if (t.alive && t.faction >= 0 && G.factions[t.faction].name === 'NATO') byTag(G, 'RUS').sanctionedBy.add(t.id); } },
        { label: 'Stand down', fx: G => {} },
      ],
    },
    {
      id: 'annex2022', eras: ['2021', '2022'], date: [2022, 9, 30], actor: 'RUS', title: 'The Referendums',
      text: 'Referendums have been held in the occupied territories. The Kremlin prepares to declare them part of Russia.',
      cond: G => alive(G, 'RUS') && G.wars.some(w => w.name === 'Russo-Ukrainian War'),
      options: [
        {
          label: 'Annex the territories', fx: G => {
            const rus = byTag(G, 'RUS');
            for (const t of ['DPR', 'LPR']) if (exists(G, t)) annex(G, t, 'RUS');
            for (const s of G.W.states) if (s.code === 'UKR' && G.ctrl[s.cityHex] === rus.id && G.owner[s.id] !== rus.id) {
              G.owner[s.id] = rus.id;
            }
            G.mapDirty = true; G.relDirty = true;
          },
        },
        { label: 'Keep them as occupied zones', fx: G => {} },
      ],
    },
    {
      id: 'fin_nato', eras: ['2021', '2022'], date: [2023, 4, 4], actor: 'FIN', title: 'Finland Joins NATO',
      text: 'Decades of neutrality end. The Finnish flag is raised in Brussels.',
      cond: G => alive(G, 'FIN') && factionOf(G, 'NATO') >= 0 && byTag(G, 'FIN').faction < 0,
      options: [{ label: 'Welcome to the Alliance', fx: G => joinFactionByName(G, 'FIN', 'NATO') }],
    },
    {
      id: 'swe_nato', eras: ['2021', '2022'], date: [2024, 3, 7], actor: 'SWE', title: 'Sweden Joins NATO',
      text: 'After two centuries of neutrality, Sweden becomes NATO\'s 32nd member.',
      cond: G => alive(G, 'SWE') && factionOf(G, 'NATO') >= 0 && byTag(G, 'SWE').faction < 0,
      options: [{ label: 'Welcome to the Alliance', fx: G => joinFactionByName(G, 'SWE', 'NATO') }],
    },
    {
      id: 'ceasefire', eras: ['2026'], date: [2026, 9, 1], actor: 'RUS', title: 'Ceasefire Talks',
      text: 'Mediators propose freezing the front line where it stands. Both armies are exhausted.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && G.wars.some(w => w.name === 'Russo-Ukrainian War') && !byTag(G, 'UKR').isPlayer,
      options: [
        {
          label: 'Freeze the front', fx: G => {
            const w = G.wars.find(x => x.name === 'Russo-Ukrainian War'); if (!w) return;
            const rus = byTag(G, 'RUS');
            for (const s of G.W.states) if (s.code === 'UKR' && G.ctrl[s.cityHex] === rus.id) G.owner[s.id] = rus.id;
            IM.War.peace(G, w, w.att, w.def, 'white');
          },
        },
        { label: 'Fight on', fx: G => {} },
      ],
    },
    {
      id: 'taiwan', eras: ['2021', '2022', '2026'], date: [2027, 8, 1], actor: 'CHN', title: 'Taiwan Strait Crisis',
      text: 'The PLA has completed its modernisation targets for 2027. Amphibious groups are loading in Fujian. The Central Military Commission awaits the Chairman\'s word.',
      cond: G => alive(G, 'CHN') && alive(G, 'TWN') && !IM.War.atWar(G, G.tagId.CHN),
      options: [
        {
          label: 'Launch the reunification campaign', fx: G => {
            E.limitedWar(G, 'Taiwan Strait War', ['CHN'], ['TWN']);
            if (alive(G, 'USA') && !byTag(G, 'USA').isPlayer && Math.random() < 0.7) {
              const w = G.wars.find(x => x.name === 'Taiwan Strait War'); if (w) { IM.War.joinWar(G, G.tagId.USA, w, 'def'); if (alive(G, 'JPN')) IM.War.joinWar(G, G.tagId.JPN, w, 'def'); IM.Game.news(G, 'The United States intervenes to defend Taiwan!', 'major'); }
            }
          },
        },
        { label: 'Keep up the pressure', fx: G => { G.tension = Math.min(100, G.tension + 10); } },
      ],
      aiChance: 0.35,
    },
  ];
  E.list = EV;

  E.check = function (G) {
    const now = IM.Game.dateOf(G).getTime();
    for (const ev of EV) {
      if (G.firedEvents.has(ev.id) || !ev.eras.includes(G.eraId)) continue;
      const t = Date.UTC(ev.date[0], ev.date[1] - 1, ev.date[2]);
      if (now < t) continue;
      if (now > t + (ev.wait || 120) * 864e5) { G.firedEvents.add(ev.id); continue; } // stale
      if (!ev.cond(G)) { if (!ev.wait) G.firedEvents.add(ev.id); continue; }
      G.firedEvents.add(ev.id);
      const actor = byTag(G, ev.actor);
      if (!actor || !actor.alive) continue;
      if (actor.isPlayer) {
        G.pendingEvents.push({ id: ev.id, actor: true });
      } else {
        const pick = ev.aiChance !== undefined && Math.random() > ev.aiChance ? ev.options.length - 1 : 0;
        ev.options[pick].fx(G);
        G.relDirty = true;
        if (pick === 0 && ev.options.length > 1) {
          IM.Game.news(G, `${ev.title} (${actor.name})`, 'event');
          if (G.player !== null) G.pendingEvents.push({ id: ev.id, actor: false });
        }
      }
    }
  };

  E.resolve = function (G, id, optIndex) {
    const ev = EV.find(e => e.id === id);
    ev.options[optIndex].fx(G);
    G.relDirty = true;
    IM.War.rebuildRelations(G);
    IM.Game.news(G, `${ev.title}: ${ev.options[optIndex].label}`, 'event');
  };
  E.get = id => EV.find(e => e.id === id);
})();
