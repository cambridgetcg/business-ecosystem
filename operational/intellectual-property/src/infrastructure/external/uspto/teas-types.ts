/**
 * USPTO TEAS (Trademark Electronic Application System) Type Definitions
 *
 * Types for USPTO Trademark Status & Document Retrieval (TSDR) system integration.
 * Aligned with USPTO's data formats and API responses.
 *
 * @module infrastructure/external/uspto
 */

/**
 * Trademark application status codes as used by USPTO.
 */
export type USPTOApplicationStatus =
  | 'NEW_APPLICATION'
  | 'NON_FINAL_ACTION_MAILED'
  | 'NON_FINAL_ACTION_PENDING'
  | 'FINAL_REFUSAL_MAILED'
  | 'FINAL_REFUSAL_PENDING'
  | 'APPROVED_FOR_PUBLICATION'
  | 'PUBLISHED_FOR_OPPOSITION'
  | 'OPPOSITION_PENDING'
  | 'OPPOSITION_DISMISSED'
  | 'REGISTERED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ABANDONED';

/**
 * USPTO trademark mark type.
 */
export type USPTOMarkType =
  | 'STANDARD_CHARACTER'
  | 'SPECIAL_FORM'
  | 'SOUND'
  | 'SCENT'
  | 'MOTION'
  | 'POSITION'
  | 'TRADE_DRESS';

/**
 * USPTO prosecution history action type.
 */
export type USPTOActionType =
  | 'FILING_RECEIPT'
  | 'EXAMINING_ATTORNEY_ASSIGNED'
  | 'NON_FINAL_OFFICE_ACTION'
  | 'FINAL_OFFICE_ACTION'
  | 'SUSPENSION_LETTER'
  | 'NOTICE_OF_PUBLICATION'
  | 'NOTICE_OF_ALLOWANCE'
  | 'REGISTRATION_CERTIFICATE'
  | 'SECTION_8_REMINDER'
  | 'SECTION_15_FILING'
  | 'RENEWAL_REMINDER'
  | 'CANCELLATION_NOTICE'
  | 'LETTER_OF_PROTEST'
  | 'OPPOSITION_FILED'
  | 'APPLICANT_RESPONSE'
  | 'REQUEST_FOR_EXTENSION'
  | 'PRIORITY_ACTION'
  | 'OTHER';

/**
 * Office action issued by USPTO.
 */
export interface OfficeAction {
  /** Action type */
  actionType: USPTOActionType;
  /** Date action was mailed */
  mailedDate: Date;
  /** Response deadline (if applicable) */
  responseDeadline: Date | undefined;
  /** Whether the action has been responded to */
  responded: boolean;
  /** Response date (if responded) */
  responseDate: Date | undefined;
  /** USPTO action code */
  actionCode: string;
  /** Description of the action */
  description: string;
  /** Document URL for downloading (if available) */
  documentUrl: string | undefined;
  /** Whether this action is final (e.g., final refusal) */
  isFinal: boolean;
  /** Whether response is required */
  responseRequired: boolean;
}

/**
 * Nice Classification as returned by USPTO.
 */
export interface USPTOClassification {
  /** International class number (1-45) */
  classNumber: number;
  /** Class heading/description */
  classHeading: string;
  /** Goods or services description */
  goodsServicesDescription: string;
  /** Filing basis (1a, 1b, 44d, 44e, 66a) */
  filingBasis: string;
  /** Status for this class */
  status: 'ACTIVE' | 'DELETED' | 'TRANSFERRED';
  /** First use date (if 1a basis) */
  firstUseDate: Date | undefined;
  /** First use in commerce date (if 1a basis) */
  firstUseInCommerceDate: Date | undefined;
}

/**
 * Owner/correspondent information.
 */
export interface USPTOCorrespondent {
  /** Name of the owner/correspondent */
  name: string;
  /** Legal entity type */
  entityType: 'INDIVIDUAL' | 'CORPORATION' | 'LLC' | 'PARTNERSHIP' | 'TRUST' | 'OTHER';
  /** State/country of incorporation or citizenship */
  stateCountry: string;
  /** Address line 1 */
  address1: string;
  /** Address line 2 */
  address2: string | undefined;
  /** City */
  city: string;
  /** State/province */
  state: string | undefined;
  /** Postal code */
  postalCode: string | undefined;
  /** Country code */
  country: string;
  /** Email address */
  email: string | undefined;
  /** Phone number */
  phone: string | undefined;
  /** DBA (doing business as) name */
  dbaName: string | undefined;
}

/**
 * Attorney of record information.
 */
export interface USPTOAttorney {
  /** Attorney name */
  name: string;
  /** Bar membership (state) */
  barMembership: string;
  /** Law firm name */
  firmName: string | undefined;
  /** Docket number */
  docketNumber: string | undefined;
  /** Email address */
  email: string | undefined;
  /** Phone number */
  phone: string | undefined;
  /** Bar registration number */
  registrationNumber: string | undefined;
}

/**
 * Publication details for marks published for opposition.
 */
export interface PublicationDetails {
  /** Publication date */
  publicationDate: Date;
  /** Official Gazette issue number */
  gazetteIssue: string;
  /** Page number in the Gazette */
  gazettePage: number | undefined;
  /** Opposition period start date */
  oppositionPeriodStart: Date;
  /** Opposition period end date (30 days by default) */
  oppositionPeriodEnd: Date;
  /** Whether the opposition period has been extended */
  oppositionExtended: boolean;
  /** Extended opposition deadline (if extended) */
  extendedDeadline: Date | undefined;
}

/**
 * Maintenance/affidavit filing details.
 */
export interface MaintenanceFiling {
  /** Filing type (Section 8, 9, 15, etc.) */
  filingType: 'SECTION_8' | 'SECTION_9' | 'SECTION_15' | 'SECTION_8_15_COMBINED' | 'SECTION_71';
  /** Due date */
  dueDate: Date;
  /** Grace period end date */
  gracePeriodEnd: Date;
  /** Whether filing has been submitted */
  filed: boolean;
  /** Filing date (if filed) */
  filingDate: Date | undefined;
  /** Acceptance date (if accepted) */
  acceptanceDate: Date | undefined;
  /** Status of the filing */
  status: 'NOT_DUE' | 'DUE' | 'GRACE_PERIOD' | 'FILED' | 'ACCEPTED' | 'REJECTED' | 'MISSED';
}

/**
 * Complete trademark application status from USPTO.
 */
export interface TrademarkApplicationStatus {
  /** Serial number (application number) */
  serialNumber: string;
  /** Registration number (if registered) */
  registrationNumber: string | undefined;
  /** Mark literal (word mark text) */
  markLiteral: string;
  /** Mark drawing type */
  markType: USPTOMarkType;
  /** Current status */
  status: USPTOApplicationStatus;
  /** Status date (when status changed) */
  statusDate: Date;
  /** Filing date */
  filingDate: Date;
  /** Registration date (if registered) */
  registrationDate: Date | undefined;
  /** Owner information */
  owner: USPTOCorrespondent;
  /** Attorney of record */
  attorney: USPTOAttorney | undefined;
  /** Nice classifications */
  classifications: USPTOClassification[];
  /** Prosecution history */
  prosecutionHistory: OfficeAction[];
  /** Publication details (if published) */
  publication: PublicationDetails | undefined;
  /** Upcoming maintenance filings */
  maintenanceFilings: MaintenanceFiling[];
  /** Mark description (for design marks) */
  markDescription: string | undefined;
  /** Design search codes */
  designCodes: string[];
  /** Disclaimer text */
  disclaimer: string | undefined;
  /** Drawing URL (for design marks) */
  drawingUrl: string | undefined;
  /** Specimen URL */
  specimenUrl: string | undefined;
  /** International registration number (if Madrid Protocol) */
  internationalRegistrationNumber: string | undefined;
  /** Priority date (if claiming priority) */
  priorityDate: Date | undefined;
  /** Last checked from USPTO */
  lastSyncedAt: Date;
}

/**
 * Complete trademark registration record.
 */
export interface TrademarkRegistration {
  /** Registration number */
  registrationNumber: string;
  /** Serial number (application number) */
  serialNumber: string;
  /** Mark literal (word mark text) */
  markLiteral: string;
  /** Mark type */
  markType: USPTOMarkType;
  /** Registration date */
  registrationDate: Date;
  /** Current renewal date */
  renewalDate: Date;
  /** Expiration date */
  expirationDate: Date;
  /** Owner information */
  owner: USPTOCorrespondent;
  /** Nice classifications */
  classifications: USPTOClassification[];
  /** Maintenance filings */
  maintenanceFilings: MaintenanceFiling[];
  /** Whether Section 15 (incontestability) has been achieved */
  incontestable: boolean;
  /** Section 15 filing date */
  section15FilingDate: Date | undefined;
  /** Mark description */
  markDescription: string | undefined;
  /** Disclaimer text */
  disclaimer: string | undefined;
  /** Drawing URL */
  drawingUrl: string | undefined;
  /** Last synced from USPTO */
  lastSyncedAt: Date;
}

/**
 * USPTO search result for trademark searches.
 */
export interface USPTOSearchResult {
  /** Serial number */
  serialNumber: string;
  /** Registration number (if registered) */
  registrationNumber: string | undefined;
  /** Mark literal */
  markLiteral: string;
  /** Mark type */
  markType: USPTOMarkType;
  /** Current status */
  status: USPTOApplicationStatus;
  /** Owner name */
  ownerName: string;
  /** Filing date */
  filingDate: Date;
  /** Registration date */
  registrationDate: Date | undefined;
  /** Primary class number */
  primaryClass: number;
  /** All class numbers */
  classes: number[];
  /** Relevance score (if from text search) */
  relevanceScore: number | undefined;
}

/**
 * USPTO search query parameters.
 */
export interface USPTOSearchQuery {
  /** Text search (mark literal) */
  textQuery?: string | undefined;
  /** Serial number search */
  serialNumber?: string | undefined;
  /** Registration number search */
  registrationNumber?: string | undefined;
  /** Owner name search */
  ownerName?: string | undefined;
  /** Class numbers to filter by */
  classes?: number[] | undefined;
  /** Status filter */
  status?: USPTOApplicationStatus[] | undefined;
  /** Filing date range start */
  filingDateFrom?: Date | undefined;
  /** Filing date range end */
  filingDateTo?: Date | undefined;
  /** Maximum results to return */
  limit?: number | undefined;
  /** Offset for pagination */
  offset?: number | undefined;
}

/**
 * USPTO API response wrapper.
 */
export interface USPTOApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data: T | undefined;
  /** Error message (if failed) */
  error: string | undefined;
  /** Error code (if failed) */
  errorCode: string | undefined;
  /** Request ID for debugging */
  requestId: string;
  /** Response timestamp */
  timestamp: Date;
  /** Rate limit remaining */
  rateLimitRemaining: number | undefined;
  /** Rate limit reset time */
  rateLimitReset: Date | undefined;
}

/**
 * Status change detection result.
 */
export interface StatusChangeDetection {
  /** Serial number */
  serialNumber: string;
  /** Previous status */
  previousStatus: USPTOApplicationStatus;
  /** New status */
  newStatus: USPTOApplicationStatus;
  /** Change detected at */
  detectedAt: Date;
  /** Status change date (from USPTO) */
  statusDate: Date;
  /** New office actions (if any) */
  newOfficeActions: OfficeAction[];
  /** New deadlines created (if any) */
  newDeadlines: Array<{
    type: string;
    dueDate: Date;
    description: string;
  }>;
}

/**
 * Sync operation result.
 */
export interface SyncResult {
  /** Trademarks synced */
  syncedCount: number;
  /** Status changes detected */
  changesDetected: StatusChangeDetection[];
  /** Errors encountered */
  errors: Array<{
    serialNumber: string;
    error: string;
  }>;
  /** Sync started at */
  startedAt: Date;
  /** Sync completed at */
  completedAt: Date;
  /** Next sync scheduled for */
  nextSyncAt: Date;
}

/**
 * USPTO webhook event (if push notifications are available).
 */
export interface USPTOWebhookEvent {
  /** Event type */
  eventType: 'STATUS_CHANGE' | 'OFFICE_ACTION' | 'PUBLICATION' | 'REGISTRATION' | 'CANCELLATION';
  /** Serial number */
  serialNumber: string;
  /** Registration number (if applicable) */
  registrationNumber: string | undefined;
  /** Event timestamp */
  timestamp: Date;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Signature for verification */
  signature: string;
}
