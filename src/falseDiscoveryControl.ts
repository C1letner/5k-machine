import{db}from "./db.js";
const ALPHA=.10;
function bh(items:{id:string;p:number}[]){const s=[...items].sort((a,b)=>a.p-b.p),m=s.length;let prev=1;const out=new Map<string,number>();for(let i=m-1;i>=0;i--){const q=Math.min(prev,s[i].p*m/(i+1),1);out.set(s[i].id,q);prev=q}return out}
async function main(){const {data,error}=await db.from("hypothesis_tests").select("id,hypothesis_id,result,verdict").eq("test_type","DISCOVERY").eq("verdict","PASS").is("q_value",null);if(error)throw error;
 const items=(data??[]).map(t=>{const b=t.result?.best,n=Number(b?.n??0),wr=Number(b?.winRate??.5);if(n<2)return{id:t.id,p:1};const z=(wr-.5)/Math.sqrt(.25/n);const cdf=.5*(1+erf(Math.abs(z)/Math.sqrt(2)));return{id:t.id,p:Math.max(0,Math.min(1,2*(1-cdf)))}}),qs=bh(items);let accepted=0;
 for(const x of items){const q=qs.get(x.id)??1,pass=q<=ALPHA;if(pass)accepted++;const {error:e}=await db.from("hypothesis_tests").update({p_value:x.p,q_value:q,fdr_pass:pass,correction_family:"DISCOVERY_PASS_GLOBAL"}).eq("id",x.id);if(e)throw e}
 const {error:re}=await db.from("multiple_testing_runs").insert({method:"Benjamini-Hochberg",alpha:ALPHA,hypotheses_considered:items.length,discoveries_accepted:accepted,scope:{testType:"DISCOVERY",verdict:"PASS",correctionFamily:"DISCOVERY_PASS_GLOBAL"},code_version:"build-033-v1"});if(re)throw re;
 console.log(JSON.stringify({ok:true,build:"033",method:"Benjamini-Hochberg",fdrAlpha:ALPHA,considered:items.length,accepted,rejected:items.length-accepted,authorizedToTrade:false},null,2))}
function erf(x:number){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return s*y}
main().catch(e=>{console.error(e);process.exitCode=1});
