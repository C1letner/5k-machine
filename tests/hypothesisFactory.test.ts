import assert from "node:assert/strict";
import { freezeable, hypothesisKey, type HypothesisProposal } from "../src/discovery/hypothesisFactory.js";
const h:HypothesisProposal={generator:"anomaly_scanner",generatorVersion:"V1",market:"crypto",assetA:"BTC",assetB:"XRP",observationWindow:"1h",
 claim:"When BTC has an abnormal positive impulse and XRP materially underreacts, XRP may catch up over the next 12h.",
 mechanism:"temporary cross-asset repricing lag",
 triggerDefinition:{btcReturnGte:0.01,btcImpulseGte:2,xrpResponseRatioLte:0.5},
 predictedEffect:{asset:"XRP",direction:"LONG",horizonHours:12},
 falsificationCriteria:{netExpectancyLte:0,holdoutRequired:true,forwardRequired:true},
 requiredData:["BTC hourly spot","XRP hourly spot","transaction cost model"]};
assert.equal(freezeable(h).valid,true);
assert.equal(hypothesisKey(h),hypothesisKey({...h,triggerDefinition:{xrpResponseRatioLte:0.5,btcImpulseGte:2,btcReturnGte:0.01}}));
assert.equal(freezeable({...h,falsificationCriteria:{}}).valid,false);
console.log("Hypothesis Factory contract tests passed");
