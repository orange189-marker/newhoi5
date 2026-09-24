// Game rules: equipment, division templates, terrain, technology, laws and national focuses.
window.IM = window.IM || {};

IM.EQUIP = {
  inf: { name: 'Infantry Equipment', modern: 'Small Arms & ATGMs', cost: 0.5 },
  art: { name: 'Artillery', modern: 'Artillery & Rocket Systems', cost: 3.5 },
  mot: { name: 'Trucks', modern: 'Trucks & IFVs', cost: 1.5 },
  arm: { name: 'Tanks', modern: 'Main Battle Tanks', cost: 10 },
  air: { name: 'Aircraft', modern: 'Combat Aircraft', cost: 22 },
  nav: { name: 'Warships', modern: 'Warships', cost: 45 },
  drn: { name: 'Drones', modern: 'Drones', cost: 1.5, requires: 'drones' },
  nuk: { name: 'Nuclear Warheads', modern: 'Nuclear Warheads', cost: 900, requires: 'nukes' },
};
IM.EQUIP_ORDER = ['inf', 'art', 'mot', 'arm', 'air', 'nav', 'drn', 'nuk'];

// Base combat stats before technology.  hp = strength points, hard = armour share.
IM.TEMPLATES = {
  inf: { name: 'Infantry Division', short: 'INF', icon: 'X', mp: 10000, eq: { inf: 1100, art: 36 }, sa: 18, ha: 3, def: 30, brk: 6, org: 60, hp: 25, hard: 0, speed: 4, days: 60 },
  gar: { name: 'Garrison Division', short: 'GAR', icon: 'G', mp: 5000, eq: { inf: 700 }, sa: 7, ha: 1, def: 22, brk: 2, org: 45, hp: 16, hard: 0, speed: 3.5, days: 30 },
  mnt: { name: 'Mountain Division', short: 'MTN', icon: 'M', mp: 9000, eq: { inf: 1000, art: 12 }, sa: 17, ha: 2, def: 30, brk: 7, org: 65, hp: 22, hard: 0, speed: 4, days: 75, terrain: ['hills', 'mountain', 'arctic'] },
  mar: { name: 'Marine Division', short: 'MAR', icon: 'W', mp: 8000, eq: { inf: 1000, art: 12 }, sa: 16, ha: 2, def: 28, brk: 7, org: 65, hp: 20, hard: 0, speed: 4, days: 75, amphibious: true },
  mot: { name: 'Motorized Division', short: 'MOT', icon: 'O', mp: 10000, eq: { inf: 1100, art: 36, mot: 350 }, sa: 19, ha: 3, def: 30, brk: 9, org: 60, hp: 25, hard: 0.1, speed: 11, days: 75, requires: 'motorized' },
  mec: { name: 'Mechanized Division', short: 'MEC', icon: 'Y', mp: 10000, eq: { inf: 900, art: 24, mot: 300, arm: 40 }, sa: 26, ha: 12, def: 40, brk: 26, org: 58, hp: 30, hard: 0.5, speed: 11, days: 90, requires: 'mechanized' },
  arm: { name: 'Armored Division', short: 'ARM', icon: 'A', mp: 9000, eq: { inf: 400, art: 24, mot: 150, arm: 250 }, sa: 36, ha: 30, def: 18, brk: 60, org: 40, hp: 30, hard: 0.75, speed: 10, days: 90 },
};
IM.TEMPLATE_ORDER = ['inf', 'mot', 'mec', 'arm', 'mnt', 'mar', 'gar'];
IM.MODERN_TEMPLATE_NAMES = {
  inf: 'Infantry Brigade Group', gar: 'Territorial Defense', mnt: 'Mountain Brigade Group', mar: 'Marine Brigade Group',
  mot: 'Motor Rifle Division', mec: 'Mechanized Division', arm: 'Tank Division',
};

// Movement speed multiplier and attacker combat penalty per terrain.
IM.TERRAIN = {
  sea: { name: 'Sea', move: 1, atk: 0, color: '#1d3d56' },
  plains: { name: 'Plains', move: 1, atk: 0, color: '#9aa870' },
  forest: { name: 'Forest', move: 0.8, atk: -0.15, color: '#4d7043' },
  hills: { name: 'Hills', move: 0.8, atk: -0.25, color: '#a38e5f' },
  mountain: { name: 'Mountains', move: 0.6, atk: -0.5, color: '#877a6b' },
  desert: { name: 'Desert', move: 0.9, atk: 0, color: '#d6c28c' },
  jungle: { name: 'Jungle', move: 0.6, atk: -0.3, color: '#2f6b3a' },
  marsh: { name: 'Marsh', move: 0.6, atk: -0.4, color: '#5f7c6a' },
  arctic: { name: 'Tundra', move: 0.7, atk: -0.2, color: '#cfd8dc' },
  urban: { name: 'Urban', move: 1, atk: -0.3, color: '#8a8a8a' },
};

// ---------------------------------------------------------------- technology
// Each branch is a ladder; researching a rung applies its effects.
(function () {
  const L = (cat, year, name, fx) => ({ cat, year, name, fx });
  const T = [
    // Infantry weapons
    L('inf', 1918, 'Infantry Equipment I', { inf: 0.0 }), L('inf', 1939, 'Infantry Equipment II', { inf: 0.1 }),
    L('inf', 1942, 'Infantry Equipment III', { inf: 0.1, ha: 0.2 }), L('inf', 1945, 'Assault Rifles', { inf: 0.12, ha: 0.3 }),
    L('inf', 1955, 'Battle Rifles', { inf: 0.08 }), L('inf', 1965, 'Modern Assault Rifles', { inf: 0.1 }),
    L('inf', 1975, 'Anti-Tank Guided Missiles', { inf: 0.08, ha: 1.2 }), L('inf', 1985, 'Night Vision', { inf: 0.1 }),
    L('inf', 1995, 'Integrated Body Armor', { inf: 0.08, def: 0.05 }), L('inf', 2005, 'Networked Soldier', { inf: 0.1, ha: 0.5 }),
    L('inf', 2015, 'Thermal Optics', { inf: 0.1, ha: 0.3 }), L('inf', 2024, 'Next-Gen Squad Weapons', { inf: 0.1 }),
    // Artillery
    L('art', 1934, 'Interwar Artillery', { art: 0 }), L('art', 1938, 'Improved Howitzers', { art: 0.12 }),
    L('art', 1941, 'Rocket Artillery', { art: 0.12 }), L('art', 1944, 'Heavy Artillery', { art: 0.1 }),
    L('art', 1955, 'Self-Propelled Guns', { art: 0.12 }), L('art', 1965, 'Counter-Battery Radar', { art: 0.1 }),
    L('art', 1980, 'Multiple Launch Rocket Systems', { art: 0.15 }), L('art', 1995, 'Guided Rockets', { art: 0.12 }),
    L('art', 2010, 'Precision-Guided Shells', { art: 0.12 }), L('art', 2020, 'Long-Range Precision Fires', { art: 0.15 }),
    // Armour
    L('arm', 1934, 'Light Tanks', { arm: 0 }), L('arm', 1937, 'Medium Tanks', { arm: 0.12 }),
    L('arm', 1940, 'Improved Medium Tanks', { arm: 0.12 }), L('arm', 1942, 'Heavy Tanks', { arm: 0.12 }),
    L('arm', 1945, 'Modern Tanks', { arm: 0.15 }), L('arm', 1955, 'Main Battle Tanks', { arm: 0.12 }),
    L('arm', 1965, 'Second-Generation MBTs', { arm: 0.12 }), L('arm', 1980, 'Third-Generation MBTs', { arm: 0.15 }),
    L('arm', 1990, 'Composite Armor', { arm: 0.1 }), L('arm', 2005, 'Digital Fire Control', { arm: 0.1 }),
    L('arm', 2020, 'Active Protection Systems', { arm: 0.12 }), L('arm', 2025, 'Unmanned Turrets', { arm: 0.1 }),
    // Mobility
    L('mob', 1936, 'Motorized Infantry', { unlock: 'motorized', speed: 0.02 }), L('mob', 1940, 'Mechanized Infantry', { unlock: 'mechanized', speed: 0.03 }),
    L('mob', 1944, 'Halftracks', { speed: 0.05 }), L('mob', 1955, 'Armored Personnel Carriers', { speed: 0.05, def: 0.05 }),
    L('mob', 1970, 'Infantry Fighting Vehicles', { speed: 0.05, brk: 0.05 }), L('mob', 1990, 'Advanced IFVs', { speed: 0.05, brk: 0.05 }),
    L('mob', 2008, 'MRAP & Wheeled Armor', { speed: 0.05, def: 0.05 }), L('mob', 2023, 'Hybrid Drivetrains', { speed: 0.05 }),
    // Air
    L('air', 1936, 'Monoplane Fighters', { air: 0 }), L('air', 1939, 'Close Air Support', { air: 0.12 }),
    L('air', 1942, 'Improved Fighters', { air: 0.12 }), L('air', 1944, 'Jet Engines', { air: 0.15 }),
    L('air', 1950, 'Jet Fighters', { air: 0.12 }), L('air', 1960, 'Supersonic Jets', { air: 0.12 }),
    L('air', 1970, 'Third-Generation Jets', { air: 0.12 }), L('air', 1980, 'Fourth-Generation Jets', { air: 0.15 }),
    L('air', 1995, 'Precision Munitions', { air: 0.12 }), L('air', 2005, 'Stealth Aircraft', { air: 0.15 }),
    L('air', 2015, 'Fifth-Generation Fighters', { air: 0.12 }), L('air', 2025, 'Loyal Wingman Drones', { air: 0.12 }),
    // Naval
    L('nav', 1936, 'Destroyer Escorts', { nav: 0 }), L('nav', 1940, 'Fleet Carriers', { nav: 0.15 }),
    L('nav', 1943, 'Radar Fire Control', { nav: 0.12 }), L('nav', 1950, 'Nuclear Submarines', { nav: 0.15 }),
    L('nav', 1965, 'Guided-Missile Cruisers', { nav: 0.12 }), L('nav', 1980, 'Aegis Combat System', { nav: 0.15 }),
    L('nav', 2000, 'Stealth Frigates', { nav: 0.12 }), L('nav', 2020, 'Hypersonic Anti-Ship Missiles', { nav: 0.15 }),
    // Industry
    L('ind', 1936, 'Basic Machine Tools', { industry: 0.05 }), L('ind', 1938, 'Concentrated Industry', { industry: 0.1 }),
    L('ind', 1940, 'Dispersed Industry', { industry: 0.08, construction: 0.1 }), L('ind', 1943, 'Improved Production Lines', { industry: 0.1 }),
    L('ind', 1950, 'Automation', { industry: 0.1, construction: 0.1 }), L('ind', 1965, 'Numerical Control', { industry: 0.1 }),
    L('ind', 1980, 'Just-in-Time Manufacturing', { industry: 0.1, construction: 0.1 }), L('ind', 1995, 'Industrial Robotics', { industry: 0.1 }),
    L('ind', 2010, 'Additive Manufacturing', { industry: 0.1, construction: 0.1 }), L('ind', 2022, 'AI-Driven Industry', { industry: 0.12 }),
    // Electronics
    L('ele', 1936, 'Radio', { research: 0.03 }), L('ele', 1939, 'Radar', { research: 0.03, air: 0.05 }),
    L('ele', 1942, 'Computing Machines', { research: 0.05 }), L('ele', 1950, 'Transistors', { research: 0.05 }),
    L('ele', 1965, 'Integrated Circuits', { research: 0.05 }), L('ele', 1980, 'Microprocessors', { research: 0.05 }),
    L('ele', 1990, 'The Internet', { research: 0.05 }), L('ele', 2000, 'Cyber Warfare', { unlock: 'cyber', research: 0.03 }),
    L('ele', 2008, 'Military Drones', { unlock: 'drones' }), L('ele', 2018, 'AI Targeting', { drone: 0.2, art: 0.05 }),
    L('ele', 2025, 'Quantum Computing', { research: 0.08 }),
    // Land doctrine
    L('doc', 1936, 'Combined Arms I', { org: 0.0 }), L('doc', 1939, 'Mobile Warfare', { brk: 0.1, speed: 0.02 }),
    L('doc', 1942, 'Deep Battle', { org: 0.08 }), L('doc', 1945, 'Combined Arms II', { brk: 0.05, def: 0.05 }),
    L('doc', 1960, 'Nuclear Battlefield Doctrine', { org: 0.05 }), L('doc', 1980, 'AirLand Battle', { brk: 0.1, air: 0.05 }),
    L('doc', 1995, 'Network-Centric Warfare', { org: 0.08, def: 0.05 }), L('doc', 2015, 'Multi-Domain Operations', { brk: 0.05, org: 0.05 }),
    L('doc', 2023, 'Drone-Saturated Battlefield', { drone: 0.25, def: 0.05 }),
    // Nuclear
    L('nuc', 1945, 'Atomic Bomb', { unlock: 'nukes' }), L('nuc', 1952, 'Thermonuclear Weapons', { nukePower: 0.5 }),
    L('nuc', 1960, 'Intercontinental Missiles', { nukePower: 0.25 }),
  ];
  T.forEach((t, i) => { t.id = t.cat + '_' + t.year; t.index = i; });
  IM.TECHS = T;
  IM.TECH_BY_ID = Object.fromEntries(T.map(t => [t.id, t]));
  IM.TECH_CATS = {
    inf: 'Infantry Weapons', art: 'Artillery', arm: 'Armor', mob: 'Mobility', air: 'Air Power',
    nav: 'Naval', ind: 'Industry', ele: 'Electronics', doc: 'Land Doctrine', nuc: 'Nuclear',
  };
})();

// ---------------------------------------------------------------- laws
IM.LAWS = {
  draft: {
    name: 'Conscription',
    levels: [
      { name: 'Volunteer Only', recruit: 0.015, cost: 0 },
      { name: 'Limited Conscription', recruit: 0.025, cost: 50 },
      { name: 'Extensive Conscription', recruit: 0.05, cost: 75, ws: 0.3 },
      { name: 'Service by Requirement', recruit: 0.1, cost: 100, ws: 0.6, war: true },
    ],
  },
  econ: {
    name: 'Economy',
    levels: [
      { name: 'Civilian Economy', consumer: 0.35, milMod: -0.1, cost: 0 },
      { name: 'Partial Mobilization', consumer: 0.25, milMod: 0, cost: 50 },
      { name: 'War Economy', consumer: 0.15, milMod: 0.1, cost: 75, ws: 0.4 },
      { name: 'Total Mobilization', consumer: 0.08, milMod: 0.15, cost: 100, ws: 0.7, war: true, stab: -0.1 },
    ],
  },
};

// ---------------------------------------------------------------- national focus (shared tree)
// x/y are grid positions for the focus-tree screen.
IM.FOCUSES = [
  { id: 'ind1', name: 'Industrial Expansion', days: 70, x: 1, y: 0, fx: { civ: 2 }, desc: '+2 civilian factories' },
  { id: 'con', name: 'Infrastructure Plan', days: 70, x: 0, y: 1, req: ['ind1'], fx: { construction: 0.15 }, desc: '+15% construction speed' },
  { id: 'ind2', name: 'Armaments Drive', days: 70, x: 1, y: 1, req: ['ind1'], fx: { mil: 2 }, desc: '+2 military factories' },
  { id: 'res1', name: 'Research Institutes', days: 70, x: 2, y: 1, req: ['ind1'], fx: { slot: 1 }, desc: '+1 research slot' },
  { id: 'ind3', name: 'Modern Manufacturing', days: 70, x: 1, y: 2, req: ['ind2'], fx: { industry: 0.1 }, desc: '+10% factory output' },
  { id: 'res2', name: 'Science Academies', days: 70, x: 2, y: 3, req: ['res1', 'ind3'], fx: { slot: 1, research: 0.05 }, desc: '+1 research slot, +5% research speed' },
  { id: 'ind4', name: 'Total Production', days: 70, x: 1, y: 3, req: ['ind3'], fx: { mil: 3, industry: 0.05 }, desc: '+3 military factories, +5% factory output' },
  { id: 'nuke', name: 'Nuclear Program', days: 105, x: 2, y: 4, req: ['res2'], minYear: 1943, fx: { tech: 'nuc_1945' }, desc: 'Completes Atomic Bomb research' },
  { id: 'cyber', name: 'Cyber Command', days: 70, x: 3, y: 2, req: ['res1'], minYear: 1995, fx: { tech: 'ele_2000', pp: 50 }, desc: 'Unlocks cyber operations, +50 political power' },
  { id: 'drone', name: 'Drone Warfare Program', days: 70, x: 3, y: 3, req: ['cyber'], minYear: 2005, fx: { tech: 'ele_2008', grant: { drn: 3000 }, drone: 0.1 }, desc: 'Unlocks drones, +3000 drones, +10% drone effectiveness' },

  { id: 'army1', name: 'Army Reform', days: 70, x: 5, y: 0, fx: { org: 0.05 }, desc: '+5% division organization' },
  { id: 'mob', name: 'Mobilization Plan', days: 70, x: 5, y: 1, req: ['army1'], fx: { manpower: 0.2 }, desc: '+20% recruitable population' },
  { id: 'armor', name: 'Armored Corps', days: 70, x: 6, y: 1, req: ['army1'], fx: { arm: 0.1, grant: { arm: 250, mot: 150 } }, desc: '+10% armor stats, grants a tank division worth of vehicles' },
  { id: 'fort', name: 'National Defense Line', days: 70, x: 4, y: 1, req: ['army1'], fx: { forts: 2 }, desc: '+2 fort levels on every land border hex' },
  { id: 'doct', name: 'Doctrine Review', days: 70, x: 5, y: 2, req: ['mob'], fx: { brk: 0.05, def: 0.05 }, desc: '+5% breakthrough and defense' },
  { id: 'air', name: 'Air Force Expansion', days: 70, x: 6, y: 2, req: ['armor'], fx: { air: 0.1, grant: { air: 300 } }, desc: '+300 aircraft, +10% air effectiveness' },
  { id: 'navy', name: 'Naval Program', days: 70, x: 7, y: 2, req: ['armor'], fx: { nav: 0.1, grant: { nav: 25 } }, desc: '+25 warships, +10% naval effectiveness' },
  { id: 'elite', name: 'Elite Formations', days: 70, x: 5, y: 3, req: ['doct'], fx: { inf: 0.08, org: 0.05 }, desc: '+8% infantry attack, +5% organization' },

  { id: 'pol1', name: 'National Unity', days: 70, x: 8.5, y: 0, fx: { stab: 0.1 }, desc: '+10% stability' },
  { id: 'pol2', name: 'Rally the Nation', days: 70, x: 8, y: 1, req: ['pol1'], fx: { ws: 0.15 }, desc: '+15% war support' },
  { id: 'prop', name: 'Propaganda Ministry', days: 70, x: 9, y: 1, req: ['pol1'], fx: { ppGain: 0.5 }, desc: '+0.5 political power per day' },
  { id: 'claims', name: 'Irredentist Claims', days: 70, x: 8, y: 2, req: ['pol2'], fx: { justify: 0.5 }, desc: 'War goals justify 50% faster' },
  { id: 'dipl', name: 'Diplomatic Offensive', days: 70, x: 9, y: 2, req: ['prop'], fx: { pp: 75 }, desc: '+75 political power' },
  { id: 'ally', name: 'Seek a Great Power Alliance', days: 70, x: 9, y: 3, req: ['dipl'], fx: { joinFaction: true }, desc: 'Join the strongest faction led by a like-minded power' },
  { id: 'total', name: 'Total War Footing', days: 70, x: 8, y: 3, req: ['claims'], fx: { ws: 0.1, stab: 0.05, manpower: 0.1 }, desc: '+10% war support, +5% stability, +10% recruitable population' },
];
IM.FOCUS_BY_ID = Object.fromEntries(IM.FOCUSES.map(f => [f.id, f]));
