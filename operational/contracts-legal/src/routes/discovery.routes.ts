/**
 * Discovery Routes (EDRM Compliance)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient, HoldStatus, DiscoveryType, ResponseStatus, PrivilegeType } from '#prisma';
import { z } from 'zod';
import { createDiscoveryService } from '../domain/litigation/services/discovery.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageDiscovery = requirePermissions('litigation:discovery:manage');
const canViewDiscovery = requirePermissions('litigation:discovery:view');

// Validation Schemas
const HoldStatusEnum = z.enum(['ACTIVE', 'RELEASED', 'PARTIALLY_RELEASED', 'SUPERSEDED']);
const DiscoveryTypeEnum = z.enum(['INTERROGATORY', 'REQUEST_FOR_PRODUCTION', 'REQUEST_FOR_ADMISSION', 'DEPOSITION', 'SUBPOENA']);
const ResponseStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'OBJECTED', 'RESPONDED', 'OVERDUE', 'CLOSED']);
const PrivilegeTypeEnum = z.enum(['ATTORNEY_CLIENT', 'WORK_PRODUCT', 'COMMON_INTEREST', 'JOINT_DEFENSE', 'DELIBERATIVE_PROCESS', 'OTHER']);

const CreateLegalHoldSchema = z.object({
  matterId: z.string().min(1),
  holdName: z.string().min(1),
  description: z.string().min(1),
  dataTypes: z.array(z.string()),
  custodians: z.array(z.string()),
  issuedBy: z.string().min(1),
});

const CreateDiscoveryRequestSchema = z.object({
  matterId: z.string().min(1),
  type: DiscoveryTypeEnum,
  requestNumber: z.string().min(1),
  issuedBy: z.string().min(1),
  direction: z.enum(['SENT', 'RECEIVED']),
  receivedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
  dueDate: z.coerce.date(),
  description: z.string().min(1),
  requestItems: z.record(z.unknown()).optional(),
});

const CreatePrivilegeEntrySchema = z.object({
  matterId: z.string().min(1),
  documentId: z.string().optional(),
  batesNumber: z.string().optional(),
  documentDate: z.coerce.date().optional(),
  documentType: z.string().optional(),
  author: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  privilegeType: PrivilegeTypeEnum,
  description: z.string().min(1),
  reviewedBy: z.string().min(1),
});

const LegalHoldQuerySchema = z.object({
  matterId: z.string().optional(),
  status: HoldStatusEnum.optional(),
  custodian: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const DiscoveryRequestQuerySchema = z.object({
  matterId: z.string().optional(),
  type: DiscoveryTypeEnum.optional(),
  responseStatus: ResponseStatusEnum.optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createDiscoveryRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createDiscoveryService(prisma);

  // ============================================================================
  // Legal Holds
  // ============================================================================

  router.get('/holds', authenticate, canViewDiscovery, zValidator('query', LegalHoldQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listLegalHolds({
      matterId: query.matterId,
      status: query.status as HoldStatus | undefined,
      custodian: query.custodian,
      page: query.page,
      limit: query.limit,
    });
    return c.json(result);
  });

  router.get('/holds/:id', authenticate, canViewDiscovery, async (c) => {
    const id = c.req.param('id');
    const hold = await service.getLegalHold(id);
    return c.json(hold);
  });

  router.post('/holds', authenticate, canManageDiscovery, zValidator('json', CreateLegalHoldSchema), async (c) => {
    const input = c.req.valid('json');
    const hold = await service.createLegalHold(input);
    return c.json(hold, 201);
  });

  router.post('/holds/:id/acknowledge', authenticate, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const hold = await service.acknowledgeLegalHold(id, body.custodianId);
    return c.json(hold);
  });

  router.post('/holds/:id/lift', authenticate, canManageDiscovery, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const hold = await service.liftLegalHold(id, body.liftedBy, body.reason);
    return c.json(hold);
  });

  // ============================================================================
  // Discovery Requests
  // ============================================================================

  router.get('/requests', authenticate, canViewDiscovery, zValidator('query', DiscoveryRequestQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listDiscoveryRequests({
      matterId: query.matterId,
      type: query.type as DiscoveryType | undefined,
      responseStatus: query.responseStatus as ResponseStatus | undefined,
      overdue: query.overdue,
      page: query.page,
      limit: query.limit,
    });
    return c.json(result);
  });

  router.get('/requests/:id', authenticate, canViewDiscovery, async (c) => {
    const id = c.req.param('id');
    const request = await service.getDiscoveryRequest(id);
    return c.json(request);
  });

  router.post('/requests', authenticate, canManageDiscovery, zValidator('json', CreateDiscoveryRequestSchema), async (c) => {
    const input = c.req.valid('json');
    const request = await service.createDiscoveryRequest({
      matterId: input.matterId,
      type: input.type as DiscoveryType,
      requestNumber: input.requestNumber,
      issuedBy: input.issuedBy,
      direction: input.direction,
      receivedAt: input.receivedAt,
      sentAt: input.sentAt,
      dueDate: input.dueDate,
      description: input.description,
      requestItems: input.requestItems,
    });
    return c.json(request, 201);
  });

  router.post('/requests/:id/status', authenticate, canManageDiscovery, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const request = await service.updateRequestStatus(id, body.status, body.responseDate, body.responseNotes);
    return c.json(request);
  });

  router.post('/requests/:id/extend', authenticate, canManageDiscovery, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const request = await service.requestExtension(id, new Date(body.extendedDueDate), body.reason);
    return c.json(request);
  });

  // ============================================================================
  // Privilege Log
  // ============================================================================

  router.get('/privilege-log/:matterId', authenticate, canViewDiscovery, async (c) => {
    const matterId = c.req.param('matterId');
    const privilegeType = c.req.query('privilegeType') as PrivilegeType | undefined;
    const result = await service.listPrivilegeLog(matterId, privilegeType);
    return c.json(result);
  });

  router.post('/privilege-log', authenticate, canManageDiscovery, zValidator('json', CreatePrivilegeEntrySchema), async (c) => {
    const input = c.req.valid('json');
    const entry = await service.createPrivilegeLogEntry({
      matterId: input.matterId,
      documentId: input.documentId,
      batesNumber: input.batesNumber,
      documentDate: input.documentDate,
      documentType: input.documentType,
      author: input.author,
      recipients: input.recipients,
      privilegeType: input.privilegeType as PrivilegeType,
      description: input.description,
      reviewedBy: input.reviewedBy,
    });
    return c.json(entry, 201);
  });

  router.get('/privilege-log/:matterId/stats', authenticate, canViewDiscovery, async (c) => {
    const matterId = c.req.param('matterId');
    const stats = await service.getPrivilegeLogStats(matterId);
    return c.json(stats);
  });

  // ============================================================================
  // Discovery Info
  // ============================================================================

  router.get('/matters/:matterId/info', authenticate, canViewDiscovery, async (c) => {
    const matterId = c.req.param('matterId');
    const info = await service.getDiscoveryInfo(matterId);
    return c.json(info);
  });

  router.post('/matters/:matterId/advance-phase', authenticate, canManageDiscovery, async (c) => {
    const matterId = c.req.param('matterId');
    const info = await service.advanceEDRMPhase(matterId);
    return c.json(info);
  });

  return router;
}
