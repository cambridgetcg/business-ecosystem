/**
 * Compliance Metrics
 *
 * Utility functions for calculating compliance metrics, scores, and trends.
 *
 * @module application/services/compliance-metrics
 */

// =============================================================================
// Types
// =============================================================================

export interface ObligationMetrics {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  escalated: number;
  upcomingDeadlines: number;
  criticalOverdue: number;
}

export interface FindingMetrics {
  total: number;
  open: number;
  inRemediation: number;
  pendingVerification: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ControlMetrics {
  total: number;
  operatingEffectively: number;
  deficient: number;
  notImplemented: number;
  needsTesting: number;
  materialWeaknesses: number;
  significantDeficiencies: number;
  effectivenessRate: number;
}

export interface ComplianceScore {
  overall: number;
  byDimension: {
    obligations: number;
    findings: number;
    controls: number;
    timeliness: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
}

export interface RiskExposure {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
}

export interface RiskFactor {
  category: string;
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  description: string;
  weight: number;
}

export interface TrendDataPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  complianceRate: number;
  obligationsTotal: number;
  obligationsCompleted: number;
  obligationsOverdue: number;
  findingsOpen: number;
  score: number;
}

// =============================================================================
// Compliance Rate Calculation
// =============================================================================

/**
 * Calculate compliance rate as a percentage
 */
export function calculateComplianceRate(completed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100 * 10) / 10;
}

/**
 * Calculate weighted compliance rate considering priority
 */
export function calculateWeightedComplianceRate(
  obligations: Array<{ status: string; priority: string }>
): number {
  if (obligations.length === 0) return 100;

  const weights: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let totalWeight = 0;
  let completedWeight = 0;

  for (const obligation of obligations) {
    const weight = weights[obligation.priority] || 1;
    totalWeight += weight;
    if (obligation.status === 'completed') {
      completedWeight += weight;
    }
  }

  if (totalWeight === 0) return 100;
  return Math.round((completedWeight / totalWeight) * 100 * 10) / 10;
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate overall compliance score (0-100)
 */
export function calculateComplianceScore(
  obligationMetrics: ObligationMetrics,
  findingMetrics: FindingMetrics,
  controlMetrics: ControlMetrics
): ComplianceScore {
  // Dimension scores
  const obligationsScore = calculateComplianceRate(
    obligationMetrics.completed,
    obligationMetrics.total
  );

  // Findings score: penalize for open findings by severity
  let findingsScore = 100;
  findingsScore -= findingMetrics.critical * 15;
  findingsScore -= findingMetrics.high * 8;
  findingsScore -= findingMetrics.medium * 3;
  findingsScore -= findingMetrics.low * 1;
  findingsScore = Math.max(0, findingsScore);

  // Controls score
  const controlsScore = controlMetrics.effectivenessRate;

  // Timeliness score: penalize for overdue
  let timelinessScore = 100;
  timelinessScore -= obligationMetrics.criticalOverdue * 20;
  timelinessScore -= (obligationMetrics.overdue - obligationMetrics.criticalOverdue) * 5;
  timelinessScore = Math.max(0, timelinessScore);

  // Overall score (weighted average)
  const weights = {
    obligations: 0.35,
    findings: 0.25,
    controls: 0.25,
    timeliness: 0.15,
  };

  const overall = Math.round(
    obligationsScore * weights.obligations +
    findingsScore * weights.findings +
    controlsScore * weights.controls +
    timelinessScore * weights.timeliness
  );

  // Grade calculation
  const grade = getGradeFromScore(overall);

  // Trend (simplified - would need historical data)
  const trend = determineTrend(obligationMetrics, findingMetrics);

  return {
    overall,
    byDimension: {
      obligations: Math.round(obligationsScore),
      findings: Math.round(findingsScore),
      controls: Math.round(controlsScore),
      timeliness: Math.round(timelinessScore),
    },
    grade,
    trend,
  };
}

/**
 * Convert score to letter grade
 */
export function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Determine trend based on current metrics
 */
function determineTrend(
  obligations: ObligationMetrics,
  findings: FindingMetrics
): 'improving' | 'stable' | 'declining' {
  // Simplified heuristic
  if (obligations.overdue > 5 || findings.critical > 2) return 'declining';
  if (obligations.overdue > 0 || findings.high > 5) return 'stable';
  return 'improving';
}

// =============================================================================
// Risk Exposure Calculation
// =============================================================================

/**
 * Calculate risk exposure
 */
export function calculateRiskExposure(
  obligationMetrics: ObligationMetrics,
  findingMetrics: FindingMetrics,
  controlMetrics: ControlMetrics
): RiskExposure {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Overdue obligations
  if (obligationMetrics.overdue > 0) {
    const weight = obligationMetrics.criticalOverdue > 0 ? 25 : 15;
    factors.push({
      category: 'Compliance',
      factor: 'Overdue Obligations',
      severity: obligationMetrics.criticalOverdue > 0 ? 'critical' : 'high',
      count: obligationMetrics.overdue,
      description: `${obligationMetrics.overdue} obligation(s) past due date`,
      weight,
    });
    totalScore += weight * Math.min(obligationMetrics.overdue, 5);
  }

  // Critical findings
  if (findingMetrics.critical > 0) {
    factors.push({
      category: 'Audit',
      factor: 'Critical Findings',
      severity: 'critical',
      count: findingMetrics.critical,
      description: `${findingMetrics.critical} critical audit finding(s) open`,
      weight: 30,
    });
    totalScore += 30 * findingMetrics.critical;
  }

  // High findings
  if (findingMetrics.high > 0) {
    factors.push({
      category: 'Audit',
      factor: 'High-Severity Findings',
      severity: 'high',
      count: findingMetrics.high,
      description: `${findingMetrics.high} high-severity finding(s) open`,
      weight: 15,
    });
    totalScore += 15 * Math.min(findingMetrics.high, 5);
  }

  // Material weaknesses
  if (controlMetrics.materialWeaknesses > 0) {
    factors.push({
      category: 'Controls',
      factor: 'Material Weaknesses',
      severity: 'critical',
      count: controlMetrics.materialWeaknesses,
      description: `${controlMetrics.materialWeaknesses} control(s) with material weaknesses`,
      weight: 35,
    });
    totalScore += 35 * controlMetrics.materialWeaknesses;
  }

  // Deficient controls
  if (controlMetrics.deficient > 0) {
    factors.push({
      category: 'Controls',
      factor: 'Deficient Controls',
      severity: 'high',
      count: controlMetrics.deficient,
      description: `${controlMetrics.deficient} control(s) operating deficiently`,
      weight: 15,
    });
    totalScore += 15 * Math.min(controlMetrics.deficient, 5);
  }

  // Controls needing testing
  if (controlMetrics.needsTesting > 0) {
    factors.push({
      category: 'Controls',
      factor: 'Overdue Testing',
      severity: 'medium',
      count: controlMetrics.needsTesting,
      description: `${controlMetrics.needsTesting} control(s) with overdue testing`,
      weight: 5,
    });
    totalScore += 5 * Math.min(controlMetrics.needsTesting, 10);
  }

  // Escalated obligations
  if (obligationMetrics.escalated > 0) {
    factors.push({
      category: 'Compliance',
      factor: 'Escalated Obligations',
      severity: 'medium',
      count: obligationMetrics.escalated,
      description: `${obligationMetrics.escalated} obligation(s) escalated`,
      weight: 8,
    });
    totalScore += 8 * Math.min(obligationMetrics.escalated, 5);
  }

  // Determine overall risk level
  const level = determineRiskLevel(totalScore, factors);

  return {
    level,
    score: Math.min(totalScore, 100),
    factors,
  };
}

/**
 * Determine risk level from score and factors
 */
function determineRiskLevel(
  score: number,
  factors: RiskFactor[]
): 'low' | 'medium' | 'high' | 'critical' {
  const hasCritical = factors.some(f => f.severity === 'critical');
  const hasMultipleHigh = factors.filter(f => f.severity === 'high').length >= 2;

  if (hasCritical || score >= 80) return 'critical';
  if (hasMultipleHigh || score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// =============================================================================
// Trend Analysis
// =============================================================================

/**
 * Calculate trend data for a time period
 */
export function calculateTrendData(
  obligations: Array<{
    status: string;
    dueDate: Date;
    completedDate?: Date | null;
  }>,
  findings: Array<{
    status: string;
    createdAt: Date;
    severity: string;
  }>,
  periodMonths: number = 6
): TrendDataPoint[] {
  const trends: TrendDataPoint[] = [];
  const now = new Date();

  for (let i = periodMonths - 1; i >= 0; i--) {
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const periodLabel = periodStart.toLocaleString('default', { month: 'short', year: '2-digit' });

    // Filter obligations due in this period
    const periodObligations = obligations.filter(o => {
      const dueDate = new Date(o.dueDate);
      return dueDate >= periodStart && dueDate <= periodEnd;
    });

    const completed = periodObligations.filter(o => o.status === 'completed').length;
    const total = periodObligations.length;
    const overdue = periodObligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status)
    ).length;

    // Filter findings created in this period that are still open
    const periodFindings = findings.filter(f => {
      const createdAt = new Date(f.createdAt);
      return createdAt <= periodEnd && f.status !== 'closed';
    });

    const complianceRate = calculateComplianceRate(completed, total);
    const score = Math.max(0, complianceRate - (overdue * 5) - (periodFindings.length * 2));

    trends.push({
      period: periodLabel,
      periodStart,
      periodEnd,
      complianceRate,
      obligationsTotal: total,
      obligationsCompleted: completed,
      obligationsOverdue: overdue,
      findingsOpen: periodFindings.length,
      score: Math.round(score),
    });
  }

  return trends;
}

/**
 * Analyze trend direction
 */
export function analyzeTrendDirection(
  trends: TrendDataPoint[]
): { direction: 'improving' | 'stable' | 'declining'; changePercent: number } {
  if (trends.length < 2) {
    return { direction: 'stable', changePercent: 0 };
  }

  const recent = trends.slice(-3);
  const older = trends.slice(0, -3);

  if (recent.length === 0 || older.length === 0) {
    return { direction: 'stable', changePercent: 0 };
  }

  const recentAvg = recent.reduce((sum, t) => sum + t.complianceRate, 0) / recent.length;
  const olderAvg = older.reduce((sum, t) => sum + t.complianceRate, 0) / older.length;

  const changePercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);

  if (changePercent > 5) return { direction: 'improving', changePercent };
  if (changePercent < -5) return { direction: 'declining', changePercent };
  return { direction: 'stable', changePercent };
}

// =============================================================================
// Deadline Analysis
// =============================================================================

/**
 * Categorize upcoming deadlines by urgency
 */
export function categorizeDeadlines(
  obligations: Array<{ dueDate: Date; status: string; priority: string; title: string }>
): {
  critical: typeof obligations;
  thisWeek: typeof obligations;
  thisMonth: typeof obligations;
  upcoming: typeof obligations;
} {
  const now = new Date();
  const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const activeObligations = obligations.filter(
    o => !['completed', 'waived', 'not_applicable'].includes(o.status)
  );

  return {
    critical: activeObligations.filter(
      o => o.priority === 'critical' && new Date(o.dueDate) <= oneWeek
    ),
    thisWeek: activeObligations.filter(
      o => new Date(o.dueDate) > now && new Date(o.dueDate) <= oneWeek
    ),
    thisMonth: activeObligations.filter(
      o => new Date(o.dueDate) > oneWeek && new Date(o.dueDate) <= oneMonth
    ),
    upcoming: activeObligations.filter(
      o => new Date(o.dueDate) > oneMonth
    ),
  };
}

/**
 * Get deadline distribution by day
 */
export function getDeadlineDistribution(
  obligations: Array<{ dueDate: Date; status: string }>,
  daysAhead: number = 30
): Record<string, number> {
  const distribution: Record<string, number> = {};
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const activeObligations = obligations.filter(
    o => !['completed', 'waived', 'not_applicable'].includes(o.status)
  );

  for (const obligation of activeObligations) {
    const dueDate = new Date(obligation.dueDate);
    if (dueDate >= now && dueDate <= cutoff) {
      const dateKey = dueDate.toISOString().split('T')[0];
      distribution[dateKey] = (distribution[dateKey] || 0) + 1;
    }
  }

  return distribution;
}

// =============================================================================
// Aggregation Helpers
// =============================================================================

/**
 * Aggregate metrics by dimension (regulator, category, entity)
 */
export function aggregateByDimension<T extends Record<string, unknown>>(
  items: T[],
  dimension: keyof T,
  statusField: keyof T = 'status' as keyof T
): Record<string, { total: number; completed: number; pending: number; overdue: number }> {
  const aggregated: Record<string, { total: number; completed: number; pending: number; overdue: number }> = {};

  for (const item of items) {
    const key = String(item[dimension] || 'unknown');
    if (!aggregated[key]) {
      aggregated[key] = { total: 0, completed: 0, pending: 0, overdue: 0 };
    }

    aggregated[key].total++;

    const status = item[statusField] as string;
    if (status === 'completed') {
      aggregated[key].completed++;
    } else if (status === 'pending' || status === 'in_progress') {
      aggregated[key].pending++;
    } else if (status === 'overdue') {
      aggregated[key].overdue++;
    }
  }

  return aggregated;
}
