# Run request 2026-09-29-build-046d-kraken-funding-history

Requested at commit 86d5fd98d03934f893f1f6b17f9bab13413f117b.

Note: Build 046 data, step 2: settled Kraken rates (stored by 046c) cover only the last year. Fetch Kraken's public analytics funding series back to listing, validate it against the stored settled rates (>=99% match over >=180 days), store only if it passes, re-check completeness, then run the raw funding-leg baseline from the database. No credentials, no trading.

| Job | Days | Result | Minutes |
|---|---:|---|---:|
| funding-ingest-analytics |  | FAILED (exit 1) | 0.6 |
