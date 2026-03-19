import { execSync } from 'child_process';

export default async function globalTeardown() {
  if (process.env.KEEP_TEST_DB) {
    console.log(
      '\nSkipping teardown — KEEP_TEST_DB is set. Tables were truncated by afterEach.',
    );
    return;
  }

  console.log('\nStopping test database...');
  execSync('docker-compose -f docker-compose.test.yml down -v', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}
