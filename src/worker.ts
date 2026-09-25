import { fetchBtcSpot } from "./market/coinbase.js";
import { recordBtcObservation, buildBtcMemory } from "./hunters/cryptoHunter.js";
import { getShadowCashUsd } from "./ledger.js";
import { processNewCandidates, scoreMatureCandidates } from "./pipeline.js";
import { fetchXrpSpot, evaluateXrp004 } from "./hunters/xrpHunter.js";

async function runOnce() {
  const spot=await fetchBtcSpot();
  const observation=await recordBtcObservation(spot);
  const memory=await buildBtcMemory(spot);
  const xrpSpot=await fetchXrpSpot();
  const xrp004=await evaluateXrp004(xrpSpot.priceUsd,xrpSpot.observedAt);
  const processedCandidates=await processNewCandidates();
  const outcomesWritten=await scoreMatureCandidates(spot.priceUsd);
  const cash=await getShadowCashUsd();
  console.log(JSON.stringify({
    ok:true,build:"004",btcPriceUsd:spot.priceUsd,observationId:observation.id,
    memoryId:memory.memoryId,candidateId:memory.candidateId,features:memory.features,candidateReady:memory.candidateReady,
    trigger:memory.trigger,supportingSignal:memory.supportingSignal,xrp004,processedCandidates,outcomesWritten,shadowCashUsd:cash,authorizedToTrade:false
  },null,2));
}
runOnce().catch(error=>{console.error(error);process.exitCode=1;});
