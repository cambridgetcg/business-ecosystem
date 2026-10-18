/**
 * Plaid Infrastructure Module
 *
 * Exports all Plaid Open Banking integration components:
 * - PlaidClient: API wrapper for Plaid endpoints
 * - PlaidWebhookHandler: Processes Plaid webhook events
 *
 * @module infrastructure/plaid
 */

// Client
export {
  PlaidClient,
  getPlaidClient,
  resetPlaidClient,
  type CreateLinkTokenRequest,
  type LinkTokenResponse,
  type AccessTokenResponse,
  type PlaidAccountInfo,
  type PlaidTransactionInfo,
  type TransactionSyncResponse,
  type ItemInfo,
  type InstitutionInfo,
} from './client.js';

// Webhook Handler
export {
  PlaidWebhookHandler,
  plaidWebhookHandler,
  type PlaidWebhookType,
  type TransactionWebhookCode,
  type ItemWebhookCode,
  type PlaidWebhookPayload,
  type TransactionWebhookPayload,
  type ItemWebhookPayload,
  type WebhookProcessingResult,
} from './webhook-handler.js';
