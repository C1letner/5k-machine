# Build 039 — Derivatives Instrument Registry + Historical Backfill

Canonical research contracts:
ADA_USDC-PERPETUAL
AVAX_USDC-PERPETUAL
BTC_USDC-PERPETUAL
DOGE_USDC-PERPETUAL
ETH_USDC-PERPETUAL
LINK_USDC-PERPETUAL
SOL_USDC-PERPETUAL
XRP_USDC-PERPETUAL

Exact registry mapping eliminates substring collisions such as ETHFI->ETH and RESOLV->SOL and prevents mixing multiple BTC/ETH contract families.

Live sensor now reads only canonical registry instruments.

Historical backfill attempts only the verified Coinbase funding-history public method. Historical open interest remains explicitly disabled until a verified historical OI endpoint/data source is established. No synthetic OI is permitted.
