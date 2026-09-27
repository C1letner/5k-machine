import { db } from "./db.js";
async function main(){
 const {data:made,error:me}=await db.rpc("materialize_ceo_directives");if(me)throw me;
 const {data:orders,error}=await db.from("executive_work_orders").select("*").in("status",["QUEUED","BLOCKED"]).order("priority",{ascending:true}).limit(20);if(error)throw error;
 let claimed=0,completed=0,blocked=0;
 for(const w of orders??[]){
  if(w.status==="BLOCKED")continue;
  await db.from("executive_work_orders").update({status:"CLAIMED",updated_at:new Date().toISOString()}).eq("id",w.id);
  await db.from("executive_work_events").insert({work_order_id:w.id,actor:w.assigned_role,event_type:"CLAIMED",details:{objective:w.objective}});
  claimed++;
  // V1 executor handles only evidence-based operational checks. Repairs remain role-specific code/work.
  let evidence:any={checkedAt:new Date().toISOString()},ok=false,blocker:string|null=null;
  if(w.assigned_role==="CTO"&&String(w.objective).toLowerCase().includes("backlog")){
   const {count,error:ce}=await db.from("research_queue").select("*",{count:"exact",head:true}).eq("status","PENDING");if(ce)throw ce;
   evidence.pendingResearch=count??0;ok=(count??0)<=10;if(!ok)blocker=`Research backlog remains ${count}; repair worker must continue draining.`;
  }else if(w.assigned_role==="CTO"&&String(w.objective).toLowerCase().includes("synchronized")){
   const since=new Date(Date.now()-2*3600_000).toISOString();const {data,error:ue}=await db.from("crypto_universe_snapshots").select("asset").gte("observed_at",since);if(error)throw error;
   const assets=[...new Set((ue??[]).map(x=>x.asset))];evidence.freshAssets=assets;ok=assets.length===8;if(!ok)blocker=`Only ${assets.length}/8 assets fresh.`;
  }else if(w.assigned_role==="CRO"&&String(w.objective).toLowerCase().includes("accum")){
   const {count,error:hc}=await db.from("crypto_universe_snapshots").select("*",{count:"exact",head:true});if(hc)throw hc;
   evidence.universeObservations=count??0;ok=true;
  }else{
   blocker="V1 executive executor has no safe deterministic implementation for this directive; requires department capability.";
  }
  const status=ok?"VERIFYING":"BLOCKED";
  await db.from("executive_work_orders").update({status,evidence,blocker,updated_at:new Date().toISOString()}).eq("id",w.id);
  await db.from("executive_work_events").insert({work_order_id:w.id,actor:w.assigned_role,event_type:status,details:{evidence,blocker}});
  if(ok){await db.from("executive_work_orders").update({status:"COMPLETE",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",w.id);
   await db.from("executive_work_events").insert({work_order_id:w.id,actor:"CEO_CONTROL",event_type:"VERIFIED",details:{evidence}});if(w.decision_id)await db.from("executive_decisions").update({status:"COMPLETE"}).eq("id",w.decision_id);completed++;
  }else blocked++;
 }
 console.log(JSON.stringify({ok:true,build:"023",materialized:made??0,claimed,completed,blocked,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
