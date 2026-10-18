/**
 * Compliance Dashboard Service
 *
 * Provides comprehensive compliance status tracking across all IP asset types:
 * - Trademarks: Section 8, Section 9, Section 15, Madrid Protocol
 * - Patents: Maintenance fees (3.5yr, 7.5yr, 11.5yr windows)
 * - Domains: Expiration, UDRP disputes, auto-renewal
 * - Copyrights: Registration, renewal requirements, duration tracking
 *
 * @module application/services
 */

import type { Database } from '../../infrastructure/persistence/database.js';
import { sql } from 'drizzle-orm';
import {
  trademarks,
  patents,
  copyrights,
  domainNames,
  domainDisputes,
  patentMaintenanceFees,
} from '../../infrastructure/persistence/schema.js';
import {
  TrademarkComplianceService,
  trademarkComplianceService,
} from '../../domain/services/trademark-compliance.service.js';
import {
  CopyrightDurationService,
  copyrightDurationService,
  type CopyrightWorkDetails,
  type AuthorshipType,
} from '../../domain/services/copyright-duration.service.js';
import type {
  TrademarkComplianceStatus,
  Section8ComplianceStatus,
  Section9ComplianceStatus,
  Section15ComplianceStatus,
  MadridProtocolStatus,
  TrademarkComplianceDeadline,
  PatentComplianceStatus,
  MaintenanceFeeWindowStatus,
  UpcomingMaintenanceFee,
  DomainComplianceStatus,
  DomainExpirationStatus,
  DomainDisputeStatus,
  RegistrarDistribution,
  AutoRenewalStatus,
  UpcomingDomainExpiration,
  CopyrightComplianceStatus,
  CopyrightRegistrationStatus,
  CopyrightRenewalStatus,
  CopyrightDurationTracking,
  OverallComplianceScore,
  ComplianceRiskIndicator,
  ComplianceActionItem,
  ComplianceDashboardData,
  ComplianceRiskLevel,
  ComplianceTrend,
  ComplianceTrendDataPoint,
} from './compliance-types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Weights for calculating overall compliance score.
 */
const COMPLIANCE_WEIGHTS = {
  trademark: 0.30,
  patent: 0.35,
  domain: 0.20,
  copyright: 0.15,
};

/**
 * US Patent maintenance fee amounts (2024 rates, in cents).
 */
const US_MAINTENANCE_FEES = {
  large: {
    '3.5yr': 200000, // $2,000
    '7.5yr': 375000, // $3,750
    '11.5yr': 770000, // $7,700
  },
  small: {
    '3.5yr': 100000, // $1,000
    '7.5yr': 187500, // $1,875
    '11.5yr': 385000, // $3,850
  },
  micro: {
    '3.5yr': 50000, // $500
    '7.5yr': 93750, // $937.50
    '11.5yr': 192500, // $1,925
  },
  surcharge: 16000, // $160 surcharge for grace period
};

// ============================================================================
// Compliance Dashboard Service
// ============================================================================

export class ComplianceDashboardService {
  constructor(
    private readonly db: Database,
    private readonly trademarkService: TrademarkComplianceService = trademarkComplianceService,
    private readonly copyrightService: CopyrightDurationService = copyrightDurationService
  ) {}

  // ==========================================================================
  // Main Dashboard Methods
  // ==========================================================================

  /**
   * Get complete compliance dashboard data for all IP types.
   */
  async getComplianceDashboard(): Promise<ComplianceDashboardData> {
    const [trademark, patent, domain, copyright] = await Promise.all([
      this.getTrademarkComplianceStatus(),
      this.getPatentComplianceStatus(),
      this.getDomainComplianceStatus(),
      this.getCopyrightComplianceStatus(),
    ]);

    const overall = this.calculateOverallComplianceScore(trademark, patent, domain, copyright);

    return {
      trademark,
      patent,
      domain,
      copyright,
      overall,
    };
  }

  // ==========================================================================
  // Trademark Compliance
  // ==========================================================================

  /**
   * Get comprehensive trademark compliance status.
   */
  async getTrademarkComplianceStatus(): Promise<TrademarkComplianceStatus> {
    const now = new Date();
    const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    // Get all registered trademarks
    const registeredTrademarks = await this.db
      .select()
      .from(trademarks)
      .where(sql`${trademarks.status} = 'registered' AND ${trademarks.deletedAt} IS NULL`);

    // Calculate Section 8, 9, 15 status
    const section8 = this.calculateSection8Status(registeredTrademarks, now, sixMonthsFromNow);
    const section9 = this.calculateSection9Status(registeredTrademarks, now, sixMonthsFromNow);
    const section15 = this.calculateSection15Status(registeredTrademarks, now, sixMonthsFromNow);

    // Madrid Protocol status (simplified - would need Madrid data in production)
    const madridProtocol = this.calculateMadridStatus();

    // Calculate overall trademark compliance score
    const complianceScore = this.calculateTrademarkComplianceScore(section8, section9, section15);
    const riskLevel = this.scoreToRiskLevel(complianceScore);
    const trend = this.calculateTrend(complianceScore, 85); // Placeholder previous score

    return {
      section8,
      section9,
      section15,
      madridProtocol,
      complianceScore,
      riskLevel,
      totalRegistered: registeredTrademarks.length,
      trend,
    };
  }

  private calculateSection8Status(
    trademarkData: Array<{ registrationDate: string | null; mark: string; registrationNumber: string | null; id: string }>,
    now: Date,
    sixMonthsFromNow: Date
  ): Section8ComplianceStatus {
    let compliant = 0;
    let dueSoon = 0;
    let inGracePeriod = 0;
    let overdue = 0;
    const upcomingDeadlines: TrademarkComplianceDeadline[] = [];

    for (const tm of trademarkData) {
      if (!tm.registrationDate) continue;

      const regDate = new Date(tm.registrationDate);
      const yearsSinceReg = (now.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

      // Section 8 is due between 5-6 years, then every 10 years combined with Section 9
      const isInFirstWindow = yearsSinceReg >= 5 && yearsSinceReg < 6;
      const isInFirstGracePeriod = yearsSinceReg >= 6 && yearsSinceReg < 6.5;
      const isFirstOverdue = yearsSinceReg >= 6.5 && yearsSinceReg < 7;

      if (isInFirstWindow) {
        dueSoon++;
        const dueDate = new Date(regDate);
        dueDate.setFullYear(dueDate.getFullYear() + 6);
        upcomingDeadlines.push(this.createTrademarkDeadline(tm, 'section_8', dueDate, now));
      } else if (isInFirstGracePeriod) {
        inGracePeriod++;
        const dueDate = new Date(regDate);
        dueDate.setFullYear(dueDate.getFullYear() + 6);
        upcomingDeadlines.push(this.createTrademarkDeadline(tm, 'section_8', dueDate, now, true));
      } else if (isFirstOverdue) {
        overdue++;
      } else {
        // Check subsequent windows (9-10, 19-20, etc.)
        const decadesSinceReg = Math.floor((yearsSinceReg - 4) / 10);
        const yearsIntoDecade = yearsSinceReg - (decadesSinceReg * 10 + 4);

        if (yearsIntoDecade >= 5 && yearsIntoDecade < 6) {
          dueSoon++;
        } else if (yearsIntoDecade >= 6 && yearsIntoDecade < 6.5) {
          inGracePeriod++;
        } else if (yearsIntoDecade >= 6.5 && yearsIntoDecade < 7) {
          overdue++;
        } else {
          compliant++;
        }
      }
    }

    return {
      total: trademarkData.length,
      compliant,
      dueSoon,
      inGracePeriod,
      overdue,
      upcomingDeadlines: upcomingDeadlines.slice(0, 10), // Top 10 urgent
    };
  }

  private calculateSection9Status(
    trademarkData: Array<{ registrationDate: string | null; mark: string; registrationNumber: string | null; id: string }>,
    now: Date,
    sixMonthsFromNow: Date
  ): Section9ComplianceStatus {
    let compliant = 0;
    let dueSoon = 0;
    let inGracePeriod = 0;
    let overdue = 0;
    const upcomingDeadlines: TrademarkComplianceDeadline[] = [];

    for (const tm of trademarkData) {
      if (!tm.registrationDate) continue;

      const regDate = new Date(tm.registrationDate);
      const yearsSinceReg = (now.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

      // Section 9 renewal every 10 years (9-10 year window)
      const decadesSinceReg = Math.floor(yearsSinceReg / 10);
      const yearsIntoDecade = yearsSinceReg - decadesSinceReg * 10;

      if (yearsIntoDecade >= 9 && yearsIntoDecade < 10) {
        dueSoon++;
        const dueDate = new Date(regDate);
        dueDate.setFullYear(dueDate.getFullYear() + (decadesSinceReg + 1) * 10);
        upcomingDeadlines.push(this.createTrademarkDeadline(tm, 'section_9', dueDate, now));
      } else if (yearsIntoDecade >= 10 && yearsIntoDecade < 10.5) {
        inGracePeriod++;
      } else if (decadesSinceReg > 0 && yearsIntoDecade < 1) {
        overdue++;
      } else {
        compliant++;
      }
    }

    return {
      total: trademarkData.length,
      compliant,
      dueSoon,
      inGracePeriod,
      overdue,
      upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    };
  }

  private calculateSection15Status(
    trademarkData: Array<{ registrationDate: string | null; mark: string; registrationNumber: string | null; id: string }>,
    now: Date,
    sixMonthsFromNow: Date
  ): Section15ComplianceStatus {
    let eligible = 0;
    let filed = 0; // Would need Section 15 filing data
    let pendingFiling = 0;
    let notYetEligible = 0;
    let approachingEligibility = 0;

    for (const tm of trademarkData) {
      if (!tm.registrationDate) continue;

      const regDate = new Date(tm.registrationDate);
      const yearsSinceReg = (now.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

      if (yearsSinceReg >= 5) {
        eligible++;
        pendingFiling++; // Simplified - would check actual filings
      } else if (yearsSinceReg >= 4.5) {
        approachingEligibility++;
      } else {
        notYetEligible++;
      }
    }

    return {
      eligible,
      filed,
      pendingFiling,
      notYetEligible,
      approachingEligibility,
    };
  }

  private calculateMadridStatus(): MadridProtocolStatus {
    // Placeholder - would need Madrid designation data
    return {
      totalRegistrations: 0,
      activeDesignations: 0,
      pendingDesignations: 0,
      responsesDue: 0,
      renewalsDue: 0,
      inCentralAttackPeriod: 0,
      byCountry: [],
    };
  }

  private calculateTrademarkComplianceScore(
    section8: Section8ComplianceStatus,
    section9: Section9ComplianceStatus,
    section15: Section15ComplianceStatus
  ): number {
    const total8 = section8.total || 1;
    const total9 = section9.total || 1;

    // Section 8 weight: 40%, Section 9 weight: 40%, Section 15 weight: 20%
    const section8Score = ((section8.compliant + section8.dueSoon * 0.5) / total8) * 100 * 0.4;
    const section9Score = ((section9.compliant + section9.dueSoon * 0.5) / total9) * 100 * 0.4;
    const section15Score = section15.eligible > 0
      ? ((section15.filed / section15.eligible) * 100 * 0.2)
      : 20; // Full score if no eligible marks

    return Math.round(section8Score + section9Score + section15Score);
  }

  private createTrademarkDeadline(
    tm: { id: string; mark: string; registrationNumber: string | null; registrationDate: string | null },
    type: 'section_8' | 'section_9' | 'section_15' | 'madrid_renewal' | 'madrid_response',
    dueDate: Date,
    now: Date,
    isGracePeriod = false
  ): TrademarkComplianceDeadline {
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const gracePeriodEnds = new Date(dueDate);
    gracePeriodEnds.setMonth(gracePeriodEnds.getMonth() + 6);

    return {
      trademarkId: tm.id,
      mark: tm.mark,
      registrationNumber: tm.registrationNumber,
      deadlineType: type,
      dueDate,
      gracePeriodEnds,
      daysUntilDue: isGracePeriod ? -Math.abs(daysUntilDue) : daysUntilDue,
      priority: this.daysToPriority(daysUntilDue),
      estimatedFee: type === 'section_8' ? 22500 : type === 'section_9' ? 30000 : 20000, // in cents
      currency: 'USD',
    };
  }

  // ==========================================================================
  // Patent Compliance
  // ==========================================================================

  /**
   * Get comprehensive patent maintenance fee compliance status.
   */
  async getPatentComplianceStatus(): Promise<PatentComplianceStatus> {
    const now = new Date();

    // Get all maintenance fees
    const fees = await this.db
      .select({
        id: patentMaintenanceFees.id,
        patentId: patentMaintenanceFees.patentId,
        feeNumber: patentMaintenanceFees.feeNumber,
        dueDate: patentMaintenanceFees.dueDate,
        windowOpensDate: patentMaintenanceFees.windowOpensDate,
        gracePeriodEndsDate: patentMaintenanceFees.gracePeriodEndsDate,
        status: patentMaintenanceFees.status,
      })
      .from(patentMaintenanceFees)
      .where(sql`${patentMaintenanceFees.deletedAt} IS NULL`);

    // Get patent details for the fees
    const patentIds = [...new Set(fees.map(f => f.patentId))];
    const patentData = patentIds.length > 0
      ? await this.db
          .select({
            id: patents.id,
            patentNumber: patents.patentNumber,
            title: patents.title,
          })
          .from(patents)
          .where(sql`${patents.id} IN (${sql.join(patentIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    const patentMap = new Map(patentData.map(p => [p.id, p]));

    // Calculate status by window
    const byWindow = {
      '3.5yr': this.calculateWindowStatus(fees.filter(f => f.feeNumber === 1)),
      '7.5yr': this.calculateWindowStatus(fees.filter(f => f.feeNumber === 2)),
      '11.5yr': this.calculateWindowStatus(fees.filter(f => f.feeNumber === 3)),
    };

    // Calculate summary
    const summary = {
      totalActive: patentIds.length,
      totalPaid: fees.filter(f => f.status === 'paid').length,
      totalPayable: fees.filter(f => f.status === 'payable').length,
      totalInGracePeriod: fees.filter(f => f.status === 'grace_period').length,
      totalMissed: fees.filter(f => f.status === 'missed').length,
      totalUpcoming: fees.filter(f => f.status === 'upcoming').length,
    };

    // Get upcoming fees
    const upcomingFees = this.getUpcomingMaintenanceFees(fees, patentMap, now);

    // Grace period tracking
    const gracePeriodFees = fees.filter(f => f.status === 'grace_period');
    const gracePeriodTracking = {
      inGracePeriod: gracePeriodFees.length,
      gracePeriodEndingSoon: gracePeriodFees.filter(f => {
        const endDate = new Date(f.gracePeriodEndsDate);
        const daysUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilEnd <= 30;
      }).length,
      surchargeAmount: US_MAINTENANCE_FEES.surcharge,
    };

    // Calculate compliance score
    const complianceScore = this.calculatePatentComplianceScore(summary);
    const riskLevel = this.scoreToRiskLevel(complianceScore);
    const trend = this.calculateTrend(complianceScore, 90); // Placeholder

    return {
      byWindow,
      summary,
      upcomingFees,
      gracePeriodTracking,
      complianceScore,
      riskLevel,
      trend,
    };
  }

  private calculateWindowStatus(
    fees: Array<{ status: string }>
  ): MaintenanceFeeWindowStatus {
    const window = '3.5yr' as const; // Will be overridden by caller context

    return {
      window,
      paid: fees.filter(f => f.status === 'paid').length,
      payable: fees.filter(f => f.status === 'payable').length,
      inGracePeriod: fees.filter(f => f.status === 'grace_period').length,
      missed: fees.filter(f => f.status === 'missed').length,
      upcoming: fees.filter(f => f.status === 'upcoming').length,
      total: fees.length,
    };
  }

  private getUpcomingMaintenanceFees(
    fees: Array<{
      id: string;
      patentId: string;
      feeNumber: number;
      dueDate: string;
      windowOpensDate: string;
      gracePeriodEndsDate: string;
      status: string;
    }>,
    patentMap: Map<string, { id: string; patentNumber: string | null; title: string }>,
    now: Date
  ): UpcomingMaintenanceFee[] {
    const activeFees = fees.filter(f =>
      f.status === 'payable' || f.status === 'grace_period' || f.status === 'upcoming'
    );

    return activeFees
      .map(fee => {
        const patent = patentMap.get(fee.patentId);
        const dueDate = new Date(fee.dueDate);
        const windowOpens = new Date(fee.windowOpensDate);
        const gracePeriodEnds = new Date(fee.gracePeriodEndsDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const feeWindow = fee.feeNumber === 1 ? '3.5yr' : fee.feeNumber === 2 ? '7.5yr' : '11.5yr';

        return {
          feeId: fee.id,
          patentId: fee.patentId,
          patentNumber: patent?.patentNumber ?? null,
          patentTitle: patent?.title ?? 'Unknown Patent',
          feeWindow: feeWindow as '3.5yr' | '7.5yr' | '11.5yr',
          dueDate,
          windowOpens,
          gracePeriodEnds,
          daysUntilDue,
          isInGracePeriod: fee.status === 'grace_period',
          estimatedFee: US_MAINTENANCE_FEES.small[feeWindow],
          currency: 'USD',
          status: fee.status as 'upcoming' | 'payable' | 'grace_period',
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 20);
  }

  private calculatePatentComplianceScore(summary: {
    totalActive: number;
    totalPaid: number;
    totalPayable: number;
    totalInGracePeriod: number;
    totalMissed: number;
    totalUpcoming: number;
  }): number {
    const total = summary.totalPaid + summary.totalPayable + summary.totalInGracePeriod +
                  summary.totalMissed + summary.totalUpcoming;

    if (total === 0) return 100;

    // Scoring: Paid = 100%, Upcoming = 100%, Payable = 75%, Grace Period = 50%, Missed = 0%
    const score =
      (summary.totalPaid * 100 +
        summary.totalUpcoming * 100 +
        summary.totalPayable * 75 +
        summary.totalInGracePeriod * 50 +
        summary.totalMissed * 0) /
      total;

    return Math.round(score);
  }

  // ==========================================================================
  // Domain Compliance
  // ==========================================================================

  /**
   * Get comprehensive domain compliance status.
   */
  async getDomainComplianceStatus(): Promise<DomainComplianceStatus> {
    const now = new Date();
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Get all domains
    const domains = await this.db
      .select()
      .from(domainNames)
      .where(sql`${domainNames.deletedAt} IS NULL`);

    // Get all disputes
    const disputes = await this.db
      .select()
      .from(domainDisputes)
      .where(sql`${domainDisputes.deletedAt} IS NULL`);

    // Calculate expiration status
    const expiration = this.calculateDomainExpirationStatus(domains, now, oneMonth, threeMonths);

    // Calculate dispute status
    const disputeStatus = this.calculateDomainDisputeStatus(disputes);

    // Calculate registrar distribution
    const registrarDistribution = this.calculateRegistrarDistribution(domains);

    // Calculate auto-renewal status
    const autoRenewal = this.calculateAutoRenewalStatus(domains);

    // Get upcoming expirations
    const upcomingExpirations = this.getUpcomingDomainExpirations(domains, now);

    // Summary
    const summary = {
      totalDomains: domains.length,
      activeDomains: domains.filter(d => d.status === 'active').length,
      defensiveRegistrations: domains.filter(d => d.purpose === 'defensive').length,
      linkedToTrademarks: domains.filter(d => d.linkedTrademarkId !== null).length,
    };

    // Calculate compliance score
    const complianceScore = this.calculateDomainComplianceScore(expiration, autoRenewal);
    const riskLevel = this.scoreToRiskLevel(complianceScore);
    const trend = this.calculateTrend(complianceScore, 88); // Placeholder

    return {
      expiration,
      disputes: disputeStatus,
      registrarDistribution,
      autoRenewal,
      upcomingExpirations,
      summary,
      complianceScore,
      riskLevel,
      trend,
    };
  }

  private calculateDomainExpirationStatus(
    domains: Array<{ expirationDate: string; status: string }>,
    now: Date,
    oneMonth: Date,
    threeMonths: Date
  ): DomainExpirationStatus {
    let current = 0;
    let expiringThisMonth = 0;
    let expiringThisQuarter = 0;
    let expired = 0;
    let inRedemption = 0;

    for (const domain of domains) {
      if (domain.status === 'redemption') {
        inRedemption++;
        continue;
      }

      if (domain.status === 'expired') {
        expired++;
        continue;
      }

      if (!domain.expirationDate) {
        current++;
        continue;
      }

      const expDate = new Date(domain.expirationDate);

      if (expDate < now) {
        expired++;
      } else if (expDate <= oneMonth) {
        expiringThisMonth++;
      } else if (expDate <= threeMonths) {
        expiringThisQuarter++;
      } else {
        current++;
      }
    }

    return { current, expiringThisMonth, expiringThisQuarter, expired, inRedemption };
  }

  private calculateDomainDisputeStatus(
    disputes: Array<{ status: string; outcome: string | null }>
  ): DomainDisputeStatus {
    const activeStatuses = ['pending', 'filed', 'response_due', 'hearing'];
    const activeDisputes = disputes.filter(d => activeStatuses.includes(d.status)).length;
    const responsesDue = disputes.filter(d => d.status === 'response_due').length;
    const won = disputes.filter(d => d.outcome === 'transfer').length;
    const lost = disputes.filter(d => d.outcome === 'maintain').length;
    const settled = disputes.filter(d => d.outcome === 'settled').length;

    return {
      activeDisputes,
      responsesDue,
      won,
      lost,
      settled,
      totalHistorical: disputes.length,
    };
  }

  private calculateRegistrarDistribution(
    domains: Array<{ registrarName: string }>
  ): RegistrarDistribution[] {
    const registrarCounts = new Map<string, number>();

    for (const domain of domains) {
      const count = registrarCounts.get(domain.registrarName) || 0;
      registrarCounts.set(domain.registrarName, count + 1);
    }

    const total = domains.length || 1;

    return Array.from(registrarCounts.entries())
      .map(([registrar, count]) => ({
        registrar,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateAutoRenewalStatus(
    domains: Array<{ autoRenew: boolean }>
  ): AutoRenewalStatus {
    const enabled = domains.filter(d => d.autoRenew).length;
    const disabled = domains.filter(d => !d.autoRenew).length;
    const total = domains.length || 1;

    return {
      enabled,
      disabled,
      enabledPercentage: Math.round((enabled / total) * 100),
    };
  }

  private getUpcomingDomainExpirations(
    domains: Array<{
      id: string;
      domainName: string;
      tld: string;
      expirationDate: string;
      autoRenew: boolean;
      registrarName: string;
      linkedTrademarkId: string | null;
      purpose: string;
    }>,
    now: Date
  ): UpcomingDomainExpiration[] {
    return domains
      .filter(d => d.expirationDate)
      .map(d => {
        const expDate = new Date(d.expirationDate);
        const daysUntilExpiration = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          domainId: d.id,
          domainName: d.domainName,
          tld: d.tld,
          expirationDate: expDate,
          daysUntilExpiration,
          autoRenew: d.autoRenew,
          registrar: d.registrarName,
          linkedTrademarkId: d.linkedTrademarkId,
          isDefensive: d.purpose === 'defensive' || d.linkedTrademarkId !== null,
          priority: this.daysToPriority(daysUntilExpiration),
        };
      })
      .filter(d => d.daysUntilExpiration <= 90) // Only show domains expiring within 90 days
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
      .slice(0, 20);
  }

  private calculateDomainComplianceScore(
    expiration: DomainExpirationStatus,
    autoRenewal: AutoRenewalStatus
  ): number {
    const total = expiration.current + expiration.expiringThisMonth +
                  expiration.expiringThisQuarter + expiration.expired + expiration.inRedemption;

    if (total === 0) return 100;

    // Expiration score: Current = 100%, Expiring this quarter = 75%, Expiring this month = 50%, Expired/Redemption = 0%
    const expirationScore =
      ((expiration.current * 100 +
        expiration.expiringThisQuarter * 75 +
        expiration.expiringThisMonth * 50 +
        (expiration.expired + expiration.inRedemption) * 0) /
        total) * 0.7;

    // Auto-renewal score contributes 30%
    const autoRenewalScore = autoRenewal.enabledPercentage * 0.3;

    return Math.round(expirationScore + autoRenewalScore);
  }

  // ==========================================================================
  // Copyright Compliance
  // ==========================================================================

  /**
   * Get comprehensive copyright compliance status.
   */
  async getCopyrightComplianceStatus(): Promise<CopyrightComplianceStatus> {
    // Get all copyrights
    const copyrightData = await this.db
      .select()
      .from(copyrights)
      .where(sql`${copyrights.deletedAt} IS NULL`);

    // Calculate registration status
    const registration = this.calculateCopyrightRegistrationStatus(copyrightData);

    // Calculate renewal status (pre-1978 works)
    const renewal = this.calculateCopyrightRenewalStatus(copyrightData);

    // Calculate duration tracking
    const duration = this.calculateCopyrightDurationTracking(copyrightData);

    // Summary
    const summary = {
      totalCopyrights: copyrightData.length,
      activeProtection: copyrightData.filter(c => c.status !== 'disputed').length,
      workForHire: copyrightData.filter(c =>
        (c.authors as Array<{ isWorkForHire: boolean }>)?.some(a => a.isWorkForHire)
      ).length,
      individualAuthored: copyrightData.filter(c =>
        (c.authors as Array<{ isWorkForHire: boolean }>)?.length === 1 &&
        !(c.authors as Array<{ isWorkForHire: boolean }>)?.[0]?.isWorkForHire
      ).length,
      jointAuthored: copyrightData.filter(c =>
        (c.authors as Array<{ isWorkForHire: boolean }>)?.length > 1 &&
        !(c.authors as Array<{ isWorkForHire: boolean }>)?.some(a => a.isWorkForHire)
      ).length,
    };

    // Calculate compliance score
    const complianceScore = this.calculateCopyrightComplianceScore(registration, renewal);
    const riskLevel = this.scoreToRiskLevel(complianceScore);
    const trend = this.calculateTrend(complianceScore, 80); // Placeholder

    return {
      registration,
      renewal,
      duration,
      summary,
      complianceScore,
      riskLevel,
      trend,
    };
  }

  private calculateCopyrightRegistrationStatus(
    data: Array<{ status: string }>
  ): CopyrightRegistrationStatus {
    const registered = data.filter(c => c.status === 'registered').length;
    const pending = data.filter(c => c.status === 'pending').length;
    const unregistered = data.filter(c => c.status === 'unregistered').length;
    const total = data.length || 1;

    return {
      registered,
      pending,
      unregistered,
      registrationRate: Math.round((registered / total) * 100),
    };
  }

  private calculateCopyrightRenewalStatus(
    data: Array<{ creationDate: string; publicationDate: string | null }>
  ): CopyrightRenewalStatus {
    const pre1978Cutoff = new Date('1978-01-01');

    // Filter works created before 1978 (subject to renewal requirements)
    const pre1978Works = data.filter(c => {
      const pubDate = c.publicationDate ? new Date(c.publicationDate) : null;
      return pubDate && pubDate < pre1978Cutoff;
    });

    // Simplified - would need actual renewal filing data
    return {
      requiresRenewal: pre1978Works.length,
      renewed: 0, // Would need renewal filing data
      renewalDue: 0,
      missed: 0,
    };
  }

  private calculateCopyrightDurationTracking(
    data: Array<{
      creationDate: string;
      publicationDate: string | null;
      isPublished: boolean;
      authors: unknown;
    }>
  ): CopyrightDurationTracking {
    let knownExpiration = 0;
    let estimatedExpiration = 0;
    let requiresDeathTracking = 0;
    let inPublicDomain = 0;
    let authorsRequiringTracking = 0;

    const now = new Date();
    const pre1928Cutoff = new Date('1928-01-01');

    for (const copyright of data) {
      const pubDate = copyright.publicationDate ? new Date(copyright.publicationDate) : null;

      // Check if in public domain (pre-1928 publication)
      if (pubDate && pubDate < pre1928Cutoff) {
        inPublicDomain++;
        continue;
      }

      const authors = (copyright.authors as Array<{
        name: string;
        isWorkForHire: boolean;
        dateOfDeath?: string;
        isAlive?: boolean;
      }>) || [];

      // Check if work-for-hire (fixed term, no death tracking)
      const isWorkForHire = authors.some(a => a.isWorkForHire);
      if (isWorkForHire) {
        knownExpiration++;
        continue;
      }

      // Check author death tracking requirements
      const needsTracking = authors.some(a => !a.dateOfDeath && a.isAlive !== false);
      if (needsTracking) {
        requiresDeathTracking++;
        authorsRequiringTracking += authors.filter(a => !a.dateOfDeath && a.isAlive !== false).length;
        estimatedExpiration++;
      } else {
        knownExpiration++;
      }
    }

    return {
      knownExpiration,
      estimatedExpiration,
      requiresDeathTracking,
      inPublicDomain,
      authorsRequiringTracking,
    };
  }

  private calculateCopyrightComplianceScore(
    registration: CopyrightRegistrationStatus,
    renewal: CopyrightRenewalStatus
  ): number {
    // Registration contributes 70% (registration provides statutory damages and attorney fees)
    const registrationScore = registration.registrationRate * 0.7;

    // Renewal compliance contributes 30%
    const renewalTotal = renewal.requiresRenewal || 1;
    const renewalScore = ((renewal.renewed / renewalTotal) * 100) * 0.3;

    return Math.round(registrationScore + renewalScore);
  }

  // ==========================================================================
  // Overall Compliance
  // ==========================================================================

  /**
   * Calculate overall compliance score from all categories.
   */
  private calculateOverallComplianceScore(
    trademark: TrademarkComplianceStatus,
    patent: PatentComplianceStatus,
    domain: DomainComplianceStatus,
    copyright: CopyrightComplianceStatus
  ): OverallComplianceScore {
    const categoryScores = {
      trademark: trademark.complianceScore,
      patent: patent.complianceScore,
      domain: domain.complianceScore,
      copyright: copyright.complianceScore,
    };

    // Weighted average
    const overallScore = Math.round(
      categoryScores.trademark * COMPLIANCE_WEIGHTS.trademark +
      categoryScores.patent * COMPLIANCE_WEIGHTS.patent +
      categoryScores.domain * COMPLIANCE_WEIGHTS.domain +
      categoryScores.copyright * COMPLIANCE_WEIGHTS.copyright
    );

    const riskLevel = this.scoreToRiskLevel(overallScore);

    // Generate risk indicators
    const riskIndicators = this.generateRiskIndicators(trademark, patent, domain, copyright);

    // Generate action items
    const actionItems = this.generateActionItems(trademark, patent, domain, copyright);

    // Calculate trend
    const trend = this.calculateTrend(overallScore, 85); // Placeholder previous score

    // Placeholder trend history
    const trendHistory: ComplianceTrendDataPoint[] = this.generateTrendHistory(overallScore, categoryScores);

    return {
      overallScore,
      categoryScores,
      riskLevel,
      riskIndicators,
      trend,
      trendHistory,
      actionItems,
      calculatedAt: new Date(),
    };
  }

  private generateRiskIndicators(
    trademark: TrademarkComplianceStatus,
    patent: PatentComplianceStatus,
    domain: DomainComplianceStatus,
    copyright: CopyrightComplianceStatus
  ): ComplianceRiskIndicator[] {
    const indicators: ComplianceRiskIndicator[] = [];

    // Trademark risks
    if (trademark.section8.overdue > 0) {
      indicators.push({
        category: 'trademark',
        severity: 'red',
        title: 'Overdue Section 8 Declarations',
        description: `${trademark.section8.overdue} trademark(s) have missed Section 8 deadline`,
        affectedAssetCount: trademark.section8.overdue,
        actionRequired: 'File Section 8 declarations immediately or risk cancellation',
        dueDate: null,
      });
    }

    if (trademark.section8.inGracePeriod > 0) {
      indicators.push({
        category: 'trademark',
        severity: 'yellow',
        title: 'Section 8 Declarations in Grace Period',
        description: `${trademark.section8.inGracePeriod} trademark(s) are in grace period`,
        affectedAssetCount: trademark.section8.inGracePeriod,
        actionRequired: 'File Section 8 declarations before grace period expires (surcharge applies)',
        dueDate: null,
      });
    }

    // Patent risks
    if (patent.summary.totalMissed > 0) {
      indicators.push({
        category: 'patent',
        severity: 'red',
        title: 'Missed Maintenance Fees',
        description: `${patent.summary.totalMissed} patent maintenance fee(s) were missed`,
        affectedAssetCount: patent.summary.totalMissed,
        actionRequired: 'Review patents for potential revival (petition required)',
        dueDate: null,
      });
    }

    if (patent.gracePeriodTracking.inGracePeriod > 0) {
      indicators.push({
        category: 'patent',
        severity: 'yellow',
        title: 'Maintenance Fees in Grace Period',
        description: `${patent.gracePeriodTracking.inGracePeriod} patent(s) have fees in grace period`,
        affectedAssetCount: patent.gracePeriodTracking.inGracePeriod,
        actionRequired: 'Pay maintenance fees with surcharge before grace period expires',
        dueDate: null,
      });
    }

    // Domain risks
    if (domain.expiration.expired > 0) {
      indicators.push({
        category: 'domain',
        severity: 'red',
        title: 'Expired Domains',
        description: `${domain.expiration.expired} domain(s) have expired`,
        affectedAssetCount: domain.expiration.expired,
        actionRequired: 'Renew domains immediately or attempt redemption',
        dueDate: null,
      });
    }

    if (domain.expiration.expiringThisMonth > 0) {
      indicators.push({
        category: 'domain',
        severity: 'yellow',
        title: 'Domains Expiring Soon',
        description: `${domain.expiration.expiringThisMonth} domain(s) expiring within 30 days`,
        affectedAssetCount: domain.expiration.expiringThisMonth,
        actionRequired: 'Renew domains or verify auto-renewal is enabled',
        dueDate: null,
      });
    }

    if (domain.disputes.responsesDue > 0) {
      indicators.push({
        category: 'domain',
        severity: 'red',
        title: 'Domain Dispute Responses Due',
        description: `${domain.disputes.responsesDue} dispute(s) require response`,
        affectedAssetCount: domain.disputes.responsesDue,
        actionRequired: 'File dispute responses before deadline',
        dueDate: null,
      });
    }

    // Copyright risks
    if (copyright.registration.registrationRate < 50) {
      indicators.push({
        category: 'copyright',
        severity: 'yellow',
        title: 'Low Copyright Registration Rate',
        description: `Only ${copyright.registration.registrationRate}% of copyrights are registered`,
        affectedAssetCount: copyright.registration.unregistered,
        actionRequired: 'Register copyrights to enable statutory damages and attorney fees in litigation',
        dueDate: null,
      });
    }

    return indicators.sort((a, b) => {
      const severityOrder = { red: 0, yellow: 1, green: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateActionItems(
    trademark: TrademarkComplianceStatus,
    patent: PatentComplianceStatus,
    domain: DomainComplianceStatus,
    copyright: CopyrightComplianceStatus
  ): ComplianceActionItem[] {
    const items: ComplianceActionItem[] = [];

    // Add trademark action items from deadlines
    for (const deadline of trademark.section8.upcomingDeadlines) {
      items.push({
        id: `tm-s8-${deadline.trademarkId}`,
        category: 'trademark',
        priority: deadline.priority,
        title: `Section 8 Declaration Due: ${deadline.mark}`,
        description: `File Section 8 Declaration of Use for ${deadline.mark}`,
        assetId: deadline.trademarkId,
        assetIdentifier: deadline.registrationNumber || deadline.mark,
        dueDate: deadline.dueDate,
        estimatedCost: deadline.estimatedFee,
        currency: deadline.currency,
      });
    }

    // Add patent action items from upcoming fees
    for (const fee of patent.upcomingFees.slice(0, 10)) {
      items.push({
        id: `pat-mf-${fee.feeId}`,
        category: 'patent',
        priority: this.daysToPriority(fee.daysUntilDue),
        title: `Maintenance Fee Due: ${fee.feeWindow}`,
        description: `Pay ${fee.feeWindow} maintenance fee for ${fee.patentNumber || fee.patentTitle}`,
        assetId: fee.patentId,
        assetIdentifier: fee.patentNumber || fee.patentTitle,
        dueDate: fee.dueDate,
        estimatedCost: fee.estimatedFee,
        currency: fee.currency,
      });
    }

    // Add domain action items from upcoming expirations
    for (const exp of domain.upcomingExpirations.slice(0, 10)) {
      items.push({
        id: `dom-exp-${exp.domainId}`,
        category: 'domain',
        priority: exp.priority,
        title: `Domain Expiring: ${exp.domainName}`,
        description: `Renew ${exp.domainName} before expiration${exp.autoRenew ? ' (auto-renew enabled)' : ''}`,
        assetId: exp.domainId,
        assetIdentifier: exp.domainName,
        dueDate: exp.expirationDate,
        estimatedCost: null, // Varies by registrar
        currency: 'USD',
      });
    }

    return items
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 30);
  }

  private generateTrendHistory(
    currentScore: number,
    categoryScores: { trademark: number; patent: number; domain: number; copyright: number }
  ): ComplianceTrendDataPoint[] {
    const history: ComplianceTrendDataPoint[] = [];
    const now = new Date();

    // Generate 12 months of trend data (simplified/simulated)
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);

      // Simulate slight variations
      const variation = Math.sin(i * 0.5) * 5;

      history.push({
        date,
        score: Math.round(Math.max(0, Math.min(100, currentScore + variation))),
        trademarkScore: Math.round(Math.max(0, Math.min(100, categoryScores.trademark + variation))),
        patentScore: Math.round(Math.max(0, Math.min(100, categoryScores.patent + variation))),
        domainScore: Math.round(Math.max(0, Math.min(100, categoryScores.domain + variation))),
        copyrightScore: Math.round(Math.max(0, Math.min(100, categoryScores.copyright + variation))),
      });
    }

    return history;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private scoreToRiskLevel(score: number): ComplianceRiskLevel {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  }

  private daysToPriority(days: number): 'low' | 'medium' | 'high' | 'critical' {
    if (days <= 7) return 'critical';
    if (days <= 30) return 'high';
    if (days <= 90) return 'medium';
    return 'low';
  }

  private calculateTrend(currentScore: number, previousScore: number): ComplianceTrend {
    const diff = currentScore - previousScore;
    if (diff > 2) return 'improving';
    if (diff < -2) return 'declining';
    return 'stable';
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let complianceDashboardServiceInstance: ComplianceDashboardService | null = null;

/**
 * Get singleton instance of ComplianceDashboardService.
 */
export function getComplianceDashboardService(db: Database): ComplianceDashboardService {
  if (!complianceDashboardServiceInstance) {
    complianceDashboardServiceInstance = new ComplianceDashboardService(db);
  }
  return complianceDashboardServiceInstance;
}

/**
 * Create a new instance of ComplianceDashboardService.
 */
export const createComplianceDashboardService = (
  db: Database,
  trademarkService?: TrademarkComplianceService,
  copyrightService?: CopyrightDurationService
): ComplianceDashboardService => {
  return new ComplianceDashboardService(db, trademarkService, copyrightService);
};
