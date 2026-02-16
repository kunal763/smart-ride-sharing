import { Pool } from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'airport_pooling',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased from 2s to 5s
  // Allow queuing when pool is exhausted
  allowExitOnIdle: false,
  // Maximum time to wait for connection from pool
  acquireTimeoutMillis: 10000,
};

console.log('Connecting with User:', dbConfig.user);
console.log('Connecting with Pass:', dbConfig.password ? '***' : 'undefined');
console.log('Pool size:', dbConfig.max);

export const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Log pool stats periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  }, 30000); // Every 30 seconds
}

export default pool;
