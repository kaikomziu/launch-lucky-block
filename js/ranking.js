// オンラインランキング（準備のみ。まだゲームからは読み込んでいない）
// テーブル: public.llb_scores ／ 送信: RPC public.llb_submit_score
// 使うときは main.js で import し、save.clientId / save.token / save.name / save.stats を渡す。

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// スコア送信（数値はサーバー側で最大値のみ保持。token が一致しないと更新されない）
export async function submitScore(save) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/llb_submit_score`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_client_id: save.clientId,
      p_token: save.token,
      p_name: save.name || '名無し',
      p_best_distance: save.stats.bestDistance,
      p_total_earned: save.stats.totalEarned,
      p_collected: save.stats.collected,
      p_best_rarity: save.stats.bestRarity,
    }),
  });
  if (!res.ok) throw new Error(`ranking submit failed: ${res.status}`);
  return res.json();
}

// ランキング取得（order: best_distance / total_earned / collected）
export async function fetchRanking(order = 'best_distance', limit = 50) {
  const q = `select=client_id,name,best_distance,total_earned,collected,best_rarity,updated_at&order=${order}.desc&limit=${limit}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/llb_scores?${q}`, { headers });
  if (!res.ok) throw new Error(`ranking fetch failed: ${res.status}`);
  return res.json();
}
