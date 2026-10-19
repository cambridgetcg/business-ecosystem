/**
 * Prisma Database Seed
 * 
 * Seeds the database with sample data for development.
 */

import { PrismaClient, ContractType, ContractStatus, PartyType, PartyRole } from '#prisma';
import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample parties
  const parties = await Promise.all(
    Array.from({ length: 10 }, async () => {
      return prisma.party.create({
        data: {
          id: createId(),
          type: faker.helpers.arrayElement(['CUSTOMER', 'VENDOR', 'PARTNER'] as PartyType[]),
          name: faker.company.name(),
          legalName: faker.company.name() + ' LLC',
          taxId: faker.string.alphanumeric(9).toUpperCase(),
          email: faker.internet.email(),
          phone: faker.phone.number(),
          addressLine1: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'US',
          primaryContact: faker.person.fullName(),
          primaryEmail: faker.internet.email(),
        },
      });
    })
  );
  console.log('Created ' + parties.length + ' parties');

  // Create sample contract templates
  const templates = await Promise.all(
    ['Customer Agreement', 'Vendor Agreement', 'NDA', 'Service Agreement'].map(async (name) => {
      return prisma.contractTemplate.create({
        data: {
          id: createId(),
          name,
          description: 'Standard ' + name.toLowerCase() + ' template',
          type: name.includes('Customer') ? 'CUSTOMER' : name.includes('Vendor') ? 'VENDOR' : name.includes('NDA') ? 'NDA' : 'SERVICE_AGREEMENT',
          content: '# ' + name + '\n\nThis is a template for ' + name.toLowerCase() + '.',
          version: '1.0.0',
          isActive: true,
          createdBy: 'system',
        },
      });
    })
  );
  console.log('Created ' + templates.length + ' templates');

  // Create sample contracts
  const contracts = await Promise.all(
    Array.from({ length: 20 }, async (_, i) => {
      const type = faker.helpers.arrayElement(['CUSTOMER', 'VENDOR', 'NDA'] as ContractType[]);
      const status = faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'PENDING_SIGNATURE', 'EXPIRED'] as ContractStatus[]);
      const effectiveDate = faker.date.past({ years: 1 });
      const expiryDate = faker.date.future({ years: 2, refDate: effectiveDate });

      const contract = await prisma.contract.create({
        data: {
          id: createId(),
          contractNumber: type.substring(0, 3) + '-' + new Date().getFullYear() + '-' + String(i + 1).padStart(4, '0'),
          type,
          status,
          title: faker.company.buzzPhrase() + ' Agreement',
          description: faker.lorem.paragraph(),
          effectiveDate,
          expiryDate,
          value: faker.number.float({ min: 10000, max: 1000000, fractionDigits: 2 }),
          currency: 'USD',
          paymentTerms: 'Net 30',
          autoRenewal: faker.datatype.boolean(),
          renewalTermDays: faker.helpers.arrayElement([30, 90, 365]),
          renewalNoticeDays: 30,
          createdBy: 'system',
          signedDate: status === 'ACTIVE' ? faker.date.between({ from: effectiveDate, to: new Date() }) : null,
          parties: {
            create: [
              {
                partyId: faker.helpers.arrayElement(parties).id,
                role: type === 'CUSTOMER' ? 'CLIENT' : type === 'VENDOR' ? 'SERVICE_PROVIDER' : 'OTHER',
                isPrimary: true,
                signedAt: status === 'ACTIVE' ? faker.date.past() : null,
                signedBy: status === 'ACTIVE' ? faker.person.fullName() : null,
              },
            ],
          },
        },
      });

      return contract;
    })
  );
  console.log('Created ' + contracts.length + ' contracts');

  // Create sample legal matters
  const matters = await Promise.all(
    Array.from({ length: 5 }, async (_, i) => {
      return prisma.legalMatter.create({
        data: {
          id: createId(),
          matterNumber: 'MAT-' + new Date().getFullYear() + '-' + String(i + 1).padStart(4, '0'),
          type: faker.helpers.arrayElement(['LITIGATION', 'CONTRACT_DISPUTE', 'COMPLIANCE_INVESTIGATION']),
          status: faker.helpers.arrayElement(['OPEN', 'UNDER_REVIEW', 'IN_NEGOTIATION', 'CLOSED']),
          title: faker.company.buzzPhrase() + ' Matter',
          description: faker.lorem.paragraphs(2),
          priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
          estimatedCost: faker.number.float({ min: 5000, max: 100000, fractionDigits: 2 }),
          createdBy: 'system',
        },
      });
    })
  );
  console.log('Created ' + matters.length + ' legal matters');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
