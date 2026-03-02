import 'dotenv/config';
import app from './app';
import { prisma } from './config/database';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function main() {
  // Verify DB connection before accepting traffic
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL via Prisma');

  app.listen(PORT, () => {
    console.log(`[Server] Ad Astra API running → http://localhost:${PORT}`);
    console.log(`[Server] Health check  → http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
