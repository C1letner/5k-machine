# Build 006 — Command Center

A lightweight read-only web dashboard backed by Supabase.

V1 surfaces:
- shadow ledger
- BTC/XRP latest observations
- autonomous-loop health
- candidate counts
- qualification state
- unified recent activity feed

The dashboard uses the existing server-side Supabase secret and has no transaction UI or trading authority.

Deploy as a Render Web Service:
- runtime: Node
- build: npm install
- start: npm run dashboard
- env: SUPABASE_URL, SUPABASE_SECRET_KEY
