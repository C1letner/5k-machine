import{db}from "./db.js";
const HOST="https://open-api-v4.coinglass.com";
const ASSETS=["BTC","ETH","XRP","SOL","ADA","DOGE","AVAX","LINK"];
const INTERVAL="4h";
const LIMIT="1000";
const KEY=process.env.COINGLASS_API_KEY;
async function cg(path:string,symbol:string){
 if(!KEY) throw new Error("COINGLASS_API_KEY missing");
 const u=new URL(HOST+path);u.searchParams.set("symbol",symbol);u.searchParams.set("interval",INTERVAL);u.searchParams.set("limit",LIMIT);
 const r=await fetch(u,{headers:{"CG-API-KEY":KEY,accept:"application/json"}});
 if(!r.ok)throw new Error(path+" HTTP "+r.status+": "+await r.text());
 const j:any=await r.json();if(String(j.code)!=="0")throw new Error(path+": "+JSON.stringify(j));return j.data??[];
}
const ts=(x:any)=>{const n=Number(x.time??x.timestamp);return new Date(n>1e12?n:n*1000).toISOString()};
async function main(){let oi=0,fr=0;
 for(const asset of ASSETS){
  const a=await cg("/api/futures/open-interest/aggregated-history",asset);
  for(const x of a){const v=Number(x.close);if(!Number.isFinite(v))continue;const{error}=await db.from("derivatives_observations").upsert({observed_at:ts(x),venue:"COINGLASS_AGGREGATED",asset,instrument:asset+"-AGGREGATED-FUTURES",open_interest:v,source:"coinglass_aggregated_oi",sensor_version:"DERIV039-CG"},{onConflict:"observed_at,venue,instrument,sensor_version",ignoreDuplicates:true});if(error)throw error;oi++}
  const b=await cg("/api/futures/funding-rate/oi-weight-history",asset);
  for(const x of b){const v=Number(x.close);if(!Number.isFinite(v))continue;const{error}=await db.from("derivatives_observations").upsert({observed_at:ts(x),venue:"COINGLASS_AGGREGATED",asset,instrument:asset+"-AGGREGATED-FUTURES",funding_rate:v,source:"coinglass_oi_weighted_funding",sensor_version:"DERIV039-CG"},{onConflict:"observed_at,venue,instrument,sensor_version",ignoreDuplicates:true});if(error)throw error;fr++}
 }
 console.log(JSON.stringify({ok:true,build:"039-coinglass",interval:INTERVAL,assets:ASSETS,openInterestPoints:oi,fundingPoints:fr,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});