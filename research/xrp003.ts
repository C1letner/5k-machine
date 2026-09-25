/**
 * XRP-003 — adversarial validation of BTC impulse -> XRP underreaction.
 * Separates up/down, tests delayed entries, costs, XRP/BTC catch-up, and adverse excursion.
 * Research only; no trading writes.
 */
import fs from "node:fs/promises";
const BASE="https://api.binance.us/api/v3/klines",H=3600_000,START=Date.UTC(2021,0,1),END=Date.now();
type C={t:number;o:number;h:number;l:number;c:number;v:number};
async function fetchS(symbol:string){const out:C[]=[];let s=START;while(s<END){const u=new URL(BASE);for(const[k,v]of Object.entries({symbol,interval:"1h",startTime:String(s),limit:"1000"}))u.searchParams.set(k,v);const r=await fetch(u,{headers:{"User-Agent":"5k-machine-xrp003/0.1"}});if(!r.ok)throw new Error(`${symbol} ${r.status}`);const a=await r.json() as any[];if(!a.length)break;for(const k of a)out.push({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]});const n=+a.at(-1)![0]+H;if(n<=s)break;s=n;await new Promise(r=>setTimeout(r,70));}return out}
const ret=(a:number,b:number)=>b/a-1,avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,med=(x:number[])=>{if(!x.length)return null;const a=[...x].sort((p,q)=>p-q),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
const btc=await fetchS("BTCUSDT"),xrp=await fetchS("XRPUSDT"),bm=new Map(btc.map(x=>[x.t,x])),xm=new Map(xrp.map(x=>[x.t,x]));
const rows=[...bm.keys()].filter(t=>xm.has(t)).sort((a,b)=>a-b).map(t=>({t,b:bm.get(t)!,x:xm.get(t)!}));
function analyze(r:any[]){
 const results:any[]=[];
 for(const direction of [1,-1] as const)for(const btcTh of [.005,.01])for(const ratio of [.25,.5])for(const impulseMin of [1.5,2])for(const delay of [0,1,2])for(const hold of [4,8,12]){
  const trades:any[]=[];
  for(let i=25;i+delay+hold<r.length;i++){
   const br=ret(r[i-1].b.c,r[i].b.c),xr=ret(r[i-1].x.c,r[i].x.c);if(Math.sign(br)!==direction||Math.abs(br)<btcTh)continue;
   const ratioNow=Math.abs(br)>0?Math.abs(xr)/Math.abs(br):99;if(ratioNow>ratio)continue;
   const hist=[];for(let j=i-24;j<i;j++)hist.push(Math.abs(ret(r[j-1].b.c,r[j].b.c)));const impulse=Math.abs(br)/(avg(hist)||1e-9);if(impulse<impulseMin)continue;
   const e=i+delay,exit=e+hold,entry=r[e].x.c,exitP=r[exit].x.c;
   const gross=ret(entry,exitP)*direction;
   const roundTripCost=.005; // 0.50% conservative all-in assumed round trip
   const net=gross-roundTripCost;
   let mae=0;for(let j=e+1;j<=exit;j++){const adverse=direction===1?ret(entry,r[j].x.l):ret(r[j].x.h,entry);mae=Math.min(mae,adverse)}
   const ratioEntry=r[e].x.c/r[e].b.c,ratioExit=r[exit].x.c/r[exit].b.c;
   const xrpBtcDirectional=(ret(ratioEntry,ratioExit))*direction;
   trades.push({gross,net,mae,xrpBtcDirectional});
  }
  if(trades.length>=10)results.push({direction:direction===1?"UP":"DOWN",btcMovePct:btcTh*100,maxXrpToBtcRatio:ratio,minImpulse:impulseMin,entryDelayHours:delay,holdHours:hold,n:trades.length,
   grossMeanPct:(avg(trades.map(t=>t.gross))??0)*100,netMeanPct:(avg(trades.map(t=>t.net))??0)*100,netMedianPct:(med(trades.map(t=>t.net))??0)*100,
   netWinRatePct:trades.filter(t=>t.net>0).length/trades.length*100,meanMaePct:(avg(trades.map(t=>t.mae))??0)*100,
   xrpBtcCatchupMeanPct:(avg(trades.map(t=>t.xrpBtcDirectional))??0)*100,xrpBtcCatchupWinRatePct:trades.filter(t=>t.xrpBtcDirectional>0).length/trades.length*100});
 }
 return results;
}
const cut=Math.floor(rows.length*.7),discovery=analyze(rows.slice(0,cut)),validation=analyze(rows.slice(cut));
function robust(d:any[],v:any[]){const key=(x:any)=>[x.direction,x.btcMovePct,x.maxXrpToBtcRatio,x.minImpulse,x.entryDelayHours,x.holdHours].join("|");const vm=new Map(v.map(x=>[key(x),x]));return d.map(x=>({discovery:x,validation:vm.get(key(x))})).filter(x=>x.validation&&x.discovery.netMeanPct>0&&x.validation.netMeanPct>0&&x.validation.xrpBtcCatchupMeanPct>0).sort((a,b)=>b.validation.netMeanPct-a.validation.netMeanPct)}
const survivors=robust(discovery,validation);
const result={experiment:"XRP-003",generatedAt:new Date().toISOString(),assumedRoundTripCostPct:.5,design:"Separate UP/DOWN; 0/1/2h delayed entries; 4/8/12h holds; 0.5% costs; MAE; XRP/BTC catch-up; 70/30 chronological split",survivors,discovery,validation};
await fs.mkdir("research/results",{recursive:true});await fs.writeFile("research/results/xrp003.json",JSON.stringify(result,null,2));console.log(JSON.stringify({experiment:result.experiment,survivorCount:survivors.length,topSurvivors:survivors.slice(0,20)},null,2));
