import { execSync } from 'child_process';
import * as net from 'net';

export default async function globalSetup() {
  console.log('\nStarting test database...');

  execSync('docker-compose -f docker-compose.test.yml up -d', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  await waitForPort('localhost', 5433, 30_000);

  console.log('Test database ready.\n');
}

function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      const socket = net.createConnection(port, host);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port} after ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    }

    attempt();
  });
}
