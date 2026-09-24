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
    art: { kind: 'map', focus: 'Warsaw', span: 22, red: ['DEU', 'SVK'], blue: ['POL'], axes: [['Olsztyn', 'Warsaw'], ['Szczecin', 'Poznan'], ['Gdansk', 'Bialystok'], ['Wroclaw', 'Lodz'], ['Bratislava', 'Krakow']] },
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
    art: { kind: 'map', focus: 'Minsk', span: 40, red: ['DEU', 'ROU', 'HUN', 'SVK', 'FIN', 'ITA', 'HRV'], blue: ['SOV'], axes: [['Kaliningrad', 'Riga'], ['Riga', 'Leningrad'], ['Warsaw', 'Minsk'], ['Minsk', 'Smolensk'], ['Smolensk', 'Moscow'], ['Lublin', 'Kyiv'], ['Iasi', 'Odesa']] },
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
    art: { kind: 'map', focus: 'Kyiv', span: 26, red: ['RUS', 'DPR', 'LPR', 'BLR'], blue: ['UKR'], axes: [['Gomel', 'Kyiv'], ['Bryansk', 'Chernihiv'], ['Kursk', 'Sumy'], ['Belgorod', 'Kharkiv'], ['Simferopol', 'Kherson'], ['Rostov', 'Mariupol']] },
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
};
