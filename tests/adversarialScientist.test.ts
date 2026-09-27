import assert from "node:assert/strict";import {adversarialReview} from "../src/discovery/adversarialScientist.js";
const robust=Array.from({length:40},(_,i)=>i%3===0?-.002:.004);assert.equal(adversarialReview({sampleSize:40,returns:robust,costBps:10,parameterNeighbors:[.1,.2,.1,.05]}).verdict,"PASS");
const thin=[...Array(29).fill(-.001),.2];assert.notEqual(adversarialReview({sampleSize:30,returns:thin,costBps:10}).verdict,"PASS");
assert.equal(adversarialReview({sampleSize:8,returns:Array(8).fill(.01),costBps:10}).verdict,"INCONCLUSIVE");
console.log("Adversarial Scientist tests passed");
