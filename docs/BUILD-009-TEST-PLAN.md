# Build 009 Test Plan

## Queue reliability

1. Empty queue: worker exits successfully without creating duplicate research work.
2. One pending item: worker claims exactly one item and marks it complete on success.
3. Transient failure: item is eligible for bounded retry.
4. Stale claim: a CLAIMED item older than the timeout is returned to recoverable state.
5. Retry ceiling: an item that reaches the maximum attempt count remains visibly failed.
6. Duplicate wakeups: repeated worker starts do not double-complete the same queue item.

## Point-in-time integrity

Create a fixed sequence of hourly BTC observations and evaluate an older queued observation after newer rows exist.

Expected result: feature calculation uses only rows at or before the queued observation timestamp.

## Dashboard health

Verify:

- GREEN with a fresh sensor, no stale claims, and backlog <= 1.
- YELLOW when backlog > 1 or sensor age is between 70 and 90 minutes.
- RED when sensor age exceeds 90 minutes, a claim is stale, or failed work is present.

## Scheduler-gap simulation

Create six hourly sensor observations while allowing only four worker wakes.

Expected result: the queue retains the unprocessed work and the dashboard reports the backlog rather than presenting the system as fully healthy.

## Regime component

Use frozen fixtures for BOOTSTRAP, RANGE, HIGH_VOLATILITY, TREND_UP, and TREND_DOWN boundary cases before enabling the component in the hourly pipeline.
