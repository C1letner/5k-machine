# $5K Machine

Build 001 establishes the spine of an autonomous shadow-capital allocator.

## Build 001 scope

- $5,000 shadow portfolio
- immutable ledger schema
- BTC market observation ingestion contract
- Crypto Hunter observation/candidate pipeline
- no live trading
- no autonomous execution
- deterministic portfolio accounting

## Architecture

```
MARKET DATA
   ↓
OBSERVATIONS
   ↓
CRYPTO HUNTER
   ↓
CANDIDATES
   ↓
SHADOW LEDGER
```

Later builds add World Intelligence, Regime, Prosecutor, Qualification, Capital Allocator, Monitor, and Scorekeeper.

## Principle

Agents may analyze and propose. They do not move money in Build 001.

The database is the source of truth for capital, positions, and P&L.

## Quick start

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and fill values.
4. Install dependencies.
5. Run the worker.

```bash
npm install
npm run worker
```

## Shadow account

The initial account is seeded at **$5,000 USD cash**.

No external contributions are permitted in V1.
