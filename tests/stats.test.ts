import assert from "node:assert/strict";
import { bhQValues, winRatePValueOneSided, winRatePValueTwoSided } from "../src/science/stats.js";

// A hypothesis that loses 70% of the time over 200 events must not look significant.
assert.ok(winRatePValueOneSided(0.3, 200) > 0.99, "losing win rate must not be significant");
assert.ok(winRatePValueTwoSided(0.3, 200) < 0.001, "old two-sided rule wrongly calls it significant");

// Evidence in the predicted direction still counts.
assert.ok(winRatePValueOneSided(0.6, 400) < 0.001);
assert.ok(Math.abs(winRatePValueOneSided(0.5, 100) - 0.5) < 1e-6);
assert.equal(winRatePValueOneSided(0.9, 1), 1);

// BH q-values match the existing FDR test expectations and keep input order.
const q = bhQValues([0.2, 0.001, 0.04, 0.01]);
assert.ok(q[1] <= q[3] && q[3] <= 0.1 && q[0] > 0.1);
console.log("Build 041 stats tests passed", q);
