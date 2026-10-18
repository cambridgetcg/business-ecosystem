/**
 * Email Templates Module
 *
 * Exports all email templates for IP deadline notifications.
 *
 * @module infrastructure/aws/email-templates
 */

export {
  generateMaintenanceFeeEmail,
  type MaintenanceFeeTemplateData,
} from './maintenance-fee.template.js';

export {
  generateTrademarkRenewalEmail,
  type TrademarkRenewalTemplateData,
} from './trademark-renewal.template.js';

export {
  generateDomainExpirationEmail,
  type DomainExpirationTemplateData,
} from './domain-expiration.template.js';

export {
  generateCriticalAlertEmail,
  type CriticalAlertTemplateData,
  type CriticalAlertType,
} from './critical-alert.template.js';

export {
  generateRoyaltyDueEmail,
  type RoyaltyDueTemplateData,
  type RoyaltyType,
} from './royalty-due.template.js';

export { type EmailContent } from './maintenance-fee.template.js';
