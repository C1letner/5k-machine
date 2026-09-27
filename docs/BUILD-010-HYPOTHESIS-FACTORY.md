# Build 010 — Hypothesis Factory

Purpose: turn observations/anomalies into immutable, falsifiable scientific claims before testing.

A hypothesis must define:
- generator/version and market/instruments
- observation window
- explicit trigger
- predicted effect and horizon
- falsification criteria
- required data

A deterministic SHA-256 hypothesis key prevents silent parameter mutation from masquerading as the same experiment.

Lifecycle:
PROPOSED -> TESTING -> REJECTED or HISTORICAL_SURVIVOR -> FORWARD_VALIDATION -> FORWARD_SURVIVOR -> RETIRED.

Historical survival is never sufficient for capital authority. Forward validation remains mandatory.

The factory is intentionally market-agnostic. Crypto is the first laboratory, not a permanent architectural constraint.
