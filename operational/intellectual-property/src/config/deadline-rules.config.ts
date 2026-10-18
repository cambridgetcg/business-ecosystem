/**
 * Deadline Rules Configuration
 *
 * Defines what deadlines should be created for which domain events.
 * This configuration drives the DeadlineGenerator service.
 *
 * @module config
 */

/**
 * Event types that trigger deadline creation.
 */
export type DeadlineTriggerEvent =
  | 'Patent.Granted'
  | 'Patent.Filed'
  | 'Trademark.Registered'
  | 'Trademark.Filed'
  | 'Trademark.OppositionFiled'
  | 'DomainName.Registered'
  | 'DomainName.Renewed'
  | 'DomainDispute.Filed'
  | 'License.Executed'
  | 'License.RoyaltyScheduled'
  | 'TradeSecret.ProtectionReviewDue';

/**
 * Deadline rule definition.
 */
export interface DeadlineRule {
  /** Event type that triggers this rule */
  triggerEvent: DeadlineTriggerEvent;
  /** Type of deadline to create */
  deadlineType: string;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** Description of the rule */
  description: string;
  /** Priority of the generated deadline */
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  /** Days before due date to start sending reminders */
  reminderDays: number[];
  /** Jurisdictions this rule applies to (empty = all) */
  jurisdictions?: string[];
}

/**
 * Deadline rules configuration.
 */
export const deadlineRules: DeadlineRule[] = [
  // Patent rules
  {
    triggerEvent: 'Patent.Granted',
    deadlineType: 'patent_maintenance_fee',
    enabled: true,
    description: 'Create maintenance fee deadlines when patent is granted',
    defaultPriority: 'high',
    reminderDays: [180, 90, 60, 30, 14, 7, 3, 1],
    jurisdictions: ['US'],
  },
  {
    triggerEvent: 'Patent.Filed',
    deadlineType: 'patent_response',
    enabled: true,
    description: 'Track office action response deadlines',
    defaultPriority: 'high',
    reminderDays: [60, 30, 14, 7, 3, 1],
  },

  // Trademark rules
  {
    triggerEvent: 'Trademark.Registered',
    deadlineType: 'trademark_maintenance',
    enabled: true,
    description: 'Create Section 8/9/15 and renewal deadlines when trademark is registered',
    defaultPriority: 'critical',
    reminderDays: [365, 180, 90, 60, 30, 14, 7],
  },
  {
    triggerEvent: 'Trademark.OppositionFiled',
    deadlineType: 'opposition_response',
    enabled: true,
    description: 'Create response deadline when opposition is filed against our mark',
    defaultPriority: 'critical',
    reminderDays: [30, 14, 7, 3, 1],
  },

  // Domain name rules
  {
    triggerEvent: 'DomainName.Registered',
    deadlineType: 'domain_expiration',
    enabled: true,
    description: 'Create expiration deadline when domain is registered',
    defaultPriority: 'high',
    reminderDays: [90, 60, 30, 14, 7, 3, 1],
  },
  {
    triggerEvent: 'DomainName.Renewed',
    deadlineType: 'domain_expiration',
    enabled: true,
    description: 'Update expiration deadline when domain is renewed',
    defaultPriority: 'high',
    reminderDays: [90, 60, 30, 14, 7, 3, 1],
  },
  {
    triggerEvent: 'DomainDispute.Filed',
    deadlineType: 'udrp_response',
    enabled: true,
    description: 'Create response deadline when UDRP is filed against our domain',
    defaultPriority: 'critical',
    reminderDays: [14, 7, 5, 3, 2, 1],
  },

  // License rules
  {
    triggerEvent: 'License.Executed',
    deadlineType: 'license_royalty',
    enabled: true,
    description: 'Create royalty payment schedule when license is executed',
    defaultPriority: 'medium',
    reminderDays: [30, 14, 7, 3, 1],
  },
  {
    triggerEvent: 'License.RoyaltyScheduled',
    deadlineType: 'license_royalty',
    enabled: true,
    description: 'Create individual royalty payment deadline',
    defaultPriority: 'medium',
    reminderDays: [30, 14, 7, 3, 1],
  },

  // Trade secret rules
  {
    triggerEvent: 'TradeSecret.ProtectionReviewDue',
    deadlineType: 'trade_secret_review',
    enabled: true,
    description: 'Schedule periodic protection measure review',
    defaultPriority: 'medium',
    reminderDays: [30, 14, 7],
  },
];

/**
 * Get rules for a specific event type.
 */
export function getRulesForEvent(eventType: string): DeadlineRule[] {
  return deadlineRules.filter(
    rule => rule.enabled && rule.triggerEvent === eventType
  );
}

/**
 * Get rules for a specific deadline type.
 */
export function getRulesForDeadlineType(deadlineType: string): DeadlineRule[] {
  return deadlineRules.filter(
    rule => rule.enabled && rule.deadlineType === deadlineType
  );
}

/**
 * Get reminder days for a deadline type.
 */
export function getReminderDaysForType(deadlineType: string): number[] {
  const rule = deadlineRules.find(r => r.deadlineType === deadlineType);
  return rule?.reminderDays ?? [90, 60, 30, 14, 7, 3, 1];
}

/**
 * Check if a rule applies to a jurisdiction.
 */
export function ruleAppliesToJurisdiction(rule: DeadlineRule, jurisdiction: string): boolean {
  if (!rule.jurisdictions || rule.jurisdictions.length === 0) {
    return true;
  }
  return rule.jurisdictions.includes(jurisdiction);
}
