import http from "node:http";
import { db } from "../src/db.js";
const port=Number(process.env.PORT||3000);
const esc=(v:any)=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
const money=(v:any,d=2)=>v==null?"—":"$"+Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(v:any)=>v==null?"—":(Number(v)>=0?"+":"")+Number(v).toFixed(2)+"%";
function describe(x:any){
 const d=x.details||{};
 if(x.event_type==="SPOT_PRICE") return `${x.asset} observed at ${money(x.price_usd,x.asset==="XRP"?4:2)}.`;
 if(x.event_type==="MARKET_FEATURES"){const f=d.features||{};return `BTC memory updated. 1h ${pct(f.change1hPct)}, 4h ${pct(f.change4hPct)}, 24h ${pct(f.change24hPct)}. ${d.candidateReady?"Candidate trigger detected.":"No candidate trigger."}`;}
 if(x.event_type==="XRP004_SIGNAL") return `XRP-004 SIGNAL: BTC impulse met the frozen underreaction rule. Shadow observation only.`;
 if(x.actor==="xrp_sensor_v1") return `XRP-004 checked the BTC/XRP relationship. No signal.`;
 if(String(x.event_type).startsWith("SYSTEM_")) return `Autonomous research loop ${String(x.event_type).replace("SYSTEM_","").toLowerCase()} (Build ${d.build||"—"}).`;
 if(String(x.event_type).startsWith("CANDIDATE_")) return `${x.asset||"Market"} candidate ${String(x.event_type).replace("CANDIDATE_","").toLowerCase()}.`;
 if(String(x.event_type).startsWith("PROSECUTION_")) return `Prosecutor recommendation: ${String(x.event_type).replace("PROSECUTION_","")}.`;
 if(String(x.event_type).startsWith("QUALIFICATION_")) return `Qualification: ${String(x.event_type).replace("QUALIFICATION_","")} · score ${d.score??"—"}.`;
 return String(x.event_type).replaceAll("_"," ");
}
async function page(){
 const [{data:o,error:oe},{data:a,error:ae},{data:q,error:qe},{data:btc,error:be},{data:xrp,error:xe},{data:runs,error:re},{data:outcomes,error:oute}]=await Promise.all([
  db.from("command_center_overview").select("*").single(),
  db.from("command_center_activity").select("*").order("occurred_at",{ascending:false}).limit(60),
  db.from("qualification").select("candidate_id,total_score,classification,created_at").order("created_at",{ascending:false}).limit(10),
  db.from("market_observations").select("observed_at,price_usd").eq("asset","BTC").eq("agent","btc_sensor_v1").order("observed_at",{ascending:false}).limit(25),
  db.from("market_observations").select("observed_at,price_usd,observation_type,payload").eq("asset","XRP").eq("agent","xrp_sensor_v1").order("observed_at",{ascending:false}).limit(25),
  db.from("system_runs").select("started_at,status,build,error_message").order("started_at",{ascending:false}).limit(24),
  db.from("candidate_outcomes").select("horizon,return_pct,measured_at").order("measured_at",{ascending:false}).limit(50)
 ]);
 const err=oe||ae||qe||be||xe||re||oute;if(err)throw err;
 const b=(btc||[]).slice().reverse(), x=(xrp||[]).slice().reverse();
 const bFirst=b[0]?.price_usd,bLast=b.at(-1)?.price_usd,xFirst=x[0]?.price_usd,xLast=x.at(-1)?.price_usd;
 const btc24=bFirst&&bLast?(Number(bLast)/Number(bFirst)-1)*100:null,xrp24=xFirst&&xLast?(Number(xLast)/Number(xFirst)-1)*100:null;
 const successes=(runs||[]).filter(z=>z.status==="SUCCESS").length, failures=(runs||[]).filter(z=>z.status==="FAILURE").length;
 const signals=(xrp||[]).filter(z=>z.observation_type==="XRP004_SIGNAL").length;
 const latest=(a||[]).slice(0,12);
 const brief=latest.length?latest.map(describe).filter((v,i,arr)=>arr.indexOf(v)===i).slice(0,4):["No new intelligence yet."];
 const cards=[["SHADOW LEDGER",money(o.shadow_ledger_value_usd,0)],["BTC",money(o.btc_usd,2)],["BTC WINDOW",pct(btc24)],["XRP",money(o.xrp_usd,4)],["XRP WINDOW",pct(xrp24)],["SYSTEM",o.last_system_status],["CANDIDATES",o.total_candidates],["QUALIFIED",o.qualified_candidates]];
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60"><title>5K Machine</title><style>
 *{box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#07090c;color:#e8edf2;margin:0;padding:28px;max-width:1320px;margin:auto}h1{margin:0;letter-spacing:.14em;font-size:26px}h2{font-size:15px;letter-spacing:.08em;margin:0 0 14px}.sub{color:#84909c;font-size:12px}.hero{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px}.stamp{text-align:right;color:#65717d;font-size:11px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px}.card,.panel{background:linear-gradient(180deg,#15191e,#101419);border:1px solid #252c34;border-radius:12px;padding:15px;box-shadow:0 12px 40px rgba(0,0,0,.2)}.label{color:#73808d;font-size:10px;letter-spacing:.08em}.value{font-size:22px;font-weight:750;margin-top:5px}.ok{color:#55d89a}.warn{color:#e7bd65}.two{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-top:12px}.panel{margin-top:12px;overflow:auto}.brief{font-size:15px;line-height:1.55;padding:10px 0;border-bottom:1px solid #242b32}.brief:last-child{border:0}.metric{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #242b32}.metric:last-child{border:0}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:9px 7px;border-bottom:1px solid #252c34;text-align:left;vertical-align:top}th{color:#74818d;font-size:10px;letter-spacing:.06em}.pill{padding:3px 7px;border-radius:999px;background:#20262d;color:#aab5bf;font-size:10px}.lock{color:#e7bd65;font-weight:700}.muted{color:#7d8994}@media(max-width:760px){body{padding:14px}.two{grid-template-columns:1fr}.hero{display:block}.stamp{text-align:left;margin-top:8px}td:nth-child(4),th:nth-child(4){display:none}}
 </style></head><body>
 <div class="hero"><div><h1>5K MACHINE</h1><div class="sub">AUTONOMOUS RESEARCH COMMAND · <span class="lock">TRADING AUTHORITY LOCKED OFF</span></div></div><div class="stamp">BUILD 007 · AUTO REFRESH 60s<br>LAST LOOP ${esc(o.last_system_run_at?new Date(o.last_system_run_at).toLocaleString():"—")}</div></div>
 <div class="grid">${cards.map(([l,v])=>`<div class="card"><div class="label">${esc(l)}</div><div class="value ${l==="SYSTEM"&&v==="SUCCESS"?"ok":""}">${esc(v)}</div></div>`).join("")}</div>
 <div class="two"><div class="panel"><h2>EXECUTIVE INTELLIGENCE BRIEF</h2>${brief.map(v=>`<div class="brief">${esc(v)}</div>`).join("")}</div>
 <div class="panel"><h2>MISSION STATUS</h2><div class="metric"><span>Research loops</span><b>${successes} successful / ${failures} failed</b></div><div class="metric"><span>XRP-004 forward signals</span><b>${signals}</b></div><div class="metric"><span>Scored outcomes</span><b>${(outcomes||[]).length}</b></div><div class="metric"><span>Capital authority</span><b class="lock">NONE</b></div></div></div>
 <div class="two"><div class="panel"><h2>AGENT TEAM</h2><div class="metric"><span>BTC Sensor</span><span class="pill">${b.length?"ONLINE":"WAITING"}</span></div><div class="metric"><span>Crypto Hunter</span><span class="pill">SCANNING</span></div><div class="metric"><span>XRP-004</span><span class="pill">${signals?"SIGNAL RECORDED":"MONITORING"}</span></div><div class="metric"><span>Prosecutor</span><span class="pill">${o.total_candidates?"ACTIVE":"STANDBY"}</span></div><div class="metric"><span>Qualification</span><span class="pill">${o.total_candidates?"ACTIVE":"STANDBY"}</span></div><div class="metric"><span>Scorekeeper</span><span class="pill">WATCHING</span></div></div>
 <div class="panel"><h2>OPPORTUNITY PIPELINE</h2><div class="metric"><span>Discovered candidates</span><b>${esc(o.total_candidates)}</b></div><div class="metric"><span>Qualified / high conviction</span><b>${esc(o.qualified_candidates)}</b></div><div class="metric"><span>XRP-004 experiment</span><b>FORWARD SHADOW</b></div><div class="metric"><span>Rule changes allowed?</span><b class="lock">FROZEN</b></div></div></div>
 <div class="panel"><h2>INTELLIGENCE LOG</h2><table><tr><th>TIME</th><th>ACTOR</th><th>EVENT</th><th>INTERPRETATION</th></tr>${(a||[]).slice(0,30).map(z=>`<tr><td>${esc(new Date(z.occurred_at).toLocaleString())}</td><td>${esc(z.actor)}</td><td>${esc(z.event_type)} ${esc(z.asset||"")}</td><td>${esc(describe(z))}</td></tr>`).join("")}</table></div>
 <div class="panel"><h2>INVESTMENT COMMITTEE</h2>${(q||[]).length?`<table><tr><th>CANDIDATE</th><th>SCORE</th><th>CLASSIFICATION</th></tr>${(q||[]).map(z=>`<tr><td>${esc(z.candidate_id)}</td><td>${esc(z.total_score)}</td><td>${esc(z.classification)}</td></tr>`).join("")}</table>`:`<div class="muted">No candidate has reached the committee yet. The Machine is correctly waiting rather than manufacturing an opportunity.</div>`}</div>
 </body></html>`;
}
http.createServer(async(_req,res)=>{try{const html=await page();res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html)}catch(e:any){if(!res.headersSent)res.writeHead(500,{"content-type":"text/plain; charset=utf-8"});if(!res.writableEnded)res.end(String(e?.message||e))}}).listen(port,()=>console.log(`5K Command Center listening on ${port}`));
