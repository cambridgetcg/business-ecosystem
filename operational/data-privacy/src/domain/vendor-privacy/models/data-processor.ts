/**
 * Data Processor Domain Model
 * GDPR Article 28 - Processor relationships and DPA management
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ProcessorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export type ComplianceStatus = 'UNKNOWN' | 'COMPLIANT' | 'NON_COMPLIANT' | 'UNDER_REVIEW';

export type TransferMechanism =
  | 'ADEQUACY_DECISION'
  | 'STANDARD_CONTRACTUAL_CLAUSES'
  | 'BINDING_CORPORATE_RULES'
  | 'DEROGATION'
  | 'CERTIFICATION'
  | 'CODE_OF_CONDUCT';

export type DataCategory =
  | 'BASIC_IDENTITY'
  | 'CONTACT_DETAILS'
  | 'FINANCIAL'
  | 'EMPLOYMENT'
  | 'EDUCATION'
  | 'ONLINE_IDENTIFIERS'
  | 'LOCATION'
  | 'BEHAVIORAL'
  | 'PREFERENCES'
  | 'DEVICE_DATA'
  | 'COMMUNICATION'
  | 'IMAGES'
  | 'AUDIO_VIDEO'
  | 'OTHER';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface SubProcessor {
  name: string;
  country: string;
  purposes: string[];
  approvedAt?: Date | undefined;
}

export interface DataProcessor {
  id: string;
  entityId: string;

  // Processor details
  name: string;
  description?: string | undefined;

  // Contact
  contactName?: string | undefined;
  contactEmail?: string | undefined;

  // Location
  country: string;
  isEU: boolean;

  // Data Processing Agreement
  dpaReference?: string | undefined;
  dpaSignedAt?: Date | undefined;
  dpaExpiresAt?: Date | undefined;

  // Transfer mechanisms (for non-EU)
  transferMechanism?: TransferMechanism | undefined;
  sccReference?: string | undefined;

  // Processing details
  dataCategories: DataCategory[];
  purposes: string[];

  // Sub-processors
  hasSubProcessors: boolean;
  subProcessors?: SubProcessor[] | undefined;

  // Compliance
  lastAuditDate?: Date | undefined;
  complianceStatus: ComplianceStatus;
  certifications: string[];

  // Status
  status: ProcessorStatus;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateProcessorInput {
  entityId: string;
  name: string;
  description?: string | undefined;
  country: string;
  contactName?: string | undefined;
  contactEmail?: string | undefined;
  dataCategories: DataCategory[];
  purposes: string[];
  createdBy: string;
}

export interface UpdateProcessorInput {
  name?: string | undefined;
  description?: string | undefined;
  contactName?: string | undefined;
  contactEmail?: string | undefined;
  country?: string | undefined;
  dataCategories?: DataCategory[] | undefined;
  purposes?: string[] | undefined;
  certifications?: string[] | undefined;
}

export interface RecordDPAInput {
  dpaReference: string;
  signedAt: Date;
  expiresAt: Date;
}

export interface AddTransferMechanismInput {
  mechanism: TransferMechanism;
  sccReference?: string | undefined;
}

export interface AddSubProcessorInput {
  name: string;
  country: string;
  purposes: string[];
}

export interface ProcessorQueryFilter {
  entityId?: string | undefined;
  status?: ProcessorStatus | undefined;
  complianceStatus?: ComplianceStatus | undefined;
  isEU?: boolean | undefined;
  dpaExpiringSoon?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

// EU/EEA countries for automatic classification
const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA
  'IS', 'LI', 'NO',
]);

// Countries with adequacy decisions
const ADEQUACY_COUNTRIES = new Set([
  'AD', 'AR', 'CA', 'FO', 'GG', 'IL', 'IM', 'JP', 'JE', 'NZ',
  'KR', 'CH', 'GB', 'UY', 'US', // US: limited to DPF participants
]);

/**
 * Check if country is in EU/EEA
 */
export function isEUCountry(countryCode: string): boolean {
  return EU_COUNTRIES.has(countryCode.toUpperCase());
}

/**
 * Check if country has adequacy decision
 */
export function hasAdequacyDecision(countryCode: string): boolean {
  return ADEQUACY_COUNTRIES.has(countryCode.toUpperCase());
}

/**
 * Check if processor requires transfer mechanism
 */
export function requiresTransferMechanism(processor: DataProcessor): boolean {
  return !processor.isEU && !hasAdequacyDecision(processor.country);
}

/**
 * Check if DPA is expiring soon (within 90 days)
 */
export function isDPAExpiringSoon(processor: DataProcessor, daysThreshold: number = 90): boolean {
  if (!processor.dpaExpiresAt) return false;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  return processor.dpaExpiresAt <= thresholdDate;
}

/**
 * Check if DPA has expired
 */
export function isDPAExpired(processor: DataProcessor): boolean {
  if (!processor.dpaExpiresAt) return false;
  return new Date() > processor.dpaExpiresAt;
}

/**
 * Check if processor has valid DPA
 */
export function hasValidDPA(processor: DataProcessor): boolean {
  return Boolean(processor.dpaSignedAt) && !isDPAExpired(processor);
}

/**
 * Check if processor can be activated
 */
export function canActivate(processor: DataProcessor): boolean {
  // Must have DPA
  if (!hasValidDPA(processor)) return false;

  // Non-EU must have transfer mechanism (unless adequacy)
  if (requiresTransferMechanism(processor) && !processor.transferMechanism) {
    return false;
  }

  return true;
}

/**
 * Check if audit is overdue (more than 1 year since last audit)
 */
export function isAuditOverdue(processor: DataProcessor): boolean {
  if (!processor.lastAuditDate) return true;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return processor.lastAuditDate < oneYearAgo;
}

/**
 * Get compliance risk level
 */
export function getComplianceRisk(processor: DataProcessor): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  let riskScore = 0;

  // No DPA
  if (!hasValidDPA(processor)) riskScore += 3;
  else if (isDPAExpiringSoon(processor)) riskScore += 1;

  // Non-EU without mechanism
  if (requiresTransferMechanism(processor) && !processor.transferMechanism) riskScore += 3;

  // Compliance status
  if (processor.complianceStatus === 'NON_COMPLIANT') riskScore += 3;
  else if (processor.complianceStatus === 'UNKNOWN') riskScore += 1;

  // Audit overdue
  if (isAuditOverdue(processor)) riskScore += 1;

  // Sub-processors without details
  if (processor.hasSubProcessors && (!processor.subProcessors || processor.subProcessors.length === 0)) {
    riskScore += 2;
  }

  if (riskScore >= 6) return 'CRITICAL';
  if (riskScore >= 4) return 'HIGH';
  if (riskScore >= 2) return 'MEDIUM';
  return 'LOW';
}
