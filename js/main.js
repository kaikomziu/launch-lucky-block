// ラッキーブロックを打つ Web — メイン
import * as THREE from 'three';
import {
  RARITIES, ZONES, CHARACTERS, CHAR_BY_ID, BASE_LINE, LAUNCH_POS, ZONE_START, ZONE_LENS, ZONE_STARTS, WORLD_END, WORLD_HALF_W,
  MAX_STAR, SLOT_COUNT, charIncome as baseIncome, evolveCost, sellPrice as baseSellPrice, strengthRate as baseStrengthRate,
  dumbbellCost, playerSpeed, speedCost, rebirthMult, rebirthCost, launchDistance, zoneAt, rollCharacter, fmt, rarFx, rarCss,
  MUT_BY_ID, mutMult, rollMutation, mutationEvent,
  BOSS_ACCEL, BOSS_ACCEL_MAX, BOSS_DASH_EVERY, BOSS_DASH_TIME, BOSS_DASH_MULT,
} from './data.js';
import { buildPlayer, buildBoss, buildLuckyBlock, buildCharacter, textTexture, mat } from './models.js';
import { initAudio, play, startLoop, stopLoop, setVolume } from './audio.js';
import { input, initInput, pollInput, lockPointer, unlockPointer } from './input.js';
import { GENRES, submitScore, fetchRanking, fetchMine } from './ranking.js';
import { fetchEvents, adminCheck, adminPost, adminEnd } from './admin.js';

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
    claimedGifts: [],                            // 受け取った管理者のプレゼントのID                               // 拠点の色（インデックスの変異を75%集めると選べる）                              // 飛ばす力（0.1〜1）。強すぎて逃げ切れないとき用
    slots: Array(SLOT_COUNT).fill(null),         // { id, star, stored }
    inventory: [],                               // { id, star } 持ち帰ったが台座に置いていないキャラ
    stats: { bestDistance: 0, totalEarned: 0, collected: 0, bestRarity: 0 },
    dex: {},
    name: '', volume: 0.7,
    // オンラインランキング用の識別子（将来使用）
    clientId: randomId(), token: randomId() + randomId(),
    lastTime: Date.now(),
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = Object.assign(defaultSave(), JSON.parse(raw));
    s.stats = Object.assign(defaultSave().stats, s.stats);
    while (s.slots.length < SLOT_COUNT) s.slots.push(null);
    s.slots = s.slots.map(x => (x && CHAR_BY_ID[x.id] ? x : null));
    s.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(x => x && CHAR_BY_ID[x.id]);
    // 旧形式（id: true）のインデックスを移行
    for (const k of Object.keys(s.dex)) {
      if (!CHAR_BY_ID[k]) delete s.dex[k];
      else if (s.dex[k] === true) s.dex[k] = { count: 1, first: null, seen: true };
    }
    return s;
  } catch (e) {
    return defaultSave();
  }
}
let save = loadSave();
function writeSave() {
  save.lastTime = Date.now();
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

scene.add(new THREE.HemisphereLight(0xffffff, 0x556644, 1.4));
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
  const fence = new THREE.Mesh(new THREE.BoxGeometry(1, 2, WORLD_END + 60), mat(0x8d6e63));
  fence.position.set(s * (WORLD_HALF_W + 1.5), 1, (WORLD_END - 60) / 2);
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
for (let d = 50; d < WORLD_END; d += 50) {
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
  for (let k = 0; k < Math.round(22 * len / 80); k++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    decorate(z.deco, side * (11 + Math.random() * (WORLD_HALF_W - 13)), start + 4 + Math.random() * (len - 8));
  }
});
// 拠点の木
for (let k = 0; k < 10; k++) decorate('tree', (k % 2 ? -1 : 1) * (24 + Math.random() * 5), -6 - k * 4.8);

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
const player = buildPlayer();
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
  if (p > 0.45 && p < 0.55) { mult = 1.3; label = 'PERFECT!!'; color = '#4cd964'; }
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
  const mut = ev.active ? (ev.mut || rollMutation()) : null;
  $('revealRarity').innerHTML = rarityName(r) + (mut ? ` ${mutTag(mut)}` : '');
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
}

function addMoney(v) {
  save.money += v;
  save.stats.totalEarned += v;
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
  const gain = strengthRate(save.dumbbellLv) * 2 + 1;
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
  save.strength += strengthRate(save.dumbbellLv) * dt * (trainBoost ? 3 : 1);
  for (const s of save.slots) if (s) s.stored += charIncome(CHAR_BY_ID[s.id], s.star, s.mut) * dt;

  // --- 移動 ---
  const canMove = ['free', 'atBlock', 'chase'].includes(state) && !fadeBusy && !openPanel;
  dashT -= dt; dashCd -= dt;
  const spd = playerSpeed(save.speedLv) * (dashT > 0 ? DASH_MULT : 1);
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
  pState.pos.x = THREE.MathUtils.clamp(pState.pos.x, -WORLD_HALF_W + 1, WORLD_HALF_W - 1);
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
const eventSky = new THREE.Color(0x7a3cff);
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
let rankTimer = 0, eventTimer = 0;
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
  if ((rankTimer -= 0.2) <= 0) { rankTimer = 60; sendScore(); }
  const ev = currentEvent();
  $('eventStat').classList.toggle('on', ev.active);
  $('sEvent').textContent = mmss(ev.left);
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
  Digit1: 'shopPanel', Digit2: 'charPanel', Digit3: 'indexPanel', Digit4: 'settingsPanel', Digit5: 'rankPanel',
  Numpad1: 'shopPanel', Numpad2: 'charPanel', Numpad3: 'indexPanel', Numpad4: 'settingsPanel', Numpad5: 'rankPanel',
};
addEventListener('keydown', e => {
  const panelId = menuKeyPanels[e.code];
  if (!panelId || e.repeat) return;
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
  if (openPanel === 'adminPanel') { renderAdminActive(); renderGiftPicker(); }
  if (openPanel === 'settingsPanel') {
    $('nameInput').value = save.name;
    $('volInput').value = save.volume;
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
  save.launchPower = Math.min(1, Math.max(0.1, +e.target.value / 100));
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
    save.money -= c; save.dumbbellLv++;
    toast(`🏋️ ダンベル Lv.${save.dumbbellLv}！`, { color: '#ffd23f' });
  } else {
    const c = speedCost(save.speedLv + 1);
    if (save.money < c) return;
    save.money -= c; save.speedLv++;
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
  if (!sc.collected) return;   // まだ1体も持ち帰っていない人は載せない
  const sig = JSON.stringify(sc);
  if (!force && sig === lastSent) return;
  lastSent = sig;
  try { await submitScore(save.clientId, save.token, sc); } catch (e) { lastSent = ''; }
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
    const mine = me
      ? `<div class="rank-me">あなたは <b>${me.rank ?? '?'}位</b> ・ ${g.icon} ${fmtVal(g, me[g.col])}</div>`
      : '<div class="rank-me">まだ記録がありません。キャラを持ち帰ると載ります！</div>';
    const rows = list.length ? list.map((r, i) => `<div class="rank-row ${r.client_id === save.clientId ? 'me' : ''} ${i < 3 ? 'top' : ''}">
        <span class="pos">${medal(i)}</span><span class="nm">${esc(r.name)}</span><span class="val">${fmtVal(g, r[g.col])}</span></div>`).join('')
      : '<p class="dex-sum">まだだれも載っていません。一番乗りのチャンス！</p>';
    $('rankBody').innerHTML = mine + rows;
  } catch (e) {
    $('rankBody').innerHTML = '<p class="dex-sum">ランキングを読み込めませんでした。通信を確認して、もう一度開いてください。</p>';
  }
}
document.querySelectorAll('#rankPanel .rank-tab').forEach(t => t.addEventListener('click', () => { rankGenre = t.dataset.col; openRanking(); }));
$('hudRankBtn').addEventListener('click', () => openPanelById('rankPanel'));
$('titleRankBtn').addEventListener('click', () => {
  // タイトルからはランキングだけを見る（スタートは押さない）
  document.body.classList.remove('title-mode'); $('title').classList.add('hidden');
  openPanelById('rankPanel');
  rankFromTitle = true;
});

// ---------- インデックス（一度持ち帰ったキャラの図鑑） ----------
let thumb = null;
const thumbCache = {};
function charThumb(def, locked, mut = null) {
  const key = def.id + (locked ? ':l' : '') + (mut ? ':' + mut : '');
  if (thumbCache[key]) return thumbCache[key];
  if (!thumb) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(192, 192);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(3, 6, 5); sc.add(d);
    thumb = { r, sc, cam: new THREE.PerspectiveCamera(35, 1, 0.1, 50), black: new THREE.MeshBasicMaterial({ color: 0x0c0c16 }) };
  }
  const m = buildCharacter(def, locked ? null : mut);
  for (const a of m.userData.anims) a(1.3);
  if (locked) m.traverse(o => { if (o.isMesh && o.material.transparent) o.visible = false; });
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
              <div class="meta">${e ? `${MUT_BY_ID[m].name}変異はまだ` : `${ZONES[r].name}ゾーン付近で出現`}</div></div>`;
        continue;
      }
      html += e
        ? `<div class="idx-card" style="--rc:${rc}">${e.seen ? '' : '<span class="new">NEW</span>'}
            <img src="${charThumb(c, false)}" alt=""><b>${c.name}</b>
            <div class="inc">+${fmt(charIncome(c))}/秒</div>
            <div class="meta">獲得 ${e.count}回${e.first ? ` ・ ${fmtDate(e.first)}` : ''}</div>
            ${e.muts ? `<div class="meta muts">${Object.keys(e.muts).map(mutTag).join('')}</div>` : ''}</div>`
        : `<div class="idx-card locked"><img src="${charThumb(c, true)}" alt=""><b>？？？</b>
            <div class="meta">${ZONES[r].name}ゾーン付近で出現</div></div>`;
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
  if (!confirm('セーブデータをすべて消去します。よろしいですか？' + (window.KaAccount?.isLoggedIn() ? '\n（クラウドのセーブも最初からになります）' : ''))) return;
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
  location.reload();
});

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
  $('hudAccountBtn').textContent = user ? `${user.avatar} ${user.display_name}` : '👤 ログイン';
  $('nameInput').placeholder = user ? user.display_name : '名無し';
}
$('accountBtn').addEventListener('click', () => ka?.openPanel());
$('titleAccountBtn').addEventListener('click', () => ka?.openPanel());
$('hudAccountBtn').addEventListener('click', () => { unlockPointer(); ka?.openPanel(); });
ka?.onChange(user => { updateAccountUi(user); checkAdmin(); });

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
const KIND_LABEL = { message: '📢 お知らせ', gift: '🎁 配布', mutation: '🧬 変異イベント' };
function renderAdminActive() {
  const list = adminEvents.filter(e => Date.parse(e.ends_at) > Date.now());
  $('admActive').innerHTML = list.length ? list.map(e => {
    const left = Math.max(0, Math.round((Date.parse(e.ends_at) - Date.now()) / 60000));
    const future = Date.parse(e.starts_at) > Date.now();
    const what = e.kind === 'message' ? escHtml(e.payload.text)
      : e.kind === 'gift' ? `${e.payload.mut ? MUT_BY_ID[e.payload.mut].name + '変異の' : ''}${CHAR_BY_ID[e.payload.char]?.name || e.payload.char}`
      : (e.payload.mut ? MUT_BY_ID[e.payload.mut].name : 'ランダム');
    return `<div class="adm-row ${future ? 'sched' : ''}"><span>${KIND_LABEL[e.kind]}</span><b>${what}</b>
      <small>${future ? `⏰ ${fmtWhen(e.starts_at)} から` : `あと${left}分`}</small>
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
      const why = { auth: '管理者として確認できませんでした', rate: '短い時間に出しすぎです（1時間に30回まで）', text: 'メッセージは1〜120文字です', char: 'キャラが正しくありません', start: '予約は30日先までです' }[r?.reason] || 'うまく出せませんでした';
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


