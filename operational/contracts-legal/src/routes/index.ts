/**
 * Routes Index - Aggregates all route modules
 */

import { Hono } from 'hono';
import { PrismaClient } from '#prisma';
import { createContractsRouter } from './contracts.routes.js';
import { createVendorsRouter } from './vendors.routes.js';
import { createEmploymentRouter } from './employment.routes.js';
import { createTemplatesRouter } from './templates.routes.js';
import { createMattersRouter } from './matters.routes.js';
import { createPropertiesRouter } from './properties.routes.js';
import { createOperationsRouter } from './operations.routes.js';
import { createESignatureRouter } from './esignature.routes.js';
import { createDiscoveryRouter } from './discovery.routes.js';
import { createForceMajeureRouter } from './force-majeure.routes.js';
import { createBreachRouter } from './breach.routes.js';
import { createRevenueRouter } from './revenue.routes.js';
import { createCovenantsRouter } from './covenants.routes.js';

export function createRoutes(prisma: PrismaClient) {
  const api = new Hono();

  // Contract domains
  api.route('/contracts', createContractsRouter(prisma));
  api.route('/vendors', createVendorsRouter(prisma));
  api.route('/employment', createEmploymentRouter(prisma));
  api.route('/templates', createTemplatesRouter(prisma));

  // Legal domains
  api.route('/matters', createMattersRouter(prisma));
  api.route('/properties', createPropertiesRouter(prisma));
  api.route('/operations', createOperationsRouter(prisma));

  // Phase 2: E-Signature and Discovery
  api.route('/esignatures', createESignatureRouter(prisma));
  api.route('/discovery', createDiscoveryRouter(prisma));

  // Phase 3: Contract Performance
  api.route('/force-majeure', createForceMajeureRouter(prisma));
  api.route('/breach', createBreachRouter(prisma));

  // Phase 4: Revenue and Covenants
  api.route('/revenue', createRevenueRouter(prisma));
  api.route('/covenants', createCovenantsRouter(prisma));

  return api;
}
