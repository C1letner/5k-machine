# Command Center Reliability V1

The next Command Center revision should make unattended-operation health visible without requiring database inspection.

## Required metrics

- latest BTC sensor timestamp and age
- research queue counts by PENDING / CLAIMED / SUCCESS / FAILURE
- stale CLAIMED count using a 20-minute threshold
- completed queue items in the last 24 hours
- failed queue items in the last 24 hours
- oldest uncompleted queue item age
- latest worker completion time
- current backlog count

## Health states

GREEN:
- latest sensor age <= 70 minutes
- no stale claim
- no failed queue item awaiting attention
- backlog <= 1

YELLOW:
- latest sensor age > 70 and <= 90 minutes, or backlog > 1

RED:
- latest sensor age > 90 minutes
- any stale CLAIMED item
- any terminal FAILURE item

## Display principle

Reliability status must describe facts, not optimism. A successful latest run does not override an existing backlog or stale work item.

## Current evidence

The Supabase sensor has continued to produce observations during GitHub Actions scheduling delays, so queue health needs to be a first-class dashboard signal.
