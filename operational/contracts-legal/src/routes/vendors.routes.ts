/**
 * Vendor Contracts Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '#prisma';
import {
  CreateVendorContractSchema,
  UpdateVendorContractSchema,
  VendorContractQuerySchema,
  createVendorContractRepository,
  createVendorContractService,
} from '../domain/vendor-contracts/index.js';
import { authenticate, contractPermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

export function createVendorsRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createVendorContractRepository(prisma);
  const service = createVendorContractService(repository);

  router.get('/', authenticate, contractPermissions.canRead, zValidator('query', VendorContractQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listContracts(query);
    return c.json(result);
  });

  router.get('/:id', authenticate, contractPermissions.canRead, async (c) => {
    const id = c.req.param('id');
    const contract = await service.getContract(id);
    return c.json(contract);
  });

  router.post('/', authenticate, contractPermissions.canCreate, zValidator('json', CreateVendorContractSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const contract = await service.createContract(input, user.id);
    logAuditEvent(c, 'CONTRACT_CREATED', 'VendorContract', contract.id);
    return c.json(contract, 201);
  });

  router.patch('/:id', authenticate, contractPermissions.canUpdate, zValidator('json', UpdateVendorContractSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const contract = await service.updateContract(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_UPDATED', 'VendorContract', id);
    return c.json(contract);
  });

  router.delete('/:id', authenticate, contractPermissions.canDelete, async (c) => {
    const id = c.req.param('id');
    await service.deleteContract(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'VendorContract', id);
    return c.json({ success: true });
  });

  router.get('/:id/spend', authenticate, contractPermissions.canRead, async (c) => {
    const id = c.req.param('id');
    const contract = await service.getContract(id);
    const party = contract.parties[0];
    if (!party) return c.json({ total: 0, count: 0 });
    const spend = await service.getVendorSpend(party.partyId);
    return c.json(spend);
  });

  router.get('/reports/expiring', authenticate, contractPermissions.canRead, async (c) => {
    const days = parseInt(c.req.query('days') || '30', 10);
    const contracts = await service.getExpiringContracts(days);
    return c.json({ contracts, count: contracts.length });
  });

  return router;
}
