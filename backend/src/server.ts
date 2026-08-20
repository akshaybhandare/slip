import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDb, getDb } from './db';
import authRouter from './routes/auth';
import bookmarksRouter from './routes/bookmarks';
import shareRouter from './routes/share';
import ioRouter from './routes/io';
import aiRouter from './routes/ai';
import clipsRouter from './routes/clips';
import { CACHE_DIR, isSafeFilename } from './services/thumbnail';

// Load environmental variables from the project root
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.resolve(projectRoot, '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS for local network and web access
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['image/*', 'application/pdf', 'application/octet-stream'], limit: '50mb' }));

// Set secure headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; object-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
  );
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/share', shareRouter);
app.use('/api/io', ioRouter);
app.use('/api/ai', aiRouter);

// Cached Thumbnail & File Serving
app.get('/api/cache/:filename', (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ message: 'Invalid or unsafe filename' });
  }

  const filePath = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (err: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
  }
});

// Serve frontend static build if it exists
const rawDist = process.env.FRONTEND_DIST || 'frontend/dist';
const frontendDist = path.isAbsolute(rawDist) ? rawDist : path.resolve(projectRoot, rawDist);
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start listening if not running tests
if (process.env.NODE_ENV !== 'test') {
  try {
    initDb();
    app.listen(PORT, HOST, () => {
      console.log(`Slip server running on http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database and start server:', err);
    process.exit(1);
  }
}

export default app;
