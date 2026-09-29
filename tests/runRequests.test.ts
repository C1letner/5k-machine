import assert from "node:assert/strict";
import { validate } from "../src/ops/runRequests.js";

assert.deepEqual(validate({ jobs: [{ job: "backfill-prices" }, { job: "calibrate" }] }), [{ job: "backfill-prices", days: 1095 }, { job: "calibrate" }]);
assert.deepEqual(validate({ jobs: [{ job: "backfill-volume", days: 730 }] }), [{ job: "backfill-volume", days: 730 }]);
assert.throws(() => validate({ jobs: [{ job: "rm -rf" }] }), /not allowed/);
assert.throws(() => validate({ jobs: [{ job: "backfill-prices", days: 99999 }] }), /days/);
assert.throws(() => validate({ jobs: [] }), /non-empty/);
assert.throws(() => validate({ jobs: [{ job: "enable-trading" }] }), /not allowed/);
console.log("Build 043 run-request validation tests passed");
