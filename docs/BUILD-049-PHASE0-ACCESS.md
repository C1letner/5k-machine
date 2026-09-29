# Build 049 — Phase 0: Access Verification (CPI cross-venue microscope)

Status: **FORECASTEX ACCESS BLOCKER.** Stopped at Phase 0 as instructed. No collector, no preregistration, no
opportunity data yet. Trading authority OFF. No accounts, credentials, subscriptions or purchases.

## Kalshi: ACCESS CONFIRMED (public, no credentials)

Verified from our GitHub runners (probe run `2026-09-29-build-049-phase0-kalshi-probe`, reports branch):
- `GET /trade-api/v2/series/KXCPIYOY`, `/markets?series_ticker=KXCPIYOY&status=open`, `/markets/{ticker}/orderbook`
  on both `external-api.kalshi.com` and `api.elections.kalshi.com`: HTTP 200, about 100 ms (markets) and 25-30 ms
  (orderbook). No rate-limit headers returned.
- 63 open markets, three reference months: KXCPIYOY-26SEP, -26NOV, -26DEC. All `strike_type = greater`.
- The orderbook returns full depth as YES bids and NO bids only. Asks are implied: YES ask = 1 - best NO bid (checked:
  NO bid 0.98 gives YES ask 0.02, matching the market's listed yes_ask).
- The live WebSocket requires authentication (Kalshi docs). Without credentials, collection would poll REST.

## ForecastEx: BLOCKED without Owner action

- Official public data (forecastex.com/data): daily CSV files only (prices, "pairs" refreshed about every 10 minutes,
  summary) with open, high, low, close, settlement price, volume, open interest and VWAP. **No bid, ask or depth.**
- Executable bid/ask/size is available only through IBKR's official APIs (TWS API / Web API: fields 84 bid,
  86 ask, 85/88 sizes). IBKR documents that streaming market data requires trading permissions, a funded account and
  market-data subscriptions for the username. Whether ForecastEx quotes need a paid subscription is not stated.
- ForecastEx historical API data exists only while a contract trades; historical trades and last prices are not
  provided. No historical order book is available.
- Using undocumented endpoints behind IBKR's ForecastTrader web pages would be scraping around access controls;
  not done.

## Owner actions that would unblock (each is an Owner decision)

1. An IBKR account (existing or new) with event-contract / ForecastEx trading permission. IBKR says access is for
   "eligible customers"; state eligibility (Arizona) must be confirmed with IBKR.
2. Funding, if IBKR requires it for live API data.
3. Confirm with IBKR whether ForecastEx top-of-book data needs a paid market-data subscription. Nothing is purchased
   without approval.
4. A persistent machine logged into IB Gateway or TWS with the API enabled in read-only mode. GitHub Actions cannot hold an
   interactive IBKR login, and each job is limited to 6 hours, so a 30-day continuous collection needs this machine anyway
   (it would also run the Kalshi poller). Credentials stay on that machine, never in chat or the repository.
5. Optional: a Kalshi API key (read-only use) to use the WebSocket instead of REST polling.
6. A compliance decision on event-contract research and any future use, given the Arizona uncertainty. Not a
   legal opinion.

## Contract semantics compared (from current official documents)

| Item | Kalshi KXCPIYOY | ForecastEx CPIY | Status |
|---|---|---|---|
| Underlying | All-items CPI-U before seasonal adjustment, 12-month % change | CPI-U before seasonal adjustment, year-over-year % change | Match |
| Source | BLS | BLS | Match |
| Rounding | "one-decimal place value reported by BLS" | Terms do not state rounding | **Unverified** |
| Comparator | "increases by more than X%" (strike_type greater) | "exceed [#.#%]" | Match (strict >) |
| Release | Initial; later revisions ignored | Initial; later revisions ignored | Match |
| Reference month | Twelve months ending the named month | "[month][year]"; symbol-to-reference mapping not stated | **Unverified** |
| Last trading | 8:29 AM ET on release day | Expiration = Resolution Time, 7:30 AM CT (8:30 ET) | Differs by about 1 min |
| Delayed release | Expiration can move; an alternative calculation applies if data are unavailable by expiration (about 3 months later) | Resolution delayed until data are released; no provision for a cancelled release | **Mismatch** |
| Discretionary review | Kalshi Market Outcome Review Process | ForecastEx event review (Rule 415) | Both exist |
| Order mechanics | YES/NO reciprocal book; can buy or sell | Separate YES and NO contracts; buy-only; limit orders | Structures A and B possible (buy-only) |
| Payout | $1 | $1; ForecastEx also pays incentive coupons on held contracts | Coupons affect carry |
| Fees | round up(0.07 × C × P × (1-P)) taker; round up(0.0175 × C × P × (1-P)) maker; multiplier 1 for Inflation (schedule dated 2026-07-07) | $0.01 per contract, each side | Verified |

Best possible semantic status for any pair: **RESIDUAL_MISMATCH** (delayed/cancelled-release rules differ; BLS did not
publish an October 2025 CPI after that year's shutdown, so this risk is not hypothetical). Two items stay unverified until
ForecastEx listings can be read through an official interface.

## Next step

Owner decision on the actions above. Once access exists: commit `docs/BUILD-049-PREREGISTRATION.md` (fees, matching,
depth walking, carry, persistence, shadow fills, GO/NO-GO) before any cross-venue observation, then start the 30-day
collection. The preregistration was deliberately not written yet: its latency, depth and fill conventions depend on the
ForecastEx interface that will actually be available.
