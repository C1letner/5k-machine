import { db } from "./db.js";
type H={id:string;hypothesis_key:string;asset_a:string;asset_b:string|null;trigger_definition:any;predicted_effect:any;status:string};
type Pt={t:number;p:number};
const ret=(a:number,b:number)=>b/a-1,mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,sd=(a:number[])=>{const m=mean(a);return m==null?0:Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length)};
async function series(asset:string,start:string,end:string){const {data,error}=await db.from("crypto_universe_snapshots").select("observed_at,price_usd").eq("asset",asset).gte("observed_at",start).lte("observed_at",end).order("observed_at",{ascending:true});if(error)throw error;return(data??[]).map(x=>({t:Date.parse(x.observed_at),p:Number(x.price_usd)}))}
function singleEvents(h:H,a:Pt[],horizon:number){const fam=h.trigger_definition?.family,vals:number[]=[];const rs=a.slice(1).map((x,i)=>ret(a[i].p,x.p));for(let i=24;i+horizon<a.length;i++){const r1=ret(a[i-1].p,a[i].p),r4=i>=4?ret(a[i-4].p,a[i].p):0,r12=i>=12?ret(a[i-12].p,a[i].p):0,prior=rs.slice(Math.max(0,i-24),i),m=mean(prior.map(Math.abs))??0,s=sd(prior.map(Math.abs)),z=s?(Math.abs(r1)-m)/s:0,v6=sd(rs.slice(Math.max(0,i-6),i)),v24=sd(prior),ratio=v24?v6/v24:1;let trig=false,dir=1;
 if(fam==="SHORT_MOMENTUM"){trig=Math.abs(r4)>=.015;dir=r4>0?1:-1}
 else if(fam==="MOMENTUM_REVERSAL"){trig=Math.sign(r4)!==Math.sign(r12)&&Math.abs(r4)>=.01&&Math.abs(r12)>=.015;dir=r4>0?1:-1}
 else if(fam==="RETURN_OUTLIER"){trig=Math.abs(z)>=2;dir=r1>0?1:-1}
 else if(fam==="VOLATILITY_EXPANSION"){trig=ratio>=1.6;dir=r4>=0?1:-1}
 else if(fam==="VOLATILITY_COMPRESSION"){trig=ratio<=.55;dir=r4>=0?1:-1}
 if(trig)vals.push(ret(a[i].p,a[i+horizon].p)*dir)}
 return vals}
function pairEvents(h:H,a:Pt[],b:Pt[],horizon:number){const bm=new Map(b.map(x=>[x.t,x.p])),r=a.filter(x=>bm.has(x.t)).map(x=>({t:x.t,a:x.p,b:bm.get(x.t)!})),fam=h.trigger_definition?.family,vals:number[]=[];
 for(let i=25;i+horizon<r.length;i++){const a1=ret(r[i-1].a,r[i].a),b1=ret(r[i-1].b,r[i].b),a4=ret(r[i-4].a,r[i].a),b4=ret(r[i-4].b,r[i].b);let trig=false,dir=1;
  if(fam==="LEAD_LAG_UNDERREACTION"){trig=Math.abs(a1)>=.005&&Math.abs(b1)<=Math.abs(a1)*.75;dir=a1>0?1:-1}
  else if(fam==="RELATIVE_STRENGTH_DIVERGENCE"){trig=Math.abs(a4-b4)>=.02;dir=(a4-b4)>0?1:-1}
  else if(fam==="CORRELATION_BREAKDOWN"){const ar=[],br=[];for(let j=i-24;j<i;j++){ar.push(ret(r[j-1].a,r[j].a));br.push(ret(r[j-1].b,r[j].b))}const c24=corr(ar,br),c6=corr(ar.slice(-6),br.slice(-6));trig=Math.abs(c24)>=.6&&Math.abs(c6-c24)>=.6;dir=(a4-b4)>0?1:-1}
  if(trig){const target=fam==="LEAD_LAG_UNDERREACTION"?ret(r[i].b,r[i+horizon].b)*dir:(ret(r[i].b,r[i+horizon].b)-ret(r[i].a,r[i+horizon].a))*dir*-1;vals.push(target)}
 }return vals}
function corr(a:number[],b:number[]){const n=Math.min(a.length,b.length);if(n<3)return 0;const x=a.slice(-n),y=b.slice(-n),mx=mean(x)??0,my=mean(y)??0,sx=sd(x),sy=sd(y);return sx&&sy?x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/n/(sx*sy):0}
async function test(h:H){const end=new Date().toISOString(),start=new Date(Date.now()-180*24*3600_000).toISOString(),a=await series(h.asset_a,start,end),horizons=[1,4,8,12,24],b=h.asset_b?await series(h.asset_b,start,end):null,results:any={};let best:any=null;
 for(const hz of horizons){const vals=b?pairEvents(h,a,b,hz):singleEvents(h,a,hz),mu=mean(vals);results[hz]={n:vals.length,meanDirectionalReturn:mu,winRate:vals.length?vals.filter(x=>x>0).length/vals.length:null};if(vals.length>=30&&mu!=null&&(!best||mu>best.meanDirectionalReturn))best={horizon:hz,n:vals.length,meanDirectionalReturn:mu,winRate:results[hz].winRate}}
 const verdict=!best?"INCONCLUSIVE":best.meanDirectionalReturn>0?"PASS":"FAIL";return{verdict,n:best?.n??0,best,allHorizons:results,family:h.trigger_definition?.family}}
async function main(){const {data,error}=await db.from("hypotheses").select("id,hypothesis_key,asset_a,asset_b,trigger_definition,predicted_effect,status").eq("status","PROPOSED").or("retry_after.is.null,retry_after.lte."+new Date().toISOString()).limit(50);if(error)throw error;let pass=0,fail=0,inc=0;
 for(const h of(data??[]) as H[]){const r=await test(h);r.verdict==="PASS"?pass++:r.verdict==="FAIL"?fail++:inc++;const {error:te}=await db.from("hypothesis_tests").insert({hypothesis_id:h.id,test_type:"DISCOVERY",dataset_start:new Date(Date.now()-180*24*3600_000).toISOString(),dataset_end:new Date().toISOString(),code_version:"build-029-v1",assumptions:{familyAware:true,horizonsHours:[1,4,8,12,24],minimumEvents:30,costs:"applied at adversarial stage"},sample_size:r.n,result:r,verdict:r.verdict});if(te)throw te;let status=r.verdict==="PASS"?"TESTING":r.verdict==="FAIL"?"REJECTED":"PROPOSED";let patch:any={status,updated_at:new Date().toISOString(),retry_after:null,retry_reason:null};
 if(r.verdict==="INCONCLUSIVE"){const {data:cur,error:ce}=await db.from("hypotheses").select("inconclusive_count").eq("id",h.id).single();if(ce)throw ce;const n=Number(cur?.inconclusive_count??0)+1,days=Math.min(30,Math.max(1,2**Math.min(n-1,5))),retry=new Date(Date.now()+days*86400_000).toISOString();patch={...patch,retry_after:retry,retry_reason:"Insufficient qualifying historical events; retry only after cooldown/new evidence.",evidence_count_at_retry:r.n,inconclusive_count:n};const {error:re}=await db.from("research_retry_events").insert({hypothesis_id:h.id,prior_status:"PROPOSED",next_retry_at:retry,reason:patch.retry_reason,evidence_count:r.n,details:{inconclusiveCount:n,cooldownDays:days,family:r.family}});if(re)throw re}
 const {error:ue}=await db.from("hypotheses").update(patch).eq("id",h.id);if(ue)throw ue}
 console.log(JSON.stringify({ok:true,build:"029",tested:(data??[]).length,pass,fail,inconclusive:inc,authorizedToTrade:false},null,2))}
main().catch(e=>{console.error(e);process.exitCode=1});
