
const cfg = window.KD_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_PROJECT")
  && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY");

let db = null;
if(configured){
  db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
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
