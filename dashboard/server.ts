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
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>5K Machine</title><style>
 body{font-family:system-ui;background:#0b0d10;color:#e8edf2;margin:0;padding:24px;max-width:1200px;margin:auto}h1{margin:0}.sub{color:#8e9aa6;margin:6px 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card,.panel{background:#15191e;border:1px solid #252c34;border-radius:14px;padding:16px}.label{color:#8e9aa6;font-size:12px;text-transform:uppercase}.value{font-size:25px;font-weight:700;margin-top:5px}.ok{color:#66d19e}.warn{color:#f0c674}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:10px 8px;border-bottom:1px solid #252c34;text-align:left;vertical-align:top}th{color:#8e9aa6}.panel{margin-top:16px;overflow:auto}code{white-space:pre-wrap;color:#aab6c2}@media(max-width:600px){body{padding:14px}td:nth-child(4),th:nth-child(4){display:none}}
 </style></head><body><h1>5K MACHINE</h1><div class="sub">Live research command center · trading authority: <b class="warn">OFF</b></div>
 <div class="grid">${cards.map(([l,v])=>`<div class="card"><div class="label">${esc(l)}</div><div class="value ${l==="System"&&v==="SUCCESS"?"ok":""}">${esc(v)}</div></div>`).join("")}</div>
 <div class="panel"><h2>Since you last checked</h2><table><tr><th>Time</th><th>Actor</th><th>Event</th><th>Details</th></tr>${(a||[]).map(x=>`<tr><td>${esc(new Date(x.occurred_at).toLocaleString())}</td><td>${esc(x.actor)}</td><td>${esc(x.event_type)} ${esc(x.asset||"")}</td><td><code>${esc(JSON.stringify(x.details))}</code></td></tr>`).join("")}</table></div>
 <div class="panel"><h2>Latest Qualification</h2><table><tr><th>Candidate</th><th>Score</th><th>Classification</th></tr>${(q||[]).map(x=>`<tr><td>${esc(x.candidate_id)}</td><td>${esc(x.total_score)}</td><td>${esc(x.classification)}</td></tr>`).join("")}</table></div>
 </body></html>`;
}
http.createServer(async(_req,res)=>{try{res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(await page())}catch(e:any){res.writeHead(500,{"content-type":"text/plain"});res.end(String(e?.message||e))}}).listen(port,()=>console.log(`5K Command Center listening on ${port}`));
