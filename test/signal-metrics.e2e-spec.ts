import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { ErrorLogModule } from '../src/modules/error-log/error-log.module';
import { TelegramModule } from '../src/modules/telegram/telegram.module';
import { AlertModule } from '../src/modules/alert/alert.module';
import { PolymarketModule } from '../src/modules/polymarket/polymarket.module';
import { AnalyticsModule } from '../src/modules/analytics/analytics.module';

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function buildApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      EventEmitterModule.forRoot(),
      ConfigModule,
      DatabaseModule,
      ErrorLogModule,
      TelegramModule,
      AlertModule,
      PolymarketModule,
      AnalyticsModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();

  return { app, dataSource: moduleRef.get(DataSource) };
}

async function truncateAll(ds: DataSource) {
  await ds.query(
    `TRUNCATE alerts, polymarket_winners, wallet_profiles, signal_metrics, error_logs RESTART IDENTITY CASCADE`,
  );
}

async function seedSignalMetrics(ds: DataSource) {
  await ds.query(`
    INSERT INTO signal_metrics (
      signal_key, interval, direction,
      open, high, low, close, volume,
      candle_open_time, candle_close_time,
      snapshot_price, snapshot_delta, snapshot_delta_pct,
      body_size, body_size_pct,
      upper_wick, lower_wick, rejection_wick,
      signal_score
    ) VALUES
      (
        'reversal:BTCUSDT:5m:2000', '5m', 'green_to_red',
        50000, 50500, 49800, 49850, 100,
        1000, 2000,
        50100, -250, -0.499,
        150, 0.3,
        500, 50, 500,
        82
      ),
      (
        'reversal:BTCUSDT:5m:3000', '5m', 'red_to_green',
        49000, 49500, 48800, 49300, 80,
        2000, 3000,
        49200, 100, 0.204,
        300, 0.612,
        200, 200, 200,
        41
      ),
      (
        'reversal:BTCUSDT:15m:4000', '15m', 'green_to_red',
        48000, 48500, 47500, 47600, 200,
        3000, 4000,
        NULL, NULL, NULL,
        400, 0.833,
        500, 100, 500,
        33
      )
  `);
}

// ── Suite 1: GET /api/analytics/signals/top-scored ────────────────────────────

describe('GET /api/analytics/signals/top-scored (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await seedSignalMetrics(dataSource);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  it('returns 200 with signals ordered by signalScore DESC', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=0&limit=10')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    expect(parseFloat(res.body[0].signalScore)).toBe(82);
    expect(parseFloat(res.body[1].signalScore)).toBe(41);
    expect(parseFloat(res.body[2].signalScore)).toBe(33);
  });

  it('filters by minScore param', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=50')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(parseFloat(res.body[0].signalScore)).toBe(82);
  });

  it('respects the limit param', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=0&limit=2')
      .expect(200);

    expect(res.body.length).toBe(2);
  });

  it('returns rows with expected fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=0&limit=1')
      .expect(200);

    const row = res.body[0];
    expect(row).toHaveProperty('signalKey');
    expect(row).toHaveProperty('interval');
    expect(row).toHaveProperty('direction');
    expect(row).toHaveProperty('signalScore');
    expect(row).toHaveProperty('bodySize');
    expect(row).toHaveProperty('bodySizePct');
    expect(row).toHaveProperty('snapshotDeltaPct');
    expect(row).toHaveProperty('rejectionWick');
  });

  it('returns empty array when no signals meet minScore threshold', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=99')
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('defaults minScore=50 and limit=20 when params omitted', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored')
      .expect(200);

    // Only score=82 meets default minScore=50
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });
});

// ── Suite 2: GET /api/analytics/signals/:signalKey/metrics ────────────────────

describe('GET /api/analytics/signals/:signalKey/metrics (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await seedSignalMetrics(dataSource);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  it('returns 404 when signalKey not found', async () => {
    await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:5m:9999/metrics')
      .expect(404);
  });

  it('returns full signal_metrics row for a known signalKey', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:5m:2000/metrics')
      .expect(200);

    expect(res.body.signalKey).toBe('reversal:BTCUSDT:5m:2000');
    expect(res.body.interval).toBe('5m');
    expect(res.body.direction).toBe('green_to_red');
    expect(parseFloat(res.body.signalScore)).toBe(82);
    expect(parseFloat(res.body.bodySize)).toBeCloseTo(150);
    expect(parseFloat(res.body.rejectionWick)).toBeCloseTo(500);
    expect(parseFloat(res.body.snapshotDeltaPct)).toBeCloseTo(-0.499);
  });

  it('returns null snapshot fields for signals without a snapshot', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:15m:4000/metrics')
      .expect(200);

    expect(res.body.snapshotPrice).toBeNull();
    expect(res.body.snapshotDelta).toBeNull();
    expect(res.body.snapshotDeltaPct).toBeNull();
  });

  it('returns all expected candle fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:5m:2000/metrics')
      .expect(200);

    const row = res.body;
    expect(row).toHaveProperty('open');
    expect(row).toHaveProperty('high');
    expect(row).toHaveProperty('low');
    expect(row).toHaveProperty('close');
    expect(row).toHaveProperty('volume');
    expect(row).toHaveProperty('upperWick');
    expect(row).toHaveProperty('lowerWick');
    expect(row).toHaveProperty('createdAt');
  });
});

// ── Suite 3: GET /api/analytics/signals/:signalKey/candle (regression) ────────

describe('GET /api/analytics/signals/:signalKey/candle with stored metrics (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await seedSignalMetrics(dataSource);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  it('returns enriched data including signalScore when signal_metrics row exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:5m:2000/candle')
      .expect(200);

    expect(res.body).toHaveProperty('signalScore');
    expect(parseFloat(res.body.signalScore)).toBe(82);
    expect(res.body).toHaveProperty('snapshotDeltaPct');
    expect(res.body).toHaveProperty('rejectionWick');
    expect(res.body).toHaveProperty('bodySize');
    expect(parseFloat(res.body.open)).toBeCloseTo(50000);
    expect(parseFloat(res.body.close)).toBeCloseTo(49850);
  });
});

// ── Suite 4: Empty DB ─────────────────────────────────────────────────────────

describe('Signal metrics API — empty database (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/analytics/signals/top-scored returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/top-scored?minScore=0')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/signals/:key/metrics returns 404', async () => {
    await request(app.getHttpServer())
      .get('/api/analytics/signals/reversal:BTCUSDT:5m:0/metrics')
      .expect(404);
  });
});
