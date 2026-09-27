import assert from "node:assert/strict";import {scanDiscoveryLibrary} from "../src/discovery/discoveryLibrary.js";
const mk=(k:number,j:number)=>Array.from({length:40},(_,i)=>({ts:new Date(1700000000000+i*3600000).toISOString(),price:100+i*k+(i===39?j:0)}));
const hits=scanDiscoveryLibrary({BTC:mk(.02,5),ETH:mk(.02,.2),SOL:mk(.01,-3),XRP:mk(.015,.1)});assert.ok(hits.length>0);assert.ok(new Set(hits.map(h=>h.family)).size>=2);console.log("Live discovery integration fixture produced",hits.length,"hits across",new Set(hits.map(h=>h.family)).size,"families");
