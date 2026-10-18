/**
 * Privacy Program Metrics Domain Model
 * Program-level compliance metrics and KPIs
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ComplianceLevel = 'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'NOT_ASSESSED';

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface DSARMetrics {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  overdueRequests: number;
  averageCompletionDays: number;
  complianceRate: number; // Completed on time / Total completed
  byType: Record<string, number>;
}

export interface ConsentMetrics {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  expiredConsents: number;
  consentRate: number; // Active / Total
  byPurpose: Record<string, number>;
  withdrawalRate: number;
}

export interface BreachMetrics {
  totalBreaches: number;
  openBreaches: number;
  resolvedBreaches: number;
  notifiedOnTime: number;
  notifiedLate: number;
  averageResolutionDays: number;
  bySeverity: Record<string, number>;
  notificationComplianceRate: number;
}

export interface DPIAMetrics {
  totalAssessments: number;
  pendingAssessments: number;
  approvedAssessments: number;
  rejectedAssessments: number;
  requiresConsultation: number;
  averageCompletionDays: number;
}

export interface ProcessorMetrics {
  totalProcessors: number;
  activeProcessors: number;
  euProcessors: number;
  nonEuProcessors: number;
  dpaExpiringSoon: number;
  auditOverdue: number;
  complianceRate: number;
}

export interface TransferMetrics {
  totalTransfers: number;
  approvedTransfers: number;
  adequacyBased: number;
  sccBased: number;
  highRiskTransfers: number;
  missingTIA: number;
  destinationCountries: number;
}

export interface ActivityMetrics {
  totalActivities: number;
  activeActivities: number;
  withSpecialCategories: number;
  dpiaRequired: number;
  reviewDue: number;
}

export interface PrivacyProgramMetrics {
  entityId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };

  // Overall compliance
  overallComplianceLevel: ComplianceLevel;
  complianceScore: number; // 0-100
  trend: TrendDirection;

  // Module metrics
  dsar: DSARMetrics;
  consent: ConsentMetrics;
  breach: BreachMetrics;
  dpia: DPIAMetrics;
  processors: ProcessorMetrics;
  transfers: TransferMetrics;
  activities: ActivityMetrics;

  // Risk summary
  riskSummary: {
    criticalItems: number;
    highRiskItems: number;
    mediumRiskItems: number;
    lowRiskItems: number;
  };

  // Action items
  actionItems: ActionItem[];
}

export interface ActionItem {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  dueDate?: Date | undefined;
  count: number;
}

// ============================================================================
// COMPLIANCE DASHBOARD
// ============================================================================

export interface ComplianceDashboard {
  entityId: string;
  generatedAt: Date;

  // Key Performance Indicators
  kpis: {
    dsarResponseRate: number;      // % completed on time
    consentCompliance: number;      // % with valid consent
    breachNotificationRate: number; // % notified within 72h
    processorCompliance: number;    // % with valid DPA
    transferCompliance: number;     // % with proper basis
  };

  // Current status counts
  currentStatus: {
    pendingDSARs: number;
    overdueDSARs: number;
    openBreaches: number;
    pendingDPIAs: number;
    expiringDPAs: number;
    reviewDueActivities: number;
  };

  // Trend data (last 6 months)
  trends: {
    month: string;
    dsarCompleted: number;
    consentsGranted: number;
    consentsWithdrawn: number;
    breachesReported: number;
  }[];

  // Alerts
  alerts: {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    count: number;
  }[];
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

/**
 * Calculate overall compliance score from metrics
 */
export function calculateComplianceScore(metrics: PrivacyProgramMetrics): number {
  let score = 0;
  let weight = 0;

  // DSAR compliance (weight: 25)
  if (metrics.dsar.totalRequests > 0) {
    score += metrics.dsar.complianceRate * 25;
    weight += 25;
  }

  // Consent compliance (weight: 20)
  if (metrics.consent.totalConsents > 0) {
    const consentScore = metrics.consent.consentRate * 100;
    score += (consentScore / 100) * 20;
    weight += 20;
  }

  // Breach notification compliance (weight: 25)
  if (metrics.breach.totalBreaches > 0) {
    score += metrics.breach.notificationComplianceRate * 25;
    weight += 25;
  }

  // Processor compliance (weight: 15)
  if (metrics.processors.totalProcessors > 0) {
    score += metrics.processors.complianceRate * 15;
    weight += 15;
  }

  // Activity compliance (weight: 15)
  if (metrics.activities.totalActivities > 0) {
    const activityScore = ((metrics.activities.totalActivities - metrics.activities.reviewDue) / metrics.activities.totalActivities) * 100;
    score += (activityScore / 100) * 15;
    weight += 15;
  }

  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

/**
 * Determine compliance level from score
 */
export function getComplianceLevel(score: number): ComplianceLevel {
  if (score >= 90) return 'COMPLIANT';
  if (score >= 70) return 'PARTIALLY_COMPLIANT';
  if (score > 0) return 'NON_COMPLIANT';
  return 'NOT_ASSESSED';
}

/**
 * Generate action items from metrics
 */
export function generateActionItems(metrics: PrivacyProgramMetrics): ActionItem[] {
  const items: ActionItem[] = [];

  // Critical: Overdue DSARs
  if (metrics.dsar.overdueRequests > 0) {
    items.push({
      priority: 'CRITICAL',
      category: 'DSAR',
      description: 'Overdue DSAR requests require immediate attention',
      count: metrics.dsar.overdueRequests,
    });
  }

  // Critical: Open breaches
  if (metrics.breach.openBreaches > 0) {
    items.push({
      priority: 'CRITICAL',
      category: 'Breach',
      description: 'Open data breaches require resolution',
      count: metrics.breach.openBreaches,
    });
  }

  // High: Expiring DPAs
  if (metrics.processors.dpaExpiringSoon > 0) {
    items.push({
      priority: 'HIGH',
      category: 'Vendor',
      description: 'DPAs expiring within 90 days',
      count: metrics.processors.dpaExpiringSoon,
    });
  }

  // High: Missing TIAs
  if (metrics.transfers.missingTIA > 0) {
    items.push({
      priority: 'HIGH',
      category: 'Transfer',
      description: 'Transfers require Transfer Impact Assessment',
      count: metrics.transfers.missingTIA,
    });
  }

  // High: Required DPIAs
  if (metrics.activities.dpiaRequired > 0) {
    items.push({
      priority: 'HIGH',
      category: 'DPIA',
      description: 'Processing activities require DPIA',
      count: metrics.activities.dpiaRequired,
    });
  }

  // Medium: Review due activities
  if (metrics.activities.reviewDue > 0) {
    items.push({
      priority: 'MEDIUM',
      category: 'Activity',
      description: 'Processing activities due for annual review',
      count: metrics.activities.reviewDue,
    });
  }

  // Medium: Audit overdue processors
  if (metrics.processors.auditOverdue > 0) {
    items.push({
      priority: 'MEDIUM',
      category: 'Vendor',
      description: 'Processor audits overdue',
      count: metrics.processors.auditOverdue,
    });
  }

  // Sort by priority
  const priorityOrder: Record<ActionItem['priority'], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  items.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));

  return items;
}

/**
 * Calculate risk summary from metrics
 */
export function calculateRiskSummary(metrics: PrivacyProgramMetrics): PrivacyProgramMetrics['riskSummary'] {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  // Critical items
  critical += metrics.dsar.overdueRequests;
  critical += metrics.breach.openBreaches;
  critical += metrics.breach.notifiedLate;

  // High items
  high += metrics.processors.dpaExpiringSoon;
  high += metrics.transfers.missingTIA;
  high += metrics.activities.dpiaRequired;

  // Medium items
  medium += metrics.activities.reviewDue;
  medium += metrics.processors.auditOverdue;
  medium += metrics.dpia.pendingAssessments;

  // Low items (everything else pending)
  low += metrics.dsar.pendingRequests - metrics.dsar.overdueRequests;
  low += metrics.transfers.highRiskTransfers;

  return {
    criticalItems: Math.max(0, critical),
    highRiskItems: Math.max(0, high),
    mediumRiskItems: Math.max(0, medium),
    lowRiskItems: Math.max(0, low),
  };
}

/**
 * Generate dashboard alerts
 */
export function generateAlerts(metrics: PrivacyProgramMetrics): ComplianceDashboard['alerts'] {
  const alerts: ComplianceDashboard['alerts'] = [];

  if (metrics.dsar.overdueRequests > 0) {
    alerts.push({
      severity: 'CRITICAL',
      message: `${metrics.dsar.overdueRequests} DSAR(s) past deadline - regulatory risk`,
      count: metrics.dsar.overdueRequests,
    });
  }

  if (metrics.breach.openBreaches > 0) {
    alerts.push({
      severity: 'CRITICAL',
      message: `${metrics.breach.openBreaches} open breach(es) require attention`,
      count: metrics.breach.openBreaches,
    });
  }

  if (metrics.processors.dpaExpiringSoon > 0) {
    alerts.push({
      severity: 'WARNING',
      message: `${metrics.processors.dpaExpiringSoon} DPA(s) expiring within 90 days`,
      count: metrics.processors.dpaExpiringSoon,
    });
  }

  if (metrics.activities.reviewDue > 0) {
    alerts.push({
      severity: 'INFO',
      message: `${metrics.activities.reviewDue} activity review(s) due`,
      count: metrics.activities.reviewDue,
    });
  }

  return alerts;
}
