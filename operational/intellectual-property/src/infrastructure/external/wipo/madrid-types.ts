/**
 * WIPO Madrid Monitor Type Definitions
 *
 * Type definitions for the Madrid Protocol international trademark
 * registration system managed by WIPO.
 *
 * @module infrastructure/external/wipo
 */

// =============================================================================
// Core Madrid Registration Types
// =============================================================================

/**
 * Status of an international registration under the Madrid Protocol.
 */
export type InternationalRegistrationStatus =
  | 'pending'      // Application submitted, awaiting WIPO registration
  | 'registered'   // WIPO has registered the mark
  | 'renewed'      // Successfully renewed
  | 'cancelled'    // Cancelled (e.g., due to central attack)
  | 'expired'      // Registration has expired
  | 'transformed'; // Converted to national applications after central attack

/**
 * Status of a designation (protection request) in a specific country.
 */
export type DesignationStatus =
  | 'pending'           // Awaiting examination by national office
  | 'under_examination' // Being examined by national office
  | 'provisionally_refused' // Office action received, response needed
  | 'accepted'          // Protection granted
  | 'refused'           // Final refusal, no further recourse
  | 'withdrawn'         // Applicant withdrew designation
  | 'protected'         // Protection in force
  | 'ceased'            // Protection ceased (non-renewal, etc.)
  | 'expired';          // Protection expired

/**
 * Reason for refusal of a designation.
 */
export type RefusalReason =
  | 'absolute_grounds'     // Inherent issues (descriptive, generic, etc.)
  | 'relative_grounds'     // Conflict with prior rights
  | 'formal_deficiency'    // Missing documents, fees, etc.
  | 'bad_faith'            // Bad faith filing
  | 'public_policy'        // Against public policy or morality
  | 'deceptive'            // Deceptive as to nature/quality/origin
  | 'other';

/**
 * Priority claim for Paris Convention priority.
 */
export interface PriorityClaim {
  country: string;
  applicationNumber: string;
  filingDate: Date;
}

/**
 * Nice Classification for goods/services.
 */
export interface MadridNiceClass {
  classNumber: number;
  goodsServices: string;
  limitedInCountries?: string[]; // Countries where class is limited
}

/**
 * Designation to a specific Contracting Party (country/region).
 */
export interface CountryDesignation {
  /** ISO country code or regional code (e.g., 'EM' for EU) */
  countryCode: string;
  /** Country/region name */
  countryName: string;
  /** Date designation was made */
  designationDate: Date;
  /** Current status */
  status: DesignationStatus;
  /** Date of status change */
  statusDate: Date;
  /** Date protection was granted (if accepted) */
  protectionDate?: Date;
  /** Date of final refusal (if refused) */
  refusalDate?: Date;
  /** Reason for refusal */
  refusalReason?: RefusalReason;
  /** Office action response deadline */
  responseDeadline?: Date;
  /** Nice classes protected in this country */
  classesProtected: number[];
  /** Classes that were refused */
  classesRefused?: number[];
  /** Local registration number (some countries assign one) */
  localRegistrationNumber?: string;
  /** Whether an appeal is pending */
  appealPending: boolean;
  /** Appeal deadline if refusal is appealable */
  appealDeadline?: Date;
  /** Notes from WIPO */
  notes?: string;
}

/**
 * Central attack notification when basic mark is cancelled.
 */
export interface CentralAttackNotification {
  /** Notification ID from WIPO */
  notificationId: string;
  /** International registration number affected */
  internationalRegistrationNumber: string;
  /** Date WIPO received notification of basic mark ceasing */
  notificationDate: Date;
  /** Nature of the attack */
  attackType: 'cancellation' | 'invalidation' | 'expiration' | 'abandonment' | 'restriction';
  /** Office of origin that notified WIPO */
  officeOfOrigin: string;
  /** Date the basic mark ceased to have effect */
  ceasedDate: Date;
  /** Nice classes affected */
  classesAffected: number[];
  /** All classes or just some */
  fullCancellation: boolean;
  /** Deadline to file transformation requests (3 months from notification) */
  transformationDeadline: Date;
  /** Countries where transformation may be filed */
  countriesForTransformation: string[];
  /** Severity level for alerting */
  severity: 'critical';
  /** Notes */
  notes?: string;
}

/**
 * Renewal status for a Madrid registration.
 */
export interface MadridRenewalStatus {
  /** International registration number */
  internationalRegistrationNumber: string;
  /** Current expiration date */
  currentExpirationDate: Date;
  /** Next renewal due date */
  renewalDueDate: Date;
  /** Window opens (6 months before due) */
  renewalWindowOpens: Date;
  /** Grace period deadline (6 months after due) */
  graceDeadline: Date;
  /** Whether currently in grace period */
  inGracePeriod: boolean;
  /** Estimated renewal fee (CHF) */
  estimatedFee: number;
  /** Fee includes all designated countries */
  designationCount: number;
  /** Whether renewal has been paid */
  renewalPaid: boolean;
  /** Payment date if paid */
  paymentDate?: Date;
  /** Receipt number if paid */
  receiptNumber?: string;
}

/**
 * International registration under the Madrid Protocol.
 */
export interface InternationalRegistration {
  /** International registration number (e.g., 'IR1234567') */
  internationalRegistrationNumber: string;
  /** Internal trademark ID reference */
  trademarkId?: string;
  /** Basic application/registration number in office of origin */
  basicMarkReference: string;
  /** Office of origin (e.g., 'US', 'EM') */
  officeOfOrigin: string;
  /** Holder (owner) name */
  holderName: string;
  /** Holder address */
  holderAddress: string;
  /** Filing date at WIPO */
  filingDate: Date;
  /** Registration date at WIPO */
  registrationDate?: Date;
  /** Current expiration date */
  expirationDate?: Date;
  /** Status */
  status: InternationalRegistrationStatus;
  /** The mark (word element) */
  mark: string;
  /** Mark type */
  markType: 'word' | 'figurative' | 'combined' | '3d' | 'sound' | 'color' | 'hologram' | 'motion' | 'position' | 'pattern' | 'other';
  /** Vienna codes for figurative elements */
  viennaCodes?: string[];
  /** Nice classes with goods/services */
  niceClasses: MadridNiceClass[];
  /** Priority claims */
  priorityClaims?: PriorityClaim[];
  /** Country designations */
  designations: CountryDesignation[];
  /** Central attack period end date (5 years from registration) */
  centralAttackPeriodEnds?: Date;
  /** Whether still in dependency period */
  inDependencyPeriod: boolean;
  /** Central attack notification if any */
  centralAttackNotification?: CentralAttackNotification;
  /** Renewal status */
  renewalStatus?: MadridRenewalStatus;
  /** Last updated from WIPO */
  lastSyncedAt: Date;
  /** WIPO Madrid Monitor URL */
  wipoUrl?: string;
}

// =============================================================================
// WIPO API Response Types
// =============================================================================

/**
 * Search result from WIPO Madrid Monitor API.
 */
export interface WIPOSearchResult {
  /** Total results matching query */
  totalCount: number;
  /** Results returned in this response */
  results: WIPOSearchResultItem[];
  /** Pagination offset */
  offset: number;
  /** Page size */
  limit: number;
  /** Whether more results available */
  hasMore: boolean;
}

/**
 * Individual search result item.
 */
export interface WIPOSearchResultItem {
  internationalRegistrationNumber: string;
  mark: string;
  holderName: string;
  officeOfOrigin: string;
  registrationDate: string;
  expirationDate: string;
  status: string;
  niceClasses: number[];
  designationCount: number;
}

/**
 * WIPO API error response.
 */
export interface WIPOAPIError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
}

/**
 * WIPO API raw designation data.
 */
export interface WIPODesignationData {
  countryCode: string;
  countryName: string;
  designationDate: string;
  status: string;
  statusDate: string;
  protectionDate?: string;
  refusalDate?: string;
  refusalReasons?: string[];
  responseDeadline?: string;
  classes: number[];
  refusedClasses?: number[];
  localRegistrationNumber?: string;
  appealStatus?: string;
  appealDeadline?: string;
  notes?: string;
}

/**
 * WIPO API raw registration data.
 */
export interface WIPORegistrationData {
  internationalRegistrationNumber: string;
  basicMarkReference: string;
  officeOfOrigin: string;
  holderName: string;
  holderAddress: string;
  filingDate: string;
  registrationDate?: string;
  expirationDate?: string;
  status: string;
  mark: string;
  markType: string;
  viennaCodes?: string[];
  niceClasses: Array<{
    classNumber: number;
    goodsServices: string;
    limitations?: Array<{
      country: string;
      text: string;
    }>;
  }>;
  priorityClaims?: Array<{
    country: string;
    applicationNumber: string;
    filingDate: string;
  }>;
  designations: WIPODesignationData[];
  centralAttackPeriodEnds?: string;
  centralAttackNotification?: {
    notificationId: string;
    notificationDate: string;
    attackType: string;
    ceasedDate: string;
    classesAffected: number[];
    fullCancellation: boolean;
    transformationDeadline: string;
  };
  renewalStatus?: {
    dueDate: string;
    paid: boolean;
    paymentDate?: string;
    receiptNumber?: string;
  };
  lastModified: string;
}

// =============================================================================
// Sync Configuration Types
// =============================================================================

/**
 * Configuration for the Madrid sync service.
 */
export interface MadridSyncConfig {
  /** WIPO API base URL */
  apiBaseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** API secret for authentication */
  apiSecret?: string;
  /** Request timeout in ms */
  timeout: number;
  /** Polling interval in minutes */
  pollingIntervalMinutes: number;
  /** Max registrations to sync per run */
  batchSize: number;
  /** Retry attempts for failed requests */
  retryAttempts: number;
  /** Retry delay in ms */
  retryDelayMs: number;
  /** Whether to enable detailed logging */
  debug: boolean;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Sync run ID */
  syncId: string;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt: Date;
  /** Registrations checked */
  registrationsChecked: number;
  /** Registrations with updates */
  registrationsUpdated: number;
  /** New designations detected */
  newDesignations: number;
  /** Status changes detected */
  statusChanges: number;
  /** Central attacks detected */
  centralAttacksDetected: number;
  /** Renewal alerts generated */
  renewalAlerts: number;
  /** Errors encountered */
  errors: SyncError[];
  /** Whether sync completed successfully */
  success: boolean;
}

/**
 * Error during sync.
 */
export interface SyncError {
  registrationNumber?: string;
  errorCode: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

// =============================================================================
// Event Types for Domain Event Mapping
// =============================================================================

/**
 * Types of Madrid events that map to domain events.
 */
export type MadridEventType =
  | 'designation_accepted'
  | 'designation_refused'
  | 'designation_provisionally_refused'
  | 'central_attack_notified'
  | 'renewal_due'
  | 'renewal_overdue'
  | 'registration_status_changed'
  | 'transformation_deadline_approaching';

/**
 * Madrid event for domain event mapping.
 */
export interface MadridEvent {
  type: MadridEventType;
  internationalRegistrationNumber: string;
  trademarkId?: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}
