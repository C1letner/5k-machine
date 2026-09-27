# Build 017 — Replication + Holdout Lab

Historical survivors are tested against a chronologically later 30% holdout segment.

The holdout applies a 50 bps round-trip cost assumption and requires enough qualifying events before making a decision.

PASS -> FORWARD_VALIDATION
FAIL -> REJECTED
INCONCLUSIVE -> remains HISTORICAL_SURVIVOR until evidence accumulates

The defining hypothesis remains frozen throughout replication. No parameter tuning is allowed against the holdout.

Schedule: :42 hourly, after discovery (:12), initial test (:22), and adversarial science (:32).

Forward validation is the next scientific stage. No live trading authority is created.
