/**
 * Processing Activity Domain Model
 * GDPR Article 30 - Records of Processing Activities
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ActivityStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'ARCHIVED';

export type LawfulBasis =
  | 'CONSENT'
  | 'CONTRACT'
  | 'LEGAL_OBLIGATION'
  | 'VITAL_INTEREST'
  | 'PUBLIC_TASK'
  | 'LEGITIMATE_INTEREST';

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

export type SpecialCategory =
  | 'RACIAL_ETHNIC_ORIGIN'
  | 'POLITICAL_OPINIONS'
  | 'RELIGIOUS_BELIEFS'
  | 'TRADE_UNION_MEMBERSHIP'
  | 'GENETIC_DATA'
  | 'BIOMETRIC_DATA'
  | 'HEALTH_DATA'
  | 'SEX_LIFE'
  | 'SEXUAL_ORIENTATION'
  | 'CRIMINAL_CONVICTIONS';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface ProcessingActivity {
  id: string;
  entityId: string;

  // Identification
  name: string;
  description: string;

  // Purpose and legal basis (Art. 30(1)(b))
  purposes: string[];
  lawfulBasis: LawfulBasis[];
  legitimateInterest?: string | undefined;

  // Data categories (Art. 30(1)(c))
  dataCategories: DataCategory[];
  specialCategories: SpecialCategory[];

  // Data subjects (Art. 30(1)(c))
  subjectCategories: string[];

  // Recipients (Art. 30(1)(d))
  recipients: string[];
  thirdCountryTransfers: string[];
  transferSafeguards?: string | undefined;

  // Retention (Art. 30(1)(f))
  retentionPeriod?: string | undefined;
  retentionCriteria?: string | undefined;

  // Security measures (Art. 30(1)(g))
  technicalMeasures: string[];
  organizationalMeasures: string[];

  // DPIA link
  dpiaRequired: boolean;
  dpiaReference?: string | undefined;

  // Status and review
  status: ActivityStatus;
  lastReviewedAt?: Date | undefined;
  nextReviewDue?: Date | undefined;

  // Responsibility
  controller: string;
  processor?: string | undefined;
  dpo?: string | undefined;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateActivityInput {
  entityId: string;
  name: string;
  description: string;
  purposes: string[];
  lawfulBasis: LawfulBasis[];
  legitimateInterest?: string | undefined;
  dataCategories: DataCategory[];
  specialCategories?: SpecialCategory[] | undefined;
  subjectCategories: string[];
  controller: string;
  createdBy: string;
}

export interface UpdateActivityInput {
  name?: string | undefined;
  description?: string | undefined;
  purposes?: string[] | undefined;
  lawfulBasis?: LawfulBasis[] | undefined;
  legitimateInterest?: string | undefined;
  dataCategories?: DataCategory[] | undefined;
  specialCategories?: SpecialCategory[] | undefined;
  subjectCategories?: string[] | undefined;
  recipients?: string[] | undefined;
  thirdCountryTransfers?: string[] | undefined;
  transferSafeguards?: string | undefined;
  retentionPeriod?: string | undefined;
  retentionCriteria?: string | undefined;
  technicalMeasures?: string[] | undefined;
  organizationalMeasures?: string[] | undefined;
  dpiaRequired?: boolean | undefined;
  dpiaReference?: string | undefined;
  processor?: string | undefined;
  dpo?: string | undefined;
}

export interface ActivityQueryFilter {
  entityId?: string | undefined;
  status?: ActivityStatus | undefined;
  dpiaRequired?: boolean | undefined;
  hasSpecialCategories?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

/**
 * Check if activity processes special category data (Art. 9)
 */
export function hasSpecialCategoryData(activity: ProcessingActivity): boolean {
  return activity.specialCategories.length > 0;
}

/**
 * Check if activity involves third country transfers
 */
export function hasThirdCountryTransfers(activity: ProcessingActivity): boolean {
  return activity.thirdCountryTransfers.length > 0;
}

/**
 * Check if DPIA is likely required based on processing characteristics
 * GDPR Art. 35(3) - DPIA required when:
 * - Systematic and extensive profiling with significant effects
 * - Large scale processing of special categories
 * - Systematic monitoring of publicly accessible area
 */
export function shouldRequireDPIA(activity: ProcessingActivity): boolean {
  // Special category data at scale likely requires DPIA
  if (activity.specialCategories.length > 0) {
    return true;
  }

  // Large-scale profiling
  if (
    activity.dataCategories.includes('BEHAVIORAL') &&
    activity.purposes.some((p) => p.toLowerCase().includes('profil'))
  ) {
    return true;
  }

  // Third country transfers without safeguards
  if (activity.thirdCountryTransfers.length > 0 && !activity.transferSafeguards) {
    return true;
  }

  return false;
}

/**
 * Check if activity is due for review
 */
export function isReviewDue(activity: ProcessingActivity): boolean {
  if (!activity.nextReviewDue) return false;
  return new Date() >= activity.nextReviewDue;
}

/**
 * Calculate next review date (default: 1 year from last review or creation)
 */
export function calculateNextReviewDate(fromDate: Date = new Date()): Date {
  const nextReview = new Date(fromDate);
  nextReview.setFullYear(nextReview.getFullYear() + 1);
  return nextReview;
}

/**
 * Check if activity can be archived
 */
export function canArchive(activity: ProcessingActivity): boolean {
  return activity.status === 'SUSPENDED' || activity.status === 'UNDER_REVIEW';
}

/**
 * Validate lawful basis for special categories (Art. 9(2))
 * Special categories require explicit consent or specific exemptions
 */
export function validateSpecialCategoryBasis(activity: ProcessingActivity): {
  valid: boolean;
  reason?: string;
} {
  if (activity.specialCategories.length === 0) {
    return { valid: true };
  }

  // For special categories, consent must be explicit
  if (activity.lawfulBasis.includes('CONSENT')) {
    return { valid: true };
  }

  // Legal obligation and vital interest can apply
  if (
    activity.lawfulBasis.includes('LEGAL_OBLIGATION') ||
    activity.lawfulBasis.includes('VITAL_INTEREST')
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: 'Special category data requires explicit consent or specific legal exemption (Art. 9(2))',
  };
}
