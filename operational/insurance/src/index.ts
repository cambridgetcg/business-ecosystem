/**
 * Insurance Service Entry Point
 *
 * Comprehensive insurance policy and claims management service.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import { policyRoutes } from './api/routes/policies.js';
import { claimRoutes } from './api/routes/claims.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize event bus
const RABBITMQ_URL = process.env.RABBITMQ_URL;
let eventBusInitialized = false;

async function initMessaging() {
  if (RABBITMQ_URL) {
    try {
      await initializeEventBus(RABBITMQ_URL, { prisma });
      eventBusInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize event bus:', error);
    }
  } else {
    console.log('[Insurance] RABBITMQ_URL not configured - events disabled');
  }
}

initMessaging();

// Declare types for context
declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient;
    userId?: string;
  }
}

const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', honoLogger());

// Inject Prisma into context
app.use('*', async (c, next) => {
  c.set('prisma', prisma);
  // Extract userId from auth header if present
  const authHeader = c.req.header('x-user-id');
  if (authHeader) {
    c.set('userId', authHeader);
  }
  await next();
});

// Health check
app.get('/health', (c) => c.json({
  status: 'healthy',
  service: 'insurance',
  timestamp: new Date().toISOString(),
  eventBus: eventBusInitialized ? 'connected' : 'disabled',
}));

// Service info
app.get('/', (c) => c.json({
  service: 'insurance',
  version: '0.1.0',
  description: 'Insurance policy and claims management',
  endpoints: {
    policies: '/api/v1/policies',
    claims: '/api/v1/claims',
  },
  features: [
    'Policy lifecycle management',
    'Multi-insurer support (coinsurance/layered programs)',
    'Claims processing workflow',
    'Reserve management',
    'Payment tracking',
    'Document management',
    'Certificate of insurance generation',
    'Renewal automation',
    'UK IPT calculation',
    'Employers liability compliance',
  ],
  policyTypes: [
    'directors_officers (D&O)',
    'professional_indemnity (PI/E&O)',
    'public_liability',
    'employers_liability',
    'cyber_liability',
    'property',
    'business_interruption',
    'product_liability',
    'motor_fleet',
    'keyman',
    'trade_credit',
    'marine_cargo',
  ],
}));

// Mount routes
app.route('/api/v1/policies', policyRoutes);
app.route('/api/v1/claims', claimRoutes);

// Error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message,
  }, 500);
});

// Not found handler
app.notFound((c) => c.json({
  error: 'Not found',
  path: c.req.path,
}, 404));

// Start server
const port = parseInt(process.env.PORT || '3013');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await shutdownEventBus();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await shutdownEventBus();
  await prisma.$disconnect();
  process.exit(0);
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Insurance service running at http://localhost:${info.port}`);
  console.log(`API endpoints: /api/v1/policies, /api/v1/claims`);
  console.log(`Event bus: ${eventBusInitialized ? 'enabled' : 'disabled'}`);
});

export { app, prisma };
