# World Intelligence V1

## Objective

Build a source-grounded information-ingestion layer that records material external events in an auditable, point-in-time-safe way.

World Intelligence is evidence infrastructure. V1 is descriptive only and does not change qualification, position sizing, capital allocation, or trading authority.

## Source tiers

- Tier A: primary and official publications
- Tier B: reputable reporting
- Tier C: open-web and community sources for discovery only

V1 should begin with Tier A only.

## Normalized record

Each item should preserve:

- source name
- source tier
- source-native identifier when available
- title
- canonical URL
- published_at
- first_seen_at
- last_fetched_at
- content hash
- normalized text hash
- entities
- themes
- factual summary
- duplicate fingerprint
- verification state
- contradiction links
- materiality score
- confidence score
- supersedes / superseded_by revision links

## Point-in-time integrity

Historical research must only use information that was actually available at the requested time.

Required rule:

`first_seen_at <= asOf`

`published_at` alone is not sufficient because an upstream publisher can back-date, correct, or silently edit a page after publication.

When source content changes:

1. never overwrite the prior normalized record;
2. append a new revision with a new content hash and first_seen_at;
3. link the revision chain;
4. preserve the prior version for replay;
5. let an as-of query select the latest revision whose first_seen_at is not later than asOf.

## Canonicalization and deduplication

Canonical URL handling should:

- lowercase the hostname;
- remove URL fragments;
- remove known tracking parameters;
- normalize default ports;
- preserve path/query parameters that identify the actual source document.

Duplicate fingerprints should not rely on URL alone. Use a stable fingerprint derived from source identity plus normalized title/text or a source-native ID.

A new content hash at the same canonical URL is a revision, not an in-place mutation.

## Processing pipeline

Source adapter
-> fetch
-> normalize
-> canonicalize
-> hash
-> deduplicate / revision check
-> entity and theme tagging
-> source-tier weighting
-> materiality screen
-> contradiction check
-> link to internal research
-> append audit record.

## Initial themes

- monetary policy
- economic releases
- regulation
- service outages
- security incidents
- major organization events
- geopolitical escalation
- energy conditions
- liquidity
- credit stress

## Initial Tier-A source spine

The first adapters should target official publication surfaces with stable machine-readable or consistently structured outputs:

- Federal Reserve releases / monetary policy feeds
- SEC releases and EDGAR-related feeds
- Bureau of Labor Statistics release calendar and releases

Treasury and CISA can follow once the ingestion contract is proven.

## Reliability requirements

Source failures must be visible and independently distinguishable from "no new items."

Track per adapter:

- last attempted fetch
- last successful fetch
- last new item seen
- consecutive failures
- HTTP / parser failure category
- item count
- revision count

Corrections append new records rather than silently rewriting history. Primary evidence should be preferred where available.

## Validation gates

Before World Intelligence may feed any research context:

1. same raw item fetched twice -> one logical record;
2. same URL with changed content -> append revision, never overwrite;
3. tracking-parameter variants -> same canonical identity;
4. an item first seen after asOf -> excluded from replay;
5. source timeout / parser failure -> visible health failure, not "zero news";
6. conflicting primary-source records -> both retained and contradiction flagged;
7. every normalized record can be traced back to the source URL and content hash.

## Activation plan

1. implement normalization and append-only revision semantics with fixtures only;
2. validate canonicalization, deduplication, and as-of replay;
3. connect one Tier-A source adapter;
4. expose adapter health in Command Center;
5. add remaining Tier-A adapters;
6. only then add reputable reporting for discovery and context.

No World Intelligence component may modify `authorizedToTrade=false`.
