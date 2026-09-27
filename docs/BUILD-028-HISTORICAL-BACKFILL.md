# Build 028 — Historical Data Backfill

Purpose: remove the Discovery Laboratory cold-start problem without contaminating prospective validation.

Backfill source: Coinbase Exchange public hourly candles.
Initial window: 180 days.
Universe: BTC, ETH, XRP, SOL, ADA, DOGE, AVAX, LINK.
Stored close price is tagged sensor_version=HIST-028 and source=coinbase_exchange_candles.

The backfill workflow is manual, not recurring.

Critical scientific boundary:
Historical backfill may be used for discovery, adversarial testing and chronological holdout work. It must never be counted as prospective forward evidence. Forward signals/outcomes remain timestamped after a hypothesis enters FORWARD_VALIDATION.

Chunks are deliberately kept below exchange candle limits and requests are throttled.
