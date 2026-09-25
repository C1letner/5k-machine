# Build 004 — Heartbeat Reliability

GitHub Actions scheduled workflows are best-effort and showed multi-hour gaps in the forward BTC dataset.

Build 004 moves raw BTC market-data capture into Supabase using pg_cron + pg_net:
- minute 02 each hour: request Coinbase BTC/USD spot
- minute 04: persist the completed response
- one btc_sensor_v1 observation maximum per hour

GitHub Actions remains useful for research/agent processing, but is no longer the authoritative hourly market-data clock.

No transaction permissions are added.
