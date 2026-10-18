/**
 * Trademark Test Factory
 *
 * Creates trademark test data with sensible defaults.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';

/**
 * Trademark test data interface.
 */
export interface TrademarkTestData {
  id: string;
  applicationNumber: string;
  registrationNumber: string | null;
  mark: string;
  markType: 'word' | 'design' | 'combined' | 'sound' | 'motion';
  jurisdiction: string;
  filingDate: Date;
  registrationDate: Date | null;
  status: 'draft' | 'pending' | 'published' | 'registered' | 'opposed' | 'cancelled' | 'expired';
  classes: number[];
  goodsServices: string;
  owner: string;
  expirationDate: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Default trademark values.
 */
const defaults: TrademarkTestData = {
  id: '',
  applicationNumber: '97/123,456',
  registrationNumber: null,
  mark: 'TESTMARK',
  markType: 'word',
  jurisdiction: 'US',
  filingDate: new Date('2023-03-15'),
  registrationDate: null,
  status: 'pending',
  classes: [9, 42],
  goodsServices: 'Computer software; Software as a service',
  owner: 'Test Corporation',
  expirationDate: null,
};

/**
 * Create trademark test data.
 */
export function createTrademark(overrides: Partial<TrademarkTestData> = {}): TrademarkTestData {
  return {
    ...defaults,
    id: randomUUID(),
    ...overrides,
  };
}

/**
 * Create a registered trademark.
 */
export function createRegisteredTrademark(overrides: Partial<TrademarkTestData> = {}): TrademarkTestData {
  const registrationDate = overrides.registrationDate ?? new Date('2024-01-15');
  const expirationDate = new Date(registrationDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 10);

  return createTrademark({
    registrationNumber: '7,123,456',
    status: 'registered',
    registrationDate,
    expirationDate,
    ...overrides,
  });
}

/**
 * Create a trademark with Section 8 due (US).
 */
export function createTrademarkWithSection8Due(overrides: Partial<TrademarkTestData> = {}): TrademarkTestData {
  const now = new Date();
  const registrationDate = new Date(now);
  registrationDate.setFullYear(registrationDate.getFullYear() - 5);
  registrationDate.setMonth(registrationDate.getMonth() + 3); // 3 months until window opens

  return createRegisteredTrademark({
    jurisdiction: 'US',
    registrationDate,
    ...overrides,
  });
}

/**
 * Create a trademark with renewal due.
 */
export function createTrademarkWithRenewalDue(overrides: Partial<TrademarkTestData> = {}): TrademarkTestData {
  const now = new Date();
  const registrationDate = new Date(now);
  registrationDate.setFullYear(registrationDate.getFullYear() - 10);
  registrationDate.setMonth(registrationDate.getMonth() + 3); // 3 months until due

  return createRegisteredTrademark({
    registrationDate,
    ...overrides,
  });
}

/**
 * Create an opposed trademark.
 */
export function createOpposedTrademark(overrides: Partial<TrademarkTestData> = {}): TrademarkTestData {
  return createTrademark({
    status: 'opposed',
    ...overrides,
  });
}

/**
 * Create multiple trademarks.
 */
export function createTrademarks(count: number, overrides: Partial<TrademarkTestData> = {}): TrademarkTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createTrademark({
      applicationNumber: `97/123,${(456 + i).toString().padStart(3, '0')}`,
      mark: `TESTMARK${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create trademark event payload for EventBridge.
 */
export function createTrademarkRegisteredEventPayload(trademark: TrademarkTestData): Record<string, unknown> {
  return {
    aggregateType: 'Trademark',
    aggregateId: trademark.id,
    registrationNumber: trademark.registrationNumber,
    applicationNumber: trademark.applicationNumber,
    mark: trademark.mark,
    markType: trademark.markType,
    jurisdiction: trademark.jurisdiction,
    registrationDate: trademark.registrationDate?.toISOString(),
    classes: trademark.classes,
    owner: trademark.owner,
  };
}

/**
 * Create opposition filed event payload.
 */
export function createOppositionFiledEventPayload(
  trademark: TrademarkTestData,
  opposer: string = 'Opposing Corp'
): Record<string, unknown> {
  return {
    aggregateType: 'Trademark',
    aggregateId: trademark.id,
    registrationNumber: trademark.registrationNumber,
    mark: trademark.mark,
    jurisdiction: trademark.jurisdiction,
    opposer,
    filingDate: new Date().toISOString(),
  };
}
