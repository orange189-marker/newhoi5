// Generates js/data/mapdata.js: a hex grid of the world where every land hex
// knows which modern country it sits in and what terrain it has.
// Run with: npm run build-map
'use strict';
const fs = require('fs');
const path = require('path');
const topo = require('topojson-client');
const d3 = require('d3-geo');
const atlas = require('world-atlas/countries-50m.json');

const HEX_W = 1.0;                  // degrees of longitude per hex
const HEX_H = HEX_W * 0.866;        // row spacing
const LAT_TOP = 76, LAT_BOTTOM = -56;
const COLS = Math.round(360 / HEX_W);
const ROWS = Math.ceil((LAT_TOP - LAT_BOTTOM) / HEX_H);

// Natural Earth name -> game "modern region" code. Unlisted polygons are ignored.
const CODES = {
  'Afghanistan': 'AFG', 'Albania': 'ALB', 'Algeria': 'DZA', 'Angola': 'AGO', 'Argentina': 'ARG',
  'Armenia': 'ARM', 'Australia': 'AUS', 'Austria': 'AUT', 'Azerbaijan': 'AZE', 'Bahamas': 'BHS',
  'Bangladesh': 'BGD', 'Belarus': 'BLR', 'Belgium': 'BEL', 'Belize': 'BLZ', 'Benin': 'BEN',
  'Bhutan': 'BTN', 'Bolivia': 'BOL', 'Bosnia and Herz.': 'BIH', 'Botswana': 'BWA', 'Brazil': 'BRA',
  'Brunei': 'BRN', 'Bulgaria': 'BGR', 'Burkina Faso': 'BFA', 'Burundi': 'BDI', 'Cambodia': 'KHM',
  'Cameroon': 'CMR', 'Canada': 'CAN', 'Central African Rep.': 'CAF', 'Chad': 'TCD', 'Chile': 'CHL',
  'China': 'CHN', 'Colombia': 'COL', 'Congo': 'COG', 'Costa Rica': 'CRI', 'Croatia': 'HRV',
  'Cuba': 'CUB', 'Cyprus': 'CYP', 'N. Cyprus': 'CYP', 'Czechia': 'CZE', "Côte d'Ivoire": 'CIV',
  'Dem. Rep. Congo': 'COD', 'Denmark': 'DNK', 'Djibouti': 'DJI', 'Dominican Rep.': 'DOM',
  'Ecuador': 'ECU', 'Egypt': 'EGY', 'El Salvador': 'SLV', 'Eq. Guinea': 'GNQ', 'Eritrea': 'ERI',
  'Estonia': 'EST', 'Ethiopia': 'ETH', 'Falkland Is.': 'FLK', 'Fiji': 'FJI', 'Finland': 'FIN',
  'France': 'FRA', 'Gabon': 'GAB', 'Gambia': 'GMB', 'Georgia': 'GEO', 'Germany': 'DEU',
  'Ghana': 'GHA', 'Greece': 'GRC', 'Greenland': 'GRL', 'Guatemala': 'GTM', 'Guinea': 'GIN',
  'Guinea-Bissau': 'GNB', 'Guyana': 'GUY', 'Haiti': 'HTI', 'Honduras': 'HND', 'Hungary': 'HUN',
  'Iceland': 'ISL', 'India': 'IND', 'Siachen Glacier': 'IND', 'Indonesia': 'IDN', 'Iran': 'IRN',
  'Iraq': 'IRQ', 'Ireland': 'IRL', 'Israel': 'ISR', 'Palestine': 'ISR', 'Italy': 'ITA',
  'Jamaica': 'JAM', 'Japan': 'JPN', 'Jordan': 'JOR', 'Kazakhstan': 'KAZ', 'Kenya': 'KEN',
  'Kosovo': 'XKX', 'Kuwait': 'KWT', 'Kyrgyzstan': 'KGZ', 'Laos': 'LAO', 'Latvia': 'LVA',
  'Lebanon': 'LBN', 'Lesotho': 'LSO', 'Liberia': 'LBR', 'Libya': 'LBY', 'Lithuania': 'LTU',
  'Luxembourg': 'LUX', 'Macedonia': 'MKD', 'Madagascar': 'MDG', 'Malawi': 'MWI', 'Malaysia': 'MYS',
  'Mali': 'MLI', 'Mauritania': 'MRT', 'Mexico': 'MEX', 'Moldova': 'MDA', 'Mongolia': 'MNG',
  'Montenegro': 'MNE', 'Morocco': 'MAR', 'W. Sahara': 'MAR', 'Mozambique': 'MOZ', 'Myanmar': 'MMR',
  'Namibia': 'NAM', 'Nepal': 'NPL', 'Netherlands': 'NLD', 'New Caledonia': 'NCL',
  'New Zealand': 'NZL', 'Nicaragua': 'NIC', 'Niger': 'NER', 'Nigeria': 'NGA', 'North Korea': 'PRK',
  'Norway': 'NOR', 'Oman': 'OMN', 'Pakistan': 'PAK', 'Panama': 'PAN', 'Papua New Guinea': 'PNG',
  'Paraguay': 'PRY', 'Peru': 'PER', 'Philippines': 'PHL', 'Poland': 'POL', 'Portugal': 'PRT',
  'Puerto Rico': 'PRI', 'Qatar': 'QAT', 'Romania': 'ROU', 'Russia': 'RUS', 'Rwanda': 'RWA',
  'Saudi Arabia': 'SAU', 'Senegal': 'SEN', 'Serbia': 'SRB', 'Sierra Leone': 'SLE',
  'Singapore': 'SGP', 'Slovakia': 'SVK', 'Slovenia': 'SVN', 'Solomon Is.': 'SLB', 'Somalia': 'SOM',
  'Somaliland': 'SOM', 'South Africa': 'ZAF', 'South Korea': 'KOR', 'Spain': 'ESP',
  'Sri Lanka': 'LKA', 'Sudan': 'SDN', 'S. Sudan': 'SSD', 'Suriname': 'SUR', 'Sweden': 'SWE',
  'Switzerland': 'CHE', 'Syria': 'SYR', 'Taiwan': 'TWN', 'Tajikistan': 'TJK', 'Tanzania': 'TZA',
  'Thailand': 'THA', 'Timor-Leste': 'TLS', 'Togo': 'TGO', 'Trinidad and Tobago': 'TTO',
  'Tunisia': 'TUN', 'Turkey': 'TUR', 'Turkmenistan': 'TKM', 'Uganda': 'UGA', 'Ukraine': 'UKR',
  'United Arab Emirates': 'ARE', 'United Kingdom': 'GBR', 'United States of America': 'USA',
  'Uruguay': 'URY', 'Uzbekistan': 'UZB', 'Vanuatu': 'VUT', 'Venezuela': 'VEN', 'Vietnam': 'VNM',
  'Yemen': 'YEM', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE', 'eSwatini': 'SWZ', 'Hong Kong': 'CHN',
  'Macao': 'CHN', 'Bahrain': 'BHR', 'Åland': 'FIN', 'Faeroe Is.': 'DNK',
};
// Small countries that must exist even if no hex centre falls inside them.
const FORCE = ['LUX', 'SGP', 'BHR', 'QAT', 'LBN', 'CYP', 'KWT', 'BRN', 'TTO', 'JAM', 'SVN', 'MNE',
  'XKX', 'GMB', 'DJI', 'RWA', 'BDI', 'SWZ', 'LSO', 'TLS', 'SLV', 'BLZ', 'ARM', 'MKD', 'ALB', 'ISR',
  'PRI', 'FJI', 'MDA', 'BEL', 'NLD', 'DNK', 'CHE', 'GNQ', 'BTN', 'HTI', 'DOM', 'TWN', 'LKA', 'EST',
  'LVA', 'BHS', 'CUB', 'SLB', 'VUT', 'NCL', 'ARE', 'ISL', 'IRL', 'FLK', 'GNB', 'TGO', 'BEN', 'SLE', 'LBR', 'HRV', 'BIH', 'AUT', 'CZE', 'SVK', 'SUR', 'GUY', 'CRI', 'PAN', 'NIC', 'HND', 'GTM', 'KHM', 'BGD', 'NPL', 'MWI', 'ERI', 'LTU', 'GEO', 'AZE', 'KGZ', 'TJK', 'JOR', 'SYR', 'OMN', 'YEM', 'URY', 'PRY', 'KOR', 'PRK'];

// Terrain boxes: [lonMin, latMin, lonMax, latMax]. First match wins.
const TERRAIN = [
  ['marsh', [[23.5, 51, 30, 53]]],
  ['mountain', [
    [5.5, 44.2, 16, 47.8], [-1.8, 42.2, 2.8, 43.1], [38, 41.2, 48.5, 43.8], [72, 27.5, 97, 36.5],
    [80, 30, 100, 38], [64, 34, 75.5, 39.5], [36, 37, 45, 40.6], [-124, 33, -105, 49],
    [-128, 49, -114, 60], [-78.5, -40, -67, -5], [-79, -5, -73.5, 8], [-72, -52, -68, -40],
    [15.5, 41, 23.5, 44.3], [35.5, 6.5, 41, 14], [5.5, 60, 17, 69.5], [-83.5, 35, -76.5, 40],
    [57.5, 51, 60.5, 67], [-8.5, 30.5, 1, 35], [85, 47, 99, 53], [61, 31, 71.5, 36.5],
    [-107, 18, -98, 27], [45, 30, 56, 36], [22, 45.3, 26, 47.8], [17, 48.5, 24, 49.6],
    [12, 41.5, 15.5, 44], [127, 60, 180, 70], [100, 23, 104, 28],
    [104, 32.5, 111, 34.5], [105, 30.8, 110, 32.5], [104, 24, 109.5, 28], [109, 25, 112, 29.5], [115, 24, 118.5, 28], [40, 12, 45, 17],
  ]],
  ['desert', [
    [-17, 16, 33, 31], [34.5, 15.5, 56, 32.5], [55, 26, 63, 34.5], [69, 24, 74, 29],
    [52, 37, 67, 45.5], [75, 37, 112, 44.5], [118, -32, 142, -19], [12, -28, 24, -17.5],
    [-71.5, -27, -68.5, -17], [-117, 31, -108, 37], [42, 2, 51, 11], [33, 16, 38, 22],
  ]],
  ['jungle', [
    [-75, -12, -48, 5], [10, -5, 30, 5], [-13, 4.5, 10, 8], [95, -10, 150, 20], [-92, 7, -77, 18],
    [-60, 2, -51, 7],
  ]],
  ['arctic', [[-180, 66.5, 180, 90]]],
  ['forest', [[-140, 50, -55, 62], [25, 55, 180, 66.5], [10, 58, 32, 66.5], [127, 42, 141, 55]]],
  ['hills', [[-10, 36, 3, 43.5], [26, 36.5, 45, 42], [35, 30, 45, 37], [100, 20, 122, 30], [-10, 51.5, -2.5, 58.8]]],
];
const TERRAIN_IDS = ['sea', 'plains', 'forest', 'hills', 'mountain', 'desert', 'jungle', 'marsh', 'arctic'];

function terrainAt(lon, lat) {
  for (const [name, boxes] of TERRAIN) {
    for (const b of boxes) if (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]) return name;
  }
  return 'plains';
}

function hexCenter(c, r) {
  const lon = -180 + (c + 0.5 + (r & 1) * 0.5) * HEX_W;
  const lat = LAT_TOP - (r + 0.5) * HEX_H;
  return [lon > 180 ? lon - 360 : lon, lat];
}

const features = topo.feature(atlas, atlas.objects.countries).features;
const codeList = [];
const codeIndex = {};
const feats = [];
for (const f of features) {
  const code = CODES[f.properties.name];
  if (!code) continue;
  if (!(code in codeIndex)) { codeIndex[code] = codeList.length + 1; codeList.push(code); }
  feats.push({ code, f, bounds: d3.geoBounds(f) });
}

const owner = new Uint8Array(COLS * ROWS);
const inBounds = (b, lon, lat) => {
  if (lat < b[0][1] - 0.01 || lat > b[1][1] + 0.01) return false;
  if (b[0][0] <= b[1][0]) return lon >= b[0][0] - 0.01 && lon <= b[1][0] + 0.01;
  return lon >= b[0][0] || lon <= b[1][0]; // crosses antimeridian
};
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const [lon, lat] = hexCenter(c, r);
    for (const ft of feats) {
      if (!inBounds(ft.bounds, lon, lat)) continue;
      if (d3.geoContains(ft.f, [lon, lat])) { owner[r * COLS + c] = codeIndex[ft.code]; break; }
    }
  }
}

// Guarantee small-but-important countries at least one hex (at their centroid).
const counts = {};
for (const v of owner) if (v) counts[codeList[v - 1]] = (counts[codeList[v - 1]] || 0) + 1;
for (const code of FORCE) {
  if (counts[code] >= 1) continue;
  const f = feats.filter(x => x.code === code).sort((a, b) => d3.geoArea(b.f) - d3.geoArea(a.f))[0];
  if (!f) continue;
  const [lon, lat] = d3.geoCentroid(f.f);
  let best = -1, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = hexCenter(c, r);
    const d = (x - lon) ** 2 + (y - lat) ** 2;
    if (d < bd) { bd = d; best = r * COLS + c; }
  }
  owner[best] = codeIndex[code];
  counts[code] = 1;
  console.log('forced', code);
}

// Row-based run-length encoding: "code:count" pairs using base36.
const rows = [], terr = [];
for (let r = 0; r < ROWS; r++) {
  let out = [], prev = -1, run = 0, tline = '';
  for (let c = 0; c < COLS; c++) {
    const v = owner[r * COLS + c];
    if (v === prev) run++; else { if (run) out.push(prev.toString(36) + '.' + run.toString(36)); prev = v; run = 1; }
    const [lon, lat] = hexCenter(c, r);
    tline += v ? TERRAIN_IDS.indexOf(terrainAt(lon, lat)) : 0;
  }
  out.push(prev.toString(36) + '.' + run.toString(36));
  rows.push(out.join(' '));
  terr.push(tline);
}

const land = owner.reduce((a, v) => a + (v ? 1 : 0), 0);
const js = `// AUTO-GENERATED by tools/build-map.js from Natural Earth (world-atlas). Do not edit.
window.IM = window.IM || {};
window.IM.MAPDATA = ${JSON.stringify({
  hexW: HEX_W, hexH: HEX_H, latTop: LAT_TOP, cols: COLS, rows: ROWS,
  codes: codeList, terrainIds: TERRAIN_IDS, cells: rows, terrain: terr,
})};
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'data', 'mapdata.js'), js);
console.log(`grid ${COLS}x${ROWS}, land hexes ${land}, countries ${codeList.length}, ${(js.length / 1024).toFixed(0)} KB`);
const small = Object.entries(counts).sort((a, b) => a[1] - b[1]).slice(0, 25);
console.log('smallest:', small.map(x => x.join('=')).join(' '));
