/**
 * Policy Renewal Scheduler Service
 *
 * Monitors policies approaching expiry and sends reminders.
 * Can trigger auto-renewal for eligible policies.
 */

import type { Policy } from '../../domain/policy/models/policy.js';
import type { PolicyService } from './policy-service.js';
import { getGlobalEventPublisher } from '../../infrastructure/messaging/index.js';

// =============================================================================
// Types
// =============================================================================

export interface RenewalSchedulerConfig {
  /** Days before expiry to send first reminder (default: 60) */
  firstReminderDays: number;
  /** Days before expiry to send second reminder (default: 30) */
  secondReminderDays: number;
  /** Days before expiry to send third reminder (default: 14) */
  thirdReminderDays: number;
  /** Days before expiry to send urgent reminder (default: 7) */
  urgentReminderDays: number;
  /** Enable auto-renewal for eligible policies (default: true) */
  autoRenewEnabled: boolean;
  /** Days before expiry to trigger auto-renewal (default: 7) */
  autoRenewDays: number;
  /** Default renewal period in months (default: 12) */
  defaultRenewalMonths: number;
}

export interface RenewalCheckResult {
  tenantId: string;
  processedAt: Date;
  stats: {
    totalChecked: number;
    remindersGenerated: number;
    autoRenewalsTriggered: number;
    errors: number;
  };
  reminders: RenewalReminder[];
  autoRenewals: AutoRenewalResult[];
  errors: RenewalError[];
}

export interface RenewalReminder {
  policyId: string;
  policyNumber: string;
  policyName: string;
  entityId: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  reminderLevel: 'first' | 'second' | 'third' | 'urgent';
  autoRenewalEligible: boolean;
}

export interface AutoRenewalResult {
  originalPolicyId: string;
  originalPolicyNumber: string;
  newPolicyId: string;
  newPolicyNumber: string;
  newExpiryDate: Date;
  status: 'success' | 'failed';
  message?: string;
}

export interface RenewalError {
  policyId: string;
  policyNumber: string;
  error: string;
}

// =============================================================================
// Service
// =============================================================================

export class RenewalSchedulerService {
  private readonly config: RenewalSchedulerConfig;

  constructor(
    private readonly policyService: PolicyService,
    config?: Partial<RenewalSchedulerConfig>
  ) {
    this.config = {
      firstReminderDays: config?.firstReminderDays ?? 60,
      secondReminderDays: config?.secondReminderDays ?? 30,
      thirdReminderDays: config?.thirdReminderDays ?? 14,
      urgentReminderDays: config?.urgentReminderDays ?? 7,
      autoRenewEnabled: config?.autoRenewEnabled ?? true,
      autoRenewDays: config?.autoRenewDays ?? 7,
      defaultRenewalMonths: config?.defaultRenewalMonths ?? 12,
    };
  }

  /**
   * Run the renewal check for a tenant
   * This should be called periodically (e.g., daily via cron job)
   */
  async runRenewalCheck(tenantId: string): Promise<RenewalCheckResult> {
    const result: RenewalCheckResult = {
      tenantId,
      processedAt: new Date(),
      stats: {
        totalChecked: 0,
        remindersGenerated: 0,
        autoRenewalsTriggered: 0,
        errors: 0,
      },
      reminders: [],
      autoRenewals: [],
      errors: [],
    };

    try {
      // Get all expiring policies within our window
      const expiringPolicies = await this.policyService.getExpiringPolicies(
        tenantId,
        this.config.firstReminderDays
      );

      result.stats.totalChecked = expiringPolicies.length;

      for (const policy of expiringPolicies) {
        try {
          await this.processPolicy(policy, result);
        } catch (error: any) {
          result.stats.errors++;
          result.errors.push({
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            error: error.message,
          });
        }
      }

      console.log(`[RenewalScheduler] Processed ${result.stats.totalChecked} policies for tenant ${tenantId}`);
      console.log(`  - Reminders: ${result.stats.remindersGenerated}`);
      console.log(`  - Auto-renewals: ${result.stats.autoRenewalsTriggered}`);
      console.log(`  - Errors: ${result.stats.errors}`);

    } catch (error: any) {
      console.error(`[RenewalScheduler] Failed to run renewal check:`, error);
      throw error;
    }

    return result;
  }

  /**
   * Process a single policy for renewal reminders/auto-renewal
   */
  private async processPolicy(
    policy: Policy,
    result: RenewalCheckResult
  ): Promise<void> {
    const daysUntilExpiry = this.getDaysUntilExpiry(policy.expiryDate);

    // Determine reminder level
    const reminderLevel = this.getReminderLevel(daysUntilExpiry);

    if (reminderLevel) {
      const reminder: RenewalReminder = {
        policyId: policy.id,
        policyNumber: policy.policyNumber,
        policyName: policy.policyName,
        entityId: policy.entityId,
        expiryDate: policy.expiryDate,
        daysUntilExpiry,
        reminderLevel,
        autoRenewalEligible: policy.autoRenewal && !policy.renewedByPolicyId,
      };

      // Publish expiring event
      await this.publishExpiringEvent(policy, daysUntilExpiry, reminderLevel);

      result.reminders.push(reminder);
      result.stats.remindersGenerated++;

      // Check for auto-renewal
      if (
        this.config.autoRenewEnabled &&
        policy.autoRenewal &&
        !policy.renewedByPolicyId &&
        daysUntilExpiry <= this.config.autoRenewDays
      ) {
        const autoRenewal = await this.triggerAutoRenewal(policy);
        result.autoRenewals.push(autoRenewal);
        if (autoRenewal.status === 'success') {
          result.stats.autoRenewalsTriggered++;
        } else {
          result.stats.errors++;
          result.errors.push({
            policyId: policy.id,
            policyNumber: policy.policyNumber,
            error: autoRenewal.message || 'Auto-renewal failed',
          });
        }
      }
    }
  }

  /**
   * Get the reminder level based on days until expiry
   */
  private getReminderLevel(
    daysUntilExpiry: number
  ): 'first' | 'second' | 'third' | 'urgent' | null {
    if (daysUntilExpiry <= 0) {
      return null; // Already expired
    }

    if (daysUntilExpiry <= this.config.urgentReminderDays) {
      return 'urgent';
    }
    if (daysUntilExpiry <= this.config.thirdReminderDays) {
      return 'third';
    }
    if (daysUntilExpiry <= this.config.secondReminderDays) {
      return 'second';
    }
    if (daysUntilExpiry <= this.config.firstReminderDays) {
      return 'first';
    }

    return null;
  }

  /**
   * Publish PolicyExpiringSoon event
   */
  private async publishExpiringEvent(
    policy: Policy,
    daysUntilExpiry: number,
    _urgency: string
  ): Promise<void> {
    const publisher = getGlobalEventPublisher();
    if (!publisher) return;

    await publisher.publishPolicyExpiringSoon({
      policyId: policy.id,
      tenantId: policy.tenantId,
      entityId: policy.entityId,
      policyNumber: policy.policyNumber,
      policyType: policy.policyType,
      expiryDate: policy.expiryDate.toISOString(),
      daysUntilExpiry,
      autoRenewal: policy.autoRenewal,
    });
  }

  /**
   * Trigger auto-renewal for a policy
   */
  private async triggerAutoRenewal(policy: Policy): Promise<AutoRenewalResult> {
    try {
      // Calculate new expiry date
      const newExpiryDate = this.calculateNewExpiryDate(policy.expiryDate);

      // Renew the policy
      const renewedPolicy = await this.policyService.renewPolicy(
        policy.id,
        newExpiryDate,
        'system-auto-renewal'
      );

      // Publish auto-renewed event
      const publisher = getGlobalEventPublisher();
      if (publisher) {
        await publisher.publishPolicyRenewed({
          policyId: renewedPolicy.id,
          tenantId: policy.tenantId,
          entityId: policy.entityId,
          oldPolicyId: policy.id,
          oldPolicyNumber: policy.policyNumber,
          newPolicyNumber: renewedPolicy.policyNumber,
          policyType: policy.policyType,
          newInceptionDate: policy.expiryDate.toISOString(), // New policy starts when old expires
          newExpiryDate: newExpiryDate.toISOString(),
        });
      }

      console.log(`[RenewalScheduler] Auto-renewed policy ${policy.policyNumber} → ${renewedPolicy.policyNumber}`);

      return {
        originalPolicyId: policy.id,
        originalPolicyNumber: policy.policyNumber,
        newPolicyId: renewedPolicy.id,
        newPolicyNumber: renewedPolicy.policyNumber,
        newExpiryDate,
        status: 'success',
      };
    } catch (error: any) {
      console.error(`[RenewalScheduler] Auto-renewal failed for ${policy.policyNumber}:`, error);
      return {
        originalPolicyId: policy.id,
        originalPolicyNumber: policy.policyNumber,
        newPolicyId: '',
        newPolicyNumber: '',
        newExpiryDate: new Date(),
        status: 'failed',
        message: error.message,
      };
    }
  }

  /**
   * Calculate new expiry date based on config
   */
  private calculateNewExpiryDate(currentExpiry: Date): Date {
    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + this.config.defaultRenewalMonths);
    return newExpiry;
  }

  /**
   * Get days until policy expiry
   */
  private getDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ===========================================================================
  // Manual Operations
  // ===========================================================================

  /**
   * Get policies due for renewal within a timeframe
   */
  async getPoliciesDueForRenewal(
    tenantId: string,
    daysAhead: number = 60
  ): Promise<Policy[]> {
    return this.policyService.getExpiringPolicies(tenantId, daysAhead);
  }

  /**
   * Send a manual renewal reminder for a specific policy
   */
  async sendRenewalReminder(policyId: string): Promise<RenewalReminder | null> {
    const policy = await this.policyService.getPolicy(policyId);
    if (!policy) return null;

    const daysUntilExpiry = this.getDaysUntilExpiry(policy.expiryDate);
    const reminderLevel = this.getReminderLevel(daysUntilExpiry) || 'first';

    await this.publishExpiringEvent(policy, daysUntilExpiry, reminderLevel);

    return {
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      policyName: policy.policyName,
      entityId: policy.entityId,
      expiryDate: policy.expiryDate,
      daysUntilExpiry,
      reminderLevel,
      autoRenewalEligible: policy.autoRenewal && !policy.renewedByPolicyId,
    };
  }

  /**
   * Manually trigger renewal for a specific policy
   */
  async triggerManualRenewal(
    policyId: string,
    newExpiryDate?: Date,
    userId?: string
  ): Promise<AutoRenewalResult> {
    const policy = await this.policyService.getPolicy(policyId);
    if (!policy) {
      return {
        originalPolicyId: policyId,
        originalPolicyNumber: '',
        newPolicyId: '',
        newPolicyNumber: '',
        newExpiryDate: new Date(),
        status: 'failed',
        message: 'Policy not found',
      };
    }

    try {
      const expiryDate = newExpiryDate || this.calculateNewExpiryDate(policy.expiryDate);
      const renewedPolicy = await this.policyService.renewPolicy(
        policyId,
        expiryDate,
        userId || 'manual-renewal'
      );

      const publisher = getGlobalEventPublisher();
      if (publisher) {
        await publisher.publishPolicyRenewed({
          policyId: renewedPolicy.id,
          tenantId: policy.tenantId,
          entityId: policy.entityId,
          oldPolicyId: policy.id,
          oldPolicyNumber: policy.policyNumber,
          newPolicyNumber: renewedPolicy.policyNumber,
          policyType: policy.policyType,
          newInceptionDate: policy.expiryDate.toISOString(),
          newExpiryDate: expiryDate.toISOString(),
        });
      }

      return {
        originalPolicyId: policy.id,
        originalPolicyNumber: policy.policyNumber,
        newPolicyId: renewedPolicy.id,
        newPolicyNumber: renewedPolicy.policyNumber,
        newExpiryDate: expiryDate,
        status: 'success',
      };
    } catch (error: any) {
      return {
        originalPolicyId: policy.id,
        originalPolicyNumber: policy.policyNumber,
        newPolicyId: '',
        newPolicyNumber: '',
        newExpiryDate: new Date(),
        status: 'failed',
        message: error.message,
      };
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRenewalSchedulerService(
  policyService: PolicyService,
  config?: Partial<RenewalSchedulerConfig>
): RenewalSchedulerService {
  return new RenewalSchedulerService(policyService, config);
}
