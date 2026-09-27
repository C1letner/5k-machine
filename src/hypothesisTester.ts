import { db } from "./db.js";

type H={id:string;hypothesis_key:string;asset_a:string;asset_b:string;trigger_definition:any;predicted_effect:any;created_at:string;status:string};

async function getSeries(asset:string,start:string,end:string){
 const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,price_usd")
  .eq("asset",asset).gte("observed_at",start).lte("observed_at",end).order("observed_at",{ascending:true});
 if(error)throw error;return (data??[]).map(x=>({t:Date.parse(x.observed_at),p:Number(x.price_usd)}));
}
const ret=(a:number,b:number)=>b/a-1;
const avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

async function test(h:H){
 const end=new Date().toISOString(),start=new Date(Date.now()-30*24*3600_000).toISOString();
 const a=await getSeries(h.asset_a,start,end),b=await getSeries(h.asset_b,start,end);
 const bm=new Map(b.map(x=>[x.t,x.p]));const rows=a.filter(x=>bm.has(x.t)).map(x=>({t:x.t,a:x.p,b:bm.get(x.t)!}));
 if(rows.length<50)return {verdict:"INCONCLUSIVE" as const,n:0,reason:"Need at least 50 synchronized hourly observations"};
 const dir=h.trigger_definition?.direction==="DOWN"?-1:1,move=Number(h.trigger_definition?.leaderMoveAbsGte??.005),ratioMax=Number(h.trigger_definition?.responseRatioLte??.75);
 const vals:number[]=[];
 for(let i=1;i+12<rows.length;i++){const ar=ret(rows[i-1].a,rows[i].a),br=ret(rows[i-1].b,rows[i].b);if(Math.sign(ar)!==dir||Math.abs(ar)<move)continue;
  const ratio=Math.abs(ar)>0?Math.abs(br)/Math.abs(ar):99;if(ratio>ratioMax)continue;vals.push(ret(rows[i].b,rows[i+12].b)*dir)}
 const m=avg(vals);return {verdict:vals.length>=10&&m!=null&&m>0?"PASS" as const:vals.length>=10?"FAIL" as const:"INCONCLUSIVE" as const,n:vals.length,meanDirectionalReturn:m};
}
async function main(){
 const {data,error}=await db.from("hypotheses").select("id,hypothesis_key,asset_a,asset_b,trigger_definition,predicted_effect,created_at,status").eq("status","PROPOSED").limit(20);
 if(error)throw error;let tested=0;
 for(const h of (data??[]) as H[]){if(!h.asset_b)continue;const r=await test(h);
  const {error:te}=await db.from("hypothesis_tests").insert({hypothesis_id:h.id,test_type:"DISCOVERY",dataset_start:new Date(Date.now()-30*24*3600_000).toISOString(),dataset_end:new Date().toISOString(),code_version:"build-014-v1",assumptions:{horizonHours:12,costs:"not yet applied; discovery screen only"},sample_size:r.n,result:r,verdict:r.verdict});
  if(te)throw te;
  const status=r.verdict==="PASS"?"TESTING":r.verdict==="FAIL"?"REJECTED":"PROPOSED";
  const {error:ue}=await db.from("hypotheses").update({status,updated_at:new Date().toISOString()}).eq("id",h.id);if(ue)throw ue;tested++;
 }
 console.log(JSON.stringify({ok:true,build:"014",tested,authorizedToTrade:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
