import { db } from "./db.js";
type F={severity:"INFO"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";category:string;claim?:string;evidence:any;finding:string;recommended_owner_action?:string};
async function main(){
 const {data:s,error}=await db.from("audit_snapshot").select("*").single();if(error)throw error;
 const findings:F[]=[];let claims=0;
 claims++;if(Number(s.ceo_trade_authority_claims)>0)findings.push({severity:"CRITICAL",category:"AUTHORITY",claim:"CEO reports trading authority OFF",evidence:{ceo_trade_authority_claims:s.ceo_trade_authority_claims},finding:"One or more CEO reports claim trading authority TRUE.",recommended_owner_action:"Freeze capital actions and investigate immediately."});
 claims++;if(Number(s.unauthorized_sensitive_decisions)>0)findings.push({severity:"CRITICAL",category:"AUTHORITY",evidence:{count:s.unauthorized_sensitive_decisions},finding:"Sensitive executive decisions exist without Owner approval.",recommended_owner_action:"Suspend affected directive and inspect decision chain."});
 claims++;if(Number(s.completions_without_evidence)>0)findings.push({severity:"HIGH",category:"EVIDENCE",evidence:{count:s.completions_without_evidence},finding:"Executive work was marked COMPLETE without evidence.",recommended_owner_action:"Reopen unsupported completions."});
 claims++;if(Number(s.nondeposit_transactions)>0)findings.push({severity:"CRITICAL",category:"CAPITAL",evidence:{nondeposit_transactions:s.nondeposit_transactions},finding:"Non-deposit transaction exists while real trading authority is expected OFF.",recommended_owner_action:"Freeze execution systems and reconcile transaction immediately."});
 claims++;if(Number(s.forward_survivors)!==Number(s.forward_experiments_passed))findings.push({severity:"HIGH",category:"SCIENCE",evidence:{forward_survivors:s.forward_survivors,forward_experiments_passed:s.forward_experiments_passed},finding:"Forward-survivor count does not reconcile to passed forward experiments.",recommended_owner_action:"Prevent CIO use until scientific record reconciles."});
 if(Number(s.runtime_failures_24h)>0)findings.push({severity:"MEDIUM",category:"RELIABILITY",evidence:{runtime_failures_24h:s.runtime_failures_24h},finding:"Runtime failures occurred in the last 24 hours."});
 if(Number(s.research_pending)>10)findings.push({severity:"MEDIUM",category:"OPERATIONS",evidence:{research_pending:s.research_pending},finding:"Research queue backlog exceeds 10."});
 const material=findings.filter(x=>["HIGH","CRITICAL"].includes(x.severity)).length,exceptions=findings.length;
 const overall=material?"MATERIAL_FAILURE":exceptions?"EXCEPTIONS":"CLEAN",end=new Date(),start=new Date(end.getTime()-24*3600_000);
 const narrative=`Independent audit ${overall}. Tested ${claims} core management/control claims. ${exceptions} exceptions, ${material} material failures. Trading authority expected OFF.`;
 const {data:r,error:re}=await db.from("audit_reports").insert({period_start:start.toISOString(),period_end:end.toISOString(),overall_status:overall,findings,management_claims_tested:claims,exceptions_count:exceptions,material_failures_count:material,owner_attention_required:material>0,narrative}).select("id").single();if(re)throw re;
 for(const f of findings){const {error:fe}=await db.from("audit_findings").insert({report_id:r.id,...f});if(fe)throw fe}
 console.log(JSON.stringify({ok:true,build:"024",reportId:r.id,overall,claimsTested:claims,exceptions,materialFailures:material,ownerAttentionRequired:material>0},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
