import type {PricePoint} from "./anomalyScanner.js";
export type DiscoveryHit={family:string;leader?:string;follower?:string;asset?:string;direction?:string;windowHours:number;score:number;features:Record<string,number|string|boolean|null>};
const ret=(a:number,b:number)=>a>0?b/a-1:0,mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,sd=(a:number[])=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):0},corr=(a:number[],b:number[])=>{const n=Math.min(a.length,b.length);if(n<3)return 0;const x=a.slice(-n),y=b.slice(-n),mx=mean(x),my=mean(y),sx=sd(x),sy=sd(y);return sx&&sy?mean(x.map((v,i)=>(v-mx)*(y[i]-my)))/(sx*sy):0};
const rets=(s:PricePoint[])=>s.slice(1).map((x,i)=>ret(s[i].price,x.price));
export function scanDiscoveryLibrary(series:Record<string,PricePoint[]>):DiscoveryHit[]{
 const assets=Object.keys(series).sort(),hits:DiscoveryHit[]=[];
 for(const asset of assets){const r=rets(series[asset]);if(r.length<24)continue;const last=r.at(-1)!,v6=sd(r.slice(-6)),v24=sd(r.slice(-24)),mom4=series[asset].length>4?ret(series[asset].at(-5)!.price,series[asset].at(-1)!.price):0,mom12=series[asset].length>12?ret(series[asset].at(-13)!.price,series[asset].at(-1)!.price):0;
  const z=sd(r.slice(-24))?(last-mean(r.slice(-24)))/sd(r.slice(-24)):0;
  if(Math.abs(z)>=2)hits.push({family:"RETURN_OUTLIER",asset,direction:z>0?"UP":"DOWN",windowHours:1,score:Math.abs(z),features:{z,last}});
  if(v24>0&&v6/v24>=1.6)hits.push({family:"VOLATILITY_EXPANSION",asset,windowHours:6,score:v6/v24,features:{v6,v24,ratio:v6/v24}});
  if(v24>0&&v6/v24<=.55)hits.push({family:"VOLATILITY_COMPRESSION",asset,windowHours:6,score:v24/Math.max(v6,1e-9),features:{v6,v24,ratio:v6/v24}});
  if(Math.abs(mom4)>=.015)hits.push({family:"SHORT_MOMENTUM",asset,direction:mom4>0?"UP":"DOWN",windowHours:4,score:Math.abs(mom4)*100,features:{mom4}});
  if(Math.sign(mom4)!==Math.sign(mom12)&&Math.abs(mom4)>=.01&&Math.abs(mom12)>=.015)hits.push({family:"MOMENTUM_REVERSAL",asset,direction:mom4>0?"UP":"DOWN",windowHours:4,score:(Math.abs(mom4)+Math.abs(mom12))*100,features:{mom4,mom12}});
 }
 for(let i=0;i<assets.length;i++)for(let j=i+1;j<assets.length;j++){const a=assets[i],b=assets[j],ar=rets(series[a]),br=rets(series[b]);if(Math.min(ar.length,br.length)<24)continue;
  const c24=corr(ar.slice(-24),br.slice(-24)),c6=corr(ar.slice(-6),br.slice(-6)),a4=series[a].length>4?ret(series[a].at(-5)!.price,series[a].at(-1)!.price):0,b4=series[b].length>4?ret(series[b].at(-5)!.price,series[b].at(-1)!.price):0,spread=a4-b4;
  if(Math.abs(c24)>=.6&&Math.abs(c6-c24)>=.6)hits.push({family:"CORRELATION_BREAKDOWN",leader:a,follower:b,windowHours:6,score:Math.abs(c6-c24),features:{corr24:c24,corr6:c6}});
  if(Math.abs(spread)>=.02)hits.push({family:"RELATIVE_STRENGTH_DIVERGENCE",leader:spread>0?a:b,follower:spread>0?b:a,windowHours:4,score:Math.abs(spread)*100,features:{a4,b4,spread}});
  const lastA=ar.at(-1)!,lastB=br.at(-1)!;if(Math.abs(lastA)>=.005&&Math.abs(lastB)<=Math.abs(lastA)*.75)hits.push({family:"LEAD_LAG_UNDERREACTION",leader:a,follower:b,direction:lastA>0?"UP":"DOWN",windowHours:1,score:Math.abs(lastA-lastB)*100,features:{leaderReturn:lastA,followerReturn:lastB,responseRatio:Math.abs(lastB)/Math.abs(lastA)}});
  if(Math.abs(lastB)>=.005&&Math.abs(lastA)<=Math.abs(lastB)*.75)hits.push({family:"LEAD_LAG_UNDERREACTION",leader:b,follower:a,direction:lastB>0?"UP":"DOWN",windowHours:1,score:Math.abs(lastB-lastA)*100,features:{leaderReturn:lastB,followerReturn:lastA,responseRatio:Math.abs(lastA)/Math.abs(lastB)}});
 }
 return hits.sort((a,b)=>b.score-a.score);
}
export const DISCOVERY_FAMILIES=["LEAD_LAG_UNDERREACTION","RETURN_OUTLIER","VOLATILITY_EXPANSION","VOLATILITY_COMPRESSION","SHORT_MOMENTUM","MOMENTUM_REVERSAL","CORRELATION_BREAKDOWN","RELATIVE_STRENGTH_DIVERGENCE"] as const;
