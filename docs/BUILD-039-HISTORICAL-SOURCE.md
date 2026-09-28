# Build 039 — Historical Derivatives Source

Hobbyist-compatible design uses 4-hour resolution, matching the plan's 180-day historical range shown by CoinGlass pricing.

Historical provider:
- aggregated futures open interest
- OI-weighted funding rate

Research assets: BTC, ETH, XRP, SOL, ADA, DOGE, AVAX, LINK.

Coinbase remains the live canonical derivatives sensor. CoinGlass history is stored with separate venue/source provenance and must not be represented as Coinbase history.

The adapter requires the GitHub Actions secret COINGLASS_API_KEY and fails closed when it is absent.

No trading authority.
