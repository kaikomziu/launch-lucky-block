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
// sk: data.js の SKINS の1つ（省略時はいつもの見た目）
export function buildPlayer(sk = {}) {
  const g = new THREE.Group();
  const anims = [];
  const skin = mat(sk.skin ?? 0xffd29c), pants = mat(sk.pants ?? 0x2d3436), black = mat(0x111111);
  // 服は光る・虹色になるスキンがあるので専用の素材にする
  const shirt = (sk.glow || sk.rainbow)
    ? new THREE.MeshLambertMaterial({ color: sk.shirt ?? 0x3a8dff, emissive: sk.glow ?? 0x222222 })
    : mat(sk.shirt ?? 0x3a8dff);
  if (sk.rainbow) anims.push(t => shirt.color.setHSL((t * 0.15) % 1, 0.75, 0.6));

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
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 2.0, 10), mat(sk.bat ?? 0xc8894a));
  barrel.position.y = -2.0; barrel.castShadow = true;
  bat.add(handle, barrel);
  bat.position.y = -1.9;
  armR.add(bat);

  // 頭の飾り
  const hc = mat(sk.hatColor ?? 0xffd23f);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (sk.hat === 'cap') {
    const c = add(new THREE.SphereGeometry(0.66, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 5.15, 0); c.scale.y = 0.7;
    add(new THREE.BoxGeometry(1.0, 0.08, 0.6), hc, 0, 5.18, 0.75);
  } else if (sk.hat === 'headband') {
    add(new THREE.BoxGeometry(1.26, 0.22, 1.26), hc, 0, 4.98, 0);
    const tail = add(new THREE.BoxGeometry(0.12, 0.6, 0.18), hc, 0.2, 4.75, -0.7); tail.rotation.x = 0.5;
    anims.push(t => { tail.rotation.z = Math.sin(t * 6) * 0.3; });
  } else if (sk.hat === 'crown') {
    const gold = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6a4200 });
    add(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 12, 1, true), gold, 0, 5.35, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(0.11, 0.32, 4), gold, Math.cos(a) * 0.55, 5.62, Math.sin(a) * 0.55); }
  } else if (sk.hat === 'horns') {
    for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.16, 0.6, 6), mat(0xfff1d6), s * 0.42, 5.45, 0); h.rotation.z = -s * 0.4; }
  } else if (sk.hat === 'halo') {
    const h = add(new THREE.TorusGeometry(0.5, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: 0xfff7a8 }), 0, 5.6, 0);
    h.rotation.x = Math.PI / 2;
    anims.push(t => { h.position.y = 5.6 + Math.sin(t * 2) * 0.08; });
  }
  // 背中の飾り
  const bc = mat(sk.backColor ?? 0xe63946);
  if (sk.back === 'cape') {
    const pv = new THREE.Group(); pv.position.set(0, 3.95, -0.55); g.add(pv);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.06), bc); c.position.y = -1.2; pv.add(c);
    anims.push(t => { pv.rotation.x = -0.12 - Math.abs(Math.sin(t * 3)) * 0.18; });
  } else if (sk.back === 'wings') {
    for (const s of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(s * 0.4, 3.6, -0.55); g.add(pv);
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), bc); w.position.x = s * 0.8; pv.add(w);
      anims.push(t => { pv.rotation.y = s * (0.35 + Math.sin(t * 4) * 0.3); });
    }
  }

  const carry = new THREE.Group(); carry.position.y = 5.6; g.add(carry);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, armL, armR, legL, legR, bat, carry, anims };
}

// ---------- ボス（ゾーンごとに違う姿） ----------
// どのボスも armL / armR / legL / legR の回転軸（Group）を返す。追いかけるときの手足の動きは main.js が回す。
// それ以外の動き（羽ばたき・しっぽ・触手など）は anims に入れ、(t, walk) で呼ばれる。
export function buildBoss(def) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const anims = [];
  const body = mat(def.color);
  const dark = mat(new THREE.Color(def.color).multiplyScalar(0.55).getHex());
  const light = mat(new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.45).getHex());
  const black = mat(0x111111), white = mat(0xffffff);
  const eye = glowMat(0xff2020, 1.2);
  const add = (geo, m, x, y, z, parent = inner) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  const C = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
  const K = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
  // 手足の回転軸（中に見た目を入れる）
  const pivot = (x, y, z = 0, parent = inner) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const limb = (x, y, w, len, m, z = 0) => { const p = pivot(x, y, z); add(B(w, len, w), m, 0, -len / 2, 0, p); return p; };
  const eyes = (y, z, gap = 0.55, w = 0.5, h = 0.35, m = eye) => {
    for (const s of [-1, 1]) add(B(w, h, 0.1), m, s * gap, y, z);
  };
  const crown = (y, r = 0.9, m = glowMat(0xffd23f, 0.4)) => {
    add(C(r, r, 0.5, 12, true), m, 0, y, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(K(0.18, 0.55, 4), m, Math.cos(a) * r * 0.9, y + 0.5, Math.sin(a) * r * 0.9); }
  };
  const wings = (y, z, span, m, flap = 6) => {
    for (const s of [-1, 1]) {
      const p = pivot(s * 0.8, y, z);
      add(B(span, 0.15, 1.6), m, s * span / 2, 0, 0, p);
      add(B(span * 0.6, 0.12, 1.1), m, s * span * 0.8, -0.1, -0.5, p);
      anims.push(t => { p.rotation.z = s * (0.25 + Math.sin(t * flap) * 0.45); });
    }
  };
  const tail = (y, z, len, m, segs = 5) => {
    let parent = pivot(0, y, z), first = parent;
    for (let i = 0; i < segs; i++) {
      const r = 0.55 - i * 0.08;
      add(B(r * 2, r * 2, len / segs), m, 0, 0, -len / segs / 2, parent);
      const next = pivot(0, 0, -len / segs, parent); parent = next;
    }
    anims.push(t => { let p = first, i = 0; while (p) { p.rotation.y = Math.sin(t * 3 - i * 0.6) * 0.18; p = p.children.find(c => c.isGroup); i++; } });
  };
  let armL, armR, legL, legR;

  switch (def.kind) {
    case 'slime': {   // ぷるぷるの大きなスライムに王冠
      const sl = new THREE.MeshLambertMaterial({ color: def.color, transparent: true, opacity: 0.85 });
      const d = add(S(3, 20, 14), sl, 0, 2.6, 0); d.scale.set(1.15, 0.9, 1.1);
      add(S(1.3), light, 0.9, 4.2, 1.2).scale.set(0.6, 0.4, 0.3);   // つや
      eyes(3.6, 3.05, 0.9, 0.7, 0.9, black);
      add(B(1.4, 0.25, 0.1), black, 0, 2.6, 3.1);
      crown(5.1, 1.1);
      anims.push(t => { d.scale.set(1.15 + Math.sin(t * 4) * 0.06, 0.9 - Math.sin(t * 4) * 0.06, 1.1); });
      armL = limb(-3.1, 3, 0.9, 1.4, sl); armR = limb(3.1, 3, 0.9, 1.4, sl);
      legL = pivot(-1, 0.3); legR = pivot(1, 0.3);
      break;
    }
    case 'worm': {   // 砂から出てきた大きなワーム。口に歯
      const segs = [];
      for (let i = 0; i < 6; i++) {
        const r = 1.6 - i * 0.12;
        const s = add(S(r, 14, 10), i % 2 ? dark : body, 0, 1.2 + i * 1.25, -i * 0.55);
        segs.push(s);
      }
      const head = segs[5];
      add(C(1.2, 1.4, 0.6, 14), mat(0x3a1a10), 0, 8.0, -2.2).rotation.x = 0.9;   // 口
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const tth = add(K(0.15, 0.5, 4), white, Math.cos(a) * 1.0, 8.2 + Math.sin(a) * 0.5, -1.9 + Math.sin(a) * 0.4); tth.rotation.x = -0.8; }
      eyes(7.4, -0.95, 0.9, 0.35, 0.35);
      anims.push(t => segs.forEach((s, i) => { s.position.x = Math.sin(t * 3 - i * 0.7) * 0.4; }));
      armL = pivot(-1.5, 3); armR = pivot(1.5, 3);
      legL = pivot(-1, 1); legR = pivot(1, 1);
      void head;
      break;
    }
    case 'golem': {   // 氷のかたまりのゴーレム
      const ice = new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x1a4a66, emissiveIntensity: 0.4 });
      add(B(3.6, 3.2, 2.4), ice, 0, 4.2, 0);
      add(B(2.2, 1.8, 2.0), ice, 0, 6.6, 0);
      eyes(6.7, 1.02, 0.5, 0.45, 0.3, glowMat(0x7df9ff, 1.2));
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const c = add(K(0.35, 1.4, 5), light, s * (1.9 + i * 0.2), 5.9 + i * 0.3, -0.3 + i * 0.3); c.rotation.z = -s * 0.5; }
      for (let i = 0; i < 4; i++) add(K(0.3, 1.1, 5), light, -0.75 + i * 0.5, 7.9, 0);
      armL = limb(-2.4, 5.6, 1.3, 3.4, ice); armR = limb(2.4, 5.6, 1.3, 3.4, ice);
      legL = limb(-0.9, 2.6, 1.4, 2.6, dark); legR = limb(0.9, 2.6, 1.4, 2.6, dark);
      break;
    }
    case 'mushroom': {   // 毒キノコの王さま
      add(C(1.3, 1.6, 3.4, 14), mat(0xeadff5), 0, 3.2, 0);
      const cap = add(S(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 4.8, 0); cap.scale.y = 0.75;
      cap.geometry = new THREE.SphereGeometry(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(S(0.4, 8, 6), glowMat(0xc8ff3a, 0.6), Math.cos(a) * 2, 6.0, Math.sin(a) * 2); }
      eyes(3.8, 1.35, 0.5, 0.4, 0.35, glowMat(0xc8ff3a, 1.2));
      crown(6.95, 0.8);
      armL = limb(-1.8, 4.2, 0.6, 2.4, mat(0xeadff5)); armR = limb(1.8, 4.2, 0.6, 2.4, mat(0xeadff5));
      add(C(0.08, 0.08, 3.2, 6), mat(0x5a3a1a), 0, -1.6, 0.4, armR);   // つえ
      add(S(0.4, 10, 8), glowMat(0xc8ff3a, 1), 0, -3.2, 0.4, armR);
      legL = limb(-0.7, 1.6, 0.8, 1.6, dark); legR = limb(0.7, 1.6, 0.8, 1.6, dark);
      break;
    }
    case 'knight': {   // 金の鎧の騎士。剣と盾
      const gold = new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x4a3200, emissiveIntensity: 0.4 });
      add(B(3, 3, 2.2), gold, 0, 4, 0);
      add(B(2.2, 2.1, 2.2), gold, 0, 6.5, 0);
      add(B(1.8, 0.3, 0.1), black, 0, 6.6, 1.12);   // のぞき穴
      eyes(6.6, 1.15, 0.45, 0.35, 0.2);
      const plume = add(B(0.35, 1.4, 1.8), mat(0xe63946), 0, 8.1, -0.2);
      anims.push(t => { plume.rotation.x = Math.sin(t * 4) * 0.12; });
      armL = limb(-2, 5.2, 1, 3, dark); armR = limb(2, 5.2, 1, 3, dark);
      add(B(0.25, 2.8, 2.2), gold, -0.6, -2.2, 0.3, armL);   // 盾
      add(B(0.3, 0.9, 1.0), mat(0xe63946), -0.75, -2.2, 0.3, armL);
      add(B(0.2, 4.2, 0.45), mat(0xe8eef5), 0, -4.4, 0.4, armR);   // 剣
      add(B(1.2, 0.25, 0.4), gold, 0, -2.4, 0.4, armR);
      legL = limb(-0.8, 2.5, 1.2, 2.5, dark); legR = limb(0.8, 2.5, 1.2, 2.5, dark);
      break;
    }
    case 'dragon': {   // 溶岩のドラゴン（四つ足・羽・しっぽ）
      const lava = glowMat(0xffb020, 0.9);
      add(B(3, 2.6, 5.5), body, 0, 3.6, 0);
      for (let i = 0; i < 4; i++) add(K(0.4, 1.2, 4), lava, 0, 5.2, 2 - i * 1.3);
      const neck = add(B(1.6, 1.6, 2), body, 0, 5, 3.2); neck.rotation.x = -0.6;
      add(B(2.2, 1.8, 2.6), body, 0, 6.3, 4.4);
      add(B(1.6, 0.8, 1.6), dark, 0, 5.8, 5.9);   // 口先
      eyes(6.7, 5.72, 0.55, 0.4, 0.3, glowMat(0xffe600, 1.3));
      for (const s of [-1, 1]) { const h = add(K(0.3, 1.5, 6), mat(0x2b1a17), s * 0.8, 7.6, 3.9); h.rotation.x = -0.6; }
      wings(5, 0, 4.5, dark, 3);
      tail(3.6, -2.7, 5, body);
      legL = limb(-1.2, 2.5, 1, 2.5, dark, 2); legR = limb(1.2, 2.5, 1, 2.5, dark, 2);
      armL = pivot(0, 0); armR = pivot(0, 0);
      const bl = limb(-1.2, 2.5, 1, 2.5, dark, -2), br = limb(1.2, 2.5, 1, 2.5, dark, -2);
      anims.push((t, w) => { bl.rotation.x = -legL.rotation.x; br.rotation.x = -legR.rotation.x; void w; });
      break;
    }
    case 'void': {   // フードをかぶった虚空の王（浮いている）
      const robe = mat(0x1b1030);
      add(K(2.6, 6, 16), robe, 0, 3.5, 0);
      add(S(1.3, 16, 12), robe, 0, 7.1, 0);
      const hood = add(S(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), body, 0, 7.3, -0.1);
      hood.geometry = new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6);
      add(B(1.4, 1.0, 0.2), black, 0, 7.0, 1.1);
      eyes(7.1, 1.25, 0.35, 0.3, 0.2, glowMat(0xb388ff, 1.5));
      const orb = new THREE.Group(); orb.position.y = 5; inner.add(orb);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(new THREE.OctahedronGeometry(0.5), glowMat(def.color, 1), Math.cos(a) * 3.4, Math.sin(a * 2) * 0.6, Math.sin(a) * 3.4, orb); }
      anims.push(t => { orb.rotation.y = t * 1.5; inner.position.y = 0.6 + Math.sin(t * 2) * 0.3; });
      armL = limb(-1.8, 5.6, 0.8, 2.6, body); armR = limb(1.8, 5.6, 0.8, 2.6, body);
      legL = pivot(-0.6, 0.5); legR = pivot(0.6, 0.5);
      break;
    }
    case 'griffon': {   // ワシの頭と大きな羽のグリフォン
      add(B(2.8, 2.6, 4.4), body, 0, 3.8, 0);
      add(B(2, 2, 2), light, 0, 6.2, 2.2);
      const beak = add(K(0.5, 1.4, 4), mat(0xffc21a), 0, 6.0, 3.8); beak.rotation.x = Math.PI / 2;
      eyes(6.6, 3.22, 0.6, 0.35, 0.3, glowMat(0x00bcd4, 1.3));
      for (const s of [-1, 1]) { const f = add(K(0.25, 1.2, 4), light, s * 0.5, 7.6, 1.6); f.rotation.x = -0.7; }
      wings(5.2, -0.2, 5.5, light, 4);
      tail(3.6, -2.2, 3, dark, 3);
      legL = limb(-1, 2.6, 0.8, 2.6, mat(0xffc21a), 1.5); legR = limb(1, 2.6, 0.8, 2.6, mat(0xffc21a), 1.5);
      armL = pivot(0, 0); armR = pivot(0, 0);
      const bl = limb(-1, 2.6, 1, 2.6, dark, -1.6), br = limb(1, 2.6, 1, 2.6, dark, -1.6);
      anims.push(() => { bl.rotation.x = -legL.rotation.x; br.rotation.x = -legR.rotation.x; });
      break;
    }
    case 'kraken': {   // 大きな頭と何本もの触手
      const head = add(S(2.6, 20, 14), body, 0, 5.8, 0); head.scale.set(1, 1.25, 1);
      for (let i = 0; i < 5; i++) add(S(0.35, 8, 6), light, -1.2 + i * 0.6, 7.4 + Math.sin(i) * 0.4, 2.1);
      eyes(4.9, 2.45, 0.85, 0.6, 0.6, glowMat(0xffe600, 1.2));
      const tent = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const p = pivot(Math.cos(a) * 1.6, 3.2, Math.sin(a) * 1.6);
        add(C(0.45, 0.15, 3.2, 8), dark, 0, -1.6, 0, p);
        p.rotation.z = Math.cos(a) * 0.4; p.rotation.x = -Math.sin(a) * 0.4;
        tent.push([p, a, i]);
      }
      anims.push(t => tent.forEach(([p, a, i]) => { p.rotation.z = Math.cos(a) * (0.4 + Math.sin(t * 3 + i) * 0.25); }));
      armL = pivot(-2, 4); armR = pivot(2, 4); legL = pivot(-1, 2); legR = pivot(1, 2);
      break;
    }
    case 'robot': {   // 巨大ロボ
      const metal = mat(def.color);
      add(B(4, 3.4, 2.6), metal, 0, 4.4, 0);
      add(S(0.6, 14, 10), glowMat(0x00e5ff, 1.2), 0, 4.6, 1.35);
      add(B(2.4, 1.8, 2.2), metal, 0, 6.9, 0);
      add(B(2.0, 0.5, 0.15), glowMat(0xff1744, 1.3), 0, 7.0, 1.12);
      add(C(0.08, 0.08, 1.4, 6), black, 0.7, 8.4, 0);
      const ant = add(S(0.25, 8, 6), glowMat(0xff1744, 1), 0.7, 9.2, 0);
      anims.push(t => { ant.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 5)); });
      for (const s of [-1, 1]) add(B(1.4, 1.2, 1.8), dark, s * 2.6, 5.9, 0);
      armL = limb(-2.6, 5.4, 1.2, 3.2, dark); armR = limb(2.6, 5.4, 1.2, 3.2, dark);
      add(B(1.6, 1.4, 1.6), metal, 0, -3.4, 0, armL); add(B(1.6, 1.4, 1.6), metal, 0, -3.4, 0, armR);
      legL = limb(-1, 2.7, 1.5, 2.7, dark); legR = limb(1, 2.7, 1.5, 2.7, dark);
      add(B(1.9, 0.6, 2.4), black, 0, -2.6, 0.3, legL); add(B(1.9, 0.6, 2.4), black, 0, -2.6, 0.3, legR);
      break;
    }
    case 'chronos': {   // 時の神。胸に時計、背中に回る輪
      add(B(3, 3.4, 2), mat(0xf4ecd6), 0, 4.1, 0);
      add(C(1.1, 1.1, 0.15, 24), mat(0xffffff), 0, 4.3, 1.08).rotation.x = Math.PI / 2;
      const hand = add(B(0.12, 0.9, 0.05), black, 0, 4.3, 1.2);
      anims.push(t => { hand.rotation.z = -t * 2; });
      add(B(2.2, 2, 2), mat(0xffd29c), 0, 6.8, 0);
      add(B(2.2, 1.6, 0.6), white, 0, 5.8, 1.1);   // ひげ
      eyes(7.0, 1.02, 0.5, 0.4, 0.25, glowMat(0x3a8dff, 1.3));
      const ring = add(new THREE.TorusGeometry(3, 0.18, 8, 40), glowMat(def.color, 0.9), 0, 5.6, -1.6);
      anims.push(t => { ring.rotation.z = t; });
      armL = limb(-2, 5.4, 0.9, 3, mat(0xf4ecd6)); armR = limb(2, 5.4, 0.9, 3, mat(0xf4ecd6));
      add(C(0.12, 0.12, 4.6, 6), glowMat(def.color, 0.5), 0, -2, 0.4, armR);   // 杖
      legL = limb(-0.8, 2.5, 1.1, 2.5, mat(0xd8cfb6)); legR = limb(0.8, 2.5, 1.1, 2.5, mat(0xd8cfb6));
      break;
    }
    case 'wolf': {   // 光る毛並みのオオカミ（四つ足）
      add(B(2.6, 2.4, 5), body, 0, 3.8, 0);
      add(B(2.2, 2, 2.2), body, 0, 5.4, 3.2);
      add(B(1.2, 0.9, 1.6), light, 0, 4.9, 4.7);
      add(B(0.5, 0.35, 0.3), black, 0, 5.2, 5.5);
      eyes(5.8, 4.32, 0.55, 0.4, 0.25, glowMat(0x7df9ff, 1.4));
      for (const s of [-1, 1]) add(K(0.4, 1.1, 4), body, s * 0.7, 6.9, 2.9);
      tail(4.4, -2.5, 3, light, 4);
      const aura = add(S(4.6, 16, 12), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.12, depthWrite: false }), 0, 4, 0);
      anims.push(t => aura.scale.setScalar(1 + Math.sin(t * 3) * 0.06));
      legL = limb(-0.9, 2.6, 0.8, 2.6, dark, 1.8); legR = limb(0.9, 2.6, 0.8, 2.6, dark, 1.8);
      armL = pivot(0, 0); armR = pivot(0, 0);
      const bl = limb(-0.9, 2.6, 0.9, 2.6, dark, -1.8), br = limb(0.9, 2.6, 0.9, 2.6, dark, -1.8);
      anims.push(() => { bl.rotation.x = -legL.rotation.x; br.rotation.x = -legR.rotation.x; });
      break;
    }
    case 'queen': {   // 星雲の女王。広がるドレスと星
      add(K(3, 5.5, 18), body, 0, 2.75, 0);
      add(B(1.8, 1.8, 1.4), light, 0, 5.8, 0);
      add(S(1.1, 16, 12), mat(0xffe0f0), 0, 7.3, 0);
      eyes(7.4, 1.05, 0.38, 0.3, 0.25, glowMat(0xff7ae0, 1.5));
      crown(8.3, 0.8);
      const orb = new THREE.Group(); orb.position.y = 4.5; inner.add(orb);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.OctahedronGeometry(0.35), glowMat([0xff7ae0, 0x7df9ff, 0xfff27a][i % 3], 1), Math.cos(a) * 3.6, Math.sin(a * 3) * 0.8, Math.sin(a) * 3.6, orb); }
      anims.push(t => { orb.rotation.y = -t * 1.2; });
      armL = limb(-1.4, 6.2, 0.6, 2.6, mat(0xffe0f0)); armR = limb(1.4, 6.2, 0.6, 2.6, mat(0xffe0f0));
      legL = pivot(-0.6, 0.3); legR = pivot(0.6, 0.3);
      break;
    }
    case 'titan': {   // 赤くひび割れた混沌の巨人
      const rock = mat(0x241010);
      add(B(3.8, 3.6, 2.6), rock, 0, 4.4, 0);
      add(B(2.4, 2.2, 2.2), rock, 0, 7.2, 0);
      eyes(7.3, 1.12, 0.55, 0.55, 0.3, glowMat(0xff2a2a, 1.6));
      for (let i = 0; i < 8; i++) { const c = add(B(0.12, 1.2, 0.05), glowMat(0xff2a2a, 1.2), -1.4 + (i % 4) * 0.9, 3.4 + Math.floor(i / 4) * 1.6, 1.32); c.rotation.z = (i % 3 - 1) * 0.6; }
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) { const sp = add(K(0.35, 1.5, 5), dark, s * (2.3 + i * 0.1), 6.3 + i * 0.25, -0.5 + i * 0.5); sp.rotation.z = -s * 0.6; }
        const h = add(K(0.35, 1.8, 6), dark, s * 1.0, 8.9, 0); h.rotation.z = -s * 0.4;
      }
      armL = limb(-2.6, 5.8, 1.4, 3.6, rock); armR = limb(2.6, 5.8, 1.4, 3.6, rock);
      legL = limb(-1, 2.7, 1.5, 2.7, rock); legR = limb(1, 2.7, 1.5, 2.7, rock);
      break;
    }
    case 'ninja': {   // 影の忍者。覆面・赤いマフラー・背中の刀・まわる手裏剣
      const cloth = mat(def.color);
      add(B(2.6, 3, 1.8), cloth, 0, 4, 0);
      add(B(2.7, 0.35, 1.9), mat(0x5a1020), 0, 3.1, 0);   // 帯
      add(B(2.2, 2.1, 2.1), cloth, 0, 6.5, 0);
      add(B(2.25, 0.55, 2.15), mat(0xf1d2b0), 0, 6.7, 0);   // 目のまわりだけ肌
      eyes(6.72, 1.1, 0.48, 0.42, 0.18);
      const knot = pivot(0, 7.1, -1.1);   // はちまきの結び目
      for (const s of [-1, 1]) { const tl = add(B(0.18, 1.6, 0.5), mat(0xe63946), s * 0.25, -0.8, -0.2, knot); tl.rotation.z = s * 0.3; }
      anims.push(t => { knot.rotation.x = 0.5 + Math.sin(t * 8) * 0.25; });
      add(B(2.25, 0.25, 2.15), mat(0xe63946), 0, 7.1, 0);
      const scarf = pivot(0, 5.4, -0.9);   // なびく赤いマフラー
      add(B(0.7, 0.18, 3), mat(0xe63946), 0, 0, -1.5, scarf);
      anims.push(t => { scarf.rotation.x = 0.25 + Math.sin(t * 7) * 0.2; scarf.rotation.y = Math.sin(t * 4) * 0.25; });
      const sw = add(B(0.18, 4.6, 0.35), mat(0xdfe6ee), 0.6, 5.2, -1.05); sw.rotation.z = 0.7;   // 背中の刀
      add(B(0.3, 1.4, 0.4), mat(0x2b1a10), 1.55, 6.3, -1.05).rotation.z = 0.7;
      const shuri = new THREE.Group(); shuri.position.y = 4.8; inner.add(shuri);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Group(); const a = i / 3 * Math.PI * 2; s.position.set(Math.cos(a) * 3.6, Math.sin(a) * 0.6, Math.sin(a) * 3.6); shuri.add(s);
        for (let k = 0; k < 4; k++) { const bl = add(B(0.9, 0.08, 0.25), mat(0x9aa6b2), 0, 0, 0, s); bl.rotation.y = k * Math.PI / 4; }
        anims.push(t => { s.rotation.y = t * 14; });
      }
      anims.push(t => { shuri.rotation.y = t * 1.8; });
      armL = limb(-1.8, 5.2, 0.8, 2.9, cloth); armR = limb(1.8, 5.2, 0.8, 2.9, cloth);
      legL = limb(-0.7, 2.5, 1.0, 2.5, cloth); legR = limb(0.7, 2.5, 1.0, 2.5, cloth);
      break;
    }
    case 'gorilla': {   // むねをたたく大きなゴリラ
      const fur = mat(def.color), face = mat(0x6b5a50);
      add(B(4, 3.6, 2.6), fur, 0, 4.6, 0);
      add(B(2.6, 1.6, 0.3), mat(0x5a4a42), 0, 4.8, 1.32);   // 胸
      add(B(2.4, 2.2, 2.2), fur, 0, 7.2, 0.2);
      add(B(1.8, 1.2, 0.5), face, 0, 6.9, 1.4);
      add(B(2.4, 0.4, 0.5), dark, 0, 7.9, 1.3);   // まゆ
      eyes(7.35, 1.66, 0.45, 0.32, 0.22);
      armL = limb(-2.6, 6, 1.4, 4.6, fur); armR = limb(2.6, 6, 1.4, 4.6, fur);   // 長いうで
      add(B(1.7, 1.2, 1.7), dark, 0, -4.8, 0, armL); add(B(1.7, 1.2, 1.7), dark, 0, -4.8, 0, armR);
      legL = limb(-1.1, 2.8, 1.4, 2.8, fur); legR = limb(1.1, 2.8, 1.4, 2.8, fur);
      break;
    }
    case 'cake': {   // 3段ケーキのモンスター
      const cream = mat(0xffffff), sponge = mat(def.color);
      for (let i = 0; i < 3; i++) {
        const r = 2.6 - i * 0.65, y = 1.4 + i * 1.9;
        add(C(r, r, 1.5, 24), sponge, 0, y, 0);
        add(C(r + 0.08, r + 0.08, 0.35, 24), cream, 0, y + 0.8, 0);
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(S(0.2, 8, 6), mat([0xff5c8a, 0x7df9ff, 0xffd23f][k % 3]), Math.cos(a) * r, y + 0.05, Math.sin(a) * r); }
      }
      add(S(0.55, 14, 10), mat(0xe63946), 0, 7.6, 0);   // いちご
      for (let i = 0; i < 4; i++) { const c = add(C(0.12, 0.12, 1.1, 8), mat([0xff9ecb, 0x7df9ff, 0xfff27a, 0xb388ff][i]), -0.6 + i * 0.4, 7.5, -0.6); c.rotation.z = (i - 1.5) * 0.15; }
      eyes(5.5, 1.95, 0.55, 0.42, 0.42, black);
      add(B(1.0, 0.25, 0.1), mat(0xe63946), 0, 4.9, 1.97);
      anims.push(t => { inner.rotation.y = Math.sin(t * 2) * 0.15; });
      armL = limb(-2.6, 3.8, 0.6, 2.4, mat(0xffe0b5)); armR = limb(2.6, 3.8, 0.6, 2.4, mat(0xffe0b5));
      add(C(0.08, 0.08, 2.4, 6), mat(0xc0c0c0), 0, -2.6, 0.3, armR);   // フォーク
      legL = pivot(-1, 0.5); legR = pivot(1, 0.5);
      break;
    }
    case 'pirate': {   // 青白く透けるゴースト船長
      const ghost = new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.75, emissive: 0x1a4a66 });
      add(B(3, 3.2, 2), mat(def.color), 0, 4.2, 0);   // コート
      for (let i = 0; i < 4; i++) add(S(0.18, 8, 6), mat(0xffd23f), 0, 3.2 + i * 0.6, 1.02);
      add(B(2.2, 2, 2), ghost, 0, 6.8, 0);
      add(B(2.2, 0.4, 0.2), black, 0, 6.9, 1.1);   // 眼帯のひも
      add(C(0.4, 0.4, 0.1, 12), black, -0.5, 6.9, 1.12).rotation.x = Math.PI / 2;
      add(B(0.4, 0.35, 0.1), glowMat(0x7df9ff, 1.5), 0.5, 6.9, 1.06);
      add(B(3.2, 0.5, 2.6), black, 0, 8.05, 0);   // 海賊帽
      add(B(2.4, 1.2, 2.0), black, 0, 8.6, 0);
      add(B(0.6, 0.6, 0.1), white, 0, 8.6, 1.02);   // ドクロ
      armL = limb(-2, 5.4, 0.9, 3, mat(def.color)); armR = limb(2, 5.4, 0.9, 3, mat(def.color));
      const hook = add(new THREE.TorusGeometry(0.4, 0.1, 6, 12, Math.PI * 1.4), mat(0xc0c0c0), 0, -3.3, 0, armL); hook.rotation.y = Math.PI / 2;
      add(B(0.2, 3.2, 0.5), mat(0xdfe6ee), 0, -4, 0.3, armR);   // サーベル
      legL = limb(-0.8, 2.5, 1.1, 2.5, black);
      legR = pivot(0.8, 2.5); add(C(0.25, 0.3, 2.5, 8), mat(0x8b5a2b), 0, -1.25, 0, legR);   // 木の義足
      anims.push(t => { inner.position.y = Math.sin(t * 2) * 0.2; });
      break;
    }
    case 'trex': {   // ティラノサウルス
      const sk = mat(def.color);
      const bodyG = add(B(3.2, 3.2, 5.2), sk, 0, 4.6, 0); bodyG.rotation.x = -0.25;
      add(B(2.6, 2.4, 3.6), sk, 0, 7.4, 2.6);   // 頭
      add(B(2.4, 0.8, 3.2), dark, 0, 6.2, 2.8);   // 下あご
      for (let i = 0; i < 6; i++) add(K(0.12, 0.4, 4), white, -0.9 + i * 0.36, 6.55, 4.35).rotation.x = Math.PI;
      eyes(8.0, 2.0, 0.9, 0.35, 0.3, glowMat(0xffe600, 1.3));
      for (let i = 0; i < 6; i++) add(K(0.3, 0.9, 4), dark, 0, 6.4 - i * 0.25, 1.4 - i * 1.0);
      armL = limb(-1.7, 5.4, 0.45, 1.2, sk, 1.6); armR = limb(1.7, 5.4, 0.45, 1.2, sk, 1.6);   // 短いうで
      tail(4.2, -2.6, 6, sk, 6);
      legL = limb(-1.2, 3.2, 1.4, 3.2, sk); legR = limb(1.2, 3.2, 1.4, 3.2, sk);
      break;
    }
    case 'serpent': {   // 光る長い龍（体がうねる）
      const neon = glowMat(def.color, 0.7), neon2 = glowMat(0xff5cf4, 0.8);
      const segs = [];
      for (let i = 0; i < 10; i++) {
        const s = add(S(1.1 - i * 0.05, 12, 10), i % 2 ? neon2 : neon, 0, 3 + Math.sin(i * 0.8) * 1.2, -i * 1.3);
        segs.push(s);
      }
      add(B(2.4, 1.8, 2.6), neon, 0, 5, 1.6);   // 頭
      add(B(2.0, 0.6, 1.6), neon2, 0, 4.2, 2.6);
      for (const s of [-1, 1]) { const h = add(K(0.2, 2, 6), mat(0xfff27a), s * 0.7, 6.6, 1.0); h.rotation.x = -0.7; h.rotation.z = -s * 0.3; }
      for (const s of [-1, 1]) { const w = add(B(0.08, 0.08, 3), neon2, s * 1.0, 4.4, 3.6); w.rotation.y = s * 0.4; }   // ひげ
      eyes(5.4, 2.92, 0.6, 0.4, 0.3, glowMat(0xffffff, 2));
      anims.push(t => segs.forEach((s, i) => { s.position.x = Math.sin(t * 4 - i * 0.7) * 1.2; s.position.y = 3 + Math.sin(t * 3 - i * 0.6) * 0.8; }));
      armL = pivot(-1, 4); armR = pivot(1, 4); legL = pivot(-1, 1); legR = pivot(1, 1);
      break;
    }
    case 'angel': {   // 大天使。大きな羽・天使の輪・光の剣
      const robe = mat(def.color), gold = glowMat(0xffd23f, 0.6);
      add(K(2.4, 4.8, 16), robe, 0, 2.6, 0);
      add(B(2.4, 2.6, 1.6), robe, 0, 5.6, 0);
      add(B(2.6, 0.3, 1.7), gold, 0, 4.4, 0);
      add(B(1.9, 1.9, 1.9), mat(0xffe0c0), 0, 7.6, 0);
      add(B(2.1, 0.9, 2.1), mat(0xffe066), 0, 8.5, -0.1);   // 髪
      eyes(7.7, 0.97, 0.42, 0.3, 0.2, glowMat(0x7df9ff, 1.5));
      const halo = add(new THREE.TorusGeometry(1.1, 0.14, 8, 28), glowMat(0xfff27a, 1.5), 0, 9.6, 0); halo.rotation.x = Math.PI / 2;
      anims.push(t => { halo.position.y = 9.6 + Math.sin(t * 2) * 0.15; inner.position.y = 0.5 + Math.sin(t * 1.5) * 0.3; });
      wings(6, -0.8, 5.5, mat(0xffffff), 2.5);
      armL = limb(-1.6, 6.6, 0.7, 2.8, robe); armR = limb(1.6, 6.6, 0.7, 2.8, robe);
      add(B(0.3, 4.4, 0.3), glowMat(0xfff27a, 1.4), 0, -4.4, 0.4, armR);   // 光の剣
      legL = pivot(-0.6, 0.5); legR = pivot(0.6, 0.5);
      break;
    }
    case 'ghost': {   // 大きなおばけ（ゆらゆら・すそがなびく）
      const gh = new THREE.MeshLambertMaterial({ color: def.color, transparent: true, opacity: 0.88, emissive: 0x2a2a44 });
      const head = add(S(2.8, 20, 16), gh, 0, 6, 0); head.scale.set(1, 1.15, 1);
      add(C(2.8, 3.1, 3.2, 20, 1, true), gh, 0, 3.6, 0);
      const skirt = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const s = add(K(0.8, 1.6, 6), gh, Math.cos(a) * 2.6, 1.4, Math.sin(a) * 2.6); s.rotation.x = Math.PI; skirt.push(s); }
      for (const s of [-1, 1]) add(S(0.6, 12, 10), black, s * 1.0, 6.6, 2.5).scale.set(1, 1.4, 0.4);
      add(S(0.7, 12, 10), black, 0, 5.0, 2.6).scale.set(1, 1.3, 0.4);   // 「おー」の口
      anims.push(t => { inner.position.y = 0.6 + Math.sin(t * 2) * 0.5; skirt.forEach((s, i) => { s.position.y = 1.4 + Math.sin(t * 4 + i) * 0.25; }); });
      armL = limb(-3, 5.4, 0.9, 2.2, gh); armR = limb(3, 5.4, 0.9, 2.2, gh);
      legL = pivot(-1, 1); legR = pivot(1, 1);
      break;
    }
    case 'ultimate': {   // 究極ラッキーブロック（虹色に光って回る）
      const mats = [];
      const blk = add(B(5, 5, 5), new THREE.MeshLambertMaterial({ map: luckyTexture(), color: 0xffd23f, emissive: 0x332200 }), 0, 5.5, 0);
      mats.push(blk.material);
      eyes(6.4, 2.52, 1.1, 0.8, 0.55, glowMat(0xffffff, 2));
      add(B(3.4, 0.35, 0.1), black, 0, 4.7, 2.52);
      crown(8.2, 1.6, glowMat(0xffffff, 0.6));
      const ringA = add(new THREE.TorusGeometry(5, 0.22, 8, 48), glowMat(0xff5cf4, 1.2), 0, 5.5, 0);
      const ringB = add(new THREE.TorusGeometry(6, 0.18, 8, 48), glowMat(0x7df9ff, 1.2), 0, 5.5, 0);
      const orb = new THREE.Group(); orb.position.y = 5.5; inner.add(orb);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(B(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ map: luckyTexture(), color: 0xffffff }), Math.cos(a) * 4, Math.sin(a * 2), Math.sin(a) * 4, orb); }
      anims.push(t => {
        mats[0].color.setHSL((t * 0.2) % 1, 0.8, 0.6);
        blk.rotation.y = Math.sin(t) * 0.3;
        ringA.rotation.set(t, t * 0.6, 0); ringB.rotation.set(-t * 0.7, 0, t);
        orb.rotation.y = t * 1.5;
      });
      armL = limb(-3.2, 6.2, 1.1, 3.2, body); armR = limb(3.2, 6.2, 1.1, 3.2, body);
      legL = limb(-1.2, 3, 1.3, 3, dark); legR = limb(1.2, 3, 1.3, 3, dark);
      break;
    }
    case 'luckyking': {   // ラッキーブロックの王さま
      const tex = luckyTexture();
      const blk = add(B(4.2, 4.2, 4.2), new THREE.MeshLambertMaterial({ map: tex, color: 0xffd23f, emissive: 0x332200 }), 0, 4.6, 0);
      add(B(3.2, 0.3, 0.1), black, 0, 3.4, 2.12);
      eyes(5.6, 2.14, 0.9, 0.7, 0.45);
      crown(7.1, 1.4);
      const pv = pivot(0, 6.5, -2.15);
      add(B(4, 5.5, 0.12), mat(0xe63946), 0, -2.75, 0, pv);
      anims.push(t => { pv.rotation.x = -0.1 - Math.abs(Math.sin(t * 3)) * 0.2; blk.rotation.y = Math.sin(t * 1.5) * 0.08; });
      armL = limb(-2.7, 5.6, 1, 3, body); armR = limb(2.7, 5.6, 1, 3, body);
      legL = limb(-1, 2.5, 1.2, 2.5, dark); legR = limb(1, 2.5, 1.2, 2.5, dark);
      break;
    }
    default: {   // いつものブロックの怪物
      add(B(3, 3, 2.2), body, 0, 4, 0);
      add(B(2.4, 2, 2.2), body, 0, 6.5, 0);
      eyes(6.7, 1.12);
      add(B(1.6, 0.3, 0.1), black, 0, 6.0, 1.12);
      for (const s of [-1, 1]) { const h = add(K(0.3, 1.2, 6), dark, s * 0.9, 8, 0); h.rotation.z = -s * 0.4; }
      armL = limb(-2, 5.2, 1, 3, dark); armR = limb(2, 5.2, 1, 3, dark);
      legL = limb(-0.8, 2.5, 1.2, 2.5, dark); legR = limb(0.8, 2.5, 1.2, 2.5, dark);
    }
  }

  g.scale.setScalar(def.scale / 2);
  g.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return { group: g, armL, armR, legL, legR, anims };
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
  sushi:  { top: 1.4, eyeY: 0.55, front: 0.72 },
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
  } else if (def.shape === 'sushi') {
    // シャリ（白いごはん）の上にネタ
    mainMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4), body); mainMesh.position.y = 0.5;
    const neta = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.32, 1.6), mat(def.accent)); neta.position.y = 1.16; neta.rotation.z = 0.04; g.add(neta);
    for (let i = 0; i < 6; i++) {   // ごはんつぶ
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(0xffffff));
      r.position.set(-0.8 + i * 0.32, 0.15 + (i % 2) * 0.55, 0.71); g.add(r);
    }
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
      case 'stripes':   // サーモンの白いすじ
        for (let i = 0; i < 4; i++) { const s = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 1.62), mat(0xffe3d1)), -0.75 + i * 0.5, 1.17, 0); s.rotation.y = 0.4; }
        break;
      case 'band':   // たまご寿司ののり
        add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 1.66), mat(0x1b2a1b)), 0, 0.72, 0);
        break;
      case 'kabuto': {   // 兜（かぶと）と金のくわがた
        const k = add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x22223b)), 0, top - 0.05, 0);
        k.scale.set(1.05, 0.7, 1.05);
        add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.12, 16), mat(0x22223b)), 0, top - 0.15, -0.05);
        const gold = glowMat(0xffd23f, 0.4);
        for (const s of [-1, 1]) { const h = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.1), gold), s * 0.32, top + 0.5, S.front - 0.2); h.rotation.z = -s * 0.45; }
        add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xe63946)), 0, top + 0.12, S.front - 0.1);
        break;
      }
      case 'sakura': {   // 頭に桜の花、まわりに花びら
        const pink = mat(0xffb7d0);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pink), Math.cos(a) * 0.25, top + 0.12, Math.sin(a) * 0.25); p.scale.set(1, 0.4, 1); }
        add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xffe066)), 0, top + 0.18, 0);
        const holder = new THREE.Group(); holder.position.y = top * 0.5; g.add(holder);
        for (let i = 0; i < 8; i++) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.12), mat(0xffc8dc));
          const a = i / 8 * Math.PI * 2; p.position.set(Math.cos(a) * 1.4, Math.sin(a * 3) * 0.6, Math.sin(a) * 1.4); p.rotation.set(a, a * 2, 0); holder.add(p);
        }
        anims.push(time => { holder.rotation.y = time * 0.8; holder.children.forEach((p, i) => { p.position.y = ((time * 0.4 + i * 0.25) % 2) - 1; p.rotation.x = time * 2 + i; }); });
        break;
      }
      case 'toriiframe': {   // 体のまわりに鳥居
        const red = mat(0xe63946), blk = mat(0x1a1a1a);
        for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, top + 0.9, 10), red), s * 1.25, (top + 0.9) / 2, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.4), blk), 0, top + 0.95, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.2, 0.32), red), 0, top + 0.78, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.24), red), 0, top + 0.35, 0);
        break;
      }
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

  // かぼちゃ変異: 頭の上にジャック・オ・ランタン（レインボーは色が変わってキラキラ）
  if (mut === 'pumpkin' || mut === 'rainbowpumpkin') {
    const rainbowP = mut === 'rainbowpumpkin';
    const pm = rainbowP ? new THREE.MeshLambertMaterial({ color: 0xff8c1a, emissive: 0x331100 }) : mat(0xff8c1a);
    const pk = new THREE.Group(); pk.position.y = top + 0.42; g.add(pk);
    for (let i = 0; i < 5; i++) {   // 縦のふくらみ
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), pm);
      const a = i / 5 * Math.PI * 2;
      lobe.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); lobe.scale.set(0.75, 0.85, 0.75); pk.add(lobe);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 6), mat(0x3a6b2a)); stem.position.y = 0.5; stem.rotation.z = 0.25; pk.add(stem);
    const face = glowMat(0xffd23f, 1);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 3), face); eye.position.set(s * 0.17, 0.08, 0.6); eye.rotation.x = Math.PI / 2; pk.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.04), face); mouth.position.set(0, -0.14, 0.6); pk.add(mouth);
    anims.push(time => { pk.rotation.z = Math.sin(time * 2.5) * 0.08; });
    if (rainbowP) {
      anims.push(time => { pm.color.setHSL((time * 0.25) % 1, 0.85, 0.58); });
      const holder = new THREE.Group(); holder.position.y = top * 0.5; g.add(holder);
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), glowMat([0xff5e5e, 0xffd23f, 0x4cd964, 0x3a8dff, 0xb05cff][i % 5], 1));
        const a = i / 8 * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.4, Math.sin(a * 2) * 0.5, Math.sin(a) * 1.4); holder.add(s);
      }
      anims.push(time => { holder.rotation.y = time * 2.6; });
    }
  }

  g.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  g.userData.anims = anims;
  g.userData.height = top + 0.6;
  return g;
}
