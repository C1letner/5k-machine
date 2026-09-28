# Build 035 — Volume Sensor

The laboratory now has a second market dimension: hourly base-asset trading volume from Coinbase Exchange candles.

Historical volume is stored separately from price observations to preserve provenance.

Initial volume discovery families:
1. VOLUME_SPIKE — current hourly volume >= 2 standard deviations above trailing 24h.
2. MOMENTUM_VOLUME_CONFIRMATION — meaningful 4h price momentum with >=1.5x recent volume expansion.
3. MOMENTUM_VOLUME_DIVERGENCE — meaningful 4h price momentum while recent volume contracts <=0.7x.
4. VOLUME_PRECEDES_PRICE — abnormal volume while 1h price remains relatively quiet.

These are discovery questions, not signals. They require the same scientific funnel, multiple-testing control, execution-cost analysis, holdout and forward validation before CIO consideration.

Volume source is exchange-specific. Coinbase volume must not be represented as total crypto-market volume.
