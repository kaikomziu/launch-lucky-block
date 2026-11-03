// 3Dモデル生成（プレイヤー・ボス・キャラクター・ラッキーブロック）
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const glowMat = (color, intensity = 0.9) =>
  new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity });

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

// ---------- プレイヤー（ブロック人間風） ----------
export function buildPlayer() {
  const g = new THREE.Group();
  const skin = mat(0xffd29c), shirt = mat(0x3a8dff), pants = mat(0x2d3436), black = mat(0x111111);

  const torso = box(2, 2, 1, shirt); torso.position.y = 3; g.add(torso);
  const head = box(1.2, 1.2, 1.2, skin); head.position.y = 4.6; g.add(head);
  const eyeL = box(0.18, 0.28, 0.05, black); eyeL.position.set(-0.25, 4.7, 0.61); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.25; g.add(eyeR);
  const mouth = box(0.45, 0.08, 0.05, black); mouth.position.set(0, 4.35, 0.61); g.add(mouth);

  const limb = (x, y, material, len) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = box(0.9, len, 0.9, material); m.position.y = -len / 2; pivot.add(m);
    g.add(pivot); return pivot;
  };
  const armL = limb(-1.45, 3.9, skin, 2);
  const armR = limb(1.45, 3.9, skin, 2);
  const legL = limb(-0.5, 2, pants, 2);
  const legR = limb(0.5, 2, pants, 2);

  // バット（右腕の延長）
  const bat = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), mat(0x6b4423));
  handle.position.y = -0.5;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 2.0, 10), mat(0xc8894a));
  barrel.position.y = -2.0; barrel.castShadow = true;
  bat.add(handle, barrel);
  bat.position.y = -1.9;
  armR.add(bat);

  const carry = new THREE.Group(); carry.position.y = 5.6; g.add(carry);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, armL, armR, legL, legR, bat, carry };
}

// ---------- ボス ----------
export function buildBoss(def) {
  const g = new THREE.Group();
  const body = mat(def.color);
  const dark = mat(new THREE.Color(def.color).multiplyScalar(0.55).getHex());
  const eye = glowMat(0xff2020, 1.2);

  const inner = new THREE.Group(); g.add(inner);
  const torso = box(3, 3, 2.2, body); torso.position.y = 4; inner.add(torso);
  const head = box(2.4, 2, 2.2, body); head.position.y = 6.5; inner.add(head);
  const eL = box(0.5, 0.35, 0.1, eye); eL.position.set(-0.55, 6.7, 1.12); inner.add(eL);
  const eR = eL.clone(); eR.position.x = 0.55; inner.add(eR);
  const jaw = box(1.6, 0.3, 0.1, mat(0x111111)); jaw.position.set(0, 6.0, 1.12); inner.add(jaw);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), dark);
    horn.position.set(s * 0.9, 8, 0); horn.rotation.z = -s * 0.4; inner.add(horn);
  }
  const limb = (x, y, w, len, material) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    const m = box(w, len, w, material); m.position.y = -len / 2; p.add(m);
    inner.add(p); return p;
  };
  const armL = limb(-2, 5.2, 1, 3, dark);
  const armR = limb(2, 5.2, 1, 3, dark);
  const legL = limb(-0.8, 2.5, 1.2, 2.5, dark);
  const legR = limb(0.8, 2.5, 1.2, 2.5, dark);

  g.scale.setScalar(def.scale / 2);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, armL, armR, legL, legR };
}

// ---------- ラッキーブロック ----------
let blockTex = null;
function luckyTexture() {
  if (blockTex) return blockTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, 128, 10); x.fillRect(0, 118, 128, 10);
  x.fillRect(0, 0, 10, 128); x.fillRect(118, 0, 10, 128);
  x.fillStyle = '#7a5a00'; x.font = 'bold 96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('?', 64, 70);
  x.fillStyle = '#fff6c9'; x.fillText('?', 60, 66);
  blockTex = new THREE.CanvasTexture(c);
  blockTex.colorSpace = THREE.SRGBColorSpace;
  return blockTex;
}
export function buildLuckyBlock() {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshLambertMaterial({ map: luckyTexture(), color: 0xffd23f, emissive: 0x332200 })
  );
  m.castShadow = true;
  return m;
}

// ---------- 看板などのテキストテクスチャ ----------
export function textTexture(text, { bg = '#222', fg = '#fff', w = 512, h = 128, font = 'bold 64px sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 12; x.strokeRect(0, 0, w, h);
  x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- キャラクター ----------
const SHAPES = {
  sphere: { top: 2.0, eyeY: 1.15, front: 0.88 },
  box:    { top: 1.8, eyeY: 1.05, front: 0.91 },
  cyl:    { top: 1.8, eyeY: 1.15, front: 0.84 },
  dome:   { top: 1.6, eyeY: 0.9,  front: 0.8 },
  egg:    { top: 2.5, eyeY: 1.45, front: 0.82 },
  cone:   { top: 2.2, eyeY: 0.8,  front: 0.62 },
};

// 変異キャラの体の素材
const MUT_BODY = {
  gold:    { color: 0xffcf33, emissive: 0x8a5a00, emissiveIntensity: 0.55 },
  diamond: { color: 0xc9f7ff, emissive: 0x2a9cc0, emissiveIntensity: 0.45 },
  galaxy:  { color: 0x2b0f55, emissive: 0x6a3cff, emissiveIntensity: 0.6 },
};
const MUT_SPARK = { gold: 0xfff27a, diamond: 0xffffff, galaxy: 0xff7ae0 };

export function buildCharacter(def, mut = null) {
  const g = new THREE.Group();
  const anims = [];
  const mb = mut && MUT_BODY[mut];
  const rainbow = def.extras.includes('rainbow') && !mb;
  const body = mb
    ? new THREE.MeshLambertMaterial(mb)
    : rainbow
      ? new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x222222 })
      : mat(def.color);
  const accent = mat(def.accent);
  const accentGlow = glowMat(def.accent, 0.8);
  const S = SHAPES[def.shape];

  let mainMesh;
  if (def.shape === 'sphere') {
    mainMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), body); mainMesh.position.y = 1;
  } else if (def.shape === 'box') {
    mainMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), body); mainMesh.position.y = 0.9;
  } else if (def.shape === 'cyl') {
    mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.8, 18), body); mainMesh.position.y = 0.9;
  } else if (def.shape === 'egg') {
    mainMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), body);
    mainMesh.scale.set(0.9, 1.25, 0.9); mainMesh.position.y = 1.25;
  } else if (def.shape === 'cone') {
    mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.0, 2.2, 18), body); mainMesh.position.y = 1.1;
  } else {
    mainMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), body);
    mainMesh.position.y = 0.6;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 20), body);
    bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.6; g.add(bottom);
  }
  g.add(mainMesh);

  // 目
  const white = mat(0xffffff), black = mat(0x111111);
  // 体が暗い色のときは目を光らせて見やすくする
  const dark = new THREE.Color(def.color).getHSL({}).l < 0.12;
  const eyeColor = dark ? glowMat(def.accent, 1) : black;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), white);
    e.position.set(s * 0.36, S.eyeY, S.front); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeColor);
    p.position.set(s * 0.36, S.eyeY, S.front + 0.15); g.add(p);
  }

  const top = S.top;
  const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };

  for (const ex of def.extras) {
    switch (ex) {
      case 'blush':
        for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), accent), s * 0.6, S.eyeY - 0.3, S.front - 0.02);
        break;
      case 'ears':
        for (const s of [-1, 1]) {
          const e = add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), def.color === 0x0b0b12 ? accentGlow : body), s * 0.55, top + 0.2, 0);
          e.rotation.z = -s * 0.25;
        }
        break;
      case 'cap': {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), accent), 0, top - 0.1, 0);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), white), Math.cos(a) * 0.8, top + 0.75, Math.sin(a) * 0.8);
        }
        c.scale.y = 0.75;
        break;
      }
      case 'arms':
        for (const s of [-1, 1]) {
          const a = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8), body), s * 1.15, 1.0, 0);
          a.rotation.z = s * 0.9;
        }
        break;
      case 'flower':
        add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), accent), 0.3, top + 0.15, 0);
        break;
      case 'tophat': {
        const hatMat = mat(def.shape === 'cyl' ? 0x111111 : def.accent);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16), hatMat), 0, top + 0.02, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16), hatMat), 0, top + 0.5, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.15, 16), mat(0xff4d6d)), 0, top + 0.15, 0);
        break;
      }
      case 'acorn': {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent), 0, top - 0.55, 0);
        c.scale.y = 0.8;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6), accent), 0, top + 0.3, 0);
        break;
      }
      case 'belly': {
        const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), accent), 0, 0.85, 0.45);
        b.scale.z = 0.6;
        break;
      }
      case 'helmet': {
        add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(0xaab4c0)), 0, 1.1, 0);
        add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 6), mat(0xe63946)), 0, top + 0.3, -0.1);
        break;
      }
      case 'tentacles':
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          const t = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.9, 6), accent), Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6);
          anims.push(time => { t.rotation.x = Math.sin(time * 3 + i) * 0.35; });
        }
        break;
      case 'tiara':
        add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 16), mat(0xffd23f)), 0, top - 0.05, 0).rotation.x = Math.PI / 2;
        add(new THREE.Mesh(new THREE.OctahedronGeometry(0.15), glowMat(0xff4fa3)), 0, top + 0.15, 0.2);
        break;
      case 'antenna': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), mat(0x555555)), 0, top + 0.4, 0);
        const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat(0xff3b3b)), 0, top + 0.85, 0);
        anims.push(time => { ball.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(time * 4)); });
        break;
      }
      case 'visor':
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1), accentGlow), 0, S.eyeY, S.front + 0.25);
        break;
      case 'horns':
        for (const s of [-1, 1]) {
          const h = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 6), accent), s * 0.5, top + 0.15, 0);
          h.rotation.z = -s * 0.35;
        }
        break;
      case 'wings':
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group(); pivot.position.set(s * 0.6, 1.2, -0.6); g.add(pivot);
          const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.08), def.extras.includes('rainbow') ? mat(0xfff0fb) : accent);
          w.position.x = s * 0.7; pivot.add(w);
          anims.push(time => { pivot.rotation.y = s * (0.3 + Math.sin(time * 6) * 0.4); });
        }
        break;
      case 'stars': {
        const holder = new THREE.Group(); holder.position.y = top * 0.6; g.add(holder);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * Math.PI * 2;
          const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glowMat(0xfff27a, 1));
          st.position.set(Math.cos(a) * 1.5, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.5); holder.add(st);
        }
        anims.push(time => { holder.rotation.y = time * 1.5; });
        break;
      }
      case 'glow': {
        const aura = add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12),
          new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })),
          0, top * 0.5, 0);
        anims.push(time => { aura.scale.setScalar(1 + Math.sin(time * 3) * 0.08); });
        break;
      }
      case 'crown': {
        const gold = glowMat(0xffd23f, 0.35);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 12, 1, true), gold), 0, top + 0.17, 0);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), gold), Math.cos(a) * 0.55, top + 0.5, Math.sin(a) * 0.55);
        }
        add(new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glowMat(0xff3b3b)), 0, top + 0.2, 0.62);
        break;
      }
      case 'flame':
        for (let i = 0; i < 3; i++) {
          const f = add(new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.05, 0.9, 6), glowMat(i === 1 ? 0xffe066 : 0xff7b00, 1)), (i - 1) * 0.35, top + 0.35, -0.1);
          anims.push(time => { f.scale.y = 0.8 + Math.abs(Math.sin(time * 8 + i)) * 0.5; });
        }
        break;
      case 'katana': {
        const k = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.18), mat(0xdfe6ee)), 1.15, 1.1, -0.3);
        k.rotation.z = 0.4;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), mat(0x222222)), 0.95, 0.65, -0.3);
        break;
      }
      case 'cracks':
        for (let i = 0; i < 5; i++) {
          const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.02), accentGlow),
            (Math.random() - 0.5) * 1.3, 0.5 + Math.random() * 1, 0.92);
          c.rotation.z = (Math.random() - 0.5) * 1.5;
        }
        break;
      case 'bolt': {
        const b = new THREE.Group(); b.position.y = top + 0.9; g.add(b);
        const y = glowMat(0xffe600, 1);
        [[0, 0.3, 0.4], [0.15, 0, -0.4], [0, -0.3, 0.4]].forEach(([x, yy, r]) => {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), y);
          s.position.set(x, yy, 0); s.rotation.z = r; b.add(s);
        });
        anims.push(time => { b.rotation.y = time * 2; b.visible = Math.sin(time * 9) > -0.6; });
        break;
      }
      case 'ring': {
        const r = add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 8, 32), accentGlow), 0, top * 0.5, 0);
        r.rotation.x = Math.PI / 2.4;
        anims.push(time => { r.rotation.z = time; });
        break;
      }
      case 'unihorn': {
        const h = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 8), glowMat(0xffd23f, 0.5)), 0, S.eyeY + 0.7, S.front - 0.1);
        h.rotation.x = 0.5;
        break;
      }
      case 'halo': {
        const h = add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 24), glowMat(0xfff7a8, 1)), 0, top + 0.6, 0);
        h.rotation.x = Math.PI / 2;
        anims.push(time => { h.position.y = top + 0.6 + Math.sin(time * 2) * 0.1; });
        break;
      }
      case 'tail': {
        const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.1, 8), body), 0, 0.5, -1.05);
        t.rotation.x = -1.1;
        anims.push(time => { t.rotation.z = Math.sin(time * 4) * 0.4; });
        break;
      }
      case 'beak': {
        const b = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), accent), 0, S.eyeY - 0.3, S.front + 0.2);
        b.rotation.x = Math.PI / 2;
        break;
      }
      case 'mustache':
        for (const s of [-1, 1]) {
          const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.1), mat(0x2a1a10)), s * 0.24, S.eyeY - 0.38, S.front + 0.08);
          m.rotation.z = s * 0.25;
        }
        break;
      case 'glasses':
        for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 6, 18), mat(0x111111)), s * 0.36, S.eyeY, S.front + 0.2);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat(0x111111)), 0, S.eyeY, S.front + 0.2);
        break;
      case 'scarf': {
        const sc = add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.17, 8, 24), accent), 0, S.eyeY - 0.55, 0);
        sc.rotation.x = Math.PI / 2;
        const tail = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.1), accent), 0.45, S.eyeY - 0.95, S.front - 0.05);
        anims.push(time => { tail.rotation.z = 0.2 + Math.sin(time * 3) * 0.15; });
        break;
      }
      case 'sprout': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0x3a9d23)), 0, top + 0.2, 0);
        for (const s of [-1, 1]) {
          const l = add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0x5cd64a)), s * 0.22, top + 0.45, 0);
          l.scale.set(1.3, 0.4, 0.8); l.rotation.z = s * 0.4;
        }
        break;
      }
      case 'spikes':
        // 背中に沿ってトゲを並べる
        for (const a of [0.35, 0.9, 1.45]) {
          for (const phi of [-1.1, 0, 1.1]) {
            const d = new THREE.Vector3(Math.sin(a) * Math.sin(phi), Math.cos(a), -Math.sin(a) * Math.cos(phi));
            const R = top * 0.5 + 0.12;
            const sp = add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), accent), d.x * R, top * 0.5 + d.y * R, d.z * R);
            sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
          }
        }
        break;
      case 'bow': {
        for (const s of [-1, 1]) {
          const w = add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), accent), s * 0.28, top + 0.1, 0.1);
          w.rotation.z = s * Math.PI / 2;
        }
        add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), accent), 0, top + 0.1, 0.1);
        break;
      }
      case 'headphones': {
        const hy = Math.max(S.eyeY + 0.1, top - 1.05);
        add(new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.1, 6, 24, Math.PI), mat(0x222233)), 0, hy, 0);
        for (const s of [-1, 1]) {
          const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), accentGlow), s * 1.05, hy, 0);
          p.rotation.z = Math.PI / 2;
        }
        break;
      }
      case 'shell': {
        const sh = add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), accent), 0, top * 0.4, -0.55);
        sh.rotation.x = -1.2;
        break;
      }
      case 'fins': {
        add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), accent), 0, top + 0.25, -0.2).scale.z = 0.3;
        for (const s of [-1, 1]) {
          const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.4), accent), s * 1.0, top * 0.4, 0);
          anims.push(time => { f.rotation.z = -s * (0.5 + Math.sin(time * 5) * 0.25); });
        }
        break;
      }
      case 'eyepatch': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14), mat(0x111111)), -0.36, S.eyeY, S.front + 0.2).rotation.x = Math.PI / 2;
        const st = add(new THREE.Mesh(new THREE.TorusGeometry(S.front + 0.12, 0.03, 4, 28), mat(0x111111)), 0, S.eyeY + 0.12, 0);
        st.rotation.x = Math.PI / 2; st.rotation.y = 0.25;
        break;
      }
      case 'cape': {
        const pivot = new THREE.Group(); pivot.position.set(0, top * 0.75, -0.75); g.add(pivot);
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.06), accent); c.position.y = -0.8; pivot.add(c);
        anims.push(time => { pivot.rotation.x = -0.15 - Math.abs(Math.sin(time * 2.5)) * 0.25; });
        break;
      }
      case 'propeller': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat(0x555555)), 0, top + 0.2, 0);
        const p = new THREE.Group(); p.position.y = top + 0.42; g.add(p);
        for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.2), accent); b.position.x = s * 0.45; p.add(b); }
        anims.push(time => { p.rotation.y = time * 14; });
        break;
      }
      case 'gem': {
        const gm = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.25), glowMat(def.accent, 1)), 0, S.eyeY + 0.5, S.front - 0.05);
        anims.push(time => { gm.rotation.y = time * 2; });
        break;
      }
      case 'teeth':
        for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), white), s * 0.12, S.eyeY - 0.45, S.front + 0.02).rotation.x = Math.PI;
        break;
      case 'topcap': {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent), 0, top - 0.5, 0);
        c.scale.set(0.95, 0.55, 0.95);
        break;
      }
      case 'nori':
        add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.1), accent), 0, 0.38, 0.86);
        break;
      case 'puffs':
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), body), Math.cos(a) * 0.95, 0.8 + (i % 2) * 0.25, Math.sin(a) * 0.55 - 0.15);
        }
        break;
      case 'orbit': {
        const holder = new THREE.Group(); holder.position.y = top * 0.55; g.add(holder);
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.18 + i * 0.04, 10, 8), glowMat([0xffd23f, 0x7ad7ff, 0xff7ae0][i], 0.8));
          const a = i / 3 * Math.PI * 2;
          m.position.set(Math.cos(a) * 1.7, (i - 1) * 0.35, Math.sin(a) * 1.7); holder.add(m);
        }
        anims.push(time => { holder.rotation.y = -time * 1.2; });
        break;
      }
      case 'rainbow':
        if (!rainbow) break;   // 変異中は変異の色を優先
        anims.push(time => {
          body.color.setHSL((time * 0.15) % 1, def.color === 0x111111 ? 0.6 : 0.5, def.color === 0x111111 ? 0.25 : 0.82);
        });
        break;
    }
  }

  // 変異: まわりを回るキラキラ
  if (mb) {
    const holder = new THREE.Group(); holder.position.y = top * 0.5; g.add(holder);
    const sp = glowMat(MUT_SPARK[mut], 1);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), sp);
      const a = i / 6 * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.35, Math.sin(a * 3) * 0.5, Math.sin(a) * 1.35); holder.add(s);
    }
    anims.push(time => { holder.rotation.y = time * 2.2; holder.children.forEach((s, i) => s.scale.setScalar(0.7 + Math.abs(Math.sin(time * 4 + i)) * 0.8)); });
    if (mut === 'diamond') anims.push(time => { body.emissiveIntensity = 0.35 + Math.abs(Math.sin(time * 3)) * 0.35; });
    if (mut === 'galaxy') anims.push(time => { body.emissive.setHSL(0.72 + Math.sin(time) * 0.08, 1, 0.45); });
  }

  g.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  g.userData.anims = anims;
  g.userData.height = top + 0.6;
  return g;
}
