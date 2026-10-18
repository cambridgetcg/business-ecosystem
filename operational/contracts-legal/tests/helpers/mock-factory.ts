/**
 * Test factories for creating mock data
 */

import { faker } from '@faker-js/faker';
import type { Contract, ContractParty, Party, Prisma } from '@prisma/client';

export type ContractWithParties = Contract & { parties: ContractParty[] };

export function createMockParty(overrides: Partial<Party> = {}): Party {
  return {
    id: faker.string.cuid(),
    type: 'CUSTOMER',
    entityId: faker.string.cuid(),
    name: faker.company.name(),
    legalName: faker.company.name(),
    taxId: faker.string.numeric(9),
    registrationNo: faker.string.alphanumeric(10),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    addressLine1: faker.location.streetAddress(),
    addressLine2: null,
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    postalCode: faker.location.zipCode(),
    country: 'US',
    primaryContact: faker.person.fullName(),
    primaryEmail: faker.internet.email(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockContractParty(
  contractId: string,
  partyId: string,
  overrides: Partial<ContractParty> = {}
): ContractParty {
  return {
    id: faker.string.cuid(),
    contractId,
    partyId,
    role: 'BUYER',
    isPrimary: true,
    signedAt: null,
    signedBy: null,
    signatureRef: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockContract(overrides: Partial<Contract> = {}): Contract {
  const now = new Date();
  return {
    id: faker.string.cuid(),
    contractNumber: `CUS-${now.getFullYear()}-${faker.string.alphanumeric(8).toUpperCase()}`,
    type: 'CUSTOMER',
    status: 'DRAFT',
    title: faker.commerce.productName() + ' Agreement',
    description: faker.lorem.paragraph(),
    effectiveDate: now,
    expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    signedDate: null,
    terminatedDate: null,
    value: new Prisma.Decimal(faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 })),
    currency: 'USD',
    paymentTerms: 'Net 30',
    autoRenewal: false,
    renewalTermDays: 365,
    renewalNoticeDays: 30,
    governingLaw: 'Delaware',
    governingLawCountry: 'US',
    forumSelection: 'State and Federal Courts of Delaware',
    forumSelectionType: 'EXCLUSIVE_FIXED',
    venueCity: 'Wilmington',
    venueState: 'DE',
    venueCountry: 'US',
    arbitrationClause: false,
    arbitrationRules: null,
    arbitrationSeat: null,
    revenueRecognitionMethod: null,
    revenueRecognitionNotes: null,
    templateId: null,
    createdAt: now,
    updatedAt: now,
    createdBy: faker.string.cuid(),
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  };
}

export function createMockContractWithParties(
  contractOverrides: Partial<Contract> = {},
  partyCount: number = 2
): ContractWithParties {
  const contract = createMockContract(contractOverrides);
  const parties: ContractParty[] = [];

  for (let i = 0; i < partyCount; i++) {
    parties.push(
      createMockContractParty(contract.id, faker.string.cuid(), {
        role: i === 0 ? 'BUYER' : 'SELLER',
        isPrimary: i === 0,
      })
    );
  }

  return { ...contract, parties };
}

export function createMockCreateContractInput() {
  return {
    title: faker.commerce.productName() + ' Agreement',
    description: faker.lorem.paragraph(),
    effectiveDate: new Date(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    value: faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 }),
    currency: 'USD',
    paymentTerms: 'Net 30',
    autoRenewal: false,
    renewalTermDays: 365,
    renewalNoticeDays: 30,
    parties: [
      {
        partyId: faker.string.cuid(),
        role: 'BUYER' as const,
        isPrimary: true,
      },
      {
        partyId: faker.string.cuid(),
        role: 'SELLER' as const,
        isPrimary: false,
      },
    ],
  };
}
