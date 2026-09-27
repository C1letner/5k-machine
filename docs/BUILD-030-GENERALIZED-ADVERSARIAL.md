# Build 030 — Generalized Adversarial Scientist / Build 016 Repair

Build 030 replaces the pairwise-only assumption in Build 016.

Adversarial review now accepts every current Discovery Library family, including single-asset momentum, reversal, return-outlier and volatility hypotheses plus pairwise lead-lag, relative-strength and correlation-breakdown hypotheses.

The adversarial gate applies 50 bps round-trip cost friction and evaluates sample sufficiency, mean/median behavior and outlier dependence through the existing Adversarial Scientist.

PASS -> HISTORICAL_SURVIVOR
FAIL -> REJECTED
INCONCLUSIVE -> TESTING

AVAX SHORT_MOMENTUM is the first live regression fixture expected to demonstrate that a discovery-stage PASS can still fail after realistic friction.

This explicitly repairs Build 016 rather than adding a parallel workaround.
