// ゲームデータ定義（レア度・ゾーン・キャラクター・成長曲線）

export const RARITIES = [
  { name: 'コモン',         color: 0xbfc4cc, css: '#bfc4cc', income: 1 },
  { name: 'アンコモン',     color: 0x4cd964, css: '#4cd964', income: 6 },
  { name: 'レア',           color: 0x3a8dff, css: '#3a8dff', income: 35 },
  { name: 'エピック',       color: 0xb05cff, css: '#b05cff', income: 200 },
  { name: 'レジェンダリー', color: 0xffc21a, css: '#ffc21a', income: 1200 },
  { name: 'ミシック',       color: 0xff3b3b, css: '#ff3b3b', income: 7000 },
  { name: 'シークレット',   color: 0xffffff, css: 'rainbow', income: 40000 },
];

// ワールド配置
export const BASE_LINE = 0;        // これより手前(z<0)が拠点＝安全地帯
export const LAUNCH_POS = { x: 0, z: 6 };
export const ZONE_START = 30;
export const ZONE_LEN = 80;
export const WORLD_END = ZONE_START + ZONE_LEN * RARITIES.length;
export const WORLD_HALF_W = 30;

export const ZONES = [
  { name: '草原',   ground: 0x7ec850, alt: 0x6fb944, sky: 0x8fd3ff, deco: 'tree',
    boss: { name: 'スライム大将',   color: 0x5ad16a, speed: 11, scale: 2.0 } },
  { name: '砂漠',   ground: 0xe9cf86, alt: 0xdcc077, sky: 0xffd9a0, deco: 'cactus',
    boss: { name: 'サンドワーム',   color: 0xc9a25a, speed: 14, scale: 2.3 } },
  { name: '氷河',   ground: 0xd8f1ff, alt: 0xc2e6fb, sky: 0xbfe6ff, deco: 'ice',
    boss: { name: 'アイスゴーレム', color: 0x8fd6ff, speed: 17, scale: 2.6 } },
  { name: '毒沼',   ground: 0x7a4f9a, alt: 0x6b4189, sky: 0xb48ad6, deco: 'mushroom',
    boss: { name: 'ポイズンキング', color: 0xa64dff, speed: 20, scale: 2.9 } },
  { name: '黄金郷', ground: 0xf3c94b, alt: 0xe5b934, sky: 0xfff0b0, deco: 'gold',
    boss: { name: 'ゴールドナイト', color: 0xffd23f, speed: 23, scale: 3.2 } },
  { name: '溶岩',   ground: 0x4a2a24, alt: 0x5a2f26, sky: 0xff8a5c, deco: 'lava',
    boss: { name: 'マグマドラゴン', color: 0xff4a1c, speed: 26, scale: 3.6 } },
  { name: '虚空',   ground: 0x1b1530, alt: 0x251c40, sky: 0x2a1f4f, deco: 'crystal',
    boss: { name: 'ヴォイドロード', color: 0x9b6bff, speed: 30, scale: 4.0 } },
];

// キャラクター（形状パラメータは models.js の buildCharacter で使う）
export const CHARACTERS = [
  // コモン
  { id: 'mochi',     r: 0, name: 'まるもち',         mult: 0.8, shape: 'sphere', color: 0xfafafa, accent: 0xffb3c7, extras: ['blush'] },
  { id: 'hakoneko',  r: 0, name: 'はこねこ',         mult: 1.0, shape: 'box',    color: 0xff9f43, accent: 0xffffff, extras: ['ears'] },
  { id: 'kinoko',    r: 0, name: 'ちびキノコ',       mult: 1.3, shape: 'cyl',    color: 0xfff1d6, accent: 0xe74c3c, extras: ['cap'] },
  // アンコモン
  { id: 'saboten',   r: 1, name: 'サボテン兄貴',     mult: 0.8, shape: 'cyl',    color: 0x2ecc71, accent: 0xff6fa8, extras: ['arms', 'flower'] },
  { id: 'kaeru',     r: 1, name: 'カエル紳士',       mult: 1.0, shape: 'sphere', color: 0x58c75b, accent: 0x222222, extras: ['tophat'] },
  { id: 'donguri',   r: 1, name: 'どんぐり丸',       mult: 1.3, shape: 'sphere', color: 0xb5722e, accent: 0x6b4423, extras: ['acorn'] },
  // レア
  { id: 'pengin',    r: 2, name: 'ペンギン騎士',     mult: 0.8, shape: 'sphere', color: 0x2b2f3a, accent: 0xffffff, extras: ['belly', 'helmet'] },
  { id: 'kurage',    r: 2, name: 'クラゲ姫',         mult: 1.0, shape: 'dome',   color: 0x8fd0ff, accent: 0xff9ad5, extras: ['tentacles', 'tiara'] },
  { id: 'robota',    r: 2, name: 'ロボ太',           mult: 1.3, shape: 'box',    color: 0x9aa6b2, accent: 0x3a8dff, extras: ['antenna', 'visor'] },
  // エピック
  { id: 'dragonbb',  r: 3, name: 'ドラゴンベビー',   mult: 0.8, shape: 'sphere', color: 0x9b59b6, accent: 0xffd166, extras: ['horns', 'wings'] },
  { id: 'magician',  r: 3, name: 'マジックハット',   mult: 1.0, shape: 'cyl',    color: 0x2d1b4e, accent: 0xff4d6d, extras: ['tophat', 'stars'] },
  { id: 'neontako',  r: 3, name: 'ネオンタコ',       mult: 1.3, shape: 'dome',   color: 0xff3ec8, accent: 0x00f0ff, extras: ['tentacles', 'glow'] },
  // レジェンダリー
  { id: 'goldking',  r: 4, name: 'ゴールドキング',   mult: 0.8, shape: 'box',    color: 0xffd23f, accent: 0xff3b3b, extras: ['crown', 'glow'] },
  { id: 'phoenix',   r: 4, name: 'フェニックス',     mult: 1.0, shape: 'sphere', color: 0xff7b00, accent: 0xffe066, extras: ['wings', 'flame'] },
  { id: 'samuraineko', r: 4, name: 'サムライ猫',     mult: 1.3, shape: 'box',    color: 0xf5f5f5, accent: 0x1e3a8a, extras: ['ears', 'katana'] },
  // ミシック
  { id: 'magmagolem', r: 5, name: 'マグマゴーレム',  mult: 0.8, shape: 'box',    color: 0x3a2320, accent: 0xff4a1c, extras: ['cracks', 'glow', 'arms'] },
  { id: 'raijin',    r: 5, name: '雷神ダルマ',       mult: 1.0, shape: 'sphere', color: 0xd62828, accent: 0xffe600, extras: ['horns', 'bolt'] },
  { id: 'blackhole', r: 5, name: 'ブラックホール犬', mult: 1.3, shape: 'sphere', color: 0x0b0b12, accent: 0xb388ff, extras: ['ears', 'ring', 'glow'] },
  // シークレット
  { id: 'unicorn',   r: 6, name: '虹色ユニコーン',   mult: 0.8, shape: 'sphere', color: 0xffffff, accent: 0xff77e9, extras: ['unihorn', 'rainbow', 'wings'] },
  { id: 'spacewhale', r: 6, name: '宇宙クジラ',      mult: 1.0, shape: 'dome',   color: 0x1d2b64, accent: 0x9ad0ff, extras: ['stars', 'ring', 'glow'] },
  { id: 'nazoblock', r: 6, name: 'ナゾノブロック',   mult: 1.3, shape: 'box',    color: 0x111111, accent: 0x00ffd0, extras: ['halo', 'rainbow', 'glow'] },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

export const MAX_STAR = 5;
export const SLOT_COUNT = 12;

// ---- 成長曲線 ----
export const charIncome = (c, star = 1) => RARITIES[c.r].income * c.mult * Math.pow(2.2, star - 1);
export const evolveCost = (c, star) => Math.ceil(RARITIES[c.r].income * c.mult * 150 * Math.pow(2.6, star - 1));
export const sellPrice = (c, star) => Math.ceil(charIncome(c, star) * 30);

export const strengthRate = lv => Math.pow(lv, 1.7);           // 放置で増える力/秒
export const dumbbellCost = lv => Math.ceil(15 * Math.pow(1.75, lv - 1));
export const playerSpeed = lv => 14 + (lv - 1) * 1.3;
export const speedCost = lv => Math.ceil(25 * Math.pow(1.9, lv - 1));

// 力と打撃タイミングから飛距離を決める
export function launchDistance(strength, timingMult) {
  const d = 18 + 5.5 * Math.sqrt(strength) * timingMult * (0.9 + Math.random() * 0.2);
  return Math.min(d, WORLD_END - 6);
}

export function zoneAt(z) {
  if (z < ZONE_START) return 0;
  return Math.min(RARITIES.length - 1, Math.floor((z - ZONE_START) / ZONE_LEN));
}

// ゾーンのレア度を中心に、前後のレア度も少し出る
export function rollCharacter(zone) {
  const roll = Math.random();
  let r = zone;
  if (roll < 0.08 && zone < RARITIES.length - 1) r = zone + 1;
  else if (roll < 0.3 && zone > 0) r = zone - 1;
  const pool = CHARACTERS.filter(c => c.r === r);
  // 倍率の高いキャラほど少し出にくい
  const weights = pool.map(c => 1.6 - c.mult * 0.7);
  let t = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { t -= weights[i]; if (t <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return (n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n)).toString();
  let i = 0;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(2) : n.toFixed(1)).replace(/\.?0+$/, '') + UNITS[i];
}
