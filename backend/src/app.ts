import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { awsCredentialsMiddleware } from './middleware/awsCredentials';
import apiRouter from './routes/index';

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3800',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      // AWS
      'x-aws-access-key-id',
      'x-aws-secret-access-key',
      'x-aws-region',
      // DigitalOcean
      'x-do-api-token',
      'x-do-spaces-key',
      'x-do-spaces-secret',
      'x-do-spaces-region',
      'x-do-spaces-bucket',
      // Google Cloud Platform
      'x-gcp-project-id',
      'x-gcp-credentials',
      // Azure
      'x-azure-subscription-id',
      'x-azure-tenant-id',
      'x-azure-client-id',
      'x-azure-client-secret',
    ],
  }),
);
app.use(express.json());
app.use(requestLogger);
app.use(awsCredentialsMiddleware); // attach per-request AWS clients from headers

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
