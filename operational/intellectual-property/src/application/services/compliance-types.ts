/**
 * Compliance Dashboard Types
 *
 * Type definitions for IP compliance tracking across all asset types.
 *
 * @module application/services
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Compliance risk level indicator.
 */
export type ComplianceRiskLevel = 'green' | 'yellow' | 'red';

/**
 * Compliance status for a single obligation.
 */
export type ComplianceObligationStatus = 'compliant' | 'due' | 'overdue';

/**
 * Trend direction for compliance metrics.
 */
export type ComplianceTrend = 'improving' | 'stable' | 'declining';

// ============================================================================
// Trademark Compliance Types
// ============================================================================

/**
 * Section 8 Declaration of Use compliance status.
 */
export interface Section8ComplianceStatus {
  /** Total number of trademarks subject to Section 8 */
  total: number;
  /** Trademarks with Section 8 filed and accepted */
  compliant: number;
  /** Trademarks approaching Section 8 due date (within 6 months) */
  dueSoon: number;
  /** Trademarks in grace period */
  inGracePeriod: number;
  /** Trademarks with missed Section 8 deadline */
  overdue: number;
  /** Upcoming deadlines */
  upcomingDeadlines: TrademarkComplianceDeadline[];
}

/**
 * Section 9 Renewal compliance status.
 */
export interface Section9ComplianceStatus {
  /** Total number of trademarks subject to Section 9 renewal */
  total: number;
  /** Trademarks with current renewal */
  compliant: number;
  /** Trademarks approaching renewal window (within 6 months) */
  dueSoon: number;
  /** Trademarks in grace period */
  inGracePeriod: number;
  /** Trademarks with missed renewal deadline */
  overdue: number;
  /** Upcoming deadlines */
  upcomingDeadlines: TrademarkComplianceDeadline[];
}

/**
 * Section 15 Incontestability compliance status.
 */
export interface Section15ComplianceStatus {
  /** Total number of eligible trademarks */
  eligible: number;
  /** Trademarks with Section 15 filed and accepted */
  filed: number;
  /** Trademarks eligible but not yet filed */
  pendingFiling: number;
  /** Trademarks not yet eligible (less than 5 years) */
  notYetEligible: number;
  /** Trademarks approaching eligibility (within 6 months) */
  approachingEligibility: number;
}

/**
 * Madrid Protocol compliance status by designation.
 */
export interface MadridProtocolStatus {
  /** Total active Madrid registrations */
  totalRegistrations: number;
  /** Countries with active protection */
  activeDesignations: number;
  /** Pending designations awaiting decision */
  pendingDesignations: number;
  /** Designations with office action responses due */
  responsesDue: number;
  /** Upcoming renewal count */
  renewalsDue: number;
  /** Registrations in central attack period */
  inCentralAttackPeriod: number;
  /** Status by country */
  byCountry: MadridCountryStatus[];
}

/**
 * Madrid Protocol status for a specific country.
 */
export interface MadridCountryStatus {
  countryCode: string;
  countryName: string;
  protected: number;
  pending: number;
  refused: number;
  hasResponseDue: boolean;
}

/**
 * Trademark compliance deadline detail.
 */
export interface TrademarkComplianceDeadline {
  trademarkId: string;
  mark: string;
  registrationNumber: string | null;
  deadlineType: 'section_8' | 'section_9' | 'section_15' | 'madrid_renewal' | 'madrid_response';
  dueDate: Date;
  gracePeriodEnds: Date | null;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedFee: number;
  currency: string;
}

/**
 * Overall trademark compliance status.
 */
export interface TrademarkComplianceStatus {
  section8: Section8ComplianceStatus;
  section9: Section9ComplianceStatus;
  section15: Section15ComplianceStatus;
  madridProtocol: MadridProtocolStatus;
  /** Weighted compliance score (0-100) */
  complianceScore: number;
  /** Risk level based on score and overdue items */
  riskLevel: ComplianceRiskLevel;
  /** Total registered trademarks */
  totalRegistered: number;
  /** Trend compared to previous period */
  trend: ComplianceTrend;
}

// ============================================================================
// Patent Compliance Types
// ============================================================================

/**
 * Maintenance fee window status.
 */
export interface MaintenanceFeeWindowStatus {
  window: '3.5yr' | '7.5yr' | '11.5yr';
  /** Patents with fee paid for this window */
  paid: number;
  /** Patents with fee coming due (window open) */
  payable: number;
  /** Patents in grace period */
  inGracePeriod: number;
  /** Patents with missed fee (lapsed) */
  missed: number;
  /** Patents not yet reached this window */
  upcoming: number;
  /** Total patents subject to this window */
  total: number;
}

/**
 * Upcoming maintenance fee detail.
 */
export interface UpcomingMaintenanceFee {
  feeId: string;
  patentId: string;
  patentNumber: string | null;
  patentTitle: string;
  feeWindow: '3.5yr' | '7.5yr' | '11.5yr';
  dueDate: Date;
  windowOpens: Date;
  gracePeriodEnds: Date;
  daysUntilDue: number;
  isInGracePeriod: boolean;
  estimatedFee: number;
  currency: string;
  status: 'upcoming' | 'payable' | 'grace_period';
}

/**
 * Overall patent compliance status.
 */
export interface PatentComplianceStatus {
  /** Status by maintenance fee window */
  byWindow: {
    '3.5yr': MaintenanceFeeWindowStatus;
    '7.5yr': MaintenanceFeeWindowStatus;
    '11.5yr': MaintenanceFeeWindowStatus;
  };
  /** Overall counts */
  summary: {
    /** Total active patents subject to maintenance fees */
    totalActive: number;
    /** Total fees paid across all windows */
    totalPaid: number;
    /** Total fees currently payable */
    totalPayable: number;
    /** Total fees in grace period */
    totalInGracePeriod: number;
    /** Total fees missed (patents may have lapsed) */
    totalMissed: number;
    /** Total fees upcoming (not yet in payment window) */
    totalUpcoming: number;
  };
  /** Upcoming fees requiring attention */
  upcomingFees: UpcomingMaintenanceFee[];
  /** Grace period tracking */
  gracePeriodTracking: {
    inGracePeriod: number;
    gracePeriodEndingSoon: number; // Within 30 days
    surchargeAmount: number;
  };
  /** Weighted compliance score (0-100) */
  complianceScore: number;
  /** Risk level based on score and overdue items */
  riskLevel: ComplianceRiskLevel;
  /** Trend compared to previous period */
  trend: ComplianceTrend;
}

// ============================================================================
// Domain Compliance Types
// ============================================================================

/**
 * Domain expiration status breakdown.
 */
export interface DomainExpirationStatus {
  /** Domains with expiration > 90 days away */
  current: number;
  /** Domains expiring within 30 days */
  expiringThisMonth: number;
  /** Domains expiring within 90 days */
  expiringThisQuarter: number;
  /** Domains already expired */
  expired: number;
  /** Domains in redemption period */
  inRedemption: number;
}

/**
 * UDRP/URS dispute status.
 */
export interface DomainDisputeStatus {
  /** Active disputes pending resolution */
  activeDisputes: number;
  /** Disputes with response due */
  responsesDue: number;
  /** Disputes won (transferred to us) */
  won: number;
  /** Disputes lost */
  lost: number;
  /** Disputes settled */
  settled: number;
  /** Total disputes historically */
  totalHistorical: number;
}

/**
 * Registrar distribution for domains.
 */
export interface RegistrarDistribution {
  registrar: string;
  count: number;
  percentage: number;
}

/**
 * Auto-renewal status summary.
 */
export interface AutoRenewalStatus {
  /** Domains with auto-renewal enabled */
  enabled: number;
  /** Domains with auto-renewal disabled */
  disabled: number;
  /** Percentage with auto-renewal enabled */
  enabledPercentage: number;
}

/**
 * Upcoming domain expiration detail.
 */
export interface UpcomingDomainExpiration {
  domainId: string;
  domainName: string;
  tld: string;
  expirationDate: Date;
  daysUntilExpiration: number;
  autoRenew: boolean;
  registrar: string;
  linkedTrademarkId: string | null;
  isDefensive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Overall domain compliance status.
 */
export interface DomainComplianceStatus {
  expiration: DomainExpirationStatus;
  disputes: DomainDisputeStatus;
  registrarDistribution: RegistrarDistribution[];
  autoRenewal: AutoRenewalStatus;
  /** Upcoming expirations requiring attention */
  upcomingExpirations: UpcomingDomainExpiration[];
  /** Summary stats */
  summary: {
    totalDomains: number;
    activeDomains: number;
    defensiveRegistrations: number;
    linkedToTrademarks: number;
  };
  /** Weighted compliance score (0-100) */
  complianceScore: number;
  /** Risk level based on score and expiring domains */
  riskLevel: ComplianceRiskLevel;
  /** Trend compared to previous period */
  trend: ComplianceTrend;
}

// ============================================================================
// Copyright Compliance Types
// ============================================================================

/**
 * Copyright registration status.
 */
export interface CopyrightRegistrationStatus {
  /** Copyrights with formal registration */
  registered: number;
  /** Copyrights pending registration */
  pending: number;
  /** Copyrights not registered (relying on automatic protection) */
  unregistered: number;
  /** Percentage registered */
  registrationRate: number;
}

/**
 * Copyright renewal requirements (pre-1978 works).
 */
export interface CopyrightRenewalStatus {
  /** Works requiring renewal (pre-1978) */
  requiresRenewal: number;
  /** Works with renewal filed */
  renewed: number;
  /** Works approaching renewal deadline */
  renewalDue: number;
  /** Works with missed renewal (may be in public domain) */
  missed: number;
}

/**
 * Copyright duration tracking.
 */
export interface CopyrightDurationTracking {
  /** Copyrights with known expiration date */
  knownExpiration: number;
  /** Copyrights with estimated expiration (author death tracking required) */
  estimatedExpiration: number;
  /** Copyrights requiring author death tracking for accurate expiration */
  requiresDeathTracking: number;
  /** Copyrights in public domain */
  inPublicDomain: number;
  /** Authors requiring death tracking */
  authorsRequiringTracking: number;
}

/**
 * Overall copyright compliance status.
 */
export interface CopyrightComplianceStatus {
  registration: CopyrightRegistrationStatus;
  renewal: CopyrightRenewalStatus;
  duration: CopyrightDurationTracking;
  /** Summary stats */
  summary: {
    totalCopyrights: number;
    activeProtection: number;
    workForHire: number;
    individualAuthored: number;
    jointAuthored: number;
  };
  /** Weighted compliance score (0-100) */
  complianceScore: number;
  /** Risk level */
  riskLevel: ComplianceRiskLevel;
  /** Trend compared to previous period */
  trend: ComplianceTrend;
}

// ============================================================================
// Overall Compliance Types
// ============================================================================

/**
 * Historical compliance data point for trend tracking.
 */
export interface ComplianceTrendDataPoint {
  date: Date;
  score: number;
  trademarkScore: number;
  patentScore: number;
  domainScore: number;
  copyrightScore: number;
}

/**
 * Overall IP portfolio compliance score.
 */
export interface OverallComplianceScore {
  /** Weighted overall score (0-100) */
  overallScore: number;
  /** Individual category scores */
  categoryScores: {
    trademark: number;
    patent: number;
    domain: number;
    copyright: number;
  };
  /** Risk level based on overall score */
  riskLevel: ComplianceRiskLevel;
  /** Risk indicators */
  riskIndicators: ComplianceRiskIndicator[];
  /** Trend over time */
  trend: ComplianceTrend;
  /** Historical trend data (last 12 months) */
  trendHistory: ComplianceTrendDataPoint[];
  /** Action items requiring immediate attention */
  actionItems: ComplianceActionItem[];
  /** Last calculated timestamp */
  calculatedAt: Date;
}

/**
 * Risk indicator for compliance issues.
 */
export interface ComplianceRiskIndicator {
  category: 'trademark' | 'patent' | 'domain' | 'copyright';
  severity: ComplianceRiskLevel;
  title: string;
  description: string;
  affectedAssetCount: number;
  actionRequired: string;
  dueDate: Date | null;
}

/**
 * Action item for compliance remediation.
 */
export interface ComplianceActionItem {
  id: string;
  category: 'trademark' | 'patent' | 'domain' | 'copyright';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  assetId: string;
  assetIdentifier: string; // Patent number, trademark number, domain name, etc.
  dueDate: Date;
  estimatedCost: number | null;
  currency: string;
}

/**
 * Complete compliance dashboard data.
 */
export interface ComplianceDashboardData {
  trademark: TrademarkComplianceStatus;
  patent: PatentComplianceStatus;
  domain: DomainComplianceStatus;
  copyright: CopyrightComplianceStatus;
  overall: OverallComplianceScore;
}
