import{db}from "./db.js";
// Build 042: p-values come from the Discovery Test's studentized block bootstrap (net of costs,
// dependence-aware, max over horizons). The win-rate p-value (033/041) let fake edges through when
// events clustered. Discovery PASS results without a bootstrap p-value (from before build 042) are
// never judged on the old rule: their hypotheses are sent back for a build-042 retest.
const ALPHA=.10;
function bh(items:{id:string;p:number}[]){const s=[...items].sort((a,b)=>a.p-b.p),m=s.length;let prev=1;const out=new Map<string,number>();for(let i=m-1;i>=0;i--){const q=Math.min(prev,s[i].p*m/(i+1),1);out.set(s[i].id,q);prev=q}return out}
async function main(){const {data,error}=await db.from("hypothesis_tests").select("id,hypothesis_id,result,verdict").eq("test_type","DISCOVERY").eq("verdict","PASS").is("q_value",null);if(error)throw error;
 const legacy=(data??[]).filter(t=>typeof t.result?.bootstrap?.p!=="number");let retest=0;
 for(const t of legacy){const {error:le}=await db.from("hypothesis_tests").update({fdr_pass:false,q_value:1,correction_family:"RETEST_REQUIRED_BUILD_042"}).eq("id",t.id);if(le)throw le;const {error:he}=await db.from("hypotheses").update({status:"PROPOSED",retry_after:null,retry_reason:"Re-test under build-042 significance",updated_at:new Date().toISOString()}).eq("id",t.hypothesis_id);if(he)throw he;retest++}
 const items=(data??[]).filter(t=>typeof t.result?.bootstrap?.p==="number").map(t=>({id:t.id,p:Number(t.result.bootstrap.p)})),qs=bh(items);let accepted=0;
 for(const x of items){const q=qs.get(x.id)??1,pass=q<=ALPHA;if(pass)accepted++;const {error:e}=await db.from("hypothesis_tests").update({p_value:x.p,q_value:q,fdr_pass:pass,correction_family:"DISCOVERY_PASS_GLOBAL"}).eq("id",x.id);if(e)throw e;const t=(data??[]).find(z=>z.id===x.id);if(t&&!pass){const {error:he}=await db.from("hypotheses").update({status:"REJECTED",updated_at:new Date().toISOString()}).eq("id",t.hypothesis_id);if(he)throw he}}
 const {error:re}=await db.from("multiple_testing_runs").insert({method:"Benjamini-Hochberg",alpha:ALPHA,hypotheses_considered:items.length,discoveries_accepted:accepted,scope:{testType:"DISCOVERY",verdict:"PASS",correctionFamily:"DISCOVERY_PASS_GLOBAL",pValueRule:"studentized block bootstrap, net of costs"},code_version:"build-042-v1"});if(re)throw re;
 console.log(JSON.stringify({ok:true,build:"042",method:"Benjamini-Hochberg",fdrAlpha:ALPHA,considered:items.length,accepted,rejected:items.length-accepted,sentBackForRetest:retest,authorizedToTrade:false},null,2))}
main().catch(e=>{console.error(e);process.exitCode=1});
