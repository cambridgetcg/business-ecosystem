/**
 * Contract Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, contracts, contractParties } from '../../../infrastructure/persistence/index.js';
import { CreateContractInputSchema, UpdateContractInputSchema } from '../../../domain/contract/models/contract.js';
import { getGlobalEventPublisher, ContractsEventTypes } from '../../../infrastructure/messaging/event-publisher.js';

export const contractRoutes: FastifyPluginAsync = async (app) => {
  // List contracts
  app.get('/', {
    schema: {
      tags: ['contracts'],
      summary: 'List contracts',
      querystring: z.object({
        tenantId: z.string().uuid(),
        status: z.string().optional(),
        contractType: z.string().optional(),
        limit: z.coerce.number().default(20),
        offset: z.coerce.number().default(0),
      }),
    },
  }, async (request, reply) => {
    const { tenantId, status, limit, offset } = request.query as {
      tenantId: string;
      status?: string;
      limit: number;
      offset: number;
    };

    const db = getDb();
    const results = await db.select()
      .from(contracts)
      .where(eq(contracts.tenantId, tenantId))
      .limit(limit)
      .offset(offset);

    return { data: results, total: results.length };
  });

  // Create contract
  app.post('/', {
    schema: {
      tags: ['contracts'],
      summary: 'Create a new contract',
      body: CreateContractInputSchema,
    },
  }, async (request, reply) => {
    const input = request.body as z.infer<typeof CreateContractInputSchema>;

    const db = getDb();
    const contractNumber = `CTR-${nanoid(8).toUpperCase()}`;

    const [contract] = await db.insert(contracts).values({
      tenantId: input.tenantId,
      contractNumber,
      title: input.title,
      description: input.description ?? null,
      contractType: input.contractType,
      status: 'draft',
      ownerEntityId: input.ownerEntityId,
      templateId: input.templateId ?? null,
      effectiveDate: input.effectiveDate ?? null,
      expirationDate: input.expirationDate ?? null,
      totalValueAmount: input.totalValue?.amount ?? null,
      totalValueCurrency: input.totalValue?.currency ?? 'USD',
      paymentTerms: input.paymentTerms ?? null,
      renewalTerms: input.renewalTerms ?? null,
      metadata: input.metadata ?? null,
      tags: input.tags ?? null,
    }).returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher && contract) {
      await publisher.publish(ContractsEventTypes.CONTRACT_CREATED, contract.id, {
        contractId: contract.id,
        tenantId: contract.tenantId,
        contractNumber: contract.contractNumber,
        title: contract.title,
        contractType: contract.contractType,
        ownerEntityId: contract.ownerEntityId,
      });
    }

    reply.code(201);
    return contract;
  });

  // Get contract by ID
  app.get('/:id', {
    schema: {
      tags: ['contracts'],
      summary: 'Get contract by ID',
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

    // Get parties
    const parties = await db.select()
      .from(contractParties)
      .where(eq(contractParties.contractId, id));

    return { ...contract, parties };
  });

  // Update contract
  app.patch('/:id', {
    schema: {
      tags: ['contracts'],
      summary: 'Update contract',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: UpdateContractInputSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as z.infer<typeof UpdateContractInputSchema>;

    const db = getDb();

    // Check if contract exists and is editable
    const [existing] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, id));

    if (!existing) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (existing.status !== 'draft' && existing.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Contract cannot be edited in current status' };
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.effectiveDate !== undefined) updates.effectiveDate = input.effectiveDate;
    if (input.expirationDate !== undefined) updates.expirationDate = input.expirationDate;
    if (input.totalValue !== undefined) {
      updates.totalValueAmount = input.totalValue?.amount ?? null;
      updates.totalValueCurrency = input.totalValue?.currency ?? 'USD';
    }
    if (input.paymentTerms !== undefined) updates.paymentTerms = input.paymentTerms;
    if (input.renewalTerms !== undefined) updates.renewalTerms = input.renewalTerms;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (input.tags !== undefined) updates.tags = input.tags;

    const [updated] = await db.update(contracts)
      .set(updates)
      .where(eq(contracts.id, id))
      .returning();

    return updated;
  });

  // Send for signatures
  app.post('/:id/send-for-signatures', {
    schema: {
      tags: ['contracts'],
      summary: 'Send contract for signatures',
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

    if (contract.status !== 'draft' && contract.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Contract must be in draft or pending_review status' };
    }

    // Check that parties exist
    const parties = await db.select()
      .from(contractParties)
      .where(eq(contractParties.contractId, id));

    if (parties.length === 0) {
      reply.code(400);
      return { error: 'Contract must have at least one party' };
    }

    const [updated] = await db.update(contracts)
      .set({
        status: 'pending_signatures',
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.CONTRACT_SENT_FOR_SIGNATURES, id, {
        contractId: id,
        tenantId: contract.tenantId,
        contractNumber: contract.contractNumber,
        partiesCount: parties.length,
      });
    }

    return updated;
  });

  // Terminate contract
  app.post('/:id/terminate', {
    schema: {
      tags: ['contracts'],
      summary: 'Terminate contract',
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

    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, id));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'active' && contract.status !== 'suspended') {
      reply.code(400);
      return { error: 'Contract cannot be terminated in current status' };
    }

    const [updated] = await db.update(contracts)
      .set({
        status: 'terminated',
        terminatedDate: new Date(),
        metadata: {
          ...(contract.metadata as Record<string, unknown> || {}),
          terminationReason: reason,
        },
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.CONTRACT_TERMINATED, id, {
        contractId: id,
        tenantId: contract.tenantId,
        contractNumber: contract.contractNumber,
        terminatedAt: new Date().toISOString(),
        reason,
      });
    }

    return updated;
  });

  // Add party to contract
  app.post('/:id/parties', {
    schema: {
      tags: ['contracts'],
      summary: 'Add party to contract',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        partyType: z.enum(['entity', 'individual', 'external']),
        partyRole: z.enum(['owner', 'counterparty', 'guarantor', 'witness', 'notary']),
        entityId: z.string().uuid().optional(),
        personId: z.string().uuid().optional(),
        externalName: z.string().max(255).optional(),
        externalEmail: z.string().email().optional(),
        signatureRequired: z.boolean().default(true),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as {
      partyType: 'entity' | 'individual' | 'external';
      partyRole: 'owner' | 'counterparty' | 'guarantor' | 'witness' | 'notary';
      entityId?: string;
      personId?: string;
      externalName?: string;
      externalEmail?: string;
      signatureRequired: boolean;
    };

    const db = getDb();

    // Check contract exists and is editable
    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, id));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'draft' && contract.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Cannot add parties to contract in current status' };
    }

    const [party] = await db.insert(contractParties).values({
      contractId: id,
      partyType: input.partyType,
      partyRole: input.partyRole,
      entityId: input.entityId ?? null,
      personId: input.personId ?? null,
      externalName: input.externalName ?? null,
      externalEmail: input.externalEmail ?? null,
      signatureRequired: input.signatureRequired,
    }).returning();

    reply.code(201);
    return party;
  });

  // Delete contract
  app.delete('/:id', {
    schema: {
      tags: ['contracts'],
      summary: 'Delete contract (soft delete)',
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

    if (contract.status === 'active') {
      reply.code(400);
      return { error: 'Active contracts cannot be deleted' };
    }

    await db.update(contracts)
      .set({ deletedAt: new Date() })
      .where(eq(contracts.id, id));

    reply.code(204);
    return;
  });
};
