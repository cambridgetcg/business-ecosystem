/**
 * USPTO PAIR (Patent Application Information Retrieval) Type Definitions
 *
 * Types for interacting with USPTO's Patent Center and PAIR systems.
 * Represents patent application status, prosecution history, and maintenance fees.
 *
 * @module infrastructure/external/uspto
 */

/**
 * Patent application status in the USPTO system.
 */
export type PatentApplicationStatus =
  | 'pending'      // Application filed, under examination
  | 'published'    // Application published (18 months from filing)
  | 'granted'      // Patent issued
  | 'abandoned';   // Application abandoned

/**
 * Entity size for fee calculations.
 */
export type EntitySize = 'micro' | 'small' | 'large';

/**
 * Office action types from the USPTO.
 */
export type OfficeActionType =
  | 'requirement'  // Restriction/election requirement
  | 'non_final'    // Non-final rejection
  | 'final'        // Final rejection
  | 'advisory'     // Advisory action
  | 'allowance'    // Notice of allowance
  | 'examiner_interview' // Examiner interview summary
  | 'information_disclosure' // IDS acknowledgment
  | 'other';

/**
 * Response status for office actions.
 */
export type ResponseStatus = 'pending' | 'filed' | 'overdue' | 'not_required';

/**
 * Maintenance fee window (years after grant).
 */
export type MaintenanceFeeWindow = '3.5' | '7.5' | '11.5';

/**
 * Maintenance fee payment status.
 */
export type MaintenanceFeePaymentStatus =
  | 'not_yet_due'   // Window not yet open
  | 'window_open'   // Normal payment window (6 months before due)
  | 'due'           // Due date reached
  | 'grace_period'  // In 6-month grace period (surcharge applies)
  | 'paid'          // Successfully paid
  | 'expired';      // Missed, patent lapsed

/**
 * Prosecution event types tracked in PAIR.
 */
export type ProsecutionEventType =
  | 'filing'
  | 'publication'
  | 'office_action_mailed'
  | 'response_filed'
  | 'amendment_filed'
  | 'interview_conducted'
  | 'ids_filed'
  | 'petition_filed'
  | 'petition_decided'
  | 'notice_of_allowance'
  | 'issue_fee_paid'
  | 'patent_issued'
  | 'abandonment'
  | 'revival'
  | 'appeal_filed'
  | 'ptab_decision'
  | 'terminal_disclaimer'
  | 'continuation_filed'
  | 'divisional_filed';

/**
 * Patent application summary from PAIR.
 */
export interface PatentApplicationSummary {
  applicationNumber: string;
  filingDate: Date;
  title: string;
  status: PatentApplicationStatus;
  examinerName?: string;
  groupArtUnit?: string;
  inventors: string[];
  assignee?: string;
  entitySize: EntitySize;
  patentNumber?: string;       // If granted
  grantDate?: Date;            // If granted
  publicationNumber?: string;  // If published
  publicationDate?: Date;      // If published
  expirationDate?: Date;       // If granted (calculated)
  lastUpdated: Date;
}

/**
 * Office action details from prosecution history.
 */
export interface OfficeAction {
  id: string;
  applicationNumber: string;
  actionType: OfficeActionType;
  mailedDate: Date;
  responseDeadline: Date;
  responseStatus: ResponseStatus;
  responseFiledDate?: Date;
  examinerName: string;
  groupArtUnit: string;
  summary: string;
  rejectedClaims?: number[];
  objectedClaims?: number[];
  allowedClaims?: number[];
  citedReferences?: CitedReference[];
  documentUrl?: string;
}

/**
 * Reference cited in an office action.
 */
export interface CitedReference {
  type: 'patent' | 'publication' | 'npl';  // Non-patent literature
  citation: string;
  relevantClaims: number[];
  relevanceType: '102' | '103' | '112' | 'other';  // 35 USC section
}

/**
 * Prosecution history event.
 */
export interface ProsecutionEvent {
  eventType: ProsecutionEventType;
  eventDate: Date;
  description: string;
  documentCode?: string;
  documentDescription?: string;
  documentUrl?: string;
  pages?: number;
}

/**
 * Complete prosecution history for an application.
 */
export interface PatentProsecutionHistory {
  applicationNumber: string;
  title: string;
  status: PatentApplicationStatus;
  filingDate: Date;
  events: ProsecutionEvent[];
  officeActions: OfficeAction[];
  pendingOfficeAction?: OfficeAction;
  lastActivityDate: Date;
  estimatedAllowanceDate?: Date;
  patentNumber?: string;
  grantDate?: Date;
}

/**
 * Patent grant details.
 */
export interface PatentGrant {
  patentNumber: string;
  applicationNumber: string;
  title: string;
  abstract: string;
  grantDate: Date;
  filingDate: Date;
  priorityDate?: Date;
  expirationDate: Date;
  inventors: PatentInventor[];
  assignee?: PatentAssignee;
  claims: PatentGrantClaim[];
  classifications: PatentClassification[];
  citations: PatentCitation[];
  entitySize: EntitySize;
}

/**
 * Inventor information from patent grant.
 */
export interface PatentInventor {
  name: string;
  city: string;
  state?: string;
  country: string;
}

/**
 * Assignee information.
 */
export interface PatentAssignee {
  name: string;
  city: string;
  state?: string;
  country: string;
  assignmentDate?: Date;
}

/**
 * Patent claim from grant.
 */
export interface PatentGrantClaim {
  claimNumber: number;
  text: string;
  isIndependent: boolean;
  dependsOn?: number[];
}

/**
 * Patent classification (CPC/IPC).
 */
export interface PatentClassification {
  system: 'CPC' | 'IPC';
  section: string;
  class: string;
  subclass: string;
  mainGroup: string;
  subGroup: string;
  fullSymbol: string;
}

/**
 * Patent citation (references cited).
 */
export interface PatentCitation {
  type: 'us_patent' | 'us_application' | 'foreign' | 'npl';
  citation: string;
  citedBy: 'examiner' | 'applicant';
}

/**
 * Maintenance fee status for a granted patent.
 */
export interface MaintenanceFeeStatus {
  patentNumber: string;
  applicationNumber: string;
  grantDate: Date;
  entitySize: EntitySize;
  fees: MaintenanceFee[];
  nextDue?: MaintenanceFee;
  currentStatus: 'active' | 'lapsed' | 'expired';
}

/**
 * Individual maintenance fee details.
 */
export interface MaintenanceFee {
  feeWindow: MaintenanceFeeWindow;
  windowOpensDate: Date;
  dueDate: Date;
  gracePeriodEnds: Date;
  status: MaintenanceFeePaymentStatus;
  baseFee: MaintenanceFeeAmount;
  surcharge?: MaintenanceFeeAmount;
  paidDate?: Date;
  paidAmount?: number;
  receiptNumber?: string;
}

/**
 * Fee amount by entity size.
 */
export interface MaintenanceFeeAmount {
  micro: number;
  small: number;
  large: number;
}

/**
 * Search result from PAIR.
 */
export interface PairSearchResult {
  totalCount: number;
  applications: PatentApplicationSummary[];
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Search filters for PAIR queries.
 */
export interface PairSearchFilters {
  applicationNumber?: string;
  patentNumber?: string;
  title?: string;
  inventorName?: string;
  assigneeName?: string;
  filingDateFrom?: Date;
  filingDateTo?: Date;
  status?: PatentApplicationStatus[];
  groupArtUnit?: string;
  limit?: number;
  offset?: number;
}

/**
 * USPTO PAIR API error codes.
 */
export type PairErrorCode =
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INVALID_APPLICATION_NUMBER'
  | 'INVALID_PATENT_NUMBER'
  | 'SERVICE_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Error from PAIR API.
 */
export interface PairApiError {
  code: PairErrorCode;
  message: string;
  retryAfter?: number;  // Seconds until retry is allowed
}

/**
 * Status change detected during sync.
 */
export interface StatusChangeDetected {
  applicationNumber: string;
  patentId: string;  // Internal system ID
  previousStatus: PatentApplicationStatus;
  newStatus: PatentApplicationStatus;
  changeDate: Date;
  details: string;
}

/**
 * Office action received during sync.
 */
export interface OfficeActionDetected {
  applicationNumber: string;
  patentId: string;
  officeAction: OfficeAction;
}

/**
 * Grant detected during sync.
 */
export interface GrantDetected {
  applicationNumber: string;
  patentId: string;
  grant: PatentGrant;
}

/**
 * Publication detected during sync.
 */
export interface PublicationDetected {
  applicationNumber: string;
  patentId: string;
  publicationNumber: string;
  publicationDate: Date;
}

/**
 * Abandonment detected during sync.
 */
export interface AbandonmentDetected {
  applicationNumber: string;
  patentId: string;
  abandonmentDate: Date;
  reason: string;
  revivable: boolean;
  revivalDeadline?: Date;
}

/**
 * Maintenance fee window opened.
 */
export interface MaintenanceFeeWindowOpened {
  patentNumber: string;
  patentId: string;
  feeWindow: MaintenanceFeeWindow;
  windowOpensDate: Date;
  dueDate: Date;
  gracePeriodEnds: Date;
  feeAmount: MaintenanceFeeAmount;
}

/**
 * Sync result summary.
 */
export interface PairSyncResult {
  syncId: string;
  startTime: Date;
  endTime: Date;
  applicationsChecked: number;
  statusChanges: StatusChangeDetected[];
  officeActionsReceived: OfficeActionDetected[];
  grantsDetected: GrantDetected[];
  publicationsDetected: PublicationDetected[];
  abandonmentsDetected: AbandonmentDetected[];
  maintenanceFeeWindows: MaintenanceFeeWindowOpened[];
  errors: PairApiError[];
}

/**
 * Configuration for USPTO PAIR client.
 */
export interface PairClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;  // milliseconds
  maxRetries: number;
  retryDelayMs: number;
  rateLimitPerMinute: number;
}

/**
 * Default configuration for PAIR client.
 */
export const DEFAULT_PAIR_CONFIG: PairClientConfig = {
  baseUrl: process.env.USPTO_PAIR_BASE_URL ?? 'https://ped.uspto.gov/api/queries',
  apiKey: process.env.USPTO_API_KEY,
  timeout: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  rateLimitPerMinute: 60,
};

/**
 * 2024 USPTO maintenance fee schedule (in USD).
 * Updated annually - these are placeholder values.
 */
export const MAINTENANCE_FEE_SCHEDULE: Record<MaintenanceFeeWindow, MaintenanceFeeAmount> = {
  '3.5': { micro: 400, small: 800, large: 1600 },
  '7.5': { micro: 900, small: 1800, large: 3600 },
  '11.5': { micro: 1850, small: 3700, large: 7400 },
};

/**
 * Surcharge amounts for grace period payments.
 */
export const SURCHARGE_AMOUNTS: MaintenanceFeeAmount = {
  micro: 80,
  small: 160,
  large: 320,
};
