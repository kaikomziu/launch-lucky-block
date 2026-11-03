// グローバルチャット（Supabase の llb_chat。書き込みは RPC llb_chat_post だけ）
// 通信を節約するため、新しい発言の読み込みはチャット画面を開いている間だけ行う

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const COLS = 'id,name,body,verified,is_admin,created_at';

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return res.json();
}

// afterId より新しい発言（古い順）。afterId が 0 なら最新の limit 件
export async function fetchChat(afterId = 0, limit = 50) {
  const q = afterId
    ? `select=${COLS}&id=gt.${afterId}&order=id.asc&limit=${limit}`
    : `select=${COLS}&order=id.desc&limit=${limit}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/llb_chat?${q}`, { headers });
  if (!res.ok) throw new Error(`chat fetch failed: ${res.status}`);
  const list = await res.json();
  return afterId ? list : list.reverse();
}

export const postChat = (clientId, name, body, kaToken) => rpc('llb_chat_post', { p_client_id: clientId, p_name: name, p_body: body, p_ka_token: kaToken || null });
export const deleteChat = (kaToken, id) => rpc('llb_chat_delete', { p_ka_token: kaToken, p_id: id });
// 同時接続の知らせ（人数と最新の発言IDが返る）
export const ping2 = clientId => rpc('llb_ping2', { p_client_id: clientId });
