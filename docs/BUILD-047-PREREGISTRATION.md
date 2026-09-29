# Build 047A / 047B — Preregistration

Written 2026-09-29, before any Build 047 result was computed. Nothing below may be changed after results are seen;
any change must be recorded as a deviation with its reason.

## 047A — slow-trend economic correction

Strategy (unchanged from Build 045, `src/mechanisms/slowTrend.ts`): daily closes from HIST-028; direction = sign of
90-day return (>= 0 is long); exposure = min(1, 1% / sample s.d. of the last 30 daily returns); max leverage 1x;
BTC, ETH, XRP, SOL, ADA, DOGE, AVAX, LINK.

Corrections:
1. Costs are charged on actual turnover |w_t - w_(t-1)|, not every day. Entry from flat counts as turnover. An open
   position at the end of the data is marked to market, not liquidated.
2. Cost convention: 10 bps per unit of turnover (primary). Build 045 labelled its 10 bps "round trip"; under that
   reading the per-unit cost is 5 bps, reported as a sensitivity only. No other cost is used.
3. Execution timing (Build 044 next-bar rule): the signal uses the day's last hourly close; the position is entered
   at the next hourly close (about one hour later) and held to the same point the next day. The Build 045
   same-close timing is reported alongside for reconciliation only.

Periods: full available history (primary), plus Build 044 split (first 70% / last 30%) reported descriptively. The
last 30% is NOT a pristine holdout for this specification, because Build 045 already evaluated the full period.

Significance: circular block bootstrap (existing engine, blocks of 10 days, 4,999 resamples) on daily NET returns
against a zero mean, for each asset and the equal-weight portfolio (daily average of the eight net return streams).

Classification, decided on the equal-weight portfolio, primary timing and cost:
- PROMISING: net Sharpe >= 0.5, bootstrap p < 0.05, AND net return positive in both the 70% and 30% segments.
- NEGATIVE: net CAGR <= 0, OR net Sharpe < 0.2.
- INCONCLUSIVE: anything else.

## 047B — exploratory Kraken funding carry (one year)

Mode: EXPLORATORY / INSUFFICIENT HISTORY / NOT VALIDATION. The permanent 730-day funding gate is unchanged. No
output of this job can create, promote or update a hypothesis, and it writes nothing to the database.

Data: stored FUND046-KRAKEN settled hourly rates for PF_XBTUSD, PF_ETHUSD, PF_SOLUSD. Stored metadata must agree with
Kraken's documentation (units: fraction of notional per 1-hour period; timestamp = period start, UTC; positive =
received by shorts). Any disagreement stops the job.

All figures are RAW FUNDING COMPENSATION to a short perpetual per unit notional, never strategy profit.

Exposure rules compared (exactly three, no others):
1. Always exposed.
2. Exposed in hour t only if the settled rate for hour t-1 was > 0.
3. Exposed in hour t only if the mean settled rate over hours t-24..t-1 exceeds 10% per year simple
   (0.10 / 8766 = 1.1408e-5 per hour).
Rules 2 and 3 use only rates settled before the hour they apply to.

Classification, on the equal-weight BTC/ETH/SOL portfolio, rule 1:
- ECONOMICALLY UNINTERESTING: simple annualized raw funding < 5%.
- INTERESTING ENOUGH TO CONTINUE COLLECTING: 5% to 15%, or > 15% with fewer than 75% of those months positive.
- STRONGLY INTERESTING BUT UNVALIDATED: > 15% and at least 75% of calendar months positive (months with at
  least 20 days of data; partial first/last months excluded from this count).
