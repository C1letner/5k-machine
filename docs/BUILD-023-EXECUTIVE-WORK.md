# Build 023 — Executive Work System

CEO directives now materialize into durable departmental work orders.

Lifecycle:
QUEUED -> CLAIMED -> EXECUTING/VERIFYING -> COMPLETE
or BLOCKED/FAILED.

Completion requires evidence. V1 only auto-executes bounded deterministic operational checks; unsupported directives are BLOCKED rather than fabricated.

CEO_CONTROL independently records verification evidence before a decision is closed.

This is the management analogue of the scientific pipeline: work must leave durable state and evidence.

No executive work order can grant capital authority. authorizedToTrade remains false.
