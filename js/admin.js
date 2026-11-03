// かるわかGAMES 管理者のイベント（お知らせ・キャラ配布・変異イベント）
// テーブル: public.llb_admin_events（誰でも読める） ／ 書き込みは RPC（サーバーで管理者か確認し、値も検査する）

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return res.json();
}

// いま有効なイベント（終わっていないもの）
export async function fetchEvents() {
  const now = new Date().toISOString();
  const q = `select=id,kind,payload,starts_at,ends_at,created_at&ends_at=gt.${now}&order=created_at.desc&limit=30`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/llb_admin_events?${q}`, { headers });
  if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
  return res.json();
}

export const adminCheck = kaToken => rpc('llb_admin_check', { p_ka_token: kaToken });
export const adminPost = (kaToken, kind, payload, minutes) => rpc('llb_admin_post', { p_ka_token: kaToken, p_kind: kind, p_payload: payload, p_minutes: minutes });
export const adminEnd = (kaToken, id) => rpc('llb_admin_end', { p_ka_token: kaToken, p_id: id });
