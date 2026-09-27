import { db } from "./db.js";
import { fetchUniverse } from "./market/cryptoUniverse.js";
import { relationshipMatrix } from "./discovery/relationshipMatrix.js";
import type { PricePoint } from "./discovery/anomalyScanner.js";
import { freezeable, type HypothesisProposal } from "./discovery/hypothesisFactory.js";

async function main(){
 const ticks=await fetchUniverse();
 if(ticks.length<4) throw new Error(`Universe fetch too small: ${ticks.length}`);
 const stamp=ticks[0].observedAt;
 const {error:ie}=await db.from("crypto_universe_snapshots").insert(ticks.map(t=>({observed_at:stamp,asset:t.asset,market:t.market,price_usd:t.priceUsd,source:t.source,sensor_version:"U1"})));
 if(ie) throw ie;

 const since=new Date(Date.now()-72*3600_000).toISOString();
 const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,asset,price_usd").gte("observed_at",since).order("observed_at",{ascending:true});
 if(error) throw error;
 const series:Record<string,PricePoint[]>={};
 for(const r of data??[]){(series[r.asset]??=[]).push({ts:r.observed_at,price:Number(r.price_usd)})}
 const anomalies=relationshipMatrix(series);
 let proposed=0;
 for(const a of anomalies.slice(0,10)){
  const h:HypothesisProposal={generator:"relationship_matrix",generatorVersion:"U1",market:"crypto",assetA:a.leader,assetB:a.follower,observationWindow:"1h",
   claim:`After an abnormal ${a.direction.toLowerCase()} move in ${a.leader} while ${a.follower} materially underreacts, ${a.follower} may subsequently reprice in the leader direction.`,
   mechanism:"temporary cross-asset repricing lag",
   triggerDefinition:{leaderMoveAbsGte:0.005,leaderZ:a.leaderZ,responseRatioLte:0.75,direction:a.direction},
   predictedEffect:{asset:a.follower,direction:a.direction==="UP"?"LONG":"SHORT",horizonsHours:[1,4,8,12,24]},
   falsificationCriteria:{holdoutRequired:true,forwardRequired:true,netExpectancyMustBePositive:true},
   requiredData:[`${a.leader} hourly spot`,`${a.follower} hourly spot`,"transaction cost model"]};
  const f=freezeable(h);if(!f.valid||!f.key)continue;
  const {error:he}=await db.from("hypotheses").upsert({
   hypothesis_key:f.key,generator:h.generator,generator_version:h.generatorVersion,market:h.market,asset_a:h.assetA,asset_b:h.assetB,
   observation_window:h.observationWindow,claim:h.claim,mechanism:h.mechanism,trigger_definition:h.triggerDefinition,predicted_effect:h.predictedEffect,
   falsification_criteria:h.falsificationCriteria,required_data:h.requiredData,status:"PROPOSED",discovery_evidence:{anomaly:a},test_version:"V1.0"
  },{onConflict:"hypothesis_key",ignoreDuplicates:true});
  if(he) throw he; proposed++;
 }
 console.log(JSON.stringify({ok:true,build:"013",observedAt:stamp,assets:ticks.map(t=>t.asset),anomalies:anomalies.length,hypothesesConsidered:proposed,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
