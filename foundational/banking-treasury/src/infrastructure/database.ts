import { Pool } from 'pg';
import { env } from '../env.js';
import { getDatabaseCredentials, buildDatabaseUrl } from './aws/secrets.js';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  let connectionString: string;

  if (env.DATABASE_URL) {
    connectionString = env.DATABASE_URL;
  } else if (env.USE_AWS_SECRETS) {
    const credentials = await getDatabaseCredentials();
    connectionString = buildDatabaseUrl(credentials);
  } else {
    throw new Error('Database configuration missing: set DATABASE_URL or USE_AWS_SECRETS=true');
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  // Test connection
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  
  console.log('Database connection established');
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection closed');
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
