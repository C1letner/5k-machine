// Build 049 Phase 0: read-only access probe of Kalshi's PUBLIC market-data REST API from our infrastructure.
// No credentials, no orders, no storage. Confirms reachability, the KXCPIYOY series metadata, open markets and
// one orderbook's format (Kalshi returns bids only; asks are implied by the opposite side: YES ask = 1 - best NO bid).
const BASES = ["https://external-api.kalshi.com/trade-api/v2", "https://api.elections.kalshi.com/trade-api/v2"];

async function get(url: string) {
  const t0 = Date.now(), r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "5k-machine-research/049-probe" } });
  const text = await r.text();
  const rl = Object.fromEntries([...r.headers.entries()].filter(([k]) => /rate|limit|retry/i.test(k)));
  let body: any = null; try { body = JSON.parse(text); } catch { /* keep text */ }
  return { url, status: r.status, ms: Date.now() - t0, rateHeaders: rl, body, text: body ? undefined : text.slice(0, 300) };
}

async function main() {
  const out: any = { build: "049-phase0", probe: "kalshi-public-rest", at: new Date().toISOString(), bases: [] as any[], authorizedToTrade: false };
  for (const base of BASES) {
    const series = await get(`${base}/series/KXCPIYOY`);
    const markets = await get(`${base}/markets?series_ticker=KXCPIYOY&status=open&limit=200`);
    const ms = markets.body?.markets ?? [];
    const sample = ms.find((m: any) => Number(m.volume ?? 0) > 0) ?? ms[0];
    const book = sample ? await get(`${base}/markets/${sample.ticker}/orderbook`) : null;
    const events = [...new Set(ms.map((m: any) => m.event_ticker))];
    out.bases.push({
      base, seriesStatus: series.status, seriesMs: series.ms, fee: series.body?.series ? { fee_type: series.body.series.fee_type, fee_multiplier: series.body.series.fee_multiplier } : null,
      marketsStatus: markets.status, marketsMs: markets.ms, rateHeaders: markets.rateHeaders, openMarkets: ms.length, events,
      strikeTypes: [...new Set(ms.map((m: any) => m.strike_type))],
      sampleMarket: sample ? { ticker: sample.ticker, event_ticker: sample.event_ticker, strike_type: sample.strike_type, floor_strike: sample.floor_strike, yes_bid: sample.yes_bid_dollars ?? sample.yes_bid, yes_ask: sample.yes_ask_dollars ?? sample.yes_ask, no_bid: sample.no_bid_dollars ?? sample.no_bid, no_ask: sample.no_ask_dollars ?? sample.no_ask, close_time: sample.close_time, expiration_time: sample.expiration_time, rules_primary: sample.rules_primary } : null,
      orderbookStatus: book?.status ?? null, orderbookMs: book?.ms ?? null, orderbookKeys: book?.body ? Object.keys(book.body.orderbook ?? book.body) : null,
      orderbookSample: book?.body ? JSON.stringify(book.body).slice(0, 600) : book?.text ?? null,
    });
  }
  console.log(JSON.stringify(out, null, 2));
  if (!out.bases.some((b: any) => b.marketsStatus === 200 && b.orderbookStatus === 200)) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
