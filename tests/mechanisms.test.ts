import assert from"node:assert/strict";import{fundingCarry}from"../src/mechanisms/fundingCarry.js";import{volScaledTrend}from"../src/mechanisms/slowTrend.js";
const f=[0,1,2,3].map(i=>({t:i,funding:.001,spot:100,perp:101}));const c=fundingCarry(f,{entryFunding:.0001,holdPeriods:3,roundTripCostBps:0});assert.equal(c.length,1);assert.ok(c[0].net>.0029);
const d=Array.from({length:130},(_,i)=>({t:i,p:100+i}));const t=volScaledTrend(d);assert.ok(t.length>0);assert.ok(t.every(x=>x.direction===1));console.log("mechanism tests passed");
