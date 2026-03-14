import http from 'http';
import { logger } from '../../lib/logger';
import { getPool } from '../../lib/db';

const MODULE = 'health';

export function startHealthServer(port: number): http.Server {
  const server = http.createServer(async (_req, res) => {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', timestamp: new Date().toISOString() }));
    }
  });

  server.listen(port, () => {
    logger.info(`Health server listening on port ${port}`, { module: MODULE });
  });

  return server;
}
