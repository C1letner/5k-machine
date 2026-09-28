# Build 036 — Price × Volume Walk-Forward Miner

Joins HIST-028 hourly price with VOL035 Coinbase hourly base volume on exact asset/timestamp.

Walks chronologically with no future data and records:
- VOLUME_SPIKE
- MOMENTUM_VOLUME_CONFIRMATION
- MOMENTUM_VOLUME_DIVERGENCE
- VOLUME_PRECEDES_PRICE

Recurring configurations with >=30 historical occurrences are promoted into the Hypothesis Factory and explicitly require multiple-testing correction, costs, holdout and forward validation.

Coinbase volume is venue-specific participation evidence, not global crypto volume.
