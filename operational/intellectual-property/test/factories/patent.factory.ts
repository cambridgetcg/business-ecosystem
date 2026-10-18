/**
 * Patent Test Factory
 *
 * Creates patent test data with sensible defaults.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';

/**
 * Patent test data interface.
 */
export interface PatentTestData {
  id: string;
  applicationNumber: string;
  patentNumber: string | null;
  title: string;
  jurisdiction: string;
  filingDate: Date;
  grantDate: Date | null;
  expirationDate: Date | null;
  status: 'draft' | 'pending' | 'published' | 'granted' | 'expired' | 'abandoned';
  entitySize: 'micro' | 'small' | 'large';
  inventors: string[];
  abstract: string;
  claims: string[];
  priorityDate: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Default patent values.
 */
const defaults: PatentTestData = {
  id: '',
  applicationNumber: '17/123,456',
  patentNumber: null,
  title: 'Test Patent Application',
  jurisdiction: 'US',
  filingDate: new Date('2023-01-15'),
  grantDate: null,
  expirationDate: null,
  status: 'pending',
  entitySize: 'large',
  inventors: ['John Doe', 'Jane Smith'],
  abstract: 'A test patent application for testing purposes.',
  claims: ['Claim 1: A method for testing...', 'Claim 2: The method of claim 1...'],
  priorityDate: null,
};

/**
 * Create patent test data.
 */
export function createPatent(overrides: Partial<PatentTestData> = {}): PatentTestData {
  return {
    ...defaults,
    id: randomUUID(),
    ...overrides,
  };
}

/**
 * Create a granted patent.
 */
export function createGrantedPatent(overrides: Partial<PatentTestData> = {}): PatentTestData {
  const grantDate = overrides.grantDate ?? new Date('2024-06-15');
  const expirationDate = new Date(grantDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 20);

  return createPatent({
    patentNumber: '12,345,678',
    status: 'granted',
    grantDate,
    expirationDate,
    ...overrides,
  });
}

/**
 * Create a patent with maintenance fee due.
 */
export function createPatentWithMaintenanceDue(
  feeWindow: '3.5' | '7.5' | '11.5',
  overrides: Partial<PatentTestData> = {}
): PatentTestData {
  const now = new Date();
  const yearsAgo = feeWindow === '3.5' ? 3 : feeWindow === '7.5' ? 7 : 11;

  const grantDate = new Date(now);
  grantDate.setFullYear(grantDate.getFullYear() - yearsAgo);
  grantDate.setMonth(grantDate.getMonth() - 5); // 5 months before window opens

  return createGrantedPatent({
    grantDate,
    ...overrides,
  });
}

/**
 * Create multiple patents.
 */
export function createPatents(count: number, overrides: Partial<PatentTestData> = {}): PatentTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createPatent({
      applicationNumber: `17/123,${(456 + i).toString().padStart(3, '0')}`,
      title: `Test Patent ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create patent event payload for EventBridge.
 */
export function createPatentGrantedEventPayload(patent: PatentTestData): Record<string, unknown> {
  return {
    aggregateType: 'Patent',
    aggregateId: patent.id,
    patentNumber: patent.patentNumber,
    applicationNumber: patent.applicationNumber,
    title: patent.title,
    jurisdiction: patent.jurisdiction,
    grantDate: patent.grantDate?.toISOString(),
    entitySize: patent.entitySize,
    inventors: patent.inventors,
  };
}
