# Iron Meridian

A real-time-with-pause grand strategy wargame in the style of Hearts of Iron IV — but spanning **eight eras**, from the invasion of Poland to a hypothetical 2026. Lead any nation on a hex map of the whole world: pick national focuses, research technology, build factories, produce equipment, recruit and command divisions, forge alliances and fight wars across every continent.

It runs entirely in the browser with no build step or dependencies.

## Playing

Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari). That's it.

If your browser blocks local files, serve the folder instead:

```sh
python3 -m http.server 8080   # or: npm run serve
# then open http://localhost:8080
```

### Controls

| Action | Input |
| --- | --- |
| Pause / resume | `Space` |
| Game speed | `1`–`5`, or `+` / `-` |
| Pan the map | drag, `W A S D`, arrow keys |
| Zoom | mouse wheel (pinch on touch screens) |
| Select divisions | left-click a stack, `Shift`-drag to box-select, `Ctrl`+click for everything on screen |
| Move / attack | right-click a hex (long-press on touch screens) |
| Halt selected divisions | `Delete` / `Backspace` |
| Inspect a state | left-click land with none of your units on it |
| Panels | `F` focus · `R` research · `P` politics · `E` diplomacy · `Q` production · `B` construction · `T` recruit · `G` army |
| Close panel / deselect | `Esc` |

## The eras

| Era | Start date | Situation |
| --- | --- | --- |
| **1939** — The Gathering Storm | 1 Sep 1939 | Germany invades Poland; Britain and France declare war. Japan is deep in China. |
| **1941** — Operation Barbarossa | 22 Jun 1941 | The Axis storms into the Soviet Union. Pearl Harbor is coming. |
| **1945** — Twilight of the Reich | 1 Jan 1945 | The Allies close in on Germany and Japan. The atom bomb is months away. |
| **1991** — Desert Storm & the Fall of the Union | 17 Jan 1991 | The Gulf War begins; the USSR and Yugoslavia are about to break apart. |
| **2000** — The New Millennium | 1 Jan 2000 | A unipolar world. War in Chechnya; 9/11 and Iraq lie ahead. |
| **2021** — The Brink | 1 Jul 2021 | Kabul is about to fall. Russian divisions mass on Ukraine's border. |
| **2022** — The Invasion | 24 Feb 2022 | Russia invades Ukraine. |
| **2026** — Fractured World | 1 Jan 2026 | Drone-choked trench war in Ukraine; the Taiwan Strait on a knife-edge. |

Each era has its own borders, colonial empires, factions (Allies, Axis, Comintern, Co-Prosperity Sphere, NATO, Warsaw Pact, CSTO…), wars in progress, leaders and technology levels, plus **historical events** that fire on their real dates — the Molotov–Ribbentrop partition, the Winter War, Barbarossa, Pearl Harbor, Trinity, the Soviet dissolution, the Yugoslav wars, 9/11, Crimea, the fall of Kabul, the 2022 annexations and more. The AI takes the historical path; if the event is yours, you choose.

## Systems (the familiar ones)

- **National focus tree** — industry, military and political branches with real effects.
- **Research** — ten technology branches from 1918 small arms to 2025 quantum computing; researching ahead of time is slower.
- **Politics** — political power, stability, war support, conscription and economy laws.
- **Production** — assign military factories to equipment lines whose efficiency grows over time.
- **Construction** — civilian factories build civilian/military factories and forts in your states.
- **Recruitment** — seven division templates (infantry, motorized, mechanized, armored, mountain, marine, garrison) that cost manpower and equipment.
- **Combat** — HOI4-style organization and strength, soft/hard attack against defense and breakthrough, armor hardness, combat width by direction, terrain, fortifications, entrenchment, air superiority, and retreats — units with nowhere to retreat are destroyed.
- **Supply** — flows from your victory-point cities; distance thins it, encirclement cuts it.
- **Naval movement & invasions** — divisions embark automatically when a route crosses the sea; enemy navies interdict them.
- **Capitulation & peace** — lose enough victory points (especially your capital) and you surrender; at war's end the victors annex what they occupy.
- **Diplomacy** — war goals, declarations, factions, invitations and guarantees.
- **AI** — every nation manages its economy, research, focuses and recruitment, holds fronts, attacks where the odds are good, pulls back from pockets and launches naval invasions.

## Iron Meridian's own features

- **Eight eras** in one game, 1939 to 2026.
- **Economic sanctions** — cut a rival's industrial output.
- **Cyber operations** — with modern technology, cripple an enemy's research and coordination for a month.
- **Drone warfare** — produce drones; they boost the combat power of your divisions and are consumed in battle.
- **Nuclear weapons** — research the bomb, build warheads, and strike enemy-held cities. Expect sanctions, 100% world tension and retaliation from nuclear-armed enemies.
- **Negotiated peace** — offer white peace or demand concessions instead of fighting to the bitter end.
- **Lend-lease and foreign aid** — arm your friends; neutral powers arm like-minded nations fighting their rivals.
- **Emergency militia** — threatened cities raise territorial-defense units at short notice.
- **AI generals** — delegate any group of divisions (or the whole army) to the AI.
- **Attack-odds preview** — hover an enemy stack with divisions selected.
- **News panel** — world events appear on half the screen as a 1939-era broadsheet (The Evening Dispatch) or, from 1991 on, a live TV news bulletin, with a map of the action. Choose All news, Major only or Off.
- **Super events** — full-screen moments for turning points (the invasion of Poland, Barbarossa, Pearl Harbor, Trinity, Desert Storm, the fall of the USSR, 9/11, the 2022 invasion of Ukraine, a Taiwan war, any nuclear strike, the fall of a great capital) with an animated map of the offensive, a historical quote, a nation-specific account and synthesized sound.
- Real flags for every nation, with period-correct flags for historical states (Soviet Union, Manchukuo, Vichy France, Free France, the British Raj, pre-1965 Canada, Ichkeria and more).
- A nation-selection screen with briefings, difficulty ratings and strength comparisons for each era's powers.
- Saving and loading (stored in your browser).

## Project layout

```
index.html            entry point
css/style.css         interface styles
js/data/              map data (generated), cities/states, countries, eras, rules (tech, focus, laws, units)
js/engine/            world model & pathfinding, economy, war, diplomacy, events, AI, save/load
js/ui/                canvas renderer, screens & input, management panels
tools/build-map.js    regenerates js/data/mapdata.js from Natural Earth data
tools/build-flags.js  regenerates js/data/flags.js (flag-icons + hand-drawn period flags)
tools/sim-test.js     headless simulation of every era (smoke/balance test)
```

### Development

```sh
npm install        # only needed for the tools
npm test           # simulate every era for 90 days headlessly: node tools/sim-test.js [days] [era]
npm run build-map  # rebuild the hex map from Natural Earth (world-atlas)
npm run build-flags # rebuild the flag images (needs Playwright's Chromium)
```

Map geometry comes from [Natural Earth](https://www.naturalearthdata.com/) via the `world-atlas` package. Modern flags come from [flag-icons](https://github.com/lipis/flag-icons) (MIT). Iron Meridian is an independent, fan-made game inspired by the grand strategy genre; it is not affiliated with Paradox Interactive.
