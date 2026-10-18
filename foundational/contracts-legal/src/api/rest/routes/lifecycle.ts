/**
 * Contract Lifecycle Routes
 *
 * Advanced lifecycle operations: renew, suspend, clone, amend.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull, lte, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, contracts, contractParties } from '../../../infrastructure/persistence/index.js';
import { getGlobalEventPublisher, ContractsEventTypes } from '../../../infrastructure/messaging/event-publisher.js';

export const lifecycleRoutes: FastifyPluginAsync = async (app) => {
  // Renew contract
  app.post('/:id/renew', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Renew a contract',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        newEffectiveDate: z.string().datetime().optional(),
        newExpirationDate: z.string().datetime(),
        adjustedValue: z.object({
          amount: z.number().int(),
          currency: z.string().length(3).default('USD'),
        }).optional(),
        notes: z.string().max(1000).optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as {
      newEffectiveDate?: string;
      newExpirationDate: string;
      adjustedValue?: { amount: number; currency: string };
      notes?: string;
    };

    const db = getDb();

    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'active' && contract.status !== 'expired') {
      reply.code(400);
      return { error: 'Only active or expired contracts can be renewed' };
    }

    // Create renewal
    const newEffectiveDate = input.newEffectiveDate
      ? new Date(input.newEffectiveDate)
      : contract.expirationDate || new Date();

    const [renewed] = await db.update(contracts)
      .set({
        status: 'active',
        effectiveDate: newEffectiveDate,
        expirationDate: new Date(input.newExpirationDate),
        totalValueAmount: input.adjustedValue?.amount ?? contract.totalValueAmount,
        totalValueCurrency: input.adjustedValue?.currency ?? contract.totalValueCurrency,
        renewalCount: contract.renewalCount + 1,
        metadata: {
          ...(contract.metadata as Record<string, unknown> || {}),
          renewalHistory: [
            ...((contract.metadata as Record<string, unknown>)?.renewalHistory as unknown[] || []),
            {
              renewedAt: new Date().toISOString(),
              previousExpiration: contract.expirationDate?.toISOString(),
              newExpiration: input.newExpirationDate,
              notes: input.notes,
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish('contracts-legal.contract.renewed', id, {
        contractId: id,
        tenantId: contract.tenantId,
        contractNumber: contract.contractNumber,
        renewalCount: renewed?.renewalCount,
        newExpirationDate: input.newExpirationDate,
      });
    }

    return renewed;
  });

  // Suspend contract
  app.post('/:id/suspend', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Suspend a contract',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        reason: z.string().max(500),
        suspendUntil: z.string().datetime().optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason, suspendUntil } = request.body as {
      reason: string;
      suspendUntil?: string;
    };

    const db = getDb();

    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'active') {
      reply.code(400);
      return { error: 'Only active contracts can be suspended' };
    }

    const [suspended] = await db.update(contracts)
      .set({
        status: 'suspended',
        metadata: {
          ...(contract.metadata as Record<string, unknown> || {}),
          suspensionReason: reason,
          suspendedAt: new Date().toISOString(),
          suspendUntil: suspendUntil,
          previousStatus: contract.status,
        },
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    return suspended;
  });

  // Reactivate suspended contract
  app.post('/:id/reactivate', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Reactivate a suspended contract',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'suspended') {
      reply.code(400);
      return { error: 'Only suspended contracts can be reactivated' };
    }

    // Check if contract hasn't expired during suspension
    if (contract.expirationDate && new Date(contract.expirationDate) < new Date()) {
      reply.code(400);
      return { error: 'Contract has expired during suspension. Please renew instead.' };
    }

    const metadata = contract.metadata as Record<string, unknown> || {};
    const { suspensionReason, suspendedAt, suspendUntil, ...restMetadata } = metadata;

    const [reactivated] = await db.update(contracts)
      .set({
        status: 'active',
        metadata: {
          ...restMetadata,
          reactivationHistory: [
            ...((metadata.reactivationHistory as unknown[]) || []),
            {
              reactivatedAt: new Date().toISOString(),
              previousSuspension: { reason: suspensionReason, suspendedAt },
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    return reactivated;
  });

  // Clone contract
  app.post('/:id/clone', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Clone a contract as a new draft',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        newTitle: z.string().max(255).optional(),
        newOwnerEntityId: z.string().uuid().optional(),
        includeParties: z.boolean().default(true),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newTitle, newOwnerEntityId, includeParties } = request.body as {
      newTitle?: string;
      newOwnerEntityId?: string;
      includeParties: boolean;
    };

    const db = getDb();

    const [sourceContract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));

    if (!sourceContract) {
      reply.code(404);
      return { error: 'Source contract not found' };
    }

    // Create new contract
    const contractNumber = `CTR-${nanoid(8).toUpperCase()}`;

    const [newContract] = await db.insert(contracts).values({
      tenantId: sourceContract.tenantId,
      contractNumber,
      title: newTitle || `${sourceContract.title} (Copy)`,
      description: sourceContract.description,
      contractType: sourceContract.contractType,
      status: 'draft',
      ownerEntityId: newOwnerEntityId || sourceContract.ownerEntityId,
      templateId: sourceContract.templateId,
      templateVersion: sourceContract.templateVersion,
      totalValueAmount: sourceContract.totalValueAmount,
      totalValueCurrency: sourceContract.totalValueCurrency,
      paymentTerms: sourceContract.paymentTerms,
      renewalTerms: sourceContract.renewalTerms,
      metadata: {
        ...(sourceContract.metadata as Record<string, unknown> || {}),
        clonedFrom: {
          contractId: id,
          contractNumber: sourceContract.contractNumber,
          clonedAt: new Date().toISOString(),
        },
      },
      tags: sourceContract.tags,
    }).returning();

    // Clone parties if requested
    if (includeParties && newContract) {
      const sourceParties = await db.select()
        .from(contractParties)
        .where(eq(contractParties.contractId, id));

      if (sourceParties.length > 0) {
        await db.insert(contractParties).values(
          sourceParties.map(p => ({
            contractId: newContract.id,
            partyType: p.partyType,
            partyRole: p.partyRole,
            entityId: p.entityId,
            personId: p.personId,
            externalName: p.externalName,
            externalEmail: p.externalEmail,
            signatureRequired: p.signatureRequired,
            metadata: p.metadata,
          }))
        );
      }
    }

    reply.code(201);
    return newContract;
  });

  // Submit for review
  app.post('/:id/submit-for-review', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Submit contract for review',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        reviewerNotes: z.string().max(1000).optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reviewerNotes } = request.body as { reviewerNotes?: string };

    const db = getDb();

    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'draft') {
      reply.code(400);
      return { error: 'Only draft contracts can be submitted for review' };
    }

    const [updated] = await db.update(contracts)
      .set({
        status: 'pending_review',
        metadata: {
          ...(contract.metadata as Record<string, unknown> || {}),
          submittedForReviewAt: new Date().toISOString(),
          reviewerNotes,
        },
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    return updated;
  });

  // Get expiring contracts
  app.get('/expiring', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Get contracts expiring soon',
      querystring: z.object({
        tenantId: z.string().uuid(),
        daysAhead: z.coerce.number().int().min(1).max(365).default(30),
      }),
    },
  }, async (request, reply) => {
    const { tenantId, daysAhead } = request.query as {
      tenantId: string;
      daysAhead: number;
    };

    const db = getDb();

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiring = await db.select()
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'active'),
        isNull(contracts.deletedAt),
        gte(contracts.expirationDate, now),
        lte(contracts.expirationDate, futureDate)
      ));

    return {
      data: expiring.map(c => ({
        id: c.id,
        contractNumber: c.contractNumber,
        title: c.title,
        contractType: c.contractType,
        expirationDate: c.expirationDate,
        daysUntilExpiration: c.expirationDate
          ? Math.ceil((new Date(c.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        totalValue: c.totalValueAmount
          ? { amount: c.totalValueAmount, currency: c.totalValueCurrency }
          : null,
      })),
      total: expiring.length,
      queryParams: { tenantId, daysAhead },
    };
  });

  // Get contract status history (from metadata)
  app.get('/:id/history', {
    schema: {
      tags: ['lifecycle'],
      summary: 'Get contract status change history',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, id));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    const metadata = contract.metadata as Record<string, unknown> || {};

    // Compile history from various metadata fields
    const history: Array<{
      event: string;
      timestamp: string;
      details?: Record<string, unknown>;
    }> = [
      { event: 'created', timestamp: contract.createdAt.toISOString() },
    ];

    if (metadata.submittedForReviewAt) {
      history.push({
        event: 'submitted_for_review',
        timestamp: metadata.submittedForReviewAt as string,
      });
    }

    if (contract.executedDate) {
      history.push({
        event: 'executed',
        timestamp: contract.executedDate.toISOString(),
      });
    }

    if (metadata.renewalHistory) {
      for (const renewal of metadata.renewalHistory as Array<{ renewedAt: string; notes?: string }>) {
        history.push({
          event: 'renewed',
          timestamp: renewal.renewedAt,
          details: { notes: renewal.notes },
        });
      }
    }

    if (metadata.suspendedAt) {
      history.push({
        event: 'suspended',
        timestamp: metadata.suspendedAt as string,
        details: { reason: metadata.suspensionReason },
      });
    }

    if (contract.terminatedDate) {
      history.push({
        event: 'terminated',
        timestamp: contract.terminatedDate.toISOString(),
        details: { reason: metadata.terminationReason },
      });
    }

    // Sort by timestamp
    history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      contractId: id,
      contractNumber: contract.contractNumber,
      currentStatus: contract.status,
      history,
    };
  });
};
