// フレンド（かるわかGAMESアカウント同士）と、WebRTC で一緒に遊ぶための通信
// ・フレンドの申請/一覧は Supabase の RPC（llb_friend_*）
// ・つながるまでの取り次ぎ（offer / answer）だけ Supabase（llb_rtc_*）を使い、つながったら端末どうしで直接やりとりする
// ・部屋を開いた人（ホスト）に参加者がつながる星形。ホストがほかの参加者の様子を中継する

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function rpc(fn, body, keepalive = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body), keepalive });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return res.json();
}

// room: null=変えない / true=部屋を開く / false=閉じる
export const friendList = (t, room = null, keepalive = false) => rpc('llb_friend_list', { p_ka_token: t, p_room: room }, keepalive);
export const friendRequest = (t, username) => rpc('llb_friend_request', { p_ka_token: t, p_username: username });
export const friendRespond = (t, username, accept) => rpc('llb_friend_respond', { p_ka_token: t, p_username: username, p_accept: accept });
export const friendRemove = (t, username) => rpc('llb_friend_remove', { p_ka_token: t, p_username: username });
const rtcSend = (t, username, kind, payload) => rpc('llb_rtc_send', { p_ka_token: t, p_username: username, p_kind: kind, p_payload: payload });
const rtcPoll = t => rpc('llb_rtc_poll', { p_ka_token: t });

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const MAX_GUESTS = 4;

// ICE の候補が集まるまで待つ（取り次ぎを1往復で済ませるため）
function waitIce(pc, ms = 4000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(res => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); res(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, ms);
  });
}

export class Net {
  // cb: { getToken, onPeer(username, name), onLeave(username, name), onMessage(msg), onStatus(text), onHostLost(username) }
  constructor(cb) {
    this.cb = cb;
    this.peers = new Map();   // username -> { pc, dc, name }
    this.hosting = false;
    this.hostName = null;     // 参加中のホストのユーザー名
    this.pending = null;      // 参加しようとしている { username, pc, dc, until }
    this.pollTimer = null;
  }
  get connected() { return [...this.peers.values()].some(p => p.dc && p.dc.readyState === 'open'); }
  get busy() { return this.hosting || !!this.hostName || !!this.pending; }

  // ---- 部屋を開く（ホスト） ----
  async host() {
    if (this.busy) return;
    this.hosting = true;
    this.cb.onStatus?.('部屋を開きました。フレンドの参加を待っています…');
    this.startPoll(3000);
  }

  // ---- フレンドの部屋に参加する ----
  // timeout: つながるまで待つ時間（自動でつなぎ直すときは短め）
  async join(username, timeout = 30000) {
    if (this.busy) return;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const dc = pc.createDataChannel('game');
    this.pending = { username, pc, dc, until: Date.now() + timeout };
    this.setupChannel(username, '', pc, dc);
    this.cb.onStatus?.('つないでいます…');
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc);
      const r = await rtcSend(this.cb.getToken(), username, 'offer', JSON.stringify(pc.localDescription));
      if (!r?.ok) throw new Error('send');
      this.startPoll(2000);
    } catch (e) {
      this.cb.onStatus?.('つなげませんでした（フレンドが部屋を閉じたかもしれません）');
      this.closePeer(username); this.pending = null;
    }
  }

  // 取り次ぎメッセージを受け取る（ホスト中・参加待ちの間だけ）
  startPoll(ms) {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.poll(), ms);
    this.poll();
  }
  stopPoll() { clearInterval(this.pollTimer); this.pollTimer = null; }
  async poll() {
    if (this.pending && Date.now() > this.pending.until) {
      const u = this.pending.username;
      this.pending = null; this.closePeer(u); this.stopPoll();
      this.cb.onStatus?.('時間内につながりませんでした。もう一度ためしてね（通信環境によってはつながらないことがあります）');
      return;
    }
    if (!this.hosting && !this.pending) { this.stopPoll(); return; }
    let r;
    try { r = await rtcPoll(this.cb.getToken()); } catch (e) { return; }
    for (const m of r?.items || []) {
      if (m.kind === 'offer' && this.hosting) this.acceptOffer(m.from, m.name, m.payload);
      else if (m.kind === 'answer' && this.pending && this.pending.username === m.from) {
        try { await this.pending.pc.setRemoteDescription(JSON.parse(m.payload)); } catch (e) { /* 失敗は時間切れで扱う */ }
        const p = this.peers.get(m.from); if (p) p.name = m.name;
      } else if (m.kind === 'bye') this.closePeer(m.from);
    }
  }

  // ホスト: 参加の申し込み（offer）に答える
  async acceptOffer(username, name, payload) {
    if (this.peers.size >= MAX_GUESTS) { rtcSend(this.cb.getToken(), username, 'bye', 'full').catch(() => {}); return; }
    this.closePeer(username);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ondatachannel = e => this.setupChannel(username, name, pc, e.channel);
    this.peers.set(username, { pc, dc: null, name });
    try {
      await pc.setRemoteDescription(JSON.parse(payload));
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      await rtcSend(this.cb.getToken(), username, 'answer', JSON.stringify(pc.localDescription));
    } catch (e) { this.closePeer(username); }
  }

  setupChannel(username, name, pc, dc) {
    const p = this.peers.get(username) || { pc, dc, name };
    p.pc = pc; p.dc = dc; if (name) p.name = name;
    this.peers.set(username, p);
    dc.onopen = () => {
      if (this.pending && this.pending.username === username) {
        this.pending = null; this.hostName = username; this.stopPoll();
      }
      this.cb.onPeer?.(username, p.name);
    };
    dc.onmessage = e => {
      let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (!msg || typeof msg !== 'object') return;
      // ホストは、ほかの参加者にも中継する（なりすまし防止で送り主を付け直す）
      if (this.hosting) {
        msg.u = username; msg.n = p.name;
        const s = JSON.stringify(msg);
        for (const [u, q] of this.peers) if (u !== username && q.dc?.readyState === 'open') q.dc.send(s);
      }
      this.cb.onMessage?.(msg);
    };
    dc.onclose = () => this.closePeer(username);
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.closePeer(username); };
  }

  closePeer(username) {
    const p = this.peers.get(username);
    if (!p) return;
    this.peers.delete(username);
    try { p.dc?.close(); } catch (e) { /* もう閉じている */ }
    try { p.pc?.close(); } catch (e) { /* もう閉じている */ }
    if (this.hostName === username) {
      this.hostName = null;
      this.cb.onStatus?.('ホストとの接続が切れました');
      this.cb.onHostLost?.(username);   // 自分から抜けたときは呼ばれない（leave で先に hostName を消すため）
    }
    this.cb.onLeave?.(username, p.name);
  }

  // 全員に送る（自分の様子・できごと）
  send(obj) {
    const s = JSON.stringify(obj);
    for (const p of this.peers.values()) if (p.dc?.readyState === 'open') p.dc.send(s);
  }

  // 部屋を閉じる・抜ける
  leave() {
    const t = this.cb.getToken();
    this.hostName = null;   // 自分から抜けるときは「切れました」と出さない
    for (const u of [...this.peers.keys()]) { rtcSend(t, u, 'bye', '').catch(() => {}); this.closePeer(u); }
    if (this.pending) { this.closePeer(this.pending.username); this.pending = null; }
    this.hosting = false; this.hostName = null; this.stopPoll();
    this.cb.onStatus?.('');
  }
}
