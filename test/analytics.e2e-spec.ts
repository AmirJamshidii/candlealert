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

// ── Shared helpers ────────────────────────────────────────────────────────────

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
  await ds.query(`TRUNCATE alerts, polymarket_winners, error_logs RESTART IDENTITY CASCADE`);
}

// ── Suite 1: Seeded data (happy paths + ordering + pagination) ────────────────

describe('Analytics API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`
      INSERT INTO alerts (signal_key, chat_id, interval, candle_close_time)
      VALUES
        ('5m:1710000000000', '123', '5m', 1710000000000),
        ('5m:1710000300000', '123', '5m', 1710000300000),
        ('15m:1710000000000', '123', '15m', 1710000000000)
    `);

    await dataSource.query(`
      INSERT INTO polymarket_winners
        (signal_key, market_id, market_question, wallet_address, position_size, outcome_side, candle_interval, candle_close_time)
      VALUES
        ('5m:1710000000000', 'mkt1', 'BTC Up/Down 5m', '0xabc', 100.5, 'Down', '5m', 1710000000000),
        ('5m:1710000000000', 'mkt1', 'BTC Up/Down 5m', '0xdef', 50.0,  'Down', '5m', 1710000000000),
        ('5m:1710000300000', 'mkt2', 'BTC Up/Down 5m', '0xabc', 200.0, 'Down', '5m', 1710000300000)
    `);

    await dataSource.query(`
      INSERT INTO error_logs (module, message)
      VALUES ('alert', 'Test error 1'), ('polymarket', 'Test error 2')
    `);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  // ── /api/analytics/signals/summary ──────────────────────────────────────────

  describe('GET /api/analytics/signals/summary', () => {
    it('returns alert counts grouped by interval', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/summary')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const fiveMin = res.body.find((r: { interval: string }) => r.interval === '5m');
      const fifteenMin = res.body.find((r: { interval: string }) => r.interval === '15m');
      expect(fiveMin?.count).toBe(2);
      expect(fifteenMin?.count).toBe(1);
    });

    it('returns only intervals that have data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/summary')
        .expect(200);

      const intervals = res.body.map((r: { interval: string }) => r.interval);
      // 1h has no alerts in seed — must not appear
      expect(intervals).not.toContain('1h');
    });
  });

  // ── /api/analytics/signals/timeline ─────────────────────────────────────────

  describe('GET /api/analytics/signals/timeline', () => {
    it('returns daily counts with date and count fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/timeline?days=7')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('date');
      expect(res.body[0]).toHaveProperty('count');
    });

    it('defaults to 7 days when no query param supplied', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/timeline')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('days=1 includes today\'s seeded alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/timeline?days=1')
        .expect(200);

      // All seeded alerts have sent_at = NOW(), so they fall within a 1-day window
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const total = res.body.reduce((sum: number, r: { count: number }) => sum + r.count, 0);
      expect(total).toBe(3);
    });

    it('days=0 returns empty array (zero-length window excludes all rows)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/signals/timeline?days=0')
        .expect(200);

      // WHERE sent_at >= NOW() - interval '0 days' = WHERE sent_at >= NOW()
      // Rows inserted in a prior transaction always have sent_at < current NOW()
      expect(res.body).toEqual([]);
    });
  });

  // ── /api/analytics/winners/leaderboard ──────────────────────────────────────

  describe('GET /api/analytics/winners/leaderboard', () => {
    it('returns wallets sorted by total position descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/leaderboard?limit=10')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      // 0xabc: 100.5 + 200.0 = 300.5, 0xdef: 50.0
      expect(res.body[0].walletAddress).toBe('0xabc');
      expect(res.body[0].totalPosition).toBeCloseTo(300.5);
      expect(res.body[0].signalCount).toBe(2);
    });

    it('filters by interval — excludes other intervals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/leaderboard?interval=15m')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0); // no 15m winners in seed
    });

    it('filters by interval=5m and includes the 5m wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/leaderboard?interval=5m')
        .expect(200);

      const wallets = res.body.map((r: { walletAddress: string }) => r.walletAddress);
      expect(wallets).toContain('0xabc');
    });

    it('respects limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/leaderboard?limit=1')
        .expect(200);

      expect(res.body.length).toBe(1);
    });
  });

  // ── /api/analytics/winners/by-signal/:signalKey ──────────────────────────────

  describe('GET /api/analytics/winners/by-signal/:signalKey', () => {
    it('returns all winners for the given signal', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/by-signal/5m:1710000000000')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('returns empty array for unknown signal', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/by-signal/unknown:0')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns results ordered by positionSize descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/winners/by-signal/5m:1710000000000')
        .expect(200);

      // 0xabc = 100.5, 0xdef = 50.0 — highest first
      expect(res.body[0].walletAddress).toBe('0xabc');
      expect(parseFloat(res.body[0].positionSize)).toBeCloseTo(100.5);
      expect(parseFloat(res.body[1].positionSize)).toBeCloseTo(50.0);
    });
  });

  // ── /api/analytics/holders/leaderboard ──────────────────────────────────────

  describe('GET /api/analytics/holders/leaderboard', () => {
    it('returns holders sorted by signal count descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/holders/leaderboard?days=30')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].walletAddress).toBe('0xabc');
      expect(res.body[0].signalCount).toBe(2);
      expect(res.body[0].totalPosition).toBeCloseTo(300.5);
    });

    it('filters by interval — excludes other intervals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/holders/leaderboard?days=30&interval=15m')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('respects limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/holders/leaderboard?days=30&limit=1')
        .expect(200);

      expect(res.body.length).toBe(1);
    });
  });

  // ── /api/analytics/holders/:walletAddress ───────────────────────────────────

  describe('GET /api/analytics/holders/:walletAddress', () => {
    it('returns all signals a wallet appeared in', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/holders/0xabc')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('returns empty array for unknown wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/holders/0xunknown')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    describe('ordering by createdAt descending', () => {
      beforeEach(async () => {
        // Insert with explicit timestamps so ordering is deterministic
        await dataSource.query(`
          INSERT INTO polymarket_winners
            (signal_key, market_id, market_question, wallet_address, position_size, outcome_side, candle_interval, candle_close_time, created_at)
          VALUES
            ('old:111', 'mktX', 'Q', '0xorder', 10, 'Down', '5m', 111, NOW() - INTERVAL '1 hour'),
            ('new:222', 'mktX', 'Q', '0xorder', 20, 'Down', '5m', 222, NOW())
        `);
      });

      it('returns the most recent signal first', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/analytics/holders/0xorder')
          .expect(200);

        expect(res.body.length).toBe(2);
        expect(res.body[0].signalKey).toBe('new:222');
        expect(res.body[1].signalKey).toBe('old:111');
      });
    });
  });

  // ── /api/analytics/errors ────────────────────────────────────────────────────

  describe('GET /api/analytics/errors', () => {
    it('returns recent error logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/errors')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('filters by module', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/errors?module=alert')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].module).toBe('alert');
    });

    it('respects the limit param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/errors?limit=1')
        .expect(200);

      expect(res.body.length).toBe(1);
    });

    it('returns error objects with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/analytics/errors?limit=1')
        .expect(200);

      const err = res.body[0];
      expect(err).toHaveProperty('id');
      expect(err).toHaveProperty('message');
      expect(err).toHaveProperty('createdAt');
    });
  });
});

// ── Suite 2: Empty database ───────────────────────────────────────────────────

describe('Analytics API — empty database (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await buildApp());
    // Ensure tables are empty before this suite runs
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/analytics/signals/summary returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/summary')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/signals/timeline returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/signals/timeline?days=7')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/winners/leaderboard returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/winners/leaderboard')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/winners/by-signal/:signalKey returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/winners/by-signal/5m:0')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/holders/leaderboard returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/holders/leaderboard?days=30')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/holders/:walletAddress returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/holders/0xanybody')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/analytics/errors returns []', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics/errors')
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
