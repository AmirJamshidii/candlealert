# Chart Historical Data & Infinite Scroll

**Date:** 2026-03-23
**Status:** Approved

## Goal

Make the BTC live price chart show full historical candlestick data. When the user scrolls left past the initial load, older candles are fetched automatically from the Binance public REST API, with signal markers appearing wherever CandleAlert recorded a reversal signal. The chart's visual appearance, layout, and position on the dashboard remain unchanged.

## Background

The current chart fetches candles from an in-memory `CandleBufferService` on the backend, which only stores candles since the app started (max 500). Signal markers are returned alongside candles from `GET /api/analytics/btc/candles`. There is no backwards scrolling capability.

## Approach

**Larger initial load + scroll-triggered lazy loading (Approach C)**

- On initial load: fetch 500 candles from Binance REST directly in the frontend.
- Signals for the initial range: fetched from the backend using extended `since`/`until` params.
- On scroll left near the edge: fetch the next 500 older candles from Binance, plus signals for that batch from the backend, and prepend to the chart.

The frontend calls Binance's public klines API directly — no authentication required.

## Backend Changes

### Extend `GET /api/analytics/btc/candles`

Add two optional query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `since` | number (Unix seconds) | Fetch signals from this timestamp |
| `until` | number (Unix seconds) | Fetch signals up to this timestamp |

**Behavior when `since`/`until` are provided:**
- Skip the buffer candle lookup entirely.
- The controller converts both params to milliseconds (`since * 1000`, `until * 1000`) before passing to the repository, since the `alerts` table stores timestamps in milliseconds.
- Query `alerts` table for signals in the given interval and time range.
- Return `{ candles: [], signals: [...] }`.

**Existing behavior** (no `since`/`until`) is unchanged — buffer candles + derived signal range.

Files affected:
- `src/modules/analytics/analytics.controller.ts` — add `@Query('since')` and `@Query('until')` params
- `src/modules/analytics/analytics.service.ts` — branch on params presence; reuse existing `alertRepo.getSignalsByIntervalSince()` with an added upper bound
- `src/modules/alert/alert.repository.ts` — add a new `getSignalsByIntervalBetween(interval, sinceMs, untilMs)` method. Do not modify the existing `getSignalsByIntervalSince` to avoid breaking the current no-param code path.

## Frontend Changes (`public/index.html`)

### New chart state variables

```javascript
let allCandles = [];          // full accumulated candle array
let allSignals = [];          // full accumulated signal markers array
let oldestCandleTime = null;  // Unix seconds of oldest loaded candle
let isFetchingHistory = false; // dedup guard
```

Reset all four in `setPriceInterval()` before reloading.

Because `candleSeries.setData()` replaces the full series on every scroll batch, `setMarkers()` must also be called with the full `allSignals` array after every `setData()` call — not just with the new batch's markers.

### `loadPriceChart()` rewrite

1. Fetch 500 candles from Binance:
   ```
   GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=<interval>&limit=500
   ```
2. Map response to Lightweight Charts format:
   ```javascript
   { time: row[0] / 1000, open: +row[1], high: +row[2], low: +row[3], close: +row[4] }
   ```
3. Store in `allCandles`, set `oldestCandleTime = allCandles[0].time`.
4. Fetch signals from backend for the loaded range:
   ```
   GET /api/analytics/btc/candles?interval=<interval>&since=<oldest>&until=<newest>
   ```
   Use only the `signals` array from the response.
5. Map signals to markers, store in `allSignals`. Apply via `candleSeries.setMarkers(allSignals)` (same gold border + circle logic as today).
6. Subscribe to `visibleLogicalRangeChanged` for lazy loading.

### New `fetchOlderCandles()` function

```
Called when: range.from < 10 and !isFetchingHistory
```

1. Set `isFetchingHistory = true`, show loading indicator in chart header.
2. Fetch from Binance with `endTime = oldestCandleTime * 1000 - 1`:
   ```
   GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=<interval>&limit=500&endTime=<ms>
   ```
3. If response has fewer than 2 candles: unsubscribe the scroll listener (reached Binance history limit). The threshold is 2 rather than 0 because a single candle could be the boundary candle already present in `allCandles`, so receiving 0–1 candles reliably indicates no more history.
4. Fetch signals for the batch range from backend (`since`/`until`). Map to markers, prepend to `allSignals` (sort by `time` ascending).
5. Prepend deduped candles to `allCandles`, call `candleSeries.setData(allCandles)`, then call `candleSeries.setMarkers(allSignals)` to re-apply all accumulated markers.
6. Update `oldestCandleTime = allCandles[0].time`.
7. Set `isFetchingHistory = false`, hide loading indicator.

### Loading indicator

Add `<span id="priceChartLoading" style="display:none">Loading history...</span>` inside the existing `chart-card-header-right` div for the price chart. Toggle `display` between `none` and `inline` while `isFetchingHistory` is true.

### `visibleLogicalRangeChanged` subscription lifecycle

- Subscribe after initial data load in `loadPriceChart()`.
- Unsubscribe and nullify on `setPriceInterval()` before recreating the chart, and when Binance returns no more data.

## Data Contract

Binance klines response (public, no auth):
```
[openTime, open, high, low, close, volume, closeTime, ...]
```
All values are strings — cast with `+` or `parseFloat`.

The existing `time` field in Lightweight Charts is Unix seconds (integer). `openTime` from Binance is milliseconds → divide by 1000.

## Out of Scope

- Live real-time tick updates to the chart
- Annotations / drawing tools
- Persisting annotations
- Any changes to chart visual style, size, or dashboard layout

## Edge Cases

- **Duplicate candles**: Binance `endTime` is exclusive on the upper bound so candles won't overlap between batches, but as a safety measure filter the new batch before prepending: `const existingTimes = new Set(allCandles.map(c => c.time)); const deduped = newBatch.filter(c => !existingTimes.has(c.time));`
- **Rate limits**: Binance public API allows 1200 requests/minute with weight-based limiting. Fetching 500 candles costs weight=2. The scroll guard (`isFetchingHistory`) ensures at most one in-flight request at a time.
- **Interval change mid-scroll**: `setPriceInterval()` resets all state and cancels the current listener before reloading. Any in-flight `fetchOlderCandles()` call will resolve after the chart is rebuilt; the stale `candleSeries.setData()` call is harmless because `setPriceInterval()` replaces the series instance, making the old reference a no-op.
- **No signals for old candles**: Expected and correct. Only candles where CandleAlert was running and recorded a reversal will show markers.
- **Signal fetch errors (scroll batches)**: If the backend signal fetch fails during `fetchOlderCandles`, swallow the error silently — show the candles without markers rather than blocking the user. Log the error to console. The initial load signal fetch follows the same policy.
