import { db } from "./db.js";
const ret=(a:number,b:number)=>b/a-1;
async function main(){
 const {data:hs,error:he}=await db.from("hypotheses").select("id,asset_a,asset_b,trigger_definition,predicted_effect,status").eq("status","FORWARD_VALIDATION");if(he)throw he;
 for(const h of hs??[]){await db.from("forward_experiments").upsert({hypothesis_id:h.id,status:"ACTIVE",min_occurrences:25,cost_bps:50},{onConflict:"hypothesis_id",ignoreDuplicates:true})}
 const {data:ex,error:ee}=await db.from("forward_experiments").select("id,hypothesis_id,min_occurrences,cost_bps,status,hypotheses(asset_a,asset_b,trigger_definition,predicted_effect)").eq("status","ACTIVE");if(ee)throw ee;
 let signals=0,outcomes=0,passed=0,failed=0;
 for(const e of ex??[]){const h:any=e.hypotheses;if(!h?.asset_b)continue;
  const {data:snap,error:se}=await db.from("crypto_universe_snapshots").select("observed_at,asset,price_usd").in("asset",[h.asset_a,h.asset_b]).order("observed_at",{ascending:false}).limit(6);if(se)throw se;
  const by:Record<string,any[]>={};for(const x of snap??[])(by[x.asset]??=[]).push(x);const a=by[h.asset_a]??[],b=by[h.asset_b]??[];
  if(a.length>=2&&b.length>=2){const ar=ret(Number(a[1].price_usd),Number(a[0].price_usd)),br=ret(Number(b[1].price_usd),Number(b[0].price_usd)),dir=h.trigger_definition?.direction==="DOWN"?-1:1,move=Number(h.trigger_definition?.leaderMoveAbsGte??.005),ratio=Number(h.trigger_definition?.responseRatioLte??.75);
   if(Math.sign(ar)===dir&&Math.abs(ar)>=move&&Math.abs(br)/Math.abs(ar)<=ratio){const horizon=Number(h.predicted_effect?.horizonsHours?.[2]??12),direction=dir===1?"LONG":"SHORT";
    const {error:si}=await db.from("forward_signals").upsert({experiment_id:e.id,hypothesis_id:e.hypothesis_id,triggered_at:a[0].observed_at,asset:h.asset_b,direction,reference_price_usd:Number(b[0].price_usd),horizon_hours:horizon,cost_bps:e.cost_bps,context:{leader:h.asset_a,leaderReturn:ar,followerReturn:br,responseRatio:Math.abs(br)/Math.abs(ar)}},{onConflict:"experiment_id,triggered_at,horizon_hours",ignoreDuplicates:true});if(si)throw si;signals++;
   }}
  const {data:pending,error:pe}=await db.from("forward_signals").select("id,triggered_at,asset,direction,reference_price_usd,horizon_hours,cost_bps").eq("experiment_id",e.id);if(pe)throw pe;
  for(const s of pending??[]){if(Date.now()<Date.parse(s.triggered_at)+Number(s.horizon_hours)*3600_000)continue;const {data:exists}=await db.from("forward_outcomes").select("id").eq("signal_id",s.id).limit(1);if(exists?.length)continue;
   const {data:last,error:le}=await db.from("crypto_universe_snapshots").select("price_usd").eq("asset",s.asset).order("observed_at",{ascending:false}).limit(1);if(le)throw le;if(!last?.length)continue;
   const raw=ret(Number(s.reference_price_usd),Number(last[0].price_usd))*(s.direction==="LONG"?1:-1),net=raw-Number(s.cost_bps)/10000;
   const {error:oi}=await db.from("forward_outcomes").insert({signal_id:s.id,measured_price_usd:Number(last[0].price_usd),gross_return_pct:raw*100,net_return_pct:net*100});if(oi)throw oi;outcomes++;
  }
  const {data:all}=await db.from("forward_signals").select("id").eq("experiment_id",e.id);const ids=(all??[]).map(x=>x.id);if(ids.length>=e.min_occurrences){const {data:outs}=await db.from("forward_outcomes").select("net_return_pct").in("signal_id",ids);if((outs??[]).length>=e.min_occurrences){const vals=(outs??[]).map(x=>Number(x.net_return_pct)),mu=vals.reduce((x,y)=>x+y,0)/vals.length,win=vals.filter(x=>x>0).length/vals.length;const ok=mu>0&&win>=.4;
    await db.from("forward_experiments").update({status:ok?"PASSED":"FAILED"}).eq("id",e.id);await db.from("hypotheses").update({status:ok?"FORWARD_SURVIVOR":"REJECTED",updated_at:new Date().toISOString()}).eq("id",e.hypothesis_id);ok?passed++:failed++;
  }}
 }
 console.log(JSON.stringify({ok:true,build:"018",activeExperiments:(ex??[]).length,signalsObserved:signals,outcomesWritten:outcomes,passed,failed,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
