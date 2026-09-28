export type VolumePoint={ts:string;price:number;volume:number};export type VolumeHit={family:string;asset:string;direction?:string;score:number;features:Record<string,number>};
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,sd=(a:number[])=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):0},ret=(a:number,b:number)=>a?b/a-1:0;
export function scanVolume(s:Record<string,VolumePoint[]>):VolumeHit[]{const out:VolumeHit[]=[];for(const[asset,x]of Object.entries(s)){if(x.length<25)continue;const cur=x.at(-1)!,prior=x.slice(-25,-1),vm=mean(prior.map(z=>z.volume)),vs=sd(prior.map(z=>z.volume)),vz=vs?(cur.volume-vm)/vs:0,r1=ret(x.at(-2)!.price,cur.price),r4=ret(x.at(-5)!.price,cur.price),v4=mean(x.slice(-4).map(z=>z.volume)),pv4=mean(x.slice(-8,-4).map(z=>z.volume)),vr=pv4?v4/pv4:1;
 if(vz>=2)out.push({family:"VOLUME_SPIKE",asset,score:vz,features:{volumeZ:vz,r1}});
 if(Math.abs(r4)>=.015&&vr>=1.5)out.push({family:"MOMENTUM_VOLUME_CONFIRMATION",asset,direction:r4>0?"UP":"DOWN",score:Math.abs(r4)*vr*100,features:{r4,volumeRatio:vr}});
 if(Math.abs(r4)>=.015&&vr<=.7)out.push({family:"MOMENTUM_VOLUME_DIVERGENCE",asset,direction:r4>0?"UP":"DOWN",score:Math.abs(r4)/Math.max(vr,.01)*100,features:{r4,volumeRatio:vr}});
 if(Math.abs(r1)<.003&&vz>=2)out.push({family:"VOLUME_PRECEDES_PRICE",asset,score:vz,features:{volumeZ:vz,r1}});
 }return out.sort((a,b)=>b.score-a.score)}
