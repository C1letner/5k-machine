# Build 026 — Discovery Expansion

The CRO discovery library now scans multiple anomaly families rather than only BTC/XRP-style lead-lag.

V1 families:
1. Lead/lag underreaction
2. Return outliers
3. Volatility expansion
4. Volatility compression
5. Short-horizon momentum
6. Momentum reversal
7. Correlation breakdown
8. Relative-strength divergence

Across the initial 8-asset universe this creates single-asset and pairwise questions on every synchronized observation window.

Design principle: scan broadly, promote narrowly. A discovery hit is only a question. It receives zero capital authority and must still pass Hypothesis Factory, discovery test, adversarial review, holdout replication and forward validation.

Future library families should include volume, liquidity/order-book, funding/basis, open interest, liquidation, cross-venue, on-chain, macro/event and news-response anomalies as data becomes available.
