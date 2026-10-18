/**
 * Signature Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb, signatureRequests, signatureAuditLog, contracts, contractParties } from '../../../infrastructure/persistence/index.js';
import { CreateSignatureRequestInputSchema } from '../../../domain/signature/models/signature.js';
import { getGlobalEventPublisher, ContractsEventTypes } from '../../../infrastructure/messaging/event-publisher.js';

export const signatureRoutes: FastifyPluginAsync = async (app) => {
  // List signature requests for a contract
  app.get('/contract/:contractId', {
    schema: {
      tags: ['signatures'],
      summary: 'List signature requests for a contract',
      params: z.object({
        contractId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { contractId } = request.params as { contractId: string };

    const db = getDb();
    const results = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.contractId, contractId));

    return { data: results, total: results.length };
  });

  // Create signature request
  app.post('/', {
    schema: {
      tags: ['signatures'],
      summary: 'Create a signature request',
      body: CreateSignatureRequestInputSchema,
    },
  }, async (request, reply) => {
    const input = request.body as z.infer<typeof CreateSignatureRequestInputSchema>;

    const db = getDb();

    // Verify contract exists and is in pending_signatures status
    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, input.contractId));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'pending_signatures') {
      reply.code(400);
      return { error: 'Contract must be in pending_signatures status' };
    }

    const [signatureRequest] = await db.insert(signatureRequests).values({
      contractId: input.contractId,
      contractPartyId: input.contractPartyId,
      tenantId: input.tenantId,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      status: 'pending',
      externalProvider: input.externalProvider ?? null,
      requestedBy: input.requestedBy,
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ?? null,
    }).returning();

    // Create audit log
    if (signatureRequest) {
      await db.insert(signatureAuditLog).values({
        signatureRequestId: signatureRequest.id,
        action: 'created',
        actorId: input.requestedBy,
        actorEmail: input.signerEmail,
      });

      // Publish event
      const publisher = getGlobalEventPublisher();
      if (publisher) {
        await publisher.publish(ContractsEventTypes.SIGNATURE_REQUESTED, signatureRequest.id, {
          signatureRequestId: signatureRequest.id,
          contractId: input.contractId,
          tenantId: input.tenantId,
          signerName: input.signerName,
          signerEmail: input.signerEmail,
        });
      }
    }

    reply.code(201);
    return signatureRequest;
  });

  // Get signature request by ID
  app.get('/:id', {
    schema: {
      tags: ['signatures'],
      summary: 'Get signature request by ID',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();
    const [signatureRequest] = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.id, id));

    if (!signatureRequest) {
      reply.code(404);
      return { error: 'Signature request not found' };
    }

    // Get audit log
    const auditLogs = await db.select()
      .from(signatureAuditLog)
      .where(eq(signatureAuditLog.signatureRequestId, id));

    return { ...signatureRequest, auditLogs };
  });

  // Sign (complete signature)
  app.post('/:id/sign', {
    schema: {
      tags: ['signatures'],
      summary: 'Complete signature',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        signatureData: z.string().optional(),
        ipAddress: z.string().max(45).optional(),
        userAgent: z.string().max(500).optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { signatureData, ipAddress, userAgent } = request.body as {
      signatureData?: string;
      ipAddress?: string;
      userAgent?: string;
    };

    const db = getDb();

    const [signatureRequest] = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.id, id));

    if (!signatureRequest) {
      reply.code(404);
      return { error: 'Signature request not found' };
    }

    if (signatureRequest.status !== 'pending') {
      reply.code(400);
      return { error: 'Signature request is not pending' };
    }

    if (signatureRequest.expiresAt && new Date(signatureRequest.expiresAt) < new Date()) {
      reply.code(400);
      return { error: 'Signature request has expired' };
    }

    const signedAt = new Date();

    const [updated] = await db.update(signatureRequests)
      .set({
        status: 'signed',
        signedAt,
        signatureData: signatureData ?? null,
        signedIpAddress: ipAddress ?? null,
        signedUserAgent: userAgent ?? null,
        updatedAt: new Date(),
      })
      .where(eq(signatureRequests.id, id))
      .returning();

    // Update contract party
    await db.update(contractParties)
      .set({
        signedAt,
        updatedAt: new Date(),
      })
      .where(eq(contractParties.id, signatureRequest.contractPartyId));

    // Create audit log
    await db.insert(signatureAuditLog).values({
      signatureRequestId: id,
      action: 'signed',
      actorEmail: signatureRequest.signerEmail,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.SIGNATURE_COMPLETED, id, {
        signatureRequestId: id,
        contractId: signatureRequest.contractId,
        tenantId: signatureRequest.tenantId,
        signerName: signatureRequest.signerName,
        signerEmail: signatureRequest.signerEmail,
        signedAt: signedAt.toISOString(),
      });
    }

    // Check if all signatures are complete
    const allRequests = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.contractId, signatureRequest.contractId));

    const allSigned = allRequests.every(r => r.status === 'signed');

    if (allSigned) {
      // Activate the contract
      await db.update(contracts)
        .set({
          status: 'active',
          executedDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, signatureRequest.contractId));

      // Publish contract executed event
      const [contract] = await db.select()
        .from(contracts)
        .where(eq(contracts.id, signatureRequest.contractId));

      if (publisher && contract) {
        await publisher.publish(ContractsEventTypes.CONTRACT_EXECUTED, contract.id, {
          contractId: contract.id,
          tenantId: contract.tenantId,
          contractNumber: contract.contractNumber,
          ownerEntityId: contract.ownerEntityId,
          executedAt: new Date().toISOString(),
        });
      }
    }

    return updated;
  });

  // Decline signature
  app.post('/:id/decline', {
    schema: {
      tags: ['signatures'],
      summary: 'Decline signature',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        reason: z.string().max(500).optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    const db = getDb();

    const [signatureRequest] = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.id, id));

    if (!signatureRequest) {
      reply.code(404);
      return { error: 'Signature request not found' };
    }

    if (signatureRequest.status !== 'pending') {
      reply.code(400);
      return { error: 'Signature request is not pending' };
    }

    const [updated] = await db.update(signatureRequests)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        declineReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(signatureRequests.id, id))
      .returning();

    // Create audit log
    await db.insert(signatureAuditLog).values({
      signatureRequestId: id,
      action: 'declined',
      actorEmail: signatureRequest.signerEmail,
      details: reason ? { reason } : null,
    });

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.SIGNATURE_DECLINED, id, {
        signatureRequestId: id,
        contractId: signatureRequest.contractId,
        tenantId: signatureRequest.tenantId,
        signerName: signatureRequest.signerName,
        signerEmail: signatureRequest.signerEmail,
        reason,
      });
    }

    return updated;
  });

  // Send reminder
  app.post('/:id/remind', {
    schema: {
      tags: ['signatures'],
      summary: 'Send signature reminder',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [signatureRequest] = await db.select()
      .from(signatureRequests)
      .where(eq(signatureRequests.id, id));

    if (!signatureRequest) {
      reply.code(404);
      return { error: 'Signature request not found' };
    }

    if (signatureRequest.status !== 'pending') {
      reply.code(400);
      return { error: 'Signature request is not pending' };
    }

    if (signatureRequest.reminderCount >= 5) {
      reply.code(400);
      return { error: 'Maximum reminders reached' };
    }

    const [updated] = await db.update(signatureRequests)
      .set({
        reminderCount: signatureRequest.reminderCount + 1,
        lastReminderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(signatureRequests.id, id))
      .returning();

    // Create audit log
    await db.insert(signatureAuditLog).values({
      signatureRequestId: id,
      action: 'reminder_sent',
      details: { reminderNumber: signatureRequest.reminderCount + 1 },
    });

    return { message: 'Reminder sent', reminderCount: updated?.reminderCount };
  });
};
