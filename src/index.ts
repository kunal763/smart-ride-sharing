import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import rideRoutes from './api/routes';
import userRoutes from './api/userRoutes';
import cabRoutes from './api/cabRoutes';
import { swaggerSpec } from './api/swagger';
import { CronService } from './services/CronService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const cronService = new CronService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting (disabled in development for load testing)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later',
  skip: (req) => process.env.NODE_ENV === 'development' // Skip rate limiting in dev
});

app.use('/api/', limiter);

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '300'));
  next();
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/rides', rideRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cabs', cabRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
async function start() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log('✓ Redis connected');
    
    // Start cron service for auto-completing rides
    cronService.start();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      
      // Memory monitoring in development
      if (process.env.NODE_ENV === 'development') {
        setInterval(() => {
          const used = process.memoryUsage();
          console.log('Memory:', {
            rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(used.external / 1024 / 1024)}MB`
          });
        }, 30000); // Every 30 seconds
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  cronService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  cronService.stop();
  process.exit(0);
});

start();

export default app;
