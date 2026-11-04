// 効果音（Web Audio API でデコードして再生）
const FILES = ['swing', 'hit', 'hit_perfect', 'land', 'roulette', 'reveal', 'boss', 'boss_run',
  'caught', 'safe', 'buy', 'coin', 'lift', 'evolve', 'whoosh'];

let ctx = null;
let master = null;
const buffers = {};
const loops = {};
let volume = 0.7;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  for (const name of FILES) {
    fetch(`sounds/${name}.mp3`)
      .then(r => r.arrayBuffer())
      .then(b => ctx.decodeAudioData(b))
      .then(buf => { buffers[name] = buf; })
      .catch(() => {});
  }
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function play(name, { vol = 1, rate = 1 } = {}) {
  if (!ctx || !buffers[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
}

export function startLoop(name, vol = 1) {
  if (!ctx || !buffers[name] || loops[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
  loops[name] = src;
}

export function stopLoop(name) {
  if (!loops[name]) return;
  try { loops[name].stop(); } catch (e) { /* 既に停止済み */ }
  delete loops[name];
}

// かんたんなメロディ（notes: [MIDI番号 or null(休み), 拍] の並び）
export function playTune(notes, bpm = 120, vol = 0.22) {
  if (!ctx) return;
  const beat = 60 / bpm;
  let t = ctx.currentTime + 0.05;
  for (const [n, len] of notes) {
    const d = len * beat;
    if (n != null) {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.25]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f * mul;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * v, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.15, d * 0.95));
        o.connect(g).connect(master);
        o.start(t); o.stop(t + d + 0.05);
      }
    }
    t += d;
  }
}
