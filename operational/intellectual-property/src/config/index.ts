/**
 * Configuration
 *
 * Exports all configuration modules.
 *
 * @module config
 */

export {
  deadlineRules,
  getRulesForEvent,
  getRulesForDeadlineType,
  getReminderDaysForType,
  ruleAppliesToJurisdiction,
  type DeadlineTriggerEvent,
  type DeadlineRule,
} from './deadline-rules.config.js';

export {
  escalationPolicies,
  overdueEscalationPolicy,
  getEscalationPolicy,
  getCurrentEscalationLevel,
  recipientEmails,
  getEmailsForRoles,
  type NotificationChannel,
  type RecipientRole,
  type EscalationLevel,
  type EscalationPolicy,
} from './escalation-policies.config.js';
