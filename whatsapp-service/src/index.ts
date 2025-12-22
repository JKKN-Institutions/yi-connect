/**
 * Yi WhatsApp Service - Express API Server
 *
 * Persistent WhatsApp service for Yi Connect.
 * Runs on Railway with Chromium for whatsapp-web.js.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectRouter } from './routes/connect';
import { statusRouter } from './routes/status';
import { sendRouter } from './routes/send';
import { bulkRouter } from './routes/bulk';
import { disconnectRouter } from './routes/disconnect';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://yi-connect-app.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Key authentication middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!process.env.API_KEY) {
    console.error('[Auth] API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
});

// Routes
app.use('/connect', connectRouter);
app.use('/status', statusRouter);
app.use('/send', sendRouter);
app.use('/send-bulk', bulkRouter);
app.use('/disconnect', disconnectRouter);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`[WhatsApp Service] Running on port ${PORT}`);
  console.log(`[WhatsApp Service] Allowed origins: ${allowedOrigins.join(', ')}`);
});
