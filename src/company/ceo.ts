import { db } from "./db.js";
type Snap={research_pending:number;research_failed:number;successful_runs_24h:number;failed_runs_24h:number;universe_rows_2h:number;universe_assets_2h:number;hypotheses_total:number;hypotheses_rejected:number;forward_validation:number;forward_survivors:number;active_forward_experiments:number;development_open:number;development_blocked:number;authorized_to_trade:boolean;owner_risk_posture:string};
async function decide(s:Snap){
 const findings:any[]=[],actions:any[]=[],owner:any[]=[];
 let status:"GREEN"|"YELLOW"|"RED"="GREEN";
 if(s.failed_runs_24h>0||s.research_failed>0){status="RED";findings.push({severity:"HIGH",area:"CTO",finding:"Recorded runtime failures require investigation."});actions.push({to:"CTO",action:"Investigate failures, preserve evidence, repair without changing capital authority."})}
 if(s.research_pending>10){if(status==="GREEN")status="YELLOW";findings.push({severity:"MEDIUM",area:"CTO",finding:`Research queue backlog is ${s.research_pending}.`});actions.push({to:"CTO",action:"Drain backlog and verify processing cadence."})}
 if(s.universe_assets_2h<8){status=status==="RED"?"RED":"YELLOW";findings.push({severity:"MEDIUM",area:"CRO_CTO",finding:`Only ${s.universe_assets_2h}/8 universe assets fresh in last 2h.`});actions.push({to:"CTO",action:"Restore complete synchronized universe sensing."})}
 if(s.hypotheses_total===0){findings.push({severity:"INFO",area:"CRO",finding:"No machine-generated hypotheses yet; laboratory is accumulating data."});actions.push({to:"CRO",action:"Continue observation accumulation; do not manufacture hypotheses."})}
 if(s.development_open>0) actions.push({to:"CTO",action:`Review ${s.development_open} open development work orders and prioritize reliability/security before expansion.`});
 if(s.development_blocked>0) owner.push({type:"BLOCKER_REVIEW",count:s.development_blocked});
 return {status,findings,actions,owner};
}
async function main(){
 const {data,error}=await db.from("ceo_operating_snapshot").select("*").single();if(error)throw error;const s=data as Snap,d=await decide(s);
 const end=new Date(),start=new Date(end.getTime()-24*3600_000);
 const narrative=`Company ${d.status}. Trading authority remains OFF. ${s.successful_runs_24h} successful and ${s.failed_runs_24h} failed research loops in 24h; research backlog ${s.research_pending}; crypto universe freshness ${s.universe_assets_2h}/8 assets; hypotheses ${s.hypotheses_total}; forward survivors ${s.forward_survivors}. Owner risk posture MEDIUM.`;
 const {data:r,error:re}=await db.from("ceo_reports").insert({period_start:start.toISOString(),period_end:end.toISOString(),company_status:d.status,owner_risk_posture:"MEDIUM",authorized_to_trade:false,metrics:s,department_status:{CRO:s.hypotheses_total?"OPERATING":"ACCUMULATING",CIO:s.forward_survivors?"REVIEW_READY":"STANDBY",CTO:s.failed_runs_24h||s.research_pending>10?"ATTENTION":"OPERATING",CFO_COO:"MEASUREMENT_BUILDING"},material_findings:d.findings,management_actions:d.actions,owner_decisions_required:d.owner,narrative}).select("id").single();if(re)throw re;
 for(const a of d.actions){const role=a.to==="CRO_CTO"?"CTO":a.to;await db.from("executive_decisions").insert({role,decision_type:"CEO_DIRECTIVE",subject:a.action,rationale:"Generated from CEO operating snapshot and governance mandate.",evidence:s,action:a,requires_owner:false,status:"OPEN"})}
 console.log(JSON.stringify({ok:true,build:"022",reportId:r.id,status:d.status,actions:d.actions,ownerDecisions:d.owner,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
