/**
 * XRP-001: Does BTC lead XRP?
 *
 * Pulls synchronized hourly spot candles from Binance.US public klines API.
 * Research only. No trading or portfolio writes.
 *
 * Method:
 * - hourly log/simple returns for BTCUSDT and XRPUSDT
 * - contemporaneous correlation
 * - lead/lag: corr(BTC return[t], XRP return[t+lag])
 * - event study after BTC +/- thresholds
 * - "laggard" filter: XRP's same-hour move is < 50% of BTC's absolute move
 * - chronological 70/30 discovery/validation split
 */
import fs from "node:fs/promises";

const BASE="https://api.binance.us/api/v3/klines";
const HOUR=3600_000;
const START=Date.UTC(2021,0,1);
const END=Date.now();

type Candle={t:number;close:number};
async function fetchSeries(symbol:string):Promise<Candle[]>{
  const out:Candle[]=[]; let start=START;
  while(start<END){
    const url=new URL(BASE); url.searchParams.set("symbol",symbol); url.searchParams.set("interval","1h");
    url.searchParams.set("startTime",String(start)); url.searchParams.set("limit","1000");
    const r=await fetch(url,{headers:{"User-Agent":"5k-machine-xrp001/0.1"}});
    if(!r.ok) throw new Error(`${symbol} HTTP ${r.status}: ${await r.text()}`);
    const rows=await r.json() as any[];
    if(!rows.length) break;
    for(const k of rows) out.push({t:Number(k[0]),close:Number(k[4])});
    const next=Number(rows.at(-1)![0])+HOUR;
    if(next<=start) break; start=next;
    await new Promise(r=>setTimeout(r,80));
  }
  return out;
}
function ret(a:number,b:number){return (b/a)-1}
function corr(xs:number[],ys:number[]){
  const n=Math.min(xs.length,ys.length); if(n<3)return null;
  const mx=xs.slice(0,n).reduce((a,b)=>a+b,0)/n,my=ys.slice(0,n).reduce((a,b)=>a+b,0)/n;
  let num=0,dx=0,dy=0; for(let i=0;i<n;i++){const x=xs[i]-mx,y=ys[i]-my;num+=x*y;dx+=x*x;dy+=y*y}
  return dx&&dy?num/Math.sqrt(dx*dy):null;
}
function mean(x:number[]){return x.length?x.reduce((a,b)=>a+b,0)/x.length:null}
function median(x:number[]){if(!x.length)return null;const a=[...x].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function study(rows:any[],threshold:number,horizon:number,dir:1|-1,laggard=false){
  const vals:number[]=[];
  for(let i=1;i+horizon<rows.length;i++){
    const br=ret(rows[i-1].btc,rows[i].btc),xr=ret(rows[i-1].xrp,rows[i].xrp);
    if(dir===1&&br<threshold)continue;if(dir===-1&&br>-threshold)continue;
    if(laggard&&Math.abs(xr)>=Math.abs(br)*0.5)continue;
    vals.push(ret(rows[i].xrp,rows[i+horizon].xrp)*dir);
  }
  return {n:vals.length,meanPct:(mean(vals)??0)*100,medianPct:(median(vals)??0)*100,winRatePct:vals.length?vals.filter(v=>v>0).length/vals.length*100:null};
}
const btc=await fetchSeries("BTCUSDT"),xrp=await fetchSeries("XRPUSDT");
const bm=new Map(btc.map(x=>[x.t,x.close])),xm=new Map(xrp.map(x=>[x.t,x.close]));
const rows=[...bm.keys()].filter(t=>xm.has(t)).sort((a,b)=>a-b).map(t=>({t,btc:bm.get(t)!,xrp:xm.get(t)!}));
if(rows.length<1000) throw new Error(`Insufficient synchronized rows: ${rows.length}`);
const cut=Math.floor(rows.length*.7),sets={discovery:rows.slice(0,cut),validation:rows.slice(cut)};
function analyze(r:any[]){
 const br:number[]=[],xr:number[]=[];for(let i=1;i<r.length;i++){br.push(ret(r[i-1].btc,r[i].btc));xr.push(ret(r[i-1].xrp,r[i].xrp))}
 const lags=[0,1,2,4,8,12,24].map(lag=>{
   const a:number[]=[],b:number[]=[];for(let i=1;i+lag<r.length;i++){a.push(ret(r[i-1].btc,r[i].btc));b.push(ret(r[i+lag-1].xrp,r[i+lag].xrp))}
   return {lagHours:lag,correlation:corr(a,b)};
 });
 const events=[];for(const th of [.01,.02,.03])for(const h of [1,2,4,8,12,24])for(const dir of [1,-1] as const){
   events.push({btcThresholdPct:th*100,direction:dir===1?"UP":"DOWN",horizonHours:h,all:study(r,th,h,dir,false),xrpLaggard:study(r,th,h,dir,true)});
 }
 return {start:new Date(r[0].t).toISOString(),end:new Date(r.at(-1).t).toISOString(),hours:r.length,contemporaneousCorrelation:corr(br,xr),leadLag:lags,events};
}
const result={experiment:"XRP-001",generatedAt:new Date().toISOString(),source:"Binance.US public hourly spot klines",method:"70/30 chronological discovery-validation split",discovery:analyze(sets.discovery),validation:analyze(sets.validation)};
await fs.mkdir("research/results",{recursive:true});
await fs.writeFile("research/results/xrp001.json",JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
