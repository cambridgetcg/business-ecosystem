/**
 * Contract Reporting Routes
 *
 * Analytics, dashboards, and compliance reporting.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull, lte, gte, count, sum, sql } from 'drizzle-orm';
import { getDb, contracts, contractParties, signatureRequests, contractTemplates } from '../../../infrastructure/persistence/index.js';

export const reportingRoutes: FastifyPluginAsync = async (app) => {
  // Dashboard summary
  app.get('/dashboard', {
    schema: {
      tags: ['reporting'],
      summary: 'Get contract dashboard metrics',
      querystring: z.object({
        tenantId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { tenantId } = request.query as { tenantId: string };

    const db = getDb();

    // Count by status
    const allContracts = await db.select()
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), isNull(contracts.deletedAt)));

    const statusCounts: Record<string, number> = {};
    let totalValue = 0;

    for (const c of allContracts) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      if (c.status === 'active' && c.totalValueAmount) {
        totalValue += c.totalValueAmount;
      }
    }

    // Expiring in next 30 days
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const expiringContracts = allContracts.filter(c =>
      c.status === 'active' &&
      c.expirationDate &&
      new Date(c.expirationDate) >= now &&
      new Date(c.expirationDate) <= thirtyDaysLater
    );

    // Pending signatures
    const pendingSignatures = await db.select()
      .from(signatureRequests)
      .where(and(
        eq(signatureRequests.tenantId, tenantId),
        eq(signatureRequests.status, 'pending')
      ));

    return {
      overview: {
        totalContracts: allContracts.length,
        activeContracts: statusCounts['active'] || 0,
        draftContracts: statusCounts['draft'] || 0,
        pendingSignatures: statusCounts['pending_signatures'] || 0,
        expiredContracts: statusCounts['expired'] || 0,
        terminatedContracts: statusCounts['terminated'] || 0,
      },
      value: {
        totalActiveValue: totalValue,
        currency: 'USD',
      },
      alerts: {
        expiringSoon: expiringContracts.length,
        awaitingSignatures: pendingSignatures.length,
      },
      statusBreakdown: statusCounts,
    };
  });

  // Value by contract type
  app.get('/value-by-type', {
    schema: {
      tags: ['reporting'],
      summary: 'Get contract value breakdown by type',
      querystring: z.object({
        tenantId: z.string().uuid(),
        status: z.enum(['active', 'all']).default('active'),
      }),
    },
  }, async (request, reply) => {
    const { tenantId, status } = request.query as {
      tenantId: string;
      status: 'active' | 'all';
    };

    const db = getDb();

    const conditions = [eq(contracts.tenantId, tenantId), isNull(contracts.deletedAt)];
    if (status === 'active') {
      conditions.push(eq(contracts.status, 'active'));
    }

    const allContracts = await db.select()
      .from(contracts)
      .where(and(...conditions));

    // Aggregate by type
    const byType: Record<string, { count: number; totalValue: number }> = {};

    for (const c of allContracts) {
      if (!byType[c.contractType]) {
        byType[c.contractType] = { count: 0, totalValue: 0 };
      }
      byType[c.contractType].count++;
      if (c.totalValueAmount) {
        byType[c.contractType].totalValue += c.totalValueAmount;
      }
    }

    const breakdown = Object.entries(byType).map(([type, data]) => ({
      contractType: type,
      count: data.count,
      totalValue: data.totalValue,
      averageValue: data.count > 0 ? Math.round(data.totalValue / data.count) : 0,
    }));

    // Sort by total value descending
    breakdown.sort((a, b) => b.totalValue - a.totalValue);

    return {
      data: breakdown,
      totals: {
        contracts: allContracts.length,
        value: breakdown.reduce((sum, b) => sum + b.totalValue, 0),
      },
    };
  });

  // Pending signatures report
  app.get('/pending-signatures', {
    schema: {
      tags: ['reporting'],
      summary: 'Get contracts pending signatures',
      querystring: z.object({
        tenantId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { tenantId } = request.query as { tenantId: string };

    const db = getDb();

    // Get contracts in pending_signatures status
    const pendingContracts = await db.select()
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'pending_signatures'),
        isNull(contracts.deletedAt)
      ));

    // Get signature details for each
    const result = await Promise.all(pendingContracts.map(async (contract) => {
      const signatures = await db.select()
        .from(signatureRequests)
        .where(eq(signatureRequests.contractId, contract.id));

      const pending = signatures.filter(s => s.status === 'pending');
      const signed = signatures.filter(s => s.status === 'signed');
      const declined = signatures.filter(s => s.status === 'declined');

      return {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        signatures: {
          total: signatures.length,
          pending: pending.length,
          signed: signed.length,
          declined: declined.length,
        },
        pendingSigners: pending.map(s => ({
          id: s.id,
          name: s.signerName,
          email: s.signerEmail,
          requestedAt: s.requestedAt,
          expiresAt: s.expiresAt,
          reminderCount: s.reminderCount,
        })),
        createdAt: contract.createdAt,
      };
    }));

    return {
      data: result,
      total: result.length,
      summary: {
        totalPendingSignatures: result.reduce((sum, r) => sum + r.signatures.pending, 0),
      },
    };
  });

  // Compliance summary
  app.get('/compliance-summary', {
    schema: {
      tags: ['reporting'],
      summary: 'Get compliance summary for contracts',
      querystring: z.object({
        tenantId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { tenantId } = request.query as { tenantId: string };

    const db = getDb();

    const allContracts = await db.select()
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), isNull(contracts.deletedAt)));

    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const ninetyDaysLater = new Date();
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

    // Categorize issues
    const issues = {
      expired: allContracts.filter(c => c.status === 'expired'),
      expiringSoon: allContracts.filter(c =>
        c.status === 'active' &&
        c.expirationDate &&
        new Date(c.expirationDate) >= now &&
        new Date(c.expirationDate) <= thirtyDaysLater
      ),
      expiringMediumTerm: allContracts.filter(c =>
        c.status === 'active' &&
        c.expirationDate &&
        new Date(c.expirationDate) > thirtyDaysLater &&
        new Date(c.expirationDate) <= ninetyDaysLater
      ),
      missingDates: allContracts.filter(c =>
        c.status === 'active' &&
        (!c.effectiveDate || !c.expirationDate)
      ),
      pendingTooLong: allContracts.filter(c => {
        if (c.status !== 'pending_signatures') return false;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return c.updatedAt < sevenDaysAgo;
      }),
    };

    // Calculate compliance score (0-100)
    const activeContracts = allContracts.filter(c => c.status === 'active');
    const compliantContracts = activeContracts.filter(c =>
      c.effectiveDate &&
      c.expirationDate &&
      new Date(c.expirationDate) > thirtyDaysLater
    );

    const complianceScore = activeContracts.length > 0
      ? Math.round((compliantContracts.length / activeContracts.length) * 100)
      : 100;

    return {
      complianceScore,
      summary: {
        totalContracts: allContracts.length,
        activeContracts: activeContracts.length,
        compliantContracts: compliantContracts.length,
      },
      issues: {
        critical: {
          expired: issues.expired.length,
          expiringSoon: issues.expiringSoon.length,
        },
        warning: {
          expiringMediumTerm: issues.expiringMediumTerm.length,
          missingDates: issues.missingDates.length,
          pendingTooLong: issues.pendingTooLong.length,
        },
      },
      actionRequired: [
        ...issues.expired.map(c => ({
          priority: 'critical' as const,
          issue: 'expired',
          contractId: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
        })),
        ...issues.expiringSoon.map(c => ({
          priority: 'critical' as const,
          issue: 'expiring_soon',
          contractId: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
          expirationDate: c.expirationDate,
        })),
        ...issues.pendingTooLong.map(c => ({
          priority: 'warning' as const,
          issue: 'pending_too_long',
          contractId: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
        })),
      ].slice(0, 20), // Limit to top 20 actions
    };
  });

  // Template usage report
  app.get('/template-usage', {
    schema: {
      tags: ['reporting'],
      summary: 'Get template usage statistics',
      querystring: z.object({
        tenantId: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { tenantId } = request.query as { tenantId: string };

    const db = getDb();

    // Get all templates
    const templates = await db.select()
      .from(contractTemplates)
      .where(and(eq(contractTemplates.tenantId, tenantId), isNull(contractTemplates.deletedAt)));

    // Get contracts using templates
    const contractsWithTemplates = await db.select()
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        isNull(contracts.deletedAt)
      ));

    // Count usage per template
    const usageMap: Record<string, number> = {};
    for (const c of contractsWithTemplates) {
      if (c.templateId) {
        usageMap[c.templateId] = (usageMap[c.templateId] || 0) + 1;
      }
    }

    const templateStats = templates.map(t => ({
      id: t.id,
      name: t.name,
      contractType: t.contractType,
      status: t.status,
      usageCount: usageMap[t.id] || 0,
      createdAt: t.createdAt,
    }));

    // Sort by usage count descending
    templateStats.sort((a, b) => b.usageCount - a.usageCount);

    const contractsWithoutTemplate = contractsWithTemplates.filter(c => !c.templateId).length;

    return {
      data: templateStats,
      summary: {
        totalTemplates: templates.length,
        activeTemplates: templates.filter(t => t.status === 'active').length,
        totalUsage: Object.values(usageMap).reduce((sum, count) => sum + count, 0),
        contractsWithoutTemplate,
      },
    };
  });

  // Monthly activity report
  app.get('/monthly-activity', {
    schema: {
      tags: ['reporting'],
      summary: 'Get monthly contract activity',
      querystring: z.object({
        tenantId: z.string().uuid(),
        months: z.coerce.number().int().min(1).max(24).default(6),
      }),
    },
  }, async (request, reply) => {
    const { tenantId, months } = request.query as {
      tenantId: string;
      months: number;
    };

    const db = getDb();

    const allContracts = await db.select()
      .from(contracts)
      .where(and(eq(contracts.tenantId, tenantId), isNull(contracts.deletedAt)));

    // Generate monthly buckets
    const monthlyData: Array<{
      month: string;
      created: number;
      executed: number;
      terminated: number;
      expired: number;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const created = allContracts.filter(c =>
        c.createdAt >= monthStart && c.createdAt <= monthEnd
      ).length;

      const executed = allContracts.filter(c =>
        c.executedDate &&
        new Date(c.executedDate) >= monthStart &&
        new Date(c.executedDate) <= monthEnd
      ).length;

      const terminated = allContracts.filter(c =>
        c.terminatedDate &&
        new Date(c.terminatedDate) >= monthStart &&
        new Date(c.terminatedDate) <= monthEnd
      ).length;

      const expired = allContracts.filter(c =>
        c.status === 'expired' &&
        c.expirationDate &&
        new Date(c.expirationDate) >= monthStart &&
        new Date(c.expirationDate) <= monthEnd
      ).length;

      monthlyData.push({
        month: monthKey,
        created,
        executed,
        terminated,
        expired,
      });
    }

    return {
      data: monthlyData,
      period: {
        months,
        from: monthlyData[0]?.month,
        to: monthlyData[monthlyData.length - 1]?.month,
      },
    };
  });
};
