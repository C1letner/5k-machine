# Regime V1 Temporal Validation

The descriptive regime classifier is intentionally advisory only. Before integration, it must also prove that its time-window labels are based on observations close enough to the requested horizons.

## Finding

The current implementation chooses the nearest observation at-or-before the 1h, 4h, and 24h target. If observations are sparse, that point can be much older than the target and the resulting change can be mislabeled as a 1h, 4h, or 24h move.

The current volatility baseline also uses adjacent observations without checking the elapsed time between them, so irregularly spaced observations are not necessarily comparable hourly moves.

## Required fail-closed behavior

- Each horizon lookup must enforce a maximum timestamp skew around its target.
- If no observation satisfies the skew limit, that horizon return is null.
- A shock label requires a valid recent 1h return.
- A trend label requires valid 4h and 24h returns.
- The volatility baseline must either use roughly hourly pairs or normalize moves by elapsed time.
- Sparse or stale history should resolve to RANGE or INSUFFICIENT_DATA rather than manufacturing a stronger label.

## Acceptance cases

1. Hourly flat data -> RANGE.
2. Hourly smooth positive trend -> TREND_UP.
3. Hourly smooth negative trend -> TREND_DOWN.
4. Recent single-hour jump -> SHOCK_UP / SHOCK_DOWN.
5. Less than 25 valid observations -> INSUFFICIENT_DATA.
6. Latest point separated by a multi-hour gap -> no 1h shock classification.
7. No point close to the 24h horizon -> no trend classification.
8. Irregular multi-hour spacing -> volatility baseline is not treated as raw hourly movement.

No classification produced by this module changes capital authority or executes any transaction.
