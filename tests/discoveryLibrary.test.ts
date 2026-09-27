import assert from "node:assert/strict";import {DISCOVERY_FAMILIES,scanDiscoveryLibrary} from "../src/discovery/discoveryLibrary.js";
const mk=(k:number,jump=0)=>Array.from({length:30},(_,i)=>({ts:new Date(1700000000000+i*3600000).toISOString(),price:100+i*k+(i===29?jump:0)}));
assert.ok(DISCOVERY_FAMILIES.length>=8);const h=scanDiscoveryLibrary({A:mk(.03,4),B:mk(.03,.2),C:mk(.01,-3)});assert.ok(h.length>0);assert.ok(h.some(x=>x.family==="LEAD_LAG_UNDERREACTION"||x.family==="RETURN_OUTLIER"));console.log("Discovery Library tests passed",DISCOVERY_FAMILIES.length,h.length);
