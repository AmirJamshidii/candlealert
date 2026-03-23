# Chart Historical Data & Infinite Scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory buffer chart with a Binance-backed chart that loads 500 candles on open and lazy-loads older batches when the user scrolls left, with signal markers fetched from the DB for every range.

**Architecture:** Backend gains a `getSignalsByIntervalBetween` repository method exposed via optional `since`/`until` query params on `GET /api/analytics/btc/candles`. The frontend fetches candles directly from the Binance public REST API, calls the backend only for signal markers, and subscribes to the Lightweight Charts `visibleLogicalRangeChanged` event to trigger history loads.

**Tech Stack:** NestJS + TypeScript (backend), vanilla JS + Lightweight Charts v4.1.1 (frontend), PostgreSQL (alerts table), Binance public klines API (no auth).

---

## File Map

| File | Change |
|------|--------|
| `src/modules/alert/alert.repository.ts` | Add `getSignalsByIntervalBetween(interval, sinceCloseMs, untilCloseMs)` |
| `src/modules/analytics/analytics.service.ts` | Add `since?`/`until?` params to `getBtcCandles`; branch to call new repo method |
| `src/modules/analytics/analytics.controller.ts` | Add `@Query('since')` and `@Query('until')` to `getBtcCandles` endpoint |
| `test/analytics.e2e-spec.ts` | Add e2e tests for the new `since`/`until` endpoint behaviour |
| `public/index.html` | Loading indicator HTML, new state vars, `loadPriceChart` rewrite, `fetchOlderCandles`, helper functions, `setPriceInterval` update |

---

## Task 1: Write failing e2e test for `since`/`until` endpoint params

**Files:**
- Test: `test/analytics.e2e-spec.ts` (append a new `describe` block inside the existing `Analytics API (e2e)` describe)

The test seeds an alert with a precise `candle_close_time` and verifies the endpoint returns `candles: []` and the matching signal when `since`/`until` are passed.

**Key values used in the test:**
- `candle_close_time = 1709999999999` ms
- `open_time_sec = Math.floor((1709999999999 - 300000 + 1) / 1000) = 1709999700`

- [ ] **Step 1: Append the test block to `test/analytics.e2e-spec.ts`**

Add this block inside the outer `describe('Analytics API (e2e)', ...)` block, after the last existing `describe` in that file:

```typescript
// ── /api/analytics/btc/candles with since/until ──────────────────────────────

describe('GET /api/analytics/btc/candles with since/until params', () => {
  // close_time = open_time + interval_ms - 1
  // 1709999700 sec * 1000 + 300000 - 1 = 1709999999999 ms
  const closeTimeMs = 1709999999999;
  const openTimeSec = 1709999700; // Math.floor((closeTimeMs - 300000 + 1) / 1000)

  beforeEach(async () => {
    await dataSource.query(`
      INSERT INTO alerts (signal_key, chat_id, interval, candle_close_time, direction)
      VALUES ('range_test_signal', '999', '5m', ${closeTimeMs}, 'green_to_red')
    `);
  });

  it('returns empty candles and the matching signal when since/until provided', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/analytics/btc/candles?interval=5m&since=${openTimeSec}&until=${openTimeSec}`,
      )
      .expect(200);

    expect(res.body.candles).toEqual([]);
    expect(res.body.signals).toHaveLength(1);
    expect(res.body.signals[0].time).toBe(openTimeSec);
    expect(res.body.signals[0].direction).toBe('green_to_red');
  });

  it('returns empty signals when range has no matching alerts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/btc/candles?interval=5m&since=1000&until=2000')
      .expect(200);

    expect(res.body.candles).toEqual([]);
    expect(res.body.signals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest --config test/jest-e2e.json test/analytics.e2e-spec.ts --testNamePattern "since/until"
```

Expected: FAIL — `since`/`until` params are not yet wired up, so the endpoint ignores them and returns buffer candles/signals instead of `candles: []`.

---

## Task 2: Add `getSignalsByIntervalBetween` to `AlertRepository`

**Files:**
- Modify: `src/modules/alert/alert.repository.ts`

Add after the `getSignalsByIntervalSince` method (line 93):

- [ ] **Step 3: Add the new repository method**

```typescript
async getSignalsByIntervalBetween(
  interval: string,
  sinceCloseMs: number,
  untilCloseMs: number,
): Promise<{ candleCloseTimeMs: number; direction: string | null }[]> {
  const rows = await this.repo.manager.query(
    `SELECT DISTINCT candle_close_time AS "candleCloseTime", direction
     FROM alerts
     WHERE interval = $1
       AND candle_close_time >= $2
       AND candle_close_time <= $3`,
    [interval, sinceCloseMs, untilCloseMs],
  );
  return rows.map((r: Record<string, string>) => ({
    candleCloseTimeMs: parseInt(r.candleCloseTime, 10),
    direction: r.direction,
  }));
}
```

`candle_close_time` is a `bigint` column — numeric comparison works directly, no cast needed.

---

## Task 3: Extend `getBtcCandles` in `AnalyticsService`

**Files:**
- Modify: `src/modules/analytics/analytics.service.ts`

- [ ] **Step 4: Add `since?` and `until?` params to the method signature and add the branch**

Replace the `getBtcCandles` method signature and add the early-return branch at the top of the method body:

Current signature (line 154):
```typescript
async getBtcCandles(
  interval: string,
  limit: number,
): Promise<{...}>
```

New signature + branch (insert the `if` block before the existing `const buffered = ...` line):
```typescript
async getBtcCandles(
  interval: string,
  limit: number,
  since?: number,
  until?: number,
): Promise<{
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  signals: { time: number; direction: string | null }[];
}> {
  if (since !== undefined && until !== undefined) {
    const intervalMs = this.parseIntervalMs(interval);
    // Convert open-time seconds to the candle's close-time ms range
    const sinceCloseMs = since * 1000 + intervalMs - 1;
    const untilCloseMs = until * 1000 + intervalMs - 1;
    const rows = await this.alertRepo.getSignalsByIntervalBetween(
      interval,
      sinceCloseMs,
      untilCloseMs,
    );
    const signals = rows.map((r) => ({
      time: Math.floor((r.candleCloseTimeMs - intervalMs + 1) / 1000),
      direction: r.direction,
    }));
    return { candles: [], signals };
  }

  const buffered = this.candleBuffer.getCandles(interval, limit);
  // ... (rest of existing method unchanged)
```

---

## Task 4: Wire `since`/`until` into `AnalyticsController`

**Files:**
- Modify: `src/modules/analytics/analytics.controller.ts`

- [ ] **Step 5: Add `@Query('since')` and `@Query('until')` params**

Replace the `getBtcCandles` controller method (starts at line 245):

```typescript
getBtcCandles(
  @Query('interval') interval?: string,
  @Query('limit') limit?: string,
  @Query('since') since?: string,
  @Query('until') until?: string,
) {
  return this.analyticsService.getBtcCandles(
    interval ?? '5m',
    limit ? parseInt(limit, 10) : 200,
    since ? parseInt(since, 10) : undefined,
    until ? parseInt(until, 10) : undefined,
  );
}
```

Also add two `@ApiQuery` decorators before the method for the new params (after the existing `limit` `@ApiQuery`):

```typescript
@ApiQuery({
  name: 'since',
  required: false,
  type: Number,
  description: 'Candle open time lower bound (Unix seconds). When both since and until are provided, returns signals only (candles: []).',
})
@ApiQuery({
  name: 'until',
  required: false,
  type: Number,
  description: 'Candle open time upper bound (Unix seconds).',
})
```

---

## Task 5: Run e2e tests — backend complete

- [ ] **Step 6: Run the e2e tests**

```bash
npx jest --config test/jest-e2e.json test/analytics.e2e-spec.ts --testNamePattern "since/until"
```

Expected: Both tests PASS.

- [ ] **Step 7: Run full e2e suite to check for regressions**

```bash
npx jest --config test/jest-e2e.json test/analytics.e2e-spec.ts
```

Expected: All tests PASS. The `since`/`until` branch only activates when both params are present, so existing behaviour is unchanged.

- [ ] **Step 8: Commit backend changes**

```bash
git add src/modules/alert/alert.repository.ts \
        src/modules/analytics/analytics.service.ts \
        src/modules/analytics/analytics.controller.ts \
        test/analytics.e2e-spec.ts
git commit -m "feat: add since/until range query to btc/candles endpoint"
```

---

## Task 6: Add loading indicator HTML and new chart state variables

**Files:**
- Modify: `public/index.html`

### 6a — Loading indicator span in HTML

- [ ] **Step 9: Add loading indicator span after `priceIntervalTabs` div**

Find this line (around line 471):
```html
<div class="chart-card-header-right" id="priceIntervalTabs"></div>
```

Replace with:
```html
<div class="chart-card-header-right" id="priceIntervalTabs"></div>
<span id="priceChartLoading" style="display:none;font-size:12px;color:var(--text2);margin-left:8px">Loading history...</span>
```

### 6b — New state variables

- [ ] **Step 10: Add new state variables in the JS state block**

Find this block (around line 633):
```javascript
let priceInterval = null;
let priceChartInstance = null;
```

Replace with:
```javascript
let priceInterval = null;
let priceChartInstance = null;
let candleSeriesRef = null;           // module-level ref so fetchOlderCandles can reach it
let allCandles = [];                  // full accumulated candle array
let allSignals = [];                  // full accumulated signal markers array
let oldestCandleTime = null;          // Unix seconds of oldest loaded candle
let isFetchingHistory = false;        // dedup guard for scroll loads
let priceChartScrollUnsubscribe = null; // call to detach the scroll listener
```

---

## Task 7: Add `fetchSignalsForRange` and `applyChartData` helpers

**Files:**
- Modify: `public/index.html`

These two helpers are used by both `loadPriceChart` and `fetchOlderCandles`. Add them just before the `// ── BTC Live Price chart ──` comment (around line 779).

- [ ] **Step 11: Insert the two helper functions**

```javascript
// ── Chart helpers ──

async function fetchSignalsForRange(interval, sinceTimeSec, untilTimeSec) {
  try {
    const d = await fetchJSON(
      `/api/analytics/btc/candles?interval=${interval}&since=${sinceTimeSec}&until=${untilTimeSec}`,
    );
    if (!d || !d.signals) return [];
    return d.signals.map(s => ({
      time: s.time,
      position: s.direction === 'green_to_red' ? 'aboveBar' : 'belowBar',
      color: '#fbbc04',
      shape: 'circle',
      text: s.direction === 'green_to_red' ? 'G→R' : 'R→G',
    }));
  } catch (e) {
    console.error('[PriceChart] signal fetch failed', e);
    return [];
  }
}

function applyChartData() {
  if (!candleSeriesRef) return;
  const signalTimes = new Set(allSignals.map(s => s.time));
  const candleData = allCandles.map(c =>
    signalTimes.has(c.time) ? { ...c, borderColor: '#fbbc04', wickColor: '#fbbc04' } : c,
  );
  candleSeriesRef.setData(candleData);
  if (allSignals.length > 0) {
    candleSeriesRef.setMarkers([...allSignals].sort((a, b) => a.time - b.time));
  }
}
```

---

## Task 8: Rewrite `loadPriceChart()`

**Files:**
- Modify: `public/index.html`

- [ ] **Step 12: Replace the entire `loadPriceChart` function**

Find the full function (lines 780–835):
```javascript
// ── BTC Live Price chart ──
async function loadPriceChart() {
  if (!priceInterval) return;
  const d = await fetchJSON(`/api/analytics/btc/candles?interval=${priceInterval}&limit=200`);
  if (!d || !d.candles) return;
  ...
  ro.observe(container);
}
```

Replace with:
```javascript
// ── BTC Live Price chart ──
async function loadPriceChart() {
  if (!priceInterval) return;

  const container = document.getElementById('priceChart');
  if (priceChartInstance) { priceChartInstance.remove(); priceChartInstance = null; }

  priceChartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 260,
    layout: { background: { color: '#1e1e1e' }, textColor: '#9aa0a6' },
    grid: { vertLines: { color: '#3c3c3c' }, horzLines: { color: '#3c3c3c' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#3c3c3c' },
    timeScale: { borderColor: '#3c3c3c', timeVisible: true, secondsVisible: false },
  });

  candleSeriesRef = priceChartInstance.addCandlestickSeries({
    upColor: '#34a853', downColor: '#ea4335',
    borderUpColor: '#34a853', borderDownColor: '#ea4335',
    wickUpColor: '#34a853', wickDownColor: '#ea4335',
  });

  // Fetch 500 candles from Binance directly (public API, no auth)
  let raw;
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${priceInterval}&limit=500`,
    );
    raw = await res.json();
  } catch (e) {
    console.error('[PriceChart] Binance initial fetch failed', e);
    return;
  }
  if (!Array.isArray(raw) || raw.length === 0) return;

  allCandles = raw.map(r => ({
    time: Math.floor(r[0] / 1000),
    open: +r[1], high: +r[2], low: +r[3], close: +r[4],
  }));
  oldestCandleTime = allCandles[0].time;
  const newestCandleTime = allCandles[allCandles.length - 1].time;

  // Fetch signals for the initial range from backend
  allSignals = await fetchSignalsForRange(priceInterval, oldestCandleTime, newestCandleTime);

  applyChartData();
  priceChartInstance.timeScale().fitContent();

  // Infinite scroll: fetch older candles when user scrolls near the left edge
  const scrollHandler = async (range) => {
    if (!range || range.from > 10 || isFetchingHistory) return;
    await fetchOlderCandles();
  };
  priceChartInstance.timeScale().subscribeVisibleLogicalRangeChange(scrollHandler);
  priceChartScrollUnsubscribe = () => {
    if (priceChartInstance) {
      priceChartInstance.timeScale().unsubscribeVisibleLogicalRangeChange(scrollHandler);
    }
  };

  const ro = new ResizeObserver(() => {
    if (priceChartInstance) priceChartInstance.applyOptions({ width: container.clientWidth });
  });
  ro.observe(container);
}
```

---

## Task 9: Add `fetchOlderCandles()` and update `setPriceInterval()`

**Files:**
- Modify: `public/index.html`

### 9a — Add `fetchOlderCandles` after `loadPriceChart`

- [ ] **Step 13: Insert `fetchOlderCandles` function after `loadPriceChart` and before `setPriceInterval`**

```javascript
async function fetchOlderCandles() {
  isFetchingHistory = true;
  document.getElementById('priceChartLoading').style.display = 'inline';
  try {
    const endTime = oldestCandleTime * 1000 - 1;
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${priceInterval}&limit=500&endTime=${endTime}`,
    );
    const raw = await res.json();

    if (!Array.isArray(raw) || raw.length < 2) {
      // Reached the end of Binance history — stop listening
      if (priceChartScrollUnsubscribe) { priceChartScrollUnsubscribe(); priceChartScrollUnsubscribe = null; }
      return;
    }

    const newBatch = raw.map(r => ({
      time: Math.floor(r[0] / 1000),
      open: +r[1], high: +r[2], low: +r[3], close: +r[4],
    }));

    // Dedup: Binance endTime is exclusive but guard anyway
    const existingTimes = new Set(allCandles.map(c => c.time));
    const deduped = newBatch.filter(c => !existingTimes.has(c.time));
    if (deduped.length === 0) {
      if (priceChartScrollUnsubscribe) { priceChartScrollUnsubscribe(); priceChartScrollUnsubscribe = null; }
      return;
    }

    const batchOldest = deduped[0].time;
    const batchNewest = deduped[deduped.length - 1].time;

    // Fetch signals for this batch from backend (silent on error — show candles without markers)
    const batchSignals = await fetchSignalsForRange(priceInterval, batchOldest, batchNewest);

    // Prepend candles and signals, re-render
    allCandles = [...deduped, ...allCandles];
    allSignals = [...batchSignals, ...allSignals].sort((a, b) => a.time - b.time);
    oldestCandleTime = allCandles[0].time;

    applyChartData();
  } catch (e) {
    console.error('[PriceChart] fetchOlderCandles failed', e);
  } finally {
    isFetchingHistory = false;
    document.getElementById('priceChartLoading').style.display = 'none';
  }
}
```

### 9b — Update `setPriceInterval` to reset state

- [ ] **Step 14: Replace `setPriceInterval`**

Current (around line 837):
```javascript
function setPriceInterval(interval) {
  priceInterval = interval;
  document.querySelectorAll('#priceIntervalTabs .range-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.interval === interval);
  });
  void loadPriceChart();
}
```

Replace with:
```javascript
function setPriceInterval(interval) {
  // Detach scroll listener and reset all chart state before reload
  if (priceChartScrollUnsubscribe) { priceChartScrollUnsubscribe(); priceChartScrollUnsubscribe = null; }
  allCandles = [];
  allSignals = [];
  oldestCandleTime = null;
  isFetchingHistory = false;
  candleSeriesRef = null;

  priceInterval = interval;
  document.querySelectorAll('#priceIntervalTabs .range-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.interval === interval);
  });
  void loadPriceChart();
}
```

---

## Task 10: Manual verification

- [ ] **Step 15: Start the app**

```bash
npm run dev
```

- [ ] **Step 16: Open the dashboard and verify initial load**

Open `http://localhost:3000`. On the Overview tab:
- The BTC Live Price chart should load with ~500 candles (much more history than before)
- Signal markers (gold circles) should appear on candles that had reversals
- Chart should show `fitContent` view on load

- [ ] **Step 17: Verify infinite scroll**

Scroll the chart to the left past the initial candles. Verify:
- "Loading history..." appears briefly in the chart header
- Older candles appear to the left as you scroll
- Signal markers remain on previously loaded candles (do not disappear on new loads)

- [ ] **Step 18: Verify interval switching**

Switch between intervals (e.g. 5m → 15m → 1h). Verify:
- Chart reloads cleanly for each interval
- No stale candles or duplicate markers
- Scroll history works independently per interval

- [ ] **Step 19: Commit frontend changes**

```bash
git add public/index.html
git commit -m "feat: historical BTC chart with Binance REST + infinite scroll"
```
