import { db } from "./db.js";
import { adversarialReview } from "./discovery/adversarialScientist.js";

type H={id:string;asset_a:string;asset_b:string;trigger_definition:any;status:string};
const ret=(a:number,b:number)=>b/a-1;
async function series(asset:string,start:string,end:string){const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,price_usd").eq("asset",asset).gte("observed_at",start).lte("observed_at",end).order("observed_at",{ascending:true});if(error)throw error;return(data??[]).map(x=>({t:Date.parse(x.observed_at),p:Number(x.price_usd)}))}
async function returnsFor(h:H){
 const end=new Date().toISOString(),start=new Date(Date.now()-30*24*3600_000).toISOString(),a=await series(h.asset_a,start,end),b=await series(h.asset_b,start,end),bm=new Map(b.map(x=>[x.t,x.p])),r=a.filter(x=>bm.has(x.t)).map(x=>({t:x.t,a:x.p,b:bm.get(x.t)!}));
 const dir=h.trigger_definition?.direction==="DOWN"?-1:1,move=Number(h.trigger_definition?.leaderMoveAbsGte??.005),ratioMax=Number(h.trigger_definition?.responseRatioLte??.75),vals:number[]=[];
 for(let i=1;i+12<r.length;i++){const ar=ret(r[i-1].a,r[i].a),br=ret(r[i-1].b,r[i].b);if(Math.sign(ar)!==dir||Math.abs(ar)<move)continue;if(Math.abs(br)/Math.abs(ar)>ratioMax)continue;vals.push(ret(r[i].b,r[i+12].b)*dir)}
 return {vals,start,end};
}
async function main(){
 const {data,error}=await db.from("hypotheses").select("id,asset_a,asset_b,trigger_definition,status").eq("status","TESTING").limit(20);if(error)throw error;
 let passed=0,failed=0,inconclusive=0;
 for(const h of(data??[]) as H[]){if(!h.asset_b)continue;const {vals,start,end}=await returnsFor(h);
  const review=adversarialReview({sampleSize:vals.length,returns:vals,costBps:50});
  const verdict=review.verdict; if(verdict==="PASS")passed++;else if(verdict==="FAIL")failed++;else inconclusive++;
  const {error:te}=await db.from("hypothesis_tests").insert({hypothesis_id:h.id,test_type:"ADVERSARIAL",dataset_start:start,dataset_end:end,code_version:"build-016-v1",assumptions:{horizonHours:12,roundTripCostBps:50,review:"sample,median,outlier-dependence,costs"},sample_size:vals.length,result:review,verdict});if(te)throw te;
  const status=verdict==="PASS"?"HISTORICAL_SURVIVOR":verdict==="FAIL"?"REJECTED":"TESTING";
  const {error:ue}=await db.from("hypotheses").update({status,updated_at:new Date().toISOString(),frozen_at:verdict==="PASS"?new Date().toISOString():null}).eq("id",h.id);if(ue)throw ue;
 }
 console.log(JSON.stringify({ok:true,build:"016",reviewed:(data??[]).length,passed,failed,inconclusive,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
