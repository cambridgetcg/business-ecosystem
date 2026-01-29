/**
 * Compliance Engine
 *
 * AML screening, sanctions checking, and transaction monitoring.
 *
 * @see docs/research/nuances/12_SANCTIONS_AML_COMPLIANCE.md
 * @module services/compliance
 */

import type {
  ComplianceCheckRequest,
  ComplianceCheckResult,
  ComplianceStatus,
  ComplianceFinding,
  RiskLevel,
  SanctionsListEntry,
  TransactionMonitoringRule,
  ComplianceCase,
  CaseStatus,
  ComplianceAlert,
  ComplianceAlertType,
  CounterpartyInfo,
} from './types.js';

/**
 * Sanctions list provider interface.
 */
export interface ISanctionsListProvider {
  search(name: string, countryCode?: string): Promise<SanctionsListEntry[]>;
  getListLastUpdated(listName: string): Promise<Date>;
}

/**
 * Case repository interface.
 */
export interface ICaseRepository {
  createCase(case_: Omit<ComplianceCase, 'caseId'>): Promise<ComplianceCase>;
  updateCase(caseId: string, updates: Partial<ComplianceCase>): Promise<ComplianceCase>;
  getCasesByEntity(entityId: string): Promise<ComplianceCase[]>;
  getOpenCases(): Promise<ComplianceCase[]>;
}

/**
 * Compliance Engine
 *
 * Provides comprehensive compliance checking:
 * - Sanctions screening (OFAC, EU, UN, UK)
 * - PEP screening
 * - Transaction monitoring
 * - Case management
 * - Alert generation
 */
export class ComplianceEngine {
  private readonly sanctionsProvider: ISanctionsListProvider;
  private readonly caseRepository: ICaseRepository;
  private readonly monitoringRules: TransactionMonitoringRule[] = [];
  private readonly highRiskCountries: Set<string> = new Set();
  private readonly alertHistory: ComplianceAlert[] = [];

  constructor(
    sanctionsProvider: ISanctionsListProvider,
    caseRepository: ICaseRepository
  ) {
    this.sanctionsProvider = sanctionsProvider;
    this.caseRepository = caseRepository;
    this.initializeHighRiskCountries();
  }

  /**
   * Perform compliance check.
   */
  async performCheck(request: ComplianceCheckRequest): Promise<ComplianceCheckResult> {
    const findings: ComplianceFinding[] = [];
    const matchedLists: string[] = [];

    // Run appropriate checks based on type
    if (request.checkType === 'full' || request.checkType === 'sanctions') {
      const sanctionsFindings = await this.checkSanctions(request.counterparty);
      findings.push(...sanctionsFindings);
      matchedLists.push(...sanctionsFindings.filter(f => f.listName).map(f => f.listName!));
    }

    if (request.checkType === 'full' || request.checkType === 'pep') {
      const pepFindings = await this.checkPEP(request.counterparty);
      findings.push(...pepFindings);
    }

    if (request.checkType === 'full' || request.checkType === 'aml') {
      const amlFindings = this.checkAMLIndicators(request);
      findings.push(...amlFindings);
    }

    if (request.checkType === 'full' || request.checkType === 'transaction') {
      if (request.transactionId && request.amount) {
        const txFindings = await this.checkTransactionRules(request);
        findings.push(...txFindings);
      }
    }

    // Calculate risk score and level
    const riskScore = this.calculateRiskScore(findings);
    const riskLevel = this.determineRiskLevel(riskScore);
    const status = this.determineStatus(findings, riskLevel);
    const requiresReview = status === 'potential_match' || status === 'escalated';

    const result: ComplianceCheckResult = {
      requestId: request.requestId,
      checkType: request.checkType,
      status,
      riskScore,
      riskLevel,
      findings,
      matchedLists: [...new Set(matchedLists)],
      requiresReview,
      reviewReason: requiresReview ? this.getReviewReason(findings) : undefined,
      completedAt: new Date(),
      expiresAt: this.calculateExpiry(),
    };

    // Create case if needed
    if (requiresReview) {
      await this.createComplianceCase(request, result);
    }

    // Generate alerts for critical findings
    for (const finding of findings) {
      if (finding.severity === 'critical' || finding.severity === 'high') {
        this.createAlert(request.entityId, finding);
      }
    }

    return result;
  }

  /**
   * Check counterparty against sanctions lists.
   */
  private async checkSanctions(counterparty: CounterpartyInfo): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Search by name
    const matches = await this.sanctionsProvider.search(
      counterparty.name,
      counterparty.countryCode
    );

    // Also search legal name if different
    if (counterparty.legalName && counterparty.legalName !== counterparty.name) {
      const legalMatches = await this.sanctionsProvider.search(
        counterparty.legalName,
        counterparty.countryCode
      );
      matches.push(...legalMatches);
    }

    for (const match of matches) {
      const matchScore = this.calculateNameMatchScore(counterparty.name, match.name);

      if (matchScore >= 0.7) {
        findings.push({
          findingId: `sanctions-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          findingType: 'sanctions_match',
          severity: matchScore >= 0.95 ? 'critical' : matchScore >= 0.85 ? 'high' : 'medium',
          description: `Potential match found on ${match.listName}: ${match.name}`,
          source: match.listName,
          matchScore,
          listName: match.listName,
          listEntryId: match.entryId,
          recommendedAction: matchScore >= 0.95 ? 'block' : 'review',
        });
      }
    }

    // Check high-risk country
    if (this.highRiskCountries.has(counterparty.countryCode)) {
      findings.push({
        findingId: `country-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        findingType: 'high_risk_country',
        severity: 'medium',
        description: `Counterparty located in high-risk jurisdiction: ${counterparty.countryCode}`,
        source: 'country_risk_list',
        recommendedAction: 'enhanced_due_diligence',
      });
    }

    return findings;
  }

  /**
   * Check for Politically Exposed Person indicators.
   */
  private async checkPEP(counterparty: CounterpartyInfo): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // In production, this would call a PEP database
    // For now, we'll use a simplified heuristic
    if (counterparty.type === 'individual') {
      // Placeholder for PEP check logic
      // Real implementation would query PEP databases
    }

    return findings;
  }

  /**
   * Check AML indicators.
   */
  private checkAMLIndicators(request: ComplianceCheckRequest): ComplianceFinding[] {
    const findings: ComplianceFinding[] = [];

    // Check for round amounts (potential structuring)
    if (request.amount) {
      const amount = request.amount.amount;
      if (amount > 0 && amount % 1000 === 0 && amount >= 9000 && amount < 10000) {
        findings.push({
          findingId: `aml-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          findingType: 'unusual_transaction',
          severity: 'medium',
          description: 'Transaction amount just below reporting threshold - potential structuring',
          source: 'aml_rules',
          recommendedAction: 'review',
        });
      }
    }

    // Check for unclear purpose
    if (!request.purpose || request.purpose.length < 10) {
      findings.push({
        findingId: `aml-purpose-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        findingType: 'kyc_gap',
        severity: 'low',
        description: 'Transaction purpose not clearly specified',
        source: 'aml_rules',
        recommendedAction: 'review',
      });
    }

    return findings;
  }

  /**
   * Check transaction against monitoring rules.
   */
  private async checkTransactionRules(
    request: ComplianceCheckRequest
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    for (const rule of this.monitoringRules) {
      if (!rule.enabled) continue;

      const triggered = this.evaluateRule(rule, request);
      if (triggered) {
        findings.push({
          findingId: `rule-${rule.ruleId}-${Date.now()}`,
          findingType: rule.ruleType === 'velocity' ? 'velocity_breach' :
                       rule.ruleType === 'amount' ? 'amount_threshold' : 'pattern_match',
          severity: rule.severity,
          description: `Transaction triggered rule: ${rule.ruleName}`,
          source: `monitoring_rule:${rule.ruleId}`,
          recommendedAction: rule.action,
        });
      }
    }

    return findings;
  }

  /**
   * Evaluate a monitoring rule.
   */
  private evaluateRule(
    rule: TransactionMonitoringRule,
    request: ComplianceCheckRequest
  ): boolean {
    // Simplified rule evaluation
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(request, condition.field);
      if (value === undefined) continue;

      const conditionMet = this.evaluateCondition(value, condition.operator, condition.value);
      if (!conditionMet) return false;
    }
    return true;
  }

  /**
   * Get field value from request.
   */
  private getFieldValue(request: ComplianceCheckRequest, field: string): unknown {
    switch (field) {
      case 'amount': return request.amount?.amount;
      case 'currency': return request.amount?.currency;
      case 'country': return request.counterparty.countryCode;
      case 'counterparty_type': return request.counterparty.type;
      default: return undefined;
    }
  }

  /**
   * Evaluate a condition.
   */
  private evaluateCondition(
    value: unknown,
    operator: string,
    target: string | number | boolean
  ): boolean {
    switch (operator) {
      case 'equals': return value === target;
      case 'not_equals': return value !== target;
      case 'greater_than': return typeof value === 'number' && value > (target as number);
      case 'less_than': return typeof value === 'number' && value < (target as number);
      case 'greater_or_equal': return typeof value === 'number' && value >= (target as number);
      case 'less_or_equal': return typeof value === 'number' && value <= (target as number);
      case 'contains': return typeof value === 'string' && value.includes(target as string);
      case 'in_list': return Array.isArray(target) && target.includes(value);
      default: return false;
    }
  }

  /**
   * Calculate overall risk score.
   */
  private calculateRiskScore(findings: ComplianceFinding[]): number {
    if (findings.length === 0) return 0;

    const severityWeights: Record<RiskLevel, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    let totalWeight = 0;
    let weightedScore = 0;

    for (const finding of findings) {
      const weight = severityWeights[finding.severity];
      totalWeight += weight;
      weightedScore += weight * (finding.matchScore ?? 1);
    }

    return totalWeight > 0 ? Math.min(100, (weightedScore / findings.length)) : 0;
  }

  /**
   * Determine risk level from score.
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Determine compliance status.
   */
  private determineStatus(findings: ComplianceFinding[], riskLevel: RiskLevel): ComplianceStatus {
    if (findings.length === 0) return 'clear';

    const hasBlock = findings.some(f => f.recommendedAction === 'block');
    if (hasBlock) return 'blocked';

    const hasCritical = findings.some(f => f.severity === 'critical');
    if (hasCritical) return 'confirmed_match';

    const hasHigh = findings.some(f => f.severity === 'high');
    if (hasHigh) return 'escalated';

    if (riskLevel === 'medium' || riskLevel === 'high') return 'potential_match';

    return 'clear';
  }

  /**
   * Get review reason.
   */
  private getReviewReason(findings: ComplianceFinding[]): string {
    const reasons = findings
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .map(f => f.description);

    return reasons.length > 0 ? reasons.join('; ') : 'Manual review required';
  }

  /**
   * Calculate expiry date for check result.
   */
  private calculateExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // Results valid for 30 days
    return expiry;
  }

  /**
   * Calculate name match score using fuzzy matching.
   */
  private calculateNameMatchScore(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;

    // Levenshtein distance-based similarity
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(n1, n2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance.
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i]![0] = i;
    for (let j = 0; j <= n; j++) dp[0]![j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(
          dp[i - 1]![j]! + 1,
          dp[i]![j - 1]! + 1,
          dp[i - 1]![j - 1]! + cost
        );
      }
    }

    return dp[m]![n]!;
  }

  /**
   * Create compliance case.
   */
  private async createComplianceCase(
    request: ComplianceCheckRequest,
    result: ComplianceCheckResult
  ): Promise<void> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (result.riskLevel === 'critical' ? 1 : 3));

    await this.caseRepository.createCase({
      entityId: request.entityId,
      transactionId: request.transactionId,
      caseType: request.checkType,
      status: 'open' as CaseStatus,
      priority: result.riskLevel,
      findings: result.findings,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate,
    });
  }

  /**
   * Create compliance alert.
   */
  private createAlert(entityId: string, finding: ComplianceFinding): void {
    const alertType: ComplianceAlertType =
      finding.findingType === 'sanctions_match' ? 'sanctions_hit' :
      finding.findingType === 'pep_match' ? 'pep_match' :
      finding.findingType === 'velocity_breach' ? 'velocity_breach' :
      'high_risk_transaction';

    const alert: ComplianceAlert = {
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      entityId,
      alertType,
      severity: finding.severity,
      message: finding.description,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alertHistory.push(alert);
  }

  /**
   * Initialize high-risk countries list.
   */
  private initializeHighRiskCountries(): void {
    // FATF high-risk and monitored jurisdictions
    const countries = [
      'KP', // North Korea
      'IR', // Iran
      'MM', // Myanmar
      'SY', // Syria
      'AF', // Afghanistan
      'YE', // Yemen
      'LY', // Libya
      'SS', // South Sudan
      'SO', // Somalia
      'VE', // Venezuela
    ];
    countries.forEach(c => this.highRiskCountries.add(c));
  }

  /**
   * Add monitoring rule.
   */
  addMonitoringRule(rule: TransactionMonitoringRule): void {
    this.monitoringRules.push(rule);
  }

  /**
   * Get alert history.
   */
  getAlertHistory(entityId?: string): ComplianceAlert[] {
    if (entityId) {
      return this.alertHistory.filter(a => a.entityId === entityId);
    }
    return [...this.alertHistory];
  }

  /**
   * Get open cases.
   */
  async getOpenCases(): Promise<ComplianceCase[]> {
    return this.caseRepository.getOpenCases();
  }
}
