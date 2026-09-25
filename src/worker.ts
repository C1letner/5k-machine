import { fetchBtcSpot } from "./market/coinbase.js";
import { recordBtcObservation, buildBtcMemory } from "./hunters/cryptoHunter.js";
import { getShadowCashUsd } from "./ledger.js";
import { processNewCandidates, scoreMatureCandidates } from "./pipeline.js";

async function runOnce() {
  const spot=await fetchBtcSpot();
  const observation=await recordBtcObservation(spot);
  const memory=await buildBtcMemory(spot);
  const processedCandidates=await processNewCandidates();
  const outcomesWritten=await scoreMatureCandidates(spot.priceUsd);
  const cash=await getShadowCashUsd();
  console.log(JSON.stringify({
    ok:true,build:"002",btcPriceUsd:spot.priceUsd,observationId:observation.id,
    memoryId:memory.memoryId,candidateId:memory.candidateId,features:memory.features,candidateReady:memory.candidateReady,
    trigger:memory.trigger,supportingSignal:memory.supportingSignal,processedCandidates,outcomesWritten,shadowCashUsd:cash,authorizedToTrade:false
  },null,2));
}
runOnce().catch(error=>{console.error(error);process.exitCode=1;});
