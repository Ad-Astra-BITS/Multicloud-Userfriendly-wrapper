import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFound } from './middleware/errorHandler';
import apiRouter from './routes/index';

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3800',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
