import { fetchBtcSpot } from "./market/coinbase.js";
import { recordBtcObservation, maybeCreateCandidate } from "./hunters/cryptoHunter.js";
import { getShadowCashUsd } from "./ledger.js";

async function runOnce() {
  const spot = await fetchBtcSpot();
  const observation = await recordBtcObservation(spot);
  await maybeCreateCandidate();
  const cash = await getShadowCashUsd();

  console.log(JSON.stringify({
    ok: true,
    btcPriceUsd: spot.priceUsd,
    observationId: observation.id,
    shadowCashUsd: cash,
    authorizedToTrade: false
  }, null, 2));
}

runOnce().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
