/**
 * Compliance Service Types
 *
 * Types for AML screening, sanctions checking, and regulatory compliance.
 *
 * @see docs/research/nuances/12_SANCTIONS_AML_COMPLIANCE.md
 * @module services/compliance
 */

import type { Money } from '../../types/financial.js';

/**
 * Compliance check request.
 */
export interface ComplianceCheckRequest {
  readonly requestId: string;
  readonly checkType: ComplianceCheckType;
  readonly entityId: string;
  readonly transactionId?: string | undefined;
  readonly counterparty: CounterpartyInfo;
  readonly amount?: Money | undefined;
  readonly purpose?: string | undefined;
  readonly urgency: 'standard' | 'urgent';
  readonly requestedAt: Date;
}

/**
 * Compliance check type.
 */
export type ComplianceCheckType =
  | 'sanctions'
  | 'pep'           // Politically Exposed Person
  | 'aml'           // Anti-Money Laundering
  | 'kyc'           // Know Your Customer
  | 'transaction'   // Transaction monitoring
  | 'full';         // All checks combined

/**
 * Counterparty information for screening.
 */
export interface CounterpartyInfo {
  readonly name: string;
  readonly legalName?: string | undefined;
  readonly countryCode: string;
  readonly address?: AddressInfo | undefined;
  readonly identifiers?: CounterpartyIdentifier[] | undefined;
  readonly type: 'individual' | 'entity';
  readonly dateOfBirth?: Date | undefined;
  readonly incorporationDate?: Date | undefined;
}

/**
 * Address information.
 */
export interface AddressInfo {
  readonly line1: string;
  readonly line2?: string | undefined;
  readonly city: string;
  readonly region?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly countryCode: string;
}

/**
 * Counterparty identifier.
 */
export interface CounterpartyIdentifier {
  readonly type: IdentifierType;
  readonly value: string;
  readonly issuingCountry?: string | undefined;
}

/**
 * Identifier types.
 */
export type IdentifierType =
  | 'lei'            // Legal Entity Identifier
  | 'ein'            // Employer Identification Number
  | 'duns'           // D-U-N-S Number
  | 'vat'            // VAT Number
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'swift_bic'
  | 'iban'
  | 'account_number';

/**
 * Compliance check result.
 */
export interface ComplianceCheckResult {
  readonly requestId: string;
  readonly checkType: ComplianceCheckType;
  readonly status: ComplianceStatus;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly findings: ComplianceFinding[];
  readonly matchedLists: string[];
  readonly requiresReview: boolean;
  readonly reviewReason?: string | undefined;
  readonly completedAt: Date;
  readonly expiresAt: Date;
}

/**
 * Compliance status.
 */
export type ComplianceStatus =
  | 'clear'          // No issues found
  | 'potential_match' // Possible hit, needs review
  | 'confirmed_match' // Confirmed positive match
  | 'blocked'        // Transaction blocked
  | 'escalated'      // Sent for manual review
  | 'pending';       // Check in progress

/**
 * Risk level classification.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Compliance finding.
 */
export interface ComplianceFinding {
  readonly findingId: string;
  readonly findingType: FindingType;
  readonly severity: RiskLevel;
  readonly description: string;
  readonly source: string;
  readonly matchScore?: number | undefined;
  readonly listName?: string | undefined;
  readonly listEntryId?: string | undefined;
  readonly recommendedAction: RecommendedAction;
}

/**
 * Finding types.
 */
export type FindingType =
  | 'sanctions_match'
  | 'pep_match'
  | 'adverse_media'
  | 'high_risk_country'
  | 'unusual_transaction'
  | 'velocity_breach'
  | 'amount_threshold'
  | 'pattern_match'
  | 'kyc_gap'
  | 'document_expiry';

/**
 * Recommended actions.
 */
export type RecommendedAction =
  | 'proceed'
  | 'review'
  | 'enhanced_due_diligence'
  | 'escalate'
  | 'block'
  | 'report';

/**
 * Sanctions list entry.
 */
export interface SanctionsListEntry {
  readonly entryId: string;
  readonly listName: string;
  readonly listType: SanctionsListType;
  readonly name: string;
  readonly aliases: string[];
  readonly type: 'individual' | 'entity' | 'vessel' | 'aircraft';
  readonly programs: string[];
  readonly countryOfOrigin?: string | undefined;
  readonly dateOfBirth?: string | undefined;
  readonly identifiers: CounterpartyIdentifier[];
  readonly addedDate: Date;
  readonly lastUpdated: Date;
}

/**
 * Sanctions list types.
 */
export type SanctionsListType =
  | 'ofac_sdn'       // OFAC Specially Designated Nationals
  | 'ofac_consolidated'
  | 'eu_sanctions'
  | 'un_sanctions'
  | 'uk_sanctions'
  | 'fatf_high_risk'
  | 'bis_entity'     // Bureau of Industry and Security
  | 'internal';

/**
 * Transaction monitoring rule.
 */
export interface TransactionMonitoringRule {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly description: string;
  readonly ruleType: MonitoringRuleType;
  readonly conditions: RuleCondition[];
  readonly action: RecommendedAction;
  readonly severity: RiskLevel;
  readonly enabled: boolean;
}

/**
 * Monitoring rule types.
 */
export type MonitoringRuleType =
  | 'velocity'       // Transaction frequency
  | 'amount'         // Single transaction amount
  | 'cumulative'     // Cumulative amount over period
  | 'pattern'        // Transaction pattern
  | 'country'        // Country-based
  | 'counterparty'   // Counterparty-based
  | 'custom';

/**
 * Rule condition.
 */
export interface RuleCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: string | number | boolean;
  readonly timeWindowMinutes?: number | undefined;
}

/**
 * Condition operators.
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'in_list'
  | 'not_in_list'
  | 'matches_pattern';

/**
 * Compliance case for review.
 */
export interface ComplianceCase {
  readonly caseId: string;
  readonly entityId: string;
  readonly transactionId?: string | undefined;
  readonly caseType: ComplianceCheckType;
  readonly status: CaseStatus;
  readonly priority: RiskLevel;
  readonly findings: ComplianceFinding[];
  readonly assignedTo?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly dueDate: Date;
  readonly resolution?: CaseResolution | undefined;
}

/**
 * Case status.
 */
export type CaseStatus =
  | 'open'
  | 'in_review'
  | 'pending_info'
  | 'escalated'
  | 'resolved'
  | 'closed';

/**
 * Case resolution.
 */
export interface CaseResolution {
  readonly outcome: 'cleared' | 'blocked' | 'reported';
  readonly reasoning: string;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
  readonly sarFiled?: boolean | undefined;
  readonly sarReference?: string | undefined;
}

/**
 * Regulatory report.
 */
export interface RegulatoryReport {
  readonly reportId: string;
  readonly reportType: ReportType;
  readonly regulatoryBody: string;
  readonly status: ReportStatus;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly generatedAt: Date;
  readonly submittedAt?: Date | undefined;
  readonly filingDeadline: Date;
  readonly acknowledgementRef?: string | undefined;
}

/**
 * Report types.
 */
export type ReportType =
  | 'sar'            // Suspicious Activity Report
  | 'ctr'            // Currency Transaction Report
  | 'fbar'           // Foreign Bank Account Report
  | 'crs'            // Common Reporting Standard
  | 'fatca';         // Foreign Account Tax Compliance Act

/**
 * Report status.
 */
export type ReportStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'submitted'
  | 'acknowledged'
  | 'rejected';

/**
 * Compliance alert.
 */
export interface ComplianceAlert {
  readonly alertId: string;
  readonly entityId: string;
  readonly alertType: ComplianceAlertType;
  readonly severity: RiskLevel;
  readonly message: string;
  readonly relatedCaseId?: string | undefined;
  readonly triggeredAt: Date;
  readonly acknowledged: boolean;
}

/**
 * Compliance alert types.
 */
export type ComplianceAlertType =
  | 'sanctions_hit'
  | 'pep_match'
  | 'high_risk_transaction'
  | 'velocity_breach'
  | 'list_update'
  | 'case_escalation'
  | 'report_deadline'
  | 'kyc_expiry';
