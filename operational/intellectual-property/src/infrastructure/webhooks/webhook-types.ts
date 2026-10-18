/**
 * Webhook Type Definitions
 *
 * Type definitions for patent watch, trademark watch, domain watch,
 * and litigation alert webhooks from external providers.
 *
 * @module infrastructure/webhooks
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported webhook providers.
 */
export type WebhookProvider =
  | 'anaqua'
  | 'clarivate'
  | 'trademarknow'
  | 'markmonitor'
  | 'corsearch'
  | 'brandshelter'
  | 'compumark'
  | 'darts_ip'
  | 'custom';

/**
 * Webhook signature algorithm types.
 */
export type SignatureAlgorithm = 'hmac-sha256' | 'hmac-sha512' | 'rsa-sha256';

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base webhook payload.
 */
export interface BaseWebhookPayload {
  /** Unique event identifier from provider */
  eventId: string;
  /** Provider-specific event type */
  eventType: string;
  /** Timestamp when the event occurred (ISO 8601) */
  timestamp: string;
  /** Provider name */
  provider: WebhookProvider;
  /** Provider's account/subscription identifier */
  accountId?: string;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook processing result.
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  provider: WebhookProvider;
  message?: string;
  error?: string;
  recordsCreated?: number;
  eventsPublished?: number;
}

// ============================================================================
// Patent Watch Alert Types
// ============================================================================

/**
 * Patent watch alert types.
 */
export type PatentWatchAlertType =
  | 'new_filing'
  | 'new_publication'
  | 'new_grant'
  | 'citation_forward'
  | 'citation_backward'
  | 'competitor_filing'
  | 'family_member'
  | 'status_change'
  | 'maintenance_due'
  | 'expiration'
  | 'opposition'
  | 'reexamination'
  | 'assignment'
  | 'license_recorded';

/**
 * Patent information in an alert.
 */
export interface PatentAlertInfo {
  /** Patent number or application number */
  patentNumber: string;
  /** Application number if different */
  applicationNumber?: string;
  /** Patent title */
  title: string;
  /** Abstract or description */
  abstract?: string;
  /** Filing date (ISO 8601) */
  filingDate?: string;
  /** Publication date (ISO 8601) */
  publicationDate?: string;
  /** Grant date (ISO 8601) */
  grantDate?: string;
  /** Expiration date (ISO 8601) */
  expirationDate?: string;
  /** Jurisdiction/Country code */
  jurisdiction: string;
  /** Patent kind code */
  kindCode?: string;
  /** Patent classification codes */
  classifications?: PatentClassification[];
  /** Assignee/Owner information */
  assignee?: AssigneeInfo;
  /** Inventor names */
  inventors?: string[];
  /** Priority claims */
  priorityClaims?: PriorityClaim[];
  /** Related patent family members */
  familyMembers?: string[];
  /** URL to patent document */
  documentUrl?: string;
}

/**
 * Patent classification (IPC, CPC, USPC).
 */
export interface PatentClassification {
  system: 'IPC' | 'CPC' | 'USPC' | 'FI' | 'F-term';
  code: string;
  description?: string;
}

/**
 * Assignee/Owner information.
 */
export interface AssigneeInfo {
  name: string;
  country?: string;
  type?: 'company' | 'individual' | 'government' | 'university' | 'unknown';
  standardizedName?: string;
}

/**
 * Priority claim information.
 */
export interface PriorityClaim {
  applicationNumber: string;
  filingDate: string;
  jurisdiction: string;
}

/**
 * Patent watch alert payload.
 */
export interface PatentWatchAlert extends BaseWebhookPayload {
  alertType: PatentWatchAlertType;
  /** The patent that triggered the alert */
  patent: PatentAlertInfo;
  /** For citation alerts, the citing/cited patent */
  relatedPatent?: PatentAlertInfo;
  /** Watch profile that generated this alert */
  watchProfileId?: string;
  /** Watch profile name */
  watchProfileName?: string;
  /** Keywords that matched */
  matchedKeywords?: string[];
  /** Classification codes that matched */
  matchedClassifications?: string[];
  /** Competitor that matched (for competitor tracking) */
  matchedCompetitor?: string;
  /** Relevance score (0-100) */
  relevanceScore?: number;
  /** Provider-specific alert ID */
  providerAlertId: string;
}

// ============================================================================
// Trademark Watch Alert Types
// ============================================================================

/**
 * Trademark watch alert types.
 */
export type TrademarkWatchAlertType =
  | 'similar_mark_filed'
  | 'similar_mark_published'
  | 'similar_mark_registered'
  | 'opposition_filed'
  | 'opposition_received'
  | 'cancellation_filed'
  | 'cancellation_received'
  | 'renewal_due'
  | 'status_change'
  | 'assignment'
  | 'use_declaration_due'
  | 'intent_to_use'
  | 'domain_registration';

/**
 * Trademark information in an alert.
 */
export interface TrademarkAlertInfo {
  /** Registration/Application number */
  markNumber: string;
  /** Serial number (US) */
  serialNumber?: string;
  /** Mark name/word mark */
  markName: string;
  /** Mark description */
  description?: string;
  /** Mark type */
  markType?: 'word' | 'design' | 'combined' | 'sound' | 'motion' | 'color' | 'other';
  /** Filing date (ISO 8601) */
  filingDate?: string;
  /** Publication date (ISO 8601) */
  publicationDate?: string;
  /** Registration date (ISO 8601) */
  registrationDate?: string;
  /** Expiration date (ISO 8601) */
  expirationDate?: string;
  /** Current status */
  status?: string;
  /** Jurisdiction/Country code */
  jurisdiction: string;
  /** Nice classification classes */
  niceClasses?: number[];
  /** Goods/Services description */
  goodsServices?: GoodsServicesEntry[];
  /** Owner information */
  owner?: AssigneeInfo;
  /** URL to mark image */
  imageUrl?: string;
  /** Vienna classification (design marks) */
  viennaClassification?: string[];
  /** URL to trademark document */
  documentUrl?: string;
}

/**
 * Goods/Services entry.
 */
export interface GoodsServicesEntry {
  class: number;
  description: string;
}

/**
 * Similarity analysis result.
 */
export interface SimilarityAnalysis {
  /** Overall similarity score (0-100) */
  overallScore: number;
  /** Phonetic similarity score */
  phoneticScore?: number;
  /** Visual similarity score */
  visualScore?: number;
  /** Conceptual similarity score */
  conceptualScore?: number;
  /** Class overlap indicator */
  classOverlap: boolean;
  /** Overlapping classes */
  overlappingClasses?: number[];
  /** Analysis notes */
  notes?: string;
}

/**
 * Trademark watch alert payload.
 */
export interface TrademarkWatchAlert extends BaseWebhookPayload {
  alertType: TrademarkWatchAlertType;
  /** The trademark that triggered the alert */
  trademark: TrademarkAlertInfo;
  /** Our monitored mark (for similarity alerts) */
  monitoredMark?: TrademarkAlertInfo;
  /** Similarity analysis */
  similarity?: SimilarityAnalysis;
  /** Watch profile that generated this alert */
  watchProfileId?: string;
  /** Watch profile name */
  watchProfileName?: string;
  /** Opposition/Cancellation deadline if applicable (ISO 8601) */
  deadlineDate?: string;
  /** Provider-specific alert ID */
  providerAlertId: string;
}

// ============================================================================
// Domain Watch Alert Types
// ============================================================================

/**
 * Domain watch alert types.
 */
export type DomainWatchAlertType =
  | 'typosquatting'
  | 'similar_registration'
  | 'zone_file_addition'
  | 'expiration_notice'
  | 'transfer_notice'
  | 'whois_change'
  | 'dns_change'
  | 'content_change'
  | 'brand_abuse';

/**
 * Domain information in an alert.
 */
export interface DomainAlertInfo {
  /** Domain name */
  domainName: string;
  /** Top-level domain */
  tld: string;
  /** Registration date (ISO 8601) */
  registrationDate?: string;
  /** Expiration date (ISO 8601) */
  expirationDate?: string;
  /** Last update date (ISO 8601) */
  lastUpdated?: string;
  /** Registrar name */
  registrar?: string;
  /** Registrant info (may be privacy-protected) */
  registrant?: {
    name?: string;
    organization?: string;
    email?: string;
    country?: string;
  };
  /** Name servers */
  nameServers?: string[];
  /** Domain status flags */
  status?: string[];
  /** Resolved IP addresses */
  ipAddresses?: string[];
  /** Content detected on the domain */
  contentSummary?: string;
  /** Screenshot URL */
  screenshotUrl?: string;
}

/**
 * Domain watch alert payload.
 */
export interface DomainWatchAlert extends BaseWebhookPayload {
  alertType: DomainWatchAlertType;
  /** The domain that triggered the alert */
  domain: DomainAlertInfo;
  /** Our protected domain/brand (for comparison) */
  protectedAsset?: {
    type: 'domain' | 'trademark' | 'brand';
    name: string;
    id?: string;
  };
  /** Similarity score (0-100) */
  similarityScore?: number;
  /** Detection method */
  detectionMethod?: string;
  /** Risk level assessment */
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  /** Recommended action */
  recommendedAction?: string;
  /** Watch profile that generated this alert */
  watchProfileId?: string;
  /** Provider-specific alert ID */
  providerAlertId: string;
}

// ============================================================================
// Litigation Watch Alert Types
// ============================================================================

/**
 * Litigation watch alert types.
 */
export type LitigationAlertType =
  | 'case_filed'
  | 'case_updated'
  | 'motion_filed'
  | 'order_issued'
  | 'judgment'
  | 'appeal_filed'
  | 'settlement'
  | 'trial_date_set'
  | 'claim_construction'
  | 'invalidity_contention'
  | 'ptab_proceeding'
  | 'itc_investigation';

/**
 * Party information in litigation.
 */
export interface LitigationParty {
  name: string;
  role: 'plaintiff' | 'defendant' | 'petitioner' | 'respondent' | 'intervenor';
  isOurEntity?: boolean;
  attorneys?: string[];
  lawFirm?: string;
}

/**
 * Litigation case information.
 */
export interface LitigationCaseInfo {
  /** Case number */
  caseNumber: string;
  /** Case caption/title */
  caseCaption: string;
  /** Court or tribunal name */
  court: string;
  /** Jurisdiction */
  jurisdiction: string;
  /** Judge assigned */
  judge?: string;
  /** Case type */
  caseType?: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'unfair_competition';
  /** Filing date (ISO 8601) */
  filingDate: string;
  /** Current status */
  status?: string;
  /** Parties involved */
  parties: LitigationParty[];
  /** Patents-in-suit */
  patentsInSuit?: string[];
  /** Trademarks-in-suit */
  trademarksInSuit?: string[];
  /** Copyrights-in-suit */
  copyrightsInSuit?: string[];
  /** Damages claimed */
  damagesClaimed?: number;
  /** Currency for damages */
  currency?: string;
  /** URL to case documents */
  docketUrl?: string;
}

/**
 * Docket entry information.
 */
export interface DocketEntry {
  /** Entry number */
  entryNumber: string;
  /** Filing date (ISO 8601) */
  filingDate: string;
  /** Document type */
  documentType: string;
  /** Description */
  description: string;
  /** Filing party */
  filingParty?: string;
  /** Document URL */
  documentUrl?: string;
}

/**
 * Litigation watch alert payload.
 */
export interface LitigationAlert extends BaseWebhookPayload {
  alertType: LitigationAlertType;
  /** The case information */
  case: LitigationCaseInfo;
  /** Specific docket entry that triggered alert (if applicable) */
  docketEntry?: DocketEntry;
  /** Watch profile that generated this alert */
  watchProfileId?: string;
  /** Watch profile name */
  watchProfileName?: string;
  /** Our related IP assets */
  relatedAssets?: Array<{
    type: 'patent' | 'trademark' | 'copyright' | 'trade_secret';
    id: string;
    identifier: string;
  }>;
  /** Importance/Priority level */
  importance?: 'low' | 'medium' | 'high' | 'critical';
  /** Provider-specific alert ID */
  providerAlertId: string;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * All webhook alert types.
 */
export type WebhookAlert =
  | PatentWatchAlert
  | TrademarkWatchAlert
  | DomainWatchAlert
  | LitigationAlert;

/**
 * Alert type discriminator helper.
 */
export function isPatentWatchAlert(alert: WebhookAlert): alert is PatentWatchAlert {
  return 'patent' in alert && 'alertType' in alert &&
    ['new_filing', 'new_publication', 'new_grant', 'citation_forward', 'citation_backward',
     'competitor_filing', 'family_member', 'status_change', 'maintenance_due', 'expiration',
     'opposition', 'reexamination', 'assignment', 'license_recorded'].includes(alert.alertType);
}

export function isTrademarkWatchAlert(alert: WebhookAlert): alert is TrademarkWatchAlert {
  return 'trademark' in alert && 'alertType' in alert &&
    ['similar_mark_filed', 'similar_mark_published', 'similar_mark_registered',
     'opposition_filed', 'opposition_received', 'cancellation_filed', 'cancellation_received',
     'renewal_due', 'status_change', 'assignment', 'use_declaration_due', 'intent_to_use',
     'domain_registration'].includes(alert.alertType);
}

export function isDomainWatchAlert(alert: WebhookAlert): alert is DomainWatchAlert {
  return 'domain' in alert && 'alertType' in alert &&
    ['typosquatting', 'similar_registration', 'zone_file_addition', 'expiration_notice',
     'transfer_notice', 'whois_change', 'dns_change', 'content_change', 'brand_abuse'].includes(alert.alertType);
}

export function isLitigationAlert(alert: WebhookAlert): alert is LitigationAlert {
  return 'case' in alert && 'alertType' in alert &&
    ['case_filed', 'case_updated', 'motion_filed', 'order_issued', 'judgment', 'appeal_filed',
     'settlement', 'trial_date_set', 'claim_construction', 'invalidity_contention',
     'ptab_proceeding', 'itc_investigation'].includes(alert.alertType);
}
