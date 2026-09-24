# Build 002 — Crypto Hunter Memory

Build 002 turns the heartbeat into a memory-bearing BTC observer.

Each run stores live BTC spot, reads up to eight days of prior spot observations, derives 1h/4h/24h/7d changes when history exists, derives rolling high/low context, and stores the resulting feature snapshot.

## First deterministic candidate rule
- Trigger: absolute 24h move >= 3%.
- Supporting structure: current price is at the observed rolling high or rolling low.
- Both are required.

During bootstrap, longer-horizon fields remain null until enough forward observations exist. We deliberately do not fabricate history.

Candidate signals remain observations only. Build 002 has no transaction, allocation, leverage, or trading authority.
