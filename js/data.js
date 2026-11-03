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
    boss: { name: 'スライム大将',   color: 0x5ad16a, speed: 13, scale: 2.0 } },
  { name: '砂漠',   ground: 0xe9cf86, alt: 0xdcc077, sky: 0xffd9a0, deco: 'cactus',
    boss: { name: 'サンドワーム',   color: 0xc9a25a, speed: 17, scale: 2.3 } },
  { name: '氷河',   ground: 0xd8f1ff, alt: 0xc2e6fb, sky: 0xbfe6ff, deco: 'ice',
    boss: { name: 'アイスゴーレム', color: 0x8fd6ff, speed: 21, scale: 2.6 } },
  { name: '毒沼',   ground: 0x7a4f9a, alt: 0x6b4189, sky: 0xb48ad6, deco: 'mushroom',
    boss: { name: 'ポイズンキング', color: 0xa64dff, speed: 25, scale: 2.9 } },
  { name: '黄金郷', ground: 0xf3c94b, alt: 0xe5b934, sky: 0xfff0b0, deco: 'gold',
    boss: { name: 'ゴールドナイト', color: 0xffd23f, speed: 29, scale: 3.2 } },
  { name: '溶岩',   ground: 0x4a2a24, alt: 0x5a2f26, sky: 0xff8a5c, deco: 'lava',
    boss: { name: 'マグマドラゴン', color: 0xff4a1c, speed: 33, scale: 3.6 } },
  { name: '虚空',   ground: 0x1b1530, alt: 0x251c40, sky: 0x2a1f4f, deco: 'crystal',
    boss: { name: 'ヴォイドロード', color: 0x9b6bff, speed: 37, scale: 4.0 } },
  { name: '天空',     ground: 0xf4f9ff, alt: 0xe2efff, sky: 0xc9e8ff, deco: 'cloud',
    boss: { name: 'テンペストグリフォン', color: 0xe0f4ff, speed: 41, scale: 4.4 } },
  { name: '深海',     ground: 0x0e3b5c, alt: 0x12476d, sky: 0x1d5f8a, deco: 'coral',
    boss: { name: 'クラーケン',     color: 0xd81b60, speed: 45, scale: 4.8 } },
  { name: '機械都市', ground: 0x3a3f47, alt: 0x454b55, sky: 0x8e9aab, deco: 'tower',
    boss: { name: 'ギガロボ',       color: 0x8d99ae, speed: 49, scale: 5.2 } },
  { name: '時空の果て', ground: 0x0a0a16, alt: 0x15152c, sky: 0x0b0820, deco: 'clock',
    boss: { name: 'クロノス',       color: 0xffe066, speed: 53, scale: 5.6 } },
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
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

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
];
export const MUT_BY_ID = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
export const mutMult = id => (id && MUT_BY_ID[id] ? MUT_BY_ID[id].mult : 1);
export function rollMutation() {
  let t = Math.random() * MUTATIONS.reduce((a, m) => a + m.weight, 0);
  for (const m of MUTATIONS) { t -= m.weight; if (t <= 0) return m.id; }
  return MUTATIONS[0].id;
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
