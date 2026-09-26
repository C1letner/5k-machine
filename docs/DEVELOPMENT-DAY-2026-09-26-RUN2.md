# Development Day 2026-09-26 — Run 2

## Executive result

The second audit found a foundational reliability defect in Build 008: the queue currently acts as a wake/accounting mechanism rather than as the authoritative input to the research worker.

No capital authority changed. Main was not modified. The branch remains documentation-only.

## Reliability audit

Repository main remains at commit `235d503f02c70e5975125f24643d0f9433d8dff8`.

The workflow contains two hourly cron entries at minute 08 and minute 28.

Observed successful scheduled workflow starts after Build 008:
- 2026-09-26 08:44:45Z
- 2026-09-26 09:17:34Z
- 2026-09-26 13:47:57Z
- 2026-09-26 14:21:32Z

At the time of this audit there was no later scheduled run in GitHub Actions. The scheduling layer is therefore too irregular to be treated as the authoritative clock.

The 13:47 and 14:21 runs both completed successfully, produced no new candidate, and kept the capital-control flag disabled.

## Queue-semantic finding

Current worker behavior:
1. Select the oldest PENDING queue row.
2. Mark it CLAIMED.
3. Fetch a new live BTC observation.
4. Perform the research cycle using the newly fetched observation.
5. Mark the previously selected queue row SUCCESS.

The worker does not load and evaluate the sensor observation referenced by the queue item's `observation_id`.

Consequence: during backlog, a queue item may be marked complete even though that historical sensor observation was never actually evaluated.

## Point-in-time integrity finding

The BTC feature builder constrains the beginning of its history window but does not constrain the end of the window to the observation being evaluated.

Before historical replay is enabled, all feature queries must enforce an upper timestamp boundary so newer observations cannot influence older work.

The XRP research path also needs temporal alignment. A historical BTC work item must not be paired with a newly fetched XRP observation.

## Concurrency finding

Queue claiming currently performs a select followed by an update. It does not condition the update on the row still being PENDING. Two overlapping workers could theoretically claim the same work item.

## Required implementation order

1. Make the queued sensor observation the authoritative worker input.
2. Enforce point-in-time upper bounds on historical feature queries.
3. Make queue claiming single-owner / compare-and-set.
4. Add bounded stale-claim recovery.
5. Make cross-asset research use contemporaneous stored data or explicitly skip when unavailable.
6. Surface queue backlog, stale work and failures in Command Center.
7. Activate descriptive regime classification only after those controls pass tests.
8. Add World Intelligence as an independent evidence stream after ingestion reliability is demonstrated.

## Work completed this pass

- Verified the scheduler gap against current GitHub Actions history.
- Inspected the current worker, BTC Hunter, XRP research path, pipeline and Command Center code.
- Identified queue semantics, point-in-time integrity and concurrency defects.
- Preserved the branch-only development approach and left main unchanged.

## Tooling blocker

The connected GitHub safety layer blocked executable runtime changes during this pass. The block was respected and no alternate write path was used to circumvent it.

## Recommended next action

Treat queue correctness as Build 009A and Command Center observability as Build 009B. Do not expand research logic until every queued observation can be proven to be processed exactly once using only information available at that observation's timestamp.
