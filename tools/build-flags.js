// Generates js/data/flags.js: every nation's flag as a small WebP data URI.
// Modern flags come from the flag-icons package (MIT); period flags for
// historical states are drawn below. Rasterized with headless Chromium.
// Run with: npm run build-flags
'use strict';
const fs = require('fs');
const path = require('path');

let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }

const SRC = path.join(__dirname, '..', 'node_modules', 'flag-icons', 'flags', '4x3');
const W = 96, H = 64;

// Game code -> ISO 3166-1 alpha-2 (flag-icons file name)
const ISO2 = {
  AFG: 'af', ALB: 'al', DZA: 'dz', AGO: 'ao', ARG: 'ar', ARM: 'am', AUS: 'au', AUT: 'at', AZE: 'az', BHS: 'bs',
  BGD: 'bd', BLR: 'by', BEL: 'be', BLZ: 'bz', BEN: 'bj', BTN: 'bt', BOL: 'bo', BIH: 'ba', BWA: 'bw', BRA: 'br',
  BRN: 'bn', BGR: 'bg', BFA: 'bf', BDI: 'bi', KHM: 'kh', CMR: 'cm', CAN: 'ca', CAF: 'cf', TCD: 'td', CHL: 'cl',
  CHN: 'cn', COL: 'co', COG: 'cg', CRI: 'cr', HRV: 'hr', CUB: 'cu', CYP: 'cy', CZE: 'cz', CIV: 'ci', COD: 'cd',
  DNK: 'dk', DJI: 'dj', DOM: 'do', ECU: 'ec', EGY: 'eg', SLV: 'sv', GNQ: 'gq', ERI: 'er', EST: 'ee', ETH: 'et',
  FLK: 'fk', FJI: 'fj', FIN: 'fi', FRA: 'fr', GAB: 'ga', GMB: 'gm', GEO: 'ge', DEU: 'de', GHA: 'gh', GRC: 'gr',
  GRL: 'gl', GTM: 'gt', GIN: 'gn', GNB: 'gw', GUY: 'gy', HTI: 'ht', HND: 'hn', HUN: 'hu', ISL: 'is', IND: 'in',
  IDN: 'id', IRN: 'ir', IRQ: 'iq', IRL: 'ie', ISR: 'il', ITA: 'it', JAM: 'jm', JPN: 'jp', JOR: 'jo', KAZ: 'kz',
  KEN: 'ke', XKX: 'xk', KWT: 'kw', KGZ: 'kg', LAO: 'la', LVA: 'lv', LBN: 'lb', LSO: 'ls', LBR: 'lr', LBY: 'ly',
  LTU: 'lt', LUX: 'lu', MKD: 'mk', MDG: 'mg', MWI: 'mw', MYS: 'my', MLI: 'ml', MRT: 'mr', MEX: 'mx', MDA: 'md',
  MNG: 'mn', MNE: 'me', MAR: 'ma', MOZ: 'mz', MMR: 'mm', NAM: 'na', NPL: 'np', NLD: 'nl', NCL: 'nc', NZL: 'nz',
  NIC: 'ni', NER: 'ne', NGA: 'ng', PRK: 'kp', NOR: 'no', OMN: 'om', PAK: 'pk', PAN: 'pa', PNG: 'pg', PRY: 'py',
  PER: 'pe', PHL: 'ph', POL: 'pl', PRT: 'pt', PRI: 'pr', QAT: 'qa', ROU: 'ro', RUS: 'ru', RWA: 'rw', SAU: 'sa',
  SEN: 'sn', SRB: 'rs', SLE: 'sl', SGP: 'sg', SVK: 'sk', SVN: 'si', SLB: 'sb', SOM: 'so', ZAF: 'za', KOR: 'kr',
  SSD: 'ss', ESP: 'es', LKA: 'lk', SDN: 'sd', SUR: 'sr', SWE: 'se', CHE: 'ch', SYR: 'sy', TWN: 'tw', TJK: 'tj',
  TZA: 'tz', THA: 'th', TLS: 'tl', TGO: 'tg', TTO: 'tt', TUN: 'tn', TUR: 'tr', TKM: 'tm', UGA: 'ug', UKR: 'ua',
  ARE: 'ae', GBR: 'gb', USA: 'us', URY: 'uy', UZB: 'uz', VUT: 'vu', VEN: 've', VNM: 'vn', YEM: 'ye', ZMB: 'zm',
  ZWE: 'zw', SWZ: 'sz', BHR: 'bh', CZS: 'cz',
};

const read = iso => fs.readFileSync(path.join(SRC, iso + '.svg'), 'utf8');
// Nest a flag-icons SVG inside another at the given box.
const nest = (iso, x, y, w, h) => read(iso).replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="$1" preserveAspectRatio="none">`);
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="none">${body}</svg>`;
const hbands = (...cols) => cols.map((c, i) => `<rect y="${(40 / cols.length) * i}" width="60" height="${40 / cols.length + 0.2}" fill="${c}"/>`).join('');
const vbands = (...cols) => cols.map((c, i) => `<rect x="${(60 / cols.length) * i}" width="${60 / cols.length + 0.2}" height="40" fill="${c}"/>`).join('');
const star = (cx, cy, r, fill, stroke) => {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); }
  return `<polygon points="${p.join(' ')}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.8"` : ''}/>`;
};
const hammerSickle = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"><path d="M-3.2 2.8 L3 -3.2"/><path d="M1.2 -4.6 L4.6 -1.2" stroke-width="2.2"/><path d="M-4.2 -1.6 A4.4 4.4 0 1 0 1.8 -4.4"/><path d="M-4.2 4 L-2.6 2.4"/></g>`;
const redEnsign = emblem => svg(`<rect width="60" height="40" fill="#c8102e"/>${nest('gb', 0, 0, 30, 20)}${emblem}`);

// Period flags (60x40 viewBox). The German Reich uses the black-white-red
// state tricolour, the alternative flag strategy games commonly ship.
const HISTORICAL = {
  REICH: svg(hbands('#111', '#f4f4f4', '#d00')),
  SOV: svg(`<rect width="60" height="40" fill="#cc0000"/>${star(10.5, 5.5, 2.4, 'none', '#ffd700')}${hammerSickle(10.5, 12.5, 1.05, '#ffd700')}`),
  ITA_KING: svg(`${vbands('#009246', '#fff', '#ce2b37')}<rect x="25.5" y="13" width="9" height="12" rx="1" fill="#1a3f9a"/><path d="M26.5 14h7v6.5a3.5 3.5 0 0 1-7 0z" fill="#d50000"/><rect x="29.3" y="14" width="1.4" height="9.5" fill="#fff"/><rect x="26.5" y="17.2" width="7" height="1.4" fill="#fff"/>`),
  MAN: svg(`<rect width="60" height="40" fill="#ffd400"/><rect width="20" height="3.4" y="0" fill="#e0201b"/><rect width="20" height="3.4" y="3.4" fill="#1b3f9a"/><rect width="20" height="3.4" y="6.8" fill="#fff"/><rect width="20" height="3.4" y="10.2" fill="#111"/>`),
  MEN: svg(hbands('#f2c200', '#2250a8', '#fff', '#d42020', '#fff', '#2250a8', '#f2c200')),
  TIB: svg(`<rect width="60" height="40" fill="#1a3a8a"/>${Array.from({ length: 6 }, (_, i) => { const a1 = Math.PI + i * Math.PI / 6, a2 = a1 + Math.PI / 12; return `<polygon points="30,26 ${30 + 60 * Math.cos(a1)},${26 + 60 * Math.sin(a1)} ${30 + 60 * Math.cos(a2)},${26 + 60 * Math.sin(a2)}" fill="#d42020"/>`; }).join('')}<polygon points="8,40 30,22 52,40" fill="#fff"/><circle cx="30" cy="18" r="5" fill="#ffd400"/><rect x="0" y="0" width="60" height="40" fill="none" stroke="#ffd400" stroke-width="2"/>`),
  TAN: svg(`<rect width="60" height="40" fill="#c8102e"/><rect width="15" height="40" fill="#1d4fa0"/>${star(7.5, 20, 5, '#ffd400')}`),
  YUG_KING: svg(hbands('#1c3d8f', '#fff', '#d42020')),
  YUG: svg(`${hbands('#1c3d8f', '#fff', '#d42020')}${star(30, 20, 10, '#d42020', '#ffd400')}`),
  VIC: svg(`${vbands('#002395', '#fff', '#ed2939')}<g transform="translate(30 20)" fill="#c9a227"><rect x="-0.8" y="-8" width="1.6" height="16"/><path d="M-0.8 -8 q-6 1 -6 5 q3 -1 6 -1z"/><path d="M0.8 -8 q6 1 6 5 q-3 -1 -6 -1z"/></g>`),
  FFR: svg(`${vbands('#002395', '#fff', '#ed2939')}<g fill="#d42020"><rect x="28.8" y="9" width="2.4" height="22"/><rect x="25.5" y="13" width="9" height="2.2"/><rect x="24" y="18" width="12" height="2.2"/></g>`),
  RSI: svg(`${vbands('#009246', '#fff', '#ce2b37')}<g transform="translate(30 20)" fill="#222"><path d="M0 -6 l2 3 l6 -3 l-3 6 l3 1 l-6 1 l-2 5 l-2 -5 l-6 -1 l3 -1 l-3 -6 l6 3z"/></g>`),
  RAJ: redEnsign(`<g transform="translate(44 26)"><circle r="7" fill="#1a3f9a" stroke="#ffd400" stroke-width="0.8"/>${star(0, 0, 4.2, '#fff')}</g>`),
  CAN_ENSIGN: redEnsign(`<g transform="translate(45 25)"><path d="M-5 -6 h10 v6 a5 6 0 0 1 -10 0z" fill="#fff" stroke="#ffd400" stroke-width="0.6"/><path d="M-5 -6 h10 v2.4 h-10z" fill="#c8102e"/><circle cy="1.5" r="2.2" fill="#2e7d32"/></g>`),
  ZAF_OLD: svg(`${hbands('#ff7a00', '#fff', '#00247d')}<rect x="23" y="15" width="6" height="10" fill="#c8102e" opacity="0.9"/><rect x="30" y="15" width="7" height="10" fill="#fff" stroke="#00247d" stroke-width="0.4"/>`),
  ICH: svg(`<rect width="60" height="40" fill="#2e7d32"/><rect y="28" width="60" height="2.4" fill="#fff"/><rect y="30.4" width="60" height="3.2" fill="#d42020"/><rect y="33.6" width="60" height="2.4" fill="#fff"/>`),
  DPR: svg(hbands('#111', '#0a4fa8', '#d42020')),
  LPR: svg(hbands('#5bb4e5', '#1b3f9a', '#d42020')),
  AFG_IE: svg(`<rect width="60" height="40" fill="#fff"/><g fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"><path d="M14 16 q4 -4 8 0 t8 0 t8 0 t8 0"/><path d="M18 25 q3 -3 6 0 t6 0 t6 0 t6 0"/></g>`),
  AFG_DRA: svg(`${hbands('#111', '#d42020', '#2e7d32')}<circle cx="16" cy="12" r="5" fill="none" stroke="#ffd400" stroke-width="1.2"/>`),
  IRN_OLD: svg(`${hbands('#239f40', '#fff', '#da0000')}<circle cx="30" cy="20" r="4.2" fill="#e8a200"/><circle cx="30" cy="20" r="2.4" fill="#ffd400"/>`),
  EGY_KING: svg(`<rect width="60" height="40" fill="#2e8b3a"/><path d="M26 10 a10 10 0 1 0 0 20 a8 8 0 1 1 0 -20z" fill="#fff"/>${star(32, 14, 2.4, '#fff')}${star(34, 20, 2.4, '#fff')}${star(32, 26, 2.4, '#fff')}`),
  SIK: svg(`<rect width="60" height="40" fill="#d42020"/>${star(30, 20, 9, '#ffd400')}`),
  FR_YUG: svg(hbands('#1c3d8f', '#fff', '#d42020')),
  IRQ_OLD: svg(`${hbands('#ce1126', '#fff', '#111')}${star(20, 20, 3.2, '#007a3d')}${star(30, 20, 3.2, '#007a3d')}${star(40, 20, 3.2, '#007a3d')}`),
  SYR_OLD: svg(`${hbands('#ce1126', '#fff', '#111')}${star(24, 20, 3.4, '#007a3d')}${star(36, 20, 3.4, '#007a3d')}`),
  LBY_GREEN: svg('<rect width="60" height="40" fill="#009a3e"/>'),
  CHN_ROC: null, // uses Taiwan's flag (the Republic of China)
};

(async () => {
  const items = [];
  for (const [code, iso] of Object.entries(ISO2)) items.push({ key: code, svg: read(iso) });
  for (const [key, s] of Object.entries(HISTORICAL)) if (s) items.push({ key, svg: s });
  const browser = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ items, W, H }) => {
    const res = {};
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    for (const it of items) {
      let s = it.svg;
      if (!/preserveAspectRatio/.test(s.slice(0, 300))) s = s.replace('<svg ', '<svg preserveAspectRatio="none" ');
      s = s.replace(/<svg ([^>]*?)>/, (m, a) => /width=/.test(a.replace(/viewBox="[^"]*"/, '')) ? m : `<svg width="${W * 4}" height="${H * 4}" ${a}>`);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      await img.decode().catch(() => null);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      res[it.key] = cv.toDataURL('image/webp', 0.86);
    }
    return res;
  }, { items, W, H });
  await browser.close();
  const js = `// AUTO-GENERATED by tools/build-flags.js. Modern flags: flag-icons (MIT, Panayiotis Lipiridis).\nwindow.IM = window.IM || {};\nwindow.IM.FLAGS = ${JSON.stringify(out)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'data', 'flags.js'), js);
  console.log(`${Object.keys(out).length} flags, ${(js.length / 1024).toFixed(0)} KB`);
})();
