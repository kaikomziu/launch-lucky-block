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
    case 'yeti': {   // もこもこの雪男
      const fur = mat(def.color), face = mat(0x8fb8d8);
      const tb = add(S(2.4, 16, 12), fur, 0, 4.6, 0); tb.scale.set(1.1, 1.2, 0.9);
      add(S(1.4, 14, 10), fur, 0, 7.4, 0.2);
      add(B(1.6, 1.2, 0.4), face, 0, 7.2, 1.45);
      eyes(7.45, 1.66, 0.45, 0.3, 0.25, glowMat(0x2a7fff, 1.4));
      add(B(0.9, 0.25, 0.1), black, 0, 6.8, 1.66);
      for (const s of [-1, 1]) { const h = add(K(0.25, 1.0, 6), mat(0xc8d8e8), s * 0.8, 8.6, 0); h.rotation.z = -s * 0.5; }
      armL = limb(-2.7, 6, 1.4, 4, fur); armR = limb(2.7, 6, 1.4, 4, fur);
      for (const a of [armL, armR]) for (let k = 0; k < 3; k++) add(K(0.15, 0.5, 4), mat(0x8fb8d8), -0.4 + k * 0.4, -4.2, 0.4, a).rotation.x = Math.PI;
      legL = limb(-1.1, 2.6, 1.5, 2.6, fur); legR = limb(1.1, 2.6, 1.5, 2.6, fur);
      break;
    }
    case 'mummy': {   // 包帯ぐるぐるのミイラ王
      const wrap = mat(def.color), band2 = mat(0xd8c9a4), gold = glowMat(0xffc21a, 0.5);
      add(B(2.8, 3.2, 1.9), wrap, 0, 4.2, 0);
      for (let i = 0; i < 6; i++) { const b = add(B(2.9, 0.18, 2.0), band2, 0, 2.9 + i * 0.5, 0); b.rotation.z = (i % 2 ? 1 : -1) * 0.08; }
      add(B(2.2, 2.1, 2.0), wrap, 0, 6.8, 0);
      eyes(6.9, 1.02, 0.45, 0.4, 0.2, glowMat(0x7dff8a, 1.6));
      add(B(2.6, 2.0, 0.3), gold, 0, 7.4, -1.05);   // 王の頭巾
      for (const s of [-1, 1]) add(B(0.5, 2.4, 1.6), gold, s * 1.3, 6.5, -0.2);
      add(B(2.6, 0.5, 0.3), gold, 0, 5.4, 1.0);   // 胸飾り
      armL = limb(-1.9, 5.4, 0.85, 3, wrap); armR = limb(1.9, 5.4, 0.85, 3, wrap);
      const loose = pivot(0.3, -3, 0.3, armR); add(B(0.15, 1.4, 0.4), band2, 0, -0.7, 0, loose);   // ほどけた包帯
      anims.push(t => { loose.rotation.x = Math.sin(t * 5) * 0.5; });
      legL = limb(-0.8, 2.6, 1.1, 2.6, wrap); legR = limb(0.8, 2.6, 1.1, 2.6, wrap);
      break;
    }
    case 'ifrit': {   // 炎の魔神（下半身が炎で浮いている）
      const fire = glowMat(def.color, 1.0), fire2 = glowMat(0xffd23f, 1.2);
      add(B(3.4, 3, 2.2), fire, 0, 5.4, 0);
      add(B(2.4, 2.2, 2.2), fire, 0, 8, 0);
      eyes(8.1, 1.12, 0.55, 0.5, 0.3, glowMat(0xffffff, 2));
      for (const s of [-1, 1]) { const h = add(K(0.35, 1.8, 6), mat(0x2b1a17), s * 1.0, 9.5, 0); h.rotation.z = -s * 0.5; }
      const flames = [];
      for (let i = 0; i < 6; i++) { const f = add(K(1.1 - i * 0.15, 2.4, 8), i % 2 ? fire2 : fire, Math.sin(i) * 0.5, 2.6 - i * 0.2, Math.cos(i) * 0.5); f.rotation.x = Math.PI; flames.push(f); }
      const hair = []; for (let i = 0; i < 4; i++) { const f = add(K(0.4, 1.6, 6), fire2, -0.9 + i * 0.6, 9.6, -0.3); hair.push(f); }
      anims.push(t => { flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * 7 + i)) * 0.5; }); hair.forEach((f, i) => { f.scale.y = 0.7 + Math.abs(Math.sin(t * 9 + i)) * 0.6; }); inner.position.y = 0.6 + Math.sin(t * 2) * 0.3; });
      armL = limb(-2.3, 6.6, 1, 3.2, fire); armR = limb(2.3, 6.6, 1, 3.2, fire);
      add(S(0.6, 10, 8), fire2, 0, -3.5, 0, armR);   // 手の火の玉
      legL = pivot(-0.6, 1); legR = pivot(0.6, 1);
      break;
    }
    case 'tinsoldier': {   // ブリキの兵隊（背中にねじ）
      const red = mat(def.color), blue = mat(0x1e3a8a), gold = glowMat(0xffd23f, 0.4);
      add(B(2.6, 3.2, 1.8), red, 0, 4.4, 0);
      for (let i = 0; i < 3; i++) add(S(0.18, 8, 6), gold, 0, 3.4 + i * 0.8, 0.92);
      add(B(2.7, 0.35, 1.9), mat(0xffffff), 0, 3.0, 0);   // ベルト
      add(B(2, 1.8, 1.8), mat(0xffd29c), 0, 6.9, 0);
      eyes(7.0, 0.92, 0.4, 0.3, 0.3, black);
      for (const s of [-1, 1]) add(C(0.25, 0.25, 0.05, 12), mat(0xff7a8a), s * 0.6, 6.5, 0.92).rotation.x = Math.PI / 2;   // ほっぺ
      add(C(1.0, 1.0, 2.2, 14), mat(0x111111), 0, 8.9, 0);   // 背の高い帽子
      add(C(1.02, 1.02, 0.3, 14), gold, 0, 8.0, 0);
      const key = pivot(0, 4.6, -1.0);   // ねじ
      add(C(0.12, 0.12, 0.8, 6), gold, 0, 0, -0.4, key).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) add(B(0.2, 0.9, 0.5), gold, s * 0.35, 0, -0.8, key);
      anims.push(t => { key.rotation.z = t * 4; });
      armL = limb(-1.7, 5.6, 0.75, 3, red); armR = limb(1.7, 5.6, 0.75, 3, red);
      add(B(0.25, 4, 0.25), mat(0x5a3a1a), 0, -1.4, 0.4, armR);   // 銃（木）
      legL = limb(-0.7, 2.8, 0.9, 2.8, blue); legR = limb(0.7, 2.8, 0.9, 2.8, blue);
      break;
    }
    case 'ufo': {   // UFOに乗った宇宙人の王
      const metal = mat(def.color), glass = new THREE.MeshLambertMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.45 });
      const disc = add(S(4, 24, 10), metal, 0, 4, 0); disc.scale.set(1, 0.28, 1);
      add(C(2.6, 3.2, 0.4, 24), dark, 0, 3.5, 0);
      const lights = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; lights.push(add(S(0.25, 8, 6), glowMat([0xff5cf4, 0x7df9ff, 0xfff27a][i % 3], 1.2), Math.cos(a) * 3.6, 3.9, Math.sin(a) * 3.6)); }
      add(S(1.9, 18, 12), glass, 0, 5.2, 0);
      add(S(1, 14, 10), mat(0x7dff8a), 0, 5.4, 0).scale.set(1, 1.15, 1);   // 宇宙人
      eyes(5.5, 0.92, 0.38, 0.35, 0.45, black);
      for (const s of [-1, 1]) { add(C(0.05, 0.05, 0.8, 6), mat(0x7dff8a), s * 0.45, 6.6, 0); add(S(0.15, 8, 6), glowMat(0xfff27a, 1), s * 0.45, 7.0, 0); }
      const beam = add(C(1.0, 2.6, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.22, depthWrite: false }), 0, 1.7, 0);
      anims.push(t => { disc.rotation.y = t * 1.2; lights.forEach((l, i) => { l.visible = Math.sin(t * 6 + i) > -0.3; }); beam.material.opacity = 0.15 + Math.abs(Math.sin(t * 3)) * 0.15; inner.position.y = 1 + Math.sin(t * 2) * 0.4; });
      armL = pivot(-2, 4); armR = pivot(2, 4); legL = pivot(-1, 1); legR = pivot(1, 1);
      break;
    }
    case 'treant': {   // 森の巨人（木の体・葉の頭）
      const bark = mat(def.color), leaf = mat(0x4caf50), leaf2 = mat(0x7bd36a);
      add(C(1.6, 2.0, 4.6, 10), bark, 0, 4.6, 0);
      for (let i = 0; i < 5; i++) { const c = add(S(1.4, 10, 8), i % 2 ? leaf : leaf2, Math.cos(i * 1.3) * 1.4, 8.2 + (i % 2) * 0.8, Math.sin(i * 1.3) * 1.2); c.scale.setScalar(0.9 + (i % 3) * 0.2); }
      eyes(6.0, 1.7, 0.6, 0.45, 0.35, glowMat(0xc8ff3a, 1.4));
      add(B(1.2, 0.3, 0.1), black, 0, 5.2, 1.75);
      for (let i = 0; i < 3; i++) add(S(0.35, 8, 6), mat(0xff5c8a), Math.cos(i * 2) * 1.6, 9.4, Math.sin(i * 2) * 1.6);   // 花
      armL = pivot(-1.7, 6); add(C(0.35, 0.55, 3.6, 8), bark, 0, -1.8, 0, armL); add(S(0.8, 8, 6), leaf, 0, -3.8, 0, armL);
      armR = pivot(1.7, 6); add(C(0.35, 0.55, 3.6, 8), bark, 0, -1.8, 0, armR); add(S(0.8, 8, 6), leaf, 0, -3.8, 0, armR);
      legL = limb(-0.9, 2.5, 1.2, 2.5, bark); legR = limb(0.9, 2.5, 1.2, 2.5, bark);
      break;
    }
    case 'mirrorknight': {   // 鏡の騎士（光を反射してきらめく）
      const chrome = new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x4a5a7a, emissiveIntensity: 0.5 });
      add(B(3, 3.2, 2.2), chrome, 0, 4.2, 0);
      add(B(2.2, 2.2, 2.2), chrome, 0, 6.8, 0);
      add(B(1.8, 0.35, 0.1), glowMat(0xb388ff, 1.5), 0, 6.9, 1.12);
      const shards = new THREE.Group(); shards.position.y = 5.5; inner.add(shards);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sh = add(new THREE.OctahedronGeometry(0.7), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x7df9ff, emissiveIntensity: 0.6 }), Math.cos(a) * 3.6, Math.sin(a * 2) * 0.8, Math.sin(a) * 3.6, shards); sh.scale.y = 1.8; }
      anims.push(t => { shards.rotation.y = -t * 1.3; chrome.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 2)) * 0.45; });
      armL = limb(-2, 5.4, 1, 3, chrome); armR = limb(2, 5.4, 1, 3, chrome);
      add(B(0.25, 3.2, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9ad0ff, emissiveIntensity: 0.7 }), -0.6, -2.0, 0.2, armL);   // 鏡の盾
      add(B(0.2, 4.4, 0.4), glowMat(0xb388ff, 1.2), 0, -4.2, 0.4, armR);
      legL = limb(-0.8, 2.6, 1.2, 2.6, chrome); legR = limb(0.8, 2.6, 1.2, 2.6, chrome);
      break;
    }
    case 'nature': {   // 自然の精霊王（葉の体・稲妻の冠・水と炎の玉・まわる大きな葉）
      const leaf = mat(def.color), leaf2 = mat(0x7ddc5a), bark = mat(0xf0a860);
      add(B(3.2, 3.4, 2.2), leaf, 0, 4.4, 0);
      for (let i = 0; i < 6; i++) add(new THREE.IcosahedronGeometry(0.7, 0), leaf2, -1.4 + (i % 3) * 1.4, 3.4 + Math.floor(i / 3) * 1.8, 1.0);
      add(B(2.4, 2.2, 2.2), leaf2, 0, 7.1, 0);
      eyes(7.2, 1.12, 0.5, 0.45, 0.3, glowMat(0xfff27a, 1.6));
      const bolt = new THREE.Group(); bolt.position.set(0, 9.4, 0); inner.add(bolt);   // 稲妻の冠
      const yl = glowMat(0xffc21a, 1.3);
      [[0, 0.8, 0.5], [0.25, 0, -0.5], [0, -0.8, 0.5]].forEach(([x, y, r]) => { const s = add(B(0.35, 1.2, 0.35), yl, x, y, 0, bolt); s.rotation.z = r; });
      const orbit = new THREE.Group(); orbit.position.y = 5.5; inner.add(orbit);   // まわりを回る大きな葉
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const l = add(S(0.9, 12, 8), leaf, Math.cos(a) * 4.2, Math.sin(a * 2) * 0.5, Math.sin(a) * 4.2, orbit); l.scale.set(1, 0.25, 1.8); }
      anims.push(t => { orbit.rotation.y = t * 1.2; bolt.rotation.y = Math.sin(t * 2) * 0.5; yl.emissiveIntensity = 0.9 + Math.abs(Math.sin(t * 8)) * 0.8; });
      armL = limb(-2.2, 5.6, 1, 3.2, bark); armR = limb(2.2, 5.6, 1, 3.2, bark);
      const water = add(S(0.9, 14, 10), new THREE.MeshLambertMaterial({ color: 0x2ec8d8, emissive: 0x0a4a55, transparent: true, opacity: 0.9 }), 0, -3.8, 0, armL);   // 水の玉
      const fire = add(S(0.9, 14, 10), glowMat(0xff7a2a, 1.1), 0, -3.8, 0, armR);   // 炎の玉
      add(S(0.5, 10, 8), glowMat(0xffc21a, 1.4), 0, -3.8, 0.45, armR);
      anims.push(t => { water.scale.setScalar(1 + Math.sin(t * 4) * 0.08); fire.scale.setScalar(1 + Math.abs(Math.sin(t * 7)) * 0.15); });
      legL = limb(-0.9, 2.6, 1.2, 2.6, bark); legR = limb(0.9, 2.6, 1.2, 2.6, bark);
      break;
    }
    case 'raijinboss': {   // 雷神（背中に太鼓の輪・手に稲妻）
      const tiger = mat(0xffc21a), bolt = glowMat(0xfff27a, 1.4);
      add(B(4.2, 4.4, 2.8), body, 0, 4.6, 0);
      add(B(3, 2.8, 2.6), body, 0, 8.2, 0);
      eyes(8.5, 1.32, 0.7, 0.6, 0.35, glowMat(0xfff27a, 1.6));
      add(B(1.6, 0.3, 0.1), white, 0, 7.4, 1.32);
      for (const s of [-1, 1]) add(K(0.4, 1.6, 6), mat(0xffe066), s * 0.9, 10.2, 0).rotation.z = -s * 0.3;
      add(B(4.4, 1.2, 3), tiger, 0, 2.8, 0);
      for (const x of [-1.4, 0, 1.4]) add(B(0.3, 1.25, 3.05), black, x, 2.8, 0);
      const ring = pivot(0, 7, -2.4);
      add(new THREE.TorusGeometry(4.2, 0.18, 6, 32), mat(0xd94a3a), 0, 0, 0, ring);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        add(C(0.8, 0.8, 0.7, 14), mat(0xd94a3a), Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0, ring).rotation.x = Math.PI / 2;
        add(C(0.82, 0.82, 0.1, 14), mat(0xf5e6c8), Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.38, ring).rotation.x = Math.PI / 2;
      }
      anims.push(t => { ring.rotation.z = t * 0.6; bolt.emissiveIntensity = Math.random() < 0.1 ? 2.6 : 1.2; });
      armL = limb(-2.6, 6.4, 1.1, 3.4, body); armR = limb(2.6, 6.4, 1.1, 3.4, body);
      add(B(0.5, 2.4, 0.5), bolt, 0, -4.3, 0.6, armR).rotation.z = 0.4;
      legL = limb(-1.1, 2.4, 1.4, 2.4, dark); legR = limb(1.1, 2.4, 1.4, 2.4, dark);
      break;
    }
    case 'panda': {   // 大パンダ（竹を持つ）
      const bk = mat(0x111111);
      add(S(3, 18, 14), white, 0, 4.2, 0).scale.set(1, 1.05, 0.95);
      add(S(2.2, 18, 14), white, 0, 8.2, 0);
      for (const s of [-1, 1]) {
        add(S(0.75, 12, 10), bk, s * 1.5, 10.0, 0);
        const p = add(S(0.55, 10, 8), bk, s * 0.75, 8.4, 1.8); p.scale.set(1, 1.3, 0.5); p.rotation.z = s * 0.4;
        add(S(0.2, 8, 6), glowMat(0xff3b3b, 1.4), s * 0.75, 8.4, 2.05);
      }
      add(S(0.3, 8, 6), bk, 0, 7.7, 2.15);
      armL = limb(-3, 6, 1.4, 3.2, bk); armR = limb(3, 6, 1.4, 3.2, bk);
      add(C(0.25, 0.25, 7, 8), mat(0x7fc75a), 0, -3.4, 0.9, armR);
      for (const y of [-1.5, -3.4, -5.3]) add(C(0.3, 0.3, 0.15, 8), mat(0x4f8a2a), 0, y, 0.9, armR);
      legL = limb(-1.4, 2.2, 1.6, 2.2, bk); legR = limb(1.4, 2.2, 1.6, 2.2, bk);
      break;
    }
    case 'piano': {   // 魔のグランドピアノ（ふたがパクパク・音符がまわる）
      add(B(6, 3, 4.5), body, 0, 4.5, 0);
      for (let i = 0; i < 10; i++) add(B(0.5, 0.25, 1.1), white, -2.5 + i * 0.555, 6.1, 1.6);
      for (const i of [0, 1, 3, 4, 5, 7, 8]) add(B(0.3, 0.25, 0.65), black, -2.22 + i * 0.555, 6.3, 1.4);
      const lid = pivot(0, 6.05, -2.25); add(B(6, 0.2, 4.5), body, 0, 0, 2.25, lid);
      eyes(4.8, 2.3, 1.4, 0.9, 0.5, glowMat(0xff2d55, 1.6));
      const notes = pivot(0, 7, 0);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2, nm = glowMat([0xff6ec7, 0x7ad7ff, 0xffd23f][i % 3], 1);
        add(S(0.45, 10, 8), nm, Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6, notes);
        add(B(0.12, 1.4, 0.12), nm, Math.cos(a) * 4.6 + 0.38, 0.7, Math.sin(a) * 4.6, notes);
      }
      anims.push(t => { lid.rotation.x = -0.6 - Math.abs(Math.sin(t * 4)) * 0.5; notes.rotation.y = t; notes.position.y = 7 + Math.sin(t * 2) * 0.4; });
      armL = limb(-3.3, 5.5, 0.6, 2.6, mat(0x3a2a2a)); armR = limb(3.3, 5.5, 0.6, 2.6, mat(0x3a2a2a));
      add(C(0.08, 0.08, 2.4, 6), white, 0, -3.2, 0.8, armR).rotation.x = Math.PI / 2.5;
      legL = limb(-2.4, 3, 0.7, 3, mat(0x3a2a2a)); legR = limb(2.4, 3, 0.7, 3, mat(0x3a2a2a));
      add(B(0.7, 3, 0.7), mat(0x3a2a2a), 0, 1.5, -1.8);
      break;
    }
    case 'clown': {   // 大ピエロ（赤い鼻・とんがり帽子・ふうせん）
      const red = mat(0xff3b3b), yel = mat(0xffd23f), blue = mat(0x3a8dff);
      add(S(2.6, 18, 14), red, 0, 4.4, 0).scale.set(1, 1.1, 0.95);
      for (let i = 0; i < 3; i++) add(S(0.35, 8, 6), yel, 0, 3.6 + i * 1.1, 2.45);
      add(new THREE.TorusGeometry(1.6, 0.45, 8, 20), white, 0, 6.9, 0).rotation.x = Math.PI / 2;
      add(S(1.9, 18, 14), white, 0, 8.6, 0);
      add(S(0.55, 12, 10), glowMat(0xff2020, 1.2), 0, 8.4, 1.95);
      eyes(9.1, 1.75, 0.7, 0.5, 0.4, black);
      add(B(1.6, 0.3, 0.1), red, 0, 7.6, 1.75);
      for (const s of [-1, 1]) add(S(0.9, 12, 10), blue, s * 1.9, 9.2, 0);
      add(K(1.2, 2.6, 10), yel, 0, 11.4, 0); add(S(0.4, 10, 8), red, 0, 12.8, 0);
      armL = limb(-2.7, 6, 0.9, 3, yel); armR = limb(2.7, 6, 0.9, 3, red);
      const bl = pivot(0, -3, 0, armL);
      [0xff5c8a, 0x3a8dff, 0x4cd964].forEach((c, i) => {
        add(C(0.03, 0.03, 4.4, 4), white, (i - 1) * 0.6, 2.2, 0, bl).rotation.z = -(i - 1) * 0.27;
        add(S(0.9, 12, 10), mat(c), (i - 1) * 1.2, 4.6 + (i % 2) * 0.5, 0, bl).scale.y = 1.2;
      });
      legL = limb(-1.1, 2.4, 1.2, 2.4, blue); legR = limb(1.1, 2.4, 1.2, 2.4, blue);
      break;
    }
    case 'gemgolem': {   // 宝石ゴーレム（岩の体に光る宝石）
      const rock = mat(0x4a4458), gm = glowMat(def.color, 0.9), gb = glowMat(0x4dd0e1, 0.9), gy = glowMat(0xffd23f, 0.9);
      add(B(4.6, 4.4, 3.2), rock, 0, 4.8, 0);
      add(B(3, 2.6, 2.6), rock, 0, 8.3, 0);
      eyes(8.5, 1.32, 0.7, 0.6, 0.4, glowMat(0x7df9ff, 1.6));
      [[gm, -1.4, 6, 1.6], [gb, 1.2, 4.2, 1.6], [gy, 0.2, 3, 1.6], [gm, 1.0, 9.8, 0.4], [gb, -0.9, 10, 0], [gy, 0, 10.3, -0.8]].forEach(([m, x, y, z], i) => {
        const c = add(new THREE.OctahedronGeometry(0.9 + (i % 3) * 0.3), m, x, y, z); c.scale.y = 1.6; c.rotation.z = (i - 2) * 0.3;
      });
      anims.push(t => { gm.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 2)) * 0.6; gb.emissiveIntensity = 0.7 + Math.abs(Math.cos(t * 2)) * 0.6; });
      armL = limb(-3, 6.6, 1.5, 3.6, rock); armR = limb(3, 6.6, 1.5, 3.6, rock);
      add(new THREE.OctahedronGeometry(1.1), gm, 0, -4, 0, armL); add(new THREE.OctahedronGeometry(1.1), gb, 0, -4, 0, armR);
      legL = limb(-1.3, 2.6, 1.7, 2.6, rock); legR = limb(1.3, 2.6, 1.7, 2.6, rock);
      break;
    }
    case 'burger': {   // ハンバーガー大王（王冠・ごま・チーズ）
      const bun = mat(0xd9903f), patty = mat(0x5a3020);
      add(C(3, 3.2, 1.4, 20), bun, 0, 2.6, 0);
      add(C(3.4, 3.4, 1.2, 20), patty, 0, 3.9, 0);
      add(B(6.4, 0.25, 6.4), mat(0xffd23f), 0, 4.6, 0).rotation.y = Math.PI / 4;
      add(C(3.5, 3.3, 0.4, 20), mat(0x4cd964), 0, 4.9, 0);
      add(C(3.2, 3.2, 0.5, 20), mat(0xff3b3b), 0, 5.3, 0);
      add(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, 5.5, 0).scale.y = 0.85;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(S(0.15, 6, 4), white, Math.cos(a) * 1.8, 7.75, Math.sin(a) * 1.8); }
      eyes(6.8, 2.85, 0.9, 0.6, 0.6, black);
      crown(8.3, 1.1);
      armL = limb(-3.6, 4.2, 0.6, 2.6, white); armR = limb(3.6, 4.2, 0.6, 2.6, white);
      legL = limb(-1.4, 1.9, 0.8, 1.9, mat(0xffd23f)); legR = limb(1.4, 1.9, 0.8, 1.9, mat(0xffd23f));
      break;
    }
    case 'wizard': {   // 大魔法使い（とんがり帽子・白いひげ・まわる本・魔法陣）
      const star = glowMat(0xffd23f, 1.1);
      add(C(1.6, 3.4, 6, 16), body, 0, 3.6, 0);
      add(S(1.6, 16, 12), mat(0xffe0c8), 0, 7.6, 0);
      eyes(7.8, 1.5, 0.55, 0.4, 0.3, glowMat(0x7df9ff, 1.4));
      add(K(1.4, 3.2, 12), white, 0, 5.9, 0.9).rotation.x = Math.PI;
      add(C(2.8, 2.8, 0.25, 20), body, 0, 8.8, 0);
      add(K(1.6, 4.6, 14), body, 0, 11.2, 0).rotation.z = 0.15;
      for (let i = 0; i < 4; i++) add(new THREE.OctahedronGeometry(0.3), star, Math.cos(i * 1.6) * 1.2, 9.6 + i * 0.6, Math.sin(i * 1.6) * 1.2);
      const circ = add(new THREE.TorusGeometry(4.5, 0.12, 6, 40), glowMat(0x9c6bff, 1.2), 0, 0.3, 0); circ.rotation.x = Math.PI / 2;
      const books = pivot(0, 6, 0);
      [0xd94a3a, 0x3a8dff, 0x4cd964].forEach((c, i) => { const a = i / 3 * Math.PI * 2; add(B(1.2, 1.6, 0.4), mat(c), Math.cos(a) * 4, 0, Math.sin(a) * 4, books); });
      anims.push(t => { books.rotation.y = t * 0.8; star.emissiveIntensity = 0.8 + Math.abs(Math.sin(t * 3)) * 0.8; });
      armL = limb(-2, 6, 0.9, 3, body); armR = limb(2, 6, 0.9, 3, body);
      add(C(0.12, 0.15, 5, 8), mat(0x8a5a2b), 0, -3, 0.6, armR); add(new THREE.OctahedronGeometry(0.6), glowMat(0x7df9ff, 1.4), 0, -0.4, 0.6, armR);
      legL = pivot(-0.9, 0.6); legR = pivot(0.9, 0.6);
      break;
    }
    case 'steamgiant': {   // 蒸気の巨人（ボイラーの体・ゴーグル・えんとつのけむり・背中の歯車）
      const iron = mat(0x3a3a3a), cop = mat(0xc0673f);
      add(C(2.6, 2.8, 5, 16), body, 0, 5, 0);
      for (const y of [3.2, 5, 6.8]) add(new THREE.TorusGeometry(2.75, 0.15, 6, 24), iron, 0, y, 0).rotation.x = Math.PI / 2;
      add(B(2.8, 2.4, 2.4), cop, 0, 8.8, 0);
      for (const s of [-1, 1]) {
        add(new THREE.TorusGeometry(0.5, 0.15, 8, 16), iron, s * 0.65, 9.1, 1.25);
        add(C(0.4, 0.4, 0.1, 14), glowMat(0xffb300, 1.4), s * 0.65, 9.1, 1.22).rotation.x = Math.PI / 2;
      }
      add(C(0.5, 0.6, 2.4, 10), iron, 1.6, 11, -0.5);
      const puffs = []; for (let i = 0; i < 4; i++) puffs.push(add(S(0.7, 10, 8), mat(0xeeeeee), 1.6, 12.6 + i * 1.1, -0.5));
      const gear = pivot(0, 6, -2.9);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(B(0.6, 0.6, 0.4), body, Math.cos(a) * 2, Math.sin(a) * 2, 0, gear).rotation.z = a; }
      add(new THREE.TorusGeometry(1.8, 0.35, 6, 20), body, 0, 0, 0, gear);
      anims.push(t => { gear.rotation.z = t * 1.5; puffs.forEach((p, i) => { const k = (t * 0.8 + i / 4) % 1; p.position.y = 12.4 + k * 4.5; p.scale.setScalar(0.5 + k); }); });
      armL = limb(-3.2, 7, 1.2, 3.6, cop); armR = limb(3.2, 7, 1.2, 3.6, cop);
      add(C(0.9, 0.9, 0.5, 6), iron, 0, -4, 0, armR).rotation.x = Math.PI / 2;
      legL = limb(-1.2, 2.6, 1.4, 2.6, iron); legR = limb(1.2, 2.6, 1.4, 2.6, iron);
      break;
    }
    case 'baku': {   // 夢喰いバク（ねむった目・長い鼻・ナイトキャップ・Zzz）
      const pnk = mat(0xff9ecb);
      add(S(3, 18, 14), body, 0, 4.6, -0.4).scale.set(1.1, 0.95, 1.3);
      add(S(2, 18, 14), body, 0, 7.4, 1.6);
      for (const s of [-1, 1]) {
        add(B(0.7, 0.14, 0.1), black, s * 0.75, 7.8, 3.45);
        add(S(0.6, 10, 8), pnk, s * 1.5, 9, 1.2).scale.set(1, 1, 0.4);
      }
      const tr = pivot(0, 7, 3.4);
      for (let i = 0; i < 4; i++) add(S(0.55 - i * 0.07, 10, 8), body, 0, -i * 0.7, i * 0.25, tr);
      add(K(1.3, 2.6, 12), mat(0x8a7dff), 0.4, 10.2, 1.4).rotation.z = -0.4;
      add(S(0.4, 10, 8), white, 0.95, 11.4, 1.4);
      const zz = pivot(2.4, 10.5, 1.6);
      for (let i = 0; i < 3; i++) add(B(0.8 - i * 0.15, 0.8 - i * 0.15, 0.1), glowMat(0xfff27a, 1), i * 0.9, i * 1.0, 0, zz);
      anims.push(t => { tr.rotation.x = Math.sin(t * 2) * 0.3; zz.position.y = 10.5 + Math.sin(t * 1.5) * 0.5; zz.rotation.z = Math.sin(t) * 0.2; });
      armL = limb(-1.8, 3, 1.2, 3, body, 1.8); armR = limb(1.8, 3, 1.2, 3, body, 1.8);
      legL = limb(-1.8, 3, 1.3, 3, body, -2.2); legR = limb(1.8, 3, 1.3, 3, body, -2.2);
      break;
    }
    case 'sungod': {   // 太陽神（太陽の頭とまわる光・手に火の玉）
      const gold = glowMat(0xffd23f, 0.9), fire = glowMat(0xff7a2a, 1.2);
      add(B(3.8, 4.2, 2.6), body, 0, 4.6, 0);
      add(B(4, 0.8, 2.8), mat(0xfff3c4), 0, 6.4, 0);
      add(S(2.2, 20, 16), gold, 0, 9, 0);
      const rays = pivot(0, 9, -0.3);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(K(0.55, 2, 6), i % 2 ? fire : gold, Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0, rays).rotation.z = a - Math.PI / 2; }
      eyes(9.3, 2.12, 0.75, 0.6, 0.35, black);
      add(B(1.4, 0.25, 0.1), mat(0xff5a00), 0, 8.4, 2.12);
      anims.push(t => { rays.rotation.z = t * 0.7; fire.emissiveIntensity = 1 + Math.sin(t * 6) * 0.4; });
      armL = limb(-2.5, 6, 1, 3.2, body); armR = limb(2.5, 6, 1, 3.2, body);
      add(S(0.8, 12, 10), fire, 0, -3.6, 0, armR);
      legL = limb(-1, 2.4, 1.3, 2.4, body); legR = limb(1, 2.4, 1.3, 2.4, body);
      break;
    }
    case 'moonrabbit': {   // 月の大うさぎ（長い耳・月の冠・きねを持つ・まわる月）
      const fur = mat(def.color), pink = mat(0xffa8c8), gold = glowMat(0xffe066, 1.1);
      const bd = add(S(2.4, 18, 14), fur, 0, 4.4, 0); bd.scale.set(1, 1.1, 0.95);
      add(S(1.7, 18, 14), fur, 0, 7.6, 0);
      eyes(7.8, 1.55, 0.6, 0.45, 0.35, glowMat(0xff3b6b, 1.6));
      add(S(0.25, 8, 6), pink, 0, 7.3, 1.65);
      for (const s of [-1, 1]) {   // 長い耳
        const e = add(S(0.6, 12, 10), fur, s * 0.8, 10.2, 0); e.scale.set(1, 3.2, 0.6); e.rotation.z = -s * 0.2;
        const i2 = add(S(0.35, 10, 8), pink, s * 0.8, 10.2, 0.3); i2.scale.set(1, 3.6, 0.3); i2.rotation.z = -s * 0.2;
      }
      add(new THREE.TorusGeometry(0.9, 0.22, 8, 24, Math.PI * 1.3), gold, 0, 9.4, 0.3).rotation.z = 2.0;   // 月の冠
      const orbit = new THREE.Group(); orbit.position.y = 5.5; inner.add(orbit);   // まわりを回る小さな月
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(S(0.7, 12, 10), glowMat(0xfff6c8, 0.9), Math.cos(a) * 4.4, Math.sin(a * 2) * 0.6, Math.sin(a) * 4.4, orbit); }
      anims.push(t => { orbit.rotation.y = t * 0.9; gold.emissiveIntensity = 0.8 + Math.abs(Math.sin(t * 2)) * 0.6; });
      armL = limb(-2.3, 5.6, 0.9, 3, fur); armR = limb(2.3, 5.6, 0.9, 3, fur);
      add(C(0.15, 0.15, 3.4, 8), mat(0x8a5a2b), 0, -3.2, 0.5, armR); add(C(0.7, 0.7, 1.8, 14), mat(0xb07a3b), 0, -4.9, 0.5, armR).rotation.z = Math.PI / 2;   // きね
      legL = limb(-1.0, 2.4, 1.3, 2.4, fur); legR = limb(1.0, 2.4, 1.3, 2.4, fur);
      break;
    }
    case 'demonlord': {   // ラッキー大魔王（角・羽・王冠・幸運の宝石）
      const robe = mat(def.color), gold = glowMat(0xffd23f, 0.6);
      add(B(3.6, 3.6, 2.4), robe, 0, 4.6, 0);
      add(B(3.8, 0.5, 2.5), gold, 0, 3.0, 0);
      const gem = add(new THREE.OctahedronGeometry(0.8), glowMat(0x7dff8a, 1.4), 0, 5.2, 1.3);   // 胸の幸運の宝石
      add(B(2.6, 2.4, 2.4), mat(0x8a1a3a), 0, 7.6, 0);
      eyes(7.8, 1.22, 0.6, 0.55, 0.3, glowMat(0xffe600, 2));
      add(B(1.8, 0.3, 0.1), black, 0, 6.9, 1.22);
      for (const s of [-1, 1]) { const h = add(K(0.4, 2.6, 6), mat(0x1a1a1a), s * 1.2, 9.6, 0); h.rotation.z = -s * 0.6; }
      crown(9.0, 1.1);
      wings(6.4, -1.2, 6, mat(0x2a0a3a), 2.5);
      const pv = pivot(0, 6.8, -1.3); add(B(4.2, 6, 0.15), mat(0x8a1a3a), 0, -3, 0, pv);   // マント
      anims.push(t => { gem.rotation.y = t * 2; pv.rotation.x = -0.1 - Math.abs(Math.sin(t * 2.5)) * 0.2; });
      armL = limb(-2.6, 6, 1.2, 3.4, robe); armR = limb(2.6, 6, 1.2, 3.4, robe);
      add(C(0.15, 0.15, 6, 8), gold, 0, -2.6, 0.5, armR); add(S(0.6, 12, 10), glowMat(0xff5cf4, 1.4), 0, -5.8, 0.5, armR);   // 杖
      legL = limb(-1.1, 2.8, 1.3, 2.8, robe); legR = limb(1.1, 2.8, 1.3, 2.8, robe);
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
  const am = (geo, m, x, y, z) => add(new THREE.Mesh(geo, m), x, y, z);   // 形と色からパーツを作って置く

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
      case 'canopy': {   // 木: 頭の上に大きな葉っぱのかたまり
        const lf = mat(def.accent), lf2 = mat(0x7ddc5a);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const c = am(new THREE.IcosahedronGeometry(0.8, 0), i % 2 ? lf : lf2, Math.cos(a) * 0.7, top + 0.6 + (i % 2) * 0.3, Math.sin(a) * 0.7); c.rotation.set(i, i * 2, 0); }
        am(new THREE.IcosahedronGeometry(0.9, 0), lf, 0, top + 1.2, 0);
        break;
      }
      case 'grassblades':   // 草: 上に細い草がたくさん
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const b = am(new THREE.ConeGeometry(0.12, 1.1, 4), mat(i % 2 ? def.accent : 0x9be15d), Math.cos(a) * 0.5, top + 0.4, Math.sin(a) * 0.5); b.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); anims.push(time => { b.rotation.z = -Math.cos(a) * 0.35 + Math.sin(time * 3 + i) * 0.12; }); }
        break;
      case 'veins': {   // 葉: 葉脈（くろい線）と茎
        const v = mat(def.accent);
        am(new THREE.BoxGeometry(0.06, 1.8, 0.05), v, 0, 1.3, S.front + 0.02).rotation.z = 0.15;
        for (const y of [0.9, 1.5]) for (const s of [-1, 1]) { const l = am(new THREE.BoxGeometry(0.5, 0.06, 0.05), v, s * 0.25, y, S.front - 0.02); l.rotation.z = s * 0.5; }
        am(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), mat(0x1f8a3a), 0, top + 0.3, 0);
        break;
      }
      case 'droptop': {   // 水: しずくの先っぽと、まわりの泡
        am(new THREE.ConeGeometry(0.75, 1.3, 16), body, 0, top + 0.25, 0);
        const bub = new THREE.Group(); bub.position.y = top * 0.5; g.add(bub);
        for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc8f7ff, transparent: true, opacity: 0.7 })); const a = i / 5 * Math.PI * 2; b.position.set(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3); bub.add(b); }
        anims.push(time => { bub.rotation.y = time * 1.2; bub.children.forEach((b, i) => { b.position.y = ((time * 0.5 + i * 0.3) % 1.6) - 0.8; }); });
        break;
      }
      case 'raincloud': {   // 水: 灰色の雲がくっついている
        const cl = mat(def.accent);
        for (let i = 0; i < 4; i++) am(new THREE.SphereGeometry(0.42, 10, 8), cl, -0.9 + (i % 2) * 0.3, 1.6 - i * 0.35, -0.2 + (i % 3) * 0.3);
        break;
      }
      case 'bigbolt': {   // 雷: 頭の上に大きな稲妻
        const y = glowMat(0xffc21a, 1.2);
        const bt = new THREE.Group(); bt.position.y = top + 1.0; g.add(bt);
        [[0, 0.55, 0.5], [0.18, 0, -0.5], [0, -0.55, 0.5]].forEach(([x, yy, r]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), y); s.position.set(x, yy, 0); s.rotation.z = r; bt.add(s); });
        anims.push(time => { bt.rotation.y = Math.sin(time * 2) * 0.4; y.emissiveIntensity = 0.8 + Math.abs(Math.sin(time * 9)) * 0.8; });
        break;
      }
      case 'fireball': {   // 炎: 体の中に光る黄色い芯
        const core = am(new THREE.SphereGeometry(0.42, 14, 10), glowMat(def.accent, 1.3), 0, 0.75, S.front - 0.2);
        anims.push(time => core.scale.setScalar(0.9 + Math.abs(Math.sin(time * 6)) * 0.25));
        break;
      }
      case 'drumring': {   // 雷神の太鼓の輪（背中でまわる）
        const rg = new THREE.Group(); rg.position.set(0, top * 0.6, -0.9); g.add(rg);
        rg.add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 6, 24), mat(0xd94a3a)));
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 12), mat(0xd94a3a)); d.rotation.x = Math.PI / 2; d.position.set(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0); rg.add(d); }
        anims.push(time => { rg.rotation.z = time * 0.8; });
        break;
      }
      case 'rod': {   // ひらいしん: 頭の上の金属の棒と、ときどき光る玉
        am(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), mat(0xd0d6e0), 0, top + 0.6, 0);
        const b = am(new THREE.SphereGeometry(0.2, 10, 8), glowMat(def.accent, 1.2), 0, top + 1.3, 0);
        anims.push(() => { b.material.emissiveIntensity = Math.random() < 0.08 ? 2.5 : 1; });
        break;
      }
      case 'pandaface':   // パンダ: 黒い耳と目のまわり
        for (const s of [-1, 1]) {
          am(new THREE.SphereGeometry(0.3, 10, 8), mat(0x111111), s * 0.62, top - 0.15, 0);
          const p = am(new THREE.SphereGeometry(0.24, 10, 8), mat(0x111111), s * 0.36, S.eyeY, S.front - 0.08); p.scale.set(1, 1.3, 0.5); p.rotation.z = s * 0.4;
        }
        break;
      case 'lanternbands':   // ちょうちん: 上下の黒いわくと骨
        for (const y of [0.05, 1.75]) am(new THREE.CylinderGeometry(0.9, 0.9, 0.18, 18), mat(0x111111), 0, y, 0);
        for (const y of [0.55, 1.25]) am(new THREE.TorusGeometry(0.9, 0.03, 4, 24), mat(0x8a2a1a), 0, y, 0).rotation.x = Math.PI / 2;
        break;
      case 'bamboostalk': {   // 横に竹が1本
        const nd = mat(0x4f8a2a);
        am(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8), mat(0x7fc75a), 1.15, 1.3, -0.2);
        for (const y of [0.6, 1.4, 2.2]) am(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8), nd, 1.15, y, -0.2);
        am(new THREE.SphereGeometry(0.3, 8, 6), mat(0x5cb84a), 1.4, 2.6, -0.2).scale.set(1.5, 0.3, 0.6);
        break;
      }
      case 'notes': {   // まわりに浮かぶ音符
        const ng = new THREE.Group(); ng.position.y = top * 0.6; g.add(ng);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI * 2, m = glowMat([0xff6ec7, 0x7ad7ff, 0xffd23f][i], 1);
          const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); h.scale.set(1.3, 1, 0.7); h.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); ng.add(h);
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), m); st.position.set(Math.cos(a) * 1.5 + 0.17, 0.25, Math.sin(a) * 1.5); ng.add(st);
        }
        anims.push(time => { ng.rotation.y = time * 1.2; ng.position.y = top * 0.6 + Math.sin(time * 3) * 0.15; });
        break;
      }
      case 'pianokeys':   // ピアノ: 前にけんばん
        for (let i = 0; i < 6; i++) am(new THREE.BoxGeometry(0.26, 0.12, 0.4), white, -0.7 + i * 0.28, 0.45, 0.95);
        for (const i of [0, 1, 3, 4]) am(new THREE.BoxGeometry(0.14, 0.1, 0.24), black, -0.56 + i * 0.28, 0.55, 0.9);
        break;
      case 'drumtop':   // たいこ: 上の皮とばち
        am(new THREE.CylinderGeometry(0.97, 0.97, 0.08, 18), accent, 0, 1.82, 0);
        for (const s of [-1, 1]) am(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), mat(0x8a5a2b), s * 0.4, 2.2, 0).rotation.z = s * 0.5;
        break;
      case 'baton': {   // 指揮棒をふる
        const bt = am(new THREE.CylinderGeometry(0.03, 0.04, 1.1, 6), white, 1.1, 1.4, 0.3);
        anims.push(time => { bt.rotation.z = -0.6 + Math.sin(time * 6) * 0.5; });
        break;
      }
      case 'clownnose':   // ピエロの赤い鼻
        am(new THREE.SphereGeometry(0.2, 10, 8), glowMat(0xff2020, 0.8), 0, S.eyeY - 0.25, S.front + 0.12);
        break;
      case 'jesterhat':   // 2つにわかれたピエロの帽子
        for (const s of [-1, 1]) {
          am(new THREE.ConeGeometry(0.3, 1.0, 8), mat(s < 0 ? 0xff3b3b : 0x3a8dff), s * 0.35, top + 0.4, 0).rotation.z = -s * 0.6;
          am(new THREE.SphereGeometry(0.13, 8, 6), mat(0xffd23f), s * 0.64, top + 0.82, 0);
        }
        break;
      case 'balloons': {   // ふうせんを持つ
        const bg = new THREE.Group(); bg.position.set(1.0, 0.9, 0); g.add(bg);
        [0xff5c8a, 0x3a8dff, 0xffd23f].forEach((c, i) => {
          const x = (i - 1) * 0.45, y = 2.4 + (i % 2) * 0.4;
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, y, 4), white); st.position.set(x / 2, y / 2, 0); st.rotation.z = -Math.atan2(x, y); bg.add(st);
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(c)); b.scale.y = 1.2; b.position.set(x, y, 0); bg.add(b);
        });
        anims.push(time => { bg.rotation.z = Math.sin(time * 1.5) * 0.08; });
        break;
      }
      case 'popcorn':   // 上にポップコーンがもりもり、入れ物に白いしま
        for (let i = 0; i < 10; i++) { const a = i * 2.4, rr = 0.28 * (i % 3); am(new THREE.IcosahedronGeometry(0.28, 0), mat(0xfff6d5), Math.cos(a) * rr, top + 0.1 + (i % 4) * 0.15, Math.sin(a) * rr); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; am(new THREE.BoxGeometry(0.2, 1.7, 0.05), white, Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9).rotation.y = Math.PI / 2 - a; }
        break;
      case 'ferris': {   // 観覧車: 背中でまわる輪
        const fw = new THREE.Group(); fw.position.set(0, top + 0.6, -0.6); g.add(fw);
        fw.add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24), accent));
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat([0xff3b3b, 0x4cd964, 0xff77e9][i % 3])); c.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0); fw.add(c); }
        anims.push(time => { fw.rotation.z = time; });
        break;
      }
      case 'crystals':   // 体から宝石がつき出る
        [[0, top + 0.3, 0, 0], [-0.6, top - 0.2, 0, 0.6], [0.6, top - 0.2, 0, -0.6], [0, top - 0.5, -0.6, 0]].forEach(([x, y, z, r], i) => {
          const c = am(new THREE.OctahedronGeometry(i ? 0.25 : 0.35), glowMat(def.accent, 0.9), x, y, z); c.scale.y = 2; c.rotation.z = r;
        });
        break;
      case 'bun': {   // ハンバーガー: 上下のパン・レタス・チーズ・ごま
        const b = mat(0xe0a050);
        am(new THREE.SphereGeometry(1.0, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), b, 0, 1.75, 0).scale.y = 0.7;
        am(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 18), mat(0x4cd964), 0, 1.72, 0);
        am(new THREE.BoxGeometry(1.6, 0.06, 1.6), mat(0xffd23f), 0, 1.66, 0).rotation.y = Math.PI / 4;
        am(new THREE.CylinderGeometry(1.0, 0.95, 0.35, 18), b, 0, 0.1, 0);
        for (let i = 0; i < 5; i++) am(new THREE.SphereGeometry(0.06, 6, 4), white, Math.cos(i * 1.3) * 0.5, 2.32, Math.sin(i * 1.3) * 0.5);
        break;
      }
      case 'pepperoni':   // ピザ: ペパロニと生地のふち
        for (const [x, y] of [[-0.5, 0.35], [0.5, 0.4], [0.05, 1.45]]) {
          const r = 1 - 0.8 * y / 2.2, z = Math.sqrt(Math.max(0.01, r * r - x * x)) + 0.02;
          am(new THREE.CircleGeometry(0.17, 12), accent, x, y, z).rotation.y = Math.atan2(x, z);
        }
        am(new THREE.CylinderGeometry(1.05, 1.05, 0.2, 18), mat(0xd9903f), 0, 0.1, 0);
        break;
      case 'noodles':   // ラーメン: どんぶり・めん・なると・はし
        am(new THREE.CylinderGeometry(1.15, 0.8, 0.9, 18), accent, 0, 0.35, 0);
        for (let i = 0; i < 5; i++) am(new THREE.TorusGeometry(0.25, 0.05, 6, 12), mat(0xffe08a), Math.cos(i * 1.25) * 0.45, 1.5, Math.sin(i * 1.25) * 0.45).rotation.x = Math.PI / 2;
        am(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), white, 0.3, 1.58, 0.3);
        for (const s of [-1, 1]) am(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), mat(0x8a5a2b), -0.4 + s * 0.12, 2.0, -0.2).rotation.z = 0.5;
        break;
      case 'ketchup':   // オムライス: ケチャップのぎざぎざとお皿
        for (let i = 0; i < 4; i++) { const x = -0.45 + i * 0.3; am(new THREE.BoxGeometry(0.12, 0.06, 0.7), accent, x, top - 0.02 - x * x * 0.5, 0).rotation.y = i % 2 ? 0.6 : -0.6; }
        am(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 20), white, 0, 0.55, 0);
        break;
      case 'chefhat':   // コック帽
        am(new THREE.CylinderGeometry(0.55, 0.5, 0.5, 14), white, 0, top + 0.2, 0);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; am(new THREE.SphereGeometry(0.35, 10, 8), white, Math.cos(a) * 0.35, top + 0.65, Math.sin(a) * 0.35); }
        am(new THREE.SphereGeometry(0.4, 10, 8), white, 0, top + 0.8, 0);
        break;
      case 'cherry':   // パフェ: クリームとさくらんぼ
        am(new THREE.SphereGeometry(0.45, 12, 10), white, 0, top + 0.15, 0);
        am(new THREE.SphereGeometry(0.22, 10, 8), glowMat(def.accent, 0.6), 0, top + 0.65, 0);
        am(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), mat(0x3a7d23), 0.08, top + 0.95, 0).rotation.z = -0.4;
        break;
      case 'wizardhat':   // とんがり帽子（金の星つき）
        am(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 18), accent, 0, top, 0);
        am(new THREE.ConeGeometry(0.55, 1.4, 14), accent, 0, top + 0.7, 0).rotation.z = 0.15;
        am(new THREE.OctahedronGeometry(0.12), glowMat(0xffd23f, 1), 0.15, top + 0.6, 0.45);
        break;
      case 'cork': {   // 魔法のびん: コルクの栓と、のぼっていくあわ
        am(new THREE.CylinderGeometry(0.35, 0.45, 0.4, 10), mat(0x8a6a4a), 0, top + 0.15, 0);
        const bs = [];
        for (let i = 0; i < 3; i++) bs.push(am(new THREE.SphereGeometry(0.1 + i * 0.03, 8, 6), glowMat(def.accent, 1), (i - 1) * 0.25, top + 0.5, 0));
        anims.push(time => bs.forEach((b, i) => { const k = (time * 0.6 + i / 3) % 1; b.position.y = top + 0.4 + k * 1.2; b.scale.setScalar(1 - k * 0.6); }));
        break;
      }
      case 'bookpages':   // 魔導書: 横の白いページと金の角かざり
        am(new THREE.BoxGeometry(0.08, 1.6, 1.6), white, 0.9, 0.9, 0);
        for (const [x, y] of [[-0.75, 0.15], [0.75, 0.15], [-0.75, 1.65], [0.75, 1.65]]) am(new THREE.BoxGeometry(0.3, 0.3, 0.05), accentGlow, x, y, 0.92);
        am(new THREE.BoxGeometry(0.2, 0.5, 0.08), accentGlow, 0.85, 0.5, 0.6);
        break;
      case 'wand': {   // 魔法のつえ（先で星が光る）
        am(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), mat(0x8a5a2b), 1.15, 1.2, 0.2).rotation.z = -0.4;
        const st = am(new THREE.OctahedronGeometry(0.18), glowMat(0xffd23f, 1.4), 1.4, 1.8, 0.2);
        anims.push(time => { st.rotation.y = time * 4; st.material.emissiveIntensity = 1 + Math.sin(time * 6) * 0.5; });
        break;
      }
      case 'gears': {   // 両わきでまわる歯車
        for (const s of [-1, 1]) {
          const gr = new THREE.Group(); gr.position.set(s * 0.95, 1.0, 0); gr.rotation.y = Math.PI / 2; g.add(gr);
          gr.add(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 6, 16), mat(0xd4a84a)));
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), mat(0xd4a84a)); t.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0); t.rotation.z = a; gr.add(t); }
          anims.push(time => { gr.rotation.z = time * 2 * s; });
        }
        break;
      }
      case 'chimney': {   // えんとつと、もくもくのけむり
        am(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), mat(0x3a3a3a), 0.35, top + 0.3, -0.2);
        const ps = [];
        for (let i = 0; i < 3; i++) ps.push(am(new THREE.SphereGeometry(0.2, 8, 6), mat(0xeeeeee), 0.35, top + 0.8, -0.2));
        anims.push(time => ps.forEach((p, i) => { const k = (time * 0.7 + i / 3) % 1; p.position.y = top + 0.75 + k * 1.3; p.position.x = 0.35 + k * 0.3; p.scale.setScalar(0.6 + k); }));
        break;
      }
      case 'clockface': {   // 懐中時計: 上に文字盤とまわる針、くさりの輪
        am(new THREE.CircleGeometry(0.75, 20), white, 0, top + 0.01, 0).rotation.x = -Math.PI / 2;
        const hd = new THREE.Group(); hd.position.y = top + 0.04; g.add(hd);
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.55), black); h1.position.z = 0.27; hd.add(h1);
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.05), black); h2.position.x = 0.2; hd.add(h2);
        am(new THREE.TorusGeometry(0.22, 0.06, 6, 12), mat(0xffd23f), 0, top + 0.1, -0.95);
        anims.push(time => { hd.rotation.y = -time; h2.rotation.y = time * 0.1; });
        break;
      }
      case 'goggles':   // おでこのゴーグル
        for (const s of [-1, 1]) {
          am(new THREE.TorusGeometry(0.22, 0.07, 8, 16), accent, s * 0.3, S.eyeY + 0.5, S.front - 0.05);
          am(new THREE.CircleGeometry(0.2, 14), glowMat(0x7ad7ff, 0.6), s * 0.3, S.eyeY + 0.5, S.front - 0.03);
        }
        am(new THREE.TorusGeometry(0.88, 0.05, 6, 24), mat(0x3a2a1a), 0, S.eyeY + 0.5, 0).rotation.x = Math.PI / 2;
        break;
      case 'zzz': {   // Zzz（ねむねむ）
        const zm = glowMat(0x8a7dff, 0.9);
        const zg = new THREE.Group(); zg.position.set(0.7, top + 0.2, 0); g.add(zg);
        const mkZ = () => {
          const z = new THREE.Group();
          const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), zm); t.position.y = 0.15; z.add(t);
          const b = t.clone(); b.position.y = -0.15; z.add(b);
          const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), zm); d.rotation.z = -Math.PI / 4; z.add(d);
          zg.add(z); return z;
        };
        const zs = [mkZ(), mkZ(), mkZ()];
        anims.push(time => zs.forEach((z, i) => { const k = (time * 0.4 + i / 3) % 1; z.position.set(k * 0.6, k * 1.2, 0); z.scale.setScalar(0.6 + k * 0.8); }));
        break;
      }
      case 'nightcap':   // ナイトキャップ（先にぽんぽん）
        am(new THREE.ConeGeometry(0.6, 1.4, 14), accent, 0.15, top + 0.55, 0).rotation.z = -0.5;
        am(new THREE.TorusGeometry(0.58, 0.12, 8, 18), white, 0, top + 0.02, 0).rotation.x = Math.PI / 2;
        am(new THREE.SphereGeometry(0.18, 10, 8), white, 0.49, top + 1.16, 0);
        break;
      case 'trunk': {   // バク: 長い鼻とまるい耳
        const tr = new THREE.Group(); tr.position.set(0, S.eyeY - 0.25, S.front); g.add(tr);
        for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2 - i * 0.03, 8, 6), body); s.position.set(0, -i * 0.22, 0.1 + i * 0.08); tr.add(s); }
        anims.push(time => { tr.rotation.x = Math.sin(time * 2) * 0.25; });
        for (const s of [-1, 1]) am(new THREE.SphereGeometry(0.22, 8, 6), accent, s * 0.6, top - 0.2, 0);
        break;
      }
      case 'petals':   // ひまわり: まわりの黄色い花びら
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = am(new THREE.SphereGeometry(0.3, 8, 6), accent, Math.cos(a) * 1.15, 1 + Math.sin(a) * 1.15, -0.1); p.scale.set(0.6, 1.3, 0.25); p.rotation.z = a - Math.PI / 2; }
        break;
      case 'sunrays': {   // 太陽の光（まわりでまわるトゲ）
        const sr = new THREE.Group(); sr.position.set(0, top / 2, -0.15); g.add(sr);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const r = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 6), glowMat(i % 2 ? 0xff7a2a : 0xffd23f, 1)); r.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0); r.rotation.z = a - Math.PI / 2; sr.add(r); }
        anims.push(time => { sr.rotation.z = time * 0.8; });
        break;
      }
      case 'shades':   // サングラス
        for (const s of [-1, 1]) am(new THREE.BoxGeometry(0.42, 0.26, 0.06), mat(0x111111), s * 0.36, S.eyeY, S.front + 0.24);
        am(new THREE.BoxGeometry(0.3, 0.05, 0.05), mat(0x111111), 0, S.eyeY + 0.08, S.front + 0.24);
        break;
      case 'bunnyears':   // うさぎの長い耳（内側がピンク）
        for (const s of [-1, 1]) {
          const e = am(new THREE.SphereGeometry(0.28, 12, 8), body, s * 0.38, top + 0.75, 0); e.scale.set(1, 2.8, 0.7); e.rotation.z = -s * 0.15;
          const inr = am(new THREE.SphereGeometry(0.16, 10, 6), mat(def.accent === 0xffd23f ? 0xffa8c8 : def.accent), s * 0.38, top + 0.75, 0.13); inr.scale.set(1, 3.4, 0.4); inr.rotation.z = -s * 0.15;
          anims.push(time => { e.rotation.x = Math.sin(time * 2 + s) * 0.12; inr.rotation.x = e.rotation.x; });
        }
        break;
      case 'dangostack': {   // 月見だんご: 頭の上にだんごが3つ、下に台
        const dw = mat(0xfffaf0);
        [[-0.45, 0], [0.45, 0], [0, 0.55]].forEach(([x, y]) => am(new THREE.SphereGeometry(0.42, 14, 10), dw, x, top + 0.35 + y, -0.1));
        am(new THREE.BoxGeometry(2.2, 0.25, 1.8), mat(def.accent), 0, 0.05, 0);
        break;
      }
      case 'crescent': {   // 光る三日月がうかんでいる
        const cr = am(new THREE.TorusGeometry(0.55, 0.16, 8, 20, Math.PI * 1.25), glowMat(0xffe066, 1.1), 0.9, top + 0.55, 0);
        cr.rotation.z = 2.2;
        anims.push(time => { cr.position.y = top + 0.55 + Math.sin(time * 2) * 0.12; });
        break;
      }
      case 'craters':   // 満月: くぼみ（クレーター）
        [[-0.35, 1.35, 0.3], [0.4, 0.75, 0.22], [0.1, 0.55, 0.16], [0.5, 1.5, 0.14], [-0.55, 0.8, 0.18]].forEach(([x, y, r]) => {
          const c = am(new THREE.CircleGeometry(r, 14), mat(def.accent), x, y, 0);
          c.lookAt(x * 4, 1 + (y - 1) * 4, 4); c.position.set(x, y, Math.sqrt(Math.max(0, 1 - x * x - (y - 1) * (y - 1))) + 0.01);
        });
        break;
      case 'startail': {   // 流れ星: 頭に星、うしろに光のしっぽ
        const st = am(new THREE.OctahedronGeometry(0.55), glowMat(0xfff27a, 1.2), 0, top + 0.5, 0);
        const tl = new THREE.Group(); tl.position.set(0, top * 0.6, -0.6); g.add(tl);
        [0x7ad7ff, 0xff9ecb, 0xfff27a].forEach((c, i) => { const t = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 2.2, 8), glowMat(c, 0.9)); t.rotation.x = -Math.PI / 2 - 0.3; t.position.set((i - 1) * 0.35, 0.1 * i, -1.0); tl.add(t); });
        anims.push(time => { st.rotation.y = time * 2.5; tl.rotation.z = Math.sin(time * 4) * 0.1; });
        break;
      }
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
