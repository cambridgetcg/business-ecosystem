/**
 * Policy Service
 *
 * Application service for managing insurance policies.
 */

import { PrismaClient, PolicyStatus, PolicyType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { CreatePolicyInput, UpdatePolicyInput } from '../../domain/policy/models/policy.js';
import {
  isPolicyActive,
  canBindPolicy,
  canCancelPolicy,
  canRenewPolicy,
  isExpiringSoon,
  getDaysUntilExpiry,
  calculateIPT,
} from '../../domain/policy/models/policy.js';
import { getGlobalEventPublisher } from '../../infrastructure/messaging/index.js';

export class PolicyService {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // Policy CRUD
  // ===========================================================================

  async createPolicy(input: CreatePolicyInput, createdBy?: string) {
    const policyNumber = await this.generatePolicyNumber(input.tenantId, input.policyType);

    const policy = await this.prisma.policy.create({
      data: {
        id: uuidv4(),
        tenantId: input.tenantId,
        entityId: input.entityId,
        policyNumber,
        policyType: input.policyType as PolicyType,
        status: 'draft',
        policyName: input.policyName,
        description: input.description || null,
        inceptionDate: input.inceptionDate,
        expiryDate: input.expiryDate,
        retroactiveDate: input.retroactiveDate || null,
        brokerId: input.brokerId || null,
        brokerReference: input.brokerReference || null,
        totalLimitAmount: input.totalLimit.amount,
        totalLimitCurrency: input.totalLimit.currency,
        totalDeductibleAmount: input.totalDeductible?.amount || null,
        totalDeductibleCurrency: input.totalDeductible?.currency || null,
        autoRenewal: input.autoRenewal || false,
        renewalReminderDays: input.renewalReminderDays || 60,
        territorialLimits: input.territorialLimits || [],
        jurisdictionOfCourts: input.jurisdictionOfCourts || null,
        metadata: input.metadata || Prisma.JsonNull,
        tags: input.tags || [],
        createdBy,
        insurers: {
          create: input.insurers.map((insurer) => ({
            id: uuidv4(),
            name: insurer.name,
            insurerType: insurer.insurerType,
            sharePercentage: insurer.sharePercentage,
            contactName: insurer.contactName || null,
            contactEmail: insurer.contactEmail || null,
            contactPhone: insurer.contactPhone || null,
            underwriterName: insurer.underwriterName || null,
            underwriterEmail: insurer.underwriterEmail || null,
            externalReference: insurer.externalReference || null,
            metadata: insurer.metadata || Prisma.JsonNull,
          })),
        },
        coverages: {
          create: input.coverages.map((coverage) => ({
            id: uuidv4(),
            name: coverage.name,
            description: coverage.description || null,
            limitType: coverage.limitType,
            limitAmount: coverage.limit.amount,
            limitCurrency: coverage.limit.currency,
            deductibleAmount: coverage.deductible?.amount || null,
            deductibleCurrency: coverage.deductible?.currency || null,
            coinsurancePercentage: coverage.coinsurancePercentage || null,
            sublimits: coverage.sublimits || Prisma.JsonNull,
            exclusions: coverage.exclusions || [],
            conditions: coverage.conditions || [],
          })),
        },
      },
      include: {
        insurers: true,
        coverages: true,
      },
    });

    // Set up premium if provided
    if (input.premium) {
      await this.prisma.policy.update({
        where: { id: policy.id },
        data: {
          grossPremiumAmount: input.premium.grossPremium.amount,
          grossPremiumCurrency: input.premium.grossPremium.currency,
          iptAmount: input.premium.insurerPremiumTax.amount,
          brokerFeeAmount: input.premium.brokerFee?.amount || null,
          netPremiumAmount: input.premium.netPremium.amount,
          paymentFrequency: input.premium.paymentFrequency,
          isPremiumPaid: input.premium.isPaid,
          premiumPaidAt: input.premium.paidAt || null,
        },
      });

      // Create installments if provided
      if (input.premium.installments) {
        await this.prisma.premiumInstallment.createMany({
          data: input.premium.installments.map((inst) => ({
            id: uuidv4(),
            policyId: policy.id,
            dueDate: inst.dueDate,
            amount: inst.amount.amount,
            currency: inst.amount.currency,
            paidDate: inst.paidDate || null,
            paidAmount: inst.paidAmount?.amount || null,
            reference: inst.reference || null,
          })),
        });
      }
    }

    // Publish PolicyCreated event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyCreated({
        policyId: policy.id,
        tenantId: policy.tenantId,
        entityId: policy.entityId,
        policyNumber: policy.policyNumber,
        policyType: policy.policyType,
        policyName: policy.policyName,
        inceptionDate: policy.inceptionDate.toISOString(),
        expiryDate: policy.expiryDate.toISOString(),
        totalLimit: {
          amount: policy.totalLimitAmount.toNumber(),
          currency: policy.totalLimitCurrency,
        },
        createdBy,
      });
    }

    return policy;
  }

  async getPolicy(id: string) {
    return this.prisma.policy.findUnique({
      where: { id },
      include: {
        insurers: true,
        coverages: true,
        endorsements: true,
        documents: true,
        premiumInstallments: true,
      },
    });
  }

  async getPolicyByNumber(tenantId: string, policyNumber: string) {
    return this.prisma.policy.findUnique({
      where: {
        tenantId_policyNumber: { tenantId, policyNumber },
      },
      include: {
        insurers: true,
        coverages: true,
      },
    });
  }

  async updatePolicy(id: string, input: UpdatePolicyInput, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw new Error('Policy not found');
    }

    if (policy.status !== 'draft' && policy.status !== 'quoted') {
      throw new Error('Can only edit policies in draft or quoted status');
    }

    return this.prisma.policy.update({
      where: { id },
      data: {
        policyName: input.policyName,
        description: input.description,
        expiryDate: input.expiryDate,
        brokerId: input.brokerId,
        brokerReference: input.brokerReference,
        autoRenewal: input.autoRenewal,
        renewalReminderDays: input.renewalReminderDays,
        metadata: input.metadata || undefined,
        tags: input.tags || undefined,
        updatedBy,
        version: { increment: 1 },
      },
      include: {
        insurers: true,
        coverages: true,
      },
    });
  }

  async deletePolicy(id: string, deletedBy?: string) {
    return this.prisma.policy.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }

  // ===========================================================================
  // Policy Status Transitions
  // ===========================================================================

  async quotePolicy(id: string, premium: {
    grossPremium: { amount: number; currency: string };
    ipt: { amount: number; currency: string };
    brokerFee?: { amount: number; currency: string };
    netPremium: { amount: number; currency: string };
    paymentFrequency: string;
  }, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) throw new Error('Policy not found');
    if (policy.status !== 'draft') throw new Error('Can only quote policies in draft status');

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        status: 'quoted',
        grossPremiumAmount: premium.grossPremium.amount,
        grossPremiumCurrency: premium.grossPremium.currency,
        iptAmount: premium.ipt.amount,
        brokerFeeAmount: premium.brokerFee?.amount || null,
        netPremiumAmount: premium.netPremium.amount,
        paymentFrequency: premium.paymentFrequency as any,
        updatedBy,
        version: { increment: 1 },
      },
    });

    // Publish PolicyQuoted event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyQuoted({
        policyId: updated.id,
        tenantId: updated.tenantId,
        entityId: updated.entityId,
        policyNumber: updated.policyNumber,
        policyType: updated.policyType,
        grossPremium: premium.grossPremium,
        ipt: premium.ipt,
        netPremium: premium.netPremium,
        paymentFrequency: premium.paymentFrequency,
        quotedBy: updatedBy,
        quotedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  async bindPolicy(id: string, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) throw new Error('Policy not found');
    if (policy.status !== 'quoted') throw new Error('Can only bind policies in quoted status');

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        status: 'bound',
        updatedBy,
        version: { increment: 1 },
      },
      include: { insurers: true },
    });

    // Publish PolicyBound event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyBound({
        policyId: updated.id,
        tenantId: updated.tenantId,
        entityId: updated.entityId,
        policyNumber: updated.policyNumber,
        policyType: updated.policyType,
        inceptionDate: updated.inceptionDate.toISOString(),
        expiryDate: updated.expiryDate.toISOString(),
        grossPremium: {
          amount: updated.grossPremiumAmount?.toNumber() || 0,
          currency: updated.grossPremiumCurrency || 'GBP',
        },
        insurerName: updated.insurers[0]?.name || 'Unknown',
        boundBy: updatedBy,
        boundAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  async activatePolicy(id: string, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) throw new Error('Policy not found');
    if (policy.status !== 'bound') throw new Error('Can only activate policies in bound status');

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        status: 'active',
        updatedBy,
        version: { increment: 1 },
      },
    });

    // Publish PolicyActivated event - notifies Compliance and Accounting
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyActivated({
        policyId: updated.id,
        tenantId: updated.tenantId,
        entityId: updated.entityId,
        policyNumber: updated.policyNumber,
        policyType: updated.policyType,
        inceptionDate: updated.inceptionDate.toISOString(),
        expiryDate: updated.expiryDate.toISOString(),
      });
    }

    return updated;
  }

  async cancelPolicy(id: string, reason?: string, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) throw new Error('Policy not found');
    if (policy.status !== 'active' && policy.status !== 'bound') {
      throw new Error('Can only cancel active or bound policies');
    }

    const cancellationDate = new Date().toISOString();
    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        status: 'cancelled',
        metadata: {
          ...(policy.metadata as object || {}),
          cancellationReason: reason,
          cancelledAt: cancellationDate,
        },
        updatedBy,
        version: { increment: 1 },
      },
    });

    // Publish PolicyCancelled event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyCancelled({
        policyId: updated.id,
        tenantId: updated.tenantId,
        entityId: updated.entityId,
        policyNumber: updated.policyNumber,
        policyType: updated.policyType,
        cancellationDate,
        cancellationReason: reason,
        cancelledBy: updatedBy,
      });
    }

    return updated;
  }

  async renewPolicy(id: string, newExpiryDate: Date, updatedBy?: string) {
    const policy = await this.getPolicy(id);
    if (!policy) throw new Error('Policy not found');

    if (policy.renewedByPolicyId) {
      throw new Error('Policy has already been renewed');
    }

    if (policy.status !== 'active' && policy.status !== 'expired' && policy.status !== 'pending_renewal') {
      throw new Error('Can only renew active, expired, or pending renewal policies');
    }

    // Create new policy as renewal
    const newPolicyNumber = await this.generatePolicyNumber(policy.tenantId, policy.policyType);
    const newInceptionDate = policy.expiryDate;

    const newPolicy = await this.prisma.policy.create({
      data: {
        id: uuidv4(),
        tenantId: policy.tenantId,
        entityId: policy.entityId,
        policyNumber: newPolicyNumber,
        externalPolicyNumber: null,
        policyType: policy.policyType,
        status: 'draft',
        policyName: policy.policyName,
        description: policy.description,
        inceptionDate: newInceptionDate,
        expiryDate: newExpiryDate,
        retroactiveDate: policy.retroactiveDate,
        brokerId: policy.brokerId,
        brokerReference: policy.brokerReference,
        totalLimitAmount: policy.totalLimitAmount,
        totalLimitCurrency: policy.totalLimitCurrency,
        totalDeductibleAmount: policy.totalDeductibleAmount,
        totalDeductibleCurrency: policy.totalDeductibleCurrency,
        autoRenewal: policy.autoRenewal,
        renewalReminderDays: policy.renewalReminderDays,
        territorialLimits: policy.territorialLimits,
        jurisdictionOfCourts: policy.jurisdictionOfCourts,
        renewalOfPolicyId: policy.id,
        createdBy: updatedBy,
        insurers: {
          create: policy.insurers.map((ins) => ({
            id: uuidv4(),
            name: ins.name,
            insurerType: ins.insurerType,
            sharePercentage: ins.sharePercentage,
            contactName: ins.contactName,
            contactEmail: ins.contactEmail,
            contactPhone: ins.contactPhone,
            underwriterName: ins.underwriterName,
            underwriterEmail: ins.underwriterEmail,
            externalReference: ins.externalReference,
            metadata: ins.metadata || Prisma.JsonNull,
          })),
        },
        coverages: {
          create: policy.coverages.map((cov) => ({
            id: uuidv4(),
            name: cov.name,
            description: cov.description,
            limitType: cov.limitType,
            limitAmount: cov.limitAmount,
            limitCurrency: cov.limitCurrency,
            deductibleAmount: cov.deductibleAmount,
            deductibleCurrency: cov.deductibleCurrency,
            coinsurancePercentage: cov.coinsurancePercentage,
            sublimits: cov.sublimits || Prisma.JsonNull,
            exclusions: cov.exclusions,
            conditions: cov.conditions,
          })),
        },
      },
      include: {
        insurers: true,
        coverages: true,
      },
    });

    // Update original policy
    await this.prisma.policy.update({
      where: { id },
      data: {
        status: 'renewed',
        renewedByPolicyId: newPolicy.id,
        updatedBy,
        version: { increment: 1 },
      },
    });

    // Publish PolicyRenewed event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishPolicyRenewed({
        policyId: newPolicy.id,
        tenantId: newPolicy.tenantId,
        entityId: newPolicy.entityId,
        oldPolicyId: policy.id,
        oldPolicyNumber: policy.policyNumber,
        newPolicyNumber: newPolicy.policyNumber,
        policyType: newPolicy.policyType,
        newInceptionDate: newPolicy.inceptionDate.toISOString(),
        newExpiryDate: newPolicy.expiryDate.toISOString(),
      });
    }

    return newPolicy;
  }

  // ===========================================================================
  // Policy Queries
  // ===========================================================================

  async getPoliciesByEntity(tenantId: string, entityId: string) {
    return this.prisma.policy.findMany({
      where: {
        tenantId,
        entityId,
        deletedAt: null,
      },
      include: {
        insurers: true,
        coverages: true,
      },
      orderBy: { expiryDate: 'desc' },
    });
  }

  async getActivePolicies(tenantId: string) {
    const now = new Date();
    return this.prisma.policy.findMany({
      where: {
        tenantId,
        status: 'active',
        inceptionDate: { lte: now },
        expiryDate: { gt: now },
        deletedAt: null,
      },
      include: {
        insurers: true,
        coverages: true,
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async getExpiringPolicies(tenantId: string, daysAhead: number = 60) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.prisma.policy.findMany({
      where: {
        tenantId,
        status: 'active',
        expiryDate: {
          gte: now,
          lte: futureDate,
        },
        renewedByPolicyId: null,
        deletedAt: null,
      },
      include: {
        insurers: true,
        coverages: true,
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async getPoliciesByType(tenantId: string, policyType: string) {
    return this.prisma.policy.findMany({
      where: {
        tenantId,
        policyType: policyType as PolicyType,
        deletedAt: null,
      },
      include: {
        insurers: true,
        coverages: true,
      },
      orderBy: { expiryDate: 'desc' },
    });
  }

  // ===========================================================================
  // Premium Management
  // ===========================================================================

  async recordPremiumPayment(
    policyId: string,
    amount: number,
    reference: string,
    updatedBy?: string
  ) {
    const policy = await this.getPolicy(policyId);
    if (!policy) throw new Error('Policy not found');

    await this.prisma.policy.update({
      where: { id: policyId },
      data: {
        isPremiumPaid: true,
        premiumPaidAt: new Date(),
        updatedBy,
        version: { increment: 1 },
      },
    });

    // If there are installments, find and update the next unpaid one
    const unpaidInstallment = await this.prisma.premiumInstallment.findFirst({
      where: {
        policyId,
        paidDate: null,
      },
      orderBy: { dueDate: 'asc' },
    });

    if (unpaidInstallment) {
      await this.prisma.premiumInstallment.update({
        where: { id: unpaidInstallment.id },
        data: {
          paidDate: new Date(),
          paidAmount: amount,
          reference,
        },
      });
    }

    return this.getPolicy(policyId);
  }

  // ===========================================================================
  // Documents
  // ===========================================================================

  async addPolicyDocument(
    policyId: string,
    document: {
      name: string;
      type: string;
      storageKey: string;
      fileSize?: number;
      mimeType?: string;
    },
    uploadedBy?: string
  ) {
    return this.prisma.policyDocument.create({
      data: {
        id: uuidv4(),
        policyId,
        name: document.name,
        type: document.type as any,
        storageKey: document.storageKey,
        fileSize: document.fileSize || null,
        mimeType: document.mimeType || null,
        uploadedBy,
      },
    });
  }

  // ===========================================================================
  // Endorsements
  // ===========================================================================

  async addEndorsement(
    policyId: string,
    endorsement: {
      number: string;
      effectiveDate: Date;
      description: string;
      documentKey?: string;
    },
    createdBy?: string
  ) {
    return this.prisma.policyEndorsement.create({
      data: {
        id: uuidv4(),
        policyId,
        number: endorsement.number,
        effectiveDate: endorsement.effectiveDate,
        description: endorsement.description,
        documentKey: endorsement.documentKey || null,
        createdBy,
      },
    });
  }

  // ===========================================================================
  // Dashboard Metrics
  // ===========================================================================

  async getDashboardMetrics(tenantId: string) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalPolicies,
      activePolicies,
      expiringPolicies,
      policyTypes,
      premiumDue,
    ] = await Promise.all([
      // Total policies
      this.prisma.policy.count({
        where: { tenantId, deletedAt: null },
      }),

      // Active policies
      this.prisma.policy.count({
        where: {
          tenantId,
          status: 'active',
          deletedAt: null,
        },
      }),

      // Expiring in 30 days
      this.prisma.policy.count({
        where: {
          tenantId,
          status: 'active',
          expiryDate: { gte: now, lte: thirtyDaysFromNow },
          renewedByPolicyId: null,
          deletedAt: null,
        },
      }),

      // By policy type
      this.prisma.policy.groupBy({
        by: ['policyType'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // Total premium due
      this.prisma.premiumInstallment.aggregate({
        where: {
          policy: { tenantId },
          paidDate: null,
          dueDate: { lte: now },
        },
        _sum: { amount: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const pt of policyTypes) {
      byType[pt.policyType] = pt._count;
    }

    return {
      totalPolicies,
      activePolicies,
      expiringPolicies,
      premiumDue: premiumDue._sum.amount || 0,
      byPolicyType: byType,
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async generatePolicyNumber(tenantId: string, policyType: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = policyType.substring(0, 3).toUpperCase();

    const count = await this.prisma.policy.count({
      where: { tenantId },
    });

    const sequence = (count + 1).toString().padStart(6, '0');
    return `${prefix}-${year}-${sequence}`;
  }
}
