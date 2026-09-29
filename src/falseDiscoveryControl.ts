import{db}from "./db.js";import{winRatePValueOneSided}from "./science/stats.js";
// Build 041: one-sided p-value. The build-033 version used |z|, so a win rate far below 50% counted as significant.
const ALPHA=.10;
function bh(items:{id:string;p:number}[]){const s=[...items].sort((a,b)=>a.p-b.p),m=s.length;let prev=1;const out=new Map<string,number>();for(let i=m-1;i>=0;i--){const q=Math.min(prev,s[i].p*m/(i+1),1);out.set(s[i].id,q);prev=q}return out}
async function main(){const {data,error}=await db.from("hypothesis_tests").select("id,hypothesis_id,result,verdict").eq("test_type","DISCOVERY").eq("verdict","PASS").is("q_value",null);if(error)throw error;
 const items=(data??[]).map(t=>{const b=t.result?.best,n=Number(b?.n??0),wr=Number(b?.winRate??.5);if(n<2)return{id:t.id,p:1};return{id:t.id,p:winRatePValueOneSided(wr,n)}}),qs=bh(items);let accepted=0;
 for(const x of items){const q=qs.get(x.id)??1,pass=q<=ALPHA;if(pass)accepted++;const {error:e}=await db.from("hypothesis_tests").update({p_value:x.p,q_value:q,fdr_pass:pass,correction_family:"DISCOVERY_PASS_GLOBAL"}).eq("id",x.id);if(e)throw e;const t=(data??[]).find(z=>z.id===x.id);if(t&&!pass){const {error:he}=await db.from("hypotheses").update({status:"REJECTED",updated_at:new Date().toISOString()}).eq("id",t.hypothesis_id);if(he)throw he}}
 const {error:re}=await db.from("multiple_testing_runs").insert({method:"Benjamini-Hochberg",alpha:ALPHA,hypotheses_considered:items.length,discoveries_accepted:accepted,scope:{testType:"DISCOVERY",verdict:"PASS",correctionFamily:"DISCOVERY_PASS_GLOBAL",pValueRule:"one-sided win rate"},code_version:"build-041-v1"});if(re)throw re;
 console.log(JSON.stringify({ok:true,build:"041",method:"Benjamini-Hochberg",fdrAlpha:ALPHA,considered:items.length,accepted,rejected:items.length-accepted,authorizedToTrade:false},null,2))}
main().catch(e=>{console.error(e);process.exitCode=1});
