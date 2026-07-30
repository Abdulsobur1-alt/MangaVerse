import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { titlesRouter } from './routes/titles.js';
import { chaptersRouter } from './routes/chapters.js';
import { usersRouter } from './routes/users.js';
import { libraryRouter } from './routes/library.js';
import { readingRouter } from './routes/reading.js';
import { searchRouter } from './routes/search.js';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Global Middleware ─────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});
app.use(limiter);

// ─── Routes ───────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/titles', titlesRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/users', usersRouter);
app.use('/api/library', libraryRouter);
app.use('/api/reading', readingRouter);
app.use('/api/search', searchRouter);

// ─── Error Handling ───────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────

app.listen(PORT, () => {
  console.log(`⚡ MangaVerse API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

export default app;
