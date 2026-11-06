// ラッキーブロックを打つ Web — メイン
import * as THREE from 'three';
import {
  RARITIES, ZONES, CHARACTERS, CHAR_BY_ID, BASE_LINE, LAUNCH_POS, ZONE_START, ZONE_LENS, ZONE_STARTS, WORLD_END, WORLD_HALF_W,
  MAX_STAR, SLOT_COUNT, charIncome as baseIncome, evolveCost, sellPrice as baseSellPrice, strengthRate as baseStrengthRate,
  dumbbellCost, playerSpeed, speedCost, rebirthMult, rebirthCost, launchDistance, zoneAt, rollCharacter, fmt, rarFx, rarCss, SKINS, SKIN_BY_ID,
  MUT_BY_ID, mutMult, rollMutation, mutationEvent, halloweenActive, rainbowPumpkinTime, RAINBOW_PUMPKIN_CHANCE,
  BOSS_ACCEL, BOSS_ACCEL_MAX, BOSS_DASH_EVERY, BOSS_DASH_TIME, BOSS_DASH_MULT,
} from './data.js';
import { buildPlayer, buildBoss, buildLuckyBlock, buildCharacter, textTexture, mat } from './models.js';
import { initAudio, play, startLoop, stopLoop, setVolume, playTune } from './audio.js';
import { input, initInput, pollInput, lockPointer, unlockPointer } from './input.js';
import { GENRES, submitScore, fetchRanking, fetchMine, ping } from './ranking.js';
import { fetchEvents, adminCheck, adminPost, adminEnd, adminFlagged, adminSetFlag, adminSetTrust, adminTrusted } from './admin.js';
import { localBackups, saveLocalBackup, cloudBackupPut, cloudBackupList, cloudBackupGet } from './backup.js';
import { fetchChat, postChat, deleteChat, ping2 } from './chat.js';
import { friendList, friendRequest, friendRespond, friendRemove, Net } from './friends.js';

const $ = id => document.getElementById(id);

// リボーン倍率を掛けた稼ぎ・売値・力の伸び
const charIncome = (c, star = 1, mut = null) => baseIncome(c, star) * rebirthMult(save.rebirths) * mutMult(mut);
const sellPrice = (c, star, mut = null) => Math.ceil(baseSellPrice(c, star) * rebirthMult(save.rebirths) * mutMult(mut));
// 変異の表示用タグ
const mutTag = mut => (mut && MUT_BY_ID[mut] ? `<span class="mut mut-${mut}">🧬${MUT_BY_ID[mut].name} ×${MUT_BY_ID[mut].mult}</span>` : '');
const strengthRate = lv => baseStrengthRate(lv) * rebirthMult(save.rebirths);

// =====================================================================
// セーブデータ
// =====================================================================
const SAVE_KEY = 'llb_save_v1';
const randomId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  }));

function defaultSave() {
  return {
    money: 0, strength: 20, dumbbellLv: 1, speedLv: 1, rebirths: 0,
    launchPower: 1,
    baseTheme: '',
    skin: 'basic',                               // プレイヤーのスキン
    claimedGifts: [],                            // 受け取った管理者のプレゼントのID                               // 拠点の色（インデックスの変異を75%集めると選べる）                              // 飛ばす力（0.1〜1）。強すぎて逃げ切れないとき用
    slots: Array(SLOT_COUNT).fill(null),         // { id, star, stored }
    inventory: [],                               // { id, star } 持ち帰ったが台座に置いていないキャラ
    stats: { bestDistance: 0, totalEarned: 0, collected: 0, bestRarity: 0, bestHome: 0 },   // bestHome: 持ち帰れた中でいちばん高いレア度
    dex: {},
    name: '', volume: 0.7,
    // オンラインランキング用の識別子（将来使用）
    clientId: randomId(), token: randomId() + randomId(),
    lastTime: Date.now(),
  };
}

// ---- 改ざん対策: セーブに署名をつけ、読み込み時に確かめる ----
// キーの順番や数字の書き方が変わっても同じになるよう、キーを並べかえた形で計算する（クラウド・バックアップ経由でもOK）
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => k !== 'sig' && v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
function hash53(str, seed = 0x4c4c42) {   // cyrb53
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const signSave = s => hash53('llb:' + canon(s) + ':' + (s.clientId || ''));
// 数字や中身がおかしいところを直す（手で書きかえたデータで壊れないように）
function sanitizeSave(s) {
  const num = (v, min = 0, max = Number.MAX_VALUE) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, +v)) : min);
  const int = (v, min, max) => Math.floor(num(v, min, max));
  s.money = num(s.money); s.strength = num(s.strength);
  s.dumbbellLv = int(s.dumbbellLv, 1, 1e6); s.speedLv = int(s.speedLv, 1, 1e6); s.rebirths = int(s.rebirths, 0, 1e6);
  s.launchPower = num(s.launchPower, 0.01, 1);
  for (const k of ['bestDistance', 'totalEarned', 'collected', 'bestRarity']) s.stats[k] = num(s.stats[k]);
  s.stats.bestDistance = Math.min(s.stats.bestDistance, WORLD_END + 50);
  s.stats.bestRarity = Math.min(Math.floor(s.stats.bestRarity), RARITIES.length - 1);
  s.stats.bestHome = Math.min(Math.max(0, Math.floor(+s.stats.bestHome || 0)), s.stats.bestRarity);
  const fixChar = x => { x.star = int(x.star, 1, MAX_STAR); if (x.mut && !MUT_BY_ID[x.mut]) delete x.mut; return x; };
  s.slots = s.slots.slice(0, SLOT_COUNT).map(x => (x ? fixChar(x) : null));
  s.inventory = s.inventory.slice(0, 2000).map(fixChar);
  if (s.bday && typeof s.bday === 'object') s.bday = { m: int(s.bday.m, 1, 12), d: int(s.bday.d, 1, 31) }; else delete s.bday;
  if (s.bdayYear !== undefined) s.bdayYear = int(s.bdayYear, 0, 9999);
  if (s.dex && typeof s.dex === 'object') for (const e of Object.values(s.dex)) if (e && e.muts) for (const m of Object.keys(e.muts)) if (!MUT_BY_ID[m]) delete e.muts[m];
  return s;
}
let tamperFound = false;
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    // 署名があるのに合わない = 手で書きかえられた（署名のない古いセーブはそのまま受け入れて、次の保存で署名する）
    // ※ 古いバージョンの画面を開いたままだと署名を直さずに保存されるので、ずっと外すのではなく今回だけランキングに送らない
    if (parsed.sig && parsed.sig !== signSave(parsed)) tamperFound = true;
    delete parsed.tampered;   // v0.48〜0.53 で付いた印は消す
    const s = Object.assign(defaultSave(), parsed);
    // 古いセーブ: 「持ち帰れた最高レア度」を、インデックスのキャラ（ただし実際に行けたレア度まで）から決める
    if (parsed.stats && parsed.stats.bestHome === undefined) {
      const rs = Object.keys(parsed.dex || {}).map(id => CHAR_BY_ID[id]?.r ?? 0);
      parsed.stats.bestHome = Math.min(+parsed.stats.bestRarity || 0, rs.length ? Math.max(...rs) : 0);
    }
    s.stats = Object.assign(defaultSave().stats, s.stats);
    while (s.slots.length < SLOT_COUNT) s.slots.push(null);
    s.slots = s.slots.map(x => (x && CHAR_BY_ID[x.id] ? x : null));
    s.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(x => x && CHAR_BY_ID[x.id]);
    // 旧形式（id: true）のインデックスを移行
    for (const k of Object.keys(s.dex)) {
      if (!CHAR_BY_ID[k]) delete s.dex[k];
      else if (s.dex[k] === true) s.dex[k] = { count: 1, first: null, seen: true };
    }
    return sanitizeSave(s);
  } catch (e) {
    return defaultSave();
  }
}
let save = loadSave();
let noSave = false;   // 復元・リセットで読み直す直前は、今のデータで上書きしない
function writeSave() {
  if (noSave) return;
  save.lastTime = Date.now();
  save.sig = signSave(save);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存不可環境 */ }
}

// オフライン中の放置報酬（最大2時間）
const offlineSec = Math.min(7200, Math.max(0, (Date.now() - save.lastTime) / 1000));
let offlineMoney = 0;
if (offlineSec > 30) {
  save.strength += strengthRate(save.dumbbellLv) * offlineSec;
  for (const s of save.slots) {
    if (!s) continue;
    const add = charIncome(CHAR_BY_ID[s.id], s.star, s.mut) * offlineSec;
    s.stored += add; offlineMoney += add;
  }
}

// =====================================================================
// レンダラー・シーン
// =====================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x8fd3ff);
scene.background = skyColor.clone();
scene.fog = new THREE.Fog(skyColor.clone(), 70, 280);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// =====================================================================
// ワールド生成
// =====================================================================
const plane = (w, d, color, x, z, y = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  scene.add(m); return m;
};
const W = WORLD_HALF_W * 2 + 4;

// 拠点の地面
const baseGround = plane(W, 60, 0x9bd770, 0, -30);
const basePlaza = plane(40, 52, 0xd5dde2, 0, -26, 0.01);
baseGround.material = new THREE.MeshLambertMaterial({ color: 0x9bd770 });
basePlaza.material = new THREE.MeshLambertMaterial({ color: 0xd5dde2 });
// 拠点の色テーマ（'' = いつもの色）
const BASE_THEMES = {
  '':      { ground: 0x9bd770, plaza: 0xd5dde2, glow: 0x000000 },
  gold:    { ground: 0xe0b23a, plaza: 0xffe9a8, glow: 0x3a2600 },
  diamond: { ground: 0x7fd6ea, plaza: 0xe6fbff, glow: 0x0a3644 },
  galaxy:  { ground: 0x2b1452, plaza: 0x4a2a8a, glow: 0x2a0f5a },
  pumpkin: { ground: 0xd9661a, plaza: 0x3a2350, glow: 0x2a0f00 },
  rainbowpumpkin: { ground: 0xff9f1c, plaza: 0xb388ff, glow: 0x3a1040 },
};
function applyBaseTheme() {
  const t = BASE_THEMES[save.baseTheme] || BASE_THEMES[''];
  baseGround.material.color.set(t.ground); baseGround.material.emissive.set(t.glow);
  basePlaza.material.color.set(t.plaza); basePlaza.material.emissive.set(t.glow);
}
applyBaseTheme();
// 発射エリア
plane(W, ZONE_START, 0x8fcf62, 0, ZONE_START / 2);
// ゾーンの地面（縞模様）
ZONES.forEach((z, i) => {
  const start = ZONE_STARTS[i], len = ZONE_LENS[i];
  const n = Math.round(len / 10), w = len / n;   // 縞はゾーンの長さに合わせて等分
  for (let k = 0; k < n; k++) plane(W, w, k % 2 ? z.alt : z.ground, 0, start + k * w + w / 2);
});
// 世界の外側
plane(800, WORLD_END + 800, 0x3d6b2f, 0, WORLD_END / 2, -0.05);

// 安全ライン
const safeLine = plane(W, 1.2, 0x4cd964, 0, BASE_LINE, 0.03);
safeLine.material = new THREE.MeshBasicMaterial({ color: 0x4cd964 });

// 柵
for (const s of [-1, 1]) {
  const fence = new THREE.Mesh(new THREE.BoxGeometry(1, 2, WORLD_END), mat(0x8d6e63));
  fence.position.set(s * (WORLD_HALF_W + 1.5), 1, WORLD_END / 2);
  fence.castShadow = fence.receiveShadow = true; scene.add(fence);
}
const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, 2, 1), mat(0x8d6e63));
backWall.position.set(0, 1, -56); scene.add(backWall);

// 門と看板
function gate(z, text, color, sub) {
  const g = new THREE.Group();
  const pm = mat(color);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10, 1.4), pm);
    p.position.set(s * (WORLD_HALF_W + 1.5), 5, 0); p.castShadow = true; g.add(p);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, 1.4), pm);
  bar.position.y = 10.4; g.add(bar);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: textTexture(text, { bg: '#1d1d2b', fg: '#fff', font: 'bold 58px sans-serif' }) }));
  sign.position.set(0, 12.6, -0.75); sign.rotation.y = Math.PI; g.add(sign);
  const sign2 = sign.clone(); sign2.position.z = 0.75; sign2.rotation.y = 0; g.add(sign2);
  if (sub) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(10, 2),
      new THREE.MeshBasicMaterial({ map: textTexture(sub, { bg: '#ffd23f', fg: '#3b2a00', font: 'bold 60px sans-serif' }) }));
    st.position.set(0, 9.2, -0.75); st.rotation.y = Math.PI; g.add(st);
  }
  g.position.z = z; scene.add(g);
}
gate(BASE_LINE, '🏠 拠点', 0x4cd964);
ZONES.forEach((z, i) => {
  const start = ZONE_STARTS[i];
  gate(start, `${z.name}  ${RARITIES[i].name}`, rarFx(i), `${start - LAUNCH_POS.z - 3}m〜`);
});

// 距離表示の杭
for (let d = 50; d < WORLD_END; d += d < 1000 ? 50 : 100) {
  const post = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6),
    new THREE.MeshBasicMaterial({ map: textTexture(`${d}m`, { bg: '#ffffff', fg: '#333', w: 256, h: 100, font: 'bold 64px sans-serif' }), side: THREE.DoubleSide }));
  post.position.set(-WORLD_HALF_W + 2, 2.2, d + LAUNCH_POS.z + 3);
  post.rotation.y = Math.PI / 2;
  scene.add(post);
}

// 装飾
const decoGeo = {
  trunk: new THREE.CylinderGeometry(0.4, 0.5, 2.5, 6),
  leaves: new THREE.IcosahedronGeometry(2, 0),
  cactus: new THREE.CylinderGeometry(0.6, 0.6, 3.5, 8),
  cactusArm: new THREE.CylinderGeometry(0.35, 0.35, 1.6, 6),
  spike: new THREE.ConeGeometry(1.2, 5, 5),
  stem: new THREE.CylinderGeometry(0.5, 0.6, 2.4, 8),
  cap: new THREE.SphereGeometry(2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  pyramid: new THREE.ConeGeometry(1.8, 2.6, 4),
  coin: new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16),
  rock: new THREE.DodecahedronGeometry(1.6, 0),
  pool: new THREE.CircleGeometry(2.4, 16),
  crystal: new THREE.OctahedronGeometry(1.4, 0),
  puff: new THREE.SphereGeometry(1.4, 10, 8),
  coral: new THREE.CylinderGeometry(0.25, 0.35, 3, 6),
  tower: new THREE.BoxGeometry(3, 1, 3),
  ring: new THREE.TorusGeometry(2, 0.25, 8, 28),
  hand: new THREE.BoxGeometry(0.25, 1.6, 0.25),
};
const glowMats = {};
const glow = c => (glowMats[c] ||= new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.7 }));
const spinners = [];
function decorate(type, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  const s = 0.8 + Math.random() * 0.7;
  switch (type) {
    case 'tree': add(decoGeo.trunk, mat(0x7b5134), 0, 1.25, 0); add(decoGeo.leaves, mat(0x3faa4a), 0, 3.8, 0); break;
    case 'cactus': {
      add(decoGeo.cactus, mat(0x3c9a4c), 0, 1.75, 0);
      add(decoGeo.cactusArm, mat(0x3c9a4c), 0.9, 2.2, 0).rotation.z = 0.2;
      break;
    }
    case 'ice': add(decoGeo.spike, mat(0xa8e4ff), 0, 2.5, 0); add(decoGeo.spike, mat(0xe8f8ff), 1.4, 1.5, 0.5).scale.setScalar(0.6); break;
    case 'mushroom': add(decoGeo.stem, mat(0xe8d8f0), 0, 1.2, 0); add(decoGeo.cap, glow(0x9b3cff), 0, 2.3, 0); break;
    case 'gold':
      if (Math.random() < 0.5) add(decoGeo.pyramid, glow(0xffc21a), 0, 1.3, 0);
      else { const c = add(decoGeo.coin, glow(0xffd23f), 0, 2, 0); c.rotation.x = Math.PI / 2; spinners.push(c); }
      break;
    case 'lava':
      if (Math.random() < 0.5) add(decoGeo.rock, mat(0x2b1a17), 0, 1.2, 0);
      else { const p = add(decoGeo.pool, glow(0xff5a1c), 0, 0.04, 0); p.rotation.x = -Math.PI / 2; }
      break;
    case 'crystal': { const c = add(decoGeo.crystal, glow(0x9b6bff), 0, 2.2, 0); c.scale.y = 1.8; spinners.push(c); break; }
    case 'cloud': {
      // ふわふわ浮かぶ雲
      const y = 2.5 + Math.random() * 4;
      for (let k = 0; k < 4; k++) add(decoGeo.puff, mat(0xffffff), (k - 1.5) * 1.3, y + (k % 2) * 0.6, (Math.random() - 0.5));
      break;
    }
    case 'coral': {
      const col = [0xff6f91, 0xffc75f, 0x7df9ff][Math.floor(Math.random() * 3)];
      for (let k = 0; k < 3; k++) {
        const c = add(decoGeo.coral, glow(col), (k - 1) * 0.7, 1.5, 0);
        c.rotation.z = (k - 1) * 0.45;
      }
      break;
    }
    case 'tower': {
      // 光る窓のビル
      const h = 4 + Math.floor(Math.random() * 6);
      const b = add(decoGeo.tower, mat(0x5c6370), 0, h / 2, 0); b.scale.y = h;
      for (let k = 1; k < h; k += 2) add(new THREE.BoxGeometry(3.05, 0.25, 3.05), glow(0x7df9ff), 0, k, 0);
      break;
    }
    case 'aurora': {
      // 光のカーテンと雪の山
      const col = Math.random() < 0.5 ? 0x7dffd8 : 0x7df9ff;
      const a = add(new THREE.BoxGeometry(0.2, 9, 3.5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45 }), 0, 6, 0);
      a.rotation.y = Math.random() * Math.PI; a.castShadow = false;
      add(decoGeo.puff, mat(0xf4fbff), 0, 0.3, 0).scale.set(1.2, 0.5, 1.2);
      break;
    }
    case 'nebula': {
      // ふわふわ浮かぶ光の玉
      for (let k = 0; k < 3; k++) {
        const o = add(decoGeo.puff, glow([0xff7ae0, 0x7df9ff, 0xb388ff][k]), (k - 1) * 1.8, 3 + Math.random() * 5, (Math.random() - 0.5) * 2);
        o.scale.setScalar(0.4 + Math.random() * 0.5);
      }
      break;
    }
    case 'chaos': {
      // 傾いた黒いブロックと赤い光
      const c = add(new THREE.BoxGeometry(2.2, 2.2, 2.2), mat(0x1a0505), 0, 2 + Math.random() * 3, 0);
      c.rotation.set(Math.random(), Math.random(), Math.random());
      const core = add(new THREE.OctahedronGeometry(0.7), glow(0xff2a2a), c.position.x, c.position.y + 2.4, c.position.z);
      spinners.push(core);
      break;
    }
    case 'sakura': {
      // 桜の木（ピンクの花のかたまり）と、落ちた花びら
      add(decoGeo.trunk, mat(0x5a3a2a), 0, 1.25, 0);
      const pinks = [0xffb7d0, 0xffc8dc, 0xff9fbf];
      for (let k = 0; k < 4; k++) {
        const c = add(decoGeo.leaves, mat(pinks[k % 3]), (k - 1.5) * 0.9, 3.4 + (k % 2) * 0.9, (Math.random() - 0.5) * 1.2);
        c.scale.setScalar(0.65 + Math.random() * 0.25);
      }
      const petals = add(new THREE.CircleGeometry(1.8, 12), mat(0xffd6e6), 0, 0.03, 0);
      petals.rotation.x = -Math.PI / 2; petals.castShadow = false;
      break;
    }
    case 'palm': {   // ヤシの木と大きな葉
      const tr = add(new THREE.CylinderGeometry(0.35, 0.5, 6, 8), mat(0x8b5a2b), 0, 3, 0); tr.rotation.z = 0.12;
      for (let k = 0; k < 6; k++) { const lf = add(new THREE.BoxGeometry(3.2, 0.12, 0.9), mat(0x2e8b3a), Math.cos(k) * 1.4 + 0.35, 6.1, Math.sin(k) * 1.4); lf.rotation.set(0, -k, -0.35); }
      if (Math.random() < 0.5) add(new THREE.SphereGeometry(0.35, 8, 6), mat(0x6b4423), 0.4, 5.7, 0.3);
      break;
    }
    case 'candy': {   // ぺろぺろキャンディとドーナツ
      if (Math.random() < 0.5) {
        add(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), mat(0xffffff), 0, 2, 0);
        const c = add(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 24), mat([0xff5c8a, 0x7df9ff, 0xffd23f, 0xb388ff][Math.floor(Math.random() * 4)]), 0, 4.6, 0); c.rotation.x = Math.PI / 2;
        const sw = add(new THREE.TorusGeometry(0.9, 0.12, 6, 24), mat(0xffffff), 0, 4.6, 0.22); spinners.push(sw);
      } else {
        const d = add(new THREE.TorusGeometry(1.3, 0.6, 12, 24), mat(0xe8b07a), 0, 0.6, 0); d.rotation.x = Math.PI / 2;
        const ic = add(new THREE.TorusGeometry(1.3, 0.62, 12, 24, Math.PI * 2), mat([0xff9ecb, 0x8b4a2b, 0xffffff][Math.floor(Math.random() * 3)]), 0, 0.85, 0); ic.rotation.x = Math.PI / 2; ic.scale.z = 0.5;
      }
      break;
    }
    case 'treasure': {   // 宝箱とたる
      if (Math.random() < 0.5) {
        add(new THREE.BoxGeometry(2.2, 1.4, 1.4), mat(0x8b5a2b), 0, 0.7, 0);
        const lid = add(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 12, 1, false, 0, Math.PI), mat(0x7a4a22), 0, 1.4, 0); lid.rotation.z = Math.PI / 2;
        add(new THREE.BoxGeometry(2.3, 0.2, 1.5), glow(0xffd23f), 0, 1.0, 0);
        for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 10), glow(0xffd23f), (Math.random() - 0.5) * 3, 0.05, (Math.random() - 0.5) * 3);
      } else {
        add(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 12), mat(0x9a6a3a), 0, 0.9, 0);
        for (const y of [0.4, 1.4]) add(new THREE.CylinderGeometry(0.93, 0.93, 0.12, 12), mat(0x444444), 0, y, 0);
      }
      break;
    }
    case 'fern': {   // 大きなシダと恐竜の骨
      if (Math.random() < 0.6) {
        for (let k = 0; k < 5; k++) { const f = add(new THREE.ConeGeometry(0.5, 4, 4), mat(0x4a8a2a), 0, 1.6, 0); f.rotation.set(0.6, k * 1.25, 0); f.position.set(Math.sin(k * 1.25) * 0.9, 1.6, Math.cos(k * 1.25) * 0.9); }
      } else {
        for (let k = 0; k < 4; k++) { const r = add(new THREE.TorusGeometry(1.0 - k * 0.12, 0.12, 6, 16, Math.PI), mat(0xf1e9d2), 0, 0.2, -k * 0.6); r.rotation.y = Math.PI / 2; }
        add(new THREE.SphereGeometry(0.7, 10, 8), mat(0xf1e9d2), 0, 0.5, 1.0);
      }
      break;
    }
    case 'neon': {   // 光るネオンの柱と看板
      const col = [0x00f5d4, 0xff5cf4, 0xfff27a, 0x7a5cff][Math.floor(Math.random() * 4)];
      const h = 5 + Math.random() * 6;
      add(new THREE.BoxGeometry(2, h, 2), mat(0x22223b), 0, h / 2, 0);
      add(new THREE.BoxGeometry(2.1, 0.25, 2.1), glow(col), 0, h * 0.4, 0);
      add(new THREE.BoxGeometry(2.1, 0.25, 2.1), glow(col), 0, h * 0.75, 0);
      const sign = add(new THREE.BoxGeometry(0.2, 1.4, 2.6), glow(col), 1.15, h * 0.6, 0); sign.castShadow = false;
      break;
    }
    case 'pillar': {   // 白い神殿の柱と雲
      const h = 6 + Math.random() * 4;
      add(new THREE.CylinderGeometry(0.8, 0.9, h, 16), mat(0xfaf7ee), 0, h / 2, 0);
      add(new THREE.BoxGeometry(2.2, 0.5, 2.2), mat(0xeee6d0), 0, h + 0.25, 0);
      add(new THREE.BoxGeometry(2.2, 0.5, 2.2), mat(0xeee6d0), 0, 0.25, 0);
      if (Math.random() < 0.4) for (let k = 0; k < 3; k++) add(decoGeo.puff, mat(0xffffff), (k - 1) * 1.4, h + 2 + (k % 2) * 0.5, 0);
      break;
    }
    case 'grave': {   // お墓と枯れ木
      if (Math.random() < 0.65) {
        const st = add(new THREE.BoxGeometry(1.2, 1.8, 0.4), mat(0x8a8a9a), 0, 0.9, 0); st.rotation.z = (Math.random() - 0.5) * 0.3;
        add(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 14, 1, false, 0, Math.PI), mat(0x8a8a9a), 0, 1.8, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2);
        add(new THREE.BoxGeometry(0.15, 0.6, 0.1), mat(0x555566), 0, 1.0, 0.22);
        add(new THREE.BoxGeometry(0.45, 0.15, 0.1), mat(0x555566), 0, 1.15, 0.22);
      } else {
        add(new THREE.CylinderGeometry(0.25, 0.4, 4, 6), mat(0x3a2e2a), 0, 2, 0);
        for (let k = 0; k < 3; k++) { const b = add(new THREE.CylinderGeometry(0.08, 0.14, 1.8, 5), mat(0x3a2e2a), 0, 3.2 + k * 0.4, 0); b.rotation.z = (k - 1) * 0.9 + 0.3; }
      }
      break;
    }
    case 'rainbowarch': {   // 虹のアーチと光る星
      if (Math.random() < 0.5) {
        const cols = [0xff5e5e, 0xffa53f, 0xffd23f, 0x4cd964, 0x3a8dff, 0xb05cff];
        cols.forEach((c, k) => { const a = add(new THREE.TorusGeometry(3.4 - k * 0.3, 0.16, 6, 32, Math.PI), glow(c), 0, 0, 0); a.castShadow = false; });
      } else {
        const st = add(new THREE.OctahedronGeometry(0.9), glow([0xfff27a, 0xff9ecb, 0x7df9ff][Math.floor(Math.random() * 3)]), 0, 2.5 + Math.random() * 3, 0);
        spinners.push(st);
      }
      break;
    }
    case 'nature': {   // 自然: 大きな葉・稲妻・水の玉と雲・木・炎の玉
      const pick = Math.floor(Math.random() * 5);
      if (pick === 0) {   // 葉（黒い葉脈つき）
        const lf = add(new THREE.SphereGeometry(1.4, 14, 10), mat(0x1fbf5a), 0, 2.4, 0); lf.scale.set(0.7, 1.4, 0.18); lf.rotation.z = (Math.random() - 0.5) * 0.6;
        const v = mat(0x111111);
        add(new THREE.BoxGeometry(0.1, 2.8, 0.06), v, 0, 2.4, 0.27).rotation.z = lf.rotation.z;
        for (const y of [1.9, 2.8]) for (const s of [-1, 1]) { const l = add(new THREE.BoxGeometry(0.7, 0.1, 0.06), v, s * 0.3, y, 0.25); l.rotation.z = s * 0.5; }
        add(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6), mat(0x1f8a3a), 0, 0.6, 0);
      } else if (pick === 1) {   // 浮かぶ稲妻
        const bt = new THREE.Group(); bt.position.y = 5 + Math.random() * 2; bt.scale.setScalar(1.7); g.add(bt);
        [[0, 1.1, 0.5], [0.35, 0, -0.5], [0, -1.1, 0.5]].forEach(([x, y, r]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.45), glow(0xffc21a)); s.position.set(x, y, 0); s.rotation.z = r; bt.add(s); });
        spinners.push(bt);
      } else if (pick === 2) {   // 水の玉と灰色の雲
        add(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshLambertMaterial({ color: 0x2ec8d8, emissive: 0x0a4a55 }), 0, 2.2, 0);
        for (let k = 0; k < 6; k++) add(decoGeo.puff, mat(0x8a8a8a), -1.2 + (k % 3) * 0.9, 3.4 - Math.floor(k / 3) * 1.6, 0.9).scale.setScalar(0.45);
      } else if (pick === 3) {   // 木（オレンジの幹と緑の葉）
        add(new THREE.CylinderGeometry(0.35, 0.55, 3, 8), mat(0xf0a860), 0, 1.5, 0);
        for (let k = 0; k < 3; k++) add(decoGeo.leaves, mat(k % 2 ? 0x1fbf5a : 0x2fd36a), (k - 1) * 0.9, 3.6 + (k % 2) * 0.6, 0).scale.setScalar(0.7);
      } else {   // 炎の玉（オレンジに黄色い芯）
        add(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshLambertMaterial({ color: 0xff7a2a, emissive: 0xff5a00, emissiveIntensity: 0.6, transparent: true, opacity: 0.6 }), 0, 1.7, 0);   // 外側はすけて、中の黄色い芯が見える
        add(new THREE.SphereGeometry(0.95, 14, 10), glow(0xffe066), 0, 1.6, 0);
        for (let k = 0; k < 3; k++) add(new THREE.ConeGeometry(0.5, 1.4, 6), glow(0xff7a2a), (k - 1) * 0.7, 3.4, 0);
      }
      break;
    }
    case 'thunder': {   // 雷雲の峰: 黒い雷雲と稲妻・避雷針の塔・光る岩
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const y = 7 + Math.random() * 2;
        for (let k = 0; k < 5; k++) add(decoGeo.puff, mat(0x3a3f55), -1.6 + k * 0.8, y + (k % 2) * 0.5, 0).scale.setScalar(0.6);
        const bt = new THREE.Group(); bt.position.y = y - 2.4; g.add(bt);
        [[0, 0.9, 0.5], [0.3, 0, -0.5], [0, -0.9, 0.5]].forEach(([x, yy, r]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.35), glow(0xfff27a)); s.position.set(x, yy, 0); s.rotation.z = r; bt.add(s); });
      } else if (pick === 1) {
        add(new THREE.CylinderGeometry(0.5, 0.8, 6, 8), mat(0x6a7088), 0, 3, 0);
        add(new THREE.CylinderGeometry(0.06, 0.1, 2.4, 6), mat(0xd0d6e0), 0, 7.2, 0);
        add(new THREE.SphereGeometry(0.35, 10, 8), glow(0x7df9ff), 0, 8.5, 0);
      } else {
        add(new THREE.DodecahedronGeometry(1.4), mat(0x4a4f63), 0, 1.1, 0).rotation.set(Math.random(), Math.random(), 0);
        spinners.push(add(new THREE.OctahedronGeometry(0.6), glow(0x5ec8ff), 0, 2.9, 0));
      }
      break;
    }
    case 'bamboo': {   // 竹林: 竹のかたまり・ちょうちん・パンダの像
      const pick = Math.floor(Math.random() * 4);
      if (pick < 2) {
        for (let k = 0; k < 4; k++) {
          const h = 6 + Math.random() * 5, x = (Math.random() - 0.5) * 2.4, zz = (Math.random() - 0.5) * 2.4;
          add(new THREE.CylinderGeometry(0.22, 0.25, h, 8), mat(k % 2 ? 0x7fc75a : 0x6ab04a), x, h / 2, zz);
          for (let y = 1.5; y < h; y += 1.6) add(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 8), mat(0x4f8a2a), x, y, zz);
          add(new THREE.SphereGeometry(0.8, 8, 6), mat(0x5cb84a), x + 0.5, h, zz).scale.set(1.4, 0.3, 0.6);
        }
      } else if (pick === 2) {
        add(new THREE.CylinderGeometry(0.15, 0.15, 3.6, 6), mat(0x6b4a2a), 0, 1.8, 0);
        add(new THREE.BoxGeometry(1.6, 0.15, 0.15), mat(0x6b4a2a), 0.6, 3.5, 0);
        add(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 12), glow(0xff5a3a), 1.2, 2.8, 0);
        for (const y of [2.3, 3.3]) add(new THREE.CylinderGeometry(0.52, 0.52, 0.15, 12), mat(0x111111), 1.2, y, 0);
      } else {
        add(new THREE.SphereGeometry(1.3, 14, 10), mat(0xffffff), 0, 1.3, 0);
        add(new THREE.SphereGeometry(0.95, 14, 10), mat(0xffffff), 0, 3.0, 0.2);
        for (const s of [-1, 1]) {
          add(new THREE.SphereGeometry(0.35, 8, 6), mat(0x111111), s * 0.7, 3.8, 0.2);
          add(new THREE.SphereGeometry(0.25, 8, 6), mat(0x111111), s * 0.35, 3.1, 1.0).scale.set(1, 1.3, 0.5);
          add(new THREE.SphereGeometry(0.4, 8, 6), mat(0x111111), s * 1.1, 1.6, 0.5);
        }
      }
      break;
    }
    case 'music': {   // 音楽の国: 大きな音符・けんばん・たいこ
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const n = new THREE.Group(); n.position.y = 3 + Math.random() * 3; g.add(n);
        const m = glow([0xff6ec7, 0x7ad7ff, 0xffd23f][Math.floor(Math.random() * 3)]);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), m); h.scale.set(1.3, 1, 0.6); n.add(h);
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), m); st.position.set(0.9, 1.5, 0); n.add(st);
        const fl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.2), m); fl.position.set(1.3, 2.8, 0); fl.rotation.z = -0.5; n.add(fl);
      } else if (pick === 1) {
        for (let k = 0; k < 7; k++) add(new THREE.BoxGeometry(0.7, 0.5, 2.4), mat(0xffffff), -2.1 + k * 0.72, 0.25, 0);
        for (const k of [0, 1, 3, 4, 5]) add(new THREE.BoxGeometry(0.4, 0.6, 1.4), mat(0x111111), -1.75 + k * 0.72, 0.55, -0.5);
      } else {
        add(new THREE.CylinderGeometry(1.2, 1.2, 1.4, 16), mat(0xd94a3a), 0, 0.7, 0);
        add(new THREE.CylinderGeometry(1.22, 1.22, 0.08, 16), mat(0xf5e6c8), 0, 1.42, 0);
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat(0x8a5a2b), s * 0.5, 2.0, 0).rotation.z = s * 0.6;
      }
      break;
    }
    case 'carnival': {   // 遊園地: まわる観覧車・テント・ふうせん
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const w = new THREE.Group(); w.position.y = 6.5; g.add(w);
        w.add(new THREE.Mesh(new THREE.TorusGeometry(4, 0.15, 6, 32), mat(0xff5c8a)));
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2;
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), mat(0xffffff)); sp.position.set(Math.cos(a) * 2, Math.sin(a) * 2, 0); sp.rotation.z = a - Math.PI / 2; w.add(sp);
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat([0xffd23f, 0x3a8dff, 0x4cd964, 0xff3b3b][k % 4])); c.position.set(Math.cos(a) * 4, Math.sin(a) * 4, 0); w.add(c);
        }
        spinners.push(w);
        for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.25, 6.8, 0.25), mat(0xdddddd), s * 0.8, 3.2, 0.3).rotation.z = s * 0.22;
      } else if (pick === 1) {
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(new THREE.BoxGeometry(1.6, 2.4, 0.1), mat(k % 2 ? 0xffffff : 0xff3b3b), Math.cos(a) * 1.95, 1.2, Math.sin(a) * 1.95).rotation.y = Math.PI / 2 - a; }
        add(new THREE.ConeGeometry(2.6, 2.4, 8), mat(0xff3b3b), 0, 3.6, 0);
        add(new THREE.BoxGeometry(0.6, 0.4, 0.05), mat(0xffd23f), 0.3, 5.3, 0);
        add(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), mat(0xffffff), 0, 5.2, 0);
      } else {
        for (let k = 0; k < 5; k++) {
          const x = (k - 2) * 0.6, y = 4 + (k % 2) * 0.7;
          add(new THREE.CylinderGeometry(0.02, 0.02, y, 4), mat(0xffffff), x / 2, y / 2, 0).rotation.z = -Math.atan2(x, y);
          add(new THREE.SphereGeometry(0.6, 10, 8), mat([0xff5c8a, 0x3a8dff, 0xffd23f, 0x4cd964, 0xb05cff][k]), x, y, 0).scale.y = 1.2;
        }
      }
      break;
    }
    case 'gems': {   // 宝石の洞窟: 宝石のかたまり・石筍・浮かぶ宝石
      const pick = Math.floor(Math.random() * 3);
      const col = () => [0xff2d55, 0x2d6bff, 0x1fcf6a, 0x9c5cff, 0xffb300][Math.floor(Math.random() * 5)];
      if (pick === 0) {
        for (let k = 0; k < 4; k++) { const c = add(new THREE.OctahedronGeometry(0.7 + Math.random() * 0.6), glow(col()), (Math.random() - 0.5) * 2.5, 1.2, (Math.random() - 0.5) * 2.5); c.scale.y = 2; c.rotation.z = (Math.random() - 0.5) * 0.6; }
      } else if (pick === 1) {
        for (let k = 0; k < 3; k++) { const h = 2 + Math.random() * 3; add(new THREE.ConeGeometry(0.7, h, 7), mat(0x5a4f70), (k - 1) * 1.3, h / 2, 0); }
        add(new THREE.OctahedronGeometry(0.4), glow(col()), 0, 0.5, 0.9);
      } else {
        const gm = add(new THREE.OctahedronGeometry(1.1), glow(col()), 0, 4 + Math.random() * 2, 0); gm.scale.y = 1.5; spinners.push(gm);
      }
      break;
    }
    case 'food': {   // グルメ街: 大きなハンバーガー・ピザ・ラーメン・ドーナツ
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) {
        add(new THREE.CylinderGeometry(1.6, 1.7, 0.7, 16), mat(0xd9903f), 0, 0.35, 0);
        add(new THREE.CylinderGeometry(1.8, 1.8, 0.6, 16), mat(0x5a3020), 0, 1.0, 0);
        add(new THREE.CylinderGeometry(1.9, 1.9, 0.15, 16), mat(0x4cd964), 0, 1.38, 0);
        add(new THREE.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9903f), 0, 1.45, 0).scale.y = 0.8;
      } else if (pick === 1) {
        add(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 3), mat(0xffc95a), 0, 0.15, 0).rotation.y = Math.random() * 6;
        for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), mat(0xd94a3a), Math.cos(k * 2.1) * 0.6, 0.3, Math.sin(k * 2.1) * 0.6);
      } else if (pick === 2) {
        add(new THREE.CylinderGeometry(1.8, 1.1, 1.4, 16), mat(0xd94a3a), 0, 0.7, 0);
        add(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 16), mat(0xf5d08a), 0, 1.35, 0);
        add(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), mat(0xffffff), 0.6, 1.42, 0.4);
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), mat(0x8a5a2b), -0.4 + s * 0.2, 2.2, -0.3).rotation.z = 0.5;
      } else {
        add(new THREE.TorusGeometry(1.2, 0.6, 10, 20), mat(0xff9ecb), 0, 1.9, 0);
        add(new THREE.TorusGeometry(1.2, 0.62, 10, 20, Math.PI), mat(0xffffff), 0, 1.9, 0.05);
      }
      break;
    }
    case 'magic': {   // 魔法学校: 浮かぶ本・大なべ・魔法の塔
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const bk = new THREE.Group(); bk.position.y = 3 + Math.random() * 3; g.add(bk);
        for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.6), mat(0xfff6e0)); p.position.x = s * 0.6; p.rotation.z = s * 0.25; bk.add(p); }
        const cv = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.7), mat([0xd94a3a, 0x3a8dff, 0x4cd964][Math.floor(Math.random() * 3)])); cv.position.y = -0.1; bk.add(cv);
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glow(0xffd23f)); st.position.y = 0.8; bk.add(st);
      } else if (pick === 1) {
        add(new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x222222), 0, 1.5, 0);
        add(new THREE.CircleGeometry(1.3, 16), glow(0x4cd964), 0, 1.45, 0).rotation.x = -Math.PI / 2;
        for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.25 + k * 0.08, 8, 6), glow(0x9be15d), (k - 1) * 0.5, 1.8 + k * 0.4, 0);
      } else {
        const h = 6 + Math.random() * 3;
        add(new THREE.CylinderGeometry(1.0, 1.2, h, 10), mat(0x6a5a8a), 0, h / 2, 0);
        add(new THREE.ConeGeometry(1.5, 3, 10), mat(0x3a2a7a), 0, h + 1.5, 0);
        add(new THREE.BoxGeometry(0.5, 0.8, 0.1), glow(0xffd23f), 0, h * 0.7, 1.1);
      }
      break;
    }
    case 'steam': {   // 蒸気の街: 大きな歯車・パイプ・えんとつの工場
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const gr = new THREE.Group(); gr.position.y = 3.2; g.add(gr);
        gr.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.5, 6, 24), mat(0xb08d57)));
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.8), mat(0xb08d57)); t.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0); t.rotation.z = a; gr.add(t); }
        const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), mat(0x3a3a3a)); ax.rotation.x = Math.PI / 2; gr.add(ax);
        spinners.push(gr);
      } else if (pick === 1) {
        add(new THREE.CylinderGeometry(0.35, 0.35, 4, 10), mat(0xc0673f), -1, 2, 0);
        add(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 10), mat(0xc0673f), 0.2, 3.8, 0).rotation.z = Math.PI / 2;
        add(new THREE.CylinderGeometry(0.35, 0.35, 3, 10), mat(0xc0673f), 1.4, 2.3, 0);
        add(new THREE.TorusGeometry(0.4, 0.1, 6, 12), mat(0xd94a3a), -1, 2.5, 0.4);
        for (let k = 0; k < 3; k++) add(decoGeo.puff, mat(0xeeeeee), 1.4 + k * 0.3, 4.4 + k * 0.9, 0).scale.setScalar(0.3 + k * 0.12);
      } else {
        add(new THREE.BoxGeometry(3.2, 3, 2.6), mat(0x8a4a3a), 0, 1.5, 0);
        add(new THREE.CylinderGeometry(0.4, 0.5, 4, 8), mat(0x5a3a2a), 0.9, 4.5, 0);
        for (const x of [-0.8, 0.4]) add(new THREE.BoxGeometry(0.6, 0.7, 0.1), glow(0xffb300), x, 1.8, 1.31);
        for (let k = 0; k < 3; k++) add(decoGeo.puff, mat(0xdddddd), 0.9 + k * 0.4, 7 + k * 1.1, 0).scale.setScalar(0.4 + k * 0.15);
      }
      break;
    }
    case 'dream': {   // 夢の国: 浮かぶひつじ・大きなまくら・パステルの雲と星
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        const y = 3 + Math.random() * 3;
        for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.7, 10, 8), mat(0xffffff), Math.cos(k) * 0.8, y + Math.sin(k * 2) * 0.4, Math.sin(k) * 0.5);
        add(new THREE.SphereGeometry(0.5, 10, 8), mat(0x333333), 1.3, y + 0.2, 0);
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), mat(0x333333), s * 0.5, y - 0.9, 0);
      } else if (pick === 1) {
        add(new THREE.BoxGeometry(3, 0.9, 2), mat([0xffd6f0, 0xd6e4ff, 0xfff2c4][Math.floor(Math.random() * 3)]), 0, 0.45, 0).rotation.y = Math.random() * 3;
        add(new THREE.SphereGeometry(0.6, 10, 8), mat(0xffffff), 0, 1.1, 0).scale.set(1.6, 0.5, 1);
      } else {
        const y = 7 + Math.random() * 2;
        for (let k = 0; k < 4; k++) add(decoGeo.puff, mat([0xffd6f0, 0xe3d4ff][k % 2]), -1.2 + k * 0.8, y + (k % 2) * 0.4, 0).scale.setScalar(0.6);
        spinners.push(add(new THREE.OctahedronGeometry(0.5), glow(0xfff27a), 0, y - 2, 0));
      }
      break;
    }
    case 'sun': {   // 太陽の神殿: 柱の上の太陽・金の門・ひまわり
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) {
        add(new THREE.CylinderGeometry(0.6, 0.8, 5, 10), mat(0xfff3c4), 0, 2.5, 0);
        const sn = new THREE.Group(); sn.position.y = 7; g.add(sn);
        sn.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), glow(0xffd23f)));
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const r = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 6), glow(k % 2 ? 0xff7a2a : 0xffd23f)); r.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0); r.rotation.z = a - Math.PI / 2; sn.add(r); }
        spinners.push(sn);
      } else if (pick === 1) {
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.5, 0.6, 6, 10), mat(0xffd966), s * 2, 3, 0);
        add(new THREE.BoxGeometry(5.6, 0.8, 1.2), mat(0xffc21a), 0, 6.3, 0);
        add(new THREE.CircleGeometry(0.6, 16), glow(0xff7a2a), 0, 6.3, 0.61);
      } else {
        for (let k = 0; k < 3; k++) {
          const x = (k - 1) * 1.4, h = 2.5 + (k % 2) * 1.2;
          add(new THREE.CylinderGeometry(0.08, 0.1, h, 6), mat(0x3a9d23), x, h / 2, 0);
          add(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12), mat(0x6b4423), x, h, 0.1).rotation.x = Math.PI / 2;
          for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; const p = add(new THREE.SphereGeometry(0.22, 6, 4), mat(0xffd23f), x + Math.cos(a) * 0.55, h + Math.sin(a) * 0.55, 0.05); p.scale.set(0.6, 1.3, 0.3); p.rotation.z = a - Math.PI / 2; }
        }
      }
      break;
    }
    case 'moon': {   // 月の都: クレーター・光る三日月・もちつきのうす・月のお城
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) {   // クレーター
        const r = 1.6 + Math.random() * 1.4;
        const rim = add(new THREE.TorusGeometry(r, 0.4, 6, 20), mat(0x9a9eae), 0, 0.15, 0); rim.rotation.x = Math.PI / 2; rim.castShadow = false;
        const pit = add(new THREE.CircleGeometry(r, 20), mat(0x80849a), 0, 0.05, 0); pit.rotation.x = -Math.PI / 2; pit.castShadow = false;
      } else if (pick === 1) {   // 浮かぶ三日月
        const cr = add(new THREE.TorusGeometry(1.4, 0.4, 10, 24, Math.PI * 1.25), glow(0xffe066), 0, 5 + Math.random() * 3, 0); cr.rotation.z = 2.2; cr.castShadow = false;
        spinners.push(cr);
      } else if (pick === 2) {   // もちつきのうすときね
        add(new THREE.CylinderGeometry(1.1, 0.9, 1.4, 14), mat(0x9a6a3a), 0, 0.7, 0);
        add(new THREE.SphereGeometry(0.8, 12, 8), mat(0xffffff), 0, 1.45, 0).scale.y = 0.5;
        const k = add(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 10), mat(0xb07a3b), 0.4, 3.0, 0); k.rotation.z = Math.PI / 2 - 0.4;
        add(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), mat(0x8a5a2b), 1.1, 2.1, 0).rotation.z = 0.5;
      } else {   // 月のお城（白い塔と金の屋根）
        const h = 5 + Math.random() * 4;
        add(new THREE.CylinderGeometry(0.9, 1.1, h, 10), mat(0xf4f1ff), 0, h / 2, 0);
        add(new THREE.ConeGeometry(1.3, 2.4, 10), glow(0xffe066), 0, h + 1.2, 0);
        add(new THREE.BoxGeometry(0.4, 0.7, 0.1), glow(0x7ad7ff), 0, h * 0.6, 1.0);
      }
      break;
    }
    case 'icecastle': {   // 氷の塔と雪だるま
      if (Math.random() < 0.6) {
        const h = 5 + Math.random() * 5;
        add(new THREE.CylinderGeometry(1.0, 1.2, h, 8), mat(0xc8ecff), 0, h / 2, 0);
        add(new THREE.ConeGeometry(1.4, 2.6, 8), mat(0x7fc8f0), 0, h + 1.3, 0);
        add(new THREE.BoxGeometry(0.4, 0.8, 0.1), glow(0x7df9ff), 0, h * 0.6, 1.05);
      } else {
        add(new THREE.SphereGeometry(1.2, 14, 10), mat(0xffffff), 0, 1.1, 0);
        add(new THREE.SphereGeometry(0.8, 14, 10), mat(0xffffff), 0, 2.7, 0);
        add(new THREE.ConeGeometry(0.15, 0.6, 6), mat(0xff7b00), 0, 2.7, 0.9).rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'obelisk': {   // オベリスクと小さなピラミッド
      if (Math.random() < 0.5) {
        add(new THREE.BoxGeometry(1.2, 7, 1.2), mat(0xd8b46a), 0, 3.5, 0);
        add(new THREE.ConeGeometry(0.9, 1.2, 4), glow(0xffd23f), 0, 7.6, 0).rotation.y = Math.PI / 4;
      } else {
        add(new THREE.ConeGeometry(3, 3.4, 4), mat(0xe2c27a), 0, 1.7, 0).rotation.y = Math.PI / 4;
      }
      break;
    }
    case 'volcano': {   // 小さな火山（てっぺんが光る）と溶岩
      add(new THREE.ConeGeometry(2.6, 4, 10, 1, true), mat(0x2b1a17), 0, 2, 0);
      const top = add(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10), glow(0xff5a1c), 0, 3.9, 0);
      if (Math.random() < 0.5) { const sm = add(new THREE.SphereGeometry(0.8, 8, 6), mat(0x555555), 0, 5.2, 0); sm.scale.set(1, 0.7, 1); }
      void top;
      break;
    }
    case 'toys': {   // つみきとボール
      const cols = [0xff4f7b, 0x3a8dff, 0xffd23f, 0x4cd964];
      if (Math.random() < 0.6) {
        for (let k = 0; k < 3; k++) { const b = add(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat(cols[(k + Math.floor(Math.random() * 4)) % 4]), (k - 1) * 0.3, 0.7 + k * 1.4, 0); b.rotation.y = k * 0.4; }
      } else {
        const ball = add(new THREE.SphereGeometry(1.3, 16, 12), mat(cols[Math.floor(Math.random() * 4)]), 0, 1.3, 0);
        add(new THREE.TorusGeometry(1.31, 0.12, 6, 24), mat(0xffffff), 0, 1.3, 0); void ball;
      }
      break;
    }
    case 'satellite': {   // 宇宙ステーションのアンテナと浮かぶ惑星
      if (Math.random() < 0.5) {
        add(new THREE.CylinderGeometry(0.15, 0.2, 5, 6), mat(0xaab4c0), 0, 2.5, 0);
        const dish = add(new THREE.SphereGeometry(1.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0xdfe6ee), 0, 5.2, 0); dish.rotation.x = Math.PI * 0.75;
        add(new THREE.SphereGeometry(0.2, 8, 6), glow(0xff1744), 0, 5.6, 0.6);
      } else {
        const pl = add(new THREE.SphereGeometry(1.2, 14, 10), glow([0x6c8cff, 0xff9e00, 0xb388ff][Math.floor(Math.random() * 3)]), 0, 5 + Math.random() * 4, 0);
        const ring = add(new THREE.TorusGeometry(1.8, 0.12, 6, 28), mat(0xfff1c4), pl.position.x, pl.position.y, 0); ring.rotation.x = 1.2; spinners.push(ring);
      }
      break;
    }
    case 'flowers': {   // 大きな花とキノコ
      if (Math.random() < 0.6) {
        add(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 6), mat(0x3a9d23), 0, 1.6, 0);
        const col = [0xff5c8a, 0xffd23f, 0xb388ff, 0x7df9ff][Math.floor(Math.random() * 4)];
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const p = add(new THREE.SphereGeometry(0.55, 10, 8), mat(col), Math.cos(a) * 0.65, 3.4, Math.sin(a) * 0.65); p.scale.y = 0.4; }
        add(new THREE.SphereGeometry(0.4, 10, 8), glow(0xffe066), 0, 3.5, 0);
      } else {
        add(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 8), mat(0xfff1d6), 0, 0.8, 0);
        add(new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff4f4f), 0, 1.5, 0);
      }
      break;
    }
    case 'mirror': {   // 立ち並ぶ鏡の板（光る縁）
      const h = 4 + Math.random() * 3;
      const m = add(new THREE.BoxGeometry(0.2, h, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9ad0ff, emissiveIntensity: 0.55 }), 0, h / 2 + 0.3, 0);
      m.rotation.y = Math.random() * Math.PI;
      add(new THREE.BoxGeometry(0.3, 0.3, 2.8), glow(0xb388ff), m.position.x, h + 0.4, 0).rotation.y = m.rotation.y;
      break;
    }
    case 'goldtemple': {   // 金の柱と招き猫の像
      if (Math.random() < 0.6) {
        const h = 6 + Math.random() * 3;
        add(new THREE.CylinderGeometry(0.8, 0.9, h, 12), glow(0xffd23f), 0, h / 2, 0);
        add(new THREE.BoxGeometry(2.2, 0.5, 2.2), mat(0xe63946), 0, h + 0.25, 0);
      } else {
        add(new THREE.BoxGeometry(1.8, 1.8, 1.6), mat(0xffffff), 0, 0.9, 0);
        add(new THREE.BoxGeometry(1.6, 1.4, 1.4), mat(0xffffff), 0, 2.5, 0);
        for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.3, 0.6, 4), mat(0xffffff), s * 0.5, 3.4, 0);
        const arm = add(new THREE.BoxGeometry(0.4, 1.2, 0.4), mat(0xffffff), 0.95, 3.0, 0.3); arm.rotation.z = -0.3;
        add(new THREE.SphereGeometry(0.3, 10, 8), glow(0xffd23f), 0, 1.7, 0.85);   // 鈴
      }
      break;
    }
    case 'luckyblock': {
      // 大きなラッキーブロック
      const b = buildLuckyBlock();
      b.scale.setScalar(1.6 + Math.random()); b.position.y = 2.5 + Math.random() * 3;
      b.rotation.set(0.3, Math.random() * 3, 0.2);
      g.add(b); spinners.push(b);
      break;
    }
    case 'clock': {
      // 浮かぶ時計の輪と針
      const c = new THREE.Group(); c.position.y = 3 + Math.random() * 2; g.add(c);
      const r = new THREE.Mesh(decoGeo.ring, glow(0xffe066)); c.add(r);
      const h1 = new THREE.Mesh(decoGeo.hand, glow(0xb388ff)); h1.position.y = 0.7; c.add(h1);
      c.rotation.y = Math.random() * Math.PI;
      spinners.push(r);
      break;
    }
  }
  g.scale.setScalar(s);
  scene.add(g);
}
ZONES.forEach((z, i) => {
  const start = ZONE_STARTS[i], len = ZONE_LENS[i];
  for (let k = 0; k < Math.min(40, Math.round(22 * len / 80)); k++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    decorate(z.deco, side * (11 + Math.random() * (WORLD_HALF_W - 13)), start + 4 + Math.random() * (len - 8));
  }
  // 日本: 道の途中に大きな鳥居
  if (z.deco === 'sakura') for (let k = 1; k <= 3; k++) bigTorii(start + len * k / 4);
});
function bigTorii(z) {
  const g = new THREE.Group(); g.position.set(0, 0, z);
  const red = mat(0xe63946), blk = mat(0x1a1a1a);
  const part = (geo, m, x, y) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, 0); o.castShadow = true; g.add(o); return o; };
  for (const s of [-1, 1]) {
    part(new THREE.CylinderGeometry(0.75, 0.85, 13, 16), red, s * 9, 6.5);
    part(new THREE.CylinderGeometry(1.0, 1.0, 0.8, 16), blk, s * 9, 0.4);
  }
  part(new THREE.BoxGeometry(24, 1.0, 1.8), blk, 0, 13.6);     // 笠木（かさぎ）
  part(new THREE.BoxGeometry(22.5, 0.9, 1.5), red, 0, 12.7);
  part(new THREE.BoxGeometry(20.5, 0.8, 1.1), red, 0, 10.2);   // 貫（ぬき）
  part(new THREE.BoxGeometry(1.4, 2.5, 0.9), red, 0, 11.4);    // 額束
  scene.add(g);
}
// 拠点の木
for (let k = 0; k < 10; k++) decorate('tree', (k % 2 ? -1 : 1) * (24 + Math.random() * 5), -6 - k * 4.8);

// ---------- ハロウィンの飾り（期間中だけ） ----------
const HALLOWEEN = halloweenActive();
const halloweenSky = new THREE.Color(0x3a1d5c);
const bats = [];
function jackOLantern(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xff7a1a)); body.scale.set(1.15, 0.85, 1.15); body.position.y = 0.85; body.castShadow = true; g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 6), mat(0x3a6b2a)); stem.position.y = 1.75; g.add(stem);
  const face = glow(0xffd23f);
  for (const k of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), face); e.position.set(k * 0.38, 1.05, 0.95); e.rotation.x = Math.PI / 2; g.add(e); }
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.1), face); m.position.set(0, 0.6, 0.97); g.add(m);
  g.rotation.y = Math.atan2(-x, -z) + Math.PI;   // 道のほうを向く
  scene.add(g);
}
if (HALLOWEEN) {
  // 拠点と発射エリアのまわりにジャック・オ・ランタン
  for (let k = 0; k < 8; k++) jackOLantern((k % 2 ? -1 : 1) * 19, -4 - k * 6.5, 0.9 + Math.random() * 0.4);
  for (const x of [-8, 8]) jackOLantern(x, LAUNCH_POS.z + 4, 1.3);
  // ゾーンの道ばたにも少し
  ZONES.forEach((z, i) => {
    for (let k = 0; k < 4; k++) jackOLantern((Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 15), ZONE_STARTS[i] + Math.random() * ZONE_LENS[i], 0.8 + Math.random() * 0.6);
  });
  // 空を飛ぶコウモリ
  const batMat = mat(0x1a1024);
  for (let k = 0; k < 14; k++) {
    const b = new THREE.Group();
    const bd = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), batMat); b.add(bd);
    const wings = [-1, 1].map(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.4), batMat); w.position.x = s * 0.55; b.add(w); return w; });
    b.userData = { wings, r: 14 + Math.random() * 26, h: 10 + Math.random() * 10, sp: 0.2 + Math.random() * 0.3, ph: Math.random() * 6.28, cz: -20 + Math.random() * 60 };
    scene.add(b); bats.push(b);
  }
  // 夕暮れのオレンジの光にして、少し暗くする
  scene.fog.near = 55; scene.fog.far = 230;
  hemi.color.set(0xffc08a); hemi.groundColor.set(0x3a2050); hemi.intensity = 1.15;
  sun.color.set(0xff9a55); sun.intensity = 1.3;
  // 大きな月（霧の影響を受けないようにする）
  const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }));
  moon.position.set(-110, 120, 260); scene.add(moon);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
  halo.position.copy(moon.position); scene.add(halo);
}
function updateBats(t) {
  for (const b of bats) {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph) * 1.5, u.cz + Math.sin(a) * u.r);
    b.rotation.y = -a;
    u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18 + u.ph) * 0.7; });
  }
}

// ---------- 拠点の設備 ----------
// 台座
const SLOT_POS = [];
for (let i = 0; i < SLOT_COUNT; i++) {
  const side = i < SLOT_COUNT / 2 ? -1 : 1;
  SLOT_POS.push(new THREE.Vector3(side * 14, 0, -8 - (i % (SLOT_COUNT / 2)) * 7));
}
const slotObjs = SLOT_POS.map((p, i) => {
  const g = new THREE.Group(); g.position.copy(p);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 20), mat(0xeceff1));
  base.position.y = 0.3; base.castShadow = base.receiveShadow = true; g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.15, 8, 32), new THREE.MeshBasicMaterial({ color: 0x777777 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.62; g.add(ring);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6),
    new THREE.MeshBasicMaterial({ map: textTexture(`${i + 1}`, { bg: '#37474f', fg: '#fff', w: 128, h: 64, font: 'bold 48px sans-serif' }) }));
  num.position.set(-Math.sign(p.x) * 2.25, 0.3, 0); num.rotation.y = -Math.sign(p.x) * Math.PI / 2; g.add(num);
  scene.add(g);
  return { group: g, ring, model: null, label: null };
});

// ダンベル台
const DUMBBELL_POS = new THREE.Vector3(0, 0, -24);
{
  const g = new THREE.Group(); g.position.copy(DUMBBELL_POS);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.25, 24), mat(0x37474f));
  pad.position.y = 0.12; pad.receiveShadow = true; g.add(pad);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), mat(0x9e9e9e));
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.9, -2.2); g.add(bar);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16), mat(0x212121));
    w.rotation.z = Math.PI / 2; w.position.set(s * 1.7, 0.9, -2.2); w.castShadow = true; g.add(w);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshBasicMaterial({ map: textTexture('💪 トレーニング', { bg: '#ff7043', fg: '#fff', font: 'bold 54px sans-serif' }), side: THREE.DoubleSide }));
  sign.position.set(0, 4, -3.2); g.add(sign);
  scene.add(g);
}

// 発射台
const LAUNCH = new THREE.Vector3(LAUNCH_POS.x, 0, LAUNCH_POS.z);
const TEE_POS = new THREE.Vector3(LAUNCH.x, 3.0, LAUNCH.z + 3.2);
{
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.25, 24), mat(0xffd23f));
  pad.position.set(LAUNCH.x, 0.12, LAUNCH.z); pad.receiveShadow = true; scene.add(pad);
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 2.2, 8), mat(0xff7043));
  tee.position.set(TEE_POS.x, 1.1, TEE_POS.z); tee.castShadow = true; scene.add(tee);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6),
    new THREE.MeshBasicMaterial({ map: textTexture('🏏 ここで打つ！', { bg: '#1e88e5', fg: '#fff', font: 'bold 56px sans-serif' }), side: THREE.DoubleSide }));
  sign.position.set(LAUNCH.x - 6, 3.5, LAUNCH.z); sign.rotation.y = Math.PI; scene.add(sign);
}
const teeBlock = buildLuckyBlock();
teeBlock.position.copy(TEE_POS).add(new THREE.Vector3(0, 0.8, 0));
scene.add(teeBlock);

// =====================================================================
// プレイヤー
// =====================================================================
const player = buildPlayer(SKIN_BY_ID[save.skin] || SKINS[0]);
scene.add(player.group);
const pState = { pos: new THREE.Vector3(0, 0, -12), facing: 0, walk: 0, lift: 0 };
let carried = null;   // { def, model, mut }
input.camYaw = 0;

// =====================================================================
// ボス
// =====================================================================
const bosses = ZONES.map((z, i) => {
  const b = buildBoss(z.boss);
  const home = new THREE.Vector3(0, 0, ZONE_STARTS[i] + ZONE_LENS[i] * 0.72);
  b.group.position.copy(home);
  b.group.rotation.y = Math.PI;
  scene.add(b.group);
  return { ...b, def: z.boss, home, state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), walk: 0, label: null };
});

// =====================================================================
// HTMLラベル（3D位置に追従）
// =====================================================================
const labelRoot = $('labels');
const labels = [];
function makeLabel(getPos, cls = '', maxDist = 70) {
  const el = document.createElement('div');
  el.className = 'wlabel ' + cls;
  labelRoot.appendChild(el);
  const l = { el, getPos, maxDist, html: '' };
  labels.push(l);
  return l;
}
function setLabel(l, html) { if (l.html !== html) { l.html = html; l.el.innerHTML = html; } }
const tmpV = new THREE.Vector3();
function updateLabels() {
  for (const l of labels) {
    const p = l.getPos();
    if (!p) { l.el.style.display = 'none'; continue; }
    tmpV.copy(p);
    const dist = tmpV.distanceTo(camera.position);
    tmpV.project(camera);
    if (tmpV.z > 1 || dist > l.maxDist || Math.abs(tmpV.x) > 1.2 || Math.abs(tmpV.y) > 1.2) { l.el.style.display = 'none'; continue; }
    l.el.style.display = '';
    l.el.style.transform = `translate(${(tmpV.x + 1) / 2 * innerWidth}px, ${(1 - tmpV.y) / 2 * innerHeight}px) translate(-50%, -100%)`;
  }
}

const rarityName = r => RARITIES[r].css === 'rainbow' || RARITIES[r].css === 'cosmic'
  ? `<span class="rar ${RARITIES[r].css}-text">${RARITIES[r].name}</span>`
  : `<span class="rar" style="color:${RARITIES[r].css}">${RARITIES[r].name}</span>`;
const stars = n => '★'.repeat(n) + '☆'.repeat(MAX_STAR - n);

slotObjs.forEach((o, i) => {
  o.label = makeLabel(() => (save.slots[i] ? tmpLabelPos(o) : null), '', 45);
});
function tmpLabelPos(o) {
  return o._lp ||= o.group.position.clone().add(new THREE.Vector3(0, 4.6, 0));
}
bosses.forEach(b => {
  b.label = makeLabel(() => b.group.position.clone().add(new THREE.Vector3(0, b.def.scale * 4.6, 0)), 'boss', 120);
  setLabel(b.label, `<div class="n">👹 ${b.def.name}</div><div>速さ ${b.def.speed}</div>`);
});

// =====================================================================
// 台座のキャラ表示
// =====================================================================
function refreshSlot(i) {
  const o = slotObjs[i], s = save.slots[i];
  if (o.model) { o.group.remove(o.model); o.model = null; }
  if (!s) { o.ring.material.color.set(0x777777); return; }
  const def = CHAR_BY_ID[s.id];
  o.model = buildCharacter(def, s.mut);
  o.model.position.y = 0.6;
  o.model.scale.setScalar(1 + (s.star - 1) * 0.12);
  o.model.rotation.y = -Math.sign(SLOT_POS[i].x) * Math.PI / 2;
  o.group.add(o.model);
  o.ring.material.color.set(rarFx(def.r));
}
save.slots.forEach((_, i) => refreshSlot(i));

function updateSlotLabels() {
  slotObjs.forEach((o, i) => {
    const s = save.slots[i];
    if (!s) { setLabel(o.label, `<div class="n">台座${i + 1}（空き）</div>${save.inventory.length ? '<div>近づいてキャラを置こう</div>' : ''}`); return; }
    const def = CHAR_BY_ID[s.id];
    setLabel(o.label,
      `<div class="m">$${fmt(s.stored)}</div><div class="n">${def.name}</div>${mutTag(s.mut)}` +
      `<div>${rarityName(def.r)} <span class="s">${stars(s.star)}</span></div><div>+${fmt(charIncome(def, s.star, s.mut))}/秒</div>`);
  });
}

// =====================================================================
// パーティクル
// =====================================================================
const particles = [];
const partGeo = new THREE.BoxGeometry(1, 1, 1);
function spawnParticle(pos, vel, color, life = 0.8, size = 0.35, gravity = 18) {
  const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(pos); m.scale.setScalar(size);
  scene.add(m);
  particles.push({ m, vel, life, max: life, gravity });
}
function burst(pos, color, n = 30, power = 12) {
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power);
    spawnParticle(pos, v, color, 0.7 + Math.random() * 0.6, 0.25 + Math.random() * 0.4);
  }
}
// ---- 花火（打ち上げて、空で開く） ----
const rockets = [];
const FW_COLORS = [0xff4fa3, 0xffd23f, 0x4fc3ff, 0x7dff8a, 0xb388ff, 0xff7043, 0xffffff];
function firework(x, z, color = FW_COLORS[Math.random() * FW_COLORS.length | 0]) {
  const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color }));
  m.scale.setScalar(0.4); m.position.set(x, 1, z); scene.add(m);
  rockets.push({ m, color, t: 0.85 + Math.random() * 0.45, vel: new THREE.Vector3((Math.random() - 0.5) * 3, 17 + Math.random() * 4, (Math.random() - 0.5) * 3) });
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.t -= dt; r.vel.y -= 12 * dt;
    r.m.position.addScaledVector(r.vel, dt);
    if (Math.random() < 0.6) spawnParticle(r.m.position, new THREE.Vector3(0, -2, 0), 0xffe9a8, 0.35, 0.18, 0);
    if (r.t > 0) continue;
    scene.remove(r.m); r.m.material.dispose(); rockets.splice(i, 1);
    // 球の形に広がる
    const c2 = FW_COLORS[Math.random() * FW_COLORS.length | 0];
    for (let k = 0; k < 64; k++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(11 + Math.random() * 4);
      spawnParticle(r.m.position, v, k % 4 ? r.color : c2, 1.1 + Math.random() * 0.7, 0.3 + Math.random() * 0.3, 5);
    }
    play('hit', { vol: 0.16, rate: 0.5 + Math.random() * 0.25 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); particles.splice(i, 1); continue; }
    p.vel.y -= p.gravity * dt;
    p.m.position.addScaledVector(p.vel, dt);
    p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 4;
    p.m.material.opacity = p.life / p.max;
  }
}

// =====================================================================
// UI ユーティリティ
// =====================================================================
function toast(text, { color = '#fff', big = false, time = 2200 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (big ? ' big' : '');
  el.style.color = color;
  el.innerHTML = text;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, time);
}
let fadeBusy = false;
function fadeThen(fn) {
  fadeBusy = true;
  $('fade').classList.add('on');
  setTimeout(() => { fn(); $('fade').classList.remove('on'); setTimeout(() => { fadeBusy = false; }, 350); }, 380);
}
let shake = 0;

// =====================================================================
// ゲーム状態
// =====================================================================
let state = 'free';     // free / aim / swing / flight / atBlock / opening / chase
let stateT = 0;
const setState = s => { state = s; stateT = 0; };

const flight = { block: null, from: new THREE.Vector3(), to: new THREE.Vector3(), T: 1, h: 1, zone: 0, timing: 1, pillar: null, landed: false };
let timingPos = 0, timingDir = 1;
let chaseBoss = null;
let camYawTarget = null;
let trainBoost = false;

function totalIncome() {
  return save.slots.reduce((a, s) => a + (s ? charIncome(CHAR_BY_ID[s.id], s.star, s.mut) : 0), 0);
}

// ---------- ダッシュ ----------
const DASH_TIME = 0.5, DASH_CD = 3, DASH_MULT = 1.9;
let dashT = 0, dashCd = 0;
input.onDash = () => {
  if (!$('title').classList.contains('hidden') || openPanel || dashCd > 0) return;
  if (!['free', 'atBlock', 'chase'].includes(state)) return;
  dashT = DASH_TIME; dashCd = DASH_CD;
  questAdd('dash', 1);
  play('whoosh', { vol: 0.6, rate: 1.3 });
  burst(pState.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xffffff, 12, 6);
};
function updateDashHud() {
  const ready = dashCd <= 0;
  const p = ready ? 1 : 1 - dashCd / DASH_CD;
  $('dashHud').classList.toggle('ready', ready);
  $('dashHud').style.setProperty('--p', p);
  $('dashBtn').classList.toggle('ready', ready);
  $('dashBtn').style.setProperty('--p', p);
}

// ---------- 行動ボタン ----------
let currentAction = null;
input.onAction = () => {
  if (!$('title').classList.contains('hidden') || openPanel) return;
  currentAction?.fn();
};

function startAim() {
  setState('aim');
  pState.pos.set(LAUNCH.x, 0, LAUNCH.z);
  pState.facing = 0;
  camYawTarget = 0;
  timingPos = 0; timingDir = 1;
  $('timing').classList.remove('hidden');
}

function doSwing() {
  $('timing').classList.add('hidden');
  const p = timingPos;
  let mult, label, color;
  if (p > 0.45 && p < 0.55) { mult = 1.3; label = 'PERFECT!!'; color = '#4cd964'; questAdd('perfect', 1); }
  else if (p > 0.3 && p < 0.7) { mult = 1.1; label = 'GOOD!'; color = '#ffd23f'; }
  else { mult = 0.85; label = 'MISS…'; color = '#ff6b6b'; }
  flight.timing = mult;
  toast(label, { color, big: true, time: 1200 });
  play('swing');
  setState('swing');
}

// 飛ばす力を下げると、力による飛距離の伸びがその割合になる
const usedStrength = () => save.strength * save.launchPower ** 2;
const estDistance = (mult = 1) => Math.round(18 + 5.5 * Math.sqrt(usedStrength()) * mult);

function launchBlock() {
  const d = launchDistance(usedStrength(), flight.timing);
  const toZ = Math.min(TEE_POS.z + d, WORLD_END - 8);
  questAdd('launch', 1);
  flight.from.copy(teeBlock.position);
  flight.to.set((Math.random() - 0.5) * 20, 0.8, toZ);
  // ゾーンが長くなったので、遠くまで飛ぶときも待ち時間と高さは上限を設ける
  flight.T = Math.min(8, 1.4 + d / 150);
  flight.h = Math.min(160, 6 + d * 0.28);
  flight.zone = zoneAt(toZ);
  flight.landed = false;
  teeBlock.visible = false;
  flight.block = buildLuckyBlock();
  flight.block.position.copy(flight.from);
  scene.add(flight.block);
  play(flight.timing > 1.2 ? 'hit_perfect' : 'hit');
  setTimeout(() => play('whoosh', { vol: 0.8 }), 120);
  shake = 0.4;
  burst(flight.from, 0xffd23f, 18, 10);
  $('flightHud').classList.remove('hidden');
  setState('flight');
}

function landBlock() {
  flight.landed = true;
  const b = flight.block;
  b.position.copy(flight.to);
  b.rotation.set(0, 0, 0);
  const r = flight.zone;
  const col = rarFx(r);
  b.material.color.set(col);
  b.material.emissive.set(new THREE.Color(col).multiplyScalar(0.25));
  play('land');
  shake = 0.6;
  burst(flight.to, col, 40, 16);
  // 光の柱
  flight.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flight.pillar.position.set(flight.to.x, 30, flight.to.z);
  scene.add(flight.pillar);
  const dist = Math.round(flight.to.z - TEE_POS.z);
  save.stats.bestDistance = Math.max(save.stats.bestDistance, dist);
  questMax('distance', dist);
  toast(`${dist}m！ ${rarityName(r)} ゾーン`, { big: true, time: 1800 });
}

function teleportToBlock() {
  fadeThen(() => {
    pState.pos.set(flight.to.x, 0, flight.to.z - 4.5);
    pState.facing = 0;
    input.camYaw = 0;
    camYawTarget = null;
    $('flightHud').classList.add('hidden');
    setState('atBlock');
    toast('ブロックを開けよう！', { color: '#ffd23f' });
  });
}

function removeFlightBlock() {
  if (flight.block) { scene.remove(flight.block); flight.block = null; }
  if (flight.pillar) { scene.remove(flight.pillar); flight.pillar = null; }
  teeBlock.visible = true;
}

let openResult = null;
let rouletteTimer = 0;
function openBlock() {
  setState('opening');
  openResult = rollCharacter(flight.zone);
  // 運アップ中は倍率の回数だけ引いて、いちばんいいキャラ（レア度→稼ぎの順）にする
  for (let i = 1; i < boostMult('luck'); i++) {
    const c = rollCharacter(flight.zone);
    if (c.r > openResult.r || (c.r === openResult.r && (c.lowRate || c.mult > openResult.mult) && !openResult.lowRate)) openResult = c;
  }
  play('roulette');
  $('reveal').classList.remove('hidden', 'pop');
  $('revealIncome').textContent = '';
}

function finishOpen() {
  const def = openResult;
  const r = def.r;
  play('reveal');
  const pos = flight.block.position.clone();
  burst(pos, rarFx(r), 50, 18);
  removeFlightBlock();
  teeBlock.visible = false;   // 持ち帰るまで次は打てない
  // 変異イベント中なら変異する
  const ev = currentEvent();
  const hw = halloweenActive();
  let mut = ev.active ? (ev.mut || rollMutation(hw)) : null;
  // ハロウィン: レインボーかぼちゃタイム中は超低確率でレインボーかぼちゃ
  if (hw && rainbowPumpkinTime().active && Math.random() < RAINBOW_PUMPKIN_CHANCE) mut = 'rainbowpumpkin';
  $('revealRarity').innerHTML = rarityName(r) + (mut ? ` ${mutTag(mut)}` : '');
  if (def.lowRate) $('revealRarity').innerHTML += ' <span class="mut mut-rainbowpumpkin">✨激レア</span>';
  $('revealName').textContent = def.name;
  const special = RARITIES[r].css === 'rainbow' || RARITIES[r].css === 'cosmic';
  $('revealName').className = 'name' + (special ? ` ${RARITIES[r].css}-text` : '');
  $('revealName').style.color = special ? '' : RARITIES[r].css;
  $('revealIncome').textContent = `+${fmt(charIncome(def, 1, mut))}/秒`;
  if (mut) setTimeout(() => play('evolve', { vol: 0.7 }), 350);
  $('reveal').classList.add('pop');
  setTimeout(() => $('reveal').classList.add('hidden'), 2200);

  const model = buildCharacter(def, mut);
  model.scale.setScalar(0.55);
  player.carry.add(model);
  carried = { def, model, mut };
  save.stats.bestRarity = Math.max(save.stats.bestRarity, r);

  // ボス出現
  chaseBoss = bosses[flight.zone];
  const b = chaseBoss;
  b.from.copy(b.group.position);
  const tz = Math.min(pos.z + 18, WORLD_END - 3);   // ボスはすぐ後ろに着地する
  b.to.set(tz - pos.z < 15 ? pos.x + (pos.x > 0 ? -16 : 16) : pos.x, 0, tz);
  b.state = 'leap'; b.t = 0;
  setTimeout(() => {
    if (state === 'chase') toast(`👹 ${b.def.name} が追ってくる！手前の拠点まで逃げろ！${input.isTouch ? '' : '（S キー）'}`, { color: '#ff6b6b', time: 2600 });
  }, 600);
  camYawTarget = 0;   // ボスが見えるよう拠点側から見る
  $('chaseBossName').textContent = `👹 ${b.def.name}`;
  $('chaseHud').classList.remove('hidden');
  setState('chase');
}

function endChase() {
  stopLoop('boss_run');
  $('chaseHud').classList.add('hidden');
  if (chaseBoss) {
    const b = chaseBoss;
    b.from.copy(b.group.position); b.to.copy(b.home); b.state = 'return'; b.t = 0;
    chaseBoss = null;
  }
  teeBlock.visible = true;
}

function caught() {
  play('caught');
  shake = 0.8;
  toast('捕まった！ キャラを奪われた…', { color: '#ff6b6b', big: true, time: 2600 });
  if (carried) { player.carry.remove(carried.model); carried = null; }
  endChase();
  setState('free');
  fadeThen(() => {
    pState.pos.set(0, 0, -12);
    pState.facing = 0;
    input.camYaw = 0;
  });
}

function reachedBase() {
  const def = carried.def, mut = carried.mut || null;
  player.carry.remove(carried.model);
  carried = null;
  endChase();
  setState('free');
  play('safe');
  save.stats.collected++;
  save.stats.bestHome = Math.max(save.stats.bestHome || 0, def.r);
  questAdd('collect', 1);
  const isNew = !save.dex[def.id];
  const entry = save.dex[def.id] ||= { count: 0, first: Date.now(), seen: false };
  entry.count++;
  if (mut) (entry.muts ||= {})[mut] = true;
  if (isNew) setTimeout(() => toast(`📖 インデックスに ${def.name} を登録！`, { color: '#ffd23f', time: 2600 }), 700);
  save.inventory.push(mut ? { id: def.id, star: 1, mut } : { id: def.id, star: 1 });
  newItems++;
  toast(`🎒 ${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name} をインベントリに入れた！${isNew ? ' <span style="color:#ffd23f">NEW!</span>' : ''}`, { color: '#7dff8a', big: true, time: 2600 });
  if (save.stats.collected <= 2) setTimeout(() => toast('空いている台座に近づくと、キャラを選んで置けるよ', { color: '#ffd23f', time: 3500 }), 1400);
  writeSave();
  renderPanels();
  sendScore();
  netEvent(`🎁 ${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name}（${RARITIES[def.r].name}）を持ち帰った！${def.lowRate ? ' ✨激レア' : ''}`);
}

function addMoney(v) {
  save.money += v;
  save.stats.totalEarned += v;
  questAdd('earn', v);
}

// =====================================================================
// 行動の判定（毎フレーム）
// =====================================================================
function nearestSlot() {
  let best = -1, bd = 3.2;
  SLOT_POS.forEach((p, i) => {
    const d = Math.hypot(p.x - pState.pos.x, p.z - pState.pos.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function decideAction() {
  const p = pState.pos;
  if (state === 'free') {
    if (Math.hypot(p.x - LAUNCH.x, p.z - LAUNCH.z) < 3.2) return { label: save.launchPower < 1 ? `打つ（力${Math.round(save.launchPower * 100)}%）` : '打つ', fn: startAim };
    if (Math.hypot(p.x - DUMBBELL_POS.x, p.z - DUMBBELL_POS.z) < 3.4) return { label: '持ち上げる', fn: liftDumbbell };
    const si = nearestSlot();
    if (si >= 0 && save.slots[si]) return { label: 'キャラを見る', fn: () => openChars('slots', si) };
    if (si >= 0 && save.inventory.length) return { label: 'キャラを置く', fn: () => openChars('inv', si) };
    return null;
  }
  if (state === 'aim') return { label: '打つ！', fn: doSwing };
  if (state === 'atBlock' && flight.block && p.distanceTo(flight.block.position) < 5.5) return { label: '開ける', fn: openBlock };
  return null;
}

function liftDumbbell() {
  const gain = (strengthRate(save.dumbbellLv) * 2 + 1) * boostMult('strength');
  save.strength += gain;
  pState.lift = 1;
  play('lift', { vol: 0.6, rate: 0.9 + Math.random() * 0.2 });
  const p = pState.pos.clone(); p.y = 6;
  spawnParticle(p, new THREE.Vector3((Math.random() - 0.5) * 2, 6, 0), 0xff7043, 0.6, 0.3, 6);
}

// =====================================================================
// 更新
// =====================================================================
const clock = new THREE.Clock();
let elapsed = 0;
let saveTimer = 0, labelTimer = 0;
let lastZone = -1;
const camPos = new THREE.Vector3(0, 10, -30);
const camLook = new THREE.Vector3();

function update(dt) {
  elapsed += dt;
  stateT += dt;
  pollInput();

  // --- 放置での成長・収入 ---
  trainBoost = state === 'free' && Math.hypot(pState.pos.x - DUMBBELL_POS.x, pState.pos.z - DUMBBELL_POS.z) < 3.4;
  save.strength += strengthRate(save.dumbbellLv) * dt * (trainBoost ? 3 : 1) * boostMult('strength');
  const incomeBoost = boostMult('income');
  for (const s of save.slots) if (s) s.stored += charIncome(CHAR_BY_ID[s.id], s.star, s.mut) * dt * incomeBoost;

  // --- 移動 ---
  const prevX = pState.pos.x, prevZ = pState.pos.z;   // 動く前の位置（柵の判定に使う）
  const canMove = ['free', 'atBlock', 'chase'].includes(state) && !fadeBusy && !openPanel;
  dashT -= dt; dashCd -= dt;
  const spd = playerSpeed(save.speedLv) * (dashT > 0 ? DASH_MULT : 1) * boostMult('speed');
  let moving = false;
  if (canMove && (input.move.x || input.move.y)) {
    const yaw = input.camYaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const dx = fx * input.move.y - fz * input.move.x;
    const dz = fz * input.move.y + fx * input.move.x;
    const mag = Math.min(1, Math.hypot(input.move.x, input.move.y));
    pState.pos.x += dx * spd * dt;
    pState.pos.z += dz * spd * dt;
    const target = Math.atan2(dx, dz);
    let diff = target - pState.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    pState.facing += diff * Math.min(1, dt * 14);
    pState.walk += dt * spd * 0.55 * mag;
    moving = true;
  }
  if (state === 'aim' && (Math.abs(input.move.x) > 0.5 || Math.abs(input.move.y) > 0.5)) {
    $('timing').classList.add('hidden'); setState('free');
  }
  {
    // 一緒に遊んでいる間は、拠点の中だけ横に並んだ基地まで歩ける（道は今までどおり）
    const [bMin, bMax] = typeof baseRange === 'function' ? baseRange() : [0, 0];
    if (pState.pos.z < BASE_LINE) pState.pos.x = THREE.MathUtils.clamp(pState.pos.x, bMin - WORLD_HALF_W + 1, bMax + WORLD_HALF_W - 1);
    else if (Math.abs(pState.pos.x) > WORLD_HALF_W - 1) {
      // となりの基地（道の横）から道へ出ようとしたときだけ、拠点側にとどめる。
      // ※ 以前は「柵より2以上外に出たら拠点の線へ移す」だったため、ダッシュで柵に勢いよく当たると拠点へワープして
      //    持っているキャラがそのまま持ち帰り扱いになっていた
      if (prevZ < BASE_LINE && Math.abs(prevX) > WORLD_HALF_W - 1) pState.pos.z = prevZ;
      else pState.pos.x = THREE.MathUtils.clamp(pState.pos.x, -WORLD_HALF_W + 1, WORLD_HALF_W - 1);
    }
  }
  pState.pos.z = THREE.MathUtils.clamp(pState.pos.z, -54, WORLD_END - 2);

  // --- 台座のお金を回収 ---
  if (state === 'free' || state === 'chase') {
    const si = nearestSlot();
    if (si >= 0 && save.slots[si] && save.slots[si].stored >= 1 && Math.hypot(SLOT_POS[si].x - pState.pos.x, SLOT_POS[si].z - pState.pos.z) < 2.6) {
      const v = save.slots[si].stored;
      save.slots[si].stored = 0;
      addMoney(v);
      play('coin', { vol: 0.7 });
      toast(`+$${fmt(v)}`, { color: '#7dff8a', time: 1000 });
      burst(SLOT_POS[si].clone().add(new THREE.Vector3(0, 2.5, 0)), 0x7dff8a, 12, 8);
    }
  }

  // --- 状態ごとの処理 ---
  if (state === 'aim') {
    timingPos += timingDir * dt * 1.6;
    if (timingPos > 1) { timingPos = 1; timingDir = -1; }
    if (timingPos < 0) { timingPos = 0; timingDir = 1; }
    document.querySelector('#timing .cursor').style.left = (timingPos * 100) + '%';
  }
  if (state === 'swing' && stateT > 0.22 && !flight.block) launchBlock();

  if (state === 'flight') {
    const u = Math.min(1, stateT / flight.T);
    const b = flight.block;
    b.position.lerpVectors(flight.from, flight.to, u);
    b.position.y = flight.from.y + (flight.to.y - flight.from.y) * u + 4 * flight.h * u * (1 - u);
    b.rotation.x += dt * 9; b.rotation.z += dt * 6;
    if (Math.random() < 0.7) spawnParticle(b.position, new THREE.Vector3(0, 0, 0), 0xfff2a8, 0.5, 0.45, 0);
    const z = zoneAt(b.position.z);
    $('flightDist').textContent = Math.max(0, Math.round(b.position.z - TEE_POS.z)) + 'm';
    $('flightZone').innerHTML = b.position.z > ZONE_START ? `${ZONES[z].name} ・ ${rarityName(z)}` : '';
    if (u >= 1 && !flight.landed) landBlock();
    if (flight.landed && stateT > flight.T + 1.1) { setState('teleport'); teleportToBlock(); }
  }

  if (state === 'atBlock') {
    if (flight.block) flight.block.rotation.y += dt;
    if (pState.pos.z < BASE_LINE) {
      removeFlightBlock();
      setState('free');
      toast('ブロックを置いてきてしまった…', { color: '#ff6b6b' });
    }
  }

  if (state === 'opening') {
    const b = flight.block;
    b.position.x = flight.to.x + (Math.random() - 0.5) * 0.3 * stateT;
    b.rotation.y += dt * (4 + stateT * 10);
    b.scale.setScalar(1 + stateT * 0.25);
    rouletteTimer -= dt;
    if (rouletteTimer <= 0) {
      rouletteTimer = 0.05 + stateT * 0.06;
      const pool = CHARACTERS.filter(c => Math.abs(c.r - flight.zone) <= 1);
      const c = pool[Math.floor(Math.random() * pool.length)];
      $('revealRarity').innerHTML = rarityName(c.r);
      $('revealName').textContent = c.name;
      $('revealName').className = 'name';
      $('revealName').style.color = '#fff';
    }
    if (stateT > 1.6) finishOpen();
  }

  if (state === 'chase') {
    const home = Math.max(0, pState.pos.z - BASE_LINE);
    $('chaseHome').textContent = Math.round(home) + 'm';
    if (chaseBoss) {
      const bd = Math.hypot(chaseBoss.group.position.x - pState.pos.x, chaseBoss.group.position.z - pState.pos.z);
      $('chaseBoss').textContent = Math.round(bd) + 'm' + (chaseBoss.dash > 0 ? ' 💨' : '');
      $('chaseHud').classList.toggle('close', bd < 14);
    }
    if (pState.pos.z < BASE_LINE) reachedBase();
  }

  // --- ボス ---
  for (const b of bosses) updateBoss(b, dt);

  // --- プレイヤーのアニメーション ---
  for (const a of player.anims) a(elapsed);
  if (HALLOWEEN) updateBats(elapsed);
  updateRemotes(dt);
  const g = player.group;
  g.position.copy(pState.pos);
  let twist = 0;
  if (state === 'swing' || (state === 'flight' && stateT < 0.3)) {
    const t = state === 'swing' ? stateT / 0.3 : 1;
    const k = Math.min(1, t);
    player.armR.rotation.x = -Math.PI / 2;
    player.armL.rotation.x = -Math.PI / 2;
    twist = THREE.MathUtils.lerp(1.6, -1.4, k * k);
  } else if (state === 'aim') {
    player.armR.rotation.x = -Math.PI / 2 + Math.sin(elapsed * 6) * 0.05;
    player.armL.rotation.x = -Math.PI / 2;
    twist = 1.6;
  } else {
    const sw = moving ? Math.sin(pState.walk) * 0.8 : 0;
    player.legL.rotation.x = sw; player.legR.rotation.x = -sw;
    if (carried) {
      player.armL.rotation.x = player.armR.rotation.x = Math.PI;   // 頭の上で支える
    } else if (trainBoost) {
      pState.lift = Math.max(0, pState.lift - dt * 3);
      const a = Math.PI - Math.abs(Math.sin(elapsed * 3)) * 0.8 - pState.lift * 0.6;
      player.armL.rotation.x = player.armR.rotation.x = a;
    } else {
      player.armL.rotation.x = -sw * 0.8;
      player.armR.rotation.x = sw * 0.8 - 0.3;
    }
  }
  g.rotation.y = pState.facing + twist;
  if (carried) {
    carried.model.position.y = Math.sin(elapsed * 6) * 0.1;
    for (const a of carried.model.userData.anims) a(elapsed);
  }

  // --- 台座キャラのアニメーション ---
  for (const o of slotObjs) if (o.model) {
    o.model.position.y = 0.6 + Math.abs(Math.sin(elapsed * 2 + o.group.position.z)) * 0.15;
    for (const a of o.model.userData.anims) a(elapsed);
  }
  for (const s of spinners) s.rotation.z += dt * 1.5;
  if (flight.pillar) flight.pillar.material.opacity = 0.25 + Math.sin(elapsed * 5) * 0.1;
  if (teeBlock.visible) { teeBlock.rotation.y += dt; teeBlock.position.y = TEE_POS.y + 0.8 + Math.sin(elapsed * 2) * 0.08; }

  updateRockets(dt); updateBirthday(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateSky(dt);

  // --- UI ---
  currentAction = decideAction();
  const pr = $('prompt');
  if (currentAction && !input.isTouch) {
    pr.innerHTML = `<kbd>E</kbd>${currentAction.label}`;
    pr.classList.remove('hidden');
  } else if (state === 'atBlock' && !currentAction) {
    pr.innerHTML = '📦 光る場所のブロックに近づこう';
    pr.classList.remove('hidden');
  } else if (trainBoost && !input.isTouch) {
    pr.classList.add('hidden');
  } else pr.classList.add('hidden');
  const ab = $('actionBtn');
  if (currentAction) { ab.textContent = currentAction.label; ab.classList.remove('hidden'); } else ab.classList.add('hidden');

  $('lockHint').classList.toggle('hidden', input.isTouch || input.locked || !!openPanel || !$('title').classList.contains('hidden'));

  labelTimer -= dt;
  updateDashHud();
  if (labelTimer <= 0) { labelTimer = 0.2; updateHud(); updateSlotLabels(); updateEvent(); if (openPanel === 'shopPanel') renderShop(); }
  updateLabels();

  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; writeSave(); }
}

function updateBoss(b, dt) {
  b.t += dt;
  for (const f of b.anims || []) f(b.t, b.walk);   // 羽ばたき・しっぽ・触手など
  const g = b.group;
  if (b.state === 'idle') {
    g.position.y = Math.abs(Math.sin(b.t * 2)) * 0.15;
    g.rotation.y = Math.PI + Math.sin(b.t * 0.5) * 0.6;
    b.armL.rotation.x = b.armR.rotation.x = Math.sin(b.t * 2) * 0.1;
    b.legL.rotation.x = b.legR.rotation.x = 0;
  } else if (b.state === 'leap' || b.state === 'return') {
    const D = b.state === 'leap' ? 1.1 : 1.4;
    const u = Math.min(1, b.t / D);
    g.position.lerpVectors(b.from, b.to, u);
    g.position.y = 4 * 18 * u * (1 - u);
    g.rotation.y = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
    b.armL.rotation.x = b.armR.rotation.x = -2.6;
    if (u >= 1) {
      if (b.state === 'leap') {
        b.state = 'chase'; b.t = 0; b.dash = 0; b.nextDash = BOSS_DASH_EVERY;
        play('boss'); shake = 0.7;
        burst(g.position.clone().add(new THREE.Vector3(0, 1, 0)), b.def.color, 30, 14);
        startLoop('boss_run', 0.5);
      } else { b.state = 'idle'; g.rotation.y = Math.PI; }
    }
  } else if (b.state === 'chase') {
    if (state !== 'chase') { b.state = 'idle'; return; }
    const dx = pState.pos.x - g.position.x, dz = pState.pos.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (b.t > 0.3) {   // 着地後の短い硬直
      // 追いかけるほど速くなる＋ときどきダッシュ
      const accel = Math.min(BOSS_ACCEL_MAX, 1 + (b.t - 0.3) * BOSS_ACCEL);
      b.nextDash -= dt;
      if (b.nextDash <= 0 && b.dash <= 0) {
        b.dash = BOSS_DASH_TIME; b.nextDash = BOSS_DASH_EVERY * (0.8 + Math.random() * 0.4);
        play('whoosh', { vol: 0.7, rate: 0.7 });
        burst(g.position.clone().add(new THREE.Vector3(0, 1, 0)), b.def.color, 14, 8);
      }
      if (b.dash > 0) b.dash -= dt;
      const spd = b.def.speed * accel * (b.dash > 0 ? BOSS_DASH_MULT : 1);
      b.curSpeed = spd;
      g.position.x += dx / d * spd * dt;
      g.position.z += dz / d * spd * dt;
      b.walk += dt * spd * 0.25;
    }
    g.position.y = 0;
    g.rotation.y = Math.atan2(dx, dz);
    const sw = Math.sin(b.walk) * 0.9;
    b.legL.rotation.x = sw; b.legR.rotation.x = -sw;
    b.armL.rotation.x = -1.4 - sw * 0.3; b.armR.rotation.x = -1.4 + sw * 0.3;
    if (d < 1.6 + b.def.scale * 0.7) caught();
  }
}

function updateCamera(dt) {
  // タイトル画面: 拠点のまわりをゆっくり回るカメラ
  if (document.body.classList.contains('title-mode')) {
    const t = performance.now() / 1000;
    camPos.set(Math.sin(t * 0.07) * 40, 15 + Math.sin(t * 0.21) * 3, -14 + Math.cos(t * 0.07) * 40);
    camLook.set(0, 3, -6);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    sun.position.set(camLook.x + 30, camLook.y + 60, camLook.z - 20);
    sun.target.position.copy(camLook);
    return;
  }
  if (camYawTarget !== null) {
    let diff = camYawTarget - input.camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    input.camYaw += diff * Math.min(1, dt * 4);
    if (Math.abs(diff) < 0.01) camYawTarget = null;
  }
  let target, look;
  if (state === 'flight' && flight.block) {
    const b = flight.block.position;
    target = new THREE.Vector3(b.x + 10, b.y + 6, b.z - 18);
    look = b.clone();
  } else {
    const yaw = input.camYaw, pitch = state === 'chase' ? Math.max(input.camPitch, 0.5) : input.camPitch;
    const dist = 15 * input.zoom * (state === 'chase' ? 1.25 : 1) * (camera.aspect < 1 ? 1.5 : 1);
    look = pState.pos.clone().add(new THREE.Vector3(0, 3.5, 0));
    target = look.clone().add(new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist + 1,
      -Math.cos(yaw) * Math.cos(pitch) * dist));
    target.y = Math.max(target.y, 1.5);
  }
  const k = state === 'flight' ? Math.min(1, dt * 6) : Math.min(1, dt * 12);
  camPos.lerp(target, k);
  camLook.lerp(look, k);
  camera.position.copy(camPos);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  }
  camera.lookAt(camLook);
  // 影のカメラを追従
  sun.position.set(camLook.x + 30, camLook.y + 60, camLook.z - 20);
  sun.target.position.copy(camLook);
}

const tmpCol = new THREE.Color();
// ---------- 変異イベント ----------
// いつもの15分ごとのイベントに加えて、管理者が始めた変異イベントも見る
let adminEvents = [];
const liveEvents = kind => adminEvents.filter(e => e.kind === kind && Date.parse(e.starts_at) <= Date.now() && Date.parse(e.ends_at) > Date.now());
function currentEvent() {
  const a = liveEvents('mutation')[0];
  if (a) return { active: true, left: Math.max(0, Math.ceil((Date.parse(a.ends_at) - Date.now()) / 1000)), mut: a.payload.mut || null, admin: true };
  const ev = mutationEvent();
  const next = adminEvents.filter(e => e.kind === 'mutation' && Date.parse(e.starts_at) > Date.now())
    .map(e => Math.ceil((Date.parse(e.starts_at) - Date.now()) / 1000)).sort((x, y) => x - y)[0];
  if (!ev.active && next !== undefined && next < ev.left) return { active: false, left: next };
  return ev;
}
let eventOn = currentEvent().active;
// ---------- 管理者のブーストイベント（運・力・稼ぎ・スピード） ----------
const BOOSTS = {
  luck:     { icon: '🍀', name: '運アップ',     desc: 'レアなキャラが出やすい' },
  strength: { icon: '💪', name: '力アップ',     desc: '力の伸びが増える' },
  income:   { icon: '💰', name: '稼ぎアップ',   desc: '台座にたまるお金が増える' },
  speed:    { icon: '👟', name: 'スピードアップ', desc: '走るのが速くなる' },
};
function boostMult(type) {
  let m = type === 'luck' && bdayOn ? 2 : 1;   // 誕生日は一日じゅう運×2
  for (const e of liveEvents('boost')) if (e.payload.type === type) m = Math.max(m, Math.min(type === 'speed' ? 1.5 : 3, +e.payload.mult || 1));
  return m;
}
let bdayOn = false;   // 今日が誕生日か（checkBirthday で更新）
const seenBoosts = new Set();
// ---------- 管理者のイベント（日付つき）: 開始まで／残り時間をみんなに出す ----------
const seenPeriod = new Set();
let bannerSig = '';
function updateEventBanner() {
  const now = Date.now();
  const evs = adminEvents.filter(e => e.kind === 'event' && Date.parse(e.ends_at) > now);
  const live = evs.filter(e => Date.parse(e.starts_at) <= now).sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
  const next = evs.filter(e => Date.parse(e.starts_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  for (const e of live) {
    if (seenPeriod.has(e.id)) continue;
    seenPeriod.add(e.id);
    if (now - Date.parse(e.starts_at) < 10 * 60000 || !$('title').classList.contains('hidden')) {
      play('reveal', { vol: 0.5 });
      toast(`🎉 イベント「${escHtml(e.payload.title)}」開催中！${e.payload.desc ? `<br><small>${escHtml(e.payload.desc)}</small>` : ''}`, { color: '#ffd23f', big: true, time: 5000 });
    }
  }
  // もうすぐ始まるブースト・変異イベント（24時間以内）も小さく出す
  const soon = adminEvents.filter(e => (e.kind === 'boost' || e.kind === 'mutation') && Date.parse(e.starts_at) > now && Date.parse(e.starts_at) - now < 86400000)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, 2);
  const main = live[0] ? { e: live[0], on: true } : next[0] ? { e: next[0], on: false } : null;
  let html = '';
  if (main) {
    const e = main.e, left = ((main.on ? Date.parse(e.ends_at) : Date.parse(e.starts_at)) - now) / 1000;
    html += `<div class="eb-main ${main.on ? 'on' : ''}" title="${escHtml(e.payload.desc || '')}"><b>🎉 ${escHtml(e.payload.title)}</b><span>${main.on ? '開催中！ のこり' : '開始まで あと'} <em>${fmtLeft(left)}</em></span></div>`;
  }
  for (const e of soon) {
    const b = e.kind === 'boost' ? BOOSTS[e.payload.type] : null;
    const name = b ? `${b.icon} ${b.name} ×${e.payload.mult}` : `🧬 ${e.payload.mut ? MUT_BY_ID[e.payload.mut]?.name : ''}変異イベント`;
    html += `<div class="eb-sub">${name} まで あと <em>${fmtLeft((Date.parse(e.starts_at) - now) / 1000)}</em></div>`;
  }
  if (html !== bannerSig) {
    bannerSig = html;
    $('eventBanner').innerHTML = html; $('eventBanner').classList.toggle('hidden', !html);
    $('titleEvent').innerHTML = main ? html.replace(/eb-sub/g, 'eb-sub t') : '';
    $('titleEvent').classList.toggle('hidden', !main);
  }
}
$('eventBanner').addEventListener('click', () => {
  const e = adminEvents.find(x => x.kind === 'event' && Date.parse(x.ends_at) > Date.now() && x.payload.desc);
  if (e) toast(`🎉 ${escHtml(e.payload.title)}<br><small>${escHtml(e.payload.desc)}<br>${fmtWhen(e.starts_at)} 〜 ${fmtWhen(e.ends_at)}</small>`, { color: '#ffd23f', time: 5000 });
});
let boostSig = '';
function updateBoosts() {
  const live = liveEvents('boost').filter(e => BOOSTS[e.payload.type]);
  for (const e of live) {
    if (seenBoosts.has(e.id)) continue;
    seenBoosts.add(e.id);
    const b = BOOSTS[e.payload.type];
    play('evolve');
    toast(`⚡ ブーストイベント開始！ ${b.icon} ${b.name} ×${e.payload.mult}<br><small>${b.desc}</small>`, { color: '#ffd23f', big: true, time: 4000 });
  }
  const html = (bdayOn ? '<div class="stat boost bday"><span class="ico">🎂</span><b>誕生日</b><small>運アップ ×2</small></div>' : '') + live.map(e => {
    const b = BOOSTS[e.payload.type];
    const left = Math.max(0, Math.ceil((Date.parse(e.ends_at) - Date.now()) / 1000));
    return `<div class="stat boost"><span class="ico">${b.icon}</span><b>${mmss(left)}</b><small>${b.name} ×${e.payload.mult}</small></div>`;
  }).join('');
  if (html !== boostSig) { boostSig = html; $('boostStats').innerHTML = html; }
}
const eventSky = new THREE.Color(0x7a3cff);
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// 長い残り時間: 「2日 03:12:45」「1:05:09」「12:30」
function fmtLeft(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return d ? `${d}日 ${p(h)}:${p(m)}:${p(s)}` : h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
let rankTimer = 0, eventTimer = 0;
let pumpkinOn = halloweenActive() && rainbowPumpkinTime().active;
const seenEvents = new Set();
async function pollEvents() {
  try { adminEvents = await fetchEvents(); } catch (e) { return; }
  for (const e of liveEvents('message')) {
    if (seenEvents.has(e.id)) continue;
    seenEvents.add(e.id);
    play('reveal', { vol: 0.5 });
    toast(`📢 ${escHtml(e.payload.text)}`, { color: '#ffd23f', big: true, time: 5000 });
  }
  // プレゼントは1人1回（セーブに記録）
  for (const e of liveEvents('gift')) {
    if (save.claimedGifts.includes(e.id)) continue;
    const def = CHAR_BY_ID[e.payload.char];
    save.claimedGifts = [...save.claimedGifts, e.id].slice(-100);
    if (!def) continue;
    const mut = MUT_BY_ID[e.payload.mut] ? e.payload.mut : null;
    save.inventory.push(mut ? { id: def.id, star: 1, mut } : { id: def.id, star: 1 });
    const entry = save.dex[def.id] ||= { count: 0, first: Date.now(), seen: false };
    entry.count++;
    if (mut) (entry.muts ||= {})[mut] = true;
    newItems++;
    play('evolve');
    toast(`🎁 管理者からのプレゼント！ ${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name} をインベントリに入れた${e.payload.note ? `<br><small>${escHtml(e.payload.note)}</small>` : ''}`, { color: '#7dff8a', big: true, time: 5000 });
    writeSave(); renderPanels();
  }
  if (openPanel === 'adminPanel') renderAdminActive();
}
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function updateEvent() {
  if ((rankTimer -= 0.2) <= 0) { rankTimer = 60; sendScore(); backupNow(); }
  const ev = currentEvent();
  $('eventStat').classList.toggle('on', ev.active);
  $('sEvent').textContent = mmss(ev.left);
  updateBoosts();
  updateEventBanner();
  $('sEventLabel').textContent = ev.active ? (ev.mut ? `${MUT_BY_ID[ev.mut].name}変異イベント中！` : '変異イベント中！') : '次の変異まで';
  if (ev.active !== eventOn) {
    eventOn = ev.active;
    if (eventOn) {
      play('evolve');
      toast(ev.admin ? '🧬 管理者の変異イベント開始！' : '🧬 変異イベント開始！', { color: '#c9a7ff', big: true, time: 3000 });
      setTimeout(() => toast(ev.mut ? `いま手に入れたキャラは全員${MUT_BY_ID[ev.mut].name}変異！` : '3分間、手に入れたキャラが全員変異する！', { color: '#c9a7ff', time: 3500 }), 800);
    } else toast('🧬 変異イベントが終わった', { color: '#c9a7ff', time: 3000 });
  }
  if ((eventTimer -= 0.2) <= 0) { eventTimer = 30; pollEvents(); }
  // ハロウィン: レインボーかぼちゃタイム
  if (HALLOWEEN) {
    const rp = rainbowPumpkinTime();
    $('pumpkinStat').classList.remove('hidden');
    $('pumpkinStat').classList.toggle('on', rp.active);
    $('sPumpkin').textContent = mmss(rp.left);
    $('sPumpkinLabel').textContent = rp.active ? 'レインボーかぼちゃタイム！' : 'レインボーかぼちゃまで';
    if (rp.active !== pumpkinOn) {
      pumpkinOn = rp.active;
      if (pumpkinOn) {
        play('evolve');
        toast('🌈🎃 レインボーかぼちゃタイム！（1分間）', { color: '#ff9f1c', big: true, time: 3200 });
        setTimeout(() => toast('いま手に入れたキャラは、ごくまれにレインボーかぼちゃ変異（×7）！', { color: '#ffd23f', time: 3500 }), 800);
      }
    }
  }
  // 管理者のお知らせ
  const msg = liveEvents('message')[0];
  $('adminMsg').classList.toggle('hidden', !msg);
  if (msg) $('adminMsgText').textContent = msg.payload.text;
}

function updateSky(dt) {
  const focusZ = state === 'flight' && flight.block ? flight.block.position.z : pState.pos.z;
  const z = focusZ < ZONE_START ? -1 : zoneAt(focusZ);
  tmpCol.set(z < 0 ? 0x8fd3ff : ZONES[z].sky);
  if (eventOn) tmpCol.lerp(eventSky, 0.4);   // 変異イベント中は空が紫がかる
  if (HALLOWEEN) tmpCol.lerp(halloweenSky, 0.6);   // ハロウィンは夕暮れの紫の空
  scene.background.lerp(tmpCol, Math.min(1, dt * 2));
  scene.fog.color.copy(scene.background);
  if (z !== lastZone) {
    lastZone = z;
    $('zoneLabel').innerHTML = z < 0 ? (pState.pos.z < BASE_LINE ? '🏠 拠点' : '🏏 発射エリア') : `${ZONES[z].name} ・ ${rarityName(z)}`;
  }
  if (z < 0) {
    const t = pState.pos.z < BASE_LINE ? '🏠 拠点' : '🏏 発射エリア';
    if ($('zoneLabel').dataset.t !== t) { $('zoneLabel').dataset.t = t; $('zoneLabel').innerHTML = t; }
  } else $('zoneLabel').dataset.t = '';
}

function updateHud() {
  $('sMoney').textContent = '$' + fmt(save.money);
  $('sIncome').textContent = `+${fmt(totalIncome())}/秒`;
  $('sStrength').textContent = fmt(save.strength);
  $('sRate').textContent = `+${fmt(strengthRate(save.dumbbellLv) * (trainBoost ? 3 : 1))}/秒${trainBoost ? ' ×3' : ''}`;
  $('sSpeed').textContent = playerSpeed(save.speedLv).toFixed(1);
  $('rebirthStat').classList.toggle('hidden', !save.rebirths);
  $('sRebirth').textContent = save.rebirths;
  $('sRebirthMult').textContent = `×${rebirthMult(save.rebirths)}`;
  $('invBadge').textContent = newItems;
  $('invBadge').classList.toggle('hidden', newItems === 0 || openPanel === 'charPanel');
  const unseen = Object.values(save.dex).filter(e => !e.seen).length;
  $('indexBadge').textContent = unseen;
  $('indexBadge').classList.toggle('hidden', unseen === 0 || openPanel === 'indexPanel');
}

// =====================================================================
// パネル（ショップ・キャラ・設定）
// =====================================================================
let openPanel = null;
let highlightSlot = -1;
let charTab = 'inv';        // キャラ画面のタブ: inv（インベントリ）/ slots（台座）
let placeSlot = -1;         // 台座から開いたとき、置き先の台座
let newItems = 0;           // まだ見ていないインベントリの新入り数
function openChars(tab, slot = -1) {
  charTab = tab;
  openPanelById('charPanel', tab === 'slots' ? slot : -1);
  placeSlot = tab === 'inv' ? slot : -1;
  renderChars();
}

function openPanelById(id, slot = -1) {
  closePanels();
  placeSlot = -1;
  unlockPointer();
  openPanel = id;
  highlightSlot = slot;
  $(id).classList.remove('hidden');
  renderPanels();
}
let rankFromTitle = false;   // タイトルからランキングだけ開いたとき
function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  openPanel = null;
  if (rankFromTitle) { rankFromTitle = false; $('title').classList.remove('hidden'); document.body.classList.add('title-mode'); }
}
document.querySelectorAll('#menu button').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.panel;
  if (openPanel === id) closePanels(); else openPanelById(id);
}));
document.querySelectorAll('.panel .close').forEach(b => b.addEventListener('click', () => { closePanels(); if ($('title').classList.contains('hidden')) lockPointer(); }));
addEventListener('keydown', e => { if (e.code === 'Escape') { closePanels(); if (state === 'aim') { $('timing').classList.add('hidden'); setState('free'); } } });

// 数字キー 1〜4 でメニューパネルを開閉（PC 用。テンキーにも対応）
const menuKeyPanels = {
  Digit1: 'shopPanel', Digit2: 'charPanel', Digit3: 'indexPanel', Digit4: 'settingsPanel', Digit5: 'rankPanel', Digit6: 'skinPanel', Digit7: 'adminPanel', Digit8: 'chatPanel', Slash: 'chatPanel', NumpadDivide: 'chatPanel', Digit9: 'friendPanel', Digit0: 'dailyPanel', Numpad0: 'dailyPanel', KeyQ: 'dailyPanel',
  Numpad1: 'shopPanel', Numpad2: 'charPanel', Numpad3: 'indexPanel', Numpad4: 'settingsPanel', Numpad5: 'rankPanel', Numpad6: 'skinPanel', Numpad7: 'adminPanel', Numpad8: 'chatPanel', Numpad9: 'friendPanel',
};
addEventListener('keydown', e => {
  const panelId = menuKeyPanels[e.code];
  if (!panelId || e.repeat) return;
  if (panelId === 'adminPanel' && !isAdmin) return;   // 管理者メニューは管理者だけ
  if (panelId === 'chatPanel' && e.code.includes('Slash') || e.code === 'NumpadDivide') e.preventDefault();   // 「/」が入力欄に入らないように
  // 入力欄にフォーカスがあるときは無視する
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  // タイトル画面・かるわかGAMESアカウント画面では無視する
  if (!$('title').classList.contains('hidden')) return;
  if (document.querySelector('.ka-overlay')) return;
  // 同じキーをもう一度押したら閉じてマウスロックを戻す
  if (openPanel === panelId) { closePanels(); lockPointer(); return; }
  // 打つ構え中なら Escape と同じく構えを解除してから開く
  if (state === 'aim') { $('timing').classList.add('hidden'); setState('free'); }
  // openPanelById 内で unlockPointer() が呼ばれ、マウスロックは解除される
  openPanelById(panelId);
});

function renderPanels() {
  if (openPanel === 'shopPanel') renderShop();
  if (openPanel === 'charPanel') renderChars();
  if (openPanel === 'indexPanel') renderIndex();
  if (openPanel === 'rankPanel') openRanking();
  if (openPanel === 'skinPanel') renderSkins();
  if (openPanel === 'dailyPanel') renderDaily();
  if (openPanel === 'loginPanel') renderLogin();
  if (openPanel === 'bdayPanel') renderBday();
  if (openPanel === 'tradePanel') renderTrade();
  if (openPanel === 'backupPanel') renderBackups();
  if (openPanel === 'chatPanel') openChat();
  if (openPanel === 'friendPanel') renderFriends(true);
  if (openPanel === 'adminPanel') { renderAdminActive(); renderGiftPicker(); renderFlagged(); renderTrusted(); }
  if (openPanel === 'settingsPanel') {
    $('nameInput').value = save.name;
    $('volInput').value = save.volume;
    renderBdayField();
  }
}

// ---------- 飛ばす力の調整 ----------
function updatePowerText() {
  const pct = Math.round(save.launchPower * 100);
  const d = Math.min(estDistance(1.3), WORLD_END - 8);
  const z = zoneAt(TEE_POS.z + d);
  $('powerVal').textContent = `${pct}%`;
  $('powerHint').innerHTML = `PERFECTで約${d}m → ${d + TEE_POS.z < ZONE_START ? '発射エリア' : `${ZONES[z].name}（${rarityName(z)}）`}まで`;
}
$('powerInput').addEventListener('input', e => {
  save.launchPower = Math.min(1, Math.max(0.01, +e.target.value / 100));
  updatePowerText(); writeSave();
});

let shopSig = '';
function renderShop() {
  if (document.activeElement !== $('powerInput')) $('powerInput').value = Math.round(save.launchPower * 100);
  updatePowerText();
  const dl = save.dumbbellLv, sl = save.speedLv;
  const dc = dumbbellCost(dl + 1), sc = speedCost(sl + 1);
  const rn = save.rebirths, rc = rebirthCost(rn);
  const sig = [dl, sl, rn, save.launchPower, save.money >= dc, save.money >= sc, save.money >= rc].join();
  if (sig === shopSig && $('shopBody').children.length) return;
  shopSig = sig;
  $('shopBody').innerHTML = `
    <div class="card"><div class="icon">🏋️</div><div class="info">
      <h3>ダンベル Lv.${dl}</h3><p>力 +${fmt(strengthRate(dl))}/秒 → <b>+${fmt(strengthRate(dl + 1))}/秒</b></p></div>
      <div class="btns"><button class="btn" data-buy="dumbbell" ${save.money < dc ? 'disabled' : ''}>強化<small>$${fmt(dc)}</small></button></div></div>
    <div class="card"><div class="icon">👟</div><div class="info">
      <h3>スピード Lv.${sl}</h3><p>速さ ${playerSpeed(sl).toFixed(1)} → <b>${playerSpeed(sl + 1).toFixed(1)}</b></p></div>
      <div class="btns"><button class="btn" data-buy="speed" ${save.money < sc ? 'disabled' : ''}>強化<small>$${fmt(sc)}</small></button></div></div>
    <div class="card rebirth"><div class="icon">🔄</div><div class="info">
      <h3>リボーン ${rn}回</h3><p>稼ぎ・力の伸び ×${rebirthMult(rn)} → <b>×${rebirthMult(rn + 1)}</b></p>
      <p class="warn">お金・力・ダンベル・スピードが最初に戻る（キャラとインデックスは残る）</p></div>
      <div class="btns"><button class="btn reb" data-buy="rebirth" ${save.money < rc ? 'disabled' : ''}>リボーン<small>$${fmt(rc)}</small></button></div></div>
    <p class="dex-sum">💡 ボスの速さ（最初）: ${ZONES.map((z, i) => `${RARITIES[i].name} ${z.boss.speed}`).join(' / ')}<br>ボスは追いかけるほど速くなり（最大1.25倍）、ときどきダッシュしてくる！</p>
    <p class="dex-sum">現在の力での飛距離の目安: 約${estDistance()}m（PERFECTで約${estDistance(1.3)}m）</p>`;
}
$('shopBody').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]');
  if (!b || b.disabled) return;
  if (b.dataset.buy === 'rebirth') { doRebirth(); return; }
  if (b.dataset.buy === 'dumbbell') {
    const c = dumbbellCost(save.dumbbellLv + 1);
    if (save.money < c) return;
    save.money -= c; save.dumbbellLv++; questAdd('upgrade', 1);
    toast(`🏋️ ダンベル Lv.${save.dumbbellLv}！`, { color: '#ffd23f' });
  } else {
    const c = speedCost(save.speedLv + 1);
    if (save.money < c) return;
    save.money -= c; save.speedLv++; questAdd('upgrade', 1);
    toast(`👟 スピード Lv.${save.speedLv}！`, { color: '#ffd23f' });
  }
  play('buy');
  shopSig = '';
  renderShop(); updateHud(); writeSave();
});

function doRebirth() {
  const c = rebirthCost(save.rebirths);
  if (save.money < c || state !== 'free') return;
  const next = rebirthMult(save.rebirths + 1);
  if (!confirm(`リボーンしますか？

お金・力・ダンベル・スピードが最初に戻ります。
キャラ・台座にたまったお金・インデックスは残ります。

稼ぎと力の伸びが ×${next} になります。`)) return;
  save.rebirths++;
  save.money = 0; save.strength = 20; save.dumbbellLv = 1; save.speedLv = 1;
  play('evolve');
  burst(pState.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xb388ff, 60, 16);
  toast(`🔄 リボーン ${save.rebirths}回目！ 稼ぎ・力の伸び ×${next}`, { color: '#b388ff', big: true, time: 3200 });
  sendScore();
  netEvent(`🔄 リボーン ${save.rebirths}回目！`);
  shopSig = '';
  closePanels(); lockPointer();
  updateHud(); updateSlotLabels(); writeSave();
}

// 1枚のカードの左側（サムネイル）
const charIcon = (def, mut) => `<img class="thumb" src="${charThumb(def, false, mut)}" alt="">`;
const firstEmpty = () => save.slots.findIndex(s => !s);

function renderChars() {
  const used = save.slots.filter(Boolean).length;
  document.querySelectorAll('#charPanel .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === charTab));
  $('tabInvCount').textContent = save.inventory.length;
  $('tabSlotCount').textContent = `${used}/${SLOT_COUNT}`;
  if (charTab === 'inv') { newItems = 0; renderInventory(); return; }
  renderSlots();
}

// 台座とインベントリ全体から、稼ぎの多い順に台座へ並べ直す
function equipBest() {
  const inc = x => charIncome(CHAR_BY_ID[x.id], x.star, x.mut);
  const all = [
    ...save.slots.map((s, i) => s && { s, slot: i, v: inc(s) }).filter(Boolean),
    ...save.inventory.map((x, k) => ({ s: x, inv: k, v: inc(x) })),
  ].sort((a, b) => b.v - a.v);
  const best = new Set(all.slice(0, SLOT_COUNT));
  let moved = 0;
  // 選ばれなかった台座のキャラはインベントリへ（たまったお金は回収）
  save.slots.forEach((s, i) => {
    if (!s || [...best].some(e => e.slot === i)) return;
    if (s.stored >= 1) addMoney(s.stored);
    save.inventory.push(s.mut ? { id: s.id, star: s.star, mut: s.mut } : { id: s.id, star: s.star });
    save.slots[i] = null; moved++;
  });
  // 選ばれたインベントリのキャラを空いた台座へ（稼ぎの多い順）
  const take = [...best].filter(e => e.inv !== undefined);
  const takenObjs = new Set(take.map(e => e.s));
  for (const e of take) {
    const i = firstEmpty();
    if (i < 0) break;
    save.slots[i] = e.s.mut ? { id: e.s.id, star: e.s.star, stored: 0, mut: e.s.mut } : { id: e.s.id, star: e.s.star, stored: 0 };
    moved++;
  }
  save.inventory = save.inventory.filter(x => !takenObjs.has(x));
  save.slots.forEach((_, i) => refreshSlot(i));
  if (moved) {
    play('evolve', { vol: 0.6 });
    toast(`⭐ 一番いいキャラを装備した！（毎秒 +$${fmt(totalIncome())}）`, { color: '#ffd23f', big: true, time: 2600 });
  } else toast('すでに一番いいキャラを装備しているよ', { color: '#9ad0ff' });
  highlightSlot = -1; placeSlot = -1;
  renderChars(); updateHud(); writeSave();
}
$('bestBtn').addEventListener('click', equipBest);

function renderInventory() {
  const body = $('charBody');
  if (!save.inventory.length) {
    body.innerHTML = '<p class="empty-slot">インベントリは空っぽ。ブロックを打ってキャラを持ち帰ろう！</p>';
    return;
  }
  // 同じキャラ・同じ★はまとめて表示（レア度の高い順）
  const groups = new Map();
  for (const it of save.inventory) {
    const k = it.id + ':' + it.star + ':' + (it.mut || '');
    if (!groups.has(k)) groups.set(k, { id: it.id, star: it.star, mut: it.mut || '', n: 0 });
    groups.get(k).n++;
  }
  const list = [...groups.values()].sort((a, b) => CHAR_BY_ID[b.id].r - CHAR_BY_ID[a.id].r || mutMult(b.mut) - mutMult(a.mut) || b.star - a.star || CHAR_BY_ID[b.id].mult - CHAR_BY_ID[a.id].mult);
  const target = placeSlot >= 0 && !save.slots[placeSlot] ? placeSlot : firstEmpty();
  const head = placeSlot >= 0 && !save.slots[placeSlot]
    ? `<p class="dex-sum">台座${placeSlot + 1}に置くキャラを選んでね</p>`
    : target < 0 ? '<p class="dex-sum">台座がいっぱい！ 台座のキャラを「しまう」か「売却」すると置けるよ</p>' : '';
  body.innerHTML = head + list.map(g => {
    const def = CHAR_BY_ID[g.id];
    const key = `${g.id}:${g.star}:${g.mut}`;
    return `<div class="card">${charIcon(def, g.mut)}
      <div class="info"><h3>${def.name} <span class="s" style="color:#ffd23f">${stars(g.star)}</span>${g.n > 1 ? ` <span class="cnt">×${g.n}</span>` : ''}</h3>
        ${g.mut ? `<p>${mutTag(g.mut)}</p>` : ''}
        <p>${rarityName(def.r)} ・ +${fmt(charIncome(def, g.star, g.mut))}/秒</p></div>
      <div class="btns">
        <button class="btn" data-place="${key}" ${target < 0 ? 'disabled' : ''}>${target < 0 ? '置けない' : `台座${target + 1}に置く`}</button>
        <button class="btn sell" data-isell="${key}">売却<small>$${fmt(sellPrice(def, g.star, g.mut))}</small></button>
      </div></div>`;
  }).join('');
}

function renderSlots() {
  const body = $('charBody');
  body.innerHTML = save.slots.map((s, i) => {
    if (!s) return `<div class="card"><div class="icon">⬜</div><div class="info"><h3>台座 ${i + 1}</h3><p class="empty-slot">空き</p></div>
      <div class="btns"><button class="btn" data-pick="${i}" ${save.inventory.length ? '' : 'disabled'}>キャラを置く</button></div></div>`;
    const def = CHAR_BY_ID[s.id];
    const canEvo = s.star < MAX_STAR;
    const cost = canEvo ? evolveCost(def, s.star) : 0;
    return `<div class="card" ${i === highlightSlot ? 'style="border-color:#ffd23f"' : ''} id="slotCard${i}">
      ${charIcon(def, s.mut)}
      <div class="info"><h3>${def.name} <span class="s" style="color:#ffd23f">${stars(s.star)}</span></h3>
        ${s.mut ? `<p>${mutTag(s.mut)}</p>` : ''}
        <p>${rarityName(def.r)} ・ 台座${i + 1} ・ +${fmt(charIncome(def, s.star, s.mut))}/秒</p>
        ${canEvo ? `<p>進化後: +${fmt(charIncome(def, s.star + 1, s.mut))}/秒</p>` : '<p>最大まで進化済み！</p>'}</div>
      <div class="btns">
        ${canEvo ? `<button class="btn" data-evo="${i}" ${save.money < cost ? 'disabled' : ''}>進化<small>$${fmt(cost)}</small></button>` : ''}
        <button class="btn store" data-store="${i}">しまう</button>
        <button class="btn sell" data-sell="${i}">売却<small>$${fmt(sellPrice(def, s.star, s.mut))}</small></button>
      </div></div>`;
  }).join('');
  if (highlightSlot >= 0) $('slotCard' + highlightSlot)?.scrollIntoView({ block: 'center' });
}
document.querySelectorAll('#charPanel .tab').forEach(t => t.addEventListener('click', () => {
  charTab = t.dataset.tab; placeSlot = -1; highlightSlot = -1; renderChars(); updateHud();
}));

// インベントリから台座へ置く
const sameItem = (x, id, star, mut) => x.id === id && x.star === star && (x.mut || '') === (mut || '');
function placeChar(id, star, mut, i) {
  const k = save.inventory.findIndex(x => sameItem(x, id, star, mut));
  if (k < 0 || i < 0 || save.slots[i]) return;
  save.inventory.splice(k, 1);
  const def = CHAR_BY_ID[id];
  save.slots[i] = mut ? { id, star, stored: 0, mut } : { id, star, stored: 0 };
  refreshSlot(i);
  play('safe', { vol: 0.6 });
  burst(SLOT_POS[i].clone().add(new THREE.Vector3(0, 2, 0)), RARITIES[def.r].color, 30, 10);
  toast(`🎉 ${def.name} を台座${i + 1}に置いた！`, { color: '#7dff8a', big: true, time: 2200 });
}

$('charBody').addEventListener('click', e => {
  const evo = e.target.closest('[data-evo]'), sell = e.target.closest('[data-sell]');
  const place = e.target.closest('[data-place]'), isell = e.target.closest('[data-isell]');
  const store = e.target.closest('[data-store]'), pick = e.target.closest('[data-pick]');
  if (place && !place.disabled) {
    const [id, star, mut] = place.dataset.place.split(':');
    const i = placeSlot >= 0 && !save.slots[placeSlot] ? placeSlot : firstEmpty();
    placeChar(id, +star, mut, i);
    // 台座から開いたときは置いたら閉じてゲームに戻る
    if (placeSlot >= 0) { closePanels(); lockPointer(); updateHud(); writeSave(); return; }
  } else if (isell) {
    const [id, star, mut] = isell.dataset.isell.split(':');
    const def = CHAR_BY_ID[id], price = sellPrice(def, +star, mut);
    if (!confirm(`${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name}（${stars(+star)}）を $${fmt(price)} で売却しますか？`)) return;
    const k = save.inventory.findIndex(x => sameItem(x, id, +star, mut));
    if (k < 0) return;
    save.inventory.splice(k, 1);
    addMoney(price);
    play('coin');
  } else if (store) {
    // 台座からインベントリへ戻す（たまっていたお金は回収する）
    const i = +store.dataset.store, s = save.slots[i], def = CHAR_BY_ID[s.id];
    if (s.stored >= 1) addMoney(s.stored);
    save.inventory.push(s.mut ? { id: s.id, star: s.star, mut: s.mut } : { id: s.id, star: s.star });
    save.slots[i] = null;
    refreshSlot(i);
    play('whoosh', { vol: 0.6 });
    toast(`🎒 ${def.name} をインベントリにしまった`, { color: '#9ad0ff' });
  } else if (pick && !pick.disabled) {
    charTab = 'inv'; placeSlot = +pick.dataset.pick; highlightSlot = -1;
    renderChars();
    $('charBody').scrollTop = 0;
    return;
  } else if (evo && !evo.disabled) {
    const i = +evo.dataset.evo, s = save.slots[i], def = CHAR_BY_ID[s.id];
    const cost = evolveCost(def, s.star);
    if (save.money < cost || s.star >= MAX_STAR) return;
    save.money -= cost; s.star++;
    questAdd('evolve', 1);
    refreshSlot(i);
    play('evolve');
    burst(SLOT_POS[i].clone().add(new THREE.Vector3(0, 2, 0)), 0xffd23f, 40, 12);
    toast(`✨ ${def.name} が ★${s.star} に進化！`, { color: '#ffd23f', big: true });
  } else if (sell) {
    const i = +sell.dataset.sell, s = save.slots[i], def = CHAR_BY_ID[s.id];
    if (!confirm(`${def.name}（${stars(s.star)}）を $${fmt(sellPrice(def, s.star, s.mut))} で売却しますか？`)) return;
    addMoney(sellPrice(def, s.star, s.mut) + s.stored);
    save.slots[i] = null;
    refreshSlot(i);
    play('coin');
  } else return;
  highlightSlot = -1;
  renderChars(); updateHud(); writeSave();
});

// ---------- オンラインランキング ----------
let rankGenre = 'best_distance';
let lastSent = '';
let scoreHeld = false;   // サーバーで記録が「保留」になっている
const playerName = () => save.name || window.KaAccount?.user()?.display_name || '名無し';
function myScore() {
  return {
    name: playerName(),
    bestDistance: save.stats.bestDistance, totalEarned: save.stats.totalEarned, collected: save.stats.collected,
    bestRarity: save.stats.bestRarity, income: totalIncome(), rebirths: save.rebirths,
    dexCount: CHARACTERS.filter(c => save.dex[c.id]).length,
    mutCount: Object.values(save.dex).reduce((a, e) => a + (e.muts ? Object.keys(e.muts).length : 0), 0),
  };
}
// 記録が変わったときだけ送る（失敗しても遊びは止めない）
async function sendScore(force = false) {
  const sc = myScore();
  if (!sc.collected || tamperFound) return;   // まだ1体も持ち帰っていない人・改ざんされたセーブは載せない
  const sig = JSON.stringify(sc);
  if (!force && sig === lastSent) return;
  lastSent = sig;
  try { scoreHeld = (await submitScore(save.clientId, save.token, sc)) === false; } catch (e) { lastSent = ''; }
}
const fmtVal = (g, v) => (g.money ? '$' + fmt(v) : Math.round(v).toLocaleString('ja-JP')) + (g.unit || '');
const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
async function openRanking() {
  const g = GENRES.find(x => x.col === rankGenre);
  document.querySelectorAll('#rankPanel .rank-tab').forEach(t => t.classList.toggle('active', t.dataset.col === rankGenre));
  $('rankName').textContent = playerName();
  $('rankBody').innerHTML = '<p class="dex-sum">読み込み中…</p>';
  try {
    await sendScore(true);
    const [list, me] = await Promise.all([fetchRanking(rankGenre, 50), fetchMine(rankGenre, save.clientId)]);
    if (rankGenre !== g.col || openPanel !== 'rankPanel') return;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const mine = tamperFound
      ? '<div class="rank-me held">⚠ セーブデータに不自然な変更が見つかったため、今回はランキングに送っていません</div>'
      : scoreHeld && !me
      ? '<div class="rank-me held">⚠ あなたの記録はいま「保留」中です（ふつうでは出ない数字が見つかりました）。まちがいだと思ったら管理者に伝えてね</div>'
      : me
      ? `<div class="rank-me">あなたは <b>${me.rank ?? '?'}位</b> ・ ${g.icon} ${fmtVal(g, me[g.col])}</div>`
      : '<div class="rank-me">まだ記録がありません。キャラを持ち帰ると載ります！</div>';
    const rows = list.length ? list.map((r, i) => `<div class="rank-row ${r.client_id === save.clientId ? 'me' : ''} ${i < 3 ? 'top' : ''}">
        <span class="pos">${medal(i)}</span><span class="nm">${esc(r.name)}</span><span class="val">${fmtVal(g, r[g.col])}</span>${isAdmin ? `<button class="chat-del trust-btn ${r.trusted ? 'on' : ''}" data-trust="${esc(r.client_id)}" data-hname="${esc(r.name)}" data-on="${r.trusted ? 1 : 0}" title="${r.trusted ? '信頼を外す' : '信頼するプレイヤーにする'}">${r.trusted ? '⭐' : '☆'}</button><button class="chat-del" data-hold="${esc(r.client_id)}" data-hname="${esc(r.name)}" title="不正として保留にする">🚫</button>` : ''}</div>`).join('')
      : '<p class="dex-sum">まだだれも載っていません。一番乗りのチャンス！</p>';
    $('rankBody').innerHTML = mine + rows;
  } catch (e) {
    $('rankBody').innerHTML = '<p class="dex-sum">ランキングを読み込めませんでした。通信を確認して、もう一度開いてください。</p>';
  }
}
document.querySelectorAll('#rankPanel .rank-tab').forEach(t => t.addEventListener('click', () => { rankGenre = t.dataset.col; openRanking(); }));
// 管理者: ランキングの 🚫 で、その人の記録を保留にする
$('rankBody').addEventListener('click', async e => {
  const t = e.target.closest('[data-trust]');
  if (t && isAdmin) {
    const on = t.dataset.on !== '1';
    if (!confirm(on ? `「${t.dataset.hname}」を信頼するプレイヤーにしますか？\n（リボーンや稼ぎの増え方が速くても保留になりません）` : `「${t.dataset.hname}」の信頼を外しますか？`)) return;
    try { if (await adminSetTrust(ka?.token(), t.dataset.trust, on)) { toast(on ? '⭐ 信頼するプレイヤーにしました' : '信頼を外しました', { color: '#ffd23f' }); openRanking(); } }
    catch (err) { toast('⚠ できませんでした', { color: '#ff6b6b' }); }
    return;
  }
  const b = e.target.closest('[data-hold]');
  if (!b || !isAdmin) return;
  const reason = prompt(`「${b.dataset.hname}」の記録を保留にします（ランキングから消えます）。\n理由（なくてもOK）`, '管理者が保留にしました');
  if (reason === null) return;
  try {
    if (await adminSetFlag(ka?.token(), b.dataset.hold, true, reason)) { toast('🚫 保留にしました', { color: '#ffd23f' }); openRanking(); }
    else toast('⚠ できませんでした', { color: '#ff6b6b' });
  } catch (err) { toast('⚠ できませんでした（通信を確認してね）', { color: '#ff6b6b' }); }
});
$('hudRankBtn').addEventListener('click', () => openPanelById('rankPanel'));
$('titleRankBtn').addEventListener('click', () => {
  // タイトルからはランキングだけを見る（スタートは押さない）
  document.body.classList.remove('title-mode'); $('title').classList.add('hidden');
  openPanelById('rankPanel');
  rankFromTitle = true;
});

// ---------- スキン ----------
function skinStats() {
  const muts = { gold: 0, diamond: 0, galaxy: 0 };
  for (const e of Object.values(save.dex)) for (const k of Object.keys(e.muts || {})) muts[k]++;
  return {
    collected: save.stats.collected, rebirths: save.rebirths, dist: save.stats.bestDistance, muts,
    dex: CHARACTERS.filter(c => save.dex[c.id]).length, total: CHARACTERS.length,
  };
}
const skinOpen = (k, st = skinStats()) => !k.need || k.need(st);
function skinThumb(k) {
  const key = 'skin:' + k.id;
  if (thumbCache[key]) return thumbCache[key];
  const p = buildPlayer(k);
  for (const a of p.anims) a(1.3);
  // 斜め前から（背中の飾りがあるスキンは横寄りにして見えるように）
  p.group.rotation.y = k.back ? 1.0 : 0.45;
  return snapThumb(p.group, key);
}
// 見た目を差し替える（位置・向き・持っているキャラはそのまま）
function applySkin() {
  const np = buildPlayer(SKIN_BY_ID[save.skin] || SKINS[0]);
  np.group.position.copy(player.group.position);
  np.group.rotation.copy(player.group.rotation);
  while (player.carry.children.length) np.carry.add(player.carry.children[0]);
  scene.remove(player.group);
  Object.assign(player, np);
  scene.add(player.group);
  player.hat = null;
  if (bdayOn) setPartyHat(player, true, SKIN_BY_ID[save.skin]);
}
function renderSkins() {
  const st = skinStats();
  const n = SKINS.filter(k => skinOpen(k, st)).length;
  $('skinBody').innerHTML = `<p class="dex-sum">解放したスキン ${n} / ${SKINS.length}</p><div class="skin-grid">` + SKINS.map(k => {
    const open = skinOpen(k, st), on = save.skin === k.id;
    return `<button class="skin-card ${open ? '' : 'locked'} ${on ? 'on' : ''}" data-skin="${k.id}" ${open ? '' : 'disabled'}>
      <img src="${skinThumb(k)}" alt=""><b>${k.name}</b>
      <small>${on ? '✔ 使用中' : open ? 'タップで着がえ' : '🔒 ' + k.hint}</small></button>`;
  }).join('') + '</div>';
}
$('skinBody').addEventListener('click', e => {
  const b = e.target.closest('[data-skin]');
  if (!b || b.disabled) return;
  const k = SKIN_BY_ID[b.dataset.skin];
  if (!skinOpen(k) || save.skin === k.id) return;
  save.skin = k.id;
  applySkin(); writeSave(); renderSkins();
  play('evolve', { vol: 0.6 });
  burst(pState.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffffff, 30, 10);
  toast(`👕 ${k.name} に着がえた！`, { color: '#ffd23f' });
});
$('hudSkinBtn').addEventListener('click', () => openPanelById('skinPanel'));

// ---------- デイリークエスト ----------
// 毎日（端末の日付で0時に切りかわる）3つのクエストが出る。達成すると報酬、3つ全部で変異キャラ1体のボーナス
const QUESTS = {
  launch:   { icon: '🏏', text: n => `ブロックを ${n} 回打つ`,        goal: () => 6 },
  perfect:  { icon: '🎯', text: n => `PERFECT を ${n} 回出す`,       goal: () => 3 },
  collect:  { icon: '🎒', text: n => `キャラを ${n} 体持ち帰る`,      goal: () => 4 },
  distance: { icon: '📏', text: n => `1回で ${n}m 以上飛ばす`,        goal: () => Math.max(60, Math.floor(save.stats.bestDistance * 0.8 / 10) * 10) },
  earn:     { icon: '💰', text: n => `$${fmt(n)} 稼ぐ`,               goal: () => Math.max(500, Math.round(totalIncome() * 300)) },
  dash:     { icon: '💨', text: n => `ダッシュを ${n} 回使う`,        goal: () => 15 },
  evolve:   { icon: '✨', text: n => `キャラを ${n} 回進化させる`,     goal: () => 2 },
  upgrade:  { icon: '🏋️', text: n => `ショップで ${n} 回強化する`,    goal: () => 3 },
};
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// 日付とプレイヤーで決まる乱数（同じ日は同じクエスト）
function seeded(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822519) ^ Math.imul(h ^ (h >>> 13), 3266489917)) >>> 0) / 4294967296; }
function ensureDaily() {
  const day = todayKey();
  const d = save.daily;
  if (d && d.day === day && Array.isArray(d.quests) && d.quests.length === 3 && d.quests.every(q => QUESTS[q.id])) return d;
  // 新しい日: 昨日ぜんぶクリアしていれば連続日数を伸ばす
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  const streak = d && d.lastAll === yKey ? (d.streak || 0) : d && d.lastAll === day ? (d.streak || 0) : 0;
  const rnd = seeded(day + save.clientId);
  const ids = Object.keys(QUESTS).sort(() => rnd() - 0.5).slice(0, 3);
  save.daily = { day, quests: ids.map(id => ({ id, goal: QUESTS[id].goal(), prog: 0, claimed: false })), bonus: false, streak, lastAll: d?.lastAll || '' };
  return save.daily;
}
const questDone = q => q.prog >= q.goal;
function questAdd(id, v) {
  const d = ensureDaily();
  for (const q of d.quests) {
    if (q.id !== id || questDone(q)) continue;
    q.prog = Math.min(q.goal, q.prog + v);
    if (questDone(q)) questCleared(q);
  }
  updateDailyBadge();
}
function questMax(id, v) {
  const d = ensureDaily();
  for (const q of d.quests) {
    if (q.id !== id || questDone(q)) continue;
    q.prog = Math.min(q.goal, Math.max(q.prog, v));
    if (questDone(q)) questCleared(q);
  }
  updateDailyBadge();
}
function questCleared(q) {
  setTimeout(() => toast(`📅 デイリー達成！「${QUESTS[q.id].text(q.goal)}」 報酬を受け取ろう（Qキー）`, { color: '#7dff8a', time: 3200 }), 900);
  play('safe', { vol: 0.5 });
  if (openPanel === 'dailyPanel') renderDaily();
}
const questReward = () => Math.max(300, Math.round(totalIncome() * 600));   // 1つにつき「いまの稼ぎの10分ぶん」
function updateDailyBadge() {
  const d = save.daily;
  const n = (d ? d.quests.filter(q => questDone(q) && !q.claimed).length + (d.quests.every(q => q.claimed) && !d.bonus ? 1 : 0) : 0) + (loginReady() ? 1 : 0);
  const b = $('dailyBadge');
  b.classList.toggle('hidden', !n); b.textContent = n ? String(n) : '';
}
function untilReset() {
  const t = new Date(); t.setHours(24, 0, 0, 0);
  const m = Math.max(0, Math.round((t - Date.now()) / 60000));
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}
function renderDaily() {
  const d = ensureDaily();
  const allClaimed = d.quests.every(q => q.claimed);
  $('dailyBody').innerHTML = `
    <button class="login-line ${loginReady() ? 'ready' : ''}" data-open-login>🎁 ログインボーナス ${loginReady() ? '<b>受け取れます！</b>' : `<span>ログイン ${save.login?.count || 0} 日目・受け取り済み</span>`}<em>›</em></button>
    <div class="daily-top"><span>🔄 あと <b>${untilReset()}</b> で新しいクエスト</span><span>🔥 連続 <b>${d.streak || 0}</b> 日</span></div>
    ${d.quests.map((q, i) => {
      const Q = QUESTS[q.id], done = questDone(q), pct = Math.round(q.prog / q.goal * 100);
      return `<div class="card daily ${done ? 'done' : ''} ${q.claimed ? 'claimed' : ''}">
        <div class="dq-ico">${Q.icon}</div>
        <div class="info"><h3>${Q.text(q.goal)}</h3>
          <div class="dq-bar"><i style="width:${pct}%"></i><span>${q.id === 'earn' ? '$' + fmt(q.prog) + ' / $' + fmt(q.goal) : `${Math.floor(q.prog)} / ${q.goal}`}</span></div>
          <small>報酬: 💰 $${fmt(questReward())}（いまの稼ぎの10分ぶん）</small></div>
        <div class="btns">${q.claimed ? '<span class="dq-ok">✅ 受け取り済み</span>' : `<button class="btn" data-dq="${i}" ${done ? '' : 'disabled'}>${done ? '受け取る' : '挑戦中'}</button>`}</div>
      </div>`;
    }).join('')}
    <div class="card daily bonus ${allClaimed ? 'done' : ''} ${d.bonus ? 'claimed' : ''}">
      <div class="dq-ico">🎁</div>
      <div class="info"><h3>3つ全部クリアのボーナス</h3><small>今まで持ち帰れたいちばんレアなゾーン（${RARITIES[save.stats.bestHome || 0].name}）のキャラ1体（かならず変異つき）がもらえる！ 毎日つづけると連続日数がのびます</small></div>
      <div class="btns">${d.bonus ? '<span class="dq-ok">✅ 受け取り済み</span>' : `<button class="btn" data-dq="bonus" ${allClaimed ? '' : 'disabled'}>${allClaimed ? '受け取る' : `${d.quests.filter(q => q.claimed).length}/3`}</button>`}</div>
    </div>`;
  updateDailyBadge();
}
$('dailyBody').addEventListener('click', e => {
  if (e.target.closest('[data-open-login]')) { openPanelById('loginPanel'); return; }
  const b = e.target.closest('[data-dq]');
  if (!b || b.disabled) return;
  const d = ensureDaily();
  if (b.dataset.dq === 'bonus') {
    if (d.bonus || !d.quests.every(q => q.claimed)) return;
    d.bonus = true;
    d.streak = (d.lastAll === todayKey() ? d.streak : (d.streak || 0) + 1); d.lastAll = todayKey();
    const mut = rollMutation(halloweenActive());
    const def = giveZoneChar(mut);
    play('evolve');
    toast(`🎁 ボーナス！ ${MUT_BY_ID[mut].name}変異の ${def.name}（${RARITIES[def.r].name}）をインベントリに入れた！ 🔥連続${d.streak}日`, { color: '#ffd23f', big: true, time: 4000 });
  } else {
    const q = d.quests[+b.dataset.dq];
    if (!q || q.claimed || !questDone(q)) return;
    q.claimed = true;
    const v = questReward();
    save.money += v; save.stats.totalEarned += v;   // 報酬は「稼ぐ」クエストには数えない
    play('buy');
    toast(`📅 報酬 +$${fmt(v)}`, { color: '#7dff8a', big: true });
  }
  renderDaily(); updateHud(); writeSave();
});
$('hudDailyBtn').addEventListener('click', () => openPanelById('dailyPanel'));

// ---------- ログインボーナス ----------
// 1日1回（0時に切りかわる）。7日でひとまわりして、日がたつほど豪華になる（休んでもリセットはしない）
const LOGIN_REWARDS = [
  { icon: '💰', name: '稼ぎ5分ぶん',   kind: 'money', min: 5 },
  { icon: '💪', name: '力 10分ぶん',   kind: 'strength', min: 10 },
  { icon: '💰', name: '稼ぎ15分ぶん',  kind: 'money', min: 15 },
  { icon: '💪', name: '力 30分ぶん',   kind: 'strength', min: 30 },
  { icon: '💰', name: '稼ぎ30分ぶん',  kind: 'money', min: 30 },
  { icon: '🎒', name: 'キャラ1体',     kind: 'char' },
  { icon: '🌟', name: '変異キャラ＋稼ぎ1時間ぶん', kind: 'big', min: 60 },
];
function loginReady() { return (save.login?.last || '') !== todayKey(); }   // 関数宣言（デイリーのバッジ計算から先に呼ばれるため）
const loginDayIndex = () => (save.login?.count || 0) % 7;   // 次に受け取るのが何日目か（0始まり）
const loginMoney = min => Math.max(200 * min, Math.round(totalIncome() * 60 * min));
const loginStrength = min => Math.max(50 * min, Math.round(strengthRate(save.dumbbellLv) * 60 * min));
function loginValue(r) {
  if (r.kind === 'money') return '$' + fmt(loginMoney(r.min));
  if (r.kind === 'strength') return '+' + fmt(loginStrength(r.min));
  if (r.kind === 'char') return `${RARITIES[save.stats.bestHome || 0].name}のキャラ`;
  return '変異つき＋$' + fmt(loginMoney(r.min));
}
// 今まで持ち帰れたいちばん高いレア度のキャラをインベントリに入れる（行けるだけで持ち帰れていないゾーンのキャラは出ない）
function giveZoneChar(mut = null) {
  const top = save.stats.bestHome || 0;
  let def = rollCharacter(top);
  for (let i = 0; i < 20 && def.r > top; i++) def = rollCharacter(top);   // 1つ上のレア度が出たら引き直す
  if (def.r > top) def = CHARACTERS.find(c => c.r === top && !c.lowRate) || def;
  save.inventory.push(mut ? { id: def.id, star: 1, mut } : { id: def.id, star: 1 });
  const entry = save.dex[def.id] ||= { count: 0, first: Date.now(), seen: false };
  entry.count++; if (mut) (entry.muts ||= {})[mut] = true;
  newItems++;
  return def;
}
function renderLogin() {
  const idx = loginDayIndex(), ready = loginReady();
  const cur = ready ? idx : (idx + 6) % 7;   // 今日受け取った（受け取る）日
  $('loginBody').innerHTML = `
    <p class="login-lead">${ready ? '今日のボーナスを受け取ろう！' : '今日のボーナスは受け取り済み。また明日！'}<br><small>通算ログイン <b>${save.login?.count || 0}</b> 日 ・ 7日でひとまわり（休んでもリセットされません）</small></p>
    <div class="login-grid">${LOGIN_REWARDS.map((r, i) => {
      const st = i < cur || (!ready && i === cur) ? 'got' : i === cur ? 'today' : '';
      return `<div class="login-day ${st} ${i === 6 ? 'big' : ''}"><small>${i + 1}日目</small><div class="ic">${st === 'got' ? '✅' : r.icon}</div><b>${r.name}</b><span>${loginValue(r)}</span></div>`;
    }).join('')}</div>
    <button class="btn login-claim" id="loginClaim" ${ready ? '' : 'disabled'}>${ready ? `🎁 ${cur + 1}日目のボーナスを受け取る` : `✅ 受け取り済み（あと ${untilReset()} で次のボーナス）`}</button>`;
}
$('loginBody').addEventListener('click', e => {
  if (!e.target.closest('#loginClaim') || !loginReady()) return;
  const r = LOGIN_REWARDS[loginDayIndex()];
  save.login = { last: todayKey(), count: (save.login?.count || 0) + 1 };
  let msg = '';
  if (r.kind === 'money' || r.kind === 'big') { const v = loginMoney(r.min); save.money += v; save.stats.totalEarned += v; msg = `+$${fmt(v)}`; }
  if (r.kind === 'strength') { const v = loginStrength(r.min); save.strength += v; msg = `力 +${fmt(v)}`; }
  if (r.kind === 'char' || r.kind === 'big') {
    const mut = r.kind === 'big' ? rollMutation(halloweenActive()) : null;
    const def = giveZoneChar(mut);
    msg += `${msg ? ' と ' : ''}${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name}（${RARITIES[def.r].name}）`;
  }
  play(r.kind === 'big' ? 'evolve' : 'buy');
  burst(pState.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xffd23f, 40, 12);
  toast(`🎁 ログインボーナス ${loginDayIndex() === 0 ? 7 : loginDayIndex()}日目！ ${msg}`, { color: '#ffd23f', big: true, time: 3500 });
  renderLogin(); updateHud(); updateDailyBadge(); writeSave();
});
// スタートしたとき、まだ受け取っていなければ自動で開く（ほかの画面が開いていたら少し待つ）
function maybeLoginBonus(tries = 0) {
  if (!loginReady() || !$('title').classList.contains('hidden')) return;
  if (openPanel || state !== 'free') { if (tries < 20) setTimeout(() => maybeLoginBonus(tries + 1), 3000); return; }
  openPanelById('loginPanel');
}
ensureDaily(); updateDailyBadge();

// ---------- 誕生日 ----------
// 設定で月日を決めておくと、その日は一日じゅうお祝い（とんがり帽子・拠点の飾り・花火・運×2）。プレゼントは1年に1回
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isBirthday(now = new Date()) {
  const b = save.bday;
  if (!b) return false;
  let d = b.d;
  const y = now.getFullYear();
  if (b.m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) d = 28;   // 2/29 生まれは、うるう年でなければ 2/28 にお祝い
  return now.getMonth() + 1 === b.m && now.getDate() === d;
}
function daysToBirthday() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 366; i++) { const t = new Date(now); t.setDate(now.getDate() + i); if (isBirthday(t)) return i; }
  return -1;
}
const remoteLabel = r => `<div class="n">${r.bd ? '🎂' : '👥'} ${escHtml(r.name)}</div>${r.bd ? '<div class="bd-tag">HAPPY BIRTHDAY!</div>' : ''}`;

// とんがり帽子（しま模様）
let hatTex = null;
function partyHat(sk) {
  if (!hatTex) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'), cols = ['#ff4fa3', '#ffd23f', '#4fc3ff', '#7dff8a'];
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect(0, i * 8, 64, 8); }
    hatTex = new THREE.CanvasTexture(c); hatTex.colorSpace = THREE.SRGBColorSpace;
  }
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.25, 16), new THREE.MeshLambertMaterial({ map: hatTex }));
  cone.position.y = 0.62; cone.castShadow = true; g.add(cone);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666 }));
  pom.position.y = 1.3; g.add(pom);
  // 帽子・王冠などがあるスキンは、その上にのせる
  g.position.set(0.12, sk?.hat && sk.hat !== 'headband' ? 5.55 : 5.18, 0); g.rotation.z = -0.18;
  return g;
}
function setPartyHat(p, on, sk) {
  if (p.hat) { p.group.remove(p.hat); p.hat = null; }
  if (on) { p.hat = partyHat(sk); p.group.add(p.hat); }
}

// 拠点の飾り（大きなケーキ・看板・風船）
let bdayDeco = null;
const balloons = [], candleFlames = [];
function buildBdayDeco() {
  const g = new THREE.Group();
  const cake = new THREE.Group(); cake.position.set(7, 0, -4);
  const tiers = [[2.2, 1.3, 0xffc1dc], [1.65, 1.1, 0xfffaf0], [1.1, 0.9, 0xff8fc8]];
  let y = 0;
  for (const [r, h, c] of tiers) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), mat(c)); t.position.y = y + h / 2; t.castShadow = true; cake.add(t);
    const icing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 28), mat(0xffffff)); icing.rotation.x = Math.PI / 2; icing.position.y = y + h; cake.add(icing);
    y += h;
  }
  for (let i = 0; i < 8; i++) {   // いちご
    const a = i / 8 * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xe8213a)); s.position.set(Math.cos(a) * 1.9, 1.45, Math.sin(a) * 1.9); cake.add(s);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc94a });
  for (let i = 0; i < 5; i++) {   // ろうそく
    const a = i / 5 * Math.PI * 2;
    const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), mat(FW_COLORS[i] ?? 0xffffff)); cd.position.set(Math.cos(a) * 0.6, y + 0.4, Math.sin(a) * 0.6); cake.add(cd);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 8), flameMat); f.position.set(cd.position.x, y + 0.98, cd.position.z); cake.add(f); candleFlames.push(f);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.8),
    new THREE.MeshBasicMaterial({ map: textTexture('🎂 HAPPY BIRTHDAY! 🎉', { bg: '#ff4fa3', fg: '#fff', font: 'bold 58px sans-serif' }), side: THREE.DoubleSide }));
  sign.position.set(0, y + 3.4, 0); sign.rotation.y = Math.PI; cake.add(sign);
  g.add(cake);
  // 風船
  const spots = [[-19, -3], [19, -3], [-19, -16], [19, -16], [-19, -30], [19, -30], [-19, -44], [19, -44], [4, -2], [10, -2], [-6, -27], [6, -27]];
  spots.forEach(([x, z], i) => {
    const b = new THREE.Group(); b.position.set(x, 0, z);
    const col = FW_COLORS[i % 6];
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.15 }));
    ball.scale.y = 1.18; ball.position.y = 6; b.add(ball);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 6), mat(col)); knot.position.y = 4.85; knot.rotation.x = Math.PI; b.add(knot);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.8, 4), mat(0xffffff)); str.position.y = 2.4; b.add(str);
    b.userData.ph = Math.random() * 6.28; g.add(b); balloons.push(b);
  });
  scene.add(g);
  return g;
}
let fwTimer = 3, fwQueue = [];
function bdayFireworks(n, ms) {
  for (let i = 0; i < n; i++) fwQueue.push(performance.now() + Math.random() * ms);
}
function updateBirthday(dt) {
  if (fwQueue.length) {
    const now = performance.now();
    fwQueue = fwQueue.filter(t => {
      if (t > now) return true;
      firework(pState.pos.x + (Math.random() - 0.5) * 40, Math.min(pState.pos.z, BASE_LINE) + 12 + Math.random() * 22);
      return false;
    });
  }
  if (!bdayOn || !bdayDeco) return;
  for (const b of balloons) { const p = b.userData.ph; b.position.y = Math.sin(elapsed * 1.3 + p) * 0.35; b.rotation.z = Math.sin(elapsed * 0.9 + p) * 0.08; }
  for (const f of candleFlames) f.scale.set(1, 0.85 + Math.random() * 0.35, 1);
  // 拠点にいるあいだは、ときどき花火が上がる
  if (pState.pos.z < BASE_LINE + 8 && (fwTimer -= dt) <= 0) {
    fwTimer = 5 + Math.random() * 5;
    bdayFireworks(2 + (Math.random() * 2 | 0), 1500);
  }
}

// 紙吹雪（画面の上に重ねる 2D）
const cfCanvas = $('bdayConfetti'), cfCtx = cfCanvas.getContext('2d');
const CF_COLORS = ['#ff4fa3', '#ffd23f', '#4fc3ff', '#7dff8a', '#b388ff', '#ff7043', '#ffffff'];
let cfParts = [], cfRunning = false;
function confetti(n, fromBottom = false) {
  const W = innerWidth, H = innerHeight;
  for (let i = 0; i < n; i++) {
    cfParts.push(fromBottom
      ? { x: W / 2 + (Math.random() - 0.5) * W * 0.25, y: H * 0.7, vx: (Math.random() - 0.5) * 22, vy: -(12 + Math.random() * 16) }
      : { x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3 });
    Object.assign(cfParts[cfParts.length - 1], { w: 7 + Math.random() * 7, h: 10 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, flip: Math.random() * 6, c: CF_COLORS[Math.random() * CF_COLORS.length | 0] });
  }
  if (cfParts.length > 900) cfParts.splice(0, cfParts.length - 900);
  if (!cfRunning) { cfRunning = true; cfCanvas.classList.remove('hidden'); requestAnimationFrame(cfLoop); }
}
function cfLoop() {
  const W = innerWidth, H = innerHeight;
  if (cfCanvas.width !== W || cfCanvas.height !== H) { cfCanvas.width = W; cfCanvas.height = H; }
  cfCtx.clearRect(0, 0, W, H);
  for (const p of cfParts) {
    p.vy = Math.min(p.vy + 0.35, 4.5); p.vx *= 0.985;
    p.flip += 0.12; p.rot += p.vr;
    p.x += p.vx + Math.sin(p.flip) * 0.8; p.y += p.vy;
    cfCtx.save(); cfCtx.translate(p.x, p.y); cfCtx.rotate(p.rot); cfCtx.scale(1, Math.cos(p.flip));
    cfCtx.fillStyle = p.c; cfCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cfCtx.restore();
  }
  cfParts = cfParts.filter(p => p.y < H + 30);
  if (cfParts.length) requestAnimationFrame(cfLoop);
  else { cfRunning = false; cfCtx.clearRect(0, 0, W, H); cfCanvas.classList.add('hidden'); }
}

// ハッピーバースデーのメロディ（作者不明の古い曲）
const HB_TUNE = [[67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2], [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
  [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2], [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 3]];

// お祝いの画面
let bdayBlown = false, bdayGiftHtml = '';
const thisYear = () => new Date().getFullYear();
function openBirthday() {
  bdayBlown = false;
  openPanelById('bdayPanel');
  playTune(HB_TUNE, 132);
  confetti(160);
}
function renderBday() {
  const got = save.bdayYear === thisYear();
  const hb = [...'HAPPY BIRTHDAY'].map((c, i) => c === ' ' ? '<i class="sp"></i>' : `<span style="--i:${i}">${c}</span>`).join('');
  $('bdayBody').innerHTML = `
    <div class="bd-hb">${hb}</div>
    <p class="bd-to"><b>${escHtml(playerName())}</b> さん、お誕生日おめでとう！ 🎉</p>
    <div class="bd-cake ${bdayBlown ? 'blown' : ''}"><div class="bd-candles">${'<i><b></b></i>'.repeat(5)}</div><div class="bd-emoji">🎂</div></div>
    ${bdayBlown
      ? (bdayGiftHtml ? `<div class="bd-gifts"><h3>🎁 誕生日プレゼント</h3>${bdayGiftHtml}</div>` : '<p class="bd-hint">🎁 今年のプレゼントは受け取り済み（1年に1回）。今日は一日じゅう 🍀運×2！</p>')
      : `<p class="bd-hint">${got ? 'ろうそくを吹き消してね！' : 'ろうそくを吹き消すと、プレゼントがもらえるよ！'}</p>`}
    <button class="btn bd-btn" id="bdBlow">${bdayBlown ? '🎉 ありがとう！' : '🌬️ ろうそくを吹き消す'}</button>`;
}
$('bdayBody').addEventListener('click', e => {
  if (!e.target.closest('#bdBlow')) return;
  if (bdayBlown) { closePanels(); lockPointer(); return; }
  bdayBlown = true;
  play('evolve');
  confetti(260, true); setTimeout(() => confetti(200), 600);
  bdayFireworks(24, 9000);
  if (save.bdayYear !== thisYear() && bdayOn) {
    save.bdayYear = thisYear();
    const v = loginMoney(180), st = loginStrength(60);
    save.money += v; save.stats.totalEarned += v; save.strength += st;
    const def = giveZoneChar('galaxy');
    bdayGiftHtml = `<div class="bd-gift"><span>🌌</span><b>ギャラクシー変異の ${escHtml(def.name)}</b><small>${RARITIES[def.r].name}・稼ぎ ×5（インベントリへ）</small></div>
      <div class="bd-gift"><span>💰</span><b>$${fmt(v)}</b><small>稼ぎ3時間ぶん</small></div>
      <div class="bd-gift"><span>💪</span><b>力 +${fmt(st)}</b><small>1時間ぶん</small></div>
      <div class="bd-gift"><span>🍀</span><b>運アップ ×2</b><small>今日は一日じゅう</small></div>`;
    toast('🎁 誕生日プレゼントを受け取った！', { color: '#ff8fd0', big: true, time: 3500 });
    updateHud(); writeSave();
  }
  renderBday();
});
// スタートしたときのお祝い（今年まだなら画面を開く。もう開いていたら花火だけ）
function maybeBirthday(tries = 0) {
  if (!bdayOn || !$('title').classList.contains('hidden')) return;
  if (save.bdayYear === thisYear()) {
    toast('🎂 お誕生日おめでとう！ 今日は一日じゅう 🍀運×2', { color: '#ff8fd0', big: true, time: 4000 });
    confetti(140); bdayFireworks(8, 4000);
    return;
  }
  if (openPanel || state !== 'free') { if (tries < 20) setTimeout(() => maybeBirthday(tries + 1), 3000); return; }
  openBirthday();
}
// 誕生日になった・終わった（0時をまたいだとき・設定を変えたとき）
function checkBirthday() {
  const on = isBirthday();
  if (on === bdayOn) return;
  bdayOn = on;
  setPartyHat(player, on, SKIN_BY_ID[save.skin]);
  if (on && !bdayDeco) bdayDeco = buildBdayDeco();
  if (bdayDeco) bdayDeco.visible = on;
  $('titleBday').classList.toggle('hidden', !on);
}
checkBirthday();
setInterval(() => {
  const was = bdayOn;
  checkBirthday();
  if (!was && bdayOn) maybeBirthday();   // 遊んでいるうちに誕生日になった
}, 60000);

// 設定の誕生日の欄
const bdM = $('bdayM'), bdD = $('bdayD');
bdM.innerHTML = '<option value="">--</option>' + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
function fillBdayDays() {
  const n = DAYS_IN_MONTH[(+bdM.value || 1) - 1], cur = +bdD.value;
  bdD.innerHTML = '<option value="">--</option>' + Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  if (cur && cur <= n) bdD.value = String(cur);
}
function renderBdayField() {
  // 月だけ選んだ途中のときは、選んだものを消さない（セーブに入るのは月と日の両方がそろってから）
  const partial = !save.bday && (bdM.value || bdD.value);
  if (!partial) {
    bdM.value = save.bday ? String(save.bday.m) : '';
    fillBdayDays();
    bdD.value = save.bday ? String(save.bday.d) : '';
  }
  const left = save.bday ? daysToBirthday() : -1;
  $('bdayNote').textContent = partial ? (bdM.value ? '日も選んでね' : '月も選んでね') : !save.bday ? '月と日を選ぶと、誕生日にお祝いとプレゼントがあります（プレゼントは1年に1回）'
    : bdayOn ? '🎂 今日が誕生日！ おめでとう！' : `次の誕生日まで あと ${left} 日`;
  $('bdayAgain').hidden = !bdayOn;
}
function onBdayChange() {
  fillBdayDays();
  const m = +bdM.value, d = +bdD.value;
  if (m && d) save.bday = { m, d }; else delete save.bday;
  writeSave();
  const was = bdayOn;
  checkBirthday();
  renderBdayField();
  if (!was && bdayOn && save.bdayYear !== thisYear()) openBirthday();   // 今日を選んだら、その場でお祝い
}
bdM.addEventListener('change', onBdayChange);
bdD.addEventListener('change', onBdayChange);
$('bdayAgain').addEventListener('click', openBirthday);

// 日付が変わったら新しいクエストに
setInterval(() => { if (save.daily?.day !== todayKey()) { ensureDaily(); updateDailyBadge(); if (openPanel === 'dailyPanel') renderDaily(); } }, 60000);

// ---------- インデックス（一度持ち帰ったキャラの図鑑） ----------
let thumb = null;
const thumbCache = {};
function ensureThumb() {
  if (!thumb) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(192, 192);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(3, 6, 5); sc.add(d);
    thumb = { r, sc, cam: new THREE.PerspectiveCamera(35, 1, 0.1, 50), black: new THREE.MeshBasicMaterial({ color: 0x0c0c16 }) };
  }
}
function charThumb(def, locked, mut = null) {
  const key = def.id + (locked ? ':l' : '') + (mut ? ':' + mut : '');
  if (thumbCache[key]) return thumbCache[key];
  const m = buildCharacter(def, locked ? null : mut);
  for (const a of m.userData.anims) a(1.3);
  if (locked) m.traverse(o => { if (o.isMesh && o.material.transparent) o.visible = false; });
  return snapThumb(m, key, locked);
}
// 3Dモデルを1枚の絵にする（キャラ・スキン共通）
function snapThumb(m, key, locked = false) {
  ensureThumb();
  thumb.sc.add(m);
  thumb.sc.overrideMaterial = locked ? thumb.black : null;
  // オーラなどの半透明部分を除いた大きさに合わせてカメラを引く
  const box = new THREE.Box3();
  m.updateMatrixWorld(true);
  m.traverse(o => { if (o.isMesh && !o.material.transparent) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const dist = Math.max(sz.y, Math.max(sz.x, sz.z) * 0.9, 2.4) / (2 * Math.tan(THREE.MathUtils.degToRad(17.5))) * 1.15 + 1;
  thumb.cam.position.set(c.x + dist * 0.36, c.y + dist * 0.18, c.z + dist * 0.92);
  thumb.cam.lookAt(c);
  thumb.r.render(thumb.sc, thumb.cam);
  thumbCache[key] = thumb.r.domElement.toDataURL();
  thumb.sc.remove(m);
  return thumbCache[key];
}

const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
// インデックスのタブ: '' = 通常、ほかは変異の種類
let idxTab = '';
const IDX_UNLOCK = 0.75;   // この割合を集めると拠点の色を選べる
const hasInDex = (c, m) => (m ? !!save.dex[c.id]?.muts?.[m] : !!save.dex[c.id]);
function dexRate(m) { return CHARACTERS.filter(c => hasInDex(c, m)).length / CHARACTERS.length; }
document.querySelectorAll('#indexPanel .tab').forEach(t => t.addEventListener('click', () => { idxTab = t.dataset.mut; renderIndex(); $('indexBody').scrollTop = 0; }));
$('indexBody').addEventListener('click', e => {
  const b = e.target.closest('[data-theme]');
  if (!b || b.disabled) return;
  save.baseTheme = b.dataset.theme;
  applyBaseTheme(); writeSave(); play('evolve', { vol: 0.6 });
  toast(save.baseTheme ? `🏠 拠点の色を${MUT_BY_ID[save.baseTheme].name}にした！` : '🏠 拠点の色をいつもの色に戻した', { color: '#ffd23f', big: true });
  renderIndex();
});

function renderIndex() {
  const m = idxTab;
  document.querySelectorAll('#indexPanel .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mut === m);
    t.querySelector('b').textContent = `${Math.floor(dexRate(t.dataset.mut) * 100)}%`;
  });
  const got = CHARACTERS.filter(c => hasInDex(c, m)).length;
  let html = `<div class="idx-total"><span class="num">${m ? mutTag(m) : ''} ${got} / ${CHARACTERS.length}</span>
    <div class="progress"><div style="width:${got / CHARACTERS.length * 100}%"></div></div>
    <span>${Math.floor(got / CHARACTERS.length * 100)}%</span></div>`;
  // 変異のタブ: 75%で拠点の色を解放
  if (m) {
    const need = Math.ceil(CHARACTERS.length * IDX_UNLOCK);
    const open = got >= need, using = save.baseTheme === m;
    html += `<div class="card theme-card mut-${m}-card"><div class="icon">🏠</div><div class="info">
      <h3>拠点の色: ${MUT_BY_ID[m].name}</h3>
      <p>${open ? (using ? '使用中！' : '解放済み！ 拠点の地面をこの色にできるよ') : `${MUT_BY_ID[m].name}変異を ${need}体（75%）集めると解放（あと${need - got}体）`}</p></div>
      <div class="btns">${using
        ? '<button class="btn store" data-theme="">いつもの色に戻す</button>'
        : `<button class="btn" data-theme="${m}" ${open ? '' : 'disabled'}>${open ? 'この色にする' : '🔒 未解放'}</button>`}</div></div>`;
  } else if (save.baseTheme) {
    html += `<div class="card theme-card"><div class="icon">🏠</div><div class="info"><h3>拠点の色: ${MUT_BY_ID[save.baseTheme].name}</h3><p>変異のタブで集めると、ほかの色も選べるよ</p></div>
      <div class="btns"><button class="btn store" data-theme="">いつもの色に戻す</button></div></div>`;
  } else {
    html += `<p class="dex-sum">💡 変異のタブでその変異のキャラを75%集めると、拠点の色を変えられるよ</p>`;
  }
  RARITIES.forEach((rar, r) => {
    const pool = CHARACTERS.filter(c => c.r === r);
    const n = pool.filter(c => hasInDex(c, m)).length;
    const rc = rarCss(r);
    html += `<div class="idx-sec"><h3>${rarityName(r)}<span class="cnt ${n === pool.length ? 'done' : ''}">${n === pool.length ? '👑 コンプリート ' : ''}${n} / ${pool.length}</span></h3><div class="idx-grid">`;
    for (const c of pool) {
      const e = save.dex[c.id];
      if (m) {
        // 変異のタブ: その変異で手に入れたキャラだけ表示
        html += hasInDex(c, m)
          ? `<div class="idx-card" style="--rc:${rc}"><img src="${charThumb(c, false, m)}" alt=""><b>${c.name}</b>
              <div class="inc">+${fmt(charIncome(c, 1, m))}/秒</div><div class="meta">${mutTag(m)}</div></div>`
          : `<div class="idx-card locked"><img src="${charThumb(c, true)}" alt=""><b>${e ? c.name : '？？？'}</b>
              <div class="meta">${e ? `${MUT_BY_ID[m].name}変異はまだ` : c.lowRate ? `${ZONES[r].name}ゾーンで ごくまれに出現（1%）` : `${ZONES[r].name}ゾーン付近で出現`}</div></div>`;
        continue;
      }
      html += e
        ? `<div class="idx-card" style="--rc:${rc}">${e.seen ? '' : '<span class="new">NEW</span>'}
            <img src="${charThumb(c, false)}" alt=""><b>${c.name}</b>
            <div class="inc">+${fmt(charIncome(c))}/秒</div>
            <div class="meta">獲得 ${e.count}回${e.first ? ` ・ ${fmtDate(e.first)}` : ''}</div>
            ${e.muts ? `<div class="meta muts">${Object.keys(e.muts).map(mutTag).join('')}</div>` : ''}</div>`
        : `<div class="idx-card locked"><img src="${charThumb(c, true)}" alt=""><b>？？？</b>
            <div class="meta">${c.lowRate ? `${ZONES[r].name}ゾーンで ごくまれに出現（1%）` : `${ZONES[r].name}ゾーン付近で出現`}</div></div>`;
    }
    html += '</div></div>';
  });
  $('indexBody').innerHTML = html;
  // 開いたら既読にする
  let changed = false;
  for (const e of Object.values(save.dex)) if (!e.seen) { e.seen = true; changed = true; }
  if (changed) writeSave();
}

$('nameInput').addEventListener('input', e => { save.name = e.target.value.slice(0, 16); writeSave(); });
$('volInput').addEventListener('input', e => { save.volume = +e.target.value; setVolume(save.volume); writeSave(); });
$('resetBtn').addEventListener('click', async () => {
  if (!confirm('セーブデータをすべて消去します。よろしいですか？' + (window.KaAccount?.isLoggedIn() ? '\n（クラウドのセーブも最初からになります）' : '') + '\n\n※ 消す前のデータはバックアップに残るので、設定の「バックアップから復元」で戻せます')) return;
  await backupNow(true);
  removeEventListener('beforeunload', writeSave);
  if (window.KaAccount?.isLoggedIn()) {
    // 消すだけだとクラウドから復元されるので、初期データで上書きしてから送る
    const keep = { clientId: save.clientId, token: save.token };
    save = Object.assign(defaultSave(), keep);
    writeSave();
    try { await window.KaAccount.saveNow(); } catch (e) { /* 通信失敗時は次回の自動同期に任せる */ }
  } else {
    localStorage.removeItem(SAVE_KEY);
  }
  noSave = true;
  location.reload();
});

// ---------- 同時接続数（Supabaseの節約のため、見えている間だけ2分ごとに1回） ----------
let lastPing = 0;
async function pingOnline() {
  if (document.hidden) return;
  lastPing = Date.now();
  try {
    const r = await ping2(save.clientId);
    const n = r?.online;
    if (!Number.isFinite(n)) return;
    chatLatest = Math.max(chatLatest, r.chat || 0);
    if (!hasChatRead() && chatLatest) setChatRead(chatLatest);   // はじめての人は、これまでの発言を既読あつかいに
    updateChatBadge();
    $('onlineNum').textContent = n;
    $('onlineChip').classList.remove('hidden');
    $('titleOnline').innerHTML = `<i></i>いま <b>${n}</b> 人が遊んでいます`;
    $('titleOnline').classList.remove('hidden');
  } catch (e) { /* 表示しないだけ */ }
}
setInterval(pingOnline, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastPing > 60000) pingOnline(); });
pingOnline();

// ---------- グローバルチャット（開いている間だけ4秒ごとに読み込む） ----------
let chatLatest = 0, chatLastId = 0, chatTimer = null;
const baseTitle = document.title;
const chatRead = () => { try { return +localStorage.getItem('llb_chat_read') || 0; } catch (e) { return 0; } };
const hasChatRead = () => { try { return localStorage.getItem('llb_chat_read') !== null; } catch (e) { return true; } };
const setChatRead = id => { try { localStorage.setItem('llb_chat_read', String(id)); } catch (e) { /* 保存不可 */ } };
const myChatIds = new Set();
// 未読の数を赤い丸の中に出す（①②…、10件以上は 9+）
function setBadge(el, n) {
  el.classList.toggle('hidden', !n);
  el.textContent = n > 9 ? '9+' : n ? String(n) : '';
}
function updateChatBadge() {
  const viewingAll = openPanel === 'chatPanel' && chatTab === 'all';
  const unread = viewingAll ? 0 : Math.max(0, chatLatest - chatRead());
  setBadge($('chatBadge'), unread + partyUnread);
  setBadge($('allBadge'), unread);
  setBadge($('partyBadge'), partyUnread);
  document.title = (unread + partyUnread ? `(${unread + partyUnread > 9 ? '9+' : unread + partyUnread}) ` : '') + baseTitle;
}
function chatRow(m) {
  const d = new Date(m.created_at);
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `<div class="chat-msg ${myChatIds.has(m.id) ? 'me' : ''} ${m.is_admin ? 'admin' : ''}" data-cid="${m.id}">
    <div class="chat-head"><b>${escHtml(m.name)}</b>${m.is_admin ? '<span class="chat-tag adm">🛠 管理者</span>' : m.verified ? '<span class="chat-tag ok">✔</span>' : ''}
    <small>${t}</small>${isAdmin ? `<button class="chat-del" data-cdel="${m.id}" title="この発言を消す">🗑</button>` : ''}</div>
    <p>${escHtml(m.body)}</p></div>`;
}
async function loadChat(first = false) {
  try {
    if (chatTab !== 'all') return;
    const list = await fetchChat(first ? 0 : chatLastId, 50);
    if (openPanel !== 'chatPanel' || chatTab !== 'all') return;
    const box = $('chatList');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    if (first) box.innerHTML = list.length ? '' : '<p class="dex-sum chat-empty">まだ発言がありません。最初のひとことをどうぞ！</p>';
    if (list.length) {
      box.querySelector('.chat-empty')?.remove();
      box.insertAdjacentHTML('beforeend', list.map(chatRow).join(''));
      chatLastId = list[list.length - 1].id;
      chatLatest = Math.max(chatLatest, chatLastId);
      setChatRead(chatLatest);
      if (first || atBottom) box.scrollTop = box.scrollHeight;
    }
    $('chatStatus').textContent = '';
  } catch (e) { $('chatStatus').textContent = '⚠ 読み込めませんでした（通信を確認してね）'; }
}
function openChat() {
  if (net.connected && partyUnread) chatTab = 'party';   // マルチの新しい発言があればそちらを開く
  setChatTab(chatTab);
  chatLastId = 0;
  $('chatList').innerHTML = '<p class="dex-sum">読み込み中…</p>';
  $('chatName').textContent = window.KaAccount?.user()?.display_name || save.name || '名無し';
  loadChat(true);
  clearInterval(chatTimer);
  chatTimer = setInterval(() => {
    if (openPanel !== 'chatPanel') { clearInterval(chatTimer); chatTimer = null; return; }
    if (!document.hidden) loadChat();
  }, 4000);
  updateChatBadge();
  setTimeout(() => $('chatInput').focus(), 50);
}
$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('chatInput').value.trim();
  if (!body) return;
  if (chatTab === 'party') { sendParty(body); return; }
  $('chatSend').disabled = true;
  try {
    const r = await postChat(save.clientId, save.name, body, window.KaAccount?.token());
    if (r?.ok) { myChatIds.add(r.id); $('chatInput').value = ''; await loadChat(); $('chatList').scrollTop = $('chatList').scrollHeight; }
    else $('chatStatus').textContent = { slow: '⚠ 少し待ってから送ってね（3秒に1回・1分に8回まで）', busy: '⚠ いまチャットが混んでいます。少し待ってね', body: '⚠ 1〜100文字で入力してね' }[r?.reason] || '⚠ 送れませんでした';
  } catch (err) { $('chatStatus').textContent = '⚠ 送れませんでした（通信を確認してね）'; }
  $('chatSend').disabled = false;
  $('chatInput').focus();
});
$('chatList').addEventListener('click', async e => {
  const b = e.target.closest('[data-cdel]');
  if (!b || !isAdmin || !confirm('この発言を消しますか？')) return;
  try { if (await deleteChat(window.KaAccount?.token(), +b.dataset.cdel)) b.closest('.chat-msg').remove(); } catch (err) { /* 消せなかった */ }
});
$('hudChatBtn').addEventListener('click', () => openPanelById('chatPanel'));

// ---- マルチ専用チャット（一緒に遊んでいる人だけ。WebRTC で直接送るので Supabase は使わない） ----
let chatTab = 'all', partyUnread = 0, partyLastSent = 0;
const partyLog = [];   // { name, text, me, sys, time }
function partyRow(m) {
  if (m.sys) return `<div class="chat-sys">${escHtml(m.text)}</div>`;
  const t = new Date(m.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `<div class="chat-msg party ${m.me ? 'me' : ''}"><div class="chat-head"><b>${escHtml(m.name)}</b><small>${t}</small></div><p>${escHtml(m.text)}</p></div>`;
}
function renderParty() {
  const box = $('partyList');
  const n = remotes.size;
  $('partyCount').textContent = net.connected ? String(n + 1) + '人' : '';
  if (!partyLog.length) {
    box.innerHTML = `<p class="dex-sum chat-empty">${net.connected ? 'まだ発言がありません。一緒に遊んでいる人にあいさつしよう！' : '👥 フレンドと一緒に遊んでいるときに使えます。<br>フレンド画面（9キー）から一緒に遊ぼう！'}</p>`;
    return;
  }
  box.innerHTML = partyLog.map(partyRow).join('');
  box.scrollTop = box.scrollHeight;
}
function setChatTab(tab) {
  chatTab = tab;
  document.querySelectorAll('#chatPanel .chat-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.ctab === tab));
  const party = tab === 'party';
  $('chatList').classList.toggle('hidden', party); $('chatNote').classList.toggle('hidden', party);
  $('partyList').classList.toggle('hidden', !party); $('partyNote').classList.toggle('hidden', !party);
  $('chatInput').placeholder = party ? '一緒に遊んでいる人へのメッセージ（100文字まで）' : 'メッセージ（100文字まで）';
  $('chatStatus').textContent = '';
  if (party) { partyUnread = 0; renderParty(); }
  updateChatBadge();
}
document.querySelectorAll('#chatPanel .chat-tabs .tab').forEach(t => t.addEventListener('click', () => {
  if (t.dataset.ctab === chatTab) return;
  setChatTab(t.dataset.ctab);
  if (chatTab === 'all') { chatLastId = 0; $('chatList').innerHTML = '<p class="dex-sum">読み込み中…</p>'; loadChat(true); }
  $('chatInput').focus();
}));
function pushParty(m) {
  partyLog.push({ time: Date.now(), ...m });
  if (partyLog.length > 100) partyLog.shift();
  if (openPanel === 'chatPanel' && chatTab === 'party') renderParty();
  else if (!m.me && !m.sys) partyUnread++;
  updateChatBadge();
}
function sendParty(text) {
  if (!net.connected) { $('chatStatus').textContent = '⚠ いまは誰ともつながっていません（フレンド画面から一緒に遊ぼう）'; return; }
  if (Date.now() - partyLastSent < 1000) { $('chatStatus').textContent = '⚠ 少し待ってから送ってね'; return; }
  partyLastSent = Date.now();
  text = text.slice(0, 100);
  net.send({ t: 'pc', u: meName(), n: playerName(), text });
  pushParty({ name: playerName(), text, me: true });
  $('chatInput').value = ''; $('chatStatus').textContent = '';
  $('chatInput').focus();
}
// 相手の頭の上に、ふきだしで少しのあいだ表示する
function showSay(u, name, text) {
  const r = remotes.get(u);
  if (!r) return;
  setLabel(r.label, `<div class="n">${r.bd ? '🎂' : '👥'} ${escHtml(name)}</div><div class="say">${escHtml(text)}</div>`);
  clearTimeout(r.sayTimer);
  r.sayTimer = setTimeout(() => { r.sayTimer = null; setLabel(r.label, remoteLabel(r)); }, 6000);
}

// ---------- 取引（一緒に遊んでいるフレンドとキャラを交換。WebRTC で直接やりとり） ----------
// 流れ: 申し込み → 承認 → おたがいにインベントリから出すキャラを選ぶ → 2人とも「OK」→ 2人とも「取引する」で交換
const TRADE_MAX = 6;
let trade = null;   // { tid, partner, pname, phase: 'asking'|'asked'|'open', mine:[], theirs:[], myOk, theirOk, myGo, theirGo }
const itemKey = it => `${it.id}:${it.star}:${it.mut || ''}`;
const itemsSig = list => list.map(itemKey).sort().join(',');
const peerName = u => remotes.get(u)?.name || u;
function sendTrade(op, extra = {}) { if (trade) net.send({ t: 'tr', u: meName(), n: playerName(), to: trade.partner, tid: trade.tid, op, ...extra }); }
function cleanItems(list) {   // 相手から届いたキャラを確かめる
  if (!Array.isArray(list)) return [];
  return list.slice(0, TRADE_MAX).filter(it => it && CHAR_BY_ID[it.id]).map(it => {
    const o = { id: it.id, star: Math.min(MAX_STAR, Math.max(1, Math.floor(+it.star) || 1)) };
    if (MUT_BY_ID[it.mut]) o.mut = it.mut;
    return o;
  });
}
// 出そうとしているキャラが、まだインベントリにあるか
function haveItems(list) {
  const cnt = new Map();
  for (const it of save.inventory) cnt.set(itemKey(it), (cnt.get(itemKey(it)) || 0) + 1);
  for (const it of list) { const k = itemKey(it), n = cnt.get(k) || 0; if (!n) return false; cnt.set(k, n - 1); }
  return true;
}
function updateTradeBtn() {
  $('hudTradeBtn').classList.toggle('hidden', !net.connected && !trade);
  $('tradeBadge').classList.toggle('hidden', !(trade && trade.phase === 'asked'));
  $('tradeBadge').textContent = trade && trade.phase === 'asked' ? '!' : '';
}
function endTrade(msg, color = '#9ad0ff') {
  trade = null;
  if (msg) toast(`🤝 ${escHtml(msg)}`, { color, time: 3500 });
  updateTradeBtn();
  if (openPanel === 'tradePanel') renderTrade();
}
function requestTrade(u) {
  if (trade) return;
  trade = { tid: Math.random().toString(36).slice(2, 10), partner: u, pname: peerName(u), phase: 'asking', mine: [], theirs: [] };
  sendTrade('req');
  setTimeout(() => { if (trade && trade.phase === 'asking' && trade.partner === u) { sendTrade('cancel'); endTrade('返事がなかったので、取引の申し込みをやめました'); } }, 30000);
  renderTrade(); updateTradeBtn();
}
function resetOk() { if (trade) { trade.myOk = trade.theirOk = trade.myGo = trade.theirGo = false; } }
function onTradeMsg(m) {
  const from = m.u;
  if (m.op === 'req') {
    if (trade) { net.send({ t: 'tr', u: meName(), n: playerName(), to: from, tid: m.tid, op: 'busy' }); return; }
    trade = { tid: String(m.tid).slice(0, 12), partner: from, pname: String(m.n || from).slice(0, 16), phase: 'asked', mine: [], theirs: [] };
    play('reveal', { vol: 0.5 });
    toast(`🤝 ${escHtml(trade.pname)} から取引の申し込み！ <small>（右の 🤝 取引 から）</small>`, { color: '#ffd23f', big: true, time: 5000 });
    updateTradeBtn();
    if (openPanel === 'tradePanel' || openPanel === 'friendPanel') openPanelById('tradePanel');
    return;
  }
  if (!trade || trade.partner !== from || trade.tid !== m.tid) return;
  if (m.op === 'busy') return endTrade(`${trade.pname} はいま別の取引中です`);
  if (m.op === 'cancel') return endTrade(`${trade.pname} が取引をやめました`);
  if (m.op === 'acc' && trade.phase === 'asking') { trade.phase = 'open'; toast(`🤝 ${escHtml(trade.pname)} が取引を承認しました！ 出すキャラを選ぼう`, { color: '#7dff8a' }); }
  else if (m.op === 'offer' && trade.phase === 'open') { trade.theirs = cleanItems(m.items); resetOk(); }
  else if (m.op === 'ok' && trade.phase === 'open') {
    // 相手から見た「自分が出す・相手が出す」が、こちらの見え方と同じときだけ OK とみなす
    trade.theirOk = !!m.on && m.mine === itemsSig(trade.theirs) && m.theirs === itemsSig(trade.mine);
    if (!m.on) trade.myGo = trade.theirGo = false;
  } else if (m.op === 'go' && trade.phase === 'open') {
    if (m.mine !== itemsSig(trade.theirs) || m.theirs !== itemsSig(trade.mine)) return;
    trade.theirGo = true;
    if (trade.myGo) return doTrade();
  }
  updateTradeBtn();
  if (openPanel === 'tradePanel') renderTrade();
}
// 交換する（2人とも「取引する」を押したとき、それぞれの端末で行う）
function doTrade() {
  const t = trade;
  if (!haveItems(t.mine)) { sendTrade('cancel'); return endTrade('出すキャラがインベントリにないので、取引をやめました', '#ff6b6b'); }
  for (const it of t.mine) {
    const i = save.inventory.findIndex(x => itemKey(x) === itemKey(it));
    if (i >= 0) save.inventory.splice(i, 1);
  }
  for (const it of t.theirs) {
    save.inventory.push(it.mut ? { id: it.id, star: it.star, mut: it.mut } : { id: it.id, star: it.star });
    const entry = save.dex[it.id] ||= { count: 0, first: Date.now(), seen: false };
    entry.count++; if (it.mut) (entry.muts ||= {})[it.mut] = true;
    newItems++;
  }
  play('evolve');
  burst(pState.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0x7dff8a, 40, 12);
  const got = t.theirs.map(it => CHAR_BY_ID[it.id].name).join('・') || 'なし';
  pushParty({ sys: true, text: `🤝 ${t.pname} と取引しました` });
  trade = null;
  writeSave(); updateHud(); updateTradeBtn();
  toast(`🤝 取引成立！ もらったキャラ: ${escHtml(got)}`, { color: '#7dff8a', big: true, time: 4000 });
  if (openPanel === 'tradePanel') renderTrade();
}
const tradeTile = (it, attr = '') => {
  const def = CHAR_BY_ID[it.id];
  return `<div class="tr-item" ${attr}>${charIcon(def, it.mut)}<b>${def.name}</b><small>${stars(it.star)}${it.mut ? ' ' + MUT_BY_ID[it.mut].name : ''}</small><small class="rar">${rarityName(def.r)}</small></div>`;
};
function renderTrade() {
  const body = $('tradeBody');
  if (!trade) {
    const list = [...remotes.entries()];
    body.innerHTML = `<p class="dex-sum">一緒に遊んでいるフレンドと、インベントリのキャラを交換できます（1回に${TRADE_MAX}体まで）。台座に置いているキャラは出せません。</p>` + (net.connected && list.length
      ? list.map(([u, r]) => `<div class="fr-row"><span class="av">👥</span><div><b>${escHtml(r.name || u)}</b><small>@${escHtml(u)}</small></div><button class="btn" data-tr-req="${escHtml(u)}">取引を申し込む</button></div>`).join('')
      : '<div class="rank-me">いまは誰ともつながっていません。フレンド画面（9キー）から一緒に遊ぶと取引できます。</div>');
    return;
  }
  if (trade.phase === 'asking') {
    body.innerHTML = `<div class="tr-wait">⏳ <b>${escHtml(trade.pname)}</b> の返事を待っています…</div><button class="btn sell tr-wide" data-tr="cancel">やめる</button>`;
    return;
  }
  if (trade.phase === 'asked') {
    body.innerHTML = `<div class="tr-wait">🤝 <b>${escHtml(trade.pname)}</b> から取引の申し込みがきています！</div>
      <div class="tr-btns"><button class="btn" data-tr="accept">承認する</button><button class="btn sell" data-tr="decline">断る</button></div>`;
    return;
  }
  // 取引中
  const both = trade.myOk && trade.theirOk;
  const used = new Map();
  for (const it of trade.mine) used.set(itemKey(it), (used.get(itemKey(it)) || 0) + 1);
  const groups = new Map();
  for (const it of save.inventory) { const k = itemKey(it); if (!groups.has(k)) groups.set(k, { it, n: 0 }); groups.get(k).n++; }
  const pick = [...groups.entries()].map(([k, g]) => ({ k, it: g.it, left: g.n - (used.get(k) || 0) })).filter(g => g.left > 0)
    .sort((a, b) => CHAR_BY_ID[b.it.id].r - CHAR_BY_ID[a.it.id].r || b.it.star - a.it.star);
  const status = trade.myGo ? `⏳ ${escHtml(trade.pname)} が「取引する」を押すのを待っています…`
    : both ? '✅ 2人ともOK！ 「取引する」を押すと交換します'
    : trade.myOk ? `⏳ ${escHtml(trade.pname)} のOKを待っています…`
    : trade.theirOk ? `${escHtml(trade.pname)} はOKしています。内容を確かめて「OK」を押してね`
    : '出すキャラを選んで「OK」を押してね（内容が変わるとOKはやり直し）';
  body.innerHTML = `
    <div class="tr-cols">
      <div class="tr-col ${trade.myOk ? 'ok' : ''}"><h3>あなたが出す <small>${trade.mine.length}/${TRADE_MAX}</small>${trade.myOk ? ' <span class="tr-okb">OK</span>' : ''}</h3>
        <div class="tr-grid">${trade.mine.map((it, i) => tradeTile(it, `data-tr-rm="${i}" title="外す"`)).join('') || '<p class="dex-sum">下のインベントリから選んでね</p>'}</div></div>
      <div class="tr-col ${trade.theirOk ? 'ok' : ''}"><h3>${escHtml(trade.pname)} が出す <small>${trade.theirs.length}/${TRADE_MAX}</small>${trade.theirOk ? ' <span class="tr-okb">OK</span>' : ''}</h3>
        <div class="tr-grid">${trade.theirs.map(it => tradeTile(it)).join('') || '<p class="dex-sum">まだ選んでいません</p>'}</div></div>
    </div>
    <p class="tr-status">${status}</p>
    <div class="tr-btns">
      ${both ? `<button class="btn tr-go" data-tr="go" ${trade.myGo ? 'disabled' : ''}>🤝 取引する</button>` : `<button class="btn" data-tr="ok">${trade.myOk ? 'OKを取り消す' : 'OK'}</button>`}
      <button class="btn sell" data-tr="cancel">やめる</button>
    </div>
    <h3 class="adm-h">🎒 インベントリから選ぶ</h3>
    <div class="tr-grid pick">${pick.map(g => tradeTile(g.it, `data-tr-add="${escHtml(g.k)}" title="出す"`).replace('</div>', `${g.left > 1 ? `<i class="tr-n">×${g.left}</i>` : ''}</div>`)).join('') || '<p class="dex-sum">インベントリにキャラがいません</p>'}</div>`;
}
$('tradeBody').addEventListener('click', e => {
  const req = e.target.closest('[data-tr-req]');
  if (req) return requestTrade(req.dataset.trReq);
  if (!trade) return;
  const add = e.target.closest('[data-tr-add]'), rm = e.target.closest('[data-tr-rm]'), b = e.target.closest('[data-tr]');
  if ((add || rm) && trade.phase === 'open' && !trade.myGo) {
    if (add) {
      if (trade.mine.length >= TRADE_MAX) return toast(`1回に出せるのは${TRADE_MAX}体までです`, { color: '#ff6b6b' });
      const it = save.inventory.find(x => itemKey(x) === add.dataset.trAdd);
      if (!it) return;
      trade.mine.push(it.mut ? { id: it.id, star: it.star, mut: it.mut } : { id: it.id, star: it.star });
    } else trade.mine.splice(+rm.dataset.trRm, 1);
    resetOk();
    sendTrade('offer', { items: trade.mine });
    return renderTrade();
  }
  if (!b) return;
  const k = b.dataset.tr;
  if (k === 'accept' && trade.phase === 'asked') { trade.phase = 'open'; sendTrade('acc'); }
  else if (k === 'decline' || k === 'cancel') { sendTrade('cancel'); return endTrade(k === 'decline' ? '取引を断りました' : '取引をやめました'); }
  else if (k === 'ok' && trade.phase === 'open') {
    if (!trade.myOk && !trade.mine.length && !trade.theirs.length) return toast('どちらもキャラを選んでいません', { color: '#ff6b6b' });
    if (!trade.myOk && !haveItems(trade.mine)) return toast('出すキャラがインベントリにありません（台座に置いたかも）', { color: '#ff6b6b' });
    trade.myOk = !trade.myOk;
    if (!trade.myOk) trade.myGo = false;
    sendTrade('ok', { on: trade.myOk, mine: itemsSig(trade.mine), theirs: itemsSig(trade.theirs) });
  } else if (k === 'go' && trade.myOk && trade.theirOk && !trade.myGo) {
    if (!haveItems(trade.mine)) { sendTrade('cancel'); return endTrade('出すキャラがインベントリにないので、取引をやめました', '#ff6b6b'); }
    trade.myGo = true;
    sendTrade('go', { mine: itemsSig(trade.mine), theirs: itemsSig(trade.theirs) });
    if (trade.theirGo) return doTrade();
  }
  updateTradeBtn(); renderTrade();
});
$('hudTradeBtn').addEventListener('click', () => openPanelById('tradePanel'));

// ---------- フレンドと一緒に遊ぶ（WebRTC） ----------
const kaToken = () => window.KaAccount?.token();
const net = new Net({
  getToken: kaToken,
  onPeer: (u, name) => { lastBaseSent = 0; lastBaseSig = ''; setTimeout(updateTradeBtn, 500); pushParty({ sys: true, text: `👥 ${String(name || u).slice(0, 16)} が参加しました` }); toast(`👥 ${escHtml(name || u)} とつながった！`, { color: '#7dff8a', big: true }); play('safe', { vol: 0.6 }); netStatus = ''; if (openPanel === 'friendPanel') renderFriends(); },
  onLeave: (u, name) => {
    const r = remotes.get(u);
    if (r) { scene.remove(r.p.group); r.label.el.remove(); labels.splice(labels.indexOf(r.label), 1); remotes.delete(u); toast(`👋 ${escHtml(name || u)} が抜けた`, { color: '#9ad0ff' }); }
    removeNeighborBase(u);
    if (r) pushParty({ sys: true, text: `👋 ${String(name || u).slice(0, 16)} が抜けました` });
    if (trade && trade.partner === u) endTrade(`${String(name || u).slice(0, 16)} が抜けたので、取引をやめました`);
    setTimeout(updateTradeBtn, 0);
    if (openPanel === 'friendPanel') renderFriends();
  },
  onMessage: msg => onNetMessage(msg),
  onStatus: text => { netStatus = text; if (openPanel === 'friendPanel') renderFriends(); },
  onHostLost: u => autoRejoin(u, 60000),   // ホストが再読み込みしたときなど → しばらくつなぎ直しを試す
});
let netStatus = '';
let myFriendName = '';
// 相手のプレイヤー（見た目・名前・持っているキャラ）
const remotes = new Map();
function onNetMessage(m) {
  if (typeof m.u !== 'string') return;
  if (m.t === 'st') {
    let r = remotes.get(m.u);
    if (!r) {
      const p = buildPlayer(SKIN_BY_ID[m.sk] || SKINS[0]);
      scene.add(p.group);
      r = { p, sk: m.sk, carry: null, carryId: '', pos: new THREE.Vector3(m.x, 0, m.z), tgt: new THREE.Vector3(), facing: 0, tf: 0, name: '', last: 0, walk: 0 };
      r.label = makeLabel(() => r.p.group.position.clone().add(new THREE.Vector3(0, 7.2, 0)), 'friend', 120);
      remotes.set(m.u, r);
    }
    if (m.sk !== r.sk && SKIN_BY_ID[m.sk]) {   // スキンを着がえた
      const np = buildPlayer(SKIN_BY_ID[m.sk]);
      np.group.position.copy(r.p.group.position);
      if (r.carry) np.carry.add(r.carry);
      scene.remove(r.p.group); scene.add(np.group); r.p = np; r.sk = m.sk;
      if (r.bd) setPartyHat(r.p, true, SKIN_BY_ID[m.sk]);
    }
    const cid = typeof m.c === 'string' && CHAR_BY_ID[m.c] ? m.c + ':' + (MUT_BY_ID[m.cm] ? m.cm : '') : '';
    if (cid !== r.carryId) {   // 持っているキャラが変わった
      if (r.carry) r.p.carry.remove(r.carry);
      r.carry = null; r.carryId = cid;
      if (cid) { r.carry = buildCharacter(CHAR_BY_ID[m.c], MUT_BY_ID[m.cm] ? m.cm : null); r.carry.scale.setScalar(0.55); r.p.carry.add(r.carry); }
    }
    r.rawX = +m.x || 0; r.rawZ = +m.z || 0;
    r.tgt.set(r.rawX + (r.rawZ < BASE_LINE ? baseX(m.u) : 0), 0, r.rawZ); r.tf = +m.f || 0; r.last = performance.now();
    const nm = String(m.n || m.u).slice(0, 16);
    const bd = m.bd === 1;
    if (nm !== r.name || bd !== !!r.bd) {
      const turnedOn = bd && !r.bd;
      r.name = nm; r.bd = bd;
      setPartyHat(r.p, bd, SKIN_BY_ID[r.sk]);
      if (!r.sayTimer) setLabel(r.label, remoteLabel(r));
      if (turnedOn) {   // 一緒に遊んでいる人が誕生日
        toast(`🎂 今日は ${escHtml(nm)} の誕生日！ おめでとう！`, { color: '#ff8fd0', big: true, time: 4500 });
        for (let i = 0; i < 5; i++) setTimeout(() => firework(r.p.group.position.x + (Math.random() - 0.5) * 16, r.p.group.position.z + (Math.random() - 0.5) * 16), i * 350);
      }
    }
  } else if (m.t === 'base' && Array.isArray(m.slots)) {
    setNeighborBase(m.u, String(m.n || m.u).slice(0, 16), m.slots.slice(0, SLOT_COUNT));
  } else if (m.t === 'tr') {
    if (m.to === meName()) onTradeMsg(m);
  } else if (m.t === 'pc' && typeof m.text === 'string') {
    const name = String(m.n || m.u).slice(0, 16), text = m.text.trim().slice(0, 100);
    if (!text) return;
    pushParty({ name, text });
    showSay(m.u, name, text);
    if (!(openPanel === 'chatPanel' && chatTab === 'party')) toast(`💬 ${escHtml(name)}: ${escHtml(text.slice(0, 60))}`, { color: '#9ad0ff', time: 4000 });
  } else if (m.t === 'ev' && typeof m.text === 'string') {
    toast(`👥 ${escHtml(String(m.n || m.u).slice(0, 16))}: ${escHtml(m.text.slice(0, 80))}`, { color: '#9ad0ff', time: 3500 });
  }
}
// ---- マルチプレイ: みんなの基地を横に並べる ----
// 参加者をユーザー名の順に並べ、自分の基地を x=0 として、となりは BASE_GAP ずつ横にずらす（全員の画面で同じ並び）
const BASE_GAP = 70;
const neighbors = new Map();   // ユーザー名 -> { g, label, models[], sig }
const meName = () => myFriendName || 'me';
function baseOrder() { return [meName(), ...new Set([...remotes.keys(), ...neighbors.keys()])].sort(); }
function baseX(u) { const o = baseOrder(); return (o.indexOf(u) - o.indexOf(meName())) * BASE_GAP; }
function baseRange() {
  if (!net.connected || !neighbors.size) return [0, 0];
  const xs = [0, ...[...neighbors.keys()].map(baseX)];
  return [Math.min(...xs), Math.max(...xs)];
}
function setNeighborBase(u, name, slots) {
  let nb = neighbors.get(u);
  if (!nb) {
    const g = new THREE.Group();
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF_W * 2 + 4, 60), mat(0x9bd770)); gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0.005, -30); gr.receiveShadow = true; g.add(gr);
    const pz = new THREE.Mesh(new THREE.PlaneGeometry(40, 52), mat(0xd5dde2)); pz.rotation.x = -Math.PI / 2; pz.position.set(0, 0.015, -26); pz.receiveShadow = true; g.add(pz);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF_W * 2 + 4, 1.2), new THREE.MeshBasicMaterial({ color: 0x9ad0ff })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, BASE_LINE); g.add(line);
    const pads = SLOT_POS.map(p => {
      const pg = new THREE.Group(); pg.position.copy(p);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 20), mat(0xdfe6f5)); b.position.y = 0.3; b.castShadow = b.receiveShadow = true; pg.add(b);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.15, 8, 32), new THREE.MeshBasicMaterial({ color: 0x9ad0ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.62; pg.add(ring);
      g.add(pg); return pg;
    });
    scene.add(g);
    nb = { g, pads, models: [], sig: '', name };
    nb.label = makeLabel(() => nb.g.position.clone().add(new THREE.Vector3(0, 9, -6)), 'friend', 160);
    neighbors.set(u, nb);
  }
  if (nb.name !== name || !nb.label.html) { nb.name = name; setLabel(nb.label, `<div class="n">🏠 ${escHtml(name)} の基地</div>`); }
  const sig = JSON.stringify(slots);
  if (sig === nb.sig) return;
  nb.sig = sig;
  nb.models.forEach(m => m && m.parent && m.parent.remove(m));
  nb.models = slots.map((s, i) => {
    if (!Array.isArray(s) || !CHAR_BY_ID[s[0]]) return null;
    const mut = MUT_BY_ID[s[2]] ? s[2] : null;
    const m = buildCharacter(CHAR_BY_ID[s[0]], mut);
    m.position.y = 0.6; m.scale.setScalar(1 + (Math.min(5, Math.max(1, +s[1] || 1)) - 1) * 0.12);
    m.rotation.y = -Math.sign(SLOT_POS[i].x) * Math.PI / 2;
    nb.pads[i].add(m); return m;
  });
}
function removeNeighborBase(u) {
  const nb = neighbors.get(u);
  if (!nb) return;
  scene.remove(nb.g); nb.label.el.remove(); labels.splice(labels.indexOf(nb.label), 1); neighbors.delete(u);
}
// 自分の基地（台座のキャラ）を知らせる。変わったときと、15秒ごと（あとから来た人のため）
let lastBaseSig = '', lastBaseSent = 0;
setInterval(() => {
  if (!net.connected) return;
  const slots = save.slots.map(s => (s ? [s.id, s.star, s.mut || ''] : null));
  const sig = JSON.stringify(slots);
  if (sig === lastBaseSig && Date.now() - lastBaseSent < 15000) return;
  lastBaseSig = sig; lastBaseSent = Date.now();
  net.send({ t: 'base', u: meName(), n: playerName(), slots });
}, 2000);

function updateRemotes(dt) {
  const now = performance.now();
  // 並びが変わったら基地の位置を合わせる
  for (const [u, nb] of neighbors) { nb.g.position.x = baseX(u); for (const m of nb.models) if (m) for (const a of m.userData.anims) a(now / 1000); }
  for (const [u, r] of remotes) {
    if (now - r.last > 15000) { net.cb.onLeave(u, r.name); continue; }   // しばらく様子が来なければ消す
    if (r.rawZ !== undefined) r.tgt.x = r.rawX + (r.rawZ < BASE_LINE ? baseX(u) : 0);
    const g = r.p.group;
    const d = g.position.distanceTo(r.tgt);
    if (d > 60) g.position.copy(r.tgt); else g.position.lerp(r.tgt, Math.min(1, dt * 10));
    let diff = r.tf - g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 10);
    // 歩いているように手足を振る
    const moving = d > 0.05;
    r.walk += moving ? dt * 12 : 0;
    const sw = moving ? Math.sin(r.walk) * 0.8 : 0;
    r.p.legL.rotation.x = sw; r.p.legR.rotation.x = -sw;
    if (!r.carry) { r.p.armL.rotation.x = -sw * 0.8; r.p.armR.rotation.x = sw * 0.8; } else r.p.armL.rotation.x = r.p.armR.rotation.x = Math.PI;
    for (const a of r.p.anims) a(now / 1000);
    if (r.carry) for (const a of r.carry.userData.anims) a(now / 1000);
  }
}
// 自分の様子を1秒に10回送る（つながっているときだけ）
let netSendT = 0;
setInterval(() => {
  if (!net.connected) return;
  net.send({ t: 'st', u: myFriendName || 'me', n: playerName(), sk: save.skin, x: +pState.pos.x.toFixed(2), z: +pState.pos.z.toFixed(2), f: +player.group.rotation.y.toFixed(2), c: carried?.def.id || '', cm: carried?.mut || '', bd: bdayOn ? 1 : 0 });
  netSendT++;
}, 100);
function netEvent(text) { if (net.connected) net.send({ t: 'ev', u: myFriendName || 'me', n: playerName(), text }); }

// ---- フレンド画面 ----
let friendData = null, friendTimer = null;
async function loadFriends(room = null) {
  const t = kaToken();
  if (!t) { friendData = null; return null; }
  try {
    const r = await friendList(t, room);
    if (r?.ok) { friendData = r; myFriendName = r.me.username; }
  } catch (e) { /* 通信失敗 */ }
  updateFriendBadge();
  return friendData;
}
function updateFriendBadge() {
  const n = friendData ? friendData.incoming.length + (net.busy ? 0 : friendData.friends.filter(f => f.room).length) : 0;
  $('friendBadge').classList.toggle('hidden', !n);
}
async function renderFriends(refresh = false) {
  const body = $('friendBody');
  if (!kaToken()) {
    body.innerHTML = `<div class="rank-me">フレンド機能は、かるわかGAMESアカウントでログインすると使えます。</div>
      <button class="btn" data-fr="login" style="width:100%">👤 ログイン / アカウントを作る</button>`;
    return;
  }
  if (refresh || !friendData) {
    if (!friendData) body.innerHTML = '<p class="dex-sum">読み込み中…</p>';
    await loadFriends(net.hosting ? true : null);
  }
  const d = friendData;
  if (!d) { body.innerHTML = '<p class="dex-sum">⚠ 読み込めませんでした（通信を確認してね）</p>'; return; }
  const peers = [...net.peers.entries()].filter(([, p]) => p.dc?.readyState === 'open').map(([u, p]) => escHtml(p.name || u));
  const room = net.hosting
    ? `<div class="fr-room on"><b>🏠 部屋を開いています</b><small>フレンドが「参加」するとつながります（最大4人）${peers.length ? `<br>いっしょに遊んでいる人: ${peers.join('、')}` : ''}</small><button class="btn sell" data-fr="close">部屋を閉じる</button></div>`
    : net.hostName || net.pending
      ? `<div class="fr-room on"><b>🎮 ${net.pending ? 'つないでいます…' : `${escHtml(net.peers.get(net.hostName)?.name || net.hostName)} の部屋で遊んでいます`}</b><button class="btn sell" data-fr="close">${net.pending ? 'やめる' : '抜ける'}</button></div>`
      : `<div class="fr-room"><b>🏠 フレンドと一緒に遊ぶ</b><small>部屋を開くと、フレンドが参加できます。おたがいの姿が見えて、持ち帰ったキャラなども知らせ合えます（セーブは別々）</small><button class="btn" data-fr="host">部屋を開く</button></div>`;
  const row = (f, btns) => `<div class="fr-row"><span class="av">${escHtml(f.avatar || '🎮')}</span><div><b>${escHtml(f.name)}</b><small>@${escHtml(f.username)}${f.online !== undefined ? (f.room ? ' ・ <span class="room">🏠 部屋を開いています</span>' : f.online ? ' ・ <span class="on">🟢 オンライン</span>' : ' ・ オフライン') : ''}</small></div>${btns}</div>`;
  body.innerHTML = `${netStatus ? `<p class="fr-status">${escHtml(netStatus)}</p>` : ''}${room}${net.connected ? '<button class="btn fr-trade" data-open-trade>🤝 一緒に遊んでいる人とキャラを取引する</button>' : ''}
    <p class="fr-me">あなたのID: <b>@${escHtml(d.me.username)}</b>（フレンドにこのIDを教えてね）</p>
    <form class="fr-add" id="frAdd" autocomplete="off"><input id="frAddInput" maxlength="32" placeholder="フレンドのID（ユーザー名）"><button class="btn" type="submit">申請</button></form>
    ${d.incoming.length ? `<h3 class="adm-h">📩 フレンド申請（${d.incoming.length}）</h3>` + d.incoming.map(f => row(f, `<button class="btn" data-fr="accept" data-u="${escHtml(f.username)}">承認</button><button class="btn sell" data-fr="decline" data-u="${escHtml(f.username)}">断る</button>`)).join('') : ''}
    <h3 class="adm-h">👥 フレンド（${d.friends.length}）</h3>
    ${d.friends.length ? d.friends.map(f => row(f, `${f.room ? `<button class="btn" data-fr="join" data-u="${escHtml(f.username)}" ${net.busy ? 'disabled' : ''}>参加</button>` : ''}<button class="fr-x" data-fr="remove" data-u="${escHtml(f.username)}" title="フレンドをやめる">✕</button>`)).join('') : '<p class="dex-sum">まだフレンドがいません。IDで申請してみよう！</p>'}
    ${d.outgoing.length ? `<h3 class="adm-h">⏳ 申請中</h3>` + d.outgoing.map(f => row(f, `<button class="fr-x" data-fr="remove" data-u="${escHtml(f.username)}" title="申請を取り消す">✕</button>`)).join('') : ''}`;
  $('frAdd').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('frAddInput').value.trim();
    if (!u) return;
    try {
      const r = await friendRequest(kaToken(), u);
      if (r?.ok) toast(r.accepted ? `👥 ${escHtml(r.name)} とフレンドになった！` : `📩 ${escHtml(r.name)} に申請しました`, { color: '#7dff8a' });
      else toast(`⚠ ${{ notfound: 'そのIDの人は見つかりません', self: '自分には申請できません', already: 'もうフレンドです', many: '申請中が多すぎます' }[r?.reason] || '申請できませんでした'}`, { color: '#ff6b6b' });
    } catch (err) { toast('⚠ 通信に失敗しました', { color: '#ff6b6b' }); }
    renderFriends(true);
  });
  // 開いている間は15秒ごとに更新（オンライン・部屋の状態）
  clearInterval(friendTimer);
  friendTimer = setInterval(() => { if (openPanel !== 'friendPanel') { clearInterval(friendTimer); return; } if (!document.hidden) renderFriends(true); }, 15000);
}
$('friendBody').addEventListener('click', e => { if (e.target.closest('[data-open-trade]')) openPanelById('tradePanel'); });
$('friendBody').addEventListener('click', async e => {
  const b = e.target.closest('[data-fr]');
  if (!b || b.disabled) return;
  const k = b.dataset.fr, u = b.dataset.u, t = kaToken();
  if (k === 'login') { unlockPointer(); window.KaAccount?.openPanel(); return; }
  if (k === 'host' || k === 'close' || k === 'join') stopRejoin();   // 自分で操作したら自動のつなぎ直しはやめる
  if (k === 'host') { await net.host(); await loadFriends(true); }
  else if (k === 'close') { const wasHost = net.hosting; net.leave(); for (const r of [...remotes.keys()]) net.cb.onLeave(r); if (wasHost) await loadFriends(false); }
  else if (k === 'join') { await net.join(u); }
  else if (k === 'accept' || k === 'decline') { try { await friendRespond(t, u, k === 'accept'); } catch (err) { /* 次の更新で */ } await loadFriends(); }
  else if (k === 'remove') { if (!confirm(`@${u} をフレンドから外しますか？`)) return; try { await friendRemove(t, u); } catch (err) { /* 次の更新で */ } await loadFriends(); }
  renderFriends();
});
$('hudFriendBtn').addEventListener('click', () => openPanelById('friendPanel'));
// ログイン中は90秒ごとにフレンドの様子を確認（申請・部屋のバッジ用）。部屋を開いている間は「開いている」を更新し続ける
setInterval(() => { if (!document.hidden && kaToken()) loadFriends(net.hosting ? true : null); }, 90000);
// ---- 再読み込みしても一緒に遊び続ける ----
// ページを離れるときに「ホストだった／だれの部屋にいた」をこのタブ（sessionStorage）に覚えておき、
// 読み直したらすぐ部屋を開き直す・同じホストにつなぎ直す（タブを閉じたら忘れる）
const MP_KEY = 'llb_mp_resume';
let resumeMp = null;
try { const r = JSON.parse(sessionStorage.getItem(MP_KEY) || 'null'); sessionStorage.removeItem(MP_KEY); if (r && Date.now() - r.at < 120000) resumeMp = r; } catch (e) { /* 使えない環境 */ }
let rejoin = null;   // { host, until, timer }
function stopRejoin() { if (rejoin) { clearInterval(rejoin.timer); rejoin = null; } }
function autoRejoin(host, ms) {
  stopRejoin();
  if (!host) return;
  toast(`🔄 ${escHtml(host)} の部屋につなぎ直しています…`, { color: '#9ad0ff' });
  const r = rejoin = { host, until: Date.now() + ms, timer: 0 };
  const tick = () => {
    if (rejoin !== r) return;
    if (net.connected && net.hostName === host) { stopRejoin(); return; }
    if (Date.now() > r.until) { stopRejoin(); netStatus = 'つなぎ直せませんでした。フレンド画面からもう一度参加してね'; toast('⚠ つなぎ直せませんでした', { color: '#ff6b6b' }); if (openPanel === 'friendPanel') renderFriends(); return; }
    if (kaToken() && !net.busy) net.join(host, 12000);
  };
  r.timer = setInterval(tick, 3000);
  setTimeout(tick, 300);
}
async function resumeMultiplayer() {
  const r = resumeMp; resumeMp = null;
  // ログインの読み込みを少し待つ
  for (let i = 0; i < 20 && !kaToken(); i++) await new Promise(res => setTimeout(res, 500));
  if (!kaToken()) return loadFriends(false);
  await loadFriends(null);
  if (r.role === 'host') { await net.host(); await loadFriends(true); toast('🎮 部屋を開き直しました。フレンドが自動で戻ってきます', { color: '#7dff8a' }); }
  else if (r.role === 'guest') autoRejoin(r.host, 60000);
}
if (resumeMp) setTimeout(resumeMultiplayer, 800);
else setTimeout(() => { if (kaToken()) loadFriends(false); }, 3000);
// ページを閉じるときは部屋も閉じる（再読み込みなら、読み直したあとすぐ開き直す）
addEventListener('pagehide', () => {
  try {
    const role = net.hosting ? 'host' : (net.hostName || rejoin) ? 'guest' : '';
    if (role) sessionStorage.setItem(MP_KEY, JSON.stringify({ role, host: net.hostName || rejoin?.host || '', at: Date.now() }));
  } catch (e) { /* 使えない環境 */ }
  if (net.hosting && kaToken()) friendList(kaToken(), false, true).catch(() => {});
  net.leave();
});

// ---------- バックアップ ----------
const hasProgress = sv => !!sv && (sv.stats?.collected > 0 || sv.rebirths > 0 || (sv.slots || []).some(Boolean));
function saveSummary() {
  return {
    rebirths: save.rebirths, collected: save.stats.collected, income: totalIncome(), money: save.money,
    dex: CHARACTERS.filter(c => save.dex[c.id]).length, dist: save.stats.bestDistance,
  };
}
let lastCloudBackup = 0;
// force: 10分待たずにクラウドにも送る（リセット前など）
async function backupNow(force = false) {
  if (!hasProgress(save)) return;   // 空っぽのデータでバックアップを埋めない
  const sum = saveSummary();
  saveLocalBackup(save, sum);
  const t = window.KaAccount?.token();
  if (t && (force || Date.now() - lastCloudBackup > 10 * 60 * 1000)) {
    lastCloudBackup = Date.now();
    try { await cloudBackupPut(t, JSON.parse(JSON.stringify(save)), sum); } catch (e) { /* 次の機会に */ }
  }
}
const sumText = s => s ? `🔄 リボーン${s.rebirths ?? 0}回 ・ 🎁 ${s.collected ?? 0}体${s.income ? ` ・ 💰 $${fmt(s.income)}/秒` : ''}${s.note ? ` ・ ${escHtml(s.note)}` : ''}` : '';
const fmtTime = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
let cloudItems = [];
async function renderBackups(lostHint = false) {
  const local = localBackups().filter(b => b.summary && (b.summary.collected > 0 || b.summary.rebirths > 0));
  const t = window.KaAccount?.token();
  $('backupLead').innerHTML = lostHint
    ? '⚠ いまのデータが最初からになっています。前のデータが見つかったので、復元できます。'
    : 'データが消えたときは、ここから前の状態に戻せます。（自動で10分ごとに保存）';
  $('backupLocal').innerHTML = local.length
    ? local.map((b, i) => `<div class="bk-row"><div><b>${fmtTime(b.t)}</b><small>${sumText(b.summary)}</small></div><button class="btn" data-bk-local="${i}">復元</button></div>`).join('')
    : '<p class="dex-sum">まだありません</p>';
  if (!t) { $('backupCloud').innerHTML = '<p class="dex-sum">かるわかGAMESアカウントでログインすると、クラウドにもバックアップされ、別の端末からも戻せます。</p>'; return; }
  $('backupCloud').innerHTML = '<p class="dex-sum">読み込み中…</p>';
  try {
    const r = await cloudBackupList(t);
    cloudItems = r?.ok ? r.items : [];
  } catch (e) { cloudItems = []; }
  $('backupCloud').innerHTML = cloudItems.length
    ? cloudItems.map(b => `<div class="bk-row"><div><b>${fmtTime(b.created_at)}</b><small>${sumText(b.summary)}</small></div><button class="btn" data-bk-cloud="${b.id}">復元</button></div>`).join('')
    : '<p class="dex-sum">まだありません</p>';
}
// 復元: データを書き込んで、クラウドにも送ってから読み直す
async function restoreSave(data, label) {
  if (!confirm(`${label} のバックアップに戻しますか？\n\nいまのデータはこのバックアップで置きかわります（いまのデータもバックアップに残します）。`)) return;
  await backupNow(true);
  removeEventListener('beforeunload', writeSave);
  noSave = true;
  try { localStorage.setItem(SAVE_KEY, typeof data === 'string' ? data : JSON.stringify(data)); } catch (e) { noSave = false; return toast('⚠ 書き込めませんでした', { color: '#ff6b6b' }); }
  try { await window.KaAccount?.saveNow(); } catch (e) { /* 次の同期で反映 */ }
  toast('💾 復元しました。読み直します…', { color: '#7dff8a', big: true });
  setTimeout(() => location.reload(), 600);
}
$('backupPanel').addEventListener('click', async e => {
  const l = e.target.closest('[data-bk-local]'), c = e.target.closest('[data-bk-cloud]');
  if (l) {
    const b = localBackups().filter(x => x.summary && (x.summary.collected > 0 || x.summary.rebirths > 0))[+l.dataset.bkLocal];
    if (b) restoreSave(b.data, fmtTime(b.t));
  } else if (c) {
    const t = window.KaAccount?.token();
    try {
      const r = await cloudBackupGet(t, +c.dataset.bkCloud);
      if (!r?.ok) return toast('⚠ バックアップを読み込めませんでした', { color: '#ff6b6b' });
      const item = cloudItems.find(x => x.id === +c.dataset.bkCloud);
      restoreSave(r.data, item ? fmtTime(item.created_at) : 'クラウド');
    } catch (err) { toast('⚠ 通信に失敗しました', { color: '#ff6b6b' }); }
  }
});
$('backupBtn').addEventListener('click', () => openPanelById('backupPanel'));
$('backupNowBtn').addEventListener('click', async () => { await backupNow(true); toast('💾 バックアップしました', { color: '#7dff8a' }); renderBackups(); });
// データが最初からになっていて、前のデータが見つかったら復元を勧める（1回だけ）
let lostChecked = false;
async function checkLostData() {
  if (lostChecked || hasProgress(save)) return;
  let found = localBackups().some(b => b.summary && (b.summary.collected > 0 || b.summary.rebirths > 0));
  const t = window.KaAccount?.token();
  if (!found && t) {
    try { const r = await cloudBackupList(t); found = !!(r?.ok && r.items.some(b => b.summary?.collected > 0 || b.summary?.rebirths > 0)); } catch (e) { /* 通信失敗 */ }
  }
  if (!found || hasProgress(save)) return;
  lostChecked = true;
  openPanelById('backupPanel');
  renderBackups(true);
}

// ---------- かるわかGAMESアカウント ----------
const ka = window.KaAccount;
function updateAccountUi(user = ka?.user()) {
  if (!ka) {
    $('accountStatus').textContent = 'アカウント機能を読み込めませんでした（オフラインかもしれません）。';
    $('accountBtn').classList.add('hidden'); $('titleAccountBtn').classList.add('hidden'); $('hudAccountBtn').classList.add('hidden');
    return;
  }
  $('accountStatus').textContent = user
    ? `${user.avatar} ${user.display_name}（@${user.username}）でログイン中。セーブはクラウドに自動で保存されます。`
    : 'ログインすると、セーブがクラウドに保存されて別の端末でも続きから遊べます。';
  $('accountBtn').textContent = user ? 'アカウント・同期の状態' : 'ログイン / アカウントを作る';
  $('titleAccountBtn').textContent = user ? `${user.avatar} ${user.display_name} でログイン中` : '👤 かるわかGAMESアカウントでログイン';
  $('hudAccountBtn').innerHTML = user ? `<span class="i">${escHtml(user.avatar || '👤')}</span><span class="t">${escHtml(user.display_name)}</span>` : '<span class="i">👤</span><span class="t">ログイン</span>';
  $('nameInput').placeholder = user ? user.display_name : '名無し';
}
$('accountBtn').addEventListener('click', () => ka?.openPanel());
$('titleAccountBtn').addEventListener('click', () => ka?.openPanel());
$('hudAccountBtn').addEventListener('click', () => { unlockPointer(); ka?.openPanel(); });
// スマホではリンク（作者の別のゲーム・オプチャ）を 🔗 で開け閉めする
$('hudLinksBtn').addEventListener('click', () => {
  const open = $('subMenu').classList.toggle('links-open');
  $('hudLinksBtn').setAttribute('aria-expanded', String(open));
});
ka?.onChange(user => { updateAccountUi(user); checkAdmin(); if (user && !$('title').classList.contains('hidden')) return; if (user) checkLostData(); });

// ---------- 管理者メニュー（かるわかGAMESの管理者アカウントだけ） ----------
let isAdmin = false;
async function checkAdmin() {
  isAdmin = false;
  const t = ka?.token();
  if (t) { try { isAdmin = await adminCheck(t) === true; } catch (e) { isAdmin = false; } }
  $('hudAdminBtn').classList.toggle('hidden', !isAdmin);
  if (!isAdmin && openPanel === 'adminPanel') closePanels();
}
$('hudAdminBtn').addEventListener('click', () => openPanelById('adminPanel'));
// キャラの選択肢（レア度ごと）
// ---- 配布するキャラ選び（インデックス風のカードから選ぶ） ----
const gift = { char: CHARACTERS[0].id, mut: '', rar: 0 };
$('giftRars').innerHTML = RARITIES.map((rar, r) => `<button class="rank-tab" data-grar="${r}" style="--rc:${rarCss(r)}">${rar.name}</button>`).join('');
function renderGiftPicker() {
  const def = CHAR_BY_ID[gift.char];
  $('giftPick').innerHTML = `<img src="${charThumb(def, false, gift.mut || null)}" alt="">
    <div><span class="lbl">配るキャラ</span><b>${def.name}</b>
    <div>${rarityName(def.r)} ${gift.mut ? mutTag(gift.mut) : ''}</div>
    <small>基本の稼ぎ +${fmt(baseIncome(def) * mutMult(gift.mut || null))}/秒</small></div>`;
  document.querySelectorAll('#giftMuts [data-gmut]').forEach(b => b.classList.toggle('active', b.dataset.gmut === gift.mut));
  document.querySelectorAll('#giftRars [data-grar]').forEach(b => b.classList.toggle('active', +b.dataset.grar === gift.rar));
  // 選んだレア度のボタンが横スクロールの外に隠れないようにする
  const rb = $('giftRars').querySelector('.active');
  if (rb) $('giftRars').scrollLeft = rb.offsetLeft - $('giftRars').clientWidth / 2 + rb.offsetWidth / 2;
  $('giftGrid').innerHTML = CHARACTERS.filter(c => c.r === gift.rar).map(c => `
    <button class="gift-card ${c.id === gift.char ? 'sel' : ''}" data-gchar="${c.id}" style="--rc:${rarCss(c.r)}">
      <img src="${charThumb(c, false, gift.mut || null)}" alt=""><b>${c.name}</b></button>`).join('');
}
$('adminPanel').addEventListener('click', e => {
  const m = e.target.closest('[data-gmut]'), r = e.target.closest('[data-grar]'), c = e.target.closest('[data-gchar]');
  if (m) gift.mut = m.dataset.gmut;
  else if (r) gift.rar = +r.dataset.grar;
  else if (c) gift.char = c.dataset.gchar;
  else return;
  renderGiftPicker();
});
// 不正の疑いで保留になっている記録（サーバーが自動で見つけたもの・管理者が保留にしたもの）
// 信頼するプレイヤーの一覧
async function renderTrusted() {
  const box = $('admTrusted');
  box.innerHTML = '<p class="dex-sum">読み込み中…</p>';
  try {
    const list = await adminTrusted(ka?.token());
    if (openPanel !== 'adminPanel') return;
    box.innerHTML = list?.length ? list.map(r => `<div class="adm-row"><b>⭐ ${escHtml(r.name)}</b><small>リボーン ${r.rebirths}回・累計 $${fmt(r.total_earned)}</small>
      <button class="btn sell" data-untrust="${escHtml(r.client_id)}" data-hname="${escHtml(r.name)}">外す</button></div>`).join('')
      : '<p class="dex-sum">まだいません</p>';
  } catch (e) { box.innerHTML = '<p class="dex-sum">読み込めませんでした</p>'; }
}
$('admTrusted').addEventListener('click', async e => {
  const b = e.target.closest('[data-untrust]');
  if (!b || !confirm(`「${b.dataset.hname}」の信頼を外しますか？`)) return;
  try { if (await adminSetTrust(ka?.token(), b.dataset.untrust, false)) { toast('信頼を外しました', { color: '#ffd23f' }); renderTrusted(); } }
  catch (err) { toast('⚠ できませんでした', { color: '#ff6b6b' }); }
});
async function renderFlagged() {
  const box = $('admFlagged');
  box.innerHTML = '<p class="dex-sum">読み込み中…</p>';
  try {
    const list = await adminFlagged(ka?.token());
    if (openPanel !== 'adminPanel') return;
    box.innerHTML = list?.length ? list.map(r => `<div class="adm-row"><b>${escHtml(r.name)}</b>
      <small>${escHtml(r.flag_reason || '')}${r.flagged_at ? '・' + fmtWhen(r.flagged_at) : ''}</small>
      <button class="btn" data-unflag="${escHtml(r.client_id)}">解除</button><button class="btn trust" data-trustflag="${escHtml(r.client_id)}" data-hname="${escHtml(r.name)}">⭐ 信頼</button></div>`).join('')
      : '<p class="dex-sum">保留中の記録はありません</p>';
  } catch (e) { box.innerHTML = '<p class="dex-sum">読み込めませんでした</p>'; }
}
$('admFlagged').addEventListener('click', async e => {
  const tf = e.target.closest('[data-trustflag]');
  if (tf) {
    if (!confirm(`「${tf.dataset.hname}」を信頼するプレイヤーにして、保留を解除しますか？`)) return;
    try { if (await adminSetTrust(ka?.token(), tf.dataset.trustflag, true)) { toast('⭐ 信頼するプレイヤーにして解除しました', { color: '#7dff8a' }); renderFlagged(); renderTrusted(); } }
    catch (err) { toast('⚠ できませんでした', { color: '#ff6b6b' }); }
    return;
  }
  const b = e.target.closest('[data-unflag]');
  if (!b || !confirm('この記録の保留を解除して、ランキングに戻しますか？')) return;
  try { if (await adminSetFlag(ka?.token(), b.dataset.unflag, false)) { toast('✅ 解除しました', { color: '#7dff8a' }); renderFlagged(); } }
  catch (err) { toast('⚠ できませんでした', { color: '#ff6b6b' }); }
});
// ブーストの種類と倍率を選ぶ
let boostType = 'luck';
function renderBoostPick() {
  document.querySelectorAll('#boostPick [data-btype]').forEach(b => b.classList.toggle('active', b.dataset.btype === boostType));
  const opts = boostType === 'speed' ? [1.3, 1.5] : [2, 3];
  const cur = +$('admBoostMult').value;
  $('admBoostMult').innerHTML = opts.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>×${v}</option>`).join('');
}
$('boostPick').addEventListener('click', e => { const b = e.target.closest('[data-btype]'); if (!b) return; boostType = b.dataset.btype; renderBoostPick(); });
renderBoostPick();
const KIND_LABEL = { message: '📢 お知らせ', gift: '🎁 配布', mutation: '🧬 変異イベント', boost: '⚡ ブースト', event: '🎉 イベント' };
function renderAdminActive() {
  const list = adminEvents.filter(e => Date.parse(e.ends_at) > Date.now());
  $('admActive').innerHTML = list.length ? list.map(e => {
    const future = Date.parse(e.starts_at) > Date.now();
    const what = e.kind === 'event' ? escHtml(e.payload.title)
      : e.kind === 'message' ? escHtml(e.payload.text)
      : e.kind === 'gift' ? `${e.payload.mut ? MUT_BY_ID[e.payload.mut].name + '変異の' : ''}${CHAR_BY_ID[e.payload.char]?.name || e.payload.char}`
      : e.kind === 'boost' ? `${BOOSTS[e.payload.type]?.icon || ''} ${BOOSTS[e.payload.type]?.name || e.payload.type} ×${e.payload.mult}`
      : (e.payload.mut ? MUT_BY_ID[e.payload.mut].name : 'ランダム');
    return `<div class="adm-row ${future ? 'sched' : ''}"><span>${KIND_LABEL[e.kind]}</span><b>${what}</b>
      <small>${fmtWhen(e.starts_at)} 〜 ${fmtWhen(e.ends_at)}<br>${future ? `開始まで あと ${fmtLeft((Date.parse(e.starts_at) - Date.now()) / 1000)}` : `のこり ${fmtLeft((Date.parse(e.ends_at) - Date.now()) / 1000)}`}</small>
      <button class="btn sell" data-end="${e.id}">${future ? '取り消し' : '終了'}</button></div>`;
  }).join('') : '<p class="dex-sum">いま出しているものはありません</p>';
}
// 予約の日時: 入力欄の初期値は「今夜21時」（過ぎていたら明日の21時）
const fmtWhen = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function defaultAt() {
  const d = new Date(); d.setHours(21, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
{
  $('admEvStart').value = defaultAt();
  const e = new Date(defaultAt()); e.setDate(e.getDate() + 1);
  const p = n => String(n).padStart(2, '0');
  $('admEvEnd').value = `${e.getFullYear()}-${p(e.getMonth() + 1)}-${p(e.getDate())}T${p(e.getHours())}:${p(e.getMinutes())}`;
}
document.querySelectorAll('#adminPanel .adm-when').forEach(w => {
  w.querySelector('.at').value = defaultAt();
  w.querySelector('.when').addEventListener('change', e => w.querySelector('.at').classList.toggle('hidden', e.target.value !== 'at'));
});
// ボタンのあるカードの「いつ」を読む（undefined = 入力がおかしい）
function readWhen(btn) {
  const w = btn.closest('.card').querySelector('.adm-when');
  if (w.querySelector('.when').value !== 'at') return { start: null, label: '今すぐ' };
  const t = new Date(w.querySelector('.at').value);
  if (isNaN(t) || t <= new Date()) { toast('予約の日時は、これから先の時間にしてください', { color: '#ff6b6b' }); return undefined; }
  return { start: t.toISOString(), label: `${fmtWhen(t)} に` };
}
async function postAdmin(kind, payload, minutes, start = null) {
  try {
    const r = await adminPost(ka?.token(), kind, payload, minutes, start);
    if (!r?.ok) {
      const why = { title: 'イベント名は1〜30文字です', type: 'ブーストの種類が正しくありません', mult: '倍率が正しくありません', auth: '管理者として確認できませんでした', rate: '短い時間に出しすぎです（1時間に30回まで）', text: 'メッセージは1〜120文字です', char: 'キャラが正しくありません', start: '予約は30日先までです' }[r?.reason] || 'うまく出せませんでした';
      toast(`⚠ ${why}`, { color: '#ff6b6b' }); return;
    }
    toast(start ? `⏰ ${fmtWhen(start)} に予約しました` : '✅ 全員に出しました', { color: '#7dff8a' });
    await pollEvents(); renderAdminActive();
  } catch (e) { toast('⚠ 通信に失敗しました', { color: '#ff6b6b' }); }
}
$('adminPanel').addEventListener('click', async e => {
  const b = e.target.closest('[data-adm],[data-end]');
  if (!b) return;
  if (b.dataset.end) {
    try { await adminEnd(ka?.token(), +b.dataset.end); } catch (err) { /* 次の更新で反映 */ }
    await pollEvents(); renderAdminActive(); return;
  }
  const k = b.dataset.adm;
  const when = readWhen(b);
  if (!when) return;
  if (k === 'message') {
    const text = $('admMsg').value.trim();
    if (!text) return toast('メッセージを入れてください', { color: '#ff6b6b' });
    if (!confirm(`${when.label}全員にこのメッセージを出しますか？\n\n${text}`)) return;
    await postAdmin('message', { text }, +$('admMsgMin').value, when.start);
    $('admMsg').value = '';
  } else if (k === 'gift') {
    const def = CHAR_BY_ID[gift.char], mut = gift.mut;
    if (!confirm(`${when.label}全員に「${mut ? MUT_BY_ID[mut].name + '変異の' : ''}${def.name}」を1体ずつ配りますか？`)) return;
    await postAdmin('gift', { char: def.id, mut, note: $('admGiftNote').value.trim() }, +$('admGiftMin').value, when.start);
  } else if (k === 'event') {
    const title = $('admEvTitle').value.trim(), desc = $('admEvDesc').value.trim();
    const st = new Date($('admEvStart').value), en = new Date($('admEvEnd').value);
    if (!title) return toast('イベント名を入れてください', { color: '#ff6b6b' });
    if (isNaN(st) || isNaN(en) || en <= st) return toast('開始と終了の日時を正しく入れてください（終了は開始より後）', { color: '#ff6b6b' });
    if (en <= new Date()) return toast('終了がもう過ぎています', { color: '#ff6b6b' });
    const start = st > new Date() ? st : new Date();
    const min = Math.round((en - start) / 60000);
    if (min > 43200) return toast('イベントは最長30日までです', { color: '#ff6b6b' });
    const boost = $('admEvBoost').value;
    if (boost && min > 4320) return toast('ブーストをつけるときは最長3日までです', { color: '#ff6b6b' });
    if (!confirm(`イベント「${title}」を作りますか？\n\n${fmtWhen(start.toISOString())} 〜 ${fmtWhen(en.toISOString())}${boost ? `\nブースト: ${$('admEvBoost').selectedOptions[0].text}` : ''}`)) return;
    const s = st > new Date() ? st.toISOString() : null;
    await postAdmin('event', { title, desc }, min, s);
    if (boost) { const [type, mult] = boost.split(':'); await postAdmin('boost', { type, mult: +mult }, min, s); }
    $('admEvTitle').value = ''; $('admEvDesc').value = '';
  } else if (k === 'boost') {
    const b = BOOSTS[boostType], mult = +$('admBoostMult').value, min = +$('admBoostMin').value;
    if (!confirm(`${when.label}全員に「${b.icon} ${b.name} ×${mult}」を${min >= 60 ? min / 60 + '時間' : min + '分'}かけますか？`)) return;
    await postAdmin('boost', { type: boostType, mult }, min, when.start);
  } else if (k === 'mutation') {
    const mut = $('admMut').value;
    if (!confirm(`${when.label}変異イベント（${mut ? MUT_BY_ID[mut].name : 'ランダム'}・${$('admMutMin').value}分）を始めますか？`)) return;
    await postAdmin('mutation', { mut }, +$('admMutMin').value, when.start);
  }
});
checkAdmin();
pollEvents();
updateAccountUi();
// アカウントの画面（同期の確認など）が出たらマウスロックを外して操作できるようにする
new MutationObserver(() => { if (document.querySelector('.ka-overlay')) unlockPointer(); })
  .observe(document.body, { childList: true });

// =====================================================================
// 起動
// =====================================================================
if (input.isTouch) document.body.classList.add('touch');
document.body.classList.add('title-mode');
if (HALLOWEEN) { $('halloweenBadge').classList.remove('hidden'); document.body.classList.add('halloween'); }
// 2回目以降はタイトルに記録を出す
if (save.stats.collected > 0) {
  const got = CHARACTERS.filter(c => save.dex[c.id]).length;
  $('titleWelcome').textContent = `おかえり！ 最高飛距離 ${save.stats.bestDistance}m ・ インデックス ${got}/${CHARACTERS.length} ・ 毎秒 $${fmt(totalIncome())}`;
  $('titleWelcome').classList.remove('hidden');
}
$('ctrlHint').textContent = input.isTouch
  ? '左下スティックで移動・右下ボタンで行動・スワイプで視点'
  : 'WASDで移動・クリックでマウスロック（マウスで視点）・左クリック / E / スペースで行動・Escで解除';
initInput(renderer.domElement);
setVolume(save.volume);

$('startBtn').addEventListener('click', () => {
  initAudio();
  $('title').classList.add('hidden');
  document.body.classList.remove('title-mode');
  lockPointer();
  if (offlineMoney > 0) toast(`おかえり！ 放置中に $${fmt(offlineMoney)} 貯まったよ`, { color: '#7dff8a', time: 3500 });
  else if (save.stats.collected === 0) toast('黄色い発射台へ行ってブロックを打とう！', { color: '#ffd23f', time: 4000 });
  setTimeout(checkLostData, 800);
  setTimeout(maybeBirthday, 1200);
  setTimeout(maybeLoginBonus, 1600);
});
addEventListener('beforeunload', writeSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });

updateHud();
camPos.set(0, 12, 4);
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
});







// 改ざんを見つけたら知らせる（ランキングには送らない）
// （タイトル画面ではお知らせを出さないので、ランキング画面でだけ知らせる）

