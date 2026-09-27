export type TestSummary={sampleSize:number;returns:number[];costBps:number;parameterNeighbors?:number[]};
export type AdversarialVerdict={verdict:"PASS"|"FAIL"|"INCONCLUSIVE";reasons:string[];metrics:Record<string,number|null>};
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=(a:number[])=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
export function adversarialReview(t:TestSummary):AdversarialVerdict{
 const reasons:string[]=[];const n=t.sampleSize,r=t.returns,mu=mean(r),med=median(r);
 const net=mu==null?null:mu-(t.costBps/10000);
 const sorted=[...r].sort((a,b)=>b-a),top=Math.max(1,Math.floor(r.length*.1));
 const trimmed=sorted.length>top?mean(sorted.slice(top)):null;
 const win=r.length?r.filter(x=>x>0).length/r.length:null;
 if(n<30) reasons.push("insufficient_sample");
 if(net==null||net<=0) reasons.push("nonpositive_after_costs");
 if(med!=null&&med<=0) reasons.push("nonpositive_median");
 if(trimmed!=null&&trimmed<=0) reasons.push("outlier_dependence");
 if(t.parameterNeighbors?.length&&t.parameterNeighbors.filter(x=>x>0).length/t.parameterNeighbors.length<.6) reasons.push("parameter_fragility");
 const hard=reasons.some(x=>["nonpositive_after_costs","outlier_dependence","parameter_fragility"].includes(x));
 const verdict=n<30?"INCONCLUSIVE":hard?"FAIL":"PASS";
 return {verdict,reasons,metrics:{sampleSize:n,mean:mu,median:med,netMeanAfterCosts:net,trimmedMeanWithoutTop10Pct:trimmed,winRate:win}};
}
