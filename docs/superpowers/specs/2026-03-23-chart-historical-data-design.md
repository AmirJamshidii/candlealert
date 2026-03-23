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
- Query `alerts` table for signals in the given interval and time range.
- Return `{ candles: [], signals: [...] }`.

**Existing behavior** (no `since`/`until`) is unchanged — buffer candles + derived signal range.

Files affected:
- `src/modules/analytics/analytics.controller.ts` — add `@Query('since')` and `@Query('until')` params
- `src/modules/analytics/analytics.service.ts` — branch on params presence; reuse existing `alertRepo.getSignalsByIntervalSince()` with an added upper bound
- `src/modules/alert/alert.repository.ts` — add `until` support to `getSignalsByIntervalSince` (or add a new `getSignalsByIntervalBetween` method)

## Frontend Changes (`public/index.html`)

### New chart state variables

```javascript
let allCandles = [];          // full accumulated candle array
let oldestCandleTime = null;  // Unix seconds of oldest loaded candle
let isFetchingHistory = false; // dedup guard
```

Reset all three in `setPriceInterval()` before reloading.

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
5. Apply signal markers (gold border + circle marker) — same logic as today.
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
3. If response is empty or fewer than 2 candles: unsubscribe the scroll listener (reached Binance history limit).
4. Fetch signals for the batch range from backend (`since`/`until`).
5. Prepend new candles to `allCandles`, call `candleSeries.setData(allCandles)`.
6. Update `oldestCandleTime = allCandles[0].time`.
7. Set `isFetchingHistory = false`, hide loading indicator.

### Loading indicator

A small text label (e.g. "Loading history...") rendered in the chart card header right side, visible only while `isFetchingHistory = true`. No new DOM elements needed — toggle visibility on the existing `chart-card-header-right` area or add a dedicated `<span id="priceChartLoading">`.

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

- **Duplicate candles**: Binance `endTime` is exclusive on the upper bound so candles won't overlap between batches, but `allCandles` dedup by `time` should be applied before `setData` to be safe.
- **Rate limits**: Binance public API allows 1200 requests/minute with weight-based limiting. Fetching 500 candles costs weight=2. The scroll guard (`isFetchingHistory`) ensures at most one in-flight request at a time.
- **Interval change mid-scroll**: `setPriceInterval()` resets all state and cancels the current listener before reloading — no stale data risk.
- **No signals for old candles**: Expected and correct. Only candles where CandleAlert was running and recorded a reversal will show markers.
