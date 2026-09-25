// Super events: full-screen moments for turning points of history.
// art.kind: 'map' (region with attack arrows), 'nuke', 'navy', 'city', 'flags'.
// axes are [fromCity, toCity] pairs drawn as arrows; red/blue are the sides.
// titleFor / textFor give a nation-specific version for the player.
window.IM = window.IM || {};

IM.SUPERS = {
  poland1939: {
    title: 'The Invasion of Poland',
    time: '04:45',
    quote: 'I have to tell you now that no such undertaking has been received, and that consequently this country is at war with Germany.',
    quoteBy: 'Neville Chamberlain, 3 September 1939',
    text: 'At 04:45 the old battleship Schleswig-Holstein opens fire on the Polish depot at Westerplatte. Minutes later, fifty-six German divisions cross the frontier from Pomerania, East Prussia, Silesia and Slovakia. Stukas scream down on bridges, rail junctions and airfields while panzer columns race for the Vistula. Poland\'s army fights hard along the border, but its flanks are already turned. Two days later, Britain and France honour their guarantee. The Second World War has begun.',
    textFor: {
      POL: 'At 04:45 the guns of the Schleswig-Holstein open fire on Westerplatte. Across the whole length of our western frontier, from Pomerania to the Carpathians, German armour and infantry are pouring into Poland, and the Luftwaffe is bombing our airfields, bridges and cities. The Army must hold the line of the Vistula and buy time until Britain and France can strike in the west. Warsaw will not surrender.',
      DEU: 'At 04:45 the Schleswig-Holstein opens fire on Westerplatte, and Fall Weiss begins. Army Group North drives from Pomerania and East Prussia to cut the Corridor; Army Group South strikes from Silesia and Slovakia toward Kraków and Warsaw. Poland must be destroyed before the Western powers can act.',
    },
    art: { kind: 'map', focus: 'Warsaw', span: 22, red: ['DEU', 'SVK'], blue: ['POL'], strikes: [['Olsztyn', 'Warsaw'], ['Wroclaw', 'Krakow'], ['Szczecin', 'Poznan'], ['Wroclaw', 'Lodz']], axes: [['Olsztyn', 'Warsaw'], ['Szczecin', 'Poznan'], ['Gdansk', 'Bialystok'], ['Wroclaw', 'Lodz'], ['Bratislava', 'Krakow']] },
  },
  barbarossa: {
    title: 'Operation Barbarossa',
    time: '03:15',
    quote: 'We have only to kick in the door and the whole rotten structure will come crashing down.',
    quoteBy: 'Adolf Hitler (attributed)',
    text: 'At 03:15 on the shortest night of the year, the largest invasion force in history crosses into the Soviet Union along a front from the Baltic to the Black Sea. Three army groups — North toward Leningrad, Centre toward Moscow, South toward Kyiv — drive deep into the Red Army\'s forward positions. Hundreds of Soviet aircraft are destroyed on the ground before they can take off. Stalin\'s refusal to believe the warnings has left his armies caught mid-deployment.',
    textFor: {
      SOV: 'Before dawn, German artillery opens fire along the entire western frontier. Our airfields have been bombed; entire air regiments are burning on the ground. Panzer groups are already deep behind the border armies near Brest and Grodno. Comrade Molotov will speak to the nation at noon: "Our cause is just. The enemy will be beaten. Victory will be ours." Trade space for time — and hold Moscow.',
    },
    art: { kind: 'map', focus: 'Minsk', span: 40, red: ['DEU', 'ROU', 'HUN', 'SVK', 'FIN', 'ITA', 'HRV'], blue: ['SOV'], strikes: [['Warsaw', 'Minsk'], ['Lublin', 'Kyiv'], ['Kaliningrad', 'Kaunas'], ['Iasi', 'Odesa'], ['Warsaw', 'Brest-Litovsk']], axes: [['Kaliningrad', 'Riga'], ['Riga', 'Leningrad'], ['Warsaw', 'Minsk'], ['Minsk', 'Smolensk'], ['Smolensk', 'Moscow'], ['Lublin', 'Kyiv'], ['Iasi', 'Odesa']] },
  },
  pearl_harbor: {
    title: 'A Date Which Will Live in Infamy',
    time: '07:48',
    quote: 'Yesterday, December 7th, 1941 — a date which will live in infamy — the United States of America was suddenly and deliberately attacked by naval and air forces of the Empire of Japan.',
    quoteBy: 'Franklin D. Roosevelt, 8 December 1941',
    text: 'At 07:48 Hawaiian time, the first wave of 183 Japanese aircraft from six carriers strikes the Pacific Fleet at anchor in Pearl Harbor. The battleship Arizona explodes and sinks with more than a thousand men; Oklahoma capsizes. Airfields across Oahu are strafed. Within hours Japanese forces strike the Philippines, Malaya, Hong Kong and Guam. America is at war.',
    art: { kind: 'navy' },
  },
  trinity: {
    title: 'Trinity',
    time: '05:29',
    quote: 'Now I am become Death, the destroyer of worlds.',
    quoteBy: 'J. Robert Oppenheimer, recalling the Bhagavad Gita',
    text: 'At 05:29 in the Jornada del Muerto desert of New Mexico, the first atomic bomb is detonated. The flash is seen two hundred miles away; the steel tower vanishes, and the desert sand fuses into green glass. The Manhattan Project has given the United States a weapon unlike any in history. The world will never be the same.',
    art: { kind: 'nuke' },
  },
  desert_storm: {
    title: 'Operation Desert Storm',
    time: '02:38',
    quote: 'Just two hours ago, allied air forces began an attack on military targets in Iraq and Kuwait.',
    quoteBy: 'George H. W. Bush, 16 January 1991',
    text: 'Apache helicopters knock out Iraqi radar sites, opening a corridor for the air armada behind them. Tomahawk missiles and F-117 stealth fighters strike Baghdad\'s air defences, power grid and command bunkers as anti-aircraft fire lights the night sky, broadcast live to the world. Half a million Coalition troops wait in the Saudi desert for the ground war to come.',
    textFor: {
      IRQ: 'Sirens wail over Baghdad as the Coalition air campaign begins. Our radar network is going dark, bridges and power stations are burning. The President promises the "mother of all battles". The Republican Guard must hold Kuwait and make the enemy pay for every metre of sand.',
    },
    art: { kind: 'map', focus: 'Kuwait City', span: 22, red: ['USA', 'GBR', 'FRA', 'SAU', 'EGY', 'SYR', 'ARE', 'QAT', 'BHR', 'OMN'], blue: ['IRQ'], axes: [['Hail', 'Baghdad'], ['Riyadh', 'Kuwait City'], ['Dammam', 'Basra']] },
  },
  ussr_end: {
    title: 'The Red Flag Comes Down',
    time: '19:32',
    quote: 'We are now living in a new world.',
    quoteBy: 'Mikhail Gorbachev, resignation address, 25 December 1991',
    text: 'At 19:32 Moscow time, the red flag with the hammer and sickle is lowered over the Kremlin for the last time, and the Russian tricolour rises in its place. Fifteen republics go their own way. The superpower that defeated Hitler and raced America into space has dissolved without a shot being fired between its great rivals. The Cold War is over.',
    art: { kind: 'flags', tags: ['SOV'], flags: ['SOV', 'RUS'] },
  },
  sept11: {
    title: 'September 11',
    time: '08:46',
    quote: 'Today, our fellow citizens, our way of life, our very freedom came under attack in a series of deliberate and deadly terrorist acts.',
    quoteBy: 'George W. Bush, 11 September 2001',
    text: 'At 08:46 a hijacked airliner strikes the North Tower of the World Trade Center in New York. Seventeen minutes later, as the world watches live, a second plane hits the South Tower. Another crashes into the Pentagon; a fourth comes down in a Pennsylvania field after its passengers fight back. By morning\'s end both towers have collapsed. Nearly three thousand people are dead, and the trail leads to al-Qaeda\'s camps in Taliban-ruled Afghanistan.',
    art: { kind: 'city' },
  },
  invasion2022: {
    title: 'The Special Military Operation',
    titleFor: { UKR: 'The Invasion of Ukraine' },
    time: '05:00',
    quote: 'I have made the decision to conduct a special military operation.',
    quoteBy: 'Vladimir Putin, address to the nation, 24 February 2022',
    text: 'Shortly before dawn, the Russian president announces a "special military operation" in Ukraine. Within minutes, cruise and ballistic missiles strike airfields, air-defence sites and command posts across the country. Russian columns cross the border on four axes: from Belarus toward Kyiv, from Bryansk and Kursk toward Chernihiv and Sumy, from Belgorod toward Kharkiv, and from Crimea toward Kherson and Melitopol. Helicopter-borne paratroopers assault Antonov Airport at Hostomel, on the edge of Kyiv. It is the largest attack on a European state since 1945.',
    textFor: {
      UKR: 'At 05:00 air-raid sirens sound over Kyiv, Kharkiv, Odesa and Lviv. Cruise and ballistic missiles are hitting our airfields, air-defence batteries and command posts. Russian columns are crossing the border from Belarus toward Chernihiv and Kyiv, from Belgorod toward Kharkiv and Sumy, and from Crimea toward Kherson and Melitopol. Enemy helicopters are landing paratroopers at Hostomel airport, twenty-five kilometres from the capital. The President has declared martial law. Territorial defence brigades are handing out rifles in the streets. The enemy expects Kyiv to fall in three days. Prove them wrong.',
      RUS: 'At dawn the President addresses the nation. Minutes later our missile brigades strike Ukrainian air defences, airfields and headquarters. Battalion tactical groups cross the border on four axes, with the Eastern Military District driving on Kyiv from Belarus. VDV paratroopers are landing at Hostomel to seize the airport and open the road into the capital. The General Staff expects the regime in Kyiv to collapse within days — if it does not, this will become a very different war.',
    },
    prelude: { place: 'KYIV · THURSDAY, 24 FEBRUARY 2022', clock: ['04:57', '04:58', '04:59', '05:00'], line: 'The city is asleep. The last trains of the night are empty. On the television, an address from Moscow is beginning.' },
    feed: [
      ['04:55', 'Moscow: televised address announces a "special military operation" in Ukraine'],
      ['05:00', 'Explosions heard in Kyiv, Kharkiv, Odesa, Dnipro and Mariupol'],
      ['05:10', 'Missile strikes reported on airfields and air-defence sites nationwide'],
      ['05:30', 'Border guards: attacks from Russia, Belarus and Crimea on several axes'],
      ['06:00', 'Ukrainian airspace closed to civilian aircraft'],
      ['06:30', 'President Zelenskyy declares martial law and urges Ukrainians to stay calm'],
      ['08:00', 'Russian columns cross into Chernihiv, Sumy and Kharkiv regions'],
      ['11:00', 'Helicopter assault on Antonov Airport, Hostomel — 25 km from Kyiv'],
      ['14:00', 'Heavy fighting near Chernobyl exclusion zone'],
      ['18:00', 'Queues at recruitment offices; rifles handed out in Kyiv'],
    ],
    art: {
      kind: 'map', focus: 'Kyiv', span: 21, red: ['RUS', 'DPR', 'LPR', 'BLR'], blue: ['UKR'],
      strikes: [['Gomel', 'Kyiv'], ['Belgorod', 'Kharkiv'], ['Simferopol', 'Odesa'], ['Rostov', 'Dnipro'], ['Brest-Litovsk', 'Lviv'], ['Gomel', 'Kyiv'], ['Simferopol', 'Mykolaiv'], ['Kursk', 'Chernihiv'], ['Rostov', 'Mariupol'], ['Belgorod', 'Poltava'], ['Simferopol', 'Zaporizhzhia'], ['Bryansk', 'Vinnytsia']],
      axes: [['Gomel', 'Kyiv'], ['Bryansk', 'Chernihiv'], ['Kursk', 'Sumy'], ['Belgorod', 'Kharkiv'], ['Simferopol', 'Kherson'], ['Rostov', 'Mariupol']],
    },
  },
  taiwan: {
    title: 'The Strait on Fire',
    time: '04:00',
    quote: 'The complete reunification of the motherland must be realised.',
    quoteBy: 'Xi Jinping, 2022',
    text: 'In the dark before dawn, rocket forces on the Fujian coast launch hundreds of missiles at Taiwan\'s airbases, radar stations and naval ports. Amphibious groups and requisitioned ferries steam into the 180-kilometre strait under a sky full of drones and fighters. The world\'s most advanced chip factories go dark. In Washington and Tokyo, leaders face the decision they have dreaded for decades.',
    textFor: {
      TWN: 'Missiles are striking our airbases and radar stations in waves. The PLA Navy is crossing the Strait. Every beach, port and city must become a fortress. Hold long enough, and the world will come.',
    },
    art: { kind: 'map', focus: 'Taipei', span: 16, red: ['CHN'], blue: ['TWN'], axes: [['Fuzhou', 'Taipei']] },
  },
  stalingrad: {
    title: 'Operation Uranus',
    titleFor: { DEU: 'The Cauldron at Stalingrad', SOV: 'Operation Uranus' },
    time: '07:30',
    quote: 'Not one step back!',
    quoteBy: 'Order No. 227, People\'s Commissar of Defence, 28 July 1942',
    text: 'At 07:30, in freezing fog, three and a half thousand Soviet guns open fire on the Romanian positions along the Don north-west of Stalingrad. The next morning a second blow falls south of the city. The two armoured pincers race across the snow-covered steppe, and on the 23rd they meet at the bridge at Kalach. Behind them, in the rubble of the tractor factory and the grain elevator, a quarter of a million Axis soldiers are cut off.',
    textFor: {
      SOV: 'Our guns open up at 07:30 across the Don. Southwest Front and Don Front strike the Romanian Third Army; tomorrow Stalingrad Front attacks from the south. The tank corps must not stop to fight — only to meet at Kalach. Then the hunters in the ruins become the hunted.',
      DEU: 'Enemy armour has broken through the Romanian armies on both our flanks. The Army High Command reports Soviet tank columns racing for Kalach, behind the Sixth Army. General Paulus asks for permission to break out while there is still time. The Reichsmarschall promises that the Luftwaffe can supply the city from the air.',
    },
    prelude: { place: 'THE DON FRONT · THURSDAY, 19 NOVEMBER 1942', clock: ['07:27', '07:28', '07:29', '07:30'], line: 'Fog on the steppe. Minus twenty. The gunners have been told the code word: "Siren".' },
    feed: [
      ['07:30', 'Katyusha salvoes open an 80-minute barrage along the Don'],
      ['08:50', 'Rifle divisions and T-34s attack the Romanian Third Army'],
      ['12:00', '26th Tank Corps breaks into the open steppe'],
      ['20 Nov', 'Second blow falls south of Stalingrad'],
      ['22 Nov', 'Bridge at Kalach seized intact by a night raid'],
      ['23 Nov', 'Pincers meet at Sovetsky: the Sixth Army is encircled'],
    ],
    art: {
      kind: 'map', focus: 'Stalingrad', center: [43.7, 49.2], span: 8, red: ['SOV'], blue: ['DEU', 'ROU', 'ITA', 'HUN'], mark: 'Stalingrad',
      strikes: [[[43.0, 50.2], [42.6, 49.4]], [[43.3, 50.3], [43.3, 49.5]], [[45.0, 48.0], [44.2, 48.1]]],
      axes: [[[42.4, 49.9], [43.4, 48.65]], [[43.3, 50.2], [43.6, 48.8]], [[44.7, 47.9], [43.6, 48.55]]],
      pts: { Kalach: [43.5, 48.7], Serafimovich: [42.7, 49.6] },
    },
  },
  dday: {
    title: 'D-Day',
    titleFor: { DEU: 'Invasion in Normandy' },
    time: '06:30',
    quote: 'You are about to embark upon the Great Crusade, toward which we have striven these many months.',
    quoteBy: 'General Dwight D. Eisenhower, order of the day, 6 June 1944',
    text: 'After midnight, paratroopers drop over the Cotentin and the bridges on the Orne. At dawn five thousand ships appear off the Normandy coast and the battleships open fire. At 06:30 the first landing craft hit Utah and Omaha; within the hour British and Canadian troops storm Gold, Juno and Sword. On Omaha the assault waves are cut down at the waterline, but by nightfall 156,000 men are ashore. The second front has been opened.',
    textFor: {
      DEU: 'Enemy paratroopers are landing all over Normandy, and at dawn the sea off Calvados is full of ships. Is it the real invasion, or a feint before the main blow at Calais? Field Marshal Rommel is in Germany for his wife\'s birthday, and the panzer reserves cannot move without the Führer\'s order. The beaches must be thrown back into the sea today.',
      GBR: 'The 6th Airborne has taken the Orne bridges. At first light the fleet opens fire and our assault divisions land on Gold, Juno and Sword beside the Americans. We are going back to France.',
    },
    prelude: { place: 'OFF THE NORMANDY COAST · TUESDAY, 6 JUNE 1944', clock: ['06:27', '06:28', '06:29', '06:30'], line: 'Grey sea, low cloud. Men are sick in the landing craft. The ramps are about to drop.' },
    feed: [
      ['00:16', 'Gliders land beside the Orne bridges: "Ham and Jam"'],
      ['01:30', 'US 82nd and 101st Airborne scattered over the Cotentin'],
      ['05:45', 'Naval bombardment of the coastal batteries begins'],
      ['06:30', 'First waves land on Utah and Omaha'],
      ['07:25', 'British and Canadian troops land on Gold, Juno and Sword'],
      ['09:00', 'Omaha: assault pinned down on the shingle'],
      ['13:00', 'Commandos link up with the paratroopers at Pegasus Bridge'],
      ['24:00', '156,000 Allied soldiers are ashore'],
    ],
    art: {
      kind: 'map', focus: 'Rouen', center: [-0.6, 49.75], span: 6, red: ['USA', 'GBR', 'CAN'], blue: ['DEU', 'VIC'],
      strikes: [[[-1.2, 50.3], [-1.0, 49.35]], [[-0.8, 50.3], [-0.6, 49.33]], [[-0.4, 50.3], [-0.2, 49.3]], [[-1.4, 50.4], [-1.3, 49.4]], [[-0.1, 50.3], [0.1, 49.3]]],
      axes: [[[-1.3, 50.4], [-1.2, 49.35]], [[-0.9, 50.4], [-0.9, 49.33]], [[-0.6, 50.4], [-0.55, 49.3]], [[-0.4, 50.4], [-0.35, 49.3]], [[-0.2, 50.4], [-0.25, 49.28]]],
      pts: { Omaha: [-0.9, 49.37], Utah: [-1.2, 49.42], Sword: [-0.3, 49.3], Caen: [-0.37, 49.18] },
    },
  },
  berlin_wall: {
    title: 'The Wall Comes Down',
    time: '23:30',
    when: '9 November 1989',
    quote: 'Das tritt nach meiner Kenntnis … ist das sofort, unverzüglich.',
    quoteBy: 'Günter Schabowski, press conference, 9 November 1989',
    text: 'At a rambling evening press conference, a Politburo spokesman announces that East Germans may cross the border "immediately, without delay". By 23:30 twenty thousand people are pressing at the Bornholmer Strasse checkpoint, and the guards open the gate. Through the night Berliners climb the Wall at the Brandenburg Gate, pass bottles of sparkling wine and chip at the concrete with hammers. Within a year Germany is reunited. Now, fourteen months later, the Soviet Union itself is coming apart.',
    textFor: {
      SOV: 'The Wall has fallen, and with it our empire in Eastern Europe. In Prague, Budapest and Bucharest the old regimes are gone. Now the Baltic republics demand independence, the Caucasus is burning and the hardliners mutter about a coup. It is January 1991. The Union will not survive the year unless someone acts.',
      DEU: 'The night the Wall opened, strangers embraced on the Kurfürstendamm. Eleven months later Germany is one country again. Now, in January 1991, the new Germany must find its place: in NATO, in a Europe moving toward union, and beside a Soviet Union that is coming apart.',
    },
    feed: [
      ['18:53', 'Schabowski: new travel rules take effect "immediately"'],
      ['20:00', 'Crowds gather at the border crossings in East Berlin'],
      ['23:30', 'Bornholmer Strasse: the guards open the gate'],
      ['00:00', 'People dance on top of the Wall at the Brandenburg Gate'],
      ['3 Oct 90', 'Germany is reunified'],
      ['Jan 91', 'Soviet troops storm the TV tower in Vilnius'],
    ],
    art: { kind: 'wall' },
  },
  kerch: {
    title: 'The Crimean Bridge Burns',
    titleFor: { RUS: 'Explosion on the Crimean Bridge' },
    time: '06:07',
    quote: 'The bridge of the century.',
    quoteBy: 'Russian state television, at its opening in 2018',
    text: 'At 06:07 a huge explosion tears through the road deck of the Kerch bridge, the 19-kilometre link between Russia and occupied Crimea. Two spans drop into the strait. On the parallel railway, tank wagons of a fuel train bound for the front burst into flames that can be seen from Kerch. The main supply artery of Russia\'s southern army has been cut, the day after Vladimir Putin\'s seventieth birthday.',
    textFor: {
      UKR: 'At 06:07 the Crimean bridge is on fire. Two road spans are in the water and a fuel train is burning on the railway beside them. Kyiv makes no official comment, but the post office is already designing a stamp. The Russian army in the south will be hungry this winter.',
      RUS: 'An explosion has brought down two spans of the Crimean bridge and set a fuel train alight. Traffic to the peninsula is stopped. The investigators blame a truck bomb and Ukrainian special services. Our troops in Kherson and Zaporizhzhia must be supplied by ferry and by the long road through Mariupol.',
    },
    feed: [
      ['06:07', 'Explosion on the Kerch bridge. Road spans collapse'],
      ['06:15', 'Fuel train ablaze on the railway section'],
      ['08:00', 'Traffic to Crimea suspended; ferry crossing reopened'],
      ['10:00', 'Queues form at Crimean petrol stations'],
      ['14:00', 'Kyiv: "Everything illegal must be destroyed"'],
      ['20:00', 'Rail traffic partly restored under floodlights'],
    ],
    art: { kind: 'bridge' },
  },
  kursk2024: {
    title: 'The Kursk Incursion',
    titleFor: { RUS: 'Enemy in Kursk Oblast' },
    time: '05:30',
    quote: 'Russia is pushing the war onto other people\'s land; it should feel what it has done.',
    quoteBy: 'Volodymyr Zelenskyy, August 2024',
    text: 'Before dawn, Ukrainian brigades with Western armour cross the Russian border opposite Sumy, the first foreign invasion of Russian soil since 1941. Border posts are overrun in hours. Columns push toward Sudzha, where the last pipeline carrying Russian gas to Europe crosses the frontier, and hundreds of Russian conscripts surrender. Moscow speaks of a "large-scale provocation" and rushes reserves from the Donbas.',
    textFor: {
      RUS: 'Ukrainian armour has crossed the border into Kursk oblast. Sudzha is threatened and conscript units are surrendering. The governor is evacuating border districts. Reserves must be found at once — and every one we take from the Donbas makes the enemy\'s gamble pay.',
    },
    feed: [
      ['05:30', 'Ukrainian units cross the border near Sudzha'],
      ['08:00', 'Russian border posts reported overrun'],
      ['12:00', 'Kursk governor: evacuation of border districts'],
      ['7 Aug', 'Fighting near the Sudzha gas metering station'],
      ['9 Aug', 'Moscow declares a counter-terrorist operation in three regions'],
      ['15 Aug', 'Ukraine sets up a military administration in Sudzha'],
    ],
    art: { kind: 'map', focus: 'Kursk', span: 9, swapColors: true, red: ['UKR'], blue: ['RUS'], strikes: [['Sumy', 'Kursk'], ['Sumy', 'Belgorod']], axes: [['Sumy', [35.2, 51.2]], ['Sumy', [34.7, 51.4]], [[35.2, 51.2], [35.8, 51.5]]], pts: { Sudzha: [35.27, 51.19] } },
  },
};

// Capitals that really fell, and when. Any other fall of a capital is flagged
// as alternate history, with a note on what happened in our timeline.
IM.HISTORIC_FALLS = {
  Warsaw: [[1939, 1939], [1944, 1945]], Paris: [[1940, 1944]], Brussels: [[1940, 1944]], Amsterdam: [[1940, 1945]],
  Oslo: [[1940, 1945]], Copenhagen: [[1940, 1945]], Luxembourg: [[1940, 1944]], Belgrade: [[1941, 1944]], Athens: [[1941, 1944]],
  Berlin: [[1945, 1945]], Vienna: [[1938, 1945]], Budapest: [[1944, 1945]], Prague: [[1939, 1945]], Bucharest: [[1944, 1944]],
  Sofia: [[1944, 1944]], Rome: [[1943, 1944]], Tallinn: [[1940, 1944]], Riga: [[1940, 1944]], Vilnius: [[1939, 1944]], Kaunas: [[1940, 1944]],
  Minsk: [[1941, 1944]], Kyiv: [[1941, 1943]], Manila: [[1942, 1945]], Nanjing: [[1937, 1945]], Beijing: [[1937, 1945]],
  Bangkok: [[1941, 1945]], Rangoon: [[1942, 1945]], Tirana: [[1939, 1944]], 'Addis Ababa': [[1936, 1941]],
  'Kuwait City': [[1990, 1991]], Baghdad: [[2003, 2003]], Kabul: [[2001, 2001], [2021, 2021]], Tripoli: [[2011, 2011]],
};
IM.HISTORY_NOTES = {
  London: 'London was never taken. Operation Sea Lion was called off in September 1940.',
  Moscow: 'Moscow never fell. The Wehrmacht was stopped at its gates in December 1941.',
  Leningrad: 'Leningrad endured an 872-day siege but never fell.',
  Washington: 'Washington has not been occupied by a foreign army since 1814.',
  Tokyo: 'Tokyo was never invaded. Japan surrendered in August 1945 before any landing on the home islands.',
  Stockholm: 'Sweden stayed neutral through both world wars.',
  Bern: 'Switzerland stayed neutral throughout the Second World War.',
  Helsinki: 'Helsinki was bombed but never taken; Finland kept its independence.',
  Ankara: 'Turkey stayed out of the Second World War until its final weeks.',
  Madrid: 'Franco\'s Spain stayed out of the Second World War.',
  Taipei: 'Taiwan has governed itself since 1949.',
  Chongqing: 'China\'s wartime capital Chongqing was bombed for years but never captured.',
};
IM.historyOfFall = function (G, s, taker, owner) {
  const y = IM.Game.dateOf(G).getUTCFullYear();
  const ranges = IM.HISTORIC_FALLS[s.name];
  if (ranges && ranges.some(([a, b]) => y >= a && y <= b)) return null;
  if (s.name === 'Kyiv') return y >= 2014 ? 'Kyiv held. Russian troops were driven back from the capital by the end of March 2022.' : y >= 1941 && y <= 1943 ? null : 'Kyiv did not fall in this year of our history.';
  return IM.HISTORY_NOTES[s.name] || `In our history, ${s.name} did not fall to ${taker.name} in ${y}.`;
};
