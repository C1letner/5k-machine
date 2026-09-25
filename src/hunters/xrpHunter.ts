import { db } from "../db.js";

const COINBASE_XRP = "https://api.coinbase.com/v2/prices/XRP-USD/spot";
export async function fetchXrpSpot() {
  const r=await fetch(COINBASE_XRP,{headers:{"User-Agent":"5k-machine/0.1"}});
  if(!r.ok) throw new Error(`Coinbase XRP HTTP ${r.status}`);
  const j=await r.json() as any;
  return {priceUsd:Number(j.data.amount),observedAt:new Date().toISOString()};
}
function avg(a:number[]){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
export async function evaluateXrp004(xrpPrice:number, observedAt:string) {
  const since=new Date(Date.parse(observedAt)-26*60*60*1000).toISOString();
  const {data,error}=await db.from("market_observations").select("observed_at,price_usd")
    .eq("asset","BTC").eq("observation_type","SPOT_PRICE").eq("agent","btc_sensor_v1")
    .gte("observed_at",since).order("observed_at",{ascending:true});
  if(error) throw error;
  const rows=data??[];
  const btcNow=rows.length?Number(rows.at(-1)!.price_usd):null;
  const btcPrev=rows.length>=2?Number(rows.at(-2)!.price_usd):null;
  const btcReturn=btcNow&&btcPrev?btcNow/btcPrev-1:null;
  const absHist:number[]=[];
  for(let i=1;i<rows.length-1;i++){const a=Number(rows[i-1].price_usd),b=Number(rows[i].price_usd);if(a>0&&b>0)absHist.push(Math.abs(b/a-1))}
  const baseline=avg(absHist.slice(-24));
  const {data:prevXrp,error:xe}=await db.from("market_observations").select("price_usd")
    .eq("asset","XRP").eq("observation_type","SPOT_PRICE").eq("agent","xrp_sensor_v1")
    .order("observed_at",{ascending:false}).limit(1);
  if(xe) throw xe;
  const priorXrp=prevXrp?.length?Number(prevXrp[0].price_usd):null;
  const xrpReturn=priorXrp?xrpPrice/priorXrp-1:null;
  const impulse=btcReturn!=null&&baseline?Math.abs(btcReturn)/baseline:null;
  const responseRatio=btcReturn&&xrpReturn!=null?Math.abs(xrpReturn)/Math.abs(btcReturn):null;
  const signal=Boolean(btcReturn!=null&&btcReturn>=0.01&&impulse!=null&&impulse>=2&&responseRatio!=null&&responseRatio<=0.5);
  const {data:obs,error:oe}=await db.from("market_observations").insert({
    observed_at:observedAt,agent:"xrp_sensor_v1",asset:"XRP",market:"XRP-USD",observation_type:signal?"XRP004_SIGNAL":"SPOT_PRICE",
    price_usd:xrpPrice,payload:{build:"XRP-004",btcReturnPct:btcReturn==null?null:btcReturn*100,btcImpulse:impulse,xrpReturnPct:xrpReturn==null?null:xrpReturn*100,xrpToBtcMoveRatio:responseRatio,signal,rule:"BTC +1% hourly; impulse >=2x; XRP response <=50%; shadow only; 12h horizon; assumed 50bps round trip"},source:COINBASE_XRP
  }).select("id").single();
  if(oe) throw oe;
  return {signal,observationId:obs.id,btcReturn,impulse,responseRatio};
}
