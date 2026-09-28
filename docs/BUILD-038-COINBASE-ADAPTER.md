# Build 038 Adapter — Coinbase Global Derivatives

Verified public source: Coinbase Global Derivatives JSON-RPC 2.0 public market-data gateway.

Host: https://drb.coinbase.com/api/v2

Official documentation lists public methods for:
- instruments,
- ticker,
- hourly funding-rate history,
- funding chart/value,
- 5-minute mark-price history,
- index prices,
- book summaries.

The live adapter discovers perpetual instruments rather than hard-coding identifiers, then records mark price, index price, funding rate, open interest when exposed by ticker, and computed mark/index basis.

No authentication is required for these public methods according to Coinbase documentation.

Historical open-interest availability has not yet been established, so the system must not manufacture historical OI. Historical research will be enabled only for fields that the verified public API actually supplies.
