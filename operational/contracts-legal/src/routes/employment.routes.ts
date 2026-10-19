/**
 * Employment Agreements Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '#prisma';
import {
  CreateEmploymentAgreementSchema,
  UpdateEmploymentAgreementSchema,
  EmploymentQuerySchema,
  TerminateEmploymentSchema,
  createEmploymentRepository,
  createEmploymentService,
} from '../domain/employment-agreements/index.js';
import { authenticate, requirePermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

const canManageEmployment = requirePermissions('employment:manage');
const canViewEmployment = requirePermissions('employment:view');

export function createEmploymentRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createEmploymentRepository(prisma);
  const service = createEmploymentService(repository);

  router.get('/', authenticate, canViewEmployment, zValidator('query', EmploymentQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listAgreements(query);
    return c.json(result);
  });

  router.get('/reports/headcount', authenticate, canViewEmployment, async (c) => {
    const headcount = await service.getHeadcountByDepartment();
    return c.json(headcount);
  });

  router.get('/reports/ending', authenticate, canViewEmployment, async (c) => {
    const days = parseInt(c.req.query('days') || '30', 10);
    const agreements = await service.getEndingContracts(days);
    return c.json({ agreements, count: agreements.length });
  });

  router.get('/reports/probation', authenticate, canViewEmployment, async (c) => {
    const days = parseInt(c.req.query('days') || '14', 10);
    const agreements = await service.getProbationEnding(days);
    return c.json({ agreements, count: agreements.length });
  });

  router.get('/:id', authenticate, canViewEmployment, async (c) => {
    const id = c.req.param('id');
    const agreement = await service.getAgreement(id);
    return c.json(agreement);
  });

  router.get('/employee/:employeeId', authenticate, canViewEmployment, async (c) => {
    const employeeId = c.req.param('employeeId');
    const agreement = await service.getByEmployeeId(employeeId);
    return c.json(agreement);
  });

  router.post('/', authenticate, canManageEmployment, zValidator('json', CreateEmploymentAgreementSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const agreement = await service.createAgreement(input, user.id);
    logAuditEvent(c, 'CONTRACT_CREATED', 'EmploymentAgreement', agreement.id);
    return c.json(agreement, 201);
  });

  router.patch('/:id', authenticate, canManageEmployment, zValidator('json', UpdateEmploymentAgreementSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const agreement = await service.updateAgreement(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_UPDATED', 'EmploymentAgreement', id);
    return c.json(agreement);
  });

  router.post('/:id/terminate', authenticate, canManageEmployment, zValidator('json', TerminateEmploymentSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const agreement = await service.terminateAgreement(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_UPDATED', 'EmploymentAgreement', id);
    return c.json(agreement);
  });

  router.delete('/:id', authenticate, canManageEmployment, async (c) => {
    const id = c.req.param('id');
    await service.deleteAgreement(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'EmploymentAgreement', id);
    return c.json({ success: true });
  });

  return router;
}
