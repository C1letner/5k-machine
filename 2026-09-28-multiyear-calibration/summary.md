# Run request 2026-09-28-multiyear-calibration

Requested at commit 9912577064ecaec5669a98fc16e08361cf3c282b.

Note: Build 043 first run. Prices were already backfilled to 3 years (Historical Data Backfill, 2026-09-29 03:47 UTC). Backfill 3 years of volume, check data integrity, then calibrate the funnel on the full history.

| Job | Days | Result | Minutes |
|---|---:|---|---:|
| backfill-volume | 1095 | success | 6.9 |
| diagnose |  | success | 1.2 |
| calibrate |  | FAILED (exit 1) | 0 |
