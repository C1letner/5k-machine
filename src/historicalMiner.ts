import {db} from "./db.js";import type{PricePoint}from "./discovery/anomalyScanner.js";import{scanDiscoveryLibrary}from "./discovery/discoveryLibrary.js";
const VERSION="WF032",LOOKBACK=30*24,BATCH=500;
async function main(){const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,asset,price_usd").eq("sensor_version","HIST-028").order("observed_at",{ascending:true});if(error)throw error;
 const assets=[...new Set((data??[]).map(x=>x.asset))].sort(),by:Record<string,PricePoint[]>={};for(const a of assets)by[a]=[];for(const r of data??[])by[r.asset].push({ts:r.observed_at,price:Number(r.price_usd)});
 const times=by[assets[0]]?.map(x=>x.ts)??[];let events:any[]=[],written=0,scanned=0;
 async function flush(){if(!events.length)return;const {error:e}=await db.from("historical_anomaly_events").insert(events);if(e&&e.code!=="23505")throw e;written+=events.length;events=[]}
 for(let i=24;i<times.length;i++){const series:Record<string,PricePoint[]>={};for(const a of assets)series[a]=by[a].slice(Math.max(0,i-LOOKBACK+1),i+1);const hits=scanDiscoveryLibrary(series);scanned++;
  for(const h of hits){const assetA=h.leader??h.asset;if(!assetA)continue;events.push({campaign_version:VERSION,observed_at:times[i],family:h.family,asset_a:assetA,asset_b:h.follower??"",direction:h.direction??null,window_hours:h.windowHours,score:h.score,features:h.features});if(events.length>=BATCH)await flush()}
 }await flush();
 console.log(JSON.stringify({ok:true,build:"032",campaignVersion:VERSION,historicalHoursScanned:scanned,assets,eventsConsidered:written,authorizedToTrade:false},null,2))}
main().catch(e=>{console.error(e);process.exitCode=1});
