import http from 'http';
import path from 'path';
import fs from 'fs';
import { logger } from '../../lib/logger';
import { getPool, query } from '../../lib/db';

const MODULE = 'health';

const chartHtml = fs.readFileSync(path.join(__dirname, 'chart.html'), 'utf-8');

interface ServerConfig {
  symbols: string[];
  intervals: string[];
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(idx + 1).split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function startHealthServer(port: number, config: ServerConfig): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0];

    try {
      if (pathname === '/api/health') {
        const pool = getPool();
        await pool.query('SELECT 1');
        json(res, { status: 'ok', timestamp: new Date().toISOString() });
        return;
      }

      if (pathname === '/api/config') {
        json(res, { symbols: config.symbols, intervals: config.intervals });
        return;
      }

      if (pathname === '/api/candles') {
        const q = parseQuery(url);
        const symbol = q.symbol || 'BTCUSDT';
        const interval = q.interval || '1m';
        const limit = Math.min(parseInt(q.limit || '100', 10), 1000);

        const result = await query<{
          symbol: string; interval: string; open_time: string; close_time: string;
          open: string; high: string; low: string; close: string; volume: string;
        }>(
          `SELECT symbol, interval, open_time, close_time, open, high, low, close, volume
           FROM candles
           WHERE symbol = $1 AND interval = $2 AND is_closed = TRUE
           ORDER BY close_time DESC
           LIMIT $3`,
          [symbol, interval, limit]
        );

        const candles = result.rows
          .map(r => ({
            symbol: r.symbol,
            interval: r.interval,
            openTime: Number(r.open_time),
            closeTime: Number(r.close_time),
            open: parseFloat(r.open),
            high: parseFloat(r.high),
            low: parseFloat(r.low),
            close: parseFloat(r.close),
            volume: parseFloat(r.volume),
          }))
          .reverse();

        json(res, candles);
        return;
      }

      if (pathname === '/api/alerts') {
        const q = parseQuery(url);
        const symbol = q.symbol || 'BTCUSDT';
        const interval = q.interval || '1m';

        const result = await query<{
          symbol: string; interval: string; signal_type: string;
          signal_key: string; last_candle_close_time: string; sent_at: Date;
        }>(
          `SELECT symbol, interval, signal_type, signal_key, last_candle_close_time, sent_at
           FROM alerts
           WHERE symbol = $1 AND interval = $2
           ORDER BY sent_at DESC
           LIMIT 100`,
          [symbol, interval]
        );

        const alerts = result.rows.map(r => ({
          symbol: r.symbol,
          interval: r.interval,
          signalType: r.signal_type,
          signalKey: r.signal_key,
          lastCandleCloseTime: Number(r.last_candle_close_time),
          sentAt: r.sent_at,
        }));

        json(res, alerts);
        return;
      }

      // Serve the chart UI for root and any other path
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(chartHtml);
    } catch (err) {
      logger.error('Server request error', { module: MODULE, data: err instanceof Error ? err.message : String(err) });
      json(res, { error: 'Internal server error' }, 500);
    }
  });

  server.listen(port, () => {
    logger.info(`Server listening on port ${port}`, { module: MODULE });
  });

  return server;
}
