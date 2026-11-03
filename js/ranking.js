// オンラインランキング（Supabase）
// テーブル: public.llb_scores ／ 送信: RPC public.llb_submit_score（記録はサーバー側で最大値だけ残す。token が一致しないと更新されない）

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ランキングのジャンル（col はテーブルの列名）
export const GENRES = [
  { col: 'best_distance',  icon: '🏏', name: '最高飛距離',   unit: 'm' },
  { col: 'income_per_sec', icon: '💰', name: '毎秒の稼ぎ',   unit: '/秒', money: true },
  { col: 'total_earned',   icon: '💵', name: '累計の稼ぎ',   money: true },
  { col: 'dex_count',      icon: '📖', name: 'インデックス', unit: '体' },
  { col: 'mut_count',      icon: '🧬', name: '変異コレクション', unit: '種' },
  { col: 'rebirths',       icon: '🔄', name: 'リボーン',     unit: '回' },
  { col: 'collected',      icon: '🎁', name: '持ち帰った数', unit: '体' },
];

// スコア送信（score: { name, bestDistance, totalEarned, collected, bestRarity, income, rebirths, dexCount, mutCount }）
export async function submitScore(clientId, token, score) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/llb_submit_score`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_client_id: clientId,
      p_token: token,
      p_name: score.name || '名無し',
      p_best_distance: Math.round(score.bestDistance),
      p_total_earned: score.totalEarned,
      p_collected: score.collected,
      p_best_rarity: score.bestRarity,
      p_income_per_sec: score.income,
      p_rebirths: score.rebirths,
      p_dex_count: score.dexCount,
      p_mut_count: score.mutCount,
    }),
  });
  if (!res.ok) throw new Error(`ranking submit failed: ${res.status}`);
  return res.json();
}

const COLS = 'client_id,name,best_distance,total_earned,collected,best_rarity,income_per_sec,rebirths,dex_count,mut_count';

// 上位の取得
export async function fetchRanking(col = 'best_distance', limit = 50) {
  const q = `select=${COLS}&${col}=gt.0&order=${col}.desc,updated_at.asc&limit=${limit}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/llb_scores?${q}`, { headers });
  if (!res.ok) throw new Error(`ranking fetch failed: ${res.status}`);
  return res.json();
}

// 自分の記録と順位（自分より大きい人の数 + 1）
export async function fetchMine(col, clientId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/llb_scores?select=${COLS}&client_id=eq.${clientId}`, { headers });
  if (!res.ok) throw new Error(`ranking fetch failed: ${res.status}`);
  const me = (await res.json())[0];
  if (!me || !(me[col] > 0)) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/llb_scores?select=client_id&${col}=gt.${me[col]}`, {
    method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' },
  });
  const total = Number((r.headers.get('content-range') || '').split('/')[1]);
  return { ...me, rank: Number.isFinite(total) ? total + 1 : null };
}
