import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { initSocket } from './socket';
import { workerManager } from './workers/worker-manager';
import authRoutes from './routes/auth';
import vesselRoutes from './routes/vessels';
import spotRoutes from './routes/spots';
import tractorRoutes from './routes/tractor';
import activityRoutes from './routes/activity';
import reservationRoutes from './routes/reservations';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'https://elireuven.online')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc from server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Health check with worker statuses
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    workers: workerManager.getStatuses(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vessels', vesselRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/tractor', tractorRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

// Initialize Socket.io
initSocket(server);

const PORT = parseInt(process.env.PORT || '3001');
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Marina backend running on port ${PORT}`);

  // Initialize and start all background workers
  workerManager.init();
  workerManager.startAll();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  workerManager.stopAll();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  workerManager.stopAll();
  server.close(() => process.exit(0));
});
