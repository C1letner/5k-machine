# Development Day — Reliability Audit (2026-09-26)

## Executive finding

Build 008's durable queue is working, but the GitHub Actions scheduler is not providing hourly execution reliability.

The hourly Supabase BTC sensor continued producing observations while the reasoning worker experienced multi-hour scheduling gaps. The queue therefore protects work from being lost, but worker throughput can fall behind the sensor.

No evidence of capital movement was found in the inspected runs. Every inspected worker result reported `shadowCashUsd: 5000` and `authorizedToTrade: false`.

## Evidence inspected

Build 008 was committed at 2026-09-26 03:17:54Z.

Subsequent research workflow runs observed:

| Run | Trigger | Started (UTC) | Result |
|---|---|---|---|
| 13 | manual | 03:33:48 | success |
| 14 | scheduled | 08:44:45 | success |
| 15 | scheduled | 09:17:34 | success |
| 16 | scheduled | 13:47:57 | success |
| 17 | scheduled | 14:21:32 | success |

The workflow declares two hourly schedules (:08 and :28), but actual execution was materially delayed and irregular.

## Sensor vs worker evidence

At scheduled run 14 the worker reported 19 authoritative BTC sensor observations.

At scheduled run 17 it reported 25 authoritative BTC sensor observations.

That is six additional sensor observations while only four scheduled research runs completed across the same span. This is direct evidence that the sensor clock is more reliable than the GitHub reasoning clock and that queue backlog can grow during scheduler delays.

## Hunter activity sampled

No BTC candidate qualified in the inspected runs.

- Run 14: BTC +0.459% vs ~1h reference; rolling high observed; 24h trigger absent; no candidate.
- Run 15: BTC -0.142% vs ~1h reference; no trigger; no candidate.
- Run 16: BTC -0.280% vs ~1h reference; no trigger; no candidate.
- Run 17: BTC -0.127% vs ~1h reference; no trigger; no candidate.

XRP-004 produced no signal in all inspected runs.

The strongest sampled BTC impulse was run 14 at ~2.22x its recent hourly baseline, but the BTC move was only about +0.211% and the XRP response ratio was ~2.36, so the frozen XRP-004 rule correctly did not fire.

## Reliability priority

The next reliability change should make the worker queue-driven and idempotent:

1. Wake more frequently than hourly.
2. Exit immediately when no queue item exists.
3. Retry failed queue items with a bounded attempt count.
4. Recover stale CLAIMED items after a timeout.
5. Show pending / claimed / failed / stale counts in Command Center.
6. Keep `authorizedToTrade=false` and transaction permissions unchanged.

## Data-integrity issue identified

When processing a delayed queue item, BTC feature construction must not include sensor rows that occurred after the queued observation time. Historical feature queries should therefore be upper-bounded at the observation timestamp before backlog replay is enabled.

This is a point-in-time integrity requirement, not a trading enhancement.
