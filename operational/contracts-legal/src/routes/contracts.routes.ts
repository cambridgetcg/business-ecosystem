/**
 * Customer Contracts Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '#prisma';
import {
  CreateContractSchema,
  UpdateContractSchema,
  ContractQuerySchema,
  SignContractSchema,
  createContractRepository,
  createCustomerContractService,
} from '../domain/customer-contracts/index.js';
import { authenticate, contractPermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

export function createContractsRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createContractRepository(prisma);
  const service = createCustomerContractService(repository);

  // List contracts
  router.get('/', authenticate, contractPermissions.canRead, zValidator('query', ContractQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listContracts(query);
    return c.json(result);
  });

  // Get single contract
  router.get('/:id', authenticate, contractPermissions.canRead, async (c) => {
    const id = c.req.param('id');
    const contract = await service.getContract(id);
    return c.json(contract);
  });

  // Create contract
  router.post('/', authenticate, contractPermissions.canCreate, zValidator('json', CreateContractSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const contract = await service.createContract(input, user.id);
    logAuditEvent(c, 'CONTRACT_CREATED', 'Contract', contract.id);
    return c.json(contract, 201);
  });

  // Update contract
  router.patch('/:id', authenticate, contractPermissions.canUpdate, zValidator('json', UpdateContractSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const contract = await service.updateContract(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_UPDATED', 'Contract', id);
    return c.json(contract);
  });

  // Delete contract
  router.delete('/:id', authenticate, contractPermissions.canDelete, async (c) => {
    const id = c.req.param('id');
    await service.deleteContract(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'Contract', id);
    return c.json({ success: true });
  });

  // Submit for review
  router.post('/:id/submit-review', authenticate, contractPermissions.canUpdate, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const contract = await service.submitForReview(id, user.id);
    return c.json(contract);
  });

  // Approve contract
  router.post('/:id/approve', authenticate, contractPermissions.canApprove, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const contract = await service.approveContract(id, user.id);
    logAuditEvent(c, 'CONTRACT_APPROVED', 'Contract', id);
    return c.json(contract);
  });

  // Sign contract
  router.post('/:id/sign', authenticate, contractPermissions.canSign, zValidator('json', SignContractSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const contract = await service.signContract(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_SIGNED', 'Contract', id);
    return c.json(contract);
  });

  // Terminate contract
  router.post('/:id/terminate', authenticate, contractPermissions.canUpdate, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const contract = await service.terminateContract(id, user.id);
    return c.json(contract);
  });

  // Renew contract
  router.post('/:id/renew', authenticate, contractPermissions.canUpdate, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const contract = await service.renewContract(id, user.id);
    return c.json(contract);
  });

  // Get expiring contracts
  router.get('/reports/expiring', authenticate, contractPermissions.canRead, async (c) => {
    const days = parseInt(c.req.query('days') || '30', 10);
    const contracts = await service.getExpiringContracts(days);
    return c.json({ contracts, count: contracts.length });
  });

  return router;
}
