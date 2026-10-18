/**
 * Contract Parties Routes
 *
 * Extended party management for contracts.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb, contracts, contractParties } from '../../../infrastructure/persistence/index.js';

export const partyRoutes: FastifyPluginAsync = async (app) => {
  // List parties for a contract
  app.get('/contract/:contractId', {
    schema: {
      tags: ['parties'],
      summary: 'List parties for a contract',
      params: z.object({
        contractId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { contractId } = request.params as { contractId: string };

    const db = getDb();

    // Verify contract exists
    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    const parties = await db.select()
      .from(contractParties)
      .where(eq(contractParties.contractId, contractId));

    return { data: parties, total: parties.length };
  });

  // Get party by ID
  app.get('/:id', {
    schema: {
      tags: ['parties'],
      summary: 'Get party by ID',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();
    const [party] = await db.select()
      .from(contractParties)
      .where(eq(contractParties.id, id));

    if (!party) {
      reply.code(404);
      return { error: 'Party not found' };
    }

    return party;
  });

  // Update party
  app.patch('/:id', {
    schema: {
      tags: ['parties'],
      summary: 'Update party details',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        externalName: z.string().max(255).optional(),
        externalEmail: z.string().email().optional(),
        signatureRequired: z.boolean().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as {
      externalName?: string;
      externalEmail?: string;
      signatureRequired?: boolean;
      metadata?: Record<string, unknown>;
    };

    const db = getDb();

    // Check party exists
    const [existing] = await db.select()
      .from(contractParties)
      .where(eq(contractParties.id, id));

    if (!existing) {
      reply.code(404);
      return { error: 'Party not found' };
    }

    // Check contract is editable
    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, existing.contractId));

    if (contract && contract.status !== 'draft' && contract.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Cannot update parties on contract in current status' };
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.externalName !== undefined) updates.externalName = input.externalName;
    if (input.externalEmail !== undefined) updates.externalEmail = input.externalEmail;
    if (input.signatureRequired !== undefined) updates.signatureRequired = input.signatureRequired;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const [updated] = await db.update(contractParties)
      .set(updates)
      .where(eq(contractParties.id, id))
      .returning();

    return updated;
  });

  // Remove party from contract
  app.delete('/:id', {
    schema: {
      tags: ['parties'],
      summary: 'Remove party from contract',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    // Check party exists
    const [existing] = await db.select()
      .from(contractParties)
      .where(eq(contractParties.id, id));

    if (!existing) {
      reply.code(404);
      return { error: 'Party not found' };
    }

    // Check contract is editable
    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, existing.contractId));

    if (contract && contract.status !== 'draft' && contract.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Cannot remove parties from contract in current status' };
    }

    // Check this is not the last owner party
    if (existing.partyRole === 'owner') {
      const ownerParties = await db.select()
        .from(contractParties)
        .where(and(
          eq(contractParties.contractId, existing.contractId),
          eq(contractParties.partyRole, 'owner')
        ));

      if (ownerParties.length <= 1) {
        reply.code(400);
        return { error: 'Cannot remove the only owner party' };
      }
    }

    await db.delete(contractParties)
      .where(eq(contractParties.id, id));

    reply.code(204);
    return;
  });

  // Bulk add parties to contract
  app.post('/contract/:contractId/bulk', {
    schema: {
      tags: ['parties'],
      summary: 'Add multiple parties to contract',
      params: z.object({
        contractId: z.string().uuid(),
      }),
      body: z.object({
        parties: z.array(z.object({
          partyType: z.enum(['entity', 'individual', 'external']),
          partyRole: z.enum(['owner', 'counterparty', 'guarantor', 'witness', 'notary']),
          entityId: z.string().uuid().optional(),
          personId: z.string().uuid().optional(),
          externalName: z.string().max(255).optional(),
          externalEmail: z.string().email().optional(),
          signatureRequired: z.boolean().default(true),
        })).min(1).max(20),
      }),
    },
  }, async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const { parties } = request.body as {
      parties: Array<{
        partyType: 'entity' | 'individual' | 'external';
        partyRole: 'owner' | 'counterparty' | 'guarantor' | 'witness' | 'notary';
        entityId?: string;
        personId?: string;
        externalName?: string;
        externalEmail?: string;
        signatureRequired: boolean;
      }>;
    };

    const db = getDb();

    // Check contract exists and is editable
    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    if (contract.status !== 'draft' && contract.status !== 'pending_review') {
      reply.code(400);
      return { error: 'Cannot add parties to contract in current status' };
    }

    const insertedParties = await db.insert(contractParties).values(
      parties.map(p => ({
        contractId,
        partyType: p.partyType,
        partyRole: p.partyRole,
        entityId: p.entityId ?? null,
        personId: p.personId ?? null,
        externalName: p.externalName ?? null,
        externalEmail: p.externalEmail ?? null,
        signatureRequired: p.signatureRequired,
      }))
    ).returning();

    reply.code(201);
    return { data: insertedParties, count: insertedParties.length };
  });
};
