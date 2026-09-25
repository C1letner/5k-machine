import http from "node:http";
import { db } from "../src/db.js";
const port=Number(process.env.PORT||3000);
const esc=(v:any)=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
async function page(){
 const [{data:o,error:oe},{data:a,error:ae},{data:q,error:qe}]=await Promise.all([
  db.from("command_center_overview").select("*").single(),
  db.from("command_center_activity").select("*").order("occurred_at",{ascending:false}).limit(40),
  db.from("qualification").select("candidate_id,total_score,classification,created_at").order("created_at",{ascending:false}).limit(10)
 ]);
 if(oe||ae||qe) throw oe||ae||qe;
 const cards=[["Shadow Ledger",o.shadow_ledger_value_usd==null?"—":"$"+Number(o.shadow_ledger_value_usd).toLocaleString()],["BTC","$"+Number(o.btc_usd||0).toLocaleString()],["XRP","$"+Number(o.xrp_usd||0).toLocaleString()],["System",o.last_system_status],["Candidates",o.total_candidates],["Qualified",o.qualified_candidates]];
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>5K Machine</title><meta http-equiv="refresh" content="60"><style>
 body{font-family:system-ui;background:#07090c;color:#e8edf2;margin:0;padding:28px;max-width:1280px;margin:auto}h1{margin:0;letter-spacing:.12em}.sub{color:#8e9aa6;margin:6px 0 24px}.hero{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px}.stamp{text-align:right;color:#7f8b96;font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card,.panel{background:linear-gradient(180deg,#15191e,#11151a);border:1px solid #252c34;border-radius:14px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.22)}.label{color:#8e9aa6;font-size:12px;text-transform:uppercase}.value{font-size:25px;font-weight:700;margin-top:5px}.ok{color:#66d19e}.warn{color:#f0c674}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:10px 8px;border-bottom:1px solid #252c34;text-align:left;vertical-align:top}th{color:#8e9aa6}.panel{margin-top:16px;overflow:auto}code{white-space:pre-wrap;color:#aab6c2}@media(max-width:600px){body{padding:14px}td:nth-child(4),th:nth-child(4){display:none}}
 </style></head><body><div class="hero"><div><h1>5K MACHINE</h1><div class="sub">AUTONOMOUS RESEARCH COMMAND · trading authority: <b class="warn">OFF</b></div></div><div class="stamp">BUILD 007 · AUTO REFRESH 60s<br>LAST SYSTEM RUN: ${esc(o.last_system_run_at?new Date(o.last_system_run_at).toLocaleString():"—")}</div></div>
 <div class="grid">${cards.map(([l,v])=>`<div class="card"><div class="label">${esc(l)}</div><div class="value ${l==="System"&&v==="SUCCESS"?"ok":""}">${esc(v)}</div></div>`).join("")}</div>
 <div class="panel"><h2>INTELLIGENCE LOG</h2><div class="sub">What the team has observed, tested, or decided most recently.</div><table><tr><th>Time</th><th>Actor</th><th>Event</th><th>Details</th></tr>${(a||[]).map(x=>`<tr><td>${esc(new Date(x.occurred_at).toLocaleString())}</td><td>${esc(x.actor)}</td><td>${esc(x.event_type)} ${esc(x.asset||"")}</td><td><code>${esc(JSON.stringify(x.details))}</code></td></tr>`).join("")}</table></div>
 <div class="panel"><h2>INVESTMENT COMMITTEE</h2><table><tr><th>Candidate</th><th>Score</th><th>Classification</th></tr>${(q||[]).map(x=>`<tr><td>${esc(x.candidate_id)}</td><td>${esc(x.total_score)}</td><td>${esc(x.classification)}</td></tr>`).join("")}</table></div>
 </body></html>`;
}
http.createServer(async(_req,res)=>{
  try{
    const html=await page();
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
    res.end(html);
  }catch(e:any){
    if(!res.headersSent) res.writeHead(500,{"content-type":"text/plain; charset=utf-8"});
    if(!res.writableEnded) res.end(String(e?.message||e));
  }
}).listen(port,()=>console.log(`5K Command Center listening on ${port}`));
