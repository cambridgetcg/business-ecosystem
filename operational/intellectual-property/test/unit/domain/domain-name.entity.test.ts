/**
 * DomainName Entity Unit Tests
 *
 * Tests for the DomainName domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { DomainName } from '../../../src/domain/entities/domain-name.entity.js';

describe('DomainName Entity', () => {
  const createTestDomain = (overrides: Partial<Parameters<typeof DomainName.create>[0]> = {}) =>
    DomainName.create({
      domainName: 'example.com',
      registrantId: 'entity-corp-123',
      registrarName: 'GoDaddy',
      registrationDate: new Date('2024-01-15'),
      expirationDate: new Date('2025-01-15'),
      ...overrides,
    });

  describe('create', () => {
    it('should create a domain with active status', () => {
      const domain = createTestDomain();

      expect(domain.status).toBe('active');
      expect(domain.domainName).toBe('example.com');
      expect(domain.registrarName).toBe('GoDaddy');
    });

    it('should generate a unique ID', () => {
      const domain1 = createTestDomain();
      const domain2 = createTestDomain();

      expect(domain1.id).toBeDefined();
      expect(domain2.id).toBeDefined();
      expect(domain1.id).not.toBe(domain2.id);
    });

    it('should lowercase the domain name', () => {
      const domain = createTestDomain({ domainName: 'Example.COM' });

      expect(domain.domainName).toBe('example.com');
    });

    it('should extract TLD correctly for simple TLDs', () => {
      const domain = createTestDomain({ domainName: 'example.com' });

      expect(domain.tld).toBe('.com');
    });

    it('should extract TLD correctly for multi-part TLDs', () => {
      const domain = createTestDomain({ domainName: 'example.co.uk' });

      expect(domain.tld).toBe('.co.uk');
    });

    it('should set default purpose to primary', () => {
      const domain = createTestDomain();

      expect(domain.purpose).toBe('primary');
    });

    it('should accept custom purpose', () => {
      const domain = createTestDomain({ purpose: 'defensive' });

      expect(domain.purpose).toBe('defensive');
    });

    it('should enable autoRenew by default', () => {
      const domain = createTestDomain();

      expect(domain.autoRenew).toBe(true);
    });

    it('should enable privacy by default', () => {
      const domain = createTestDomain();

      expect(domain.privacyEnabled).toBe(true);
    });

    it('should enable lock by default', () => {
      const domain = createTestDomain();

      expect(domain.locked).toBe(true);
    });

    it('should disable DNSSEC by default', () => {
      const domain = createTestDomain();

      expect(domain.dnssecEnabled).toBe(false);
    });

    it('should initialize with empty nameservers array', () => {
      const domain = createTestDomain();

      expect(domain.nameservers).toEqual([]);
    });

    it('should accept custom nameservers', () => {
      const domain = createTestDomain({
        nameservers: ['ns1.example.com', 'ns2.example.com'],
      });

      expect(domain.nameservers).toEqual(['ns1.example.com', 'ns2.example.com']);
    });

    it('should emit DomainNameRegistered domain event', () => {
      const domain = createTestDomain();

      const events = domain.domainEvents;
      const registeredEvent = events.find(e => e.type === 'ip.domain_name.registered');

      expect(registeredEvent).toBeDefined();
      expect(registeredEvent?.payload).toMatchObject({
        domainName: 'example.com',
        tld: '.com',
        registrantId: 'entity-corp-123',
        registrarName: 'GoDaddy',
        purpose: 'primary',
      });
    });

    it('should throw error for invalid domain name format', () => {
      expect(() => createTestDomain({ domainName: 'invalid' })).toThrow(
        'Invalid domain name format'
      );
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a domain from persistence', () => {
      const domain = DomainName.reconstitute('existing-id-123', {
        domainName: 'restored.com',
        tld: '.com',
        status: 'active',
        purpose: 'primary',
        registrantId: 'entity-456',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'Namecheap',
        registrarIanaId: '1068',
        registrationDate: new Date('2023-06-01'),
        expirationDate: new Date('2024-06-01'),
        autoRenew: true,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: ['ns1.restored.com'],
      });

      expect(domain.id).toBe('existing-id-123');
      expect(domain.domainName).toBe('restored.com');
      expect(domain.registrarName).toBe('Namecheap');
    });

    it('should not emit events on reconstitution', () => {
      const domain = DomainName.reconstitute('existing-id-123', {
        domainName: 'restored.com',
        tld: '.com',
        status: 'active',
        purpose: 'primary',
        registrantId: 'entity-456',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'Namecheap',
        registrarIanaId: undefined,
        registrationDate: new Date('2023-06-01'),
        expirationDate: new Date('2024-06-01'),
        autoRenew: true,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      expect(domain.domainEvents).toHaveLength(0);
    });
  });

  describe('computed properties', () => {
    it('should correctly calculate isExpired for active domain', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const domain = createTestDomain({ expirationDate: futureDate });

      expect(domain.isExpired).toBe(false);
    });

    it('should correctly calculate isExpired for expired domain', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const domain = createTestDomain({ expirationDate: pastDate });

      expect(domain.isExpired).toBe(true);
    });

    it('should correctly identify defensive registration by purpose', () => {
      const domain = createTestDomain({ purpose: 'defensive' });

      expect(domain.isDefensiveRegistration).toBe(true);
    });

    it('should correctly identify defensive registration by linked trademark', () => {
      const domain = createTestDomain({ linkedTrademarkId: 'tm-123' });

      expect(domain.isDefensiveRegistration).toBe(true);
    });

    it('should correctly identify non-defensive registration', () => {
      const domain = createTestDomain({ purpose: 'primary' });

      expect(domain.isDefensiveRegistration).toBe(false);
    });

    it('should correctly calculate daysUntilExpiration', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const domain = createTestDomain({ expirationDate: futureDate });

      expect(domain.daysUntilExpiration).toBeGreaterThanOrEqual(29);
      expect(domain.daysUntilExpiration).toBeLessThanOrEqual(31);
    });
  });

  describe('renew', () => {
    it('should extend expiration date', () => {
      const domain = createTestDomain();
      const newExpiration = new Date('2026-01-15');

      domain.renew(newExpiration, 'user-1');

      expect(domain.expirationDate.toISOString().split('T')[0]).toBe('2026-01-15');
    });

    it('should reactivate expired domain', () => {
      const domain = DomainName.reconstitute('domain-id', {
        domainName: 'expired.com',
        tld: '.com',
        status: 'expired',
        purpose: 'primary',
        registrantId: 'entity-123',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'GoDaddy',
        registrarIanaId: undefined,
        registrationDate: new Date('2023-01-15'),
        expirationDate: new Date('2024-01-15'),
        autoRenew: false,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      domain.renew(new Date('2025-01-15'), 'user-1');

      expect(domain.status).toBe('active');
    });

    it('should reactivate domain from redemption period', () => {
      const domain = DomainName.reconstitute('domain-id', {
        domainName: 'redemption.com',
        tld: '.com',
        status: 'redemption',
        purpose: 'primary',
        registrantId: 'entity-123',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'GoDaddy',
        registrarIanaId: undefined,
        registrationDate: new Date('2023-01-15'),
        expirationDate: new Date('2024-01-15'),
        autoRenew: false,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      domain.renew(new Date('2025-01-15'), 'user-1');

      expect(domain.status).toBe('active');
    });

    it('should throw error when renewing deleted domain', () => {
      const domain = DomainName.reconstitute('domain-id', {
        domainName: 'deleted.com',
        tld: '.com',
        status: 'deleted',
        purpose: 'primary',
        registrantId: 'entity-123',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'GoDaddy',
        registrarIanaId: undefined,
        registrationDate: new Date('2023-01-15'),
        expirationDate: new Date('2024-01-15'),
        autoRenew: false,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      expect(() => domain.renew(new Date('2025-01-15'), 'user-1')).toThrow(
        'Cannot renew deleted domain'
      );
    });

    it('should emit DomainNameRenewed domain event', () => {
      const domain = createTestDomain();
      domain.pullDomainEvents(); // Clear creation event

      domain.renew(new Date('2026-01-15'), 'user-1');

      const events = domain.domainEvents;
      const renewedEvent = events.find(e => e.type === 'ip.domain_name.renewed');

      expect(renewedEvent).toBeDefined();
      expect(renewedEvent?.payload).toMatchObject({
        domainName: 'example.com',
        newExpiration: new Date('2026-01-15'),
      });
    });

    it('should increment version on renew', () => {
      const domain = createTestDomain();
      const initialVersion = domain.version;

      domain.renew(new Date('2026-01-15'), 'user-1');

      expect(domain.version).toBe(initialVersion + 1);
    });
  });

  describe('initiateTransfer', () => {
    it('should set status to pending_transfer', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');

      domain.initiateTransfer('Namecheap', 'user-1');

      expect(domain.status).toBe('pending_transfer');
    });

    it('should update registrar name', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');

      domain.initiateTransfer('Namecheap', 'user-1');

      expect(domain.registrarName).toBe('Namecheap');
    });

    it('should throw error when domain is locked', () => {
      const domain = createTestDomain();

      expect(() => domain.initiateTransfer('Namecheap', 'user-1')).toThrow(
        'Domain must be unlocked before transfer'
      );
    });

    it('should throw error when domain is not active', () => {
      const domain = DomainName.reconstitute('domain-id', {
        domainName: 'expired.com',
        tld: '.com',
        status: 'expired',
        purpose: 'primary',
        registrantId: 'entity-123',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'GoDaddy',
        registrarIanaId: undefined,
        registrationDate: new Date('2023-01-15'),
        expirationDate: new Date('2024-01-15'),
        autoRenew: false,
        privacyEnabled: true,
        locked: false,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      expect(() => domain.initiateTransfer('Namecheap', 'user-1')).toThrow(
        'Can only transfer active domains'
      );
    });

    it('should emit DomainNameTransferInitiated domain event', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');
      domain.pullDomainEvents(); // Clear previous events

      domain.initiateTransfer('Namecheap', 'user-1');

      const events = domain.domainEvents;
      const transferEvent = events.find(e => e.type === 'ip.domain_name.transfer_initiated');

      expect(transferEvent).toBeDefined();
      expect(transferEvent?.payload).toMatchObject({
        domainName: 'example.com',
        fromRegistrar: 'GoDaddy',
        toRegistrar: 'Namecheap',
      });
    });
  });

  describe('completeTransfer', () => {
    it('should set status back to active', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');
      domain.initiateTransfer('Namecheap', 'user-1');

      domain.completeTransfer('1068', 'user-1');

      expect(domain.status).toBe('active');
    });

    it('should update IANA ID if provided', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');
      domain.initiateTransfer('Namecheap', 'user-1');

      domain.completeTransfer('1068', 'user-1');

      expect(domain.registrarIanaId).toBe('1068');
    });

    it('should throw error when not pending transfer', () => {
      const domain = createTestDomain();

      expect(() => domain.completeTransfer('1068', 'user-1')).toThrow(
        'Domain is not pending transfer'
      );
    });
  });

  describe('cancelTransfer', () => {
    it('should set status back to active', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');
      domain.initiateTransfer('Namecheap', 'user-1');

      domain.cancelTransfer('user-1');

      expect(domain.status).toBe('active');
    });

    it('should throw error when not pending transfer', () => {
      const domain = createTestDomain();

      expect(() => domain.cancelTransfer('user-1')).toThrow(
        'Domain is not pending transfer'
      );
    });
  });

  describe('linkToTrademark', () => {
    it('should set linked trademark ID', () => {
      const domain = createTestDomain();

      domain.linkToTrademark('tm-wordmark-123', undefined, 'user-1');

      expect(domain.linkedTrademarkId).toBe('tm-wordmark-123');
    });

    it('should set defensive notes when provided', () => {
      const domain = createTestDomain();

      domain.linkToTrademark('tm-wordmark-123', 'Defensive registration for brand protection', 'user-1');

      expect(domain.defensiveNotes).toBe('Defensive registration for brand protection');
    });

    it('should change purpose to defensive if currently primary', () => {
      const domain = createTestDomain({ purpose: 'primary' });

      domain.linkToTrademark('tm-wordmark-123', undefined, 'user-1');

      expect(domain.purpose).toBe('defensive');
    });

    it('should not change purpose if not primary', () => {
      const domain = createTestDomain({ purpose: 'regional' });

      domain.linkToTrademark('tm-wordmark-123', undefined, 'user-1');

      expect(domain.purpose).toBe('regional');
    });

    it('should emit DomainNameLinkedToTrademark domain event', () => {
      const domain = createTestDomain();
      domain.pullDomainEvents(); // Clear creation event

      domain.linkToTrademark('tm-wordmark-123', undefined, 'user-1');

      const events = domain.domainEvents;
      const linkedEvent = events.find(e => e.type === 'ip.domain_name.linked_to_trademark');

      expect(linkedEvent).toBeDefined();
      expect(linkedEvent?.payload).toMatchObject({
        domainName: 'example.com',
        trademarkId: 'tm-wordmark-123',
      });
    });
  });

  describe('unlinkFromTrademark', () => {
    it('should clear linked trademark ID', () => {
      const domain = createTestDomain({ linkedTrademarkId: 'tm-123' });

      domain.unlinkFromTrademark('user-1');

      expect(domain.linkedTrademarkId).toBeUndefined();
    });

    it('should clear defensive notes', () => {
      const domain = createTestDomain({
        linkedTrademarkId: 'tm-123',
        defensiveNotes: 'Some notes',
      });

      domain.unlinkFromTrademark('user-1');

      expect(domain.defensiveNotes).toBeUndefined();
    });
  });

  describe('updatePurpose', () => {
    it('should update purpose', () => {
      const domain = createTestDomain();

      domain.updatePurpose('campaign', 'user-1');

      expect(domain.purpose).toBe('campaign');
    });
  });

  describe('lock and unlock', () => {
    it('should lock domain', () => {
      const domain = createTestDomain();
      domain.unlock('user-1');

      domain.lock('user-1');

      expect(domain.locked).toBe(true);
    });

    it('should unlock domain', () => {
      const domain = createTestDomain();

      domain.unlock('user-1');

      expect(domain.locked).toBe(false);
    });
  });

  describe('setAutoRenew', () => {
    it('should enable auto-renew', () => {
      const domain = createTestDomain({ autoRenew: false });

      domain.setAutoRenew(true, 'user-1');

      expect(domain.autoRenew).toBe(true);
    });

    it('should disable auto-renew', () => {
      const domain = createTestDomain({ autoRenew: true });

      domain.setAutoRenew(false, 'user-1');

      expect(domain.autoRenew).toBe(false);
    });
  });

  describe('privacy settings', () => {
    it('should enable privacy', () => {
      const domain = createTestDomain({ privacyEnabled: false });

      domain.enablePrivacy('user-1');

      expect(domain.privacyEnabled).toBe(true);
    });

    it('should disable privacy', () => {
      const domain = createTestDomain({ privacyEnabled: true });

      domain.disablePrivacy('user-1');

      expect(domain.privacyEnabled).toBe(false);
    });
  });

  describe('DNSSEC settings', () => {
    it('should enable DNSSEC', () => {
      const domain = createTestDomain({ dnssecEnabled: false });

      domain.enableDnssec('user-1');

      expect(domain.dnssecEnabled).toBe(true);
    });

    it('should disable DNSSEC', () => {
      const domain = createTestDomain({ dnssecEnabled: true });

      domain.disableDnssec('user-1');

      expect(domain.dnssecEnabled).toBe(false);
    });
  });

  describe('updateNameservers', () => {
    it('should update nameservers', () => {
      const domain = createTestDomain();

      domain.updateNameservers(['ns1.cloudflare.com', 'ns2.cloudflare.com'], 'user-1');

      expect(domain.nameservers).toEqual(['ns1.cloudflare.com', 'ns2.cloudflare.com']);
    });

    it('should replace existing nameservers', () => {
      const domain = createTestDomain({
        nameservers: ['ns1.old.com', 'ns2.old.com'],
      });

      domain.updateNameservers(['ns1.new.com'], 'user-1');

      expect(domain.nameservers).toEqual(['ns1.new.com']);
    });
  });

  describe('markExpired', () => {
    it('should set status to expired', () => {
      const domain = createTestDomain();

      domain.markExpired('user-1');

      expect(domain.status).toBe('expired');
    });
  });

  describe('enterRedemption', () => {
    it('should set status to redemption', () => {
      const domain = createTestDomain();
      domain.markExpired('user-1');

      domain.enterRedemption('user-1');

      expect(domain.status).toBe('redemption');
    });

    it('should throw error if not expired', () => {
      const domain = createTestDomain();

      expect(() => domain.enterRedemption('user-1')).toThrow(
        'Only expired domains can enter redemption'
      );
    });
  });

  describe('markDeleted', () => {
    it('should set status to deleted', () => {
      const domain = createTestDomain();

      domain.markDeleted('user-1');

      expect(domain.status).toBe('deleted');
    });

    it('should set deletedAt timestamp', () => {
      const domain = createTestDomain();

      domain.markDeleted('user-1');

      expect(domain.isDeleted()).toBe(true);
    });
  });

  describe('updateContacts', () => {
    it('should update admin contact', () => {
      const domain = createTestDomain();

      domain.updateContacts({ adminContactId: 'admin-contact-456' }, 'user-1');

      expect(domain.adminContactId).toBe('admin-contact-456');
    });

    it('should update tech contact', () => {
      const domain = createTestDomain();

      domain.updateContacts({ techContactId: 'tech-contact-789' }, 'user-1');

      expect(domain.techContactId).toBe('tech-contact-789');
    });

    it('should update both contacts at once', () => {
      const domain = createTestDomain();

      domain.updateContacts(
        {
          adminContactId: 'admin-contact-456',
          techContactId: 'tech-contact-789',
        },
        'user-1'
      );

      expect(domain.adminContactId).toBe('admin-contact-456');
      expect(domain.techContactId).toBe('tech-contact-789');
    });

    it('should not modify contacts not included in update', () => {
      const domain = createTestDomain({
        adminContactId: 'existing-admin',
        techContactId: 'existing-tech',
      });

      domain.updateContacts({ adminContactId: 'new-admin' }, 'user-1');

      expect(domain.adminContactId).toBe('new-admin');
      expect(domain.techContactId).toBe('existing-tech');
    });
  });

  describe('version tracking', () => {
    it('should start at version 1', () => {
      const domain = createTestDomain();

      expect(domain.version).toBe(1);
    });

    it('should increment version on any modification', () => {
      const domain = createTestDomain();
      const initialVersion = domain.version;

      domain.updatePurpose('redirect', 'user-1');

      expect(domain.version).toBe(initialVersion + 1);
    });

    it('should track multiple version increments', () => {
      const domain = createTestDomain();

      domain.updatePurpose('redirect', 'user-1');
      domain.enableDnssec('user-1');
      domain.unlock('user-1');

      expect(domain.version).toBe(4); // Initial 1 + 3 modifications
    });
  });

  describe('entity equality', () => {
    it('should consider domains with same ID as equal', () => {
      const domain1 = DomainName.reconstitute('same-id', {
        domainName: 'domain1.com',
        tld: '.com',
        status: 'active',
        purpose: 'primary',
        registrantId: 'entity-1',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'GoDaddy',
        registrarIanaId: undefined,
        registrationDate: new Date(),
        expirationDate: new Date(),
        autoRenew: true,
        privacyEnabled: true,
        locked: true,
        dnssecEnabled: false,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      const domain2 = DomainName.reconstitute('same-id', {
        domainName: 'domain2.com',
        tld: '.com',
        status: 'expired',
        purpose: 'defensive',
        registrantId: 'entity-2',
        adminContactId: undefined,
        techContactId: undefined,
        registrarName: 'Namecheap',
        registrarIanaId: undefined,
        registrationDate: new Date(),
        expirationDate: new Date(),
        autoRenew: false,
        privacyEnabled: false,
        locked: false,
        dnssecEnabled: true,
        linkedTrademarkId: undefined,
        defensiveNotes: undefined,
        nameservers: [],
      });

      expect(domain1.equals(domain2)).toBe(true);
    });

    it('should consider domains with different IDs as not equal', () => {
      const domain1 = createTestDomain();
      const domain2 = createTestDomain();

      expect(domain1.equals(domain2)).toBe(false);
    });
  });

  describe('nameservers immutability', () => {
    it('should return a copy of nameservers array', () => {
      const domain = createTestDomain({
        nameservers: ['ns1.example.com', 'ns2.example.com'],
      });

      const retrieved = domain.nameservers;
      retrieved.push('ns3.example.com');

      expect(domain.nameservers).toHaveLength(2);
      expect(domain.nameservers).not.toContain('ns3.example.com');
    });
  });
});
