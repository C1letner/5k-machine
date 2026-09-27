import assert from "node:assert/strict";import {relationshipMatrix} from "../src/discovery/relationshipMatrix.js";
const mk=(xs:number[])=>xs.map((price,i)=>({ts:new Date(1700000000000+i*3600000).toISOString(),price}));
const base=Array.from({length:26},(_,i)=>100+i*.05);
const m=relationshipMatrix({BTC:mk([...base,103]),XRP:mk([...base,100.9]),ETH:mk([...base,102.8])});
assert.ok(m.some(x=>x.leader==="BTC"&&x.follower==="XRP"));assert.ok(!m.some(x=>x.leader===x.follower));console.log("Relationship Matrix tests passed");
