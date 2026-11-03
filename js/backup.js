// セーブのバックアップ
// ・このブラウザ: localStorage "llb_backups" に最新6件
// ・クラウド: かるわかGAMESアカウントにログインしていれば Supabase の llb_backups に最新20件（RPCだけで読み書き）

const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ea_sHRg6wMwO9YkDTjgOog_stQT1mfq';
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const LOCAL_KEY = 'llb_backups';
const LOCAL_MAX = 6;

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return res.json();
}

// ---- このブラウザ ----
export function localBackups() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch (e) { return []; }
}
// 10分以内の最新があれば上書き、なければ追加
export function saveLocalBackup(save, summary) {
  const list = localBackups();
  const item = { t: Date.now(), summary, data: JSON.stringify(save) };
  if (list.length && Date.now() - list[0].t < 10 * 60 * 1000) list[0] = item; else list.unshift(item);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, LOCAL_MAX))); } catch (e) { /* 容量不足など */ }
}

// ---- クラウド ----
export const cloudBackupPut = (kaToken, save, summary) => rpc('llb_backup_put', { p_ka_token: kaToken, p_data: save, p_summary: summary });
export const cloudBackupList = kaToken => rpc('llb_backup_list', { p_ka_token: kaToken });
export const cloudBackupGet = (kaToken, id) => rpc('llb_backup_get', { p_ka_token: kaToken, p_id: id });
