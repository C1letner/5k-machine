/**
 * XRP-002 — conditional BTC impulse / XRP underreaction study.
 * Research only. No portfolio or transaction writes.
 */
import fs from "node:fs/promises";
const BASE="https://api.binance.us/api/v3/klines", H=3600_000, START=Date.UTC(2021,0,1), END=Date.now();
type C={t:number;o:number;h:number;l:number;c:number;v:number};
async function fetchS(symbol:string):Promise<C[]>{
 const out:C[]=[];let s=START;
 while(s<END){const u=new URL(BASE);for(const [k,v] of Object.entries({symbol,interval:"1h",startTime:String(s),limit:"1000"}))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{"User-Agent":"5k-machine-xrp002/0.1"}});if(!r.ok)throw new Error(`${symbol} HTTP ${r.status}`);
  const a=await r.json() as any[];if(!a.length)break;for(const k of a)out.push({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]});
  const n=+a.at(-1)![0]+H;if(n<=s)break;s=n;await new Promise(r=>setTimeout(r,75));
 }return out;
}
const ret=(a:number,b:number)=>b/a-1;
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const med=(x:number[])=>{if(!x.length)return null;const a=[...x].sort((a,b)=>a-b),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
const btc=await fetchS("BTCUSDT"),xrp=await fetchS("XRPUSDT"),bm=new Map(btc.map(x=>[x.t,x])),xm=new Map(xrp.map(x=>[x.t,x]));
const rows=[...bm.keys()].filter(t=>xm.has(t)).sort((a,b)=>a-b).map(t=>({t,b:bm.get(t)!,x:xm.get(t)!}));
function analyze(r:any[]){
 const obs:any[]=[];
 for(let i=25;i<r.length-25;i++){
  const br=ret(r[i-1].b.c,r[i].b.c),xr=ret(r[i-1].x.c,r[i].x.c);
  const div=Math.abs(br)>1e-9?Math.abs(xr)/Math.abs(br):null;
  const prev24=[] as number[];for(let j=i-24;j<i;j++)prev24.push(Math.abs(ret(r[j-1].b.c,r[j].b.c)));
  const vol24=mean(prev24)??0, impulse=Math.abs(br)/(vol24||1e-9);
  const trend24=ret(r[i-24].b.c,r[i].b.c);
  for(const horizon of [1,2,4,8,12,24]){
   obs.push({br,xr,div,impulse,trend24,horizon,fwd:ret(r[i].x.c,r[i+horizon].x.c),dir:Math.sign(br)});
  }
 }
 const grids=[];for(const threshold of [.005,.01,.015,.02])for(const maxDiv of [.25,.5,.75])for(const minImpulse of [1.5,2,3])for(const h of [1,2,4,8,12,24]){
  const q=obs.filter(z=>z.horizon===h&&Math.abs(z.br)>=threshold&&z.div!==null&&z.div<=maxDiv&&z.impulse>=minImpulse);
  const aligned=q.map(z=>z.fwd*z.dir);
  if(q.length>=10)grids.push({btcMovePct:threshold*100,maxXrpToBtcMoveRatio:maxDiv,minImpulseVs24hAvg:minImpulse,horizonHours:h,n:q.length,meanDirectionalPct:(mean(aligned)??0)*100,medianDirectionalPct:(med(aligned)??0)*100,winRatePct:aligned.filter(x=>x>0).length/aligned.length*100});
 }
 grids.sort((a,b)=>b.meanDirectionalPct-a.meanDirectionalPct);
 return {start:new Date(r[0].t).toISOString(),end:new Date(r.at(-1).t).toISOString(),hours:r.length,topByMean:grids.slice(0,25),all:grididsSafe(grids)};
}
function grididsSafe(g:any[]){return g;}
const cut=Math.floor(rows.length*.7);
const discovery=analyze(rows.slice(0,cut)), validation=analyze(rows.slice(cut));
const result={experiment:"XRP-002",generatedAt:new Date().toISOString(),source:"Binance.US hourly BTCUSDT/XRPUSDT spot",design:"BTC impulse normalized by prior 24h absolute-return baseline; XRP underreaction ratio; 70/30 chronological split",discovery,validation};
await fs.mkdir("research/results",{recursive:true});await fs.writeFile("research/results/xrp002.json",JSON.stringify(result,null,2));console.log(JSON.stringify({experiment:result.experiment,discoveryTop:discovery.topByMean.slice(0,15),validationTop:validation.topByMean.slice(0,15)},null,2));
