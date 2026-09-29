# Build 046 (data) — Historical Funding Acquisition

Status: research only. No purchases, accounts, secrets, trades, or changes to trading authority.

## Problem

The Build 046 funding-carry baseline fetched funding live from exchanges on every run, and both
sources refuse GitHub-hosted runners:

- Bybit public API: HTTP 403 from the runner (run 2026-09-29-build-046-funding-carry).
- Binance COIN-M public API: HTTP 451, restricted location (run 2026-09-29-build-046b-funding-carry).

Geographic restrictions are not circumvented.

## Source chosen: Kraken Futures

`GET https://futures.kraken.com/derivatives/api/v3/historical-funding-rates?symbol=<PF_...>`
Public, no authentication, documented by Kraken. Kraken is US-headquartered and offers
perpetual futures to US clients, so a US-hosted runner is a legitimate client.

| Asset | Instrument | Listed since (Kraken) |
|---|---|---|
| BTC | PF_XBTUSD | 2022-03-22 |
| ETH | PF_ETHUSD | 2022-03-22 |
| SOL | PF_SOLUSD | 2022-06-13 |

Semantics (Kraken docs and contract specifications):

- `timestamp`: start of the one-hour funding period, UTC. Settlement is at the end of the hour.
- `relativeFundingRate`: funding as a fraction of spot price **per hour**, capped at ±0.5%/h. Stored.
- `fundingRate`: absolute USD per contract per hour. Kept in the raw snapshot, not stored.
- Sign: positive rates are received by shorts.

These are single-venue rates for linear USD-margined perpetuals, not a cross-exchange average.
Funding on other venues (8-hour intervals, different participants) will differ.

## Storage

`derivatives_observations`, `sensor_version = FUND046-KRAKEN`, `venue = KRAKEN_FUTURES`:

- `observed_at`: Kraken's original period-start timestamp, unmodified.
- `instrument`, `asset`.
- `funding_rate`: relativeFundingRate (fraction per 1-hour period).
- `source`: `kraken_futures_v3_historical_funding_rates|rate=relativeFundingRate,fraction_per_period|interval=1h|ts=period_start_utc|sign=positive_paid_to_shorts`

Provenance: each ingest publishes the raw responses (`kraken-funding-raw.json.gz`) and a manifest
with URL, fetch time, byte count and SHA-256 to the `reports` branch.

## Jobs (allow-listed run-request jobs)

| Job | Script | Contacts Kraken | Writes |
|---|---|---|---|
| funding-ingest | `npm run ingest:funding` | yes, once per instrument | new rows only |
| funding-completeness | `npm run check:funding` | no | nothing |
| funding-carry | `npm run research:funding-carry` | no | nothing |

- **Idempotent:** upsert on `(observed_at, venue, instrument, sensor_version)`. Existing rows are never
  overwritten. A read-back reconciliation reports any stored value that differs from the fetched value.
- **Completeness gate** (stored data only): first/last timestamp, observation count, median interval (expected
  1h), duplicates and conflicting duplicates, off-hour timestamps, gaps and missing periods, completeness %, and
  rates outside Kraken's cap. It fails, and stops the carry job, below 730 days of coverage, below 99%
  completeness, or on conflicts. `MIN_FUNDING_DAYS` overrides the 730.
- **No-network guard:** a test fails if the research files contain network calls.

## Baseline reported (raw funding leg only)

Per instrument: cumulative and annualized funding (simple sum / years), positive, negative and zero share,
maximum funding drawdown and its length, longest negative streak, worst and best 30-day funding, per-year
results, and a no-look-ahead filter (hold only when the previous 7 days' funding summed positive) with its
number of switches.

**This is not a carry return.** A delta-neutral trade (long spot, short perp) also depends on basis
changes, fees and spread on both legs, rebalancing, collateral haircuts and idle margin, and
exchange/stablecoin risk. None are modeled. No profitability claim follows from these numbers.

Next realism layer: Kraken's public charts API publishes mark and spot-index OHLC for the same
instruments, which would allow basis modeling from the same venue.

## Sources investigated

| Source | Outcome |
|---|---|
| Bybit public API | 403 from GitHub runners. Not circumvented. |
| Binance COIN-M API | 451, restricted location. Not circumvented. |
| Binance public data archive (data.binance.vision) | Not used: same company restricts US access; downloading its files from a US runner would sidestep that restriction. |
| CoinGlass | Paid plan (~$348/yr). Excluded: no purchases. |
| Coinbase Derivatives (existing Build 038 sensor) | Public API returned no usable funding history (Build 039). |
| OKX, Deribit, BitMEX, dYdX, Hyperliquid | Not pursued: their terms restrict US persons, which would conflict with the no-circumvention rule. |
| Community CSVs (Kaggle, GitHub) | Not used: accounts required and/or unverifiable provenance. |
| **Kraken Futures** | **Chosen:** public, documented, US-accessible, hourly, >4 years for BTC/ETH/SOL. |

If the runner cannot reach Kraken, or Kraken returns less than two years, the completeness gate fails
and the carry job does not run.
