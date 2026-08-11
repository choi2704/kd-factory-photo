const rawCfg = window.KD_CONFIG || {};
const cfg = {
  SUPABASE_URL: String(rawCfg.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
  SUPABASE_ANON_KEY: String(rawCfg.SUPABASE_ANON_KEY || "").trim()
};

const configured =
  /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(cfg.SUPABASE_URL) &&
  cfg.SUPABASE_ANON_KEY.length > 20 &&
  !cfg.SUPABASE_URL.includes("YOUR_PROJECT") &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY");

let db = null;
if (configured) {
  db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function connectionHelp(error) {
  const msg = error?.message || String(error || "");
  if (msg.includes("Invalid path specified in request URL")) {
    return "Supabase 연결 경로 오류입니다. 새 파일이 반영되지 않았을 수 있습니다. 강력 새로고침(Ctrl+F5) 후 다시 확인하세요.";
  }
  return msg;
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}
function fmtDate(v){
  if(!v) return "";
  const d = new Date(v);
  return d.toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
