# Build 018 — Forward Validation Lab

Historical survivors that pass holdout replication become immutable prospective experiments.

At :52 hourly the lab:
1. creates an ACTIVE forward experiment for each FORWARD_VALIDATION hypothesis,
2. records only future trigger occurrences,
3. freezes reference price, direction, horizon, cost assumption and trigger context,
4. scores the realized outcome only after the predetermined horizon,
5. waits for at least 25 completed occurrences before a decision.

Initial forward gate: positive mean net return after 50 bps assumed round-trip costs and >=40% positive outcomes. This is a research gate, not a capital-allocation rule.

PASS -> FORWARD_SURVIVOR
FAIL -> REJECTED

No forward survivor receives trading authority automatically. authorizedToTrade remains false.
