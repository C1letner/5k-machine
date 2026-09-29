# Run request 2026-09-28-multiyear-calibration

Requested at commit 47dc8adb2f73aa123e9e6c8a3e661b92511f2dd5.

Note: Build 043 first run. Prices were already backfilled to 3 years (Historical Data Backfill, 2026-09-29 03:47 UTC). Backfill 3 years of volume, check data integrity, then calibrate the funnel on the full history.

| Job | Days | Result | Minutes |
|---|---:|---|---:|
| backfill-volume | 1095 | success | 7.1 |
| diagnose |  | success | 1.3 |
| calibrate |  | FAILED (exit 1) | 0 |
