# Build 044 — Scientific Integrity Gate

Implements the high-priority integrity repairs identified in the Sep 28 external review.

1. Genuine holdout: Discovery reads only the first 70% of the configured research window. The final 30% is excluded from Discovery and reserved for Holdout.
2. Next-bar execution: HIST-028 timestamps label candle start while price_usd is the completed candle close. Signals formed from candle i therefore enter at i+1, not the same close.
3. Shared science: Holdout uses the same event definitions and block-bootstrap framework as Discovery.
4. Provenance: Discovery and Holdout explicitly read HIST-028 only.
5. Continuity audit: every asset is paginated fully and checked for duplicate timestamps and non-hourly gaps. The audit documents the historical timestamp convention.
6. Trading authority remains OFF.

Before joining HIST-028 to true-time/live/third-party data, its information-availability timestamp must be interpreted as observed_at + 1 hour.
