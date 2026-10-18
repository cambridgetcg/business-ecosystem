/**
 * Escalation Policies Configuration
 *
 * Defines notification escalation rules based on deadline priority and time remaining.
 * This configuration drives the EscalationEngine service.
 *
 * @module config
 */

/**
 * Notification channel types.
 */
export type NotificationChannel = 'email' | 'slack' | 'sms' | 'pagerduty';

/**
 * Recipient role for notifications.
 */
export type RecipientRole =
  | 'ip_manager'
  | 'legal_counsel'
  | 'ip_admin'
  | 'executive'
  | 'finance'
  | 'external_counsel';

/**
 * Escalation level definition.
 */
export interface EscalationLevel {
  /** Name of this escalation level */
  name: string;
  /** Days before deadline to trigger this level */
  daysBeforeDeadline: number;
  /** Notification channels to use */
  channels: NotificationChannel[];
  /** Roles to notify */
  recipients: RecipientRole[];
  /** Whether to repeat notification if not acknowledged */
  repeatIfUnacknowledged: boolean;
  /** Hours between repeat notifications */
  repeatIntervalHours?: number;
}

/**
 * Escalation policy definition.
 */
export interface EscalationPolicy {
  /** Deadline types this policy applies to */
  deadlineTypes: string[];
  /** Minimum priority to apply this policy */
  minPriority: 'low' | 'medium' | 'high' | 'critical';
  /** Escalation levels in order of urgency */
  levels: EscalationLevel[];
  /** Whether this policy is enabled */
  enabled: boolean;
}

/**
 * Escalation policies configuration.
 */
export const escalationPolicies: EscalationPolicy[] = [
  // Critical IP deadlines (maintenance fees, renewals, disputes)
  {
    deadlineTypes: [
      'patent_maintenance_fee',
      'trademark_maintenance',
      'trademark_section_8',
      'trademark_section_9',
      'opposition_response',
      'udrp_response',
    ],
    minPriority: 'medium',
    enabled: true,
    levels: [
      {
        name: 'Initial Notice',
        daysBeforeDeadline: 90,
        channels: ['email'],
        recipients: ['ip_manager', 'ip_admin'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Second Notice',
        daysBeforeDeadline: 60,
        channels: ['email'],
        recipients: ['ip_manager', 'ip_admin'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Urgent Notice',
        daysBeforeDeadline: 30,
        channels: ['email', 'slack'],
        recipients: ['ip_manager', 'legal_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 168, // Weekly
      },
      {
        name: 'Critical Notice',
        daysBeforeDeadline: 14,
        channels: ['email', 'slack'],
        recipients: ['ip_manager', 'legal_counsel', 'executive'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 72, // Every 3 days
      },
      {
        name: 'Final Warning',
        daysBeforeDeadline: 7,
        channels: ['email', 'slack', 'sms'],
        recipients: ['ip_manager', 'legal_counsel', 'executive', 'external_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 24, // Daily
      },
      {
        name: 'Emergency Alert',
        daysBeforeDeadline: 3,
        channels: ['email', 'slack', 'sms', 'pagerduty'],
        recipients: ['ip_manager', 'legal_counsel', 'executive', 'external_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 12, // Twice daily
      },
    ],
  },

  // Domain expiration (less critical but still important)
  {
    deadlineTypes: ['domain_expiration'],
    minPriority: 'low',
    enabled: true,
    levels: [
      {
        name: 'Initial Notice',
        daysBeforeDeadline: 90,
        channels: ['email'],
        recipients: ['ip_admin'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Reminder',
        daysBeforeDeadline: 30,
        channels: ['email'],
        recipients: ['ip_admin', 'ip_manager'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Urgent Notice',
        daysBeforeDeadline: 14,
        channels: ['email', 'slack'],
        recipients: ['ip_manager'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 72,
      },
      {
        name: 'Final Warning',
        daysBeforeDeadline: 7,
        channels: ['email', 'slack'],
        recipients: ['ip_manager', 'legal_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 24,
      },
    ],
  },

  // License royalties (finance-focused)
  {
    deadlineTypes: ['license_royalty'],
    minPriority: 'low',
    enabled: true,
    levels: [
      {
        name: 'Initial Notice',
        daysBeforeDeadline: 30,
        channels: ['email'],
        recipients: ['ip_admin', 'finance'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Reminder',
        daysBeforeDeadline: 14,
        channels: ['email'],
        recipients: ['ip_manager', 'finance'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Urgent Notice',
        daysBeforeDeadline: 7,
        channels: ['email', 'slack'],
        recipients: ['ip_manager', 'finance', 'legal_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 48,
      },
    ],
  },

  // Trade secret reviews (internal process)
  {
    deadlineTypes: ['trade_secret_review'],
    minPriority: 'low',
    enabled: true,
    levels: [
      {
        name: 'Review Reminder',
        daysBeforeDeadline: 30,
        channels: ['email'],
        recipients: ['ip_manager'],
        repeatIfUnacknowledged: false,
      },
      {
        name: 'Overdue Notice',
        daysBeforeDeadline: 0,
        channels: ['email', 'slack'],
        recipients: ['ip_manager', 'legal_counsel'],
        repeatIfUnacknowledged: true,
        repeatIntervalHours: 168,
      },
    ],
  },
];

/**
 * Overdue escalation policy (applies to all missed deadlines).
 */
export const overdueEscalationPolicy: EscalationPolicy = {
  deadlineTypes: ['*'],
  minPriority: 'low',
  enabled: true,
  levels: [
    {
      name: 'Overdue Alert',
      daysBeforeDeadline: -1, // 1 day overdue
      channels: ['email', 'slack'],
      recipients: ['ip_manager', 'legal_counsel'],
      repeatIfUnacknowledged: true,
      repeatIntervalHours: 24,
    },
    {
      name: 'Critical Overdue',
      daysBeforeDeadline: -7, // 7 days overdue
      channels: ['email', 'slack', 'sms'],
      recipients: ['ip_manager', 'legal_counsel', 'executive'],
      repeatIfUnacknowledged: true,
      repeatIntervalHours: 12,
    },
    {
      name: 'Emergency Overdue',
      daysBeforeDeadline: -14, // 14 days overdue
      channels: ['email', 'slack', 'sms', 'pagerduty'],
      recipients: ['ip_manager', 'legal_counsel', 'executive', 'external_counsel'],
      repeatIfUnacknowledged: true,
      repeatIntervalHours: 6,
    },
  ],
};

/**
 * Get escalation policy for a deadline type and priority.
 */
export function getEscalationPolicy(
  deadlineType: string,
  priority: 'low' | 'medium' | 'high' | 'critical'
): EscalationPolicy | null {
  const priorityRank = { low: 0, medium: 1, high: 2, critical: 3 };

  return escalationPolicies.find(
    policy =>
      policy.enabled &&
      policy.deadlineTypes.includes(deadlineType) &&
      priorityRank[priority] >= priorityRank[policy.minPriority]
  ) ?? null;
}

/**
 * Get the current escalation level for a deadline.
 */
export function getCurrentEscalationLevel(
  policy: EscalationPolicy,
  daysUntilDeadline: number
): EscalationLevel | null {
  // Sort levels by days (most urgent first)
  const sortedLevels = [...policy.levels].sort(
    (a, b) => a.daysBeforeDeadline - b.daysBeforeDeadline
  );

  // Find the appropriate level
  for (const level of sortedLevels) {
    if (daysUntilDeadline <= level.daysBeforeDeadline) {
      return level;
    }
  }

  return null;
}

/**
 * Recipient email mappings (would typically come from config/database).
 */
export const recipientEmails: Record<RecipientRole, string[]> = {
  ip_manager: ['ip-manager@example.com'],
  legal_counsel: ['legal@example.com'],
  ip_admin: ['ip-admin@example.com'],
  executive: ['executive@example.com'],
  finance: ['finance@example.com'],
  external_counsel: ['external@lawfirm.com'],
};

/**
 * Get email addresses for a list of recipient roles.
 */
export function getEmailsForRoles(roles: RecipientRole[]): string[] {
  const emails = new Set<string>();
  for (const role of roles) {
    const roleEmails = recipientEmails[role] ?? [];
    roleEmails.forEach(email => emails.add(email));
  }
  return Array.from(emails);
}
