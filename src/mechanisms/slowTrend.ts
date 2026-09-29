// Build 045 — mechanism research: slow volatility-scaled trend.
// Daily horizon intentionally avoids competing on hourly reaction speed.
export type Daily={t:number;p:number};export type TrendTrade={t:number;direction:number;raw:number;scaled:number};
export type TrendOptions={lookbackDays:number;volDays:number;targetDailyVol:number;maxLeverage:number};
export const DEFAULT_TREND:TrendOptions={lookbackDays:90,volDays:30,targetDailyVol:.01,maxLeverage:1};
const r=(a:number,b:number)=>b/a-1,sd=(a:number[])=>{if(a.length<2)return 0;const m=a.reduce((s,x)=>s+x,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
export function volScaledTrend(x:Daily[],opt:Partial<TrendOptions>={}):TrendTrade[]{const o={...DEFAULT_TREND,...opt},out:TrendTrade[]=[];for(let i=Math.max(o.lookbackDays,o.volDays)+1;i+1<x.length;i++){const mom=r(x[i-o.lookbackDays].p,x[i].p),dir=mom>=0?1:-1,rets=[];for(let k=i-o.volDays+1;k<=i;k++)rets.push(r(x[k-1].p,x[k].p));const v=sd(rets),lev=v?Math.min(o.maxLeverage,o.targetDailyVol/v):0;const next=r(x[i].p,x[i+1].p);out.push({t:x[i].t,direction:dir,raw:next*dir,scaled:next*dir*lev})}return out}
