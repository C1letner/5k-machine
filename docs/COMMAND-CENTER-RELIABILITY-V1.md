# Command Center Reliability V1

The next Command Center revision should make unattended-operation health visible without requiring database inspection.

## Required metrics

- latest BTC sensor timestamp and age
- research queue counts by PENDING / CLAIMED / SUCCESS / FAILURE
- stale CLAIMED count using a 20-minute threshold
- completed queue items in the last 24 hours
- failed queue items in the last 24 hours
- oldest uncompleted queue item age
- latest worker completion time and age
- current backlog count
- runtime build identity from the latest completed worker run

## Health states

GREEN:
- latest sensor age <= 70 minutes
- no stale claim
- no terminal failure awaiting attention
- backlog <= 1
- oldest backlog item age <= 70 minutes
- latest worker age <= 90 minutes when worker history exists

YELLOW:
- latest sensor age > 70 and <= 90 minutes, or
- backlog > 1, or
- oldest backlog item age > 70 and <= 120 minutes, or
- latest worker age > 90 and <= 180 minutes, or
- backlog exists but there is no known successful worker history

RED:
- latest sensor age > 90 minutes or sensor timestamp is unavailable
- any stale CLAIMED item
- any terminal FAILURE item
- oldest backlog item age > 120 minutes
- latest worker age > 180 minutes

## Display principle

Reliability status must describe facts, not optimism. A successful latest run does not override an existing backlog, stale work item, or stale reasoning worker.

The dashboard must not infer health merely from historical data being present. In particular:
- BTC Sensor must not be labeled ONLINE solely because BTC rows exist.
- Crypto Hunter must not be hard-coded as SCANNING.
- build identity must come from the latest completed worker run rather than a hard-coded dashboard label.

## Current evidence

The Supabase sensor has continued to produce observations during GitHub Actions scheduling delays, so queue health and worker recency need to be first-class dashboard signals.

The pure classifier implementing these thresholds lives in `src/reliability.ts`. It is intentionally side-effect free.
