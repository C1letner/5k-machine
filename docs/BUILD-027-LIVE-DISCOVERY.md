# Build 027 — Live Discovery Library Integration

The hourly discovery worker now reads synchronized crypto-universe history and runs all Build 026 discovery families.

Up to the 25 highest-scoring anomaly hits per cycle are converted into structured, deterministic Hypothesis Factory proposals.

The proposal records:
- anomaly family and feature state,
- involved asset(s),
- observation window,
- unproven mechanism,
- predicted asset/direction/horizons,
- falsification requirements,
- required data,
- immutable hypothesis key.

The mechanism is explicitly labeled unproven. Discovery hits are questions, not trading signals.

Duplicate identical hypotheses are suppressed by deterministic hypothesis key.

No capital authority is created. authorizedToTrade remains false.
