# World Intelligence V1

## Objective

Build a source-grounded information-ingestion layer that records material external events in an auditable way.

## Source tiers

- Tier A: primary and official publications
- Tier B: reputable reporting
- Tier C: open-web and community sources for discovery only

## Normalized record

Each item should preserve source, source tier, title, canonical URL, publication time, fetch time, entities, themes, factual summary, duplicate fingerprint, verification state, contradiction links, materiality score, and confidence score.

## Processing

Source adapters -> normalize -> deduplicate -> entity/theme tagging -> source-tier weighting -> materiality screen -> contradiction check -> link to internal research -> audit log.

## Initial themes

Monetary policy, economic releases, regulation, service outages, security incidents, major organization events, geopolitical escalation, energy conditions, liquidity, and credit stress.

## Reliability requirements

Source failures must be visible. Corrections append new records rather than silently rewriting history. Primary evidence should be preferred where available.

## Activation plan

Start with official sources only, validate ingestion and deduplication, then add reputable reporting for discovery and context.
