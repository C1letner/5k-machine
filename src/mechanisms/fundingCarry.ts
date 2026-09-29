// Build 045 — mechanism research: hedged funding carry.
// Research-only pure functions. No exchange access, orders or capital authority.
export type FundingObs={t:number;funding:number;spot:number;perp:number};
export type CarryTrade={entry:number;exit:number;grossFunding:number;basisMove:number;net:number};
export type CarryOptions={entryFunding:number;holdPeriods:number;roundTripCostBps:number};
export const DEFAULT_CARRY:CarryOptions={entryFunding:.0001,holdPeriods:3,roundTripCostBps:20};
export function fundingCarry(obs:FundingObs[],opt:Partial<CarryOptions>={}):CarryTrade[]{const o={...DEFAULT_CARRY,...opt},out:CarryTrade[]=[];for(let i=0;i+o.holdPeriods<obs.length;){const x=obs[i];if(!Number.isFinite(x.funding)||x.funding<o.entryFunding){i++;continue}const j=i+o.holdPeriods,y=obs[j];let funding=0;for(let k=i;k<j;k++)funding+=obs[k].funding;const basis0=x.perp/x.spot-1,basis1=y.perp/y.spot-1,basisMove=basis0-basis1;out.push({entry:x.t,exit:y.t,grossFunding:funding,basisMove,net:funding+basisMove-o.roundTripCostBps/10000});i=j}return out}
