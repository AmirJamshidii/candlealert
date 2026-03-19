import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { ErrorLogModule } from '../src/modules/error-log/error-log.module';
import { TelegramModule } from '../src/modules/telegram/telegram.module';
import { AlertModule } from '../src/modules/alert/alert.module';
import { PolymarketModule } from '../src/modules/polymarket/polymarket.module';
import { HealthModule } from '../src/modules/health/health.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        ConfigModule,
        DatabaseModule,
        ErrorLogModule,
        TelegramModule,
        AlertModule,
        PolymarketModule,
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── /api/health ──────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns status ok with a timestamp', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.timestamp).toBe('string');
      expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  // ── /api/config ──────────────────────────────────────────────────────────────

  describe('GET /api/config', () => {
    it('returns symbol, intervals array, and polymarketWinnerCount', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/config')
        .expect(200);
      expect(res.body.symbol).toBe('BTCUSDT');
      expect(Array.isArray(res.body.intervals)).toBe(true);
      expect(res.body.intervals.length).toBeGreaterThan(0);
      expect(typeof res.body.polymarketWinnerCount).toBe('number');
    });
  });

  // ── /api/alerts ──────────────────────────────────────────────────────────────

  describe('GET /api/alerts', () => {
    beforeEach(async () => {
      await dataSource.query(`
        INSERT INTO alerts (signal_key, chat_id, interval, candle_close_time)
        VALUES
          ('5m:1000', '111', '5m', 1000),
          ('5m:2000', '111', '5m', 2000),
          ('15m:3000', '111', '15m', 3000)
      `);
    });

    afterEach(async () => {
      await dataSource.query(
        `TRUNCATE alerts, polymarket_winners, error_logs RESTART IDENTITY CASCADE`,
      );
    });

    it('returns [] when no alerts exist', async () => {
      await dataSource.query(`TRUNCATE alerts RESTART IDENTITY CASCADE`);
      const res = await request(app.getHttpServer())
        .get('/api/alerts')
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns all seeded alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
    });

    it('returns alerts ordered by sentAt descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts')
        .expect(200);
      const dates = res.body.map((r: { sentAt: string }) =>
        new Date(r.sentAt).getTime(),
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('respects the ?limit param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts?limit=1')
        .expect(200);
      expect(res.body.length).toBe(1);
    });

    it('returns alert objects with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts?limit=1')
        .expect(200);
      const alert = res.body[0];
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('signalKey');
      expect(alert).toHaveProperty('chatId');
      expect(alert).toHaveProperty('interval');
      expect(alert).toHaveProperty('sentAt');
    });
  });

  // ── /api/winners ─────────────────────────────────────────────────────────────

  describe('GET /api/winners', () => {
    beforeEach(async () => {
      await dataSource.query(`
        INSERT INTO polymarket_winners
          (signal_key, market_id, market_question, wallet_address, position_size, outcome_side, candle_interval, candle_close_time)
        VALUES
          ('5m:1000', 'mkt1', 'Q1', '0xaaa', 500.0, 'Down', '5m', 1000),
          ('5m:2000', 'mkt2', 'Q2', '0xbbb', 250.0, 'Down', '5m', 2000),
          ('15m:3000', 'mkt3', 'Q3', '0xccc', 100.0, 'Down', '15m', 3000)
      `);
    });

    afterEach(async () => {
      await dataSource.query(
        `TRUNCATE alerts, polymarket_winners, error_logs RESTART IDENTITY CASCADE`,
      );
    });

    it('returns [] when no winners exist', async () => {
      await dataSource.query(
        `TRUNCATE polymarket_winners RESTART IDENTITY CASCADE`,
      );
      const res = await request(app.getHttpServer())
        .get('/api/winners')
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('returns all seeded winners', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/winners')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
    });

    it('returns winners ordered by createdAt descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/winners')
        .expect(200);
      const dates = res.body.map((r: { createdAt: string }) =>
        new Date(r.createdAt).getTime(),
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('respects the ?limit param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/winners?limit=2')
        .expect(200);
      expect(res.body.length).toBe(2);
    });

    it('returns winner objects with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/winners?limit=1')
        .expect(200);
      const winner = res.body[0];
      expect(winner).toHaveProperty('id');
      expect(winner).toHaveProperty('signalKey');
      expect(winner).toHaveProperty('walletAddress');
      expect(winner).toHaveProperty('positionSize');
      expect(winner).toHaveProperty('outcomeSide');
      expect(winner).toHaveProperty('createdAt');
    });
  });
});
