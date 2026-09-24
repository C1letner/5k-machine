# Build 001

## Objective

Prove the machine can:

1. read a live BTC spot price,
2. write an immutable timestamped observation,
3. preserve a deterministic $5,000 shadow cash ledger,
4. keep the Crypto Hunter unable to move capital.

## Success criteria

A worker run returns:

- a valid BTC/USD price,
- a persisted observation ID,
- shadow cash of exactly $5,000,
- `authorizedToTrade: false`.

## Explicitly out of scope

- trade execution
- allocation
- qualification scoring
- autonomous candidate promotion
- leverage
- shorting
- real money
- exchange API keys with trading privileges

## Next build

Build 002 adds BTC history/features and a deterministic trigger engine so Crypto Hunter can create its first timestamped candidate from evidence rather than a single price tick.
