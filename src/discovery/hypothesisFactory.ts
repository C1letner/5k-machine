import crypto from "node:crypto";

export type HypothesisProposal = {
  generator:string; generatorVersion:string; market:string; assetA:string; assetB?:string;
  observationWindow:string; claim:string; mechanism?:string;
  triggerDefinition:Record<string,unknown>; predictedEffect:Record<string,unknown>;
  falsificationCriteria:Record<string,unknown>; requiredData:string[];
};

function stable(v:any):any {
  if(Array.isArray(v)) return v.map(stable);
  if(v&&typeof v==="object") return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
export function hypothesisKey(h:HypothesisProposal){
  const identity={generator:h.generator,generatorVersion:h.generatorVersion,market:h.market,assetA:h.assetA,assetB:h.assetB??null,
    observationWindow:h.observationWindow,triggerDefinition:h.triggerDefinition,predictedEffect:h.predictedEffect,falsificationCriteria:h.falsificationCriteria};
  return crypto.createHash("sha256").update(JSON.stringify(stable(identity))).digest("hex");
}
export function validateHypothesis(h:HypothesisProposal){
  const errors:string[]=[];
  if(!h.claim.trim()) errors.push("claim required");
  if(!Object.keys(h.triggerDefinition).length) errors.push("trigger_definition required");
  if(!Object.keys(h.predictedEffect).length) errors.push("predicted_effect required");
  if(!Object.keys(h.falsificationCriteria).length) errors.push("falsification_criteria required");
  if(!h.requiredData.length) errors.push("required_data required");
  return {valid:errors.length===0,errors};
}
export function freezeable(h:HypothesisProposal){
  const v=validateHypothesis(h);
  return {...v,key:v.valid?hypothesisKey(h):null};
}
