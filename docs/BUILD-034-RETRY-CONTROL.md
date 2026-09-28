# Build 034 — Research State & Retry Control

INCONCLUSIVE is now a durable research state with a cooldown rather than an invitation to burn compute every campaign.

On each inconclusive result:
- increment inconclusive_count,
- record evidence count,
- set retry_reason,
- schedule exponential cooldown: 1, 2, 4, 8, 16, then max 30 days,
- write a durable research_retry_event.

The tester ignores cooling hypotheses.

When cooldown expires, Retry Controller checks whether additional market evidence exists. If evidence has grown, the hypothesis is released for another test. If not, it is deferred again.

PASS and FAIL clear retry state.

This controls compute waste without converting insufficient evidence into a false rejection.
