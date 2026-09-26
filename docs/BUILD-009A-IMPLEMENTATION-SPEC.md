# Build 009A — Queue Truthfulness Implementation Spec

## Objective

Make every queue row mean exactly one thing: the referenced authoritative BTC sensor observation was processed using only information available at that observation's timestamp.

No live trading authority is added. `authorizedToTrade=false` remains mandatory.

## Defects to correct

1. The worker claims a queue item but fetches a new live BTC price instead of loading `research_queue.observation_id`.
2. BTC feature history is lower-bounded but not upper-bounded by the evaluated timestamp.
3. XRP research can pair a historical BTC item with a newly fetched XRP price.
4. Candidate scoring uses `Date.now()` and the current worker price even during historical replay.
5. Queue claiming is select-then-update without a compare-and-set condition.

## Required worker semantics

For a claimed queue item:

1. Select the oldest `PENDING` queue row.
2. Claim it with an update constrained by both `id=<row>` and `status='PENDING'`.
3. Require the update to return the row; if it returns nothing, another worker won the claim.
4. Load the referenced `market_observations` row.
5. Validate:
   - agent = `btc_sensor_v1`
   - asset = `BTC`
   - observation_type = `SPOT_PRICE`
   - finite positive `price_usd`
   - non-null `observed_at`
6. Construct the BTC input from that stored row. Do not fetch a replacement BTC price.
7. Run BTC memory/features using that observation timestamp as the as-of boundary.
8. Process candidates only when `created_at <= asOf`.
9. Score outcomes only against candidates that existed by `asOf`; store `measured_at=asOf`.
10. Mark the queue row `SUCCESS` only after the full bounded cycle succeeds.

When no queue item exists, a manual/ad-hoc worker run may fetch live BTC and clearly record `inputMode=LIVE_FALLBACK`.

## Point-in-time query rule

Every historical query used by a replayed observation must include:

```
observed_at >= windowStart
observed_at <= asOf
```

The same rule applies to candidate creation time and outcome measurement time.

## Cross-asset rule

XRP-004 must not use a newly fetched XRP price for a historical BTC queue item.

V1 safe behavior:
- if queued BTC observation age <= 20 minutes, live XRP may be evaluated and its own timestamp recorded;
- otherwise XRP-004 is explicitly skipped with reason `STALE_QUEUED_OBSERVATION_NO_CONTEMPORANEOUS_XRP`.

Future preferred behavior: add an authoritative XRP sensor and select the closest XRP observation at-or-before the BTC as-of timestamp with a maximum allowed skew.

## Queue claim compare-and-set

The claim update must include `.eq("status","PENDING")` and return the claimed row. This makes overlapping workers single-owner at the row level without adding destructive database primitives.

## Acceptance tests

1. **Replay identity** — queue observation ID equals the observation ID reported as worker input.
2. **No future leakage** — insert a later BTC price; replay an older item; features are unchanged by the later row.
3. **Concurrent claim** — two workers target one PENDING row; exactly one obtains the claim.
4. **Historical candidate scope** — a candidate created after `asOf` is not prosecuted/qualified.
5. **Historical outcome scope** — measured time equals `asOf`, never wall-clock replay time.
6. **XRP skew** — a delayed queue item does not create an XRP comparison using current XRP.
7. **Capital firewall** — every result continues to report `authorizedToTrade=false`.

## Deployment gate

Do not promote Build 009A to main until all seven tests pass and Command Center can show backlog/stale/failure state.
