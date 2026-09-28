# Build 037 — Price × Volume Scientific Integration

The generalized Discovery Tester and Adversarial Scientist now reconstruct the four Build 035/036 volume families from synchronized historical price and Coinbase volume.

Supported:
- VOLUME_SPIKE
- MOMENTUM_VOLUME_CONFIRMATION
- MOMENTUM_VOLUME_DIVERGENCE
- VOLUME_PRECEDES_PRICE

Triggers are defined once in volumeLibrary and reused by mining, testing and prosecution to reduce definition drift.

The same gates remain mandatory: minimum event count, FDR, costs, median/outlier review, holdout and forward validation. No trading authority is created.
