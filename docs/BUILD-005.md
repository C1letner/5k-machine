# Build 005 — Autonomous Loop

Purpose: make the research organization operate as one observable loop.

Flow:
1. fresh market sensing
2. BTC Hunter memory/features
3. XRP-004 forward signal evaluation
4. candidate processing
5. Prosecutor
6. Qualification
7. Scorekeeper
8. explicit SUCCESS/FAILURE record in system_runs

Every run is auditable. Failures are persisted instead of silently disappearing.

Safety invariant: authorizedToTrade=false. Build 005 adds no transaction-write permission.

The reliable raw BTC clock remains Supabase pg_cron. The research loop remains separate from sensing so collection can continue even if reasoning fails.
