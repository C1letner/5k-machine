import { fetchBtcSpot } from "./market/coinbase.js";
import { recordBtcObservation, buildBtcMemory } from "./hunters/cryptoHunter.js";
import { getShadowCashUsd } from "./ledger.js";
import { processNewCandidates, scoreMatureCandidates } from "./pipeline.js";
import { fetchXrpSpot, evaluateXrp004 } from "./hunters/xrpHunter.js";
import { db } from "./db.js";

async function runOnce() {
  const {data:pending,error:queueError}=await db.from("research_queue").select("id,observation_id,attempts")
    .eq("status","PENDING").order("created_at",{ascending:true}).limit(1);
  if(queueError) throw queueError;
  const queueItem=pending?.[0]??null;
  if(queueItem){
    const {error:claimError}=await db.from("research_queue").update({
      status:"CLAIMED",claimed_at:new Date().toISOString(),attempts:Number(queueItem.attempts||0)+1
    }).eq("id",queueItem.id);
    if(claimError) throw claimError;
  }
  const {data:run,error:runError}=await db.from("system_runs").insert({
    component:"market_research_loop",status:"STARTED",build:"005",details:{authorizedToTrade:false}
  }).select("id").single();
  if(runError) throw runError;
  try {
    const spot=await fetchBtcSpot();
    const observation=await recordBtcObservation(spot);
    const memory=await buildBtcMemory(spot);
    const xrpSpot=await fetchXrpSpot();
    const xrp004=await evaluateXrp004(xrpSpot.priceUsd,xrpSpot.observedAt);
    const processedCandidates=await processNewCandidates();
    const outcomesWritten=await scoreMatureCandidates(spot.priceUsd);
    const cash=await getShadowCashUsd();
    const result={ok:true,build:"005",btcPriceUsd:spot.priceUsd,observationId:observation.id,
      memoryId:memory.memoryId,candidateId:memory.candidateId,features:memory.features,candidateReady:memory.candidateReady,
      trigger:memory.trigger,supportingSignal:memory.supportingSignal,xrp004,processedCandidates,outcomesWritten,
      shadowCashUsd:cash,authorizedToTrade:false};
    const {error:updateError}=await db.from("system_runs").update({
      completed_at:new Date().toISOString(),status:"SUCCESS",details:result
    }).eq("id",run.id);
    if(updateError) throw updateError;
    if(queueItem){
      const {error:qDone}=await db.from("research_queue").update({
        status:"SUCCESS",completed_at:new Date().toISOString(),last_error:null
      }).eq("id",queueItem.id);
      if(qDone) throw qDone;
    }
    console.log(JSON.stringify({...result,queueItemId:queueItem?.id??null},null,2));
  } catch(error:any) {
    await db.from("system_runs").update({
      completed_at:new Date().toISOString(),status:"FAILURE",error_message:String(error?.message??error),
      details:{authorizedToTrade:false}
    }).eq("id",run.id);
    if(queueItem) await db.from("research_queue").update({
      status:"FAILURE",completed_at:new Date().toISOString(),last_error:String(error?.message??error)
    }).eq("id",queueItem.id);
    throw error;
  }
}
runOnce().catch(error=>{console.error(error);process.exitCode=1;});
