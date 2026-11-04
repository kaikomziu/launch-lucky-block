// ゲームデータ定義（レア度・ゾーン・キャラクター・成長曲線）

export const RARITIES = [
  { name: 'コモン',         color: 0xbfc4cc, css: '#bfc4cc', income: 1 },
  { name: 'アンコモン',     color: 0x4cd964, css: '#4cd964', income: 6 },
  { name: 'レア',           color: 0x3a8dff, css: '#3a8dff', income: 35 },
  { name: 'エピック',       color: 0xb05cff, css: '#b05cff', income: 200 },
  { name: 'レジェンダリー', color: 0xffc21a, css: '#ffc21a', income: 1200 },
  { name: 'ミシック',       color: 0xff3b3b, css: '#ff3b3b', income: 7000 },
  { name: 'シークレット',   color: 0xffffff, css: 'rainbow', income: 40000, fx: 0xff77e9 },
  { name: 'セレスティアル', color: 0x7df9ff, css: '#7df9ff', income: 250000 },
  { name: 'ゴッド',         color: 0xff9f1c, css: '#ff9f1c', income: 1600000 },
  { name: 'エターナル',     color: 0xc0c8ff, css: '#c0c8ff', income: 10000000 },
  { name: 'インフィニティ', color: 0xffffff, css: 'cosmic', income: 70000000, fx: 0x8a7dff },
  { name: 'オーロラ',       color: 0x7dffd8, css: '#7dffd8', income: 500000000 },
  { name: 'ネビュラ',       color: 0xff7ae0, css: '#ff7ae0', income: 3500000000 },
  { name: 'カオス',         color: 0xd6336c, css: '#d6336c', income: 25000000000 },
  { name: 'オメガ',         color: 0xffffff, css: 'rainbow', income: 180000000000, fx: 0xffd23f },
  { name: 'ヤマト',         color: 0xff5c8a, css: '#ff5c8a', income: 1260000000000 },
  { name: 'ワイルド',       color: 0x4caf50, css: '#4caf50', income: 8.82e12 },
  { name: 'スイート',       color: 0xff9ecb, css: '#ff9ecb', income: 6.17e13 },
  { name: 'パイレーツ',     color: 0xc0873f, css: '#c0873f', income: 4.32e14 },
  { name: 'ジュラ',         color: 0x8bc34a, css: '#8bc34a', income: 3.03e15 },
  { name: 'サイバー',       color: 0x00f5d4, css: '#00f5d4', income: 2.12e16 },
  { name: 'セラフ',         color: 0xfff3b0, css: '#fff3b0', income: 1.48e17 },
  { name: 'ファントム',     color: 0x9e9ac8, css: '#9e9ac8', income: 1.04e18 },
  { name: 'アルティメット', color: 0xffffff, css: 'cosmic', income: 7.27e18, fx: 0xff5cf4 },
];
// 3D演出・枠線に使う色（白いレア度は代わりの色）
export const rarFx = r => RARITIES[r].fx ?? RARITIES[r].color;
export const rarCss = r => RARITIES[r].fx ? '#' + RARITIES[r].fx.toString(16).padStart(6, '0') : RARITIES[r].css;

// ボスの追跡: 追いかけるほど速くなり（最大 +25%）、ときどきダッシュする
export const BOSS_ACCEL = 0.05;        // 1秒ごとに基本の速さの +5%
export const BOSS_ACCEL_MAX = 1.25;
export const BOSS_DASH_EVERY = 4;    // 秒
export const BOSS_DASH_TIME = 0.6;     // 秒
export const BOSS_DASH_MULT = 1.6;

// ワールド配置
export const BASE_LINE = 0;        // これより手前(z<0)が拠点＝安全地帯
export const LAUNCH_POS = { x: 0, z: 6 };
export const ZONE_START = 30;
// ゾーンの長さ: 遠いゾーンほど長い（草原80m → 1つ先ごとに +12m）
export const ZONE_LENS = RARITIES.map((_, i) => 80 + 12 * i);
export const ZONE_STARTS = ZONE_LENS.map((_, i) => ZONE_START + ZONE_LENS.slice(0, i).reduce((a, b) => a + b, 0));
export const WORLD_END = ZONE_STARTS[RARITIES.length - 1] + ZONE_LENS[RARITIES.length - 1];
export const WORLD_HALF_W = 30;

export const ZONES = [
  { name: '草原',   ground: 0x7ec850, alt: 0x6fb944, sky: 0x8fd3ff, deco: 'tree',
    boss: { name: 'スライム大将', kind: 'slime',   color: 0x5ad16a, speed: 13, scale: 2.0 } },
  { name: '砂漠',   ground: 0xe9cf86, alt: 0xdcc077, sky: 0xffd9a0, deco: 'cactus',
    boss: { name: 'サンドワーム', kind: 'worm',   color: 0xc9a25a, speed: 17, scale: 2.3 } },
  { name: '氷河',   ground: 0xd8f1ff, alt: 0xc2e6fb, sky: 0xbfe6ff, deco: 'ice',
    boss: { name: 'アイスゴーレム', kind: 'golem', color: 0x8fd6ff, speed: 21, scale: 2.6 } },
  { name: '毒沼',   ground: 0x7a4f9a, alt: 0x6b4189, sky: 0xb48ad6, deco: 'mushroom',
    boss: { name: 'ポイズンキング', kind: 'mushroom', color: 0xa64dff, speed: 25, scale: 2.9 } },
  { name: '黄金郷', ground: 0xf3c94b, alt: 0xe5b934, sky: 0xfff0b0, deco: 'gold',
    boss: { name: 'ゴールドナイト', kind: 'knight', color: 0xffd23f, speed: 29, scale: 3.2 } },
  { name: '溶岩',   ground: 0x4a2a24, alt: 0x5a2f26, sky: 0xff8a5c, deco: 'lava',
    boss: { name: 'マグマドラゴン', kind: 'dragon', color: 0xff4a1c, speed: 33, scale: 3.6 } },
  { name: '虚空',   ground: 0x1b1530, alt: 0x251c40, sky: 0x2a1f4f, deco: 'crystal',
    boss: { name: 'ヴォイドロード', kind: 'void', color: 0x9b6bff, speed: 37, scale: 4.0 } },
  { name: '天空',     ground: 0xf4f9ff, alt: 0xe2efff, sky: 0xc9e8ff, deco: 'cloud',
    boss: { name: 'テンペストグリフォン', kind: 'griffon', color: 0xe0f4ff, speed: 41, scale: 4.4 } },
  { name: '深海',     ground: 0x0e3b5c, alt: 0x12476d, sky: 0x1d5f8a, deco: 'coral',
    boss: { name: 'クラーケン', kind: 'kraken',     color: 0xd81b60, speed: 45, scale: 4.8 } },
  { name: '機械都市', ground: 0x3a3f47, alt: 0x454b55, sky: 0x8e9aab, deco: 'tower',
    boss: { name: 'ギガロボ', kind: 'robot',       color: 0x8d99ae, speed: 49, scale: 5.2 } },
  { name: '時空の果て', ground: 0x0a0a16, alt: 0x15152c, sky: 0x0b0820, deco: 'clock',
    boss: { name: 'クロノス', kind: 'chronos',       color: 0xffe066, speed: 53, scale: 5.6 } },
  { name: 'オーロラ平原', ground: 0x0f2238, alt: 0x13304d, sky: 0x1b3b5f, deco: 'aurora',
    boss: { name: 'オーロラフェンリル', kind: 'wolf', color: 0x7dffd8, speed: 57, scale: 6.0 } },
  { name: '星雲の海', ground: 0x2a0f3a, alt: 0x3a1452, sky: 0x3d1a5c, deco: 'nebula',
    boss: { name: 'ネビュラクイーン', kind: 'queen', color: 0xff7ae0, speed: 61, scale: 6.4 } },
  { name: '混沌の大地', ground: 0x2b0a0a, alt: 0x3a0f0f, sky: 0x4a0d0d, deco: 'chaos',
    boss: { name: 'カオスタイタン', kind: 'titan',   color: 0xff2a2a, speed: 65, scale: 6.8 } },
  { name: 'ラッキーの頂', ground: 0xfff3c4, alt: 0xffe58a, sky: 0xfff6d5, deco: 'luckyblock',
    boss: { name: 'ラッキーキング', kind: 'luckyking',   color: 0xffd23f, speed: 69, scale: 7.2 } },
  { name: '日本', ground: 0xc9e4b4, alt: 0xb7d8a0, sky: 0xffdbe9, deco: 'sakura',
    boss: { name: '影の忍者', kind: 'ninja', color: 0x1b1f3a, speed: 73, scale: 7.6 } },
  { name: 'ジャングル', ground: 0x3f7d3a, alt: 0x356c31, sky: 0x9fe0b0, deco: 'palm',
    boss: { name: 'キングゴリラ', kind: 'gorilla', color: 0x3a2e2a, speed: 77, scale: 8.0 } },
  { name: 'お菓子の国', ground: 0xffd1e8, alt: 0xffe3f1, sky: 0xffe8f6, deco: 'candy',
    boss: { name: 'ケーキモンスター', kind: 'cake', color: 0xffe0b5, speed: 81, scale: 8.4 } },
  { name: '海賊の島', ground: 0xe8d29a, alt: 0xdcc382, sky: 0x8fd8ff, deco: 'treasure',
    boss: { name: 'ゴースト船長', kind: 'pirate', color: 0x2b3a55, speed: 85, scale: 8.8 } },
  { name: '恐竜の谷', ground: 0x8a6a3a, alt: 0x7a5c30, sky: 0xffc48a, deco: 'fern',
    boss: { name: 'ティラノキング', kind: 'trex', color: 0x5a8a3a, speed: 89, scale: 9.2 } },
  { name: 'ネオン街', ground: 0x14142a, alt: 0x1c1c38, sky: 0x1a0a33, deco: 'neon',
    boss: { name: 'ネオン龍', kind: 'serpent', color: 0x00f5d4, speed: 93, scale: 9.6 } },
  { name: '天空城', ground: 0xf5f0e1, alt: 0xe9e2cc, sky: 0xd8ecff, deco: 'pillar',
    boss: { name: '大天使', kind: 'angel', color: 0xfff8e7, speed: 97, scale: 10.0 } },
  { name: 'お化け屋敷', ground: 0x2a2433, alt: 0x332b3d, sky: 0x2b2440, deco: 'grave',
    boss: { name: 'ビッグゴースト', kind: 'ghost', color: 0xe8eaff, speed: 101, scale: 10.4 } },
  { name: '虹の果て', ground: 0xffffff, alt: 0xf3f0ff, sky: 0xe9e4ff, deco: 'rainbowarch',
    boss: { name: '究極ラッキーブロック', kind: 'ultimate', color: 0xffd23f, speed: 105, scale: 10.8 } },
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
  // ---- v0.16 で追加 ----
  // コモン
  { id: 'purin',     r: 0, name: 'プリンちゃん',     mult: 0.7, shape: 'cyl',    color: 0xffd27f, accent: 0x7a3e12, extras: ['topcap', 'blush'] },
  { id: 'onigiri',   r: 0, name: 'おにぎりくん',     mult: 0.9, shape: 'cone',   color: 0xfafafa, accent: 0x1b2a1b, extras: ['nori'] },
  { id: 'hiyoko',    r: 0, name: 'ぴよ助',           mult: 1.1, shape: 'egg',    color: 0xffe14d, accent: 0xff9f1c, extras: ['beak', 'sprout'] },
  { id: 'ishikoro',  r: 0, name: 'いしころ親分',     mult: 1.2, shape: 'sphere', color: 0x9aa0a6, accent: 0x6b7280, extras: ['mustache'] },
  { id: 'kumocchi',  r: 0, name: 'くもっち',         mult: 1.4, shape: 'sphere', color: 0xffffff, accent: 0xff9ad5, extras: ['puffs', 'blush'] },
  { id: 'tamago',    r: 0, name: 'ゆでたまご',       mult: 1.5, shape: 'egg',    color: 0xfff8ec, accent: 0xffb3c7, extras: ['blush', 'bow'] },
  // アンコモン
  { id: 'hamutai',   r: 1, name: 'ハムスター隊長',   mult: 0.7, shape: 'sphere', color: 0xf4b183, accent: 0xffffff, extras: ['ears', 'belly', 'helmet'] },
  { id: 'kamekichi', r: 1, name: 'カメ吉',           mult: 0.9, shape: 'dome',   color: 0x7bc96f, accent: 0x8b5a2b, extras: ['shell'] },
  { id: 'togetoge',  r: 1, name: 'トゲトゲ丸',       mult: 1.1, shape: 'sphere', color: 0xc9a27e, accent: 0x5d4037, extras: ['spikes', 'blush'] },
  { id: 'teruteru',  r: 1, name: 'てるてる坊',       mult: 1.2, shape: 'egg',    color: 0xf7f9ff, accent: 0xff5a5a, extras: ['scarf', 'blush'] },
  { id: 'usaphone',  r: 1, name: 'ヘッドホンうさぎ', mult: 1.4, shape: 'egg',    color: 0xffc0d9, accent: 0x7c4dff, extras: ['ears', 'headphones'] },
  { id: 'yukidaruma', r: 1, name: 'ゆきだるマン',    mult: 1.5, shape: 'sphere', color: 0xffffff, accent: 0xff7b00, extras: ['beak', 'scarf'] },
  // レア
  { id: 'kaizoku',   r: 2, name: 'パイレーツバード', mult: 0.7, shape: 'egg',    color: 0x2ec4b6, accent: 0xffbf00, extras: ['beak', 'eyepatch'] },
  { id: 'ninja',     r: 2, name: 'ニンジャだるま',   mult: 0.9, shape: 'sphere', color: 0x2b2d42, accent: 0xe63946, extras: ['scarf', 'katana'] },
  { id: 'herimame',  r: 2, name: 'ヘリまめ',         mult: 1.1, shape: 'egg',    color: 0x9be15d, accent: 0xff6b6b, extras: ['propeller', 'blush'] },
  { id: 'samebou',   r: 2, name: 'シャーク坊',       mult: 1.2, shape: 'egg',    color: 0x5c9ead, accent: 0xdfefff, extras: ['fins', 'teeth'] },
  { id: 'hakase',    r: 2, name: 'メガネ博士',       mult: 1.4, shape: 'cyl',    color: 0xf1f1f1, accent: 0x3a86ff, extras: ['glasses', 'mustache'] },
  { id: 'kinokoou',  r: 2, name: 'キノコ大王',       mult: 1.5, shape: 'cyl',    color: 0xfff1d6, accent: 0x7b2cbf, extras: ['cap', 'crown'] },
  // エピック
  { id: 'hero',      r: 3, name: 'ヒーローマン',     mult: 0.7, shape: 'box',    color: 0x1e88e5, accent: 0xe53935, extras: ['cape', 'visor'] },
  { id: 'crystalsl', r: 3, name: 'クリスタルスライム', mult: 0.9, shape: 'dome', color: 0x7af0ff, accent: 0xb388ff, extras: ['gem', 'glow'] },
  { id: 'stego',     r: 3, name: 'ステゴくん',       mult: 1.1, shape: 'egg',    color: 0x6fbf73, accent: 0xff8f00, extras: ['spikes', 'tail'] },
  { id: 'djcat',     r: 3, name: 'DJキャット',       mult: 1.2, shape: 'box',    color: 0x2b2d42, accent: 0x00f5d4, extras: ['headphones', 'ears', 'glow'] },
  { id: 'fukurou',   r: 3, name: 'オーロラフクロウ', mult: 1.4, shape: 'egg',    color: 0x5e548e, accent: 0x9ef01a, extras: ['beak', 'wings', 'glasses'] },
  { id: 'candymajo', r: 3, name: 'キャンディ魔女',   mult: 1.5, shape: 'cone',   color: 0xff70a6, accent: 0x70d6ff, extras: ['bow', 'stars'] },
  // レジェンダリー
  { id: 'musha',     r: 4, name: '武者カブト',       mult: 0.7, shape: 'box',    color: 0x8d0801, accent: 0xffd23f, extras: ['horns', 'katana', 'cape'] },
  { id: 'kumoryu',   r: 4, name: '雲海ドラゴン',     mult: 0.9, shape: 'egg',    color: 0xe0f7fa, accent: 0x26c6da, extras: ['horns', 'wings', 'tail'] },
  { id: 'pyramid',   r: 4, name: 'ピラミッド王',     mult: 1.1, shape: 'cone',   color: 0xe9c46a, accent: 0x2a9d8f, extras: ['gem', 'glow'] },
  { id: 'santa',     r: 4, name: 'サンタ大将',       mult: 1.2, shape: 'sphere', color: 0xe63946, accent: 0xffffff, extras: ['mustache', 'topcap', 'belly'] },
  { id: 'mechashark', r: 4, name: 'メカシャーク',    mult: 1.4, shape: 'egg',    color: 0x6c757d, accent: 0xff3b3b, extras: ['fins', 'visor', 'antenna'] },
  { id: 'sakura',    r: 4, name: '桜の精',           mult: 1.5, shape: 'egg',    color: 0xffd6e8, accent: 0xff8fab, extras: ['sprout', 'bow', 'stars'] },
  // ミシック
  { id: 'koorijo',   r: 5, name: '氷の女王',         mult: 0.7, shape: 'cone',   color: 0xbde0fe, accent: 0x4895ef, extras: ['crown', 'cape', 'glow'] },
  { id: 'monban',    r: 5, name: '冥界の門番',       mult: 0.9, shape: 'box',    color: 0x14213d, accent: 0x9d4edd, extras: ['horns', 'eyepatch', 'cape', 'glow'] },
  { id: 'tokeiusa',  r: 5, name: '時計うさぎ',       mult: 1.1, shape: 'egg',    color: 0xf8f9fa, accent: 0xd4a017, extras: ['ears', 'glasses', 'orbit'] },
  { id: 'yogankame', r: 5, name: '溶岩タートル',     mult: 1.2, shape: 'dome',   color: 0x5c2a1e, accent: 0xff6d00, extras: ['shell', 'cracks', 'glow'] },
  { id: 'gingasl',   r: 5, name: '銀河スライム',     mult: 1.4, shape: 'dome',   color: 0x240046, accent: 0xff9e00, extras: ['orbit', 'stars', 'glow'] },
  { id: 'griffon',   r: 5, name: '雷鳴グリフォン',   mult: 1.5, shape: 'egg',    color: 0xf4a261, accent: 0xffe600, extras: ['beak', 'wings', 'bolt'] },
  // シークレット
  { id: 'uchuneko',  r: 6, name: '大宇宙ネコ',       mult: 0.7, shape: 'box',    color: 0x0b0b12, accent: 0xff5cf4, extras: ['ears', 'orbit', 'halo', 'glow'] },
  { id: 'nijifenix', r: 6, name: '虹のフェニックス王', mult: 0.9, shape: 'sphere', color: 0xffffff, accent: 0xffd23f, extras: ['crown', 'wings', 'flame', 'rainbow'] },
  { id: 'kinryujin', r: 6, name: '黄金竜神',         mult: 1.1, shape: 'egg',    color: 0xffd23f, accent: 0xff3b3b, extras: ['horns', 'wings', 'tail', 'glow'] },
  { id: 'kansokusha', r: 6, name: '次元の観測者',    mult: 1.2, shape: 'sphere', color: 0x111111, accent: 0x00ffd0, extras: ['gem', 'ring', 'rainbow'] },
  { id: 'miraclepurin', r: 6, name: 'ミラクルプリン', mult: 1.4, shape: 'cyl',   color: 0xffe08a, accent: 0xff4d6d, extras: ['topcap', 'crown', 'stars', 'glow'] },
  { id: 'hoshipen',  r: 6, name: '星くずペンギン',   mult: 1.5, shape: 'sphere', color: 0x14213d, accent: 0xfff27a, extras: ['belly', 'stars', 'halo', 'propeller'] },

  // ---- v0.18 で追加（新ゾーン） ----
  // セレスティアル（天空）
  { id: 'tenshineko', r: 7, name: '天使ネコ',        mult: 0.7, shape: 'sphere', color: 0xfffaf0, accent: 0xffe066, extras: ['ears', 'halo', 'wings'] },
  { id: 'kumokujira', r: 7, name: '雲クジラ',        mult: 0.9, shape: 'egg',    color: 0xe3f2fd, accent: 0x90caf9, extras: ['fins', 'puffs', 'tail'] },
  { id: 'kazeryu',   r: 7, name: '風の竜',           mult: 1.1, shape: 'egg',    color: 0xb2ebf2, accent: 0x00bcd4, extras: ['horns', 'wings', 'tail', 'glow'] },
  { id: 'hoshiyomi', r: 7, name: '星読みフクロウ',   mult: 1.2, shape: 'egg',    color: 0x283593, accent: 0xfff27a, extras: ['beak', 'glasses', 'stars'] },
  { id: 'pegasus',   r: 7, name: 'ペガサス',         mult: 1.4, shape: 'sphere', color: 0xffffff, accent: 0x7df9ff, extras: ['unihorn', 'wings', 'glow'] },
  { id: 'tenkuou',   r: 7, name: '天空の王',         mult: 1.5, shape: 'box',    color: 0xf5f5f5, accent: 0xffd23f, extras: ['crown', 'cape', 'halo'] },
  // ゴッド（深海）
  { id: 'kingkraken', r: 8, name: '王様クラーケン',  mult: 0.7, shape: 'dome',   color: 0xc2185b, accent: 0xffd23f, extras: ['tentacles', 'crown', 'glow'] },
  { id: 'chouchin',  r: 8, name: 'チョウチン親方',   mult: 0.9, shape: 'egg',    color: 0x263238, accent: 0xfff176, extras: ['antenna', 'teeth', 'fins'] },
  { id: 'shinjugai', r: 8, name: '真珠ガイ',         mult: 1.1, shape: 'dome',   color: 0xf8bbd0, accent: 0xffffff, extras: ['shell', 'gem', 'glow'] },
  { id: 'umiryu',    r: 8, name: '海竜',             mult: 1.2, shape: 'egg',    color: 0x00695c, accent: 0x64ffda, extras: ['horns', 'fins', 'tail'] },
  { id: 'kaijin',    r: 8, name: '海神ダルマ',       mult: 1.4, shape: 'sphere', color: 0x0d47a1, accent: 0xffd23f, extras: ['crown', 'mustache', 'glow'] },
  { id: 'kuragetei', r: 8, name: 'クラゲ大帝',       mult: 1.5, shape: 'dome',   color: 0xb388ff, accent: 0x7df9ff, extras: ['tentacles', 'tiara', 'halo', 'glow'] },
  // エターナル（機械都市）
  { id: 'megabot',   r: 9, name: 'メガボット',       mult: 0.7, shape: 'box',    color: 0x90a4ae, accent: 0x00e5ff, extras: ['antenna', 'visor', 'arms'] },
  { id: 'cyberneko', r: 9, name: 'サイバーネコ',     mult: 0.9, shape: 'box',    color: 0x212121, accent: 0x00ffa3, extras: ['ears', 'headphones', 'glow'] },
  { id: 'dronemaru', r: 9, name: 'ドローン丸',       mult: 1.1, shape: 'sphere', color: 0xeceff1, accent: 0xff1744, extras: ['propeller', 'visor'] },
  { id: 'mechadragon', r: 9, name: 'メカドラゴン',   mult: 1.2, shape: 'egg',    color: 0x546e7a, accent: 0xff6d00, extras: ['horns', 'wings', 'spikes', 'glow'] },
  { id: 'robohakase', r: 9, name: '博士ロボX',       mult: 1.4, shape: 'cyl',    color: 0xcfd8dc, accent: 0x2979ff, extras: ['glasses', 'antenna', 'cape'] },
  { id: 'coreking',  r: 9, name: 'コアキング',       mult: 1.5, shape: 'box',    color: 0x1a237e, accent: 0x00ffa3, extras: ['crown', 'gem', 'orbit', 'glow'] },
  // インフィニティ（時空の果て）
  { id: 'jikuneko',  r: 10, name: '時空ネコ',        mult: 0.7, shape: 'box',    color: 0x0b0b12, accent: 0x8a7dff, extras: ['ears', 'orbit', 'ring', 'glow'] },
  { id: 'chronosegg', r: 10, name: 'クロノスの卵',   mult: 0.9, shape: 'egg',    color: 0xfff3c4, accent: 0xffd23f, extras: ['halo', 'ring', 'orbit', 'rainbow'] },
  { id: 'mugensl',   r: 10, name: '無限スライム',    mult: 1.1, shape: 'dome',   color: 0x111111, accent: 0xff5cf4, extras: ['gem', 'stars', 'orbit', 'rainbow'] },
  { id: 'souseiryu', r: 10, name: '創世ドラゴン',    mult: 1.2, shape: 'egg',    color: 0xffffff, accent: 0x8a7dff, extras: ['horns', 'wings', 'tail', 'halo', 'rainbow'] },
  { id: 'shuen',     r: 10, name: '終焉の王',        mult: 1.4, shape: 'box',    color: 0x14001f, accent: 0xff1744, extras: ['crown', 'cape', 'horns', 'glow'] },
  { id: 'luckygod',  r: 10, name: 'ラッキーゴッド',  mult: 1.5, shape: 'box',    color: 0xffd23f, accent: 0xffffff, extras: ['halo', 'wings', 'stars', 'glow'] },

  // ---- v0.32 で追加（新ゾーン） ----
  // オーロラ（オーロラ平原）
  { id: 'aurorafox', r: 11, name: 'オーロラギツネ',  mult: 0.7, shape: 'egg',    color: 0xe0fff7, accent: 0x7dffd8, extras: ['ears', 'tail', 'glow'] },
  { id: 'yukihime',  r: 11, name: '雪の姫',          mult: 0.9, shape: 'cone',   color: 0xf0f8ff, accent: 0x9ad0ff, extras: ['tiara', 'cape', 'stars'] },
  { id: 'hyougakujira', r: 11, name: '氷河クジラ',   mult: 1.1, shape: 'dome',   color: 0x9fe8f5, accent: 0x2a9d8f, extras: ['fins', 'tail', 'glow'] },
  { id: 'kyokkouryu', r: 11, name: '極光竜',         mult: 1.2, shape: 'egg',    color: 0x1b4965, accent: 0x7dffd8, extras: ['horns', 'wings', 'tail', 'glow'] },
  { id: 'hoshiookami', r: 11, name: '星オオカミ',    mult: 1.4, shape: 'box',    color: 0x2b2d42, accent: 0x7df9ff, extras: ['ears', 'halo', 'stars'] },
  { id: 'aurorakami', r: 11, name: 'オーロラの神',   mult: 1.5, shape: 'sphere', color: 0xffffff, accent: 0x7dffd8, extras: ['crown', 'wings', 'orbit', 'glow'] },
  // ネビュラ（星雲の海）
  { id: 'nebulaneko', r: 12, name: '星雲ネコ',       mult: 0.7, shape: 'box',    color: 0x3d1a5c, accent: 0xff7ae0, extras: ['ears', 'orbit', 'glow'] },
  { id: 'uchuukurage', r: 12, name: '宇宙クラゲ',    mult: 0.9, shape: 'dome',   color: 0xff9ad5, accent: 0x7df9ff, extras: ['tentacles', 'stars', 'glow'] },
  { id: 'meteorkun', r: 12, name: 'メテオくん',      mult: 1.1, shape: 'sphere', color: 0x6c4f3d, accent: 0xff6d00, extras: ['flame', 'cracks'] },
  { id: 'nebularyu', r: 12, name: 'ネビュラドラゴン', mult: 1.2, shape: 'egg',   color: 0x5a189a, accent: 0xff7ae0, extras: ['horns', 'wings', 'spikes', 'glow'] },
  { id: 'seizakenja', r: 12, name: '星座の賢者',     mult: 1.4, shape: 'cyl',    color: 0x240046, accent: 0xfff27a, extras: ['tophat', 'glasses', 'stars'] },
  { id: 'nebulaqueen', r: 12, name: '星雲の女王',    mult: 1.5, shape: 'cone',   color: 0xff7ae0, accent: 0xffd23f, extras: ['crown', 'cape', 'orbit', 'glow'] },
  // カオス（混沌の大地）
  { id: 'chaosblock', r: 13, name: 'カオスブロック', mult: 0.7, shape: 'box',    color: 0x1a0000, accent: 0xff2a2a, extras: ['cracks', 'glow', 'ring'] },
  { id: 'koakuma',   r: 13, name: '小悪魔',          mult: 0.9, shape: 'egg',    color: 0x8b0000, accent: 0x222222, extras: ['horns', 'wings', 'tail'] },
  { id: 'hametsunome', r: 13, name: '破滅の目',      mult: 1.1, shape: 'sphere', color: 0x111111, accent: 0xff2a2a, extras: ['gem', 'ring', 'glow'] },
  { id: 'kurokishi', r: 13, name: '黒騎士',          mult: 1.2, shape: 'box',    color: 0x22223b, accent: 0xff2a2a, extras: ['helmet', 'katana', 'cape'] },
  { id: 'chaosryu',  r: 13, name: 'カオスドラゴン',  mult: 1.4, shape: 'egg',    color: 0x2b0000, accent: 0xff6d00, extras: ['horns', 'wings', 'spikes', 'flame'] },
  { id: 'konton',    r: 13, name: '混沌の王',        mult: 1.5, shape: 'box',    color: 0x14001f, accent: 0xff2a2a, extras: ['crown', 'cape', 'orbit', 'glow'] },
  // オメガ（ラッキーの頂）
  { id: 'ougonblock', r: 14, name: '黄金ブロック',   mult: 0.7, shape: 'box',    color: 0xffd23f, accent: 0xffffff, extras: ['halo', 'glow', 'stars'] },
  { id: 'luckyneko', r: 14, name: '招きラッキーネコ', mult: 0.9, shape: 'sphere', color: 0xffffff, accent: 0xffd23f, extras: ['ears', 'bow', 'glow', 'rainbow'] },
  { id: 'omegaegg',  r: 14, name: 'オメガの卵',      mult: 1.1, shape: 'egg',    color: 0xffffff, accent: 0xffd23f, extras: ['crown', 'orbit', 'rainbow'] },
  { id: 'tenchi',    r: 14, name: '天地創造',        mult: 1.2, shape: 'sphere', color: 0xfff3c4, accent: 0x7df9ff, extras: ['halo', 'wings', 'ring', 'glow'] },
  { id: 'omegaryu',  r: 14, name: 'オメガドラゴン',  mult: 1.4, shape: 'egg',    color: 0xffd23f, accent: 0xff3b3b, extras: ['horns', 'wings', 'tail', 'orbit', 'glow'] },
  { id: 'luckyking', r: 14, name: 'ラッキーキング',  mult: 1.5, shape: 'box',    color: 0xffd23f, accent: 0xff7ae0, extras: ['crown', 'cape', 'wings', 'rainbow'] },
  // ---- 激レア（各ゾーンに1体・1%抽選のみ・稼ぎ ×3） ----
  { id: 'goldmochi',  r: 0,  name: 'きらめくまるもち', mult: 3, shape: 'sphere', color: 0xffd23f, accent: 0xffffff, extras: ['glow', 'halo', 'blush', 'stars'], lowRate: true },
  { id: 'royalkaeru', r: 1,  name: 'ロイヤルカエル卿', mult: 3, shape: 'sphere', color: 0xffd700, accent: 0x8b0000, extras: ['crown', 'tophat', 'glow'], lowRate: true },
  { id: 'ginpen',     r: 2,  name: 'ぎんぴん王',       mult: 3, shape: 'sphere', color: 0xdfe9f5, accent: 0x3a86ff, extras: ['crown', 'belly', 'orbit', 'glow'], lowRate: true },
  { id: 'stardragon', r: 3,  name: '星光ドラゴン',     mult: 3, shape: 'egg',    color: 0x7b2cbf, accent: 0xfff27a, extras: ['horns', 'wings', 'halo', 'glow'], lowRate: true },
  { id: 'goldhoo',    r: 4,  name: '黄金の不死鳥',     mult: 3, shape: 'sphere', color: 0xffb300, accent: 0xff3b3b, extras: ['wings', 'flame', 'halo', 'orbit'], lowRate: true },
  { id: 'thunderneko', r: 5, name: '雷光ネコ',         mult: 3, shape: 'box',    color: 0x2b2d42, accent: 0xffe600, extras: ['ears', 'bolt', 'crown', 'glow'], lowRate: true },
  { id: 'rainbowkame', r: 6, name: '虹のカメ仙人',     mult: 3, shape: 'dome',   color: 0xfff0f5, accent: 0xff77e9, extras: ['shell', 'rainbow', 'halo', 'glow'], lowRate: true },
  { id: 'tenkaiusa',  r: 7,  name: '天界の王冠ウサギ', mult: 3, shape: 'egg',    color: 0xffffff, accent: 0xffd23f, extras: ['ears', 'crown', 'wings', 'orbit'], lowRate: true },
  { id: 'pearlking',  r: 8,  name: '真珠の王様',       mult: 3, shape: 'dome',   color: 0xfff5e1, accent: 0x00bcd4, extras: ['shell', 'crown', 'gem', 'glow'], lowRate: true },
  { id: 'goldrobo',   r: 9,  name: '黄金メカ王',       mult: 3, shape: 'box',    color: 0xffd23f, accent: 0x00e5ff, extras: ['antenna', 'visor', 'crown', 'glow'], lowRate: true },
  { id: 'eternaleye', r: 10, name: '永久の瞳',         mult: 3, shape: 'sphere', color: 0x111111, accent: 0xffd23f, extras: ['ring', 'orbit', 'halo', 'glow'], lowRate: true },
  { id: 'aurorahalo', r: 11, name: 'オーロラの妖精',   mult: 3, shape: 'cone',   color: 0xe0fff7, accent: 0x7dffd8, extras: ['wings', 'halo', 'stars', 'glow'], lowRate: true },
  { id: 'stardust',   r: 12, name: '星くずの精霊',     mult: 3, shape: 'sphere', color: 0x5a189a, accent: 0xffd23f, extras: ['sprout', 'stars', 'halo', 'orbit'], lowRate: true },
  { id: 'shikkoku',   r: 13, name: '漆黒の天使',       mult: 3, shape: 'box',    color: 0x0b0b12, accent: 0xff2a2a, extras: ['wings', 'halo', 'horns', 'glow'], lowRate: true },
  { id: 'prismgod',   r: 14, name: '虹の創造神',       mult: 3, shape: 'sphere', color: 0xffffff, accent: 0xffd23f, extras: ['halo', 'crown', 'wings', 'rainbow', 'glow'], lowRate: true },

  // ---- v0.41 で追加（日本） ----
  { id: 'maguro',    r: 15, name: 'マグロ寿司',      mult: 0.7, shape: 'sushi',  color: 0xfaf8f2, accent: 0xd62839, extras: ['blush'] },
  { id: 'salmon',    r: 15, name: 'サーモン寿司',    mult: 0.9, shape: 'sushi',  color: 0xfaf8f2, accent: 0xff8c5a, extras: ['stripes', 'blush'] },
  { id: 'tamagozushi', r: 15, name: 'たまご寿司',    mult: 1.1, shape: 'sushi',  color: 0xfaf8f2, accent: 0xffd23f, extras: ['band', 'blush'] },
  { id: 'yozakura',  r: 15, name: '夜桜ひめ',        mult: 1.2, shape: 'egg',    color: 0xffd6e8, accent: 0xff8fab, extras: ['sakura', 'blush', 'glow'] },
  { id: 'torii',     r: 15, name: '鳥居さま',        mult: 1.4, shape: 'box',    color: 0xfff1e0, accent: 0xe63946, extras: ['toriiframe', 'blush'] },
  { id: 'samurai',   r: 15, name: 'サムライ大将',    mult: 1.5, shape: 'box',    color: 0x3a3a5a, accent: 0xe63946, extras: ['kabuto', 'katana', 'mustache'] },

  // ---- v0.42 で追加（新エリア） ----
  // ワイルド（ジャングル）
  { id: 'gorilla',   r: 16, name: 'ドラミングゴリ',   mult: 0.7, shape: 'box',    color: 0x5d4037, accent: 0xffe0b2, extras: ['arms', 'mustache'] },
  { id: 'parrot',    r: 16, name: 'オウムのピコ',     mult: 0.9, shape: 'egg',    color: 0x2ecc71, accent: 0xff4d4d, extras: ['beak', 'wings'] },
  { id: 'snakechan', r: 16, name: 'ヘビ子',           mult: 1.1, shape: 'cyl',    color: 0x7cb342, accent: 0xfdd835, extras: ['tail', 'stripes'] },
  { id: 'kameleon',  r: 16, name: 'カメレオン先生',   mult: 1.2, shape: 'dome',   color: 0x26a69a, accent: 0xffeb3b, extras: ['glasses', 'tail'] },
  { id: 'jungletora', r: 16, name: 'ジャングル虎次郎', mult: 1.4, shape: 'box',   color: 0xff9800, accent: 0x212121, extras: ['ears', 'stripes', 'tail'] },
  { id: 'tsutanosei', r: 16, name: 'ツタの精',        mult: 1.5, shape: 'sphere', color: 0x66bb6a, accent: 0xc5e1a5, extras: ['sprout', 'flower', 'glow'] },
  { id: 'jungleking', r: 16, name: 'きんいろジャングル王', mult: 3, shape: 'sphere', color: 0xffc107, accent: 0x2e7d32, extras: ['crown', 'wings', 'halo', 'glow'], lowRate: true },
  // スイート（お菓子の国）
  { id: 'cakekun',   r: 17, name: 'ケーキくん',       mult: 0.7, shape: 'cyl',    color: 0xfff3e0, accent: 0xf06292, extras: ['topcap', 'blush'] },
  { id: 'donutmaru', r: 17, name: 'ドーナツ丸',       mult: 0.9, shape: 'sphere', color: 0xf4a261, accent: 0xff8fb1, extras: ['ring', 'blush'] },
  { id: 'candychan', r: 17, name: 'キャンディちゃん', mult: 1.1, shape: 'egg',    color: 0xff5c8a, accent: 0xffffff, extras: ['bow', 'stripes'] },
  { id: 'purinojou', r: 17, name: 'プリンお嬢',       mult: 1.2, shape: 'cyl',    color: 0xffe082, accent: 0x6d4c41, extras: ['topcap', 'bow', 'blush'] },
  { id: 'macaron',   r: 17, name: 'マカロン兄弟',     mult: 1.4, shape: 'dome',   color: 0xb39ddb, accent: 0xf8bbd0, extras: ['band', 'stars'] },
  { id: 'icecreamprince', r: 17, name: 'アイスクリーム王子', mult: 1.5, shape: 'cone', color: 0xbbdefb, accent: 0xff80ab, extras: ['cap', 'blush', 'sprout'] },
  { id: 'sweetqueen', r: 17, name: 'ふわふわ女王ケーキ', mult: 3, shape: 'sphere', color: 0xffd1dc, accent: 0xffd23f, extras: ['crown', 'halo', 'stars', 'glow'], lowRate: true },
  // パイレーツ（海賊の島）
  { id: 'kaizokuneko', r: 18, name: 'かいぞくネコ',   mult: 0.7, shape: 'box',    color: 0x37474f, accent: 0xffd54f, extras: ['ears', 'eyepatch'] },
  { id: 'takarabako', r: 18, name: 'たからばこボックス', mult: 0.9, shape: 'box', color: 0x8d6e63, accent: 0xffd700, extras: ['gem', 'band'] },
  { id: 'parrotcap', r: 18, name: 'オウム船長',      mult: 1.1, shape: 'egg',    color: 0xe53935, accent: 0x29b6f6, extras: ['beak', 'tophat'] },
  { id: 'takosuke',  r: 18, name: 'タコ助',           mult: 1.2, shape: 'dome',   color: 0xf06292, accent: 0xffffff, extras: ['tentacles', 'blush'] },
  { id: 'kanisho',   r: 18, name: 'カニ将軍',         mult: 1.4, shape: 'dome',   color: 0xff5722, accent: 0xffe0b2, extras: ['arms', 'spikes', 'mustache'] },
  { id: 'sirenhime', r: 18, name: 'セイレーン姫',     mult: 1.5, shape: 'egg',    color: 0x4dd0e1, accent: 0xffd54f, extras: ['tiara', 'fins', 'glow'] },
  { id: 'goldpirate', r: 18, name: '黄金の海賊王',    mult: 3, shape: 'sphere', color: 0xffc107, accent: 0x3e2723, extras: ['crown', 'eyepatch', 'cape', 'glow', 'gem'], lowRate: true },
  // ジュラ（恐竜の谷）
  { id: 'trikera',   r: 19, name: 'トリケラ太郎',     mult: 0.7, shape: 'dome',   color: 0x8d6e63, accent: 0xd7ccc8, extras: ['horns', 'spikes'] },
  { id: 'pterano',   r: 19, name: 'プテラ翼',         mult: 0.9, shape: 'egg',    color: 0x78909c, accent: 0xff7043, extras: ['wings', 'beak'] },
  { id: 'dinoegg',   r: 19, name: 'きょうりゅうのたまご', mult: 1.1, shape: 'egg', color: 0xf5f0d8, accent: 0x558b2f, extras: ['stripes', 'sprout'] },
  { id: 'ammonite',  r: 19, name: 'アンモナイト君',   mult: 1.2, shape: 'dome',   color: 0xffab91, accent: 0x6d4c41, extras: ['shell', 'glow'] },
  { id: 'tyranno',   r: 19, name: 'ティラノ三郎',     mult: 1.4, shape: 'box',    color: 0x558b2f, accent: 0xffeb3b, extras: ['teeth', 'tail', 'spikes'] },
  { id: 'brachio',   r: 19, name: 'ブラキオ長老',     mult: 1.5, shape: 'cyl',    color: 0x9ccc65, accent: 0x33691e, extras: ['tail', 'flower', 'glasses'] },
  { id: 'jurassicking', r: 19, name: 'ジュラ紀の王',  mult: 3, shape: 'egg',    color: 0x2e7d32, accent: 0xffd23f, extras: ['horns', 'wings', 'crown', 'flame'], lowRate: true },
  // サイバー（ネオン街）
  { id: 'neonneko',  r: 20, name: 'ネオンネコ',       mult: 0.7, shape: 'box',    color: 0x1a1a2e, accent: 0xff00e5, extras: ['ears', 'visor', 'glow'] },
  { id: 'holoko',    r: 20, name: 'ホロ子',           mult: 0.9, shape: 'sphere', color: 0x80deea, accent: 0xf8bbd0, extras: ['ring', 'glow', 'orbit'] },
  { id: 'roboinu',   r: 20, name: 'ロボ犬ワン',       mult: 1.1, shape: 'box',    color: 0xb0bec5, accent: 0x00e5ff, extras: ['ears', 'antenna', 'visor'] },
  { id: 'dronebird', r: 20, name: 'ドローン鳥',       mult: 1.2, shape: 'egg',    color: 0xeceff1, accent: 0xffea00, extras: ['propeller', 'wings', 'glow'] },
  { id: 'neonboss',  r: 20, name: 'ネオン番長',       mult: 1.4, shape: 'cyl',    color: 0x311b92, accent: 0xff4081, extras: ['cap', 'glasses', 'headphones'] },
  { id: 'cybermaid', r: 20, name: 'サイバーメイド',   mult: 1.5, shape: 'cone',   color: 0x263238, accent: 0x76ff03, extras: ['headphones', 'bow', 'gem'] },
  { id: 'hologod',   r: 20, name: 'ホログラムの神',   mult: 3, shape: 'sphere', color: 0x00e5ff, accent: 0xff00e5, extras: ['halo', 'orbit', 'rainbow', 'glow'], lowRate: true },
  // セラフ（天空城）
  { id: 'tenshimini', r: 21, name: 'てんしの見習い', mult: 0.7, shape: 'sphere', color: 0xffffff, accent: 0xffd54f, extras: ['halo', 'wings'] },
  { id: 'pegasuke',  r: 21, name: 'ペガ助',           mult: 0.9, shape: 'egg',    color: 0xf5f5f5, accent: 0xb39ddb, extras: ['wings', 'tail'] },
  { id: 'cloudspirit', r: 21, name: 'くもの精霊',     mult: 1.1, shape: 'dome',   color: 0xffffff, accent: 0xbbdefb, extras: ['puffs', 'glow'] },
  { id: 'serafknight', r: 21, name: 'セラフの騎士',   mult: 1.2, shape: 'box',    color: 0xfafafa, accent: 0xffd23f, extras: ['helmet', 'cape', 'wings'] },
  { id: 'skydiva',   r: 21, name: 'そらの歌姫',       mult: 1.4, shape: 'cone',   color: 0xe1f5fe, accent: 0xffe082, extras: ['tiara', 'rainbow', 'stars'] },
  { id: 'archangel', r: 21, name: '大天使ミカ',       mult: 1.5, shape: 'sphere', color: 0xfff8e1, accent: 0xffd700, extras: ['halo', 'wings', 'crown'] },
  { id: 'seraphking', r: 21, name: '聖なる熾天使',    mult: 3, shape: 'egg',    color: 0xffffff, accent: 0xffd23f, extras: ['halo', 'wings', 'crown', 'glow', 'rainbow'], lowRate: true },
  // ファントム（お化け屋敷）
  { id: 'obake',     r: 22, name: 'ホワイトおばけ',   mult: 0.7, shape: 'sphere', color: 0xf0f0f0, accent: 0x9e9e9e, extras: ['arms', 'glow'] },
  { id: 'zombie',    r: 22, name: 'ゾンビくん',       mult: 0.9, shape: 'box',    color: 0x7cb342, accent: 0x4e342e, extras: ['arms', 'teeth', 'cracks'] },
  { id: 'pumpkinbo', r: 22, name: 'カボチャ坊や',     mult: 1.1, shape: 'sphere', color: 0xff7043, accent: 0x2e7d32, extras: ['sprout', 'teeth', 'glow'] },
  { id: 'vampcount', r: 22, name: 'ヨルの伯爵',       mult: 1.2, shape: 'box',    color: 0x212121, accent: 0xd32f2f, extras: ['cape', 'teeth', 'tophat'] },
  { id: 'skeleton',  r: 22, name: 'ホネホネ',         mult: 1.4, shape: 'cyl',    color: 0xeceff1, accent: 0x424242, extras: ['katana', 'teeth'] },
  { id: 'hitodama',  r: 22, name: 'ひとだま',         mult: 1.5, shape: 'dome',   color: 0x90caf9, accent: 0x1e88e5, extras: ['flame', 'tail'] },
  { id: 'ghostking', r: 22, name: '闇の大おばけ',     mult: 3, shape: 'sphere', color: 0x311b92, accent: 0x76ff03, extras: ['crown', 'cape', 'orbit', 'glow'], lowRate: true },
  // アルティメット（虹の果て）
  { id: 'chibirainbow', r: 23, name: 'ちびレインボー', mult: 0.7, shape: 'sphere', color: 0xffffff, accent: 0xff77e9, extras: ['rainbow', 'blush'] },
  { id: 'nijishizuku', r: 23, name: 'にじのしずく',   mult: 0.9, shape: 'dome',   color: 0x7df9ff, accent: 0xffea00, extras: ['gem', 'glow'] },
  { id: 'nijiinko',  r: 23, name: 'にじ色インコ',     mult: 1.1, shape: 'egg',    color: 0xff4081, accent: 0x00e676, extras: ['beak', 'wings', 'rainbow'] },
  { id: 'ultrarobo', r: 23, name: 'アルティメットロボ', mult: 1.2, shape: 'box',  color: 0xeceff1, accent: 0xffd23f, extras: ['antenna', 'visor', 'halo'] },
  { id: 'universelion', r: 23, name: 'ユニバース獅子', mult: 1.4, shape: 'sphere', color: 0xffd23f, accent: 0xff77e9, extras: ['tail', 'crown', 'glow'] },
  { id: 'prismgoddess', r: 23, name: 'プリズムの女神', mult: 1.5, shape: 'cone', color: 0xfff0ff, accent: 0x7df9ff, extras: ['tiara', 'wings', 'stars', 'glow'] },
  { id: 'ultimatedeity', r: 23, name: '伝説のアルティマ', mult: 3, shape: 'sphere', color: 0xffffff, accent: 0xffd23f, extras: ['halo', 'crown', 'wings', 'rainbow', 'glow'], lowRate: true },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// ---- プレイヤーのスキン ----
// need: 解放条件（stats を受け取って true なら解放）、hint: 条件の説明
export const SKINS = [
  { id: 'basic',   name: 'ベーシック',     shirt: 0x3a8dff, pants: 0x2d3436, hint: 'はじめから' },
  { id: 'red',     name: 'レッド',         shirt: 0xe63946, pants: 0x1d3557, hint: 'はじめから' },
  { id: 'night',   name: 'ナイト',         shirt: 0x22223b, pants: 0x111111, skin: 0xf1c6a0, bat: 0x4a4e69, hint: 'はじめから' },
  { id: 'baseball', name: '野球少年',      shirt: 0xffffff, pants: 0xdfe6ee, hat: 'cap', hatColor: 0x1e5aa8, hint: 'キャラを10体持ち帰る', need: s => s.collected >= 10 },
  { id: 'ninja',   name: 'ニンジャ',       shirt: 0x1b1b2f, pants: 0x1b1b2f, hat: 'headband', hatColor: 0xe63946, bat: 0x2b2b2b, hint: 'キャラを50体持ち帰る', need: s => s.collected >= 50 },
  { id: 'gold',    name: 'ゴールド',       shirt: 0xffc21a, pants: 0x8a5a00, glow: 0x6a4200, bat: 0xffd23f, hint: 'インデックスを30体集める', need: s => s.dex >= 30 },
  { id: 'king',    name: '王様',           shirt: 0xb5179e, pants: 0x3a0ca3, hat: 'crown', back: 'cape', backColor: 0xe63946, hint: 'リボーンを1回する', need: s => s.rebirths >= 1 },
  { id: 'dragon',  name: 'ドラゴン',       shirt: 0x2d6a4f, pants: 0x1b4332, skin: 0x95d5b2, hat: 'horns', back: 'wings', backColor: 0x40916c, hint: '最高飛距離 700m（虚空）', need: s => s.dist >= 700 },
  { id: 'diamond', name: 'ダイヤ',         shirt: 0x8ff3ff, pants: 0x48cae4, glow: 0x0a5a6a, bat: 0xc9f7ff, hint: 'ダイヤ変異を10体集める', need: s => s.muts.diamond >= 10 },
  { id: 'galaxy',  name: 'ギャラクシー',   shirt: 0x2b0f55, pants: 0x14002b, glow: 0x5a2bff, hat: 'halo', bat: 0xb388ff, hint: 'ギャラクシー変異を10体集める', need: s => s.muts.galaxy >= 10 },
  { id: 'angel',   name: '天使',           shirt: 0xfffaf0, pants: 0xf1f1f1, hat: 'halo', back: 'wings', backColor: 0xffffff, hint: 'リボーンを5回する', need: s => s.rebirths >= 5 },
  { id: 'rainbow', name: 'インフィニティ', shirt: 0xffffff, pants: 0x222244, rainbow: true, hat: 'crown', back: 'wings', backColor: 0xfff27a, hint: 'インデックスをコンプリート', need: s => s.dex >= s.total },
];
export const SKIN_BY_ID = Object.fromEntries(SKINS.map(k => [k.id, k]));

// ---- 変異イベント ----
// 15分ごとに3分間。時計で決めるので、どの端末・どのプレイヤーでも同じ時間に起きる
export const EVENT_PERIOD = 15 * 60;
export const EVENT_LEN = 3 * 60;
export function mutationEvent(now = Date.now()) {
  const t = Math.floor(now / 1000) % EVENT_PERIOD;
  return t < EVENT_LEN
    ? { active: true, left: EVENT_LEN - t }
    : { active: false, left: EVENT_PERIOD - t };
}
// 変異の種類（イベント中に手に入れたキャラはどれかになる）
export const MUTATIONS = [
  { id: 'gold',    name: 'ゴールド',     mult: 2, weight: 60, css: '#ffd23f', color: 0xffd23f },
  { id: 'diamond', name: 'ダイヤ',       mult: 3, weight: 30, css: '#8ff3ff', color: 0x8ff3ff },
  { id: 'galaxy',  name: 'ギャラクシー', mult: 5, weight: 10, css: '#b388ff', color: 0xb388ff },
  // ハロウィン限定（weight は通常0。ハロウィン中だけ抽選に入る）
  { id: 'pumpkin', name: 'かぼちゃ',     mult: 4, weight: 0, halloween: 25, css: '#ff8c1a', color: 0xff8c1a },
  { id: 'rainbowpumpkin', name: 'レインボーかぼちゃ', mult: 7, weight: 0, css: 'rainbow', color: 0xff77e9 },
];
export const MUT_BY_ID = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
export const mutMult = id => (id && MUT_BY_ID[id] ? MUT_BY_ID[id].mult : 1);
export function rollMutation(halloween = false) {
  const w = m => m.weight + (halloween ? m.halloween || 0 : 0);
  let t = Math.random() * MUTATIONS.reduce((a, m) => a + w(m), 0);
  for (const m of MUTATIONS) { t -= w(m); if (t <= 0 && w(m) > 0) return m.id; }
  return MUTATIONS[0].id;
}

// ---- ハロウィンイベント ----
// 期間: 10月1日〜11月10日（端末の日付）
export function halloweenActive(now = Date.now()) {
  const d = new Date(now), m = d.getMonth() + 1;
  return m === 10 || (m === 11 && d.getDate() <= 10);
}
// レインボーかぼちゃタイム: 10分ごとに1分間（時計で決まるので全員同じ）。その間に手に入れたキャラは超低確率でレインボーかぼちゃ変異
export const RAINBOW_PUMPKIN_PERIOD = 10 * 60;
export const RAINBOW_PUMPKIN_LEN = 60;
export const RAINBOW_PUMPKIN_CHANCE = 0.03;
export function rainbowPumpkinTime(now = Date.now()) {
  const t = Math.floor(now / 1000) % RAINBOW_PUMPKIN_PERIOD;
  return t < RAINBOW_PUMPKIN_LEN
    ? { active: true, left: RAINBOW_PUMPKIN_LEN - t }
    : { active: false, left: RAINBOW_PUMPKIN_PERIOD - t };
}

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

// リボーン: お金・力・強化をリセットする代わりに、稼ぎと力の伸びが永久に +50% ずつ増える
export const rebirthMult = n => 1 + 0.5 * n;
export const rebirthCost = n => Math.ceil(100000 * Math.pow(5, n));

// 力と打撃タイミングから飛距離を決める
export function launchDistance(strength, timingMult) {
  const d = 18 + 5.5 * Math.sqrt(strength) * timingMult * (0.9 + Math.random() * 0.2);
  return Math.min(d, WORLD_END - 6);
}

export function zoneAt(z) {
  let i = 0;
  while (i < RARITIES.length - 1 && z >= ZONE_STARTS[i + 1]) i++;
  return i;
}

// 激レアキャラが出る確率（レア度が決まったあとに判定）
export const LOW_RATE_CHANCE = 0.01;

// ゾーンのレア度を中心に、前後のレア度も少し出る
export function rollCharacter(zone) {
  const roll = Math.random();
  let r = zone;
  if (roll < 0.08 && zone < RARITIES.length - 1) r = zone + 1;
  else if (roll < 0.3 && zone > 0) r = zone - 1;
  // 1% で、そのレア度の激レアキャラを返す
  if (Math.random() < LOW_RATE_CHANCE) {
    const low = CHARACTERS.find(c => c.r === r && c.lowRate);
    if (low) return low;
  }
  // 通常の抽選では激レアキャラを除外する
  const pool = CHARACTERS.filter(c => c.r === r && !c.lowRate);
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
