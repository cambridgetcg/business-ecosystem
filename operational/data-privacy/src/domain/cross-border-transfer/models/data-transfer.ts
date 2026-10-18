/**
 * Cross-Border Data Transfer Domain Model
 * GDPR Chapter V - Transfers of personal data to third countries
 */

// ============================================================================
// ENUMS
// ============================================================================

export type TransferStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type TransferBasis =
  | 'ADEQUACY_DECISION'         // Art. 45
  | 'STANDARD_CONTRACTUAL_CLAUSES' // Art. 46(2)(c)
  | 'BINDING_CORPORATE_RULES'   // Art. 47
  | 'APPROVED_CODE_OF_CONDUCT'  // Art. 46(2)(e)
  | 'APPROVED_CERTIFICATION'    // Art. 46(2)(f)
  | 'EXPLICIT_CONSENT'          // Art. 49(1)(a)
  | 'CONTRACT_PERFORMANCE'      // Art. 49(1)(b)
  | 'PUBLIC_INTEREST'           // Art. 49(1)(d)
  | 'LEGAL_CLAIMS'              // Art. 49(1)(e)
  | 'VITAL_INTERESTS'           // Art. 49(1)(f)
  | 'PUBLIC_REGISTER';          // Art. 49(1)(g)

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface TransferImpactAssessment {
  assessedAt: Date;
  assessedBy: string;
  recipientCountryLaws: string;
  supplementaryMeasures?: string | undefined;
  riskLevel: RiskLevel;
  conclusion: string;
}

export interface DataTransfer {
  id: string;
  entityId: string;

  // Transfer identification
  name: string;
  description: string;

  // Source and destination
  sourceCountry: string;
  destinationCountry: string;
  recipientName: string;
  recipientType: 'CONTROLLER' | 'PROCESSOR';

  // Data details
  dataCategories: string[];
  dataSubjects: string[];
  transferPurposes: string[];

  // Transfer basis
  transferBasis: TransferBasis;
  basisReference?: string | undefined; // SCC version, BCR reference, etc.

  // Impact assessment (Schrems II)
  transferImpactAssessment?: TransferImpactAssessment | undefined;

  // Supplementary measures
  technicalMeasures: string[];
  organizationalMeasures: string[];
  contractualMeasures: string[];

  // Status
  status: TransferStatus;
  approvedBy?: string | undefined;
  approvedAt?: Date | undefined;

  // Linked records
  processorId?: string | undefined;
  processingActivityId?: string | undefined;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateTransferInput {
  entityId: string;
  name: string;
  description: string;
  destinationCountry: string;
  recipientName: string;
  recipientType: 'CONTROLLER' | 'PROCESSOR';
  dataCategories: string[];
  dataSubjects: string[];
  transferPurposes: string[];
  transferBasis: TransferBasis;
  basisReference?: string | undefined;
  processorId?: string | undefined;
  processingActivityId?: string | undefined;
  createdBy: string;
}

export interface UpdateTransferInput {
  name?: string | undefined;
  description?: string | undefined;
  dataCategories?: string[] | undefined;
  dataSubjects?: string[] | undefined;
  transferPurposes?: string[] | undefined;
  transferBasis?: TransferBasis | undefined;
  basisReference?: string | undefined;
  technicalMeasures?: string[] | undefined;
  organizationalMeasures?: string[] | undefined;
  contractualMeasures?: string[] | undefined;
}

export interface TransferImpactAssessmentInput {
  recipientCountryLaws: string;
  supplementaryMeasures?: string | undefined;
  riskLevel: RiskLevel;
  conclusion: string;
  assessedBy: string;
}

export interface TransferQueryFilter {
  entityId?: string | undefined;
  status?: TransferStatus | undefined;
  destinationCountry?: string | undefined;
  transferBasis?: TransferBasis | undefined;
  hasImpactAssessment?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// ADEQUACY DECISIONS DATA
// ============================================================================

// Countries with full adequacy decisions (as of 2024)
const FULL_ADEQUACY_COUNTRIES: Record<string, { decision: string; date: string }> = {
  'AD': { decision: '2010/625/EU', date: '2010-10-21' },   // Andorra
  'AR': { decision: '2003/490/EC', date: '2003-06-30' },   // Argentina
  'CA': { decision: '2002/2/EC', date: '2001-12-20' },     // Canada (commercial)
  'FO': { decision: '2010/146/EU', date: '2010-03-05' },   // Faroe Islands
  'GG': { decision: '2003/821/EC', date: '2003-11-21' },   // Guernsey
  'IL': { decision: '2011/61/EU', date: '2011-01-31' },    // Israel
  'IM': { decision: '2004/411/EC', date: '2004-04-28' },   // Isle of Man
  'JP': { decision: '2019/419', date: '2019-01-23' },      // Japan
  'JE': { decision: '2008/393/EC', date: '2008-05-08' },   // Jersey
  'NZ': { decision: '2013/65/EU', date: '2012-12-19' },    // New Zealand
  'KR': { decision: '2022/254', date: '2021-12-17' },      // South Korea
  'CH': { decision: '2000/518/EC', date: '2000-08-25' },   // Switzerland
  'GB': { decision: '2021/1772', date: '2021-06-28' },     // UK (time-limited)
  'UY': { decision: '2012/484/EU', date: '2012-08-21' },   // Uruguay
};

// US: Data Privacy Framework (limited scope)
const US_DPF = { decision: '2023/1795', date: '2023-07-10', scope: 'DPF_CERTIFIED' };

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

/**
 * Check if country has adequacy decision
 */
export function hasAdequacyDecision(countryCode: string): boolean {
  return countryCode.toUpperCase() in FULL_ADEQUACY_COUNTRIES;
}

/**
 * Get adequacy decision details
 */
export function getAdequacyDecision(countryCode: string): { decision: string; date: string } | null {
  return FULL_ADEQUACY_COUNTRIES[countryCode.toUpperCase()] || null;
}

/**
 * Check if US transfer is to DPF-certified organization
 */
export function isUSDataPrivacyFramework(countryCode: string, basis: TransferBasis): boolean {
  return countryCode.toUpperCase() === 'US' && basis === 'ADEQUACY_DECISION';
}

/**
 * Check if transfer requires Transfer Impact Assessment (TIA)
 * Required for non-adequacy transfers after Schrems II
 */
export function requiresTransferImpactAssessment(transfer: DataTransfer): boolean {
  // Adequacy countries don't require TIA
  if (hasAdequacyDecision(transfer.destinationCountry)) {
    return false;
  }

  // Derogations (Art. 49) typically require case-by-case assessment
  const derogations: TransferBasis[] = [
    'EXPLICIT_CONSENT',
    'CONTRACT_PERFORMANCE',
    'PUBLIC_INTEREST',
    'LEGAL_CLAIMS',
    'VITAL_INTERESTS',
    'PUBLIC_REGISTER',
  ];

  // SCCs, BCRs require TIA after Schrems II
  return !derogations.includes(transfer.transferBasis);
}

/**
 * Check if transfer can be approved
 */
export function canApprove(transfer: DataTransfer): boolean {
  if (transfer.status !== 'PENDING_REVIEW') return false;

  // Must have TIA if required
  if (requiresTransferImpactAssessment(transfer) && !transfer.transferImpactAssessment) {
    return false;
  }

  // High/Critical risk TIA requires supplementary measures
  if (transfer.transferImpactAssessment) {
    const { riskLevel } = transfer.transferImpactAssessment;
    if (riskLevel === 'CRITICAL') return false; // Cannot approve critical risk
    if (riskLevel === 'HIGH' && transfer.technicalMeasures.length === 0) {
      return false; // High risk requires supplementary measures
    }
  }

  return true;
}

/**
 * Determine recommended transfer basis for a country
 */
export function recommendTransferBasis(destinationCountry: string): {
  recommended: TransferBasis;
  alternatives: TransferBasis[];
  requiresTIA: boolean;
} {
  const countryUpper = destinationCountry.toUpperCase();

  if (hasAdequacyDecision(countryUpper)) {
    return {
      recommended: 'ADEQUACY_DECISION',
      alternatives: [],
      requiresTIA: false,
    };
  }

  // US with DPF
  if (countryUpper === 'US') {
    return {
      recommended: 'ADEQUACY_DECISION', // DPF
      alternatives: ['STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES'],
      requiresTIA: true, // TIA still recommended for DPF
    };
  }

  // Default for non-adequacy countries
  return {
    recommended: 'STANDARD_CONTRACTUAL_CLAUSES',
    alternatives: ['BINDING_CORPORATE_RULES', 'EXPLICIT_CONSENT'],
    requiresTIA: true,
  };
}

/**
 * Get transfer compliance status
 */
export function getTransferComplianceStatus(transfer: DataTransfer): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check basis validity
  if (!hasAdequacyDecision(transfer.destinationCountry) && transfer.transferBasis === 'ADEQUACY_DECISION') {
    if (transfer.destinationCountry.toUpperCase() !== 'US') {
      issues.push('Adequacy decision claimed but country has no adequacy decision');
    }
  }

  // Check TIA requirement
  if (requiresTransferImpactAssessment(transfer) && !transfer.transferImpactAssessment) {
    issues.push('Transfer Impact Assessment required but not completed');
  }

  // Check supplementary measures for high-risk transfers
  if (transfer.transferImpactAssessment?.riskLevel === 'HIGH' || transfer.transferImpactAssessment?.riskLevel === 'CRITICAL') {
    if (transfer.technicalMeasures.length === 0 && transfer.organizationalMeasures.length === 0) {
      issues.push('High-risk transfer requires supplementary measures');
    }
  }

  // Check SCC reference
  if (transfer.transferBasis === 'STANDARD_CONTRACTUAL_CLAUSES' && !transfer.basisReference) {
    issues.push('SCC reference/version not specified');
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Calculate transfer risk score
 */
export function calculateTransferRisk(transfer: DataTransfer): RiskLevel {
  let score = 0;

  // Country risk
  if (!hasAdequacyDecision(transfer.destinationCountry)) {
    score += 2;
  }

  // Basis risk
  const highRiskBases: TransferBasis[] = ['EXPLICIT_CONSENT', 'CONTRACT_PERFORMANCE'];
  if (highRiskBases.includes(transfer.transferBasis)) {
    score += 1; // Derogations are for occasional transfers only
  }

  // TIA risk
  if (transfer.transferImpactAssessment) {
    if (transfer.transferImpactAssessment.riskLevel === 'CRITICAL') score += 4;
    else if (transfer.transferImpactAssessment.riskLevel === 'HIGH') score += 2;
    else if (transfer.transferImpactAssessment.riskLevel === 'MEDIUM') score += 1;
  } else if (requiresTransferImpactAssessment(transfer)) {
    score += 2; // Missing required TIA
  }

  // Supplementary measures
  if (score > 2 && transfer.technicalMeasures.length === 0) {
    score += 1;
  }

  if (score >= 6) return 'CRITICAL';
  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}
