// ラッキーブロックを打つ Web — メイン
import * as THREE from 'three';
import {
  RARITIES, ZONES, CHARACTERS, CHAR_BY_ID, BASE_LINE, LAUNCH_POS, ZONE_START, ZONE_LEN, WORLD_END, WORLD_HALF_W,
  MAX_STAR, SLOT_COUNT, charIncome as baseIncome, evolveCost, sellPrice as baseSellPrice, strengthRate as baseStrengthRate,
  dumbbellCost, playerSpeed, speedCost, rebirthMult, rebirthCost, launchDistance, zoneAt, rollCharacter, fmt,
} from './data.js';
import { buildPlayer, buildBoss, buildLuckyBlock, buildCharacter, textTexture, mat } from './models.js';
import { initAudio, play, startLoop, stopLoop, setVolume } from './audio.js';
import { input, initInput, pollInput, lockPointer, unlockPointer } from './input.js';

const $ = id => document.getElementById(id);

// リボーン倍率を掛けた稼ぎ・売値・力の伸び
const charIncome = (c, star = 1) => baseIncome(c, star) * rebirthMult(save.rebirths);
const sellPrice = (c, star) => Math.ceil(baseSellPrice(c, star) * rebirthMult(save.rebirths));
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
    slots: Array(SLOT_COUNT).fill(null),         // { id, star, stored }
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
    const add = charIncome(CHAR_BY_ID[s.id], s.star) * offlineSec;
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
plane(W, 60, 0x9bd770, 0, -30);
plane(40, 52, 0xd5dde2, 0, -26, 0.01);
// 発射エリア
plane(W, ZONE_START, 0x8fcf62, 0, ZONE_START / 2);
// ゾーンの地面（縞模様）
ZONES.forEach((z, i) => {
  const start = ZONE_START + i * ZONE_LEN;
  for (let k = 0; k < ZONE_LEN / 10; k++) plane(W, 10, k % 2 ? z.alt : z.ground, 0, start + k * 10 + 5);
});
// 世界の外側
plane(800, 1400, 0x3d6b2f, 0, 300, -0.05);

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
  const start = ZONE_START + i * ZONE_LEN;
  gate(start, `${z.name}  ${RARITIES[i].name}`, RARITIES[i].color === 0xffffff ? 0xff77e9 : RARITIES[i].color, `${start - LAUNCH_POS.z - 3}m〜`);
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
  }
  g.scale.setScalar(s);
  scene.add(g);
}
ZONES.forEach((z, i) => {
  const start = ZONE_START + i * ZONE_LEN;
  for (let k = 0; k < 22; k++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    decorate(z.deco, side * (11 + Math.random() * (WORLD_HALF_W - 13)), start + 4 + Math.random() * (ZONE_LEN - 8));
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
let carried = null;   // { def, model }
input.camYaw = 0;

// =====================================================================
// ボス
// =====================================================================
const bosses = ZONES.map((z, i) => {
  const b = buildBoss(z.boss);
  const home = new THREE.Vector3(0, 0, ZONE_START + i * ZONE_LEN + ZONE_LEN * 0.72);
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

const rarityName = r => RARITIES[r].css === 'rainbow'
  ? `<span class="rar rainbow-text">${RARITIES[r].name}</span>`
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
  o.model = buildCharacter(def);
  o.model.position.y = 0.6;
  o.model.scale.setScalar(1 + (s.star - 1) * 0.12);
  o.model.rotation.y = -Math.sign(SLOT_POS[i].x) * Math.PI / 2;
  o.group.add(o.model);
  o.ring.material.color.set(def.r === 6 ? 0xff77e9 : RARITIES[def.r].color);
}
save.slots.forEach((_, i) => refreshSlot(i));

function updateSlotLabels() {
  slotObjs.forEach((o, i) => {
    const s = save.slots[i];
    if (!s) return;
    const def = CHAR_BY_ID[s.id];
    setLabel(o.label,
      `<div class="m">$${fmt(s.stored)}</div><div class="n">${def.name}</div>` +
      `<div>${rarityName(def.r)} <span class="s">${stars(s.star)}</span></div><div>+${fmt(charIncome(def, s.star))}/秒</div>`);
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
  return save.slots.reduce((a, s) => a + (s ? charIncome(CHAR_BY_ID[s.id], s.star) : 0), 0);
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

function launchBlock() {
  const d = launchDistance(save.strength, flight.timing);
  const toZ = Math.min(TEE_POS.z + d, WORLD_END - 8);
  flight.from.copy(teeBlock.position);
  flight.to.set((Math.random() - 0.5) * 20, 0.8, toZ);
  flight.T = 1.4 + d / 150;
  flight.h = 6 + d * 0.28;
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
  const col = r === 6 ? 0xff77e9 : RARITIES[r].color;
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
  burst(pos, r === 6 ? 0xff77e9 : RARITIES[r].color, 50, 18);
  removeFlightBlock();
  teeBlock.visible = false;   // 持ち帰るまで次は打てない
  $('revealRarity').innerHTML = rarityName(r);
  $('revealName').textContent = def.name;
  $('revealName').className = 'name' + (r === 6 ? ' rainbow-text' : '');
  $('revealName').style.color = r === 6 ? '' : RARITIES[r].css;
  $('revealIncome').textContent = `+${fmt(charIncome(def))}/秒`;
  $('reveal').classList.add('pop');
  setTimeout(() => $('reveal').classList.add('hidden'), 2200);

  const model = buildCharacter(def);
  model.scale.setScalar(0.55);
  player.carry.add(model);
  carried = { def, model };
  save.stats.bestRarity = Math.max(save.stats.bestRarity, r);

  // ボス出現
  chaseBoss = bosses[flight.zone];
  const b = chaseBoss;
  b.from.copy(b.group.position);
  const tz = Math.min(pos.z + 26, WORLD_END - 3);
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
  const def = carried.def;
  player.carry.remove(carried.model);
  carried = null;
  endChase();
  setState('free');
  play('safe');
  save.stats.collected++;
  const isNew = !save.dex[def.id];
  const entry = save.dex[def.id] ||= { count: 0, first: Date.now(), seen: false };
  entry.count++;
  if (isNew) setTimeout(() => toast(`📖 インデックスに ${def.name} を登録！`, { color: '#ffd23f', time: 2600 }), 700);
  const idx = save.slots.findIndex(s => !s);
  if (idx >= 0) {
    save.slots[idx] = { id: def.id, star: 1, stored: 0 };
    refreshSlot(idx);
    burst(SLOT_POS[idx].clone().add(new THREE.Vector3(0, 2, 0)), RARITIES[def.r].color, 30, 10);
    toast(`🎉 ${def.name} を台座${idx + 1}に設置！${isNew ? ' <span style="color:#ffd23f">NEW!</span>' : ''}`, { color: '#7dff8a', big: true, time: 2600 });
  } else {
    const price = sellPrice(def, 1);
    addMoney(price);
    toast(`台座がいっぱい！ ${def.name} を $${fmt(price)} で売却`, { color: '#ffd23f', time: 3000 });
  }
  writeSave();
  renderPanels();
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
    if (Math.hypot(p.x - LAUNCH.x, p.z - LAUNCH.z) < 3.2) return { label: '打つ', fn: startAim };
    if (Math.hypot(p.x - DUMBBELL_POS.x, p.z - DUMBBELL_POS.z) < 3.4) return { label: '持ち上げる', fn: liftDumbbell };
    const si = nearestSlot();
    if (si >= 0 && save.slots[si]) return { label: 'キャラを見る', fn: () => openPanelById('charPanel', si) };
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
  for (const s of save.slots) if (s) s.stored += charIncome(CHAR_BY_ID[s.id], s.star) * dt;

  // --- 移動 ---
  const canMove = ['free', 'atBlock', 'chase'].includes(state) && !fadeBusy && !openPanel;
  const spd = playerSpeed(save.speedLv);
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
      $('chaseBoss').textContent = Math.round(bd) + 'm';
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
  if (labelTimer <= 0) { labelTimer = 0.2; updateHud(); updateSlotLabels(); if (openPanel === 'shopPanel') renderShop(); }
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
        b.state = 'chase'; b.t = 0;
        play('boss'); shake = 0.7;
        burst(g.position.clone().add(new THREE.Vector3(0, 1, 0)), b.def.color, 30, 14);
        startLoop('boss_run', 0.5);
      } else { b.state = 'idle'; g.rotation.y = Math.PI; }
    }
  } else if (b.state === 'chase') {
    if (state !== 'chase') { b.state = 'idle'; return; }
    const dx = pState.pos.x - g.position.x, dz = pState.pos.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (b.t > 0.5) {   // 着地後の硬直
      g.position.x += dx / d * b.def.speed * dt;
      g.position.z += dz / d * b.def.speed * dt;
      b.walk += dt * b.def.speed * 0.25;
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
function updateSky(dt) {
  const focusZ = state === 'flight' && flight.block ? flight.block.position.z : pState.pos.z;
  const z = focusZ < ZONE_START ? -1 : zoneAt(focusZ);
  tmpCol.set(z < 0 ? 0x8fd3ff : ZONES[z].sky);
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
  const unseen = Object.values(save.dex).filter(e => !e.seen).length;
  $('indexBadge').textContent = unseen;
  $('indexBadge').classList.toggle('hidden', unseen === 0 || openPanel === 'indexPanel');
}

// =====================================================================
// パネル（ショップ・キャラ・設定）
// =====================================================================
let openPanel = null;
let highlightSlot = -1;

function openPanelById(id, slot = -1) {
  closePanels();
  unlockPointer();
  openPanel = id;
  highlightSlot = slot;
  $(id).classList.remove('hidden');
  renderPanels();
}
function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  openPanel = null;
}
document.querySelectorAll('#menu button').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.panel;
  if (openPanel === id) closePanels(); else openPanelById(id);
}));
document.querySelectorAll('.panel .close').forEach(b => b.addEventListener('click', () => { closePanels(); lockPointer(); }));
addEventListener('keydown', e => { if (e.code === 'Escape') { closePanels(); if (state === 'aim') { $('timing').classList.add('hidden'); setState('free'); } } });

function renderPanels() {
  if (openPanel === 'shopPanel') renderShop();
  if (openPanel === 'charPanel') renderChars();
  if (openPanel === 'indexPanel') renderIndex();
  if (openPanel === 'settingsPanel') {
    $('nameInput').value = save.name;
    $('volInput').value = save.volume;
  }
}

let shopSig = '';
function renderShop() {
  const dl = save.dumbbellLv, sl = save.speedLv;
  const dc = dumbbellCost(dl + 1), sc = speedCost(sl + 1);
  const rn = save.rebirths, rc = rebirthCost(rn);
  const sig = [dl, sl, rn, save.money >= dc, save.money >= sc, save.money >= rc].join();
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
    <p class="dex-sum">💡 ボスの速さ: ${ZONES.map((z, i) => `${RARITIES[i].name} ${z.boss.speed}`).join(' / ')}</p>
    <p class="dex-sum">現在の力での飛距離の目安: 約${Math.round(18 + 5.5 * Math.sqrt(save.strength))}m（PERFECTで約${Math.round(18 + 5.5 * Math.sqrt(save.strength) * 1.3)}m）</p>`;
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
  shopSig = '';
  closePanels(); lockPointer();
  updateHud(); updateSlotLabels(); writeSave();
}

function renderChars() {
  const body = $('charBody');
  body.innerHTML = save.slots.map((s, i) => {
    if (!s) return `<div class="card"><div class="icon">⬜</div><div class="info"><h3>台座 ${i + 1}</h3><p class="empty-slot">空き — ブロックからキャラを持ち帰ろう</p></div></div>`;
    const def = CHAR_BY_ID[s.id];
    const canEvo = s.star < MAX_STAR;
    const cost = canEvo ? evolveCost(def, s.star) : 0;
    return `<div class="card" ${i === highlightSlot ? 'style="border-color:#ffd23f"' : ''} id="slotCard${i}">
      <div class="icon">${['⚪', '🟢', '🔵', '🟣', '🟡', '🔴', '🌈'][def.r]}</div>
      <div class="info"><h3>${def.name} <span class="s" style="color:#ffd23f">${stars(s.star)}</span></h3>
        <p>${rarityName(def.r)} ・ 台座${i + 1} ・ +${fmt(charIncome(def, s.star))}/秒</p>
        ${canEvo ? `<p>進化後: +${fmt(charIncome(def, s.star + 1))}/秒</p>` : '<p>最大まで進化済み！</p>'}</div>
      <div class="btns">
        ${canEvo ? `<button class="btn" data-evo="${i}" ${save.money < cost ? 'disabled' : ''}>進化<small>$${fmt(cost)}</small></button>` : ''}
        <button class="btn sell" data-sell="${i}">売却<small>$${fmt(sellPrice(def, s.star))}</small></button>
      </div></div>`;
  }).join('');
  if (highlightSlot >= 0) $('slotCard' + highlightSlot)?.scrollIntoView({ block: 'center' });
}
$('charBody').addEventListener('click', e => {
  const evo = e.target.closest('[data-evo]'), sell = e.target.closest('[data-sell]');
  if (evo && !evo.disabled) {
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
    if (!confirm(`${def.name}（${stars(s.star)}）を $${fmt(sellPrice(def, s.star))} で売却しますか？`)) return;
    addMoney(sellPrice(def, s.star) + s.stored);
    save.slots[i] = null;
    refreshSlot(i);
    play('coin');
  } else return;
  highlightSlot = -1;
  renderChars(); updateHud(); writeSave();
});

// ---------- インデックス（一度持ち帰ったキャラの図鑑） ----------
let thumb = null;
const thumbCache = {};
function charThumb(def, locked) {
  const key = def.id + (locked ? ':l' : '');
  if (thumbCache[key]) return thumbCache[key];
  if (!thumb) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(192, 192);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(3, 6, 5); sc.add(d);
    thumb = { r, sc, cam: new THREE.PerspectiveCamera(35, 1, 0.1, 50), black: new THREE.MeshBasicMaterial({ color: 0x0c0c16 }) };
  }
  const m = buildCharacter(def);
  for (const a of m.userData.anims) a(1.3);
  if (locked) m.traverse(o => { if (o.isMesh && o.material.transparent) o.visible = false; });
  thumb.sc.add(m);
  thumb.sc.overrideMaterial = locked ? thumb.black : null;
  const h = m.userData.height;
  thumb.cam.position.set(2.4, h * 0.6 + 1.1, 6.2);
  thumb.cam.lookAt(0, h * 0.45, 0);
  thumb.r.render(thumb.sc, thumb.cam);
  thumbCache[key] = thumb.r.domElement.toDataURL();
  thumb.sc.remove(m);
  return thumbCache[key];
}

const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
function renderIndex() {
  const got = CHARACTERS.filter(c => save.dex[c.id]).length;
  let html = `<div class="idx-total"><span class="num">${got} / ${CHARACTERS.length}</span>
    <div class="progress"><div style="width:${got / CHARACTERS.length * 100}%"></div></div>
    <span>${Math.floor(got / CHARACTERS.length * 100)}%</span></div>`;
  RARITIES.forEach((rar, r) => {
    const pool = CHARACTERS.filter(c => c.r === r);
    const n = pool.filter(c => save.dex[c.id]).length;
    const rc = rar.css === 'rainbow' ? '#ff77e9' : rar.css;
    html += `<div class="idx-sec"><h3>${rarityName(r)}<span class="cnt ${n === pool.length ? 'done' : ''}">${n === pool.length ? '👑 コンプリート ' : ''}${n} / ${pool.length}</span></h3><div class="idx-grid">`;
    for (const c of pool) {
      const e = save.dex[c.id];
      html += e
        ? `<div class="idx-card" style="--rc:${rc}">${e.seen ? '' : '<span class="new">NEW</span>'}
            <img src="${charThumb(c, false)}" alt=""><b>${c.name}</b>
            <div class="inc">+${fmt(charIncome(c))}/秒</div>
            <div class="meta">獲得 ${e.count}回${e.first ? ` ・ ${fmtDate(e.first)}` : ''}</div></div>`
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
    $('accountBtn').classList.add('hidden'); $('titleAccountBtn').classList.add('hidden');
    return;
  }
  $('accountStatus').textContent = user
    ? `${user.avatar} ${user.display_name}（@${user.username}）でログイン中。セーブはクラウドに自動で保存されます。`
    : 'ログインすると、セーブがクラウドに保存されて別の端末でも続きから遊べます。';
  $('accountBtn').textContent = user ? 'アカウント・同期の状態' : 'ログイン / アカウントを作る';
  $('titleAccountBtn').textContent = user ? `${user.avatar} ${user.display_name} でログイン中` : '👤 かるわかGAMESアカウントでログイン';
  $('nameInput').placeholder = user ? user.display_name : '名無し';
}
$('accountBtn').addEventListener('click', () => ka?.openPanel());
$('titleAccountBtn').addEventListener('click', () => ka?.openPanel());
ka?.onChange(user => updateAccountUi(user));
updateAccountUi();
// アカウントの画面（同期の確認など）が出たらマウスロックを外して操作できるようにする
new MutationObserver(() => { if (document.querySelector('.ka-overlay')) unlockPointer(); })
  .observe(document.body, { childList: true });

// =====================================================================
// 起動
// =====================================================================
if (input.isTouch) document.body.classList.add('touch');
$('ctrlHint').textContent = input.isTouch
  ? '左下スティックで移動・右下ボタンで行動・スワイプで視点'
  : 'WASDで移動・クリックでマウスロック（マウスで視点）・左クリック / E / スペースで行動・Escで解除';
initInput(renderer.domElement);
setVolume(save.volume);

$('startBtn').addEventListener('click', () => {
  initAudio();
  $('title').classList.add('hidden');
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
