/**
 * Travel Journal Backend — Entry Point
 *
 * Stack:
 *  - Express 4  (HTTP server)
 *  - Firebase Admin SDK  (Auth + Firestore + Storage)
 *  - Google Cloud Vision API  (AI image tagging)
 *
 * API Base: /v1
 *
 * Routes:
 *  POST   /v1/auth/login       → verify Firebase token + upsert user
 *  GET    /v1/auth/me          → get current user profile
 *  POST   /v1/auth/logout      → revoke refresh tokens
 *
 *  GET    /v1/entries          → list all entries for user
 *  GET    /v1/entries/search   → search + filter entries
 *  GET    /v1/entries/:id      → get single entry
 *  POST   /v1/entries          → create entry
 *  PUT    /v1/entries/:id      → update entry
 *  DELETE /v1/entries/:id      → soft-delete entry
 *
 *  POST   /v1/sync             → offline sync (push + pull)
 *
 *  POST   /v1/upload/photo     → upload image → Firebase Storage → AI tags
 *
 *  GET    /health              → health check
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { initFirebase } from './config/firebase';
import { logger } from './config/logger';
import { errorHandler, notFound } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import entryRoutes from './routes/entries';
import syncRoutes from './routes/sync';
import uploadRoutes from './routes/upload';

// ─── Initialise Firebase ──────────────────────────────────────────
initFirebase();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ─── Security middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:*', 'capacitor://*', 'ionic://*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate limiting ────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  message: { success: false, error: 'Too many requests' },
});
app.use('/v1', limiter);

// ─── General middleware ───────────────────────────────────────────
app.use(compression());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    firebase: process.env.FIREBASE_PROJECT_ID,
  });
});

// ─── API Routes ───────────────────────────────────────────────────
app.use('/v1/auth', authRoutes);
app.use('/v1/entries', entryRoutes);
app.use('/v1/sync', syncRoutes);
app.use('/v1/upload', uploadRoutes);

// ─── Error handling ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Travel Journal API running on http://localhost:${PORT}`);
  logger.info(`📚 Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
