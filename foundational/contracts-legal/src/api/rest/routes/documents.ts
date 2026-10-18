/**
 * Contract Documents Routes
 *
 * Document management with versioning for contracts.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, contracts, contractDocuments } from '../../../infrastructure/persistence/index.js';

export const documentRoutes: FastifyPluginAsync = async (app) => {
  // List documents for a contract
  app.get('/contract/:contractId', {
    schema: {
      tags: ['documents'],
      summary: 'List documents for a contract',
      params: z.object({
        contractId: z.string().uuid(),
      }),
      querystring: z.object({
        includeAllVersions: z.coerce.boolean().default(false),
      }),
    },
  }, async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const { includeAllVersions } = request.query as { includeAllVersions: boolean };

    const db = getDb();

    // Verify contract exists
    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    let documents;
    if (includeAllVersions) {
      documents = await db.select()
        .from(contractDocuments)
        .where(eq(contractDocuments.contractId, contractId))
        .orderBy(desc(contractDocuments.version));
    } else {
      // Get only the latest version of each document by filename
      documents = await db.select()
        .from(contractDocuments)
        .where(eq(contractDocuments.contractId, contractId))
        .orderBy(desc(contractDocuments.uploadedAt));

      // Filter to keep only latest version per filename
      const latestByName = new Map<string, typeof documents[0]>();
      for (const doc of documents) {
        if (!latestByName.has(doc.fileName)) {
          latestByName.set(doc.fileName, doc);
        }
      }
      documents = Array.from(latestByName.values());
    }

    return { data: documents, total: documents.length };
  });

  // Upload document
  app.post('/contract/:contractId', {
    schema: {
      tags: ['documents'],
      summary: 'Upload document to contract',
      params: z.object({
        contractId: z.string().uuid(),
      }),
      body: z.object({
        fileName: z.string().min(1).max(255),
        fileType: z.string().min(1).max(100),
        fileSize: z.number().int().positive(),
        content: z.string(), // Base64 encoded or URL
        uploadedBy: z.string().uuid(),
        metadata: z.record(z.unknown()).optional(),
      }),
    },
  }, async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const input = request.body as {
      fileName: string;
      fileType: string;
      fileSize: number;
      content: string;
      uploadedBy: string;
      metadata?: Record<string, unknown>;
    };

    const db = getDb();

    // Verify contract exists
    const [contract] = await db.select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)));

    if (!contract) {
      reply.code(404);
      return { error: 'Contract not found' };
    }

    // Determine version number
    const existingDocs = await db.select()
      .from(contractDocuments)
      .where(and(
        eq(contractDocuments.contractId, contractId),
        eq(contractDocuments.fileName, input.fileName)
      ))
      .orderBy(desc(contractDocuments.version));

    const version = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

    // Generate storage key (in production, this would upload to S3)
    const storageKey = `contracts/${contractId}/documents/${nanoid()}-${input.fileName}`;

    // Calculate checksum (simplified - in production use crypto)
    const checksum = Buffer.from(input.content.slice(0, 100)).toString('base64').slice(0, 64);

    const [document] = await db.insert(contractDocuments).values({
      contractId,
      version,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      storageKey,
      checksum,
      uploadedBy: input.uploadedBy,
      metadata: input.metadata ?? null,
    }).returning();

    // Update contract document version
    await db.update(contracts)
      .set({
        documentVersion: version,
        documentStorageKey: storageKey,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    reply.code(201);
    return document;
  });

  // Get document by ID
  app.get('/:id', {
    schema: {
      tags: ['documents'],
      summary: 'Get document by ID',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();
    const [document] = await db.select()
      .from(contractDocuments)
      .where(eq(contractDocuments.id, id));

    if (!document) {
      reply.code(404);
      return { error: 'Document not found' };
    }

    return document;
  });

  // Get download URL (presigned URL for S3)
  app.get('/:id/download', {
    schema: {
      tags: ['documents'],
      summary: 'Get presigned download URL for document',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();
    const [document] = await db.select()
      .from(contractDocuments)
      .where(eq(contractDocuments.id, id));

    if (!document) {
      reply.code(404);
      return { error: 'Document not found' };
    }

    // In production, generate presigned S3 URL
    // For now, return a placeholder
    const downloadUrl = `https://storage.example.com/${document.storageKey}?expires=${Date.now() + 3600000}`;

    return {
      documentId: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      downloadUrl,
      expiresIn: 3600,
    };
  });

  // Delete document
  app.delete('/:id', {
    schema: {
      tags: ['documents'],
      summary: 'Delete document',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [document] = await db.select()
      .from(contractDocuments)
      .where(eq(contractDocuments.id, id));

    if (!document) {
      reply.code(404);
      return { error: 'Document not found' };
    }

    // Check contract is editable
    const [contract] = await db.select()
      .from(contracts)
      .where(eq(contracts.id, document.contractId));

    if (contract && contract.status === 'active') {
      reply.code(400);
      return { error: 'Cannot delete documents from active contracts' };
    }

    // In production, also delete from S3
    await db.delete(contractDocuments)
      .where(eq(contractDocuments.id, id));

    reply.code(204);
    return;
  });

  // Compare document versions
  app.get('/contract/:contractId/versions/:fileName', {
    schema: {
      tags: ['documents'],
      summary: 'Get all versions of a document',
      params: z.object({
        contractId: z.string().uuid(),
        fileName: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { contractId, fileName } = request.params as { contractId: string; fileName: string };

    const db = getDb();

    const versions = await db.select()
      .from(contractDocuments)
      .where(and(
        eq(contractDocuments.contractId, contractId),
        eq(contractDocuments.fileName, fileName)
      ))
      .orderBy(desc(contractDocuments.version));

    return {
      fileName,
      versions: versions.map(v => ({
        id: v.id,
        version: v.version,
        fileSize: v.fileSize,
        checksum: v.checksum,
        uploadedBy: v.uploadedBy,
        uploadedAt: v.uploadedAt,
      })),
      totalVersions: versions.length,
    };
  });
};
