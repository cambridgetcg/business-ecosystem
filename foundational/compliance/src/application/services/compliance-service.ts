import type {
  RegulatoryRequirement,
  ComplianceObligation,
  ObligationStatus,
  BOIFiling,
  AuditFinding,
  FindingSeverity,
} from '../../domain/entities/index.js';

/**
 * Compliance Service
 *
 * Core business logic for compliance management including:
 * - Regulatory requirement tracking
 * - Compliance obligation management
 * - BOI (Corporate Transparency Act) filing
 * - Audit finding remediation
 */
export class ComplianceService {
  // In-memory stores for reference implementation
  private requirements: Map<string, RegulatoryRequirement> = new Map();
  private obligations: Map<string, ComplianceObligation> = new Map();
  private boiFilings: Map<string, BOIFiling> = new Map();
  private findings: Map<string, AuditFinding> = new Map();

  /**
   * Get all obligations for an entity
   */
  async getEntityObligations(
    entityId: string,
    status?: ObligationStatus[]
  ): Promise<ComplianceObligation[]> {
    let obligations = Array.from(this.obligations.values())
      .filter(o => o.entityId === entityId);

    if (status && status.length > 0) {
      obligations = obligations.filter(o => status.includes(o.status));
    }

    return obligations.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get upcoming compliance deadlines
   */
  async getUpcomingDeadlines(
    entityId: string,
    daysAhead: number = 30
  ): Promise<ComplianceObligation[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return Array.from(this.obligations.values())
      .filter(o => o.entityId === entityId)
      .filter(o => o.status === 'pending' || o.status === 'in_progress')
      .filter(o => o.dueDate <= cutoffDate)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get overdue obligations
   */
  async getOverdueObligations(entityId: string): Promise<ComplianceObligation[]> {
    const today = new Date();

    return Array.from(this.obligations.values())
      .filter(o => o.entityId === entityId)
      .filter(o => o.status !== 'completed' && o.status !== 'waived' && o.status !== 'not_applicable')
      .filter(o => o.dueDate < today);
  }

  /**
   * Check BOI filing status for an entity
   */
  async getBOIFilingStatus(entityId: string): Promise<{
    hasActiveFiling: boolean;
    isCompliant: boolean;
    nextUpdateDue?: Date;
    filing?: BOIFiling;
  }> {
    const filing = Array.from(this.boiFilings.values())
      .filter(f => f.entityId === entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!filing) {
      return { hasActiveFiling: false, isCompliant: false };
    }

    const isCompliant = filing.status === 'accepted' || filing.isExempt;

    return {
      hasActiveFiling: true,
      isCompliant,
      nextUpdateDue: filing.updateDueDate,
      filing,
    };
  }

  /**
   * Get open audit findings by severity
   */
  async getOpenFindings(
    entityId: string,
    minSeverity?: FindingSeverity
  ): Promise<AuditFinding[]> {
    const severityOrder: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'informational'];

    let findings = Array.from(this.findings.values())
      .filter(f => f.entityId === entityId)
      .filter(f => f.status === 'open' || f.status === 'in_remediation' || f.status === 'pending_verification');

    if (minSeverity) {
      const minIndex = severityOrder.indexOf(minSeverity);
      findings = findings.filter(f => severityOrder.indexOf(f.severity) <= minIndex);
    }

    return findings.sort((a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );
  }

  /**
   * Calculate compliance score for an entity (0-100)
   */
  async calculateComplianceScore(entityId: string): Promise<{
    score: number;
    breakdown: {
      obligationsOnTime: number;
      findingsResolved: number;
      boiCompliant: boolean;
    };
  }> {
    const obligations = await this.getEntityObligations(entityId);
    const completedOnTime = obligations.filter(
      o => o.status === 'completed' && (!o.dueDate || o.completedDate! <= o.dueDate)
    ).length;
    const obligationsOnTime = obligations.length > 0
      ? Math.round((completedOnTime / obligations.length) * 100)
      : 100;

    const allFindings = Array.from(this.findings.values())
      .filter(f => f.entityId === entityId);
    const resolvedFindings = allFindings.filter(
      f => f.status === 'closed' || f.status === 'false_positive'
    ).length;
    const findingsResolved = allFindings.length > 0
      ? Math.round((resolvedFindings / allFindings.length) * 100)
      : 100;

    const boiStatus = await this.getBOIFilingStatus(entityId);

    // Weighted score
    const score = Math.round(
      obligationsOnTime * 0.4 +
      findingsResolved * 0.4 +
      (boiStatus.isCompliant ? 100 : 0) * 0.2
    );

    return {
      score,
      breakdown: {
        obligationsOnTime,
        findingsResolved,
        boiCompliant: boiStatus.isCompliant,
      },
    };
  }

  /**
   * Check if entity needs CTA (Corporate Transparency Act) filing
   */
  async checkCTARequirement(
    entityId: string,
    entityType: string,
    employeeCount: number,
    annualRevenue: number,
    hasUSPresence: boolean
  ): Promise<{
    required: boolean;
    exemptionReason?: string;
    deadline?: Date;
  }> {
    // Large operating company exemption
    if (employeeCount > 20 && annualRevenue > 5_000_000 && hasUSPresence) {
      return {
        required: false,
        exemptionReason: 'Large operating company (>20 employees, >$5M revenue, US presence)',
      };
    }

    // Default: filing required
    // New companies: 90 days from registration
    // Existing companies: January 1, 2025
    const deadline = new Date('2025-01-01');

    return {
      required: true,
      deadline,
    };
  }
}

export default ComplianceService;
