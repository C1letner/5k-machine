// Build 044: immutable chronological research split. Discovery MUST NOT read holdout.
// Holdout fraction is the final 30% of the configured research window.
export const HOLDOUT_FRACTION=.30;
export function splitBounds(startMs:number,endMs:number){const cut=startMs+(endMs-startMs)*(1-HOLDOUT_FRACTION);return{discoveryStartMs:startMs,discoveryEndMs:cut,holdoutStartMs:cut,holdoutEndMs:endMs}}
