import 'dotenv/config';
import app from './app';
import { prisma } from './config/database';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');
  } catch (err) {
    // DB unavailable — start anyway; AWS routes work, OTP-dependent routes will return 503
    console.warn('[DB] WARNING: Could not connect to PostgreSQL —', (err as Error).message);
    console.warn('[DB] Server starting in degraded mode. Kill-switch OTP routes will be unavailable.');
  }

  app.listen(PORT, () => {
    console.log(`[Server] Ad Astra API running → http://localhost:${PORT}`);
    console.log(`[Server] Health check  → http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
