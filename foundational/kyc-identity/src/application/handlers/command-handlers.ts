/**
 * Identity Command Handlers
 */

import { eq, and } from 'drizzle-orm';
import { getDb, identities, documents, verificationRequests } from '../../infrastructure/persistence/index.js';
import { VerificationStatus } from '../../domain/value-objects/index.js';
import type {
  CreateIdentityCommand,
  UpdateIdentityCommand,
  VerifyIdentityCommand,
  RejectIdentityCommand,
  UploadDocumentCommand,
  VerifyDocumentCommand,
  RejectDocumentCommand,
  CreateVerificationRequestCommand,
  StartVerificationReviewCommand,
  CompleteVerificationRequestCommand,
} from '../commands/index.js';

function formatDate(date: { year: number; month: number; day: number }): string {
  return new Date(date.year, date.month - 1, date.day).toISOString().split('T')[0] as string;
}

export class IdentityCommandHandler {
  private db = getDb();

  async createIdentity(command: CreateIdentityCommand): Promise<string> {
    const results = await this.db.insert(identities).values({
      tenantId: command.tenantId,
      externalId: command.externalId ?? null,
      type: command.type,
      firstName: command.name?.firstName ?? null,
      middleName: command.name?.middleName ?? null,
      lastName: command.name?.lastName ?? null,
      dateOfBirth: command.dateOfBirth ? formatDate(command.dateOfBirth) : null,
      nationality: command.nationality ?? null,
      taxId: command.taxId ?? null,
      legalName: command.corporateDetails?.legalName ?? null,
      tradingName: command.corporateDetails?.tradingName ?? null,
      registrationNumber: command.corporateDetails?.registrationNumber ?? null,
      registrationCountry: command.corporateDetails?.registrationCountry ?? null,
      email: command.email ?? null,
      phone: command.phone ?? null,
      addressLine1: command.address?.line1 ?? null,
      addressLine2: command.address?.line2 ?? null,
      city: command.address?.city ?? null,
      state: command.address?.state ?? null,
      postalCode: command.address?.postalCode ?? null,
      country: command.address?.country ?? null,
      verificationStatus: VerificationStatus.PENDING,
      metadata: command.metadata ?? null,
      tags: command.tags ?? null,
    }).returning();

    const identity = results[0];
    if (!identity) throw new Error('Failed to create identity');
    return identity.id;
  }

  async updateIdentity(command: UpdateIdentityCommand): Promise<void> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (command.name) {
      updates.firstName = command.name.firstName;
      updates.middleName = command.name.middleName;
      updates.lastName = command.name.lastName;
    }

    if (command.dateOfBirth) {
      updates.dateOfBirth = formatDate(command.dateOfBirth);
    }

    if (command.nationality !== undefined) updates.nationality = command.nationality;
    if (command.taxId !== undefined) updates.taxId = command.taxId;
    if (command.email !== undefined) updates.email = command.email;
    if (command.phone !== undefined) updates.phone = command.phone;

    if (command.address) {
      updates.addressLine1 = command.address.line1;
      updates.addressLine2 = command.address.line2;
      updates.city = command.address.city;
      updates.state = command.address.state;
      updates.postalCode = command.address.postalCode;
      updates.country = command.address.country;
    }

    if (command.corporateDetails) {
      updates.legalName = command.corporateDetails.legalName;
      updates.tradingName = command.corporateDetails.tradingName;
      updates.registrationNumber = command.corporateDetails.registrationNumber;
      updates.registrationCountry = command.corporateDetails.registrationCountry;
    }

    if (command.metadata !== undefined) updates.metadata = command.metadata;
    if (command.tags !== undefined) updates.tags = command.tags;

    await this.db.update(identities)
      .set(updates)
      .where(and(
        eq(identities.id, command.identityId),
        eq(identities.tenantId, command.tenantId)
      ));
  }

  async verifyIdentity(command: VerifyIdentityCommand): Promise<void> {
    await this.db.update(identities)
      .set({
        verificationStatus: VerificationStatus.APPROVED,
        verifiedAt: new Date(),
        verifiedBy: command.verifiedBy,
        verificationExpiresAt: command.expiresAt ?? null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(identities.id, command.identityId),
        eq(identities.tenantId, command.tenantId)
      ));
  }

  async rejectIdentity(command: RejectIdentityCommand): Promise<void> {
    const results = await this.db.select({ metadata: identities.metadata })
      .from(identities)
      .where(and(
        eq(identities.id, command.identityId),
        eq(identities.tenantId, command.tenantId)
      ));
    const current = results[0];

    await this.db.update(identities)
      .set({
        verificationStatus: VerificationStatus.REJECTED,
        updatedAt: new Date(),
        metadata: {
          ...(current?.metadata as Record<string, unknown> || {}),
          rejectionReason: command.reason,
          rejectedBy: command.rejectedBy,
          rejectedAt: new Date().toISOString(),
        },
      })
      .where(and(
        eq(identities.id, command.identityId),
        eq(identities.tenantId, command.tenantId)
      ));
  }
}

export class DocumentCommandHandler {
  private db = getDb();

  async uploadDocument(command: UploadDocumentCommand): Promise<string> {
    const results = await this.db.insert(documents).values({
      identityId: command.identityId,
      tenantId: command.tenantId,
      type: command.type,
      documentNumber: command.documentNumber ?? null,
      issuingCountry: command.issuingCountry ?? null,
      issueDate: command.issueDate ? (command.issueDate.toISOString().split('T')[0] as string) : null,
      expiryDate: command.expiryDate ? (command.expiryDate.toISOString().split('T')[0] as string) : null,
      fileName: command.fileName,
      fileType: command.fileType,
      fileSize: command.fileSize,
      storageKey: command.storageKey,
      checksum: command.checksum ?? null,
      status: 'UPLOADED',
      verificationStatus: VerificationStatus.PENDING,
      metadata: command.metadata ?? null,
    }).returning();

    const document = results[0];
    if (!document) throw new Error('Failed to upload document');
    return document.id;
  }

  async verifyDocument(command: VerifyDocumentCommand): Promise<void> {
    const allPassed = command.checks.every(c => c.status === 'PASSED');

    await this.db.update(documents)
      .set({
        status: allPassed ? 'VERIFIED' : 'REJECTED',
        verificationStatus: allPassed ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
        verificationChecks: command.checks.map(c => ({
          ...c,
          performedAt: new Date(),
        })),
        verifiedAt: new Date(),
        verifiedBy: command.verifiedBy,
        updatedAt: new Date(),
      })
      .where(and(
        eq(documents.id, command.documentId),
        eq(documents.tenantId, command.tenantId)
      ));
  }

  async rejectDocument(command: RejectDocumentCommand): Promise<void> {
    await this.db.update(documents)
      .set({
        status: 'REJECTED',
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: command.reason,
        verifiedAt: new Date(),
        verifiedBy: command.rejectedBy,
        updatedAt: new Date(),
      })
      .where(and(
        eq(documents.id, command.documentId),
        eq(documents.tenantId, command.tenantId)
      ));
  }
}

export class VerificationRequestCommandHandler {
  private db = getDb();

  async createVerificationRequest(command: CreateVerificationRequestCommand): Promise<string> {
    const requiredDocs = command.requiredDocuments?.map(d => ({
      documentType: d.documentType,
      required: d.required,
      status: 'PENDING',
    })) ?? [];

    const results = await this.db.insert(verificationRequests).values({
      identityId: command.identityId,
      tenantId: command.tenantId,
      type: command.type,
      priority: command.priority ?? 'NORMAL',
      status: VerificationStatus.PENDING,
      requiredDocuments: requiredDocs,
      checksTotal: 0,
      checksCompleted: 0,
      requestedBy: command.requestedBy,
      requestSource: command.requestSource,
      expiresAt: command.expiresAt ?? null,
      metadata: command.metadata ?? null,
    }).returning();

    const request = results[0];
    if (!request) throw new Error('Failed to create verification request');
    return request.id;
  }

  async startVerificationReview(command: StartVerificationReviewCommand): Promise<void> {
    await this.db.update(verificationRequests)
      .set({
        status: VerificationStatus.IN_REVIEW,
        assignedTo: command.assignedTo,
        assignedAt: new Date(),
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(verificationRequests.id, command.requestId),
        eq(verificationRequests.tenantId, command.tenantId)
      ));
  }

  async completeVerificationRequest(command: CompleteVerificationRequestCommand): Promise<void> {
    const status = command.decision === 'APPROVED' 
      ? VerificationStatus.APPROVED 
      : VerificationStatus.REJECTED;

    await this.db.update(verificationRequests)
      .set({
        status,
        decision: command.decision,
        decisionReason: command.reason ?? null,
        decisionBy: command.decisionBy,
        decisionAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(verificationRequests.id, command.requestId),
        eq(verificationRequests.tenantId, command.tenantId)
      ));

    // If approved, also update the identity
    if (command.decision === 'APPROVED') {
      const results = await this.db.select({ identityId: verificationRequests.identityId })
        .from(verificationRequests)
        .where(eq(verificationRequests.id, command.requestId));
      
      const request = results[0];

      if (request) {
        await this.db.update(identities)
          .set({
            verificationStatus: VerificationStatus.APPROVED,
            verifiedAt: new Date(),
            verifiedBy: command.decisionBy,
            updatedAt: new Date(),
          })
          .where(eq(identities.id, request.identityId));
      }
    }
  }
}
