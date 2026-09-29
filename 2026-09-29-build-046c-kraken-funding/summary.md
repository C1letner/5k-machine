# Run request 2026-09-29-build-046c-kraken-funding

Requested at commit 78644b856438cd37398154617e6d71839b948fdf.

Note: Build 046 data: ingest Kraken Futures historical hourly funding (PF_XBTUSD, PF_ETHUSD, PF_SOLUSD) into Supabase once, verify completeness from stored data, then run the raw funding-leg baseline from the database only. Public data, no credentials, no trading.

| Job | Days | Result | Minutes |
|---|---:|---|---:|
| funding-ingest |  | success | 0.2 |
| funding-completeness |  | FAILED (exit 1) | 0 |
