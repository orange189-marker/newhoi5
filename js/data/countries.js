// Country names, colours and development tiers.
window.IM = window.IM || {};

IM.COUNTRY_NAMES = {
  AFG: 'Afghanistan', ALB: 'Albania', DZA: 'Algeria', AGO: 'Angola', ARG: 'Argentina', ARM: 'Armenia',
  AUS: 'Australia', AUT: 'Austria', AZE: 'Azerbaijan', BHS: 'Bahamas', BGD: 'Bangladesh', BLR: 'Belarus',
  BEL: 'Belgium', BLZ: 'Belize', BEN: 'Benin', BTN: 'Bhutan', BOL: 'Bolivia', BIH: 'Bosnia and Herzegovina',
  BWA: 'Botswana', BRA: 'Brazil', BRN: 'Brunei', BGR: 'Bulgaria', BFA: 'Burkina Faso', BDI: 'Burundi',
  KHM: 'Cambodia', CMR: 'Cameroon', CAN: 'Canada', CAF: 'Central African Republic', TCD: 'Chad', CHL: 'Chile',
  CHN: "People's Republic of China", COL: 'Colombia', COG: 'Congo', CRI: 'Costa Rica', HRV: 'Croatia', CUB: 'Cuba',
  CYP: 'Cyprus', CZE: 'Czechia', CIV: "Côte d'Ivoire", COD: 'DR Congo', DNK: 'Denmark', DJI: 'Djibouti',
  DOM: 'Dominican Republic', ECU: 'Ecuador', EGY: 'Egypt', SLV: 'El Salvador', GNQ: 'Equatorial Guinea',
  ERI: 'Eritrea', EST: 'Estonia', ETH: 'Ethiopia', FLK: 'Falkland Islands', FJI: 'Fiji', FIN: 'Finland',
  FRA: 'France', GAB: 'Gabon', GMB: 'Gambia', GEO: 'Georgia', DEU: 'Germany', GHA: 'Ghana', GRC: 'Greece',
  GRL: 'Greenland', GTM: 'Guatemala', GIN: 'Guinea', GNB: 'Guinea-Bissau', GUY: 'Guyana', HTI: 'Haiti',
  HND: 'Honduras', HUN: 'Hungary', ISL: 'Iceland', IND: 'India', IDN: 'Indonesia', IRN: 'Iran', IRQ: 'Iraq',
  IRL: 'Ireland', ISR: 'Israel', ITA: 'Italy', JAM: 'Jamaica', JPN: 'Japan', JOR: 'Jordan', KAZ: 'Kazakhstan',
  KEN: 'Kenya', XKX: 'Kosovo', KWT: 'Kuwait', KGZ: 'Kyrgyzstan', LAO: 'Laos', LVA: 'Latvia', LBN: 'Lebanon',
  LSO: 'Lesotho', LBR: 'Liberia', LBY: 'Libya', LTU: 'Lithuania', LUX: 'Luxembourg', MKD: 'North Macedonia',
  MDG: 'Madagascar', MWI: 'Malawi', MYS: 'Malaysia', MLI: 'Mali', MRT: 'Mauritania', MEX: 'Mexico',
  MDA: 'Moldova', MNG: 'Mongolia', MNE: 'Montenegro', MAR: 'Morocco', MOZ: 'Mozambique', MMR: 'Myanmar',
  NAM: 'Namibia', NPL: 'Nepal', NLD: 'Netherlands', NCL: 'New Caledonia', NZL: 'New Zealand', NIC: 'Nicaragua',
  NER: 'Niger', NGA: 'Nigeria', PRK: 'North Korea', NOR: 'Norway', OMN: 'Oman', PAK: 'Pakistan', PAN: 'Panama',
  PNG: 'Papua New Guinea', PRY: 'Paraguay', PER: 'Peru', PHL: 'Philippines', POL: 'Poland', PRT: 'Portugal',
  PRI: 'Puerto Rico', QAT: 'Qatar', ROU: 'Romania', RUS: 'Russia', RWA: 'Rwanda', SAU: 'Saudi Arabia',
  SEN: 'Senegal', SRB: 'Serbia', SLE: 'Sierra Leone', SGP: 'Singapore', SVK: 'Slovakia', SVN: 'Slovenia',
  SLB: 'Solomon Islands', SOM: 'Somalia', ZAF: 'South Africa', KOR: 'South Korea', SSD: 'South Sudan',
  ESP: 'Spain', LKA: 'Sri Lanka', SDN: 'Sudan', SUR: 'Suriname', SWE: 'Sweden', CHE: 'Switzerland', SYR: 'Syria',
  TWN: 'Taiwan', TJK: 'Tajikistan', TZA: 'Tanzania', THA: 'Thailand', TLS: 'Timor-Leste', TGO: 'Togo',
  TTO: 'Trinidad and Tobago', TUN: 'Tunisia', TUR: 'Turkey', TKM: 'Turkmenistan', UGA: 'Uganda', UKR: 'Ukraine',
  ARE: 'United Arab Emirates', GBR: 'United Kingdom', USA: 'United States', URY: 'Uruguay', UZB: 'Uzbekistan',
  VUT: 'Vanuatu', VEN: 'Venezuela', VNM: 'Vietnam', YEM: 'Yemen', ZMB: 'Zambia', ZWE: 'Zimbabwe', SWZ: 'Eswatini',
  BHR: 'Bahrain',
  // historical / special tags
  SOV: 'Soviet Union', RAJ: 'British Raj', MAN: 'Manchukuo', MEN: 'Mengjiang', TIB: 'Tibet', SIK: 'Xinjiang',
  TAN: 'Tannu Tuva', YUG: 'Yugoslavia', CZS: 'Czechoslovakia', VIC: 'Vichy France', FFR: 'Free France',
  RSI: 'Italian Social Republic', ICH: 'Chechen Republic of Ichkeria', DPR: "Donetsk People's Republic",
  LPR: "Luhansk People's Republic", PRC: 'Chinese Communists',
};

IM.COUNTRY_COLORS = {
  DEU: '#6b6b6b', GBR: '#b52a33', FRA: '#3d5fae', SOV: '#9e1b1b', RUS: '#3f7d52', USA: '#3a85c4',
  ITA: '#4c9d45', JPN: '#e0c872', CHN: '#cf5a36', POL: '#d8627f', CAN: '#a83c48', AUS: '#3f7244',
  RAJ: '#d99441', IND: '#e39b3a', UKR: '#e8c93b', BLR: '#859245', TUR: '#78b8a3', IRN: '#5d9e62',
  SAU: '#2f7236', BRA: '#57a84b', MEX: '#6ba567', ESP: '#e3b64a', PRT: '#3c7a52', NLD: '#e8873a',
  BEL: '#d9c24a', SWE: '#4f8ed1', NOR: '#8a4545', FIN: '#e6e6f0', DNK: '#b56a6a', ROU: '#d6c65c',
  HUN: '#bb7d58', BGR: '#6aa06a', YUG: '#7a6fb0', GRC: '#7fb0e0', CZS: '#5f8fc4', CZE: '#5f8fc4',
  MAN: '#b9a14a', MEN: '#a58f5a', VIC: '#5a78b6', FFR: '#2e4c8f', RSI: '#2f5f2a', ZAF: '#c27b3f',
  NZL: '#557f8a', EGY: '#c9b37d', IRQ: '#8a9c5a', ISR: '#5b8fd6', PAK: '#3b6e3b', KOR: '#6d8fc2',
  PRK: '#a55252', TWN: '#4a5ea8', VNM: '#c24d4d', IDN: '#b34d4d', THA: '#6b6fb8', ARG: '#8fc4e8',
  CHL: '#ad5a6b', KAZ: '#63a3b8', MNG: '#8c5a7a', SYR: '#8a6a6a', SRB: '#8b6fa8', HRV: '#5a6fb3',
  DPR: '#7a3a3a', LPR: '#8a4a4a', ICH: '#5a7a3a', AFG: '#9b8563', GER: '#6b6b6b',
};

// Development tier of each modern region (industrial base per head).
// A = advanced, B = industrialising, C = developing, D = low.
IM.DEV_TIER = {
  A: ['USA', 'GBR', 'FRA', 'DEU', 'CAN', 'AUS', 'NZL', 'NLD', 'BEL', 'LUX', 'CHE', 'SWE', 'NOR', 'DNK', 'FIN',
    'ISL', 'IRL', 'AUT', 'ITA', 'JPN', 'ISR', 'SGP'],
  B: ['ESP', 'PRT', 'GRC', 'POL', 'CZE', 'SVK', 'HUN', 'SVN', 'HRV', 'EST', 'LVA', 'LTU', 'RUS', 'UKR', 'BLR',
    'KOR', 'TWN', 'ARG', 'URY', 'CHL', 'ROU', 'BGR', 'SRB', 'ARE', 'QAT', 'KWT', 'BHR', 'SAU', 'CYP', 'TUR',
    'MYS', 'ZAF', 'MEX', 'BRA', 'CHN', 'KAZ', 'IRN', 'OMN', 'BRN'],
  C: ['IND', 'EGY', 'THA', 'IDN', 'PHL', 'VNM', 'COL', 'PER', 'VEN', 'ECU', 'DZA', 'MAR', 'TUN', 'LBY', 'IRQ',
    'SYR', 'JOR', 'LBN', 'GEO', 'ARM', 'AZE', 'UZB', 'TKM', 'MNG', 'PAK', 'LKA', 'CUB', 'DOM', 'PAN', 'CRI',
    'BIH', 'MKD', 'ALB', 'MNE', 'XKX', 'MDA', 'BOL', 'PRY', 'NGA', 'GAB', 'AGO', 'NAM', 'BWA', 'PRK', 'GTM',
    'JAM', 'TTO', 'PRI'],
};

IM.tierOf = function (code) {
  for (const t of ['A', 'B', 'C']) if (IM.DEV_TIER[t].includes(code)) return t;
  return 'D';
};

IM.hashColor = function (tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 131 + tag.charCodeAt(i) * 17) % 3600;
  const hue = (h * 7) % 360, sat = 32 + (h % 23), lit = 48 + (h % 17);
  return `hsl(${hue},${sat}%,${lit}%)`;
};

IM.IDEOLOGIES = {
  democratic: { name: 'Democratic', color: '#4d8fd6' },
  communist: { name: 'Communist', color: '#c43b3b' },
  fascist: { name: 'Fascist', modernName: 'Nationalist', color: '#7a5a3a' },
  authoritarian: { name: 'Non-Aligned', modernName: 'Authoritarian', color: '#8a8a5a' },
};

// Short display names for cards and tight spaces.
IM.SHORT_NAMES = { SOV: 'Soviet Union', CHN: 'China', USA: 'United States', GBR: 'Britain', DEU: 'Germany', RAJ: 'British Raj', RSI: 'Salò Republic', CZS: 'Czechoslovakia', ICH: 'Ichkeria', DPR: 'Donetsk PR', LPR: 'Luhansk PR', COD: 'DR Congo', CAF: 'C. African Rep.', ARE: 'UAE' };
IM.shortName = function (c, max) {
  max = max || 16;
  if (c.name.length <= max) return c.name;
  if (IM.SHORT_NAMES[c.tag]) return IM.SHORT_NAMES[c.tag];
  const stripped = c.name.replace(/^(The )?(Second |Independent State of |Islamic Republic of |Islamic Emirate of |Republic of |Kingdom of |Empire of |Tsardom of |Union of |Provisional Government of |Democratic Federal |Federal Republic of |Czech and Slovak Federative |People's Republic of )/i, '').replace(/ (Republic|Federation)$/, '');
  if (stripped.length <= max) return stripped === 'Polish' ? 'Poland' : stripped === 'Russian' ? 'Russia' : stripped;
  const base = IM.COUNTRY_NAMES[c.tag];
  return base && base.length <= max ? base : c.tag;
};
