# Build 038 — Derivatives Market Sensor

Adds durable schema and discovery logic for funding rate, open interest and perpetual/futures basis.

Discovery families:
- FUNDING_EXTREME
- OPEN_INTEREST_SHOCK
- BASIS_DISLOCATION
- LEVERAGE_BUILDS_BEFORE_PRICE
- PRICE_OI_DIVERGENCE

The live adapter is deliberately fail-closed. No venue is assumed and no synthetic derivatives data is generated. A verified API/data source must be selected before ingestion is enabled.

This is necessary because derivatives product availability, instrument identifiers, funding conventions, open-interest units and jurisdiction/account access differ by venue.

No trading authority.
