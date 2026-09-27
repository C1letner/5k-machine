# Build 029 — Generalized Hypothesis Tester

The Discovery Tester now supports all Build 026 anomaly families, including single-asset and pairwise hypotheses.

Single-asset:
- SHORT_MOMENTUM
- MOMENTUM_REVERSAL
- RETURN_OUTLIER
- VOLATILITY_EXPANSION
- VOLATILITY_COMPRESSION

Pairwise:
- LEAD_LAG_UNDERREACTION
- RELATIVE_STRENGTH_DIVERGENCE
- CORRELATION_BREAKDOWN

Every proposal is evaluated across 1h, 4h, 8h, 12h and 24h horizons over the 180-day research window. A discovery-stage PASS requires at least 30 historical trigger occurrences and positive mean directional return at a qualifying horizon.

This is intentionally a permissive discovery screen. Costs, outlier dependence, median behavior, robustness, holdout and forward evidence remain later gates.

No discovery result grants capital authority.
