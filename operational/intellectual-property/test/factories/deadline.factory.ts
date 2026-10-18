/**
 * Deadline Test Factory
 *
 * Creates deadline test data with sensible defaults.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';
import type { Deadline } from '../../src/infrastructure/aws/dynamodb-deadline-store.js';

/**
 * Default deadline values.
 */
const defaults: Deadline = {
  assetId: '',
  deadlineId: '',
  assetType: 'patent',
  deadlineType: 'patent_maintenance_fee',
  dueDate: '',
  status: 'pending',
  priority: 'high',
  title: 'Test Deadline',
  description: 'A test deadline for testing purposes.',
  remindersSent: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Create deadline test data.
 */
export function createDeadline(overrides: Partial<Deadline> = {}): Deadline {
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    ...defaults,
    assetId: randomUUID(),
    deadlineId: randomUUID(),
    dueDate: dueDate.toISOString(),
    ...overrides,
  };
}

/**
 * Create an urgent deadline (due in 7 days).
 */
export function createUrgentDeadline(overrides: Partial<Deadline> = {}): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  return createDeadline({
    priority: 'critical',
    dueDate: dueDate.toISOString(),
    ...overrides,
  });
}

/**
 * Create an overdue deadline.
 */
export function createOverdueDeadline(daysOverdue: number = 5, overrides: Partial<Deadline> = {}): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - daysOverdue);

  return createDeadline({
    priority: 'critical',
    dueDate: dueDate.toISOString(),
    ...overrides,
  });
}

/**
 * Create a patent maintenance fee deadline.
 */
export function createMaintenanceFeeDeadline(
  feeWindow: '3.5 Year' | '7.5 Year' | '11.5 Year',
  overrides: Partial<Deadline> = {}
): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 60);

  const amounts: Record<string, number> = {
    '3.5 Year': 2000,
    '7.5 Year': 3760,
    '11.5 Year': 7700,
  };

  return createDeadline({
    assetType: 'patent',
    deadlineType: 'patent_maintenance_fee',
    title: `${feeWindow} Maintenance Fee Due`,
    description: `US patent maintenance fee for the ${feeWindow} window.`,
    dueDate: dueDate.toISOString(),
    amount: amounts[feeWindow],
    currency: 'USD',
    jurisdiction: 'US',
    ...overrides,
  });
}

/**
 * Create a trademark Section 8 deadline.
 */
export function createSection8Deadline(overrides: Partial<Deadline> = {}): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 90);

  return createDeadline({
    assetType: 'trademark',
    deadlineType: 'trademark_section_8',
    title: 'Section 8 Declaration of Use Due',
    description: 'File declaration of continued use between 5th and 6th year anniversary.',
    dueDate: dueDate.toISOString(),
    priority: 'critical',
    jurisdiction: 'US',
    ...overrides,
  });
}

/**
 * Create a domain expiration deadline.
 */
export function createDomainExpirationDeadline(
  domainName: string = 'example.com',
  overrides: Partial<Deadline> = {}
): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 45);

  return createDeadline({
    assetType: 'domain',
    deadlineType: 'domain_expiration',
    title: `Domain Expiration: ${domainName}`,
    description: `Domain ${domainName} expires.`,
    dueDate: dueDate.toISOString(),
    priority: 'high',
    ...overrides,
  });
}

/**
 * Create a UDRP response deadline.
 */
export function createUDRPDeadline(overrides: Partial<Deadline> = {}): Deadline {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);

  return createDeadline({
    assetType: 'domain',
    deadlineType: 'udrp_response',
    title: 'UDRP Response Deadline',
    description: 'Response to UDRP complaint must be filed within 20 days.',
    dueDate: dueDate.toISOString(),
    priority: 'critical',
    ...overrides,
  });
}

/**
 * Create an acknowledged deadline.
 */
export function createAcknowledgedDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return createDeadline({
    status: 'acknowledged',
    remindersSent: 2,
    lastReminderAt: new Date().toISOString(),
    ...overrides,
  });
}

/**
 * Create multiple deadlines.
 */
export function createDeadlines(count: number, overrides: Partial<Deadline> = {}): Deadline[] {
  return Array.from({ length: count }, (_, i) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (i + 1) * 10);

    return createDeadline({
      title: `Test Deadline ${i + 1}`,
      dueDate: dueDate.toISOString(),
      ...overrides,
    });
  });
}

/**
 * Create deadlines with varying priorities.
 */
export function createDeadlinesWithPriorities(): Deadline[] {
  const priorities: Array<Deadline['priority']> = ['low', 'medium', 'high', 'critical'];

  return priorities.map((priority, i) => {
    const daysUntil = priority === 'critical' ? 3 : priority === 'high' ? 14 : priority === 'medium' ? 45 : 90;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntil);

    return createDeadline({
      title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Deadline`,
      priority,
      dueDate: dueDate.toISOString(),
    });
  });
}
