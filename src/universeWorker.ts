import { db } from "./db.js";
import type { PricePoint } from "./discovery/anomalyScanner.js";
import { scanDiscoveryLibrary } from "./discovery/discoveryLibrary.js";
import { freezeable, type HypothesisProposal } from "./discovery/hypothesisFactory.js";

function proposal(hit:any):HypothesisProposal|null{
 const assetA=hit.leader??hit.asset,assetB=hit.follower;
 if(!assetA)return null;
 const direction=hit.direction??"STATE_CHANGE";
 const predictedAsset=assetB??assetA;
 const predictedDirection=direction==="DOWN"?"SHORT":"LONG";
 return {
  generator:"discovery_library",generatorVersion:"D1",market:"crypto",assetA,assetB,
  observationWindow:`${hit.windowHours}h`,
  claim:`${hit.family} detected for ${assetA}${assetB?` -> ${assetB}`:""}; test whether the observed state predicts a repeatable after-cost move in ${predictedAsset}.`,
  mechanism:`Machine-discovered ${hit.family.toLowerCase().replaceAll("_"," ")} anomaly; mechanism unproven and subject to falsification.`,
  triggerDefinition:{family:hit.family,direction,windowHours:hit.windowHours,features:hit.features},
  predictedEffect:{asset:predictedAsset,direction:predictedDirection,horizonsHours:[1,4,8,12,24]},
  falsificationCriteria:{holdoutRequired:true,forwardRequired:true,netExpectancyMustBePositive:true,mechanismNotAssumed:true},
  requiredData:[`${assetA} synchronized spot`,...(assetB?[`${assetB} synchronized spot`]:[]),"transaction cost model"]
 };
}
async function main(){
 const since=new Date(Date.now()-72*3600_000).toISOString();
 const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,asset,price_usd").gte("observed_at",since).order("observed_at",{ascending:true});if(error)throw error;
 const series:Record<string,PricePoint[]>={};for(const r of data??[])(series[r.asset]??=[]).push({ts:r.observed_at,price:Number(r.price_usd)});
 const hits=scanDiscoveryLibrary(series),top=hits.slice(0,25);let proposed=0;
 for(const hit of top){const h=proposal(hit);if(!h)continue;const frozen=freezeable(h);if(!frozen.valid||!frozen.key)continue;
  const {error:he}=await db.from("hypotheses").upsert({hypothesis_key:frozen.key,generator:h.generator,generator_version:h.generatorVersion,market:h.market,asset_a:h.assetA,asset_b:h.assetB??null,observation_window:h.observationWindow,claim:h.claim,mechanism:h.mechanism,trigger_definition:h.triggerDefinition,predicted_effect:h.predictedEffect,falsification_criteria:h.falsificationCriteria,required_data:h.requiredData,status:"PROPOSED",discovery_evidence:{hit},test_version:"D1.0"},{onConflict:"hypothesis_key",ignoreDuplicates:true});if(he)throw he;proposed++;
 }
 console.log(JSON.stringify({ok:true,build:"027",observations:(data??[]).length,assets:Object.keys(series),hits:hits.length,topHitsConsidered:top.length,hypothesesConsidered:proposed,families:[...new Set(hits.map(h=>h.family))],authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
