/**
 * Claims Service
 *
 * Application service for managing insurance claims.
 */

import { PrismaClient, ClaimStatus, ClaimType, PriorityLevel, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { CreateClaimInput, UpdateClaimInput } from '../../domain/claims/models/claim.js';
import {
  isClaimOpen,
  canCloseClaim,
  canReopenClaim,
  canApproveClaim,
  canDenyClaim,
  canSettleClaim,
  calculateTotalIncurred,
  calculateNetPaid,
  getClaimAge,
  isOverdueForReview,
} from '../../domain/claims/models/claim.js';
import { getGlobalEventPublisher } from '../../infrastructure/messaging/index.js';

export class ClaimsService {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // Claim CRUD
  // ===========================================================================

  async createClaim(input: CreateClaimInput, createdBy?: string) {
    // Validate policy exists
    const policy = await this.prisma.policy.findUnique({
      where: { id: input.policyId },
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    // Check claim is within policy period
    const claimDate = input.discoveryDate || input.incidentDate;
    if (claimDate < policy.inceptionDate || claimDate >= policy.expiryDate) {
      throw new Error('Claim date is outside policy period');
    }

    const claimNumber = await this.generateClaimNumber(input.tenantId);

    const claim = await this.prisma.claim.create({
      data: {
        id: uuidv4(),
        tenantId: input.tenantId,
        entityId: input.entityId,
        policyId: input.policyId,
        claimNumber,
        claimType: input.claimType as ClaimType,
        status: 'draft',
        priority: (input.priority || 'medium') as PriorityLevel,
        title: input.title,
        description: input.description,
        incidentDate: input.incidentDate,
        discoveryDate: input.discoveryDate || input.incidentDate,
        notificationDate: input.notificationDate || new Date(),
        location: input.location || null,
        claimedAmount: input.claimedAmount?.amount || null,
        claimedCurrency: input.claimedAmount?.currency || null,
        coverageName: input.coverageName || null,
        handlerId: input.handlerId || null,
        metadata: input.metadata || Prisma.JsonNull,
        tags: input.tags || [],
        createdBy,
        lastActivityDate: new Date(),
        claimants: input.claimants ? {
          create: input.claimants.map((claimant) => ({
            id: uuidv4(),
            claimantType: claimant.claimantType,
            name: claimant.name,
            email: claimant.email || null,
            phone: claimant.phone || null,
            address: claimant.address || null,
            companyName: claimant.companyName || null,
            solicitorName: claimant.solicitorName || null,
            solicitorReference: claimant.solicitorReference || null,
            metadata: claimant.metadata || Prisma.JsonNull,
          })),
        } : undefined,
      },
      include: {
        claimants: true,
        payments: true,
        activities: true,
      },
    });

    // Add initial activity
    await this.addActivity(claim.id, 'note', 'Claim created', null, createdBy);

    // Publish ClaimCreated event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimCreated({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        claimType: claim.claimType,
        title: claim.title,
        incidentDate: claim.incidentDate.toISOString(),
        claimedAmount: claim.claimedAmount ? {
          amount: claim.claimedAmount.toNumber(),
          currency: claim.claimedCurrency || 'GBP',
        } : undefined,
        priority: claim.priority,
        createdBy,
      });
    }

    return claim;
  }

  async getClaim(id: string) {
    return this.prisma.claim.findUnique({
      where: { id },
      include: {
        policy: {
          include: {
            insurers: true,
            coverages: true,
          },
        },
        claimants: true,
        payments: true,
        activities: {
          orderBy: { createdAt: 'desc' },
        },
        documents: true,
        reserveHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getClaimByNumber(tenantId: string, claimNumber: string) {
    return this.prisma.claim.findUnique({
      where: {
        tenantId_claimNumber: { tenantId, claimNumber },
      },
      include: {
        claimants: true,
        payments: true,
        activities: true,
      },
    });
  }

  async updateClaim(id: string, input: UpdateClaimInput, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) {
      throw new Error('Claim not found');
    }

    const previousStatus = claim.status;

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: input.status as ClaimStatus || undefined,
        priority: input.priority as PriorityLevel || undefined,
        title: input.title,
        description: input.description,
        location: input.location,
        claimedAmount: input.claimedAmount?.amount,
        claimedCurrency: input.claimedAmount?.currency,
        adjusterId: input.adjusterId,
        adjusterName: input.adjusterName,
        solicitorId: input.solicitorId,
        solicitorName: input.solicitorName,
        coverageConfirmed: input.coverageConfirmed,
        coverageNotes: input.coverageNotes,
        handlerId: input.handlerId,
        handlerName: input.handlerName,
        metadata: input.metadata || undefined,
        tags: input.tags || undefined,
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
      include: {
        claimants: true,
        payments: true,
        activities: true,
      },
    });

    // Log status change
    if (input.status && input.status !== previousStatus) {
      await this.addActivity(
        id,
        'status_change',
        `Status changed from ${previousStatus} to ${input.status}`,
        { previousStatus, newStatus: input.status },
        updatedBy
      );
    }

    return updated;
  }

  async deleteClaim(id: string, deletedBy?: string) {
    return this.prisma.claim.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }

  // ===========================================================================
  // Claim Status Transitions
  // ===========================================================================

  async submitClaim(id: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'draft') throw new Error('Can only submit claims in draft status');

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'submitted',
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', 'Claim submitted for review', null, updatedBy);

    // Publish ClaimSubmitted event - notifies Accounting for receivable tracking
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimSubmitted({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        claimType: claim.claimType,
        claimedAmount: claim.claimedAmount ? {
          amount: claim.claimedAmount.toNumber(),
          currency: claim.claimedCurrency || 'GBP',
        } : undefined,
        submittedAt: new Date().toISOString(),
        submittedBy: updatedBy,
      });
    }

    return updated;
  }

  async startInvestigation(id: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'submitted' && claim.status !== 'under_review') {
      throw new Error('Can only start investigation on submitted or under review claims');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'investigation',
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', 'Investigation started', null, updatedBy);

    // Publish ClaimInvestigationStarted event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimInvestigationStarted({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        claimType: claim.claimType,
        investigationStartedAt: new Date().toISOString(),
        investigationStartedBy: updatedBy,
      });
    }

    return updated;
  }

  async approveClaim(id: string, notes?: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'under_review' && claim.status !== 'investigation') {
      throw new Error('Can only approve claims under review or investigation');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'approved',
        coverageConfirmed: true,
        coverageNotes: notes || claim.coverageNotes,
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', 'Claim approved', { notes }, updatedBy);

    // Publish ClaimApproved event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimApproved({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        approvedAmount: {
          amount: claim.claimedAmount?.toNumber() || 0,
          currency: claim.claimedCurrency || 'GBP',
        },
        approvedAt: new Date().toISOString(),
        approvedBy: updatedBy,
        coverageConfirmed: true,
      });
    }

    return updated;
  }

  async denyClaim(id: string, reason: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'under_review' && claim.status !== 'investigation') {
      throw new Error('Can only deny claims under review or investigation');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'denied',
        denialDate: new Date(),
        denialReason: reason,
        coverageConfirmed: false,
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', `Claim denied: ${reason}`, { reason }, updatedBy);

    // Publish ClaimDenied event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimDenied({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        denialReason: reason,
        deniedAt: new Date().toISOString(),
        deniedBy: updatedBy,
      });
    }

    return updated;
  }

  async settleClaim(
    id: string,
    settlement: {
      amount: number;
      currency?: string;
      notes?: string;
    },
    updatedBy?: string
  ) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'approved' && claim.status !== 'partially_approved' && claim.status !== 'investigation') {
      throw new Error('Can only settle approved or partially approved claims');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'settled',
        settlementAmount: settlement.amount,
        settlementCurrency: settlement.currency || 'GBP',
        settlementDate: new Date(),
        settlementNotes: settlement.notes || null,
        closedDate: new Date(),
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(
      id,
      'status_change',
      `Claim settled for ${settlement.currency || 'GBP'} ${settlement.amount}`,
      settlement,
      updatedBy
    );

    // Publish ClaimSettled event - notifies Accounting for payment tracking
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimSettled({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        settlementAmount: {
          amount: settlement.amount,
          currency: settlement.currency || 'GBP',
        },
        settlementDate: new Date().toISOString(),
        totalPaid: {
          amount: (claim.totalPaid?.toNumber() || 0) + settlement.amount,
          currency: settlement.currency || 'GBP',
        },
        recoveries: claim.recoveriesAmount ? {
          amount: claim.recoveriesAmount.toNumber(),
          currency: claim.recoveriesCurrency || 'GBP',
        } : undefined,
      });
    }

    return updated;
  }

  async closeClaim(id: string, notes?: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status === 'closed' || claim.status === 'draft') {
      throw new Error('Cannot close claim in current status');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'closed',
        closedDate: new Date(),
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', `Claim closed${notes ? `: ${notes}` : ''}`, { notes }, updatedBy);

    // Publish ClaimClosed event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      const claimAge = Math.floor((Date.now() - claim.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      await publisher.publishClaimClosed({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        closedAt: new Date().toISOString(),
        closedBy: updatedBy,
        finalStatus: claim.status,
        totalPaid: {
          amount: claim.totalPaidAmount?.toNumber() || 0,
          currency: claim.totalPaidCurrency || 'GBP',
        },
        claimAgeInDays: claimAge,
      });
    }

    return updated;
  }

  async reopenClaim(id: string, reason: string, updatedBy?: string) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');
    if (claim.status !== 'closed' && claim.status !== 'denied') {
      throw new Error('Can only reopen closed or denied claims');
    }

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        status: 'reopened',
        reopenedDate: new Date(),
        closedDate: null,
        denialDate: null,
        denialReason: null,
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(id, 'status_change', `Claim reopened: ${reason}`, { reason }, updatedBy);

    // Publish ClaimReopened event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimReopened({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        reopenedAt: new Date().toISOString(),
        reopenedBy: updatedBy,
        reopenReason: reason,
      });
    }

    return updated;
  }

  // ===========================================================================
  // Reserve Management
  // ===========================================================================

  async updateReserve(
    id: string,
    reserve: {
      indemnityReserve: number;
      expenseReserve: number;
      reason: string;
    },
    updatedBy?: string
  ) {
    const claim = await this.getClaim(id);
    if (!claim) throw new Error('Claim not found');

    const previousTotal = claim.totalReserve;
    const newTotal = reserve.indemnityReserve + reserve.expenseReserve;

    // Record history
    await this.prisma.claimReserveHistory.create({
      data: {
        id: uuidv4(),
        claimId: id,
        previousTotal,
        newTotal,
        reason: reserve.reason,
        adjustedBy: updatedBy,
      },
    });

    const updated = await this.prisma.claim.update({
      where: { id },
      data: {
        indemnityReserve: reserve.indemnityReserve,
        expenseReserve: reserve.expenseReserve,
        totalReserve: newTotal,
        lastReserveReviewDate: new Date(),
        nextReserveReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updatedBy,
        lastActivityDate: new Date(),
        version: { increment: 1 },
      },
    });

    await this.addActivity(
      id,
      'reserve_adjustment',
      `Reserve adjusted from ${previousTotal} to ${newTotal}: ${reserve.reason}`,
      { previousTotal, newTotal, ...reserve },
      updatedBy
    );

    // Publish ClaimReserveUpdated event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishClaimReserveUpdated({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        previousReserve: {
          amount: previousTotal?.toNumber() || 0,
          currency: 'GBP',
        },
        newReserve: {
          amount: newTotal,
          currency: 'GBP',
        },
        reason: reserve.reason,
        adjustedBy: updatedBy,
      });
    }

    return updated;
  }

  // ===========================================================================
  // Payments
  // ===========================================================================

  async addPayment(
    claimId: string,
    payment: {
      paymentType: string;
      amount: number;
      currency?: string;
      payee: string;
      payeeReference?: string;
      description?: string;
      paymentDate: Date;
      paymentMethod?: string;
      reference?: string;
    },
    approvedBy?: string
  ) {
    const claim = await this.getClaim(claimId);
    if (!claim) throw new Error('Claim not found');

    const newPayment = await this.prisma.claimPayment.create({
      data: {
        id: uuidv4(),
        claimId,
        paymentType: payment.paymentType as any,
        amount: payment.amount,
        currency: payment.currency || 'GBP',
        payee: payment.payee,
        payeeReference: payment.payeeReference || null,
        description: payment.description || null,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod as any || null,
        reference: payment.reference || null,
        approvedBy,
        approvedAt: approvedBy ? new Date() : null,
      },
    });

    // Update total paid on claim
    const isRecovery = ['recovery', 'salvage', 'subrogation'].includes(payment.paymentType);
    const paidAdjustment = isRecovery ? 0 : payment.amount;
    const recoveryAdjustment = isRecovery ? payment.amount : 0;

    await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        totalPaidAmount: { increment: paidAdjustment },
        recoveriesAmount: claim.recoveriesAmount
          ? { increment: recoveryAdjustment }
          : recoveryAdjustment > 0 ? recoveryAdjustment : undefined,
        lastActivityDate: new Date(),
      },
    });

    await this.addActivity(
      claimId,
      'payment',
      `Payment of ${payment.currency || 'GBP'} ${payment.amount} to ${payment.payee}`,
      payment,
      approvedBy
    );

    // Publish ClaimPaymentMade event - notifies Accounting for journal entries
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      const totalPaid = (claim.totalPaidAmount?.toNumber() || 0) + paidAdjustment;
      await publisher.publishClaimPaymentMade({
        claimId: claim.id,
        tenantId: claim.tenantId,
        entityId: claim.entityId,
        policyId: claim.policyId,
        claimNumber: claim.claimNumber,
        paymentId: newPayment.id,
        paymentType: payment.paymentType,
        amount: {
          amount: payment.amount,
          currency: payment.currency || 'GBP',
        },
        payee: payment.payee,
        paymentDate: payment.paymentDate.toISOString(),
        totalClaimPaid: {
          amount: totalPaid,
          currency: payment.currency || 'GBP',
        },
      });
    }

    return newPayment;
  }

  // ===========================================================================
  // Documents
  // ===========================================================================

  async addClaimDocument(
    claimId: string,
    document: {
      name: string;
      type: string;
      storageKey: string;
      fileSize?: number;
      mimeType?: string;
    },
    uploadedBy?: string
  ) {
    const doc = await this.prisma.claimDocument.create({
      data: {
        id: uuidv4(),
        claimId,
        name: document.name,
        type: document.type as any,
        storageKey: document.storageKey,
        fileSize: document.fileSize || null,
        mimeType: document.mimeType || null,
        uploadedBy,
      },
    });

    await this.addActivity(
      claimId,
      'document_added',
      `Document added: ${document.name}`,
      { documentId: doc.id, type: document.type },
      uploadedBy
    );

    return doc;
  }

  // ===========================================================================
  // Activity Log
  // ===========================================================================

  async addActivity(
    claimId: string,
    activityType: string,
    description: string,
    details: Record<string, unknown> | null,
    createdBy?: string,
    isInternal: boolean = true
  ) {
    return this.prisma.claimActivity.create({
      data: {
        id: uuidv4(),
        claimId,
        activityType,
        description,
        details: details || Prisma.JsonNull,
        isInternal,
        createdBy,
      },
    });
  }

  async addNote(claimId: string, note: string, createdBy?: string, isInternal: boolean = true) {
    await this.prisma.claim.update({
      where: { id: claimId },
      data: { lastActivityDate: new Date() },
    });

    return this.addActivity(claimId, 'note', note, null, createdBy, isInternal);
  }

  // ===========================================================================
  // Claimant Management
  // ===========================================================================

  async addClaimant(
    claimId: string,
    claimant: {
      claimantType: string;
      name: string;
      email?: string;
      phone?: string;
      address?: string;
      companyName?: string;
      solicitorName?: string;
      solicitorReference?: string;
    }
  ) {
    return this.prisma.claimant.create({
      data: {
        id: uuidv4(),
        claimId,
        claimantType: claimant.claimantType as any,
        name: claimant.name,
        email: claimant.email || null,
        phone: claimant.phone || null,
        address: claimant.address || null,
        companyName: claimant.companyName || null,
        solicitorName: claimant.solicitorName || null,
        solicitorReference: claimant.solicitorReference || null,
      },
    });
  }

  // ===========================================================================
  // Claim Queries
  // ===========================================================================

  async getClaimsByPolicy(policyId: string) {
    return this.prisma.claim.findMany({
      where: {
        policyId,
        deletedAt: null,
      },
      include: {
        claimants: true,
        payments: true,
      },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async getClaimsByEntity(tenantId: string, entityId: string) {
    return this.prisma.claim.findMany({
      where: {
        tenantId,
        entityId,
        deletedAt: null,
      },
      include: {
        policy: true,
        claimants: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOpenClaims(tenantId: string) {
    return this.prisma.claim.findMany({
      where: {
        tenantId,
        status: {
          notIn: ['closed', 'settled', 'withdrawn', 'denied'],
        },
        deletedAt: null,
      },
      include: {
        policy: true,
        claimants: true,
      },
      orderBy: [
        { priority: 'desc' },
        { incidentDate: 'desc' },
      ],
    });
  }

  async getClaimsNeedingReview(tenantId: string, daysThreshold: number = 30) {
    const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    return this.prisma.claim.findMany({
      where: {
        tenantId,
        status: {
          notIn: ['closed', 'settled', 'withdrawn', 'denied', 'draft'],
        },
        lastActivityDate: {
          lt: thresholdDate,
        },
        deletedAt: null,
      },
      include: {
        policy: true,
      },
      orderBy: { lastActivityDate: 'asc' },
    });
  }

  async getClaimsByHandler(tenantId: string, handlerId: string) {
    return this.prisma.claim.findMany({
      where: {
        tenantId,
        handlerId,
        status: {
          notIn: ['closed', 'settled', 'withdrawn'],
        },
        deletedAt: null,
      },
      include: {
        policy: true,
        claimants: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  // ===========================================================================
  // Dashboard Metrics
  // ===========================================================================

  async getDashboardMetrics(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalClaims,
      openClaims,
      newClaimsLast30Days,
      claimsByStatus,
      claimsByType,
      reserveTotal,
      paidTotal,
    ] = await Promise.all([
      // Total claims
      this.prisma.claim.count({
        where: { tenantId, deletedAt: null },
      }),

      // Open claims
      this.prisma.claim.count({
        where: {
          tenantId,
          status: { notIn: ['closed', 'settled', 'withdrawn', 'denied'] },
          deletedAt: null,
        },
      }),

      // New claims last 30 days
      this.prisma.claim.count({
        where: {
          tenantId,
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
        },
      }),

      // By status
      this.prisma.claim.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // By type
      this.prisma.claim.groupBy({
        by: ['claimType'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // Total reserves
      this.prisma.claim.aggregate({
        where: {
          tenantId,
          status: { notIn: ['closed', 'settled', 'withdrawn', 'denied'] },
          deletedAt: null,
        },
        _sum: { totalReserve: true },
      }),

      // Total paid
      this.prisma.claim.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { totalPaidAmount: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const cs of claimsByStatus) {
      byStatus[cs.status] = cs._count;
    }

    const byType: Record<string, number> = {};
    for (const ct of claimsByType) {
      byType[ct.claimType] = ct._count;
    }

    return {
      totalClaims,
      openClaims,
      newClaimsLast30Days,
      totalReserves: reserveTotal._sum.totalReserve || 0,
      totalPaid: paidTotal._sum.totalPaidAmount || 0,
      byStatus,
      byClaimType: byType,
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async generateClaimNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear().toString();
    const count = await this.prisma.claim.count({
      where: { tenantId },
    });

    const sequence = (count + 1).toString().padStart(6, '0');
    return `CLM-${year}-${sequence}`;
  }
}
