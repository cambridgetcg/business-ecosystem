/**
 * Enforceability Service
 *
 * Analyzes and manages restrictive covenant enforceability across different jurisdictions.
 * State-by-state non-compete analysis with consideration tracking.
 */

import {
  PrismaClient,
  RestrictiveCovenant,
  CovenantType,
  EnforceabilityStatus,
  CovenantStatus,
  Prisma
} from '#prisma';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

// States that ban non-compete agreements
const NON_COMPETE_BAN_STATES = ['CA', 'ND', 'OK', 'MN'];

// States with significant restrictions (income thresholds, duration limits, etc.)
const NON_COMPETE_RESTRICTED_STATES: Record<string, { threshold?: number; maxDuration?: number; notes: string }> = {
  'WA': { threshold: 100000, maxDuration: 547, notes: 'Income threshold $100K+, 18-month max' },
  'OR': { threshold: 100533, maxDuration: 547, notes: 'Income threshold indexed annually, 18-month max' },
  'ME': { threshold: 51326, notes: 'Income threshold ~$51K' },
  'IL': { threshold: 75000, notes: 'Income threshold $75K+' },
  'MA': { maxDuration: 365, notes: '12-month max, garden leave required' },
  'NH': { notes: 'Must be presented before offer acceptance' },
  'NV': { notes: 'Hourly workers exempt' },
  'RI': { notes: 'Limited to 1 year, narrowly construed' },
  'CO': { threshold: 112500, notes: 'Mostly void, limited exceptions for senior roles' },
  'DC': { threshold: 150000, notes: 'Ban for most workers, medical specialists $250K+' },
};

// Reasonableness factors by covenant type
const REASONABLENESS_FACTORS: Record<CovenantType, string[]> = {
  'NON_COMPETE': [
    'Duration reasonable for industry',
    'Geographic scope reasonable',
    'Protects legitimate business interest',
    'Not broader than necessary',
    'Employee received consideration',
  ],
  'NON_SOLICITATION': [
    'Limited to actual customers/contacts',
    'Duration reasonable (typically 1-2 years)',
    'Does not prevent general marketing',
    'Employee had access to protected relationships',
  ],
  'NON_POACHING': [
    'Limited to employees known to departing employee',
    'Duration reasonable',
    'Does not prevent hiring from public postings',
  ],
  'CONFIDENTIALITY': [
    'Information is actually confidential',
    'Company took reasonable protection measures',
    'Duration appropriate for information type',
  ],
  'NON_DISPARAGEMENT': [
    'Mutual obligation',
    'Does not prevent truthful statements',
    'Does not limit whistleblower rights',
  ],
  'INVENTION_ASSIGNMENT': [
    'Limited to work-related inventions',
    'Complies with state inventor rights laws',
    'Clear definition of covered inventions',
  ],
};

export interface CreateCovenantInput {
  employmentAgreementId: string;
  covenantType: CovenantType;
  durationDays?: number | undefined;
  geographicScope?: string | undefined;
  scopeDescription?: string | undefined;
  competitorNames?: string[] | undefined;
  customerRestriction?: boolean | undefined;
  employeeRestriction?: boolean | undefined;
  consideration?: string | undefined;
  considerationValue?: number | undefined;
  enforceabilityState?: string | undefined;
}

export interface CovenantQuery {
  employmentAgreementId?: string | undefined;
  covenantType?: CovenantType | undefined;
  enforceabilityStatus?: EnforceabilityStatus | undefined;
  status?: CovenantStatus | undefined;
  page: number;
  limit: number;
}

export interface EnforceabilityAnalysis {
  covenantId: string;
  state: string;
  status: EnforceabilityStatus;
  score: number;
  maxScore: number;
  factors: Array<{
    factor: string;
    met: boolean;
    notes?: string;
  }>;
  warnings: string[];
  recommendations: string[];
}

export class EnforceabilityService {
  private log = logger.child({ service: 'enforceability' });

  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Covenant Management
  // ============================================================================

  async createCovenant(input: CreateCovenantInput): Promise<RestrictiveCovenant> {
    const createData: Prisma.RestrictiveCovenantCreateInput = {
      employmentAgreement: { connect: { id: input.employmentAgreementId } },
      covenantType: input.covenantType,
      customerRestriction: input.customerRestriction ?? false,
      employeeRestriction: input.employeeRestriction ?? false,
      enforceabilityStatus: 'NOT_ANALYZED',
      status: 'ACTIVE',
    };

    if (input.durationDays) createData.durationDays = input.durationDays;
    if (input.geographicScope) createData.geographicScope = input.geographicScope;
    if (input.scopeDescription) createData.scopeDescription = input.scopeDescription;
    if (input.competitorNames) createData.competitorNames = input.competitorNames;
    if (input.consideration) createData.consideration = input.consideration;
    if (input.considerationValue) createData.considerationValue = input.considerationValue;
    if (input.enforceabilityState) createData.enforceabilityState = input.enforceabilityState;

    const covenant = await this.prisma.restrictiveCovenant.create({ data: createData });

    this.log.info({
      covenantId: covenant.id,
      agreementId: input.employmentAgreementId,
      type: input.covenantType,
    }, 'Restrictive covenant created');

    return covenant;
  }

  async getCovenant(id: string): Promise<RestrictiveCovenant> {
    const covenant = await this.prisma.restrictiveCovenant.findUnique({
      where: { id },
      include: {
        employmentAgreement: {
          select: { id: true, contractId: true, employeeName: true, jobTitle: true },
        },
      },
    });

    if (!covenant) throw new NotFoundError('RestrictiveCovenant', id);
    return covenant;
  }

  async listCovenants(query: CovenantQuery) {
    const where: Prisma.RestrictiveCovenantWhereInput = {};

    if (query.employmentAgreementId) where.employmentAgreementId = query.employmentAgreementId;
    if (query.covenantType) where.covenantType = query.covenantType;
    if (query.enforceabilityStatus) where.enforceabilityStatus = query.enforceabilityStatus;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.restrictiveCovenant.findMany({
        where,
        include: {
          employmentAgreement: {
            select: { id: true, contractId: true, employeeName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.restrictiveCovenant.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  // ============================================================================
  // Enforceability Analysis
  // ============================================================================

  async analyzeEnforceability(covenantId: string, state: string, analyzedBy: string): Promise<EnforceabilityAnalysis> {
    const covenant = await this.getCovenant(covenantId);
    const stateUpper = state.toUpperCase();

    const analysis: EnforceabilityAnalysis = {
      covenantId,
      state: stateUpper,
      status: 'NOT_ANALYZED',
      score: 0,
      maxScore: 0,
      factors: [],
      warnings: [],
      recommendations: [],
    };

    // Check for state bans
    if (covenant.covenantType === 'NON_COMPETE' && NON_COMPETE_BAN_STATES.includes(stateUpper)) {
      analysis.status = 'VOID_BY_LAW';
      analysis.warnings.push(`${stateUpper} prohibits non-compete agreements`);
      analysis.recommendations.push('Consider using non-solicitation or confidentiality provisions instead');

      await this.updateCovenantEnforceability(covenantId, analysis, analyzedBy);
      return analysis;
    }

    // Check for state restrictions
    const restrictions = NON_COMPETE_RESTRICTED_STATES[stateUpper];
    if (restrictions && covenant.covenantType === 'NON_COMPETE') {
      analysis.warnings.push(`${stateUpper}: ${restrictions.notes}`);

      if (restrictions.threshold) {
        analysis.recommendations.push(`Verify employee salary exceeds $${restrictions.threshold.toLocaleString()} threshold`);
      }

      if (restrictions.maxDuration && covenant.durationDays && covenant.durationDays > restrictions.maxDuration) {
        analysis.warnings.push(`Duration (${covenant.durationDays} days) exceeds state maximum (${restrictions.maxDuration} days)`);
        analysis.recommendations.push(`Reduce duration to ${restrictions.maxDuration} days or less`);
      }
    }

    // Analyze reasonableness factors
    const factors = REASONABLENESS_FACTORS[covenant.covenantType] || [];
    analysis.maxScore = factors.length;

    for (const factor of factors) {
      const evaluation = this.evaluateFactor(covenant, factor);
      analysis.factors.push(evaluation);
      if (evaluation.met) analysis.score++;
    }

    // Determine status based on score
    const scorePercentage = analysis.maxScore > 0 ? (analysis.score / analysis.maxScore) * 100 : 0;

    if (scorePercentage >= 80) {
      analysis.status = 'LIKELY_ENFORCEABLE';
    } else if (scorePercentage >= 60) {
      analysis.status = 'PARTIALLY_ENFORCEABLE';
    } else if (scorePercentage >= 40) {
      analysis.status = 'NEEDS_REVIEW';
    } else {
      analysis.status = 'UNLIKELY_ENFORCEABLE';
    }

    // Additional warnings based on covenant specifics
    if (!covenant.consideration && !covenant.considerationValue) {
      analysis.warnings.push('No consideration documented - may affect enforceability');
      analysis.recommendations.push('Document the consideration provided to the employee');
    }

    if (covenant.covenantType === 'NON_COMPETE' && !covenant.geographicScope) {
      analysis.warnings.push('No geographic scope defined - may be overly broad');
      analysis.recommendations.push('Define reasonable geographic limitations');
    }

    await this.updateCovenantEnforceability(covenantId, analysis, analyzedBy);

    this.log.info({
      covenantId,
      state: stateUpper,
      status: analysis.status,
      score: `${analysis.score}/${analysis.maxScore}`,
    }, 'Enforceability analysis completed');

    return analysis;
  }

  private evaluateFactor(covenant: RestrictiveCovenant, factor: string): { factor: string; met: boolean; notes?: string } {
    // Duration checks
    if (factor.toLowerCase().includes('duration')) {
      if (!covenant.durationDays) {
        return { factor, met: false, notes: 'No duration specified' };
      }
      const isReasonable = covenant.durationDays <= 730; // 2 years max for most
      return { factor, met: isReasonable, notes: 'Duration: ' + covenant.durationDays + ' days' };
    }

    // Geographic scope checks
    if (factor.toLowerCase().includes('geographic')) {
      if (!covenant.geographicScope) {
        return { factor, met: false, notes: 'No geographic scope defined' };
      }
      return { factor, met: true, notes: covenant.geographicScope };
    }

    // Consideration checks
    if (factor.toLowerCase().includes('consideration')) {
      const hasCon = !!covenant.consideration || !!covenant.considerationValue;
      if (hasCon) {
        const result: { factor: string; met: boolean; notes?: string } = { factor, met: true };
        if (covenant.consideration) result.notes = covenant.consideration;
        return result;
      }
      return { factor, met: false, notes: 'No consideration documented' };
    }

    // Default: assume met if we can't evaluate
    return { factor, met: true, notes: 'Manual review recommended' };
  }

  private async updateCovenantEnforceability(
    covenantId: string,
    analysis: EnforceabilityAnalysis,
    analyzedBy: string
  ): Promise<void> {
    const notes = [
      `Score: ${analysis.score}/${analysis.maxScore}`,
      ...analysis.warnings.map(w => `Warning: ${w}`),
      ...analysis.recommendations.map(r => `Recommendation: ${r}`),
    ].join('\n');

    await this.prisma.restrictiveCovenant.update({
      where: { id: covenantId },
      data: {
        enforceabilityState: analysis.state,
        enforceabilityStatus: analysis.status,
        enforceabilityNotes: notes,
        analyzedAt: new Date(),
        analyzedBy,
      },
    });
  }

  // ============================================================================
  // Covenant Lifecycle
  // ============================================================================

  async waiveCovenant(id: string, waivedBy: string, reason: string): Promise<RestrictiveCovenant> {
    const covenant = await this.getCovenant(id);

    if (covenant.status !== 'ACTIVE') {
      throw new ValidationError('Can only waive active covenants');
    }

    const updated = await this.prisma.restrictiveCovenant.update({
      where: { id },
      data: {
        status: 'WAIVED',
        waivedAt: new Date(),
        waivedBy,
        waiverReason: reason,
      },
    });

    this.log.info({ covenantId: id, waivedBy, reason }, 'Covenant waived');
    return updated;
  }

  async markExpired(id: string): Promise<RestrictiveCovenant> {
    const covenant = await this.getCovenant(id);

    if (covenant.status !== 'ACTIVE') {
      throw new ValidationError('Can only expire active covenants');
    }

    const updated = await this.prisma.restrictiveCovenant.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });

    this.log.info({ covenantId: id }, 'Covenant marked as expired');
    return updated;
  }

  async markEnforced(id: string): Promise<RestrictiveCovenant> {
    const covenant = await this.getCovenant(id);

    if (covenant.status !== 'ACTIVE') {
      throw new ValidationError('Can only enforce active covenants');
    }

    const updated = await this.prisma.restrictiveCovenant.update({
      where: { id },
      data: { status: 'ENFORCED' },
    });

    this.log.info({ covenantId: id }, 'Covenant enforcement initiated');
    return updated;
  }

  async markChallenged(id: string): Promise<RestrictiveCovenant> {
    const covenant = await this.getCovenant(id);

    if (covenant.status !== 'ACTIVE' && covenant.status !== 'ENFORCED') {
      throw new ValidationError('Can only challenge active or enforced covenants');
    }

    const updated = await this.prisma.restrictiveCovenant.update({
      where: { id },
      data: { status: 'CHALLENGED' },
    });

    this.log.info({ covenantId: id }, 'Covenant challenged');
    return updated;
  }

  // ============================================================================
  // Reporting
  // ============================================================================

  async getExpiringCovenants(daysAhead: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Find agreements that are ending, which would trigger covenant expiration
    const expiringAgreements = await this.prisma.employmentAgreement.findMany({
      where: {
        endDate: { lte: cutoffDate },
        restrictiveCovenants: {
          some: { status: 'ACTIVE' },
        },
      },
      include: {
        restrictiveCovenants: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    return expiringAgreements;
  }

  async getCovenantsNeedingAnalysis() {
    return this.prisma.restrictiveCovenant.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { enforceabilityStatus: 'NOT_ANALYZED' },
          { enforceabilityStatus: 'NEEDS_REVIEW' },
        ],
      },
      include: {
        employmentAgreement: {
          select: { id: true, contractId: true, employeeName: true, location: true },
        },
      },
    });
  }

  async getEnforceabilitySummary() {
    const statusCounts = await this.prisma.restrictiveCovenant.groupBy({
      by: ['enforceabilityStatus'],
      where: { status: 'ACTIVE' },
      _count: true,
    });

    const typeCounts = await this.prisma.restrictiveCovenant.groupBy({
      by: ['covenantType'],
      where: { status: 'ACTIVE' },
      _count: true,
    });

    return {
      byStatus: Object.fromEntries(statusCounts.map(s => [s.enforceabilityStatus, s._count])),
      byType: Object.fromEntries(typeCounts.map(t => [t.covenantType, t._count])),
      banStates: NON_COMPETE_BAN_STATES,
      restrictedStates: Object.keys(NON_COMPETE_RESTRICTED_STATES),
    };
  }
}

export function createEnforceabilityService(prisma: PrismaClient): EnforceabilityService {
  return new EnforceabilityService(prisma);
}
