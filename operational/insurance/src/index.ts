/**
 * Insurance Service Entry Point
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';

const app = new Hono();

app.use('*', cors());
app.use('*', honoLogger());

app.get('/health', (c) => c.json({
  status: 'healthy',
  service: 'insurance',
  timestamp: new Date().toISOString(),
}));

app.get('/', (c) => c.json({
  service: 'insurance',
  version: '0.1.0',
  description: 'Insurance policy and claims management',
  domains: [
    'policy-management',
    'claims-management',
    'general-liability',
    'professional-liability',
    'property-insurance',
    'cyber-insurance',
    'workers-compensation',
    'product-liability'
  ]
}));

const port = parseInt(process.env.PORT || '3013');
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Insurance service running at http://localhost:${info.port}`);
});
