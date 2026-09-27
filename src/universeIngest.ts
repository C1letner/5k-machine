import { fetchUniverse } from "./market/cryptoUniverse.js";
import { db } from "./db.js";
async function main(){
 const ticks=await fetchUniverse();if(ticks.length<4)throw new Error("universe fetch insufficient");
 const stamp=ticks[0].observedAt;
 const {error}=await db.from("crypto_universe_snapshots").insert(ticks.map(t=>({observed_at:stamp,asset:t.asset,market:t.market,price_usd:t.priceUsd,source:t.source,sensor_version:"U1"})));if(error)throw error;
 console.log(JSON.stringify({ok:true,build:"020",stage:"universe_ingest",assets:ticks.length,observedAt:stamp,authorizedToTrade:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
