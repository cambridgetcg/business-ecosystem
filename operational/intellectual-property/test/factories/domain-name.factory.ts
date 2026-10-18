/**
 * Domain Name Test Factory
 *
 * Creates domain name test data with sensible defaults.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';

/**
 * Domain name test data interface.
 */
export interface DomainNameTestData {
  id: string;
  domainName: string;
  registrar: string;
  registrationDate: Date;
  expirationDate: Date;
  status: 'active' | 'pending_transfer' | 'expired' | 'redemption' | 'deleted';
  autoRenew: boolean;
  privacyEnabled: boolean;
  locked: boolean;
  linkedTrademarkId: string | null;
  purpose: 'primary' | 'defensive' | 'product' | 'campaign' | 'redirect';
  nameservers: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Default domain name values.
 */
const defaults: DomainNameTestData = {
  id: '',
  domainName: 'example.com',
  registrar: 'GoDaddy',
  registrationDate: new Date('2020-01-15'),
  expirationDate: new Date('2025-01-15'),
  status: 'active',
  autoRenew: true,
  privacyEnabled: true,
  locked: true,
  linkedTrademarkId: null,
  purpose: 'primary',
  nameservers: ['ns1.example.com', 'ns2.example.com'],
};

/**
 * Create domain name test data.
 */
export function createDomainName(overrides: Partial<DomainNameTestData> = {}): DomainNameTestData {
  return {
    ...defaults,
    id: randomUUID(),
    ...overrides,
  };
}

/**
 * Create a defensive domain registration.
 */
export function createDefensiveDomain(
  trademarkId: string,
  domainName: string = 'brandname.com',
  overrides: Partial<DomainNameTestData> = {}
): DomainNameTestData {
  return createDomainName({
    domainName,
    purpose: 'defensive',
    linkedTrademarkId: trademarkId,
    ...overrides,
  });
}

/**
 * Create an expiring domain.
 */
export function createExpiringDomain(
  daysUntilExpiration: number = 30,
  overrides: Partial<DomainNameTestData> = {}
): DomainNameTestData {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);

  return createDomainName({
    expirationDate,
    autoRenew: false,
    ...overrides,
  });
}

/**
 * Create an expired domain.
 */
export function createExpiredDomain(
  daysExpired: number = 5,
  overrides: Partial<DomainNameTestData> = {}
): DomainNameTestData {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - daysExpired);

  return createDomainName({
    status: 'expired',
    expirationDate,
    ...overrides,
  });
}

/**
 * Create a domain with active dispute.
 */
export interface DomainDisputeTestData {
  id: string;
  domainNameId: string;
  mechanism: 'udrp' | 'urs' | 'acpa' | 'local';
  complainant: string;
  provider: string;
  filingDate: Date;
  responseDeadline: Date;
  status: 'filed' | 'response_due' | 'pending_decision' | 'decided' | 'appealed';
  outcome?: 'transfer' | 'deny' | 'cancel' | null;
  decisionDate?: Date | null;
}

/**
 * Create a UDRP dispute.
 */
export function createUDRPDispute(
  domainNameId: string,
  overrides: Partial<DomainDisputeTestData> = {}
): DomainDisputeTestData {
  const filingDate = new Date();
  const responseDeadline = new Date();
  responseDeadline.setDate(responseDeadline.getDate() + 20);

  return {
    id: randomUUID(),
    domainNameId,
    mechanism: 'udrp',
    complainant: 'Opposing Corp',
    provider: 'WIPO',
    filingDate,
    responseDeadline,
    status: 'response_due',
    outcome: null,
    decisionDate: null,
    ...overrides,
  };
}

/**
 * Create multiple domains.
 */
export function createDomainNames(count: number, overrides: Partial<DomainNameTestData> = {}): DomainNameTestData[] {
  const tlds = ['.com', '.net', '.org', '.io', '.co'];

  return Array.from({ length: count }, (_, i) =>
    createDomainName({
      domainName: `example${i + 1}${tlds[i % tlds.length]}`,
      ...overrides,
    })
  );
}

/**
 * Create domain registered event payload.
 */
export function createDomainRegisteredEventPayload(domain: DomainNameTestData): Record<string, unknown> {
  return {
    aggregateType: 'DomainName',
    aggregateId: domain.id,
    domainName: domain.domainName,
    registrar: domain.registrar,
    registrationDate: domain.registrationDate.toISOString(),
    expirationDate: domain.expirationDate.toISOString(),
    purpose: domain.purpose,
    linkedTrademarkId: domain.linkedTrademarkId,
  };
}

/**
 * Create UDRP filed event payload.
 */
export function createUDRPFiledEventPayload(
  domain: DomainNameTestData,
  dispute: DomainDisputeTestData
): Record<string, unknown> {
  return {
    aggregateType: 'DomainName',
    aggregateId: domain.id,
    domainName: domain.domainName,
    disputeId: dispute.id,
    complainant: dispute.complainant,
    provider: dispute.provider,
    filingDate: dispute.filingDate.toISOString(),
    mechanism: dispute.mechanism,
  };
}
