import { db } from "./db.js";

type Candidate = {
  id: string; asset: string; direction: "LONG"|"SHORT"|"NEUTRAL";
  discovery_price_usd: number|string|null; trigger: string;
  supporting_signal: string|null; mispricing_thesis: string|null;
  catalyst: string|null; invalidation: string|null; hunter_confidence: string|null;
};

export async function processNewCandidates() {
  const { data, error } = await db.from("candidates")
    .select("id,asset,direction,discovery_price_usd,trigger,supporting_signal,mispricing_thesis,catalyst,invalidation,hunter_confidence")
    .eq("status","DISCOVERED")
    .order("created_at",{ascending:true})
    .limit(10);
  if (error) throw error;

  const processed: Array<{candidateId:string; classification:string; score:number}> = [];

  for (const c of (data ?? []) as Candidate[]) {
    // V1 prosecutor is intentionally deterministic and skeptical.
    const counter = c.direction === "LONG"
      ? "A price breakout can be temporary; without independent flow, volume, news, or fundamental confirmation, continuation is unproven."
      : "A price breakdown can reverse sharply; without independent flow, volume, news, or fundamental confirmation, downside continuation is unproven.";

    const { error: pError } = await db.from("prosecution").insert({
      candidate_id:c.id,
      strongest_counter_thesis:counter,
      contradictory_evidence:[],
      hidden_risks:["single-signal dependence","reversal risk","missing independent confirmation"],
      alternative_explanation:"The observed move may be normal volatility rather than durable mispricing.",
      prosecutor_recommendation:"CAUTION",
      hunter_rebuttal:"Hunter trigger is preserved as forward evidence, but no additional evidence is available in Build 003.",
      version:"V1.0"
    });
    if (pError) throw pError;

    // Qualification V1.0: low evidence by design until deeper research agents exist.
    const scores = {
      evidence_quality:8,
      risk_reward:10,
      catalyst_timing:8,
      executability:18,
      thesis_resilience:7
    };
    const total=Object.values(scores).reduce((a,b)=>a+b,0);
    const classification = total < 50 ? "REJECT" : total < 70 ? "WATCH" : total < 85 ? "QUALIFIED" : "HIGH_CONVICTION";

    const { error:qError }=await db.from("qualification").insert({
      candidate_id:c.id,...scores,classification,qualification_version:"V1.0"
    });
    if(qError) throw qError;

    const { error:uError }=await db.from("candidates").update({status:classification}).eq("id",c.id);
    if(uError) throw uError;
    processed.push({candidateId:c.id,classification,score:total});
  }
  return processed;
}

export async function scoreMatureCandidates(currentBtcPrice:number) {
  const { data,error }=await db.from("candidates")
    .select("id,asset,discovery_price_usd,created_at")
    .eq("asset","BTC")
    .in("status",["REJECT","WATCH","QUALIFIED"]);
  if(error) throw error;
  let written=0;
  for(const c of data ?? []){
    const ageMs=Date.now()-Date.parse(c.created_at);
    const horizons=[["1H",60*60*1000],["1D",24*60*60*1000],["7D",7*24*60*60*1000]] as const;
    for(const [h,ms] of horizons){
      if(ageMs<ms) continue;
      const {data:existing,error:e}=await db.from("candidate_outcomes").select("id").eq("candidate_id",c.id).eq("horizon",h).limit(1);
      if(e) throw e;
      if(existing?.length) continue;
      const ref=Number(c.discovery_price_usd);
      const ret=((currentBtcPrice/ref)-1)*100;
      const {error:i}=await db.from("candidate_outcomes").insert({
        candidate_id:c.id,horizon:h,reference_price_usd:ref,measured_price_usd:currentBtcPrice,return_pct:ret
      });
      if(i) throw i;
      written++;
    }
  }
  return written;
}
