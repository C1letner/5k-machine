import { db } from "./db.js";
const ASSETS=["BTC","ETH","XRP","SOL","ADA","DOGE","AVAX","LINK"] as const;
const HOUR=3600_000, DAYS=180, CHUNK_HOURS=240;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function candles(asset:string,start:Date,end:Date){
 const u=new URL(`https://api.exchange.coinbase.com/products/${asset}-USD/candles`);
 u.searchParams.set("granularity","3600");u.searchParams.set("start",start.toISOString());u.searchParams.set("end",end.toISOString());
 const r=await fetch(u,{headers:{"User-Agent":"5k-machine-backfill/1.0"}});if(!r.ok)throw new Error(`${asset} candles HTTP ${r.status}: ${await r.text()}`);
 return await r.json() as number[][];
}
async function main(){
 const hardBoundary=new Date();const start=new Date(hardBoundary.getTime()-DAYS*24*HOUR);let inserted=0;
 for(const asset of ASSETS){for(let t=start.getTime();t<hardBoundary.getTime();t+=CHUNK_HOURS*HOUR){
  const a=new Date(t),b=new Date(Math.min(t+CHUNK_HOURS*HOUR,hardBoundary.getTime()));const rows=await candles(asset,a,b);
  const payload=rows.map(x=>({observed_at:new Date(x[0]*1000).toISOString(),asset,market:`${asset}-USD`,price_usd:Number(x[4]),source:"coinbase_exchange_candles",sensor_version:"HIST-028"}));
  if(payload.length){const {error}=await db.from("crypto_universe_snapshots").upsert(payload,{onConflict:"observed_at,asset",ignoreDuplicates:true});if(error)throw error;inserted+=payload.length}
  await sleep(175);
 }}
 console.log(JSON.stringify({ok:true,build:"028",assets:ASSETS,daysRequested:DAYS,rowsConsidered:inserted,forwardBoundary:hardBoundary.toISOString(),authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
