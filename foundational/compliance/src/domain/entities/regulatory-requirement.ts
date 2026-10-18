import { z } from 'zod';

/**
 * Regulatory Requirement Entity
 * Defines a compliance requirement from a regulatory body
 */

export const RegulatorTypeSchema = z.enum([
  // UK Regulators
  'hmrc',          // HM Revenue & Customs
  'fca',           // Financial Conduct Authority
  'pra',           // Prudential Regulation Authority
  'ico',           // Information Commissioner's Office
  'companies_house', // Companies House
  'hse',           // Health and Safety Executive
  'cma',           // Competition and Markets Authority
  'tpr',           // The Pensions Regulator
  // EU Regulators
  'eu_commission',
  'esma',          // European Securities and Markets Authority
  // US Regulators (for international operations)
  'sec',           // Securities and Exchange Commission
  'finra',         // Financial Industry Regulatory Authority
  'fincen',        // Financial Crimes Enforcement Network
  'ofac',          // Office of Foreign Assets Control
  'irs',           // Internal Revenue Service
  // International
  'fatf',          // Financial Action Task Force
  'other',
]);
export type RegulatorType = z.infer<typeof RegulatorTypeSchema>;

export const RequirementCategorySchema = z.enum([
  // Tax
  'corporation_tax',
  'vat',
  'paye',
  'national_insurance',
  // AML/KYC
  'aml',           // Anti-Money Laundering
  'kyc',           // Know Your Customer
  'sanctions',     // Sanctions screening
  // Corporate
  'company_filing',  // Annual returns, accounts
  'corporate_governance',
  'directors_duties',
  'psc',           // Persons with Significant Control
  // Data Protection
  'gdpr',
  'data_retention',
  'data_breach',
  // Employment
  'employment_law',
  'pension_auto_enrolment',
  'health_safety',
  // Financial
  'financial_reporting',
  'audit',
  'capital_requirements',
  // Consumer
  'consumer_duty',
  'complaints_handling',
  // Other
  'licensing',
  'record_keeping',
  'other',
]);
export type RequirementCategory = z.infer<typeof RequirementCategorySchema>;

export const JurisdictionSchema = z.enum([
  'uk',
  'england_wales',
  'scotland',
  'northern_ireland',
  'eu',
  'us',
  'international',
]);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const FrequencySchema = z.enum([
  'one_time',
  'annual',
  'quarterly',
  'monthly',
  'weekly',
  'ongoing',
  'event_driven',
]);
export type Frequency = z.infer<typeof FrequencySchema>;

export const RegulatoryRequirementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(), // null for system requirements

  // Regulator details
  regulator: RegulatorTypeSchema,
  regulationName: z.string().min(1).max(255),
  regulationReference: z.string().max(100).nullable(), // e.g., "Companies Act 2006 s.386"
  jurisdiction: JurisdictionSchema,

  // Classification
  category: RequirementCategorySchema,
  subCategory: z.string().max(100).nullable(),
  description: z.string().max(4000),

  // Applicability
  applicabilityConditions: z.record(z.unknown()).nullable(), // Entity type, size, sector
  applicableEntityTypes: z.array(z.string()).nullable(),
  thresholds: z.record(z.unknown()).nullable(), // e.g., turnover > £10.2m

  // Timing
  frequency: z.enum(['one_time', 'annual', 'quarterly', 'monthly', 'weekly', 'ongoing', 'event_driven']),
  deadlineRule: z.string().max(500).nullable(), // e.g., "9 months after accounting period end"
  gracePeriodDays: z.number().int().nullable(),

  // Penalties
  penaltyDescription: z.string().max(2000).nullable(),
  maxPenaltyAmount: z.number().nullable(),
  penaltyCurrency: z.string().length(3).default('GBP'),

  // Exemptions
  exemptions: z.array(z.string()).nullable(),
  exemptionConditions: z.record(z.unknown()).nullable(),

  // Validity
  effectiveDate: z.date(),
  sunsetDate: z.date().nullable(),
  isActive: z.boolean().default(true),

  // Documentation
  guidanceUrl: z.string().url().nullable(),
  formReference: z.string().nullable(), // e.g., "CT600", "VAT100"

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type RegulatoryRequirement = z.infer<typeof RegulatoryRequirementSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateRequirementInputSchema = z.object({
  tenantId: z.string().uuid().optional(),
  regulator: RegulatorTypeSchema,
  regulationName: z.string().min(1).max(255),
  regulationReference: z.string().max(100).optional(),
  jurisdiction: JurisdictionSchema,
  category: RequirementCategorySchema,
  subCategory: z.string().max(100).optional(),
  description: z.string().max(4000),
  applicabilityConditions: z.record(z.unknown()).optional(),
  applicableEntityTypes: z.array(z.string()).optional(),
  thresholds: z.record(z.unknown()).optional(),
  frequency: z.enum(['one_time', 'annual', 'quarterly', 'monthly', 'weekly', 'ongoing', 'event_driven']),
  deadlineRule: z.string().max(500).optional(),
  gracePeriodDays: z.number().int().optional(),
  penaltyDescription: z.string().max(2000).optional(),
  maxPenaltyAmount: z.number().optional(),
  exemptions: z.array(z.string()).optional(),
  effectiveDate: z.date(),
  sunsetDate: z.date().optional(),
  guidanceUrl: z.string().url().optional(),
  formReference: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRequirementInput = z.infer<typeof CreateRequirementInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if requirement is currently active
 */
export function isRequirementActive(requirement: RegulatoryRequirement): boolean {
  if (!requirement.isActive) return false;
  const now = new Date();
  if (requirement.effectiveDate > now) return false;
  if (requirement.sunsetDate && requirement.sunsetDate < now) return false;
  return true;
}

/**
 * Check if entity meets applicability conditions
 */
export function meetsApplicabilityConditions(
  requirement: RegulatoryRequirement,
  entityAttributes: Record<string, unknown>
): boolean {
  // Check entity type
  if (requirement.applicableEntityTypes?.length) {
    const entityType = entityAttributes.entityType as string;
    if (!requirement.applicableEntityTypes.includes(entityType)) {
      return false;
    }
  }

  // Check thresholds
  if (requirement.thresholds) {
    for (const [key, threshold] of Object.entries(requirement.thresholds)) {
      const entityValue = entityAttributes[key];
      if (typeof threshold === 'number' && typeof entityValue === 'number') {
        if (entityValue < threshold) return false;
      }
    }
  }

  return true;
}

/**
 * Calculate deadline from period end
 */
export function calculateDeadline(
  requirement: RegulatoryRequirement,
  periodEnd: Date
): Date {
  if (!requirement.deadlineRule) {
    return periodEnd;
  }

  // Parse common deadline rules
  const rule = requirement.deadlineRule.toLowerCase();

  // "X months after"
  const monthsMatch = rule.match(/(\d+)\s*months?\s*after/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const deadline = new Date(periodEnd);
    deadline.setMonth(deadline.getMonth() + months);
    return deadline;
  }

  // "X days after"
  const daysMatch = rule.match(/(\d+)\s*days?\s*after/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const deadline = new Date(periodEnd);
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }

  return periodEnd;
}

/**
 * Get regulator display name
 */
export function getRegulatorDisplayName(regulator: RegulatorType): string {
  const names: Record<RegulatorType, string> = {
    hmrc: 'HM Revenue & Customs',
    fca: 'Financial Conduct Authority',
    pra: 'Prudential Regulation Authority',
    ico: 'Information Commissioner\'s Office',
    companies_house: 'Companies House',
    hse: 'Health and Safety Executive',
    cma: 'Competition and Markets Authority',
    tpr: 'The Pensions Regulator',
    eu_commission: 'European Commission',
    esma: 'European Securities and Markets Authority',
    sec: 'Securities and Exchange Commission',
    finra: 'Financial Industry Regulatory Authority',
    fincen: 'Financial Crimes Enforcement Network',
    ofac: 'Office of Foreign Assets Control',
    irs: 'Internal Revenue Service',
    fatf: 'Financial Action Task Force',
    other: 'Other',
  };
  return names[regulator];
}

// =============================================================================
// UK System Requirements
// =============================================================================

export const UK_SYSTEM_REQUIREMENTS = {
  // Companies House
  ANNUAL_ACCOUNTS: {
    regulator: 'companies_house',
    regulationName: 'Annual Accounts Filing',
    regulationReference: 'Companies Act 2006 s.441',
    jurisdiction: 'uk',
    category: 'company_filing',
    description: 'File annual accounts with Companies House',
    frequency: 'annual',
    deadlineRule: '9 months after accounting reference date',
  },
  CONFIRMATION_STATEMENT: {
    regulator: 'companies_house',
    regulationName: 'Confirmation Statement',
    regulationReference: 'Companies Act 2006 s.853A',
    jurisdiction: 'uk',
    category: 'company_filing',
    description: 'File confirmation statement (formerly annual return)',
    frequency: 'annual',
    deadlineRule: '14 days after review period end',
  },
  PSC_REGISTER: {
    regulator: 'companies_house',
    regulationName: 'PSC Register Maintenance',
    regulationReference: 'Companies Act 2006 Part 21A',
    jurisdiction: 'uk',
    category: 'psc',
    description: 'Maintain register of persons with significant control',
    frequency: 'ongoing',
    deadlineRule: '14 days after change',
  },

  // HMRC
  CORPORATION_TAX_RETURN: {
    regulator: 'hmrc',
    regulationName: 'Corporation Tax Return (CT600)',
    regulationReference: 'Corporation Tax Act 2010',
    jurisdiction: 'uk',
    category: 'corporation_tax',
    description: 'File CT600 return with HMRC',
    frequency: 'annual',
    deadlineRule: '12 months after accounting period end',
    formReference: 'CT600',
  },
  CORPORATION_TAX_PAYMENT: {
    regulator: 'hmrc',
    regulationName: 'Corporation Tax Payment',
    regulationReference: 'Corporation Tax Act 2010',
    jurisdiction: 'uk',
    category: 'corporation_tax',
    description: 'Pay corporation tax liability',
    frequency: 'annual',
    deadlineRule: '9 months and 1 day after accounting period end',
  },
  VAT_RETURN: {
    regulator: 'hmrc',
    regulationName: 'VAT Return',
    regulationReference: 'VAT Act 1994',
    jurisdiction: 'uk',
    category: 'vat',
    description: 'Submit VAT return via Making Tax Digital',
    frequency: 'quarterly',
    deadlineRule: '1 month and 7 days after period end',
    formReference: 'VAT100',
  },
  PAYE_RTI: {
    regulator: 'hmrc',
    regulationName: 'PAYE Real Time Information',
    regulationReference: 'Income Tax (PAYE) Regulations 2003',
    jurisdiction: 'uk',
    category: 'paye',
    description: 'Submit FPS/EPS for payroll',
    frequency: 'monthly',
    deadlineRule: 'On or before payment date',
    formReference: 'FPS/EPS',
  },

  // ICO
  DATA_PROTECTION_FEE: {
    regulator: 'ico',
    regulationName: 'Data Protection Fee',
    regulationReference: 'Data Protection Act 2018',
    jurisdiction: 'uk',
    category: 'gdpr',
    description: 'Pay annual data protection fee to ICO',
    frequency: 'annual',
    deadlineRule: 'Annual renewal date',
  },
  DATA_BREACH_NOTIFICATION: {
    regulator: 'ico',
    regulationName: 'Data Breach Notification',
    regulationReference: 'UK GDPR Article 33',
    jurisdiction: 'uk',
    category: 'data_breach',
    description: 'Notify ICO of personal data breach',
    frequency: 'event_driven',
    deadlineRule: '72 hours after becoming aware',
  },
} as const;
