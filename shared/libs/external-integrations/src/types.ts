/**
 * External Integration Types
 * Common types for all external API integrations
 */

import { z } from 'zod';

// =============================================================================
// Base Types
// =============================================================================

export type ExternalProvider =
  | 'docusign'
  | 'hellosign'
  | 'hmrc'
  | 'companies-house'
  | 'sendgrid'
  | 'ses'
  | 'slack'
  | 'webhook';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'rate_limited';

export interface ExternalConnection {
  id: string;
  provider: ExternalProvider;
  status: ConnectionStatus;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  connectionId: string;
  isHealthy: boolean;
  latencyMs: number;
  lastSuccessfulOperation: Date;
  issues: string[];
  checkedAt: Date;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// =============================================================================
// Credentials
// =============================================================================

export const OAuthCredentialsSchema = z.object({
  type: z.literal('oauth'),
  clientId: z.string(),
  clientSecret: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),
  scopes: z.array(z.string()).optional(),
});

export const ApiKeyCredentialsSchema = z.object({
  type: z.literal('api_key'),
  apiKey: z.string(),
  apiSecret: z.string().optional(),
});

export const BasicCredentialsSchema = z.object({
  type: z.literal('basic'),
  username: z.string(),
  password: z.string(),
});

export const CredentialsSchema = z.discriminatedUnion('type', [
  OAuthCredentialsSchema,
  ApiKeyCredentialsSchema,
  BasicCredentialsSchema,
]);

export type OAuthCredentials = z.infer<typeof OAuthCredentialsSchema>;
export type ApiKeyCredentials = z.infer<typeof ApiKeyCredentialsSchema>;
export type BasicCredentials = z.infer<typeof BasicCredentialsSchema>;
export type ExternalCredentials = z.infer<typeof CredentialsSchema>;

// =============================================================================
// Webhook Types
// =============================================================================

export interface WebhookEvent {
  id: string;
  provider: ExternalProvider;
  eventType: string;
  payload: unknown;
  signature?: string;
  receivedAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processed' | 'failed';
  error?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

// =============================================================================
// E-Signature Types
// =============================================================================

export type SignatureProvider = 'docusign' | 'hellosign';

export interface EnvelopeRecipient {
  email: string;
  name: string;
  role: string;
  order?: number;
  routingOrder?: number;
  recipientType: 'signer' | 'cc' | 'certified_delivery' | 'in_person_signer';
  tabs?: SignatureTab[];
}

export interface SignatureTab {
  type: 'signature' | 'initial' | 'date_signed' | 'text' | 'checkbox';
  documentId: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  width?: number;
  height?: number;
  required?: boolean;
  label?: string;
}

export interface CreateEnvelopeRequest {
  templateId?: string;
  subject: string;
  message?: string;
  recipients: EnvelopeRecipient[];
  documents?: DocumentAttachment[];
  brandId?: string;
  customFields?: Record<string, string>;
  expiresInDays?: number;
  reminderEnabled?: boolean;
  reminderDelayDays?: number;
  reminderFrequencyDays?: number;
}

export interface DocumentAttachment {
  name: string;
  documentId: string;
  fileExtension: string;
  documentBase64?: string;
  fileUrl?: string;
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  statusChangedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  declinedAt?: Date;
  voidedAt?: Date;
  recipients: RecipientStatus[];
  documents?: CompletedDocument[];
}

export interface RecipientStatus {
  email: string;
  name: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'declined' | 'completed';
  signedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
}

export interface CompletedDocument {
  documentId: string;
  name: string;
  downloadUrl?: string;
}

// =============================================================================
// HMRC MTD Types
// =============================================================================

export type HMRCEnvironment = 'sandbox' | 'production';

export interface HMRCTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface VATObligation {
  periodKey: string;
  start: Date;
  end: Date;
  due: Date;
  status: 'open' | 'fulfilled';
  received?: Date;
}

export interface VATReturn {
  periodKey: string;
  vatDueSales: number;                // Box 1
  vatDueAcquisitions: number;         // Box 2
  totalVatDue: number;                // Box 3
  vatReclaimedCurrPeriod: number;     // Box 4
  netVatDue: number;                  // Box 5
  totalValueSalesExVAT: number;       // Box 6
  totalValuePurchasesExVAT: number;   // Box 7
  totalValueGoodsSuppliedExVAT: number; // Box 8
  totalAcquisitionsExVAT: number;     // Box 9
  finalised: boolean;
}

export interface VATSubmissionResponse {
  processingDate: Date;
  paymentIndicator?: 'DD' | 'BANK';
  formBundleNumber: string;
  chargeRefNumber?: string;
}

// =============================================================================
// Companies House Types
// =============================================================================

export interface CompanyProfile {
  companyNumber: string;
  companyName: string;
  companyStatus: 'active' | 'dissolved' | 'liquidation' | 'receivership' | 'converted-closed';
  companyType: string;
  dateOfCreation: Date;
  registeredOfficeAddress: CompanyAddress;
  sicCodes?: string[];
  hasBeenLiquidated?: boolean;
  hasInsolvencyHistory?: boolean;
  accounts?: AccountsInfo;
  confirmationStatement?: ConfirmationStatementInfo;
}

export interface CompanyAddress {
  addressLine1: string;
  addressLine2?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface AccountsInfo {
  nextDue?: Date;
  lastAccounts?: {
    madeUpTo: Date;
    type: string;
  };
  accountingReferenceDate?: {
    day: string;
    month: string;
  };
}

export interface ConfirmationStatementInfo {
  nextDue?: Date;
  lastMadeUpTo?: Date;
}

export interface CompanyOfficer {
  name: string;
  officerRole: 'director' | 'secretary' | 'corporate-director' | 'corporate-secretary' | 'nominee-director';
  dateOfBirth?: { month: number; year: number };
  appointedOn: Date;
  resignedOn?: Date;
  nationality?: string;
  countryOfResidence?: string;
  occupation?: string;
}

export interface CompanyFilingHistory {
  items: FilingHistoryItem[];
  totalCount: number;
}

export interface FilingHistoryItem {
  transactionId: string;
  date: Date;
  type: string;
  description: string;
  category: string;
  documentMetadata?: {
    downloadUrl?: string;
  };
}

// =============================================================================
// Notification Types
// =============================================================================

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  replyTo?: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  tags?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: string;  // base64
  contentType: string;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';
  statusChangedAt: Date;
  bounceType?: 'hard' | 'soft';
  bounceReason?: string;
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  threadTs?: string;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

export interface SlackBlock {
  type: 'section' | 'header' | 'divider' | 'actions' | 'context' | 'image';
  text?: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  };
  accessory?: unknown;
  elements?: unknown[];
}

export interface SlackDeliveryStatus {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

export interface WebhookDelivery {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  payload: unknown;
  secret?: string;  // For HMAC signing
  retryCount?: number;
  retryDelayMs?: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attempts: number;
  deliveredAt?: Date;
}
