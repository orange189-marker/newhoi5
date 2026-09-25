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
  const atWarWith = (G, a, b) => alive(G, a) && alive(G, b) && IM.War.isEnemy(G, G.tagId[a], G.tagId[b]);
  const holds = (G, tag, city) => { const s = G.W.stateByName[city]; return !!s && G.ctrl[s.cityHex] === G.tagId[tag]; };
  const cityHex = (G, city) => G.W.stateByName[city].cityHex;
  // divisions within r hexes of a city that pass a filter
  const divsNear = (G, city, r, pred) => { const h = cityHex(G, city); return G.divisions.filter(d => !d.dead && G.W.hexDist(d.hex, h) <= r && pred(d)); };
  const hurt = (divs, org, str) => { for (const d of divs) { d.org *= 1 - org; if (str) d.str = Math.max(0.1, d.str * (1 - str)); } };
  // land a force on the hexes of a state nearest to a point at sea (lon, lat)
  const landForce = (G, tag, city, lon, lat, tpls) => {
    const c = byTag(G, tag), s = G.W.stateByName[city]; if (!c || !s) return [];
    const from = G.W.hexAt(lon, lat);
    const shore = s.hexes.filter(h => G.W.coastal[h]).sort((a, b) => G.W.hexDist(a, from) - G.W.hexDist(b, from)).slice(0, 3);
    if (!shore.length) return [];
    const out = tpls.map((t, i) => { const d = IM.War.spawnDivision(G, c, t, shore[i % shore.length], 1); c.mpUsed += IM.TEMPLATES[t].mp; return d; });
    for (const h of shore) if (!G.divisions.some(d => d.hex === h && !d.dead && IM.War.isEnemy(G, d.owner, c.id))) G.ctrl[h] = c.id;
    G.mapDirty = true; G.supplyDirty = true;
    return out;
  };
  // history diverges: a headline flagged as alternate history, with what really happened
  E.diverge = function (G, o) {
    G.flags = G.flags || {};
    G.flags.divergences = (G.flags.divergences || 0) + 1;
    IM.Game.headline(G, { type: 'news', alt: true, major: true, tone: 'warn', title: o.title, text: o.text, history: o.history, tags: o.tags || [], art: o.art || { kind: 'flags', flags: o.tags || [] } });
    IM.Game.news(G, `Alternate history: ${o.title.charAt(0) + o.title.slice(1).toLowerCase()}`, 'event');
  };

  const EV = [
    // ------------------------------------------------------------ WWII
    {
      id: 'sov_poland', headline: 'RED ARMY CROSSES INTO POLAND', news: `Soviet troops have crossed Poland's eastern border, claiming to protect the Ukrainian and Belarusian population. With the Polish army already fighting for its life in the west, Poland has been stabbed in the back.`, eras: ['1939'], date: [1939, 9, 17], actor: 'SOV', title: 'The Fourth Partition',
      text: 'With the Polish army collapsing under the German onslaught, the secret protocol of the Molotov-Ribbentrop Pact gives us eastern Poland. Our troops stand ready on the border.',
      cond: G => exists(G, 'POL') && exists(G, 'SOV'),
      history: 'Soviet troops invaded eastern Poland on 17 September 1939 under the secret protocol of the Molotov–Ribbentrop Pact.',
      options: [
        { label: 'Occupy the Kresy', fx: G => takeStates(G, ['Lviv', 'Rivne', 'Brest-Litovsk', 'Grodno', 'Vilnius', 'Bialystok'], 'SOV', ['POL']) },
        { label: 'Honour Polish sovereignty', fx: G => {} },
      ],
    },
    {
      id: 'winter_war', headline: 'SOVIETS ATTACK FINLAND', news: `After Helsinki rejected Moscow's territorial demands, Soviet bombers struck the Finnish capital and the Red Army crossed the border on the Karelian Isthmus. The Finns man the Mannerheim Line.`, eras: ['1939'], date: [1939, 11, 30], actor: 'SOV', title: 'The Winter War',
      text: 'Finland has refused our demands for territory on the Karelian Isthmus. Leningrad lies within artillery range of the border.',
      cond: G => alive(G, 'FIN') && alive(G, 'SOV'),
      history: 'The Soviet Union attacked Finland on 30 November 1939. Finland held out until March 1940 and kept its independence.',
      options: [
        { label: 'Attack Finland', fx: G => E.limitedWar(G, 'Winter War', ['SOV'], ['FIN']) },
        { label: 'Leave Finland be', fx: G => {} },
      ],
    },
    {
      id: 'baltic', headline: 'BALTIC STATES ABSORBED BY THE USSR', news: `Under Soviet ultimatums and occupying garrisons, Estonia, Latvia and Lithuania have been annexed into the Soviet Union. Romania has been forced to cede Bessarabia and northern Bukovina.`, eras: ['1939'], date: [1940, 6, 15], actor: 'SOV', title: 'Ultimatum to the Baltic States',
      text: 'Europe is distracted by the fall of France. The Baltic governments, and Romania over Bessarabia, will not dare refuse us now.',
      cond: G => alive(G, 'SOV') && (alive(G, 'EST') || alive(G, 'LVA') || alive(G, 'LTU')),
      options: [
        { label: 'Annex the Baltics and Bessarabia', fx: G => { for (const t of ['EST', 'LVA', 'LTU']) if (alive(G, t) && byTag(G, t).faction < 0) annex(G, t, 'SOV'); takeStates(G, ['Chisinau', 'Chernivtsi'], 'SOV', ['ROU']); } },
        { label: 'Not yet', fx: G => {} },
      ],
    },
    {
      id: 'vichy', headline: 'FRANCE SIGNS ARMISTICE', news: `In the same railway carriage at Compiègne where Germany surrendered in 1918, French delegates have signed an armistice. Marshal Pétain will govern the unoccupied south and the empire from the spa town of Vichy.`, eras: ['1939'], date: [1940, 5, 1], actor: 'DEU', title: 'An Armistice at Compiègne',
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
      id: 'italy_joins', headline: 'ITALY DECLARES WAR ON BRITAIN AND FRANCE', news: `From the balcony of the Palazzo Venezia, Mussolini has announced Italy's entry into the war at Germany's side as French armies fall back on Paris.`, eras: ['1939'], date: [1940, 6, 10], actor: 'ITA', title: 'The Hand That Held the Dagger',
      text: 'The Wehrmacht is at the gates of Paris. Il Duce believes that a few thousand dead will buy Italy a seat at the peace conference.',
      cond: G => alive(G, 'ITA') && alive(G, 'DEU') && alive(G, 'GBR') && !IM.War.atWar(G, G.tagId.ITA),
      history: 'Italy declared war on Britain and France on 10 June 1940.',
      options: [
        { label: 'Declare war on the Allies', fx: G => joinFactionByName(G, 'ITA', 'Axis') },
        { label: 'Remain non-belligerent', fx: G => {} },
      ],
    },
    {
      id: 'barbarossa', super: 'barbarossa', eras: ['1939'], date: [1941, 6, 22], actor: 'DEU', title: 'Operation Barbarossa',
      text: 'The Führer\'s long-awaited war of annihilation in the East is ready. Three army groups await the signal.',
      cond: G => alive(G, 'DEU') && alive(G, 'SOV') && !IM.War.isEnemy(G, G.tagId.DEU, G.tagId.SOV),
      history: 'Germany invaded the Soviet Union on 22 June 1941.',
      options: [
        { label: 'Launch Barbarossa', fx: G => IM.War.declare(G, G.tagId.DEU, G.tagId.SOV, 'Operation Barbarossa') },
        { label: 'Postpone the invasion', fx: G => {} },
      ],
    },
    {
      id: 'pearl_harbor', super: 'pearl_harbor', eras: ['1939', '1941'], date: [1941, 12, 7], actor: 'JPN', title: 'Climb Mount Niitaka',
      text: 'The American oil embargo is strangling the Empire. The carrier strike force is in position north of Hawaii.',
      cond: G => alive(G, 'JPN') && alive(G, 'USA') && !IM.War.isEnemy(G, G.tagId.JPN, G.tagId.USA),
      history: 'Japan attacked Pearl Harbor on 7 December 1941, bringing the United States into the war.',
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
      id: 'manhattan', super: 'trinity', eras: ['1939', '1941', '1945'], date: [1945, 7, 16], actor: 'USA', title: 'Trinity',
      text: 'In the New Mexico desert, a light brighter than a thousand suns. The Manhattan Project has succeeded.',
      cond: G => alive(G, 'USA'),
      options: [{ label: '"Now I am become Death..."', fx: G => { const u = byTag(G, 'USA'); u.researched.add('nuc_1945'); IM.Game.recomputeMods(G, u); u.stock.nuk += 2; } }],
    },
    {
      id: 'august_storm', headline: 'SOVIET UNION DECLARES WAR ON JAPAN', news: `Honouring its promise at Yalta, the Soviet Union has attacked the Kwantung Army in Manchuria along a front thousands of kilometres long.`, eras: ['1945'], date: [1945, 8, 9], actor: 'SOV', title: 'Operation August Storm',
      text: 'As promised at Yalta, three months after the defeat of Germany we turn east against Japan\'s Kwantung Army.',
      cond: G => alive(G, 'SOV') && alive(G, 'JPN') && !IM.War.isEnemy(G, G.tagId.SOV, G.tagId.JPN) && !IM.War.atWar(G, G.tagId.SOV),
      history: 'The Soviet Union invaded Manchuria on 9 August 1945, days before Japan surrendered.',
      options: [
        { label: 'Attack Manchuria', fx: G => IM.War.declare(G, G.tagId.SOV, G.tagId.JPN, 'Soviet-Japanese War') },
        { label: 'Stay out of the Pacific', fx: G => {} },
      ],
    },
    // ------------------------------------------------------------ 1991
    {
      id: 'warsaw_dissolve', headline: 'WARSAW PACT DISSOLVED', news: `Meeting in Prague, the members of the Warsaw Treaty Organization have formally dissolved the alliance that faced NATO for 36 years.`, eras: ['1991'], date: [1991, 7, 1], actor: 'SOV', title: 'The Warsaw Pact Dissolves',
      text: 'In Prague, the members of the Warsaw Treaty Organization formally dissolve the alliance.',
      cond: G => factionOf(G, 'Warsaw Pact') >= 0,
      options: [{ label: 'An era ends', fx: G => { const fi = factionOf(G, 'Warsaw Pact'); for (const m of G.factions[fi].members) G.countries[m].faction = -1; G.factions[fi].members = []; G.relDirty = true; } }],
    },
    {
      id: 'yugo_breakup', headline: 'SLOVENIA AND CROATIA DECLARE INDEPENDENCE', news: `Ljubljana and Zagreb have proclaimed their independence from Yugoslavia. Federal army tanks are moving toward the new borders, and Europe fears its first war since 1945.`, eras: ['1991'], date: [1991, 6, 25], actor: 'YUG', title: 'Slovenia and Croatia Secede',
      text: 'Ljubljana and Zagreb have declared independence. The Yugoslav People\'s Army is mobilising.',
      cond: G => exists(G, 'YUG'),
      options: [
        { label: 'Let them go, but fight for Croatia', fx: G => { IM.Diplo.release(G, 'YUG', ['SVN', 'HRV', 'MKD'], { HRV: { ideo: 'democratic', leader: 'Franjo Tuđman' }, SVN: { ideo: 'democratic', leader: 'Milan Kučan' }, MKD: { ideo: 'democratic', leader: 'Kiro Gligorov' } }); setGov(G, 'YUG', { name: 'FR Yugoslavia', ideo: 'authoritarian', leader: 'Slobodan Milošević', flag: 'FR_YUG' }); E.limitedWar(G, 'Croatian War of Independence', ['YUG'], ['HRV']); } },
        { label: 'Accept a peaceful dissolution', fx: G => { IM.Diplo.release(G, 'YUG', ['SVN', 'HRV', 'MKD', 'BIH'], {}); setGov(G, 'YUG', { name: 'FR Yugoslavia', ideo: 'authoritarian', flag: 'FR_YUG' }); } },
      ],
    },
    {
      id: 'bosnia', headline: 'SARAJEVO UNDER SIEGE', news: `Bosnia and Herzegovina has declared independence. Bosnian Serb forces backed by Belgrade have surrounded Sarajevo.`, eras: ['1991'], date: [1992, 4, 6], actor: 'YUG', title: 'War in Bosnia',
      text: 'Bosnia and Herzegovina has declared independence. Sarajevo is under siege.',
      cond: G => exists(G, 'YUG') && G.W.states.some(s => s.code === 'BIH' && G.countries[G.owner[s.id]].tag === 'YUG'),
      options: [{ label: 'Release Bosnia', fx: G => IM.Diplo.release(G, 'YUG', ['BIH'], { BIH: { ideo: 'democratic', leader: 'Alija Izetbegović' } }) }],
    },
    {
      id: 'ussr_end', super: 'ussr_end', eras: ['1991'], date: [1991, 12, 26], actor: 'SOV', title: 'The End of the Soviet Union',
      text: 'The Belavezha Accords have been signed. Gorbachev prepares a resignation speech. The red flag over the Kremlin will come down tonight - unless we act.',
      cond: G => exists(G, 'SOV'),
      history: 'The Soviet Union was dissolved on 26 December 1991, and fifteen republics became independent.',
      options: [
        {
          label: 'Dissolve the Union', fx: G => {
            IM.Diplo.release(G, 'SOV', ['UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'TJK', 'KGZ', 'GEO', 'ARM', 'AZE', 'MDA', 'EST', 'LVA', 'LTU'], {
              UKR: { ideo: 'democratic', leader: 'Leonid Kravchuk' }, BLR: { leader: 'Stanislav Shushkevich' }, KAZ: { leader: 'Nursultan Nazarbayev' },
              EST: { ideo: 'democratic' }, LVA: { ideo: 'democratic' }, LTU: { ideo: 'democratic' }, GEO: { leader: 'Zviad Gamsakhurdia' },
            });
            setGov(G, 'SOV', { name: 'Russian Federation', ideo: 'democratic', leader: 'Boris Yeltsin', color: IM.COUNTRY_COLORS.RUS, flag: 'RUS' });
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
      id: 'czech_split', headline: 'CZECHOSLOVAKIA DISSOLVES PEACEFULLY', news: `At midnight Czechoslovakia ceased to exist, succeeded by the Czech Republic and Slovakia — a "Velvet Divorce" without a shot fired.`, eras: ['1991'], date: [1993, 1, 1], actor: 'CZS', title: 'The Velvet Divorce',
      text: 'Czech and Slovak leaders have agreed to dissolve the federation peacefully.',
      cond: G => exists(G, 'CZS'),
      options: [{ label: 'Go our separate ways', fx: G => { IM.Diplo.release(G, 'CZS', ['SVK'], { SVK: { ideo: 'democratic', leader: 'Michal Kováč' } }); setGov(G, 'CZS', { name: 'Czech Republic' }); } }],
    },
    // ------------------------------------------------------------ 2000
    {
      id: '911', super: 'sept11', eras: ['2000'], date: [2001, 9, 11], actor: 'USA', title: 'September 11',
      text: 'Hijacked airliners have struck the World Trade Center and the Pentagon. The trail leads to al-Qaeda camps in Taliban-ruled Afghanistan.',
      cond: G => alive(G, 'USA') && alive(G, 'AFG'),
      history: 'The United States invaded Afghanistan in October 2001 and stayed for twenty years.',
      options: [
        { label: 'Invoke Article 5 - invade Afghanistan', fx: G => { IM.War.declare(G, G.tagId.USA, G.tagId.AFG, 'War in Afghanistan'); byTag(G, 'USA').ws = 0.85; } },
        { label: 'Limited strikes only', fx: G => { byTag(G, 'USA').stab -= 0.1; } },
      ],
    },
    {
      id: 'iraq2003', headline: 'COALITION INVADES IRAQ', news: `American and British forces have crossed from Kuwait into Iraq after a night of strikes on Baghdad. Their stated aim: to disarm Iraq and remove Saddam Hussein.`, eras: ['2000'], date: [2003, 3, 20], actor: 'USA', title: 'Shock and Awe',
      text: 'The ultimatum to Saddam Hussein has expired. A coalition force waits in Kuwait.',
      cond: G => alive(G, 'USA') && alive(G, 'IRQ'),
      history: 'A US-led coalition invaded Iraq on 20 March 2003 and toppled Saddam Hussein within three weeks.',
      options: [
        { label: 'Invade Iraq', fx: G => E.limitedWar(G, 'Iraq War', ['USA', 'GBR', 'AUS', 'POL'], ['IRQ']) },
        { label: 'Continue containment', fx: G => {} },
      ],
    },
    {
      id: 'montenegro', headline: 'MONTENEGRO CHOOSES INDEPENDENCE', news: `By a narrow margin, Montenegrin voters have chosen to leave their union with Serbia.`, eras: ['2000'], date: [2006, 6, 3], actor: 'SRB', title: 'Montenegrin Independence',
      text: 'Montenegro has voted narrowly for independence.',
      cond: G => exists(G, 'SRB'),
      options: [{ label: 'Accept the result', fx: G => { IM.Diplo.release(G, 'SRB', ['MNE'], { MNE: { ideo: 'democratic' } }); setGov(G, 'SRB', { name: 'Serbia', flag: 'SRB' }); } }],
    },
    {
      id: 'georgia2008', headline: 'RUSSIA AND GEORGIA AT WAR', news: `After fighting erupted in South Ossetia, Russian armour has poured through the Roki Tunnel into Georgia.`, eras: ['2000'], date: [2008, 8, 8], actor: 'RUS', title: 'The Five-Day War',
      text: 'Georgian forces have moved into South Ossetia. Our 58th Army is at the Roki Tunnel.',
      cond: G => alive(G, 'RUS') && alive(G, 'GEO') && byTag(G, 'GEO').faction < 0,
      history: 'Russia fought a five-day war with Georgia in August 2008.',
      options: [
        { label: 'Strike Georgia', fx: G => E.limitedWar(G, 'Russo-Georgian War', ['RUS'], ['GEO']) },
        { label: 'Diplomatic protest', fx: G => {} },
      ],
    },
    {
      id: 'south_sudan', headline: 'SOUTH SUDAN IS BORN', news: `After decades of civil war and an overwhelming referendum, South Sudan has become the world's newest nation.`, eras: ['2000'], date: [2011, 7, 9], actor: 'SDN', title: 'South Sudan Independence',
      text: 'After decades of war, South Sudan becomes the world\'s newest nation.',
      cond: G => exists(G, 'SDN'),
      options: [{ label: 'Recognise Juba', fx: G => IM.Diplo.release(G, 'SDN', ['SSD'], { SSD: { leader: 'Salva Kiir' } }) }],
    },
    {
      id: 'crimea', headline: 'RUSSIA ANNEXES CRIMEA', news: `Unmarked soldiers seized Crimea's parliament and airports; after a hastily organised referendum, Moscow has annexed the peninsula. In the Donbas, Russian-backed separatists have proclaimed "people's republics".`, eras: ['2000'], date: [2014, 2, 27], actor: 'RUS', title: 'Polite People',
      text: 'Ukraine\'s president has fled Kyiv. Unmarked soldiers are ready to seize Crimea, and separatists in the Donbas await our support.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && !IM.War.isEnemy(G, G.tagId.RUS, G.tagId.UKR),
      history: 'Russia annexed Crimea in March 2014 and backed separatist “people\'s republics” in the Donbas.',
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
      id: 'taliban', headline: 'KABUL FALLS TO THE TALIBAN', news: `The Afghan government has collapsed as Taliban fighters entered Kabul unopposed. The president has fled, and thousands crowd the airport searching for a way out.`, eras: ['2021'], date: [2021, 8, 15], actor: 'AFG', title: 'The Fall of Kabul',
      text: 'The last Western troops are leaving. Provincial capitals have fallen one after another, and the Taliban are at the gates of Kabul.',
      cond: G => exists(G, 'AFG'),
      options: [{ label: 'The Islamic Emirate returns', fx: G => setGov(G, 'AFG', { name: 'Islamic Emirate of Afghanistan', ideo: 'authoritarian', leader: 'Hibatullah Akhundzada', stab: 0.5, flag: 'AFG_IE' }) }],
    },
    {
      id: 'invasion2022', super: 'invasion2022', eras: ['2021'], date: [2022, 2, 24], actor: 'RUS', title: 'Special Military Operation',
      text: 'Our forces are massed on three sides of Ukraine. The General Staff promises Kyiv in three days.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && !IM.War.isEnemy(G, G.tagId.RUS, G.tagId.UKR),
      history: 'Russia launched its full-scale invasion of Ukraine on 24 February 2022.',
      options: [
        { label: 'Begin the operation', fx: G => { E.limitedWar(G, 'Russo-Ukrainian War', ['RUS', 'DPR', 'LPR'], ['UKR']); for (const t of G.countries) if (t.alive && t.faction >= 0 && G.factions[t.faction].name === 'NATO') byTag(G, 'RUS').sanctionedBy.add(t.id); } },
        { label: 'Stand down', fx: G => {} },
      ],
    },
    {
      id: 'rus_buildup', eras: ['2021'], date: [2021, 10, 20], actor: 'RUS', title: 'Operation Order for the Western Border',
      text: 'The General Staff proposes moving combined-arms armies from Siberia and the Far East to field camps near Ukraine, officially for "snap readiness checks". Once there, the troops can stay for months — and strike at short notice.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR'),
      options: [
        { label: 'Begin the deployment', fx: G => { (G.flags = G.flags || {}).rusBuildup = true; } },
        { label: 'Keep the army in its garrisons', fx: G => { (G.flags = G.flags || {}).rusBuildup = false; } },
      ],
    },
    {
      id: 'ukr_warning', eras: ['2021'], date: [2021, 12, 4], actor: 'UKR', title: 'The Warnings from Washington',
      headline: 'KYIV WEIGHS WESTERN WARNINGS OF INVASION', news: `Ukraine's leadership is studying American and British intelligence on the Russian buildup, while insisting there is no reason for panic.`,
      text: 'The Americans and British are briefing us on a Russian plan for a multi-front offensive early next year. Our own intelligence is less alarmed. Preparing openly could frighten investors and the public — but if the warnings are right, every week counts.',
      cond: G => alive(G, 'UKR') && alive(G, 'RUS') && !IM.War.isEnemy(G, G.tagId.UKR, G.tagId.RUS),
      options: [
        {
          label: 'Quietly fortify the northern and eastern borders (30 PP)', fx: G => {
            const u = byTag(G, 'UKR'); u.pp = Math.max(0, u.pp - 30); u.stab = Math.max(0, u.stab - 0.02);
            const foes = ['RUS', 'BLR', 'DPR', 'LPR'].map(t => G.tagId[t]).filter(x => x !== undefined);
            for (const h of G.W.land) { if (G.ctrl[h] !== u.id) continue; for (const j of G.W.neighbors(h)) if (foes.includes(G.ctrl[j])) { G.fort[h] = Math.min(5, G.fort[h] + 1); break; } }
            u.watchThreats = [G.tagId.RUS];
          },
        },
        { label: 'Avoid panic: keep the economy calm', fx: G => { const u = byTag(G, 'UKR'); u.stab = Math.min(1, u.stab + 0.05); u.pp += 20; } },
      ],
    },
    {
      id: 'ukr_javelins', eras: ['2021'], date: [2022, 1, 25], actor: 'UKR', title: 'Anti-Tank Weapons from Our Partners',
      headline: 'WESTERN ANTI-TANK WEAPONS ARRIVE IN KYIV', news: `Transport aircraft from the United States and Britain are landing at Boryspil with Javelin and NLAW anti-tank missiles, as Western capitals rush defensive weapons to Ukraine.`,
      text: 'Cargo planes from America, Britain and the Baltic states are landing at Boryspil with crates of Javelin and NLAW anti-tank missiles. Instructors are already training our infantry to use them.',
      cond: G => alive(G, 'UKR'),
      options: [{ label: 'Get them to the front', fx: G => { const u = byTag(G, 'UKR'); u.stock.inf += 4000; u.stock.art += 80; u.fmods.ha = (u.fmods.ha || 0) + 0.4; IM.Game.recomputeMods(G, u); } }],
    },
    {
      id: 'rus_recognize', eras: ['2021'], date: [2022, 2, 21], actor: 'RUS', title: 'Recognising the People\'s Republics',
      headline: 'RUSSIA RECOGNISES DONETSK AND LUHANSK "REPUBLICS"', news: `In a televised hour-long address, the Russian president recognises the independence of the two separatist regions and orders troops in as "peacekeepers". Western capitals call it the end of the Minsk agreements.`,
      text: 'The Security Council has spoken, one after another, in favour of recognising the Donetsk and Luhansk People\'s Republics. Recognition would tear up the Minsk agreements and let our troops enter the Donbas openly.',
      cond: G => alive(G, 'RUS') && alive(G, 'UKR') && !IM.War.isEnemy(G, G.tagId.RUS, G.tagId.UKR),
      history: 'Russia recognised the Donetsk and Luhansk “people\'s republics” on 21 February 2022, three days before the invasion.',
      options: [
        { label: 'Sign the decrees', fx: G => { G.tension = Math.min(100, G.tension + 10); const r = byTag(G, 'RUS'); for (const t of G.countries) if (t.alive && t.faction >= 0 && G.factions[t.faction].name === 'NATO') r.sanctionedBy.add(t.id); } },
        { label: 'Keep the Minsk process alive', fx: G => { G.tension = Math.max(0, G.tension - 10); } },
      ],
    },
    {
      id: 'ukr_emergency', eras: ['2021'], date: [2022, 2, 23], actor: 'UKR', title: 'State of Emergency',
      headline: 'UKRAINE DECLARES STATE OF EMERGENCY', news: `Parliament approves a 30-day state of emergency and reservists aged 18 to 60 are called up. Ukrainians in Russia are urged to leave immediately.`,
      text: 'The National Security Council recommends a nationwide state of emergency and the call-up of reservists. The Russian embassy has been evacuated. Diplomats say the attack could come within hours.',
      cond: G => alive(G, 'UKR') && alive(G, 'RUS') && !IM.War.isEnemy(G, G.tagId.UKR, G.tagId.RUS),
      options: [{ label: 'Call up the reserves', fx: G => { const u = byTag(G, 'UKR'); u.laws.draft = Math.max(u.laws.draft, 2); u.ws = Math.min(1, u.ws + 0.1); u.watchThreats = [G.tagId.RUS]; } }],
    },
    {
      id: 'ukr_martial', eras: ['2021', '2022'], date: [2022, 2, 24], actor: 'UKR', title: 'We Are All Here',
      headline: 'ZELENSKYY: "I NEED AMMUNITION, NOT A RIDE"', news: `Ukraine's president has refused offers to evacuate him from Kyiv, declaring general mobilisation as volunteers queue outside recruitment offices across the country.`,
      text: 'Our allies are offering to fly the President out of Kyiv tonight. Outside the Presidential Office, volunteers are queuing for rifles. The world is watching to see whether Ukraine\'s government will stay or go. "The fight is here. I need ammunition, not a ride."',
      wait: 30, cond: G => alive(G, 'UKR') && alive(G, 'RUS') && IM.War.isEnemy(G, G.tagId.UKR, G.tagId.RUS),
      history: 'President Zelenskyy stayed in Kyiv: “The fight is here; I need ammunition, not a ride.”',
      options: [
        { label: '"We are all here." Defend Kyiv, general mobilisation', fx: G => { const u = byTag(G, 'UKR'); u.laws.draft = 3; u.ws = Math.min(1, u.ws + 0.1); u.stab = Math.min(1, u.stab + 0.05); u.pp += 40; IM.Game.raiseMilitia(G, u, 6); } },
        { label: 'Move the government to Lviv', fx: G => { const u = byTag(G, 'UKR'); const l = G.W.stateByName.Lviv; if (G.owner[l.id] === u.id) u.capital = l.id; u.stab = Math.max(0, u.stab - 0.05); IM.Game.raiseMilitia(G, u, 3); } },
      ],
    },
    {
      id: 'annex2022', headline: 'RUSSIA ANNEXES OCCUPIED UKRAINIAN REGIONS', news: `After referendums condemned around the world, the Kremlin has declared the occupied regions of Ukraine part of Russia.`, eras: ['2021', '2022'], date: [2022, 9, 30], actor: 'RUS', title: 'The Referendums',
      text: 'Referendums have been held in the occupied territories. The Kremlin prepares to declare them part of Russia.',
      cond: G => alive(G, 'RUS') && G.wars.some(w => w.name === 'Russo-Ukrainian War'),
      history: 'Russia declared the annexation of four partly occupied Ukrainian regions on 30 September 2022.',
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
      id: 'fin_nato', headline: 'FINLAND JOINS NATO', news: `Ending decades of military non-alignment, Finland has become NATO's 31st member, doubling the alliance's border with Russia.`, eras: ['2021', '2022'], date: [2023, 4, 4], actor: 'FIN', title: 'Finland Joins NATO',
      text: 'Decades of neutrality end. The Finnish flag is raised in Brussels.',
      cond: G => alive(G, 'FIN') && factionOf(G, 'NATO') >= 0 && byTag(G, 'FIN').faction < 0,
      options: [{ label: 'Welcome to the Alliance', fx: G => joinFactionByName(G, 'FIN', 'NATO') }],
    },
    {
      id: 'swe_nato', headline: 'SWEDEN JOINS NATO', news: `Two centuries of Swedish neutrality end as Sweden becomes NATO's 32nd member.`, eras: ['2021', '2022'], date: [2024, 3, 7], actor: 'SWE', title: 'Sweden Joins NATO',
      text: 'After two centuries of neutrality, Sweden becomes NATO\'s 32nd member.',
      cond: G => alive(G, 'SWE') && factionOf(G, 'NATO') >= 0 && byTag(G, 'SWE').faction < 0,
      options: [{ label: 'Welcome to the Alliance', fx: G => joinFactionByName(G, 'SWE', 'NATO') }],
    },
    {
      id: 'ceasefire', headline: 'CEASEFIRE IN UKRAINE', news: `After years of war, Russia and Ukraine have agreed to freeze the front line where it stands.`, eras: ['2026'], date: [2026, 9, 1], actor: 'RUS', title: 'Ceasefire Talks',
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
      id: 'taiwan', super: 'taiwan', eras: ['2021', '2022', '2026'], date: [2027, 8, 1], actor: 'CHN', title: 'Taiwan Strait Crisis',
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
    // ------------------------------------------------------------ turning points
    {
      id: 'dunkirk', eras: ['1939'], date: [1940, 5, 28], actor: 'GBR', title: 'Operation Dynamo',
      headline: 'THE ARMY COMES HOME FROM DUNKIRK', news: `Under a pall of smoke from the burning oil tanks, destroyers, ferries and hundreds of little ships are lifting the British Expeditionary Force off the beaches at Dunkirk. The equipment is lost; the men are coming home.`,
      text: 'The panzers have reached the Channel and the BEF is trapped around Dunkirk. The Admiralty proposes to evacuate the army in anything that floats.',
      cond: G => atWarWith(G, 'GBR', 'DEU') && (holds(G, 'DEU', 'Brussels') || holds(G, 'DEU', 'Lille')),
      history: 'Between 26 May and 4 June 1940, 338,000 Allied soldiers were evacuated from Dunkirk, and Britain fought on.',
      options: [
        { label: 'Evacuate the army', fx: G => { const b = byTag(G, 'GBR'); b.ws = Math.min(1, b.ws + 0.1); b.stock.inf = Math.round(b.stock.inf * 0.8); b.stock.art = Math.round(b.stock.art * 0.7); } },
        { label: 'Stand and fight in Flanders', fx: G => { const b = byTag(G, 'GBR'); b.ws = Math.min(1, b.ws + 0.05); } },
      ],
    },
    {
      id: 'moscow_counter', eras: ['1939', '1941'], date: [1941, 12, 5], actor: 'SOV', title: 'The Counteroffensive before Moscow',
      headline: 'RED ARMY COUNTERATTACKS BEFORE MOSCOW', news: `In forty degrees of frost, fresh Siberian divisions have struck the exhausted German armies at the gates of Moscow. The Wehrmacht, without winter clothing, is falling back for the first time in the war.`,
      text: 'The Germans are within sight of the Kremlin, frozen and exhausted. Fresh divisions from Siberia have arrived. Zhukov asks for permission to strike.',
      cond: G => atWarWith(G, 'SOV', 'DEU') && holds(G, 'SOV', 'Moscow') && divsNear(G, 'Moscow', 10, d => d.owner === G.tagId.DEU).length > 0,
      alt: {
        cond: G => atWarWith(G, 'SOV', 'DEU') && !holds(G, 'SOV', 'Moscow'),
        title: 'NO MIRACLE BEFORE MOSCOW', tags: ['DEU', 'SOV'],
        text: 'Winter has come, but the Soviet capital is no longer in Soviet hands. The government runs the war from Kuibyshev on the Volga while German troops dig in among the ruins of Moscow.',
        history: 'On 5 December 1941 the Red Army counterattacked before Moscow and drove the Wehrmacht back up to 250 km. It was Germany\'s first major defeat on land.',
      },
      options: [
        {
          label: 'Unleash the Siberian divisions', fx: G => {
            const sov = byTag(G, 'SOV');
            hurt(divsNear(G, 'Moscow', 10, d => IM.War.isEnemy(G, d.owner, sov.id)), 0.45);
            for (let i = 0; i < 6; i++) IM.War.spawnDivision(G, sov, i % 3 ? 'inf' : 'mnt', cityHex(G, 'Moscow'), 1).name = `${[78, 32, 93, 239, 82, 107][i]}th Siberian Rifle`;
          },
        },
      ],
    },
    {
      id: 'uranus', super: 'stalingrad', eras: ['1939', '1941'], date: [1942, 11, 19], actor: 'SOV', title: 'Operation Uranus',
      text: 'The Sixth Army is bleeding in the ruins of Stalingrad. Its flanks are held by thinly stretched Romanian armies. The Stavka has massed a million men north and south of the city.',
      cond: G => atWarWith(G, 'SOV', 'DEU') && holds(G, 'SOV', 'Stalingrad') && divsNear(G, 'Stalingrad', 12, d => IM.War.isEnemy(G, d.owner, G.tagId.SOV)).length > 0,
      alt: {
        cond: G => atWarWith(G, 'SOV', 'DEU') && !holds(G, 'SOV', 'Stalingrad'),
        title: 'THE SWASTIKA OVER THE VOLGA', tags: ['DEU', 'SOV'],
        text: 'Stalingrad has fallen. With the Volga cut, oil from the Caucasus can no longer reach the Soviet heartland by river, and Berlin radio speaks of the decisive victory in the East.',
        history: 'The Sixth Army was encircled at Stalingrad on 19 November 1942 and surrendered on 2 February 1943.',
      },
      history: 'Operation Uranus trapped about 290,000 Axis soldiers at Stalingrad. Fewer than 6,000 ever came home.',
      options: [
        {
          label: 'Close the ring', fx: G => {
            const sov = byTag(G, 'SOV');
            hurt(divsNear(G, 'Stalingrad', 9, d => IM.War.isEnemy(G, d.owner, sov.id)), 0.6, 0.25);
            const tpls = sov.mods.mechanized ? ['arm', 'arm', 'mec', 'inf', 'inf', 'inf'] : ['inf', 'inf', 'inf', 'mnt', 'inf', 'inf'];
            for (const t of tpls) IM.War.spawnDivision(G, sov, t, cityHex(G, 'Stalingrad'), 1);
            sov.ws = Math.min(1, sov.ws + 0.1);
            const deu = byTag(G, 'DEU'); if (deu) deu.stab = Math.max(0, deu.stab - 0.06);
          },
        },
        { label: 'Wait for the spring', fx: G => {} },
      ],
    },
    {
      id: 'overlord', super: 'dday', eras: ['1939', '1941'], date: [1944, 6, 6], actor: 'USA', title: 'Operation Overlord',
      text: 'The largest amphibious force in history is loaded in the ports of southern England. The weather will clear for a few hours on the 6th. General Eisenhower must decide.',
      cond: G => atWarWith(G, 'USA', 'DEU') && alive(G, 'GBR') && holds(G, 'GBR', 'London') && (holds(G, 'DEU', 'Rouen') || holds(G, 'VIC', 'Rouen')),
      alt: {
        cond: G => atWarWith(G, 'GBR', 'DEU') && !holds(G, 'GBR', 'London'),
        title: 'NO SECOND FRONT', tags: ['GBR', 'DEU'],
        text: 'With London under German occupation, there is no island fortress from which to invade Europe. The armies that should have sailed for Normandy wait in Canada and the United States.',
        history: 'On 6 June 1944, 156,000 Allied troops landed in Normandy and opened the second front in the West.',
      },
      history: 'Eisenhower launched Overlord on 6 June 1944 after a one-day postponement. Paris was liberated eleven weeks later.',
      options: [
        {
          label: 'OK, let\'s go', fx: G => {
            landForce(G, 'USA', 'Rouen', -1.2, 49.6, ['mar', 'mar', 'inf', 'inf', 'arm', 'inf']);
            landForce(G, 'GBR', 'Rouen', -0.3, 49.6, ['mar', 'inf', 'inf', 'arm']);
            if (alive(G, 'CAN')) landForce(G, 'CAN', 'Rouen', -0.4, 49.6, ['inf']);
            hurt(divsNear(G, 'Rouen', 4, d => d.owner === G.tagId.DEU), 0.35);
          },
        },
        { label: 'Postpone for better weather', fx: G => {} },
      ],
    },
    {
      id: 'moskva', eras: ['2021', '2022'], date: [2022, 4, 14], actor: 'UKR', title: 'Two Neptunes',
      headline: 'FLAGSHIP MOSKVA SINKS IN THE BLACK SEA', news: `The Russian Black Sea Fleet's flagship, the missile cruiser Moskva, has sunk. Ukraine says two Neptune anti-ship missiles hit her off Odesa; Moscow speaks of a fire and an ammunition explosion.`,
      text: 'Our coastal battery near Odesa has the enemy flagship in its sights.',
      cond: G => atWarWith(G, 'UKR', 'RUS'),
      options: [{ label: 'Fire', fx: G => { const r = byTag(G, 'RUS'); r.stock.nav = Math.round(r.stock.nav * 0.96); r.ws = Math.max(0, r.ws - 0.03); const u = byTag(G, 'UKR'); u.ws = Math.min(1, u.ws + 0.05); } }],
    },
    {
      id: 'kharkiv_counter', eras: ['2021', '2022'], date: [2022, 9, 6], actor: 'UKR', title: 'The Kharkiv Counteroffensive',
      headline: 'UKRAINE BREAKS THROUGH NEAR KHARKIV', news: `Ukrainian forces have broken through thinly held Russian lines east of Kharkiv, advancing tens of kilometres in days and retaking Balakliia, Kupiansk and Izium. Abandoned tanks line the roads.`,
      text: 'The enemy has stripped the Kharkiv front to reinforce Kherson. Our reconnaissance sees a line of checkpoints, not a defence.',
      cond: G => atWarWith(G, 'UKR', 'RUS') && holds(G, 'UKR', 'Kharkiv') && G.W.stateByName.Kharkiv.hexes.some(h => G.ctrl[h] === G.tagId.RUS),
      alt: {
        cond: G => atWarWith(G, 'UKR', 'RUS') && holds(G, 'RUS', 'Kharkiv'),
        title: 'KHARKIV UNDER THE RUSSIAN FLAG', tags: ['RUS', 'UKR'],
        text: 'Ukraine\'s second city is under occupation this September. Its metro stations, which sheltered thousands in the spring, are now Russian command posts.',
        history: 'Kharkiv never fell. In September 2022 a Ukrainian counteroffensive liberated almost all of Kharkiv oblast in a week.',
      },
      options: [{
        label: 'Attack', fx: G => {
          const u = byTag(G, 'UKR'), rus = G.tagId.RUS;
          hurt(divsNear(G, 'Kharkiv', 6, d => d.owner === rus), 0.5, 0.1);
          for (const d of divsNear(G, 'Kharkiv', 6, d => d.owner === u.id)) d.org = IM.War.stats(G, d).org;
        },
      }],
    },
    {
      id: 'kerch', super: 'kerch', eras: ['2021', '2022'], date: [2022, 10, 8], actor: 'UKR', title: 'The Crimean Bridge',
      text: 'The Kerch bridge carries almost every train and truck that supplies the Russian army in southern Ukraine. The security service has a plan.',
      cond: G => atWarWith(G, 'UKR', 'RUS') && holds(G, 'RUS', 'Simferopol'),
      history: 'On 8 October 2022 a truck bomb brought down two road spans of the Kerch bridge and set a fuel train ablaze. It took months to repair.',
      options: [
        {
          label: 'Hit the bridge', fx: G => {
            G.flags = G.flags || {}; G.flags.kerchUntil = G.hour + 24 * 50;
            const rus = G.tagId.RUS, south = ['Simferopol', 'Kherson', 'Zaporizhzhia'];
            hurt(G.divisions.filter(d => d.owner === rus && G.W.region[d.hex] && south.includes(G.W.states[G.W.stateOf[d.hex]].name)), 0.25);
            const r = byTag(G, 'RUS'); r.stab = Math.max(0, r.stab - 0.03);
            G.supplyDirty = true;
          },
        },
        { label: 'Too risky', fx: G => {} },
      ],
    },
    {
      id: 'energy_strikes', eras: ['2021', '2022'], date: [2022, 10, 10], actor: 'RUS', title: 'Strikes on the Grid',
      headline: 'MISSILES RAIN ON UKRAINE\'S POWER STATIONS', news: `In the largest barrage since February, Russian missiles and drones have hit power stations and substations across Ukraine. Blackouts roll through Kyiv, Lviv and Kharkiv as winter approaches.`,
      text: 'The General Staff proposes a campaign against Ukraine\'s energy grid to freeze the country before winter.',
      cond: G => atWarWith(G, 'RUS', 'UKR'),
      history: 'From October 2022 Russia struck Ukraine\'s energy system in waves of missiles and Shahed drones. Nearly half of it was damaged by winter.',
      options: [
        { label: 'Target the grid', fx: G => { const u = byTag(G, 'UKR'); u.stab = Math.max(0, u.stab - 0.04); u.cyberDays = Math.max(u.cyberDays, 5); G.tension = Math.min(100, G.tension + 4); } },
        { label: 'Stick to military targets', fx: G => {} },
      ],
    },
    {
      id: 'kherson_out', eras: ['2021', '2022'], date: [2022, 11, 9], actor: 'RUS', title: 'Withdrawal from Kherson',
      headline: 'RUSSIA PULLS OUT OF KHERSON', news: `Russia's defence minister has ordered troops back across the Dnipro. Two days later, Ukrainian soldiers are met with flags and tears in the centre of Kherson, the only regional capital Russia had captured since February.`,
      text: 'General Surovikin reports that our bridgehead on the right bank of the Dnipro can no longer be supplied. He proposes a withdrawal to the left bank.',
      cond: G => atWarWith(G, 'RUS', 'UKR') && holds(G, 'RUS', 'Kherson'),
      alt: {
        cond: G => atWarWith(G, 'RUS', 'UKR') && holds(G, 'UKR', 'Kherson'),
        title: 'KHERSON NEVER FELL', tags: ['UKR', 'RUS'],
        text: 'The Russian drive out of Crimea stalled before Kherson. The city on the Dnipro has spent the war under the Ukrainian flag.',
        history: 'Kherson fell on 2 March 2022, the only regional capital Russia captured that year. It was liberated on 11 November 2022.',
      },
      history: 'Russia announced its withdrawal from Kherson on 9 November 2022. Ukrainian troops entered the city on the 11th.',
      options: [
        {
          label: 'Withdraw across the Dnipro', fx: G => {
            const rus = G.tagId.RUS, ukr = G.tagId.UKR, s = G.W.stateByName.Kherson;
            const back = G.W.stateByName.Simferopol.cityHex;
            for (const d of G.divisions.filter(d => d.owner === rus && G.W.stateOf[d.hex] === s.id && d.battle < 0)) { d.path = []; d.hex = back; }
            for (const h of s.hexes) if (G.ctrl[h] === rus && G.owner[s.id] === ukr && !G.divisions.some(d => d.hex === h && d.owner === rus && !d.dead)) G.ctrl[h] = ukr;
            G.mapDirty = true; G.supplyDirty = true;
          },
        },
        { label: 'Hold the bridgehead at all costs', fx: G => { const r = byTag(G, 'RUS'); r.ws = Math.min(1, r.ws + 0.03); } },
      ],
    },
    {
      id: 'kursk2024', super: 'kursk2024', eras: ['2021', '2022'], date: [2024, 8, 6], actor: 'UKR', title: 'Operation in Kursk Oblast',
      text: 'The Russian border opposite Sumy is held by conscripts and border guards. A strike into Russia itself would force the enemy to pull troops out of the Donbas, and give us something to trade at the table.',
      cond: G => atWarWith(G, 'UKR', 'RUS') && holds(G, 'UKR', 'Sumy') && holds(G, 'RUS', 'Kursk'),
      aiChance: 0.8,
      history: 'On 6 August 2024 Ukrainian brigades crossed into Kursk oblast, the first invasion of Russian territory since 1941. Russia retook the area by spring 2025.',
      options: [
        {
          label: 'Cross the border', fx: G => {
            const u = byTag(G, 'UKR'), rus = G.tagId.RUS, W = G.W, k = W.stateByName.Kursk;
            const free = h => !G.divisions.some(d => d.hex === h && d.owner === rus && !d.dead);
            // a salient two hexes deep along the border with Sumy
            for (let ring = 0; ring < 2; ring++) {
              const front = k.hexes.filter(h => G.ctrl[h] === rus && [...W.neighbors(h)].some(j => G.ctrl[j] === u.id));
              for (const h of front) if (free(h)) G.ctrl[h] = u.id;
            }
            const taken = k.hexes.filter(h => G.ctrl[h] === u.id);
            if (taken.length) for (const t of ['mec', 'mec', 'arm', 'inf']) { IM.War.spawnDivision(G, u, t, taken[Math.floor(taken.length / 2)], 1); u.mpUsed += IM.TEMPLATES[t].mp; }
            const r = byTag(G, 'RUS'); r.stab = Math.max(0, r.stab - 0.05);
            u.ws = Math.min(1, u.ws + 0.08);
            G.mapDirty = true; G.supplyDirty = true;
          },
        },
        { label: 'Keep our reserves for the Donbas', fx: G => {} },
      ],
    },
  ];
  E.list = EV;

  // ------------------------------------------------------------ background news timelines
  E.WATCH_LEVELS = [[60000, 'Low'], [110000, 'Elevated'], [150000, 'High'], [Infinity, 'Severe']];
  E.checkTimeline = function (G, now) {
    const tl = (IM.TIMELINES || {})[G.eraId];
    if (!tl) return;
    const done = G.tlDone || (G.tlDone = []);
    const tgt = tl.watch && byTag(G, tl.watch.target), thr = tl.watch && tl.watch.threat.map(t => byTag(G, t)).filter(Boolean);
    const atWar = tgt && thr.some(t => IM.War.isEnemy(G, t.id, tgt.id));
    if (tl.watch && !G.watch) G.watch = { title: tl.watch.title, subject: tl.watch.subject, est: 20000, hist: [[G.hour, 20000]], target: tl.watch.target, threat: tl.watch.threat };
    if (G.watch && atWar && !G.watch.war) { G.watch.war = true; G.camps = []; G.mapDirty = true; }
    tl.items.forEach((it, i) => {
      if (done.includes(i)) return;
      const t = Date.UTC(it.date[0], it.date[1] - 1, it.date[2]);
      if (now < t) return;
      done.push(i);
      if (now > t + 20 * 864e5 || atWar) return;
      if (it.watch && G.watch) { G.watch.est = it.watch; G.watch.hist.push([G.hour, it.watch]); }
      if (it.tension) G.tension = Math.min(100, G.tension + it.tension);
      if (it.stage) E.stage(G, it.stage);
      if (it.camps) { G.camps = G.camps || []; for (const [city, lvl] of Object.entries(it.camps)) { const c = G.camps.find(x => x.city === city); if (c) c.level = Math.max(c.level, lvl); else G.camps.push({ city, level: lvl }); } G.mapDirty = true; }
      if (it.effect === 'cyberUKR') { const u = byTag(G, 'UKR'); if (u) u.cyberDays = Math.max(u.cyberDays, 10); }
      if (tgt && it.tone !== 'calm' && it.watch >= 90000 && !tgt.isPlayer) tgt.watchThreats = thr.map(x => x.id);
      { const first = it.text.split(/(?<=\.)\s/)[0]; IM.Game.news(G, first.length > 120 ? first.slice(0, 117) + '…' : first, it.tone === 'alarm' ? 'bad' : 'info'); }
      IM.Game.headline(G, { type: 'news', tone: it.tone, major: it.tone !== 'calm', title: it.title, text: it.text, art: it.art, tags: (it.art && it.art.flags) || (it.art && it.art.red ? [it.art.red[0], it.art.blue[0]] : []) });
    });
  };
  E.watchLevel = est => E.WATCH_LEVELS.find(([m]) => est < m)[1];

  // Move Russian divisions (AI, or the player once they approve the deployment) to staging areas.
  E.stage = function (G, stage) {
    const r = byTag(G, 'RUS');
    if (!r || !r.alive || (r.isPlayer && !(G.flags && G.flags.rusBuildup))) return;
    for (const [city, n] of Object.entries(stage)) {
      const st = G.W.stateByName[city]; if (!st) continue;
      const target = st.cityHex;
      const pool = G.divisions.filter(d => d.owner === r.id && !d.staged && d.battle < 0).sort((a, b) => G.W.hexDist(a.hex, target) - G.W.hexDist(b.hex, target));
      for (let k = 0; k < n; k++) {
        let d = pool.shift();
        if (!d || G.W.hexDist(d.hex, target) < 3) {
          const tpl = k % 3 === 2 ? 'arm' : 'mec';
          d = IM.War.spawnDivision(G, r, r.mods.mechanized ? tpl : 'inf', IM.Game.deployHex(G, r), 1);
          r.mpUsed += IM.TEMPLATES[d.tpl].mp;
        }
        d.staged = true; d.auto = !r.isPlayer;
        IM.War.orderMove(G, [d], target);
      }
    }
  };

  E.check = function (G) {
    const now = IM.Game.dateOf(G).getTime();
    E.checkTimeline(G, now);
    for (const ev of EV) {
      if (G.firedEvents.has(ev.id) || !ev.eras.includes(G.eraId)) continue;
      const t = Date.UTC(ev.date[0], ev.date[1] - 1, ev.date[2]);
      if (now < t) continue;
      if (now > t + (ev.wait || 120) * 864e5) { G.firedEvents.add(ev.id); continue; } // stale
      if (!ev.cond(G)) {
        if (!ev.wait) { G.firedEvents.add(ev.id); if (ev.alt && ev.alt.cond(G)) E.diverge(G, ev.alt); }
        continue;
      }
      G.firedEvents.add(ev.id);
      const actor = byTag(G, ev.actor);
      if (!actor || !actor.alive) continue;
      if (actor.isPlayer) {
        G.pendingEvents.push({ id: ev.id, actor: true });
      } else {
        const pick = ev.aiChance !== undefined && Math.random() > ev.aiChance ? ev.options.length - 1 : 0;
        G._eventFiring = true;
        try { ev.options[pick].fx(G); } finally { G._eventFiring = false; }
        G.relDirty = true;
        if (pick === 0) E.announce(G, ev, actor);
        else if (ev.history) otherPath(G, ev, actor, pick, false);
      }
    }
  };

  // Tell the player about an event that happened: a super event or a news story.
  E.announce = function (G, ev, actor) {
    if (ev.super) IM.Game.headline(G, { type: 'super', key: ev.super, tags: [ev.actor] });
    else if (ev.headline) IM.Game.headline(G, { type: 'news', title: ev.headline, text: ev.news, tags: [ev.actor], major: true, art: { kind: 'flags', flags: [ev.actor] } });
    if (ev.options.length > 1 || ev.super) IM.Game.news(G, `${ev.title} (${actor.name})`, 'event');
  };

  // someone took a road history did not
  function otherPath(G, ev, actor, pick, mine) {
    const label = ev.options[pick].label.replace(/\s*\(.*\)$/, '');
    E.diverge(G, {
      title: ev.title.toUpperCase(), tags: [ev.actor],
      text: mine ? `We have chosen a different path: “${label}”.` : `${actor.name} has chosen a different path: “${label}”. Diplomats and generals around the world are redrawing their plans.`,
      history: ev.history,
    });
  }
  E.resolve = function (G, id, optIndex) {
    const ev = EV.find(e => e.id === id);
    G._eventFiring = true;
    try { ev.options[optIndex].fx(G); } finally { G._eventFiring = false; }
    if (optIndex === 0 && ev.super) IM.Game.headline(G, { type: 'super', key: ev.super, tags: [ev.actor] });
    if (optIndex > 0 && ev.history) otherPath(G, ev, IM.Game.byTag(G, ev.actor), optIndex, true);
    G.relDirty = true;
    IM.War.rebuildRelations(G);
    IM.Game.news(G, `${ev.title}: ${ev.options[optIndex].label}`, 'event');
  };
  E.get = id => EV.find(e => e.id === id);
})();
