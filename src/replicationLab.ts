import { db } from "./db.js";
type H={id:string;asset_a:string;asset_b:string;trigger_definition:any;created_at:string};
const ret=(a:number,b:number)=>b/a-1,mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,med=(x:number[])=>{if(!x.length)return null;const a=[...x].sort((p,q)=>p-q),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
async function series(asset:string,start:string,end:string){const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,price_usd").eq("asset",asset).gte("observed_at",start).lte("observed_at",end).order("observed_at",{ascending:true});if(error)throw error;return(data??[]).map(x=>({t:Date.parse(x.observed_at),p:Number(x.price_usd)}))}
async function evaluate(h:H,start:string,end:string){
 const a=await series(h.asset_a,start,end),b=await series(h.asset_b,start,end),bm=new Map(b.map(x=>[x.t,x.p])),r=a.filter(x=>bm.has(x.t)).map(x=>({t:x.t,a:x.p,b:bm.get(x.t)!}));
 const dir=h.trigger_definition?.direction==="DOWN"?-1:1,move=Number(h.trigger_definition?.leaderMoveAbsGte??.005),ratioMax=Number(h.trigger_definition?.responseRatioLte??.75),vals:number[]=[];
 for(let i=1;i+12<r.length;i++){const ar=ret(r[i-1].a,r[i].a),br=ret(r[i-1].b,r[i].b);if(Math.sign(ar)!==dir||Math.abs(ar)<move)continue;if(Math.abs(br)/Math.abs(ar)>ratioMax)continue;vals.push(ret(r[i].b,r[i+12].b)*dir-.005)}
 const mu=mean(vals),md=med(vals),verdict=vals.length<10?"INCONCLUSIVE":mu!=null&&mu>0&&md!=null&&md>-.0025?"PASS":"FAIL";
 return {verdict,n:vals.length,netMean:mu,netMedian:md,winRate:vals.length?vals.filter(v=>v>0).length/vals.length:null};
}
async function main(){
 const {data,error}=await db.from("hypotheses").select("id,asset_a,asset_b,trigger_definition,created_at").eq("status","HISTORICAL_SURVIVOR").limit(20);if(error)throw error;
 let pass=0,fail=0,inc=0;
 for(const h of(data??[]) as H[]){if(!h.asset_b)continue;
  // Time split is anchored to available universe history. Last 30% is untouched holdout.
  const {data:bounds,error:be}=await db.from("crypto_universe_snapshots").select("observed_at").in("asset",[h.asset_a,h.asset_b]).order("observed_at",{ascending:true});if(be)throw be;
  if(!bounds||bounds.length<100){inc++;continue}
  const lo=Date.parse(bounds[0].observed_at),hi=Date.parse(bounds.at(-1)!.observed_at),cut=new Date(lo+(hi-lo)*.7).toISOString(),end=new Date(hi).toISOString();
  const r=await evaluate(h,cut,end);if(r.verdict==="PASS")pass++;else if(r.verdict==="FAIL")fail++;else inc++;
  const {error:te}=await db.from("hypothesis_tests").insert({hypothesis_id:h.id,test_type:"HOLDOUT",dataset_start:cut,dataset_end:end,code_version:"build-017-v1",assumptions:{chronologicalHoldoutPct:30,horizonHours:12,roundTripCostBps:50,discoveryExcluded:true},sample_size:r.n,result:r,verdict:r.verdict});if(te)throw te;
  const status=r.verdict==="PASS"?"FORWARD_VALIDATION":r.verdict==="FAIL"?"REJECTED":"HISTORICAL_SURVIVOR";
  const {error:ue}=await db.from("hypotheses").update({status,updated_at:new Date().toISOString()}).eq("id",h.id);if(ue)throw ue;
 }
 console.log(JSON.stringify({ok:true,build:"017",reviewed:(data??[]).length,pass,fail,inconclusive:inc,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
