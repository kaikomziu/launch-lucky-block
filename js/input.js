// 入力（PC: WASD＋マウスロック視点 / スマホ: ジョイスティック＋スワイプ視点）
export const input = {
  move: { x: 0, y: 0 },   // x: 右+, y: 前+
  camYaw: 0,
  camPitch: 0.38,
  zoom: 1,
  locked: false,
  onAction: null,
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
};

const keys = new Set();
let lockTarget = null;

// マウスロック（Esc 解除直後は再ロックが拒否されることがあるので失敗は無視）
export function lockPointer() {
  if (input.isTouch || !lockTarget || document.pointerLockElement) return;
  try {
    const p = lockTarget.requestPointerLock({ unadjustedMovement: true });
    p?.catch?.(() => lockTarget.requestPointerLock()?.catch?.(() => {}));
  } catch (e) { /* 非対応ブラウザ */ }
}
export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function initInput(canvas) {
  lockTarget = canvas;
  addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    keys.add(e.code);
    if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      e.preventDefault();
      input.onAction?.();
    }
    // ダッシュ（Shift）
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) input.onDash?.();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // PC: クリックでマウスロック、ロック中はマウス移動で視点・左クリックで行動
  if (!input.isTouch) {
    document.addEventListener('pointerlockchange', () => {
      input.locked = document.pointerLockElement === canvas;
      input.onLockChange?.(input.locked);
    });
    document.addEventListener('mousemove', e => {
      if (!input.locked) return;
      input.camYaw -= e.movementX * 0.0035;
      input.camPitch = Math.min(1.2, Math.max(0.08, input.camPitch + e.movementY * 0.0025));
    });
  }

  // 視点ドラッグ（タッチ、およびマウスロック不可時のマウス）
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && !input.isTouch) {
      if (input.locked) { if (e.button === 0) input.onAction?.(); return; }
      lockPointer();   // ロックできない環境（埋め込み表示など）ではドラッグ操作で代用
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ロック移行中などは捕捉できない */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || input.locked) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    input.camYaw -= dx * 0.006;
    input.camPitch = Math.min(1.2, Math.max(0.08, input.camPitch + dy * 0.004));
  });
  const end = e => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => {
    input.zoom = Math.min(2.2, Math.max(0.55, input.zoom * (e.deltaY > 0 ? 1.08 : 0.92)));
  }, { passive: true });

  initJoystick();
  document.getElementById('dashBtn').addEventListener('pointerdown', e => {
    e.preventDefault();
    input.onDash?.();
  });
  document.getElementById('actionBtn').addEventListener('pointerdown', e => {
    e.preventDefault();
    input.onAction?.();
  });
}

function initJoystick() {
  const zone = document.getElementById('joystick');
  const knob = zone.querySelector('.knob');
  let id = null, cx = 0, cy = 0;
  const R = 55;
  zone.addEventListener('pointerdown', e => {
    id = e.pointerId;
    const r = zone.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    zone.setPointerCapture(id);
    update(e);
  });
  const update = e => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / R; joy.y = -dy / R;
  };
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) update(e); });
  const end = e => {
    if (e.pointerId !== id) return;
    id = null; joy.x = joy.y = 0;
    knob.style.transform = '';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}
const joy = { x: 0, y: 0 };

export function pollInput() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  x += joy.x; y += joy.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  input.move.x = x; input.move.y = y;
}
