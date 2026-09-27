import {scanLeadLag,type PricePoint,type Anomaly} from "../discovery/anomalyScanner.js";
export type SeriesMap=Record<string,PricePoint[]>;
export function relationshipMatrix(series:SeriesMap):Anomaly[]{
 const assets=Object.keys(series).sort(),hits:Anomaly[]=[];
 for(const leader of assets)for(const follower of assets){
  if(leader===follower)continue;
  hits.push(...scanLeadLag(leader,follower,series[leader],series[follower]));
 }
 return hits.sort((a,b)=>b.score-a.score);
}
