/**
 * Standard Essential Patent Entity Unit Tests
 *
 * Tests for the StandardEssentialPatent domain entity.
 * Covers SEP lifecycle, FRAND commitments, pool memberships, and government use rights.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { StandardEssentialPatent } from '../../../src/domain/entities/standard-essential-patent.entity.js';

describe('StandardEssentialPatent Entity', () => {
  const createTestSEP = () => StandardEssentialPatent.create({
    patentId: 'patent-123',
    patentNumber: 'US10,123,456',
    patentTitle: 'Method for 5G NR MIMO Channel Estimation',
    primaryStandard: '3GPP TS 38.211',
    primaryTechnology: '5G',
  });

  describe('create', () => {
    it('should create an SEP with declared_essential status', () => {
      const sep = createTestSEP();

      expect(sep.overallEssentialityStatus).toBe('declared_essential');
      expect(sep.patentNumber).toBe('US10,123,456');
      expect(sep.primaryTechnology).toBe('5G');
    });

    it('should generate a unique ID', () => {
      const sep1 = createTestSEP();
      const sep2 = createTestSEP();

      expect(sep1.id).toBeDefined();
      expect(sep2.id).toBeDefined();
      expect(sep1.id).not.toBe(sep2.id);
    });

    it('should initialize with unknown FRAND status', () => {
      const sep = createTestSEP();

      expect(sep.overallFRANDStatus).toBe('unknown');
      expect(sep.hasFRANDCommitment).toBe(false);
      expect(sep.isRoyaltyFree).toBe(false);
    });

    it('should initialize with empty declarations array', () => {
      const sep = createTestSEP();

      expect(sep.declarations).toHaveLength(0);
    });

    it('should initialize with empty pool memberships', () => {
      const sep = createTestSEP();

      expect(sep.poolMemberships).toHaveLength(0);
    });

    it('should initialize with empty government use rights', () => {
      const sep = createTestSEP();

      expect(sep.governmentUseRights).toHaveLength(0);
    });

    it('should emit SEP.Created domain event', () => {
      const sep = createTestSEP();

      const events = sep.domainEvents;
      const createdEvent = events.find(e => e.type === 'SEP.Created');

      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload).toMatchObject({
        patentId: 'patent-123',
        patentNumber: 'US10,123,456',
        primaryStandard: '3GPP TS 38.211',
        primaryTechnology: '5G',
      });
    });

    it('should create SEP without optional primary standard', () => {
      const sep = StandardEssentialPatent.create({
        patentId: 'patent-456',
        patentNumber: 'EP2,345,678',
        patentTitle: 'Wireless Communication Method',
      });

      expect(sep.primaryStandard).toBeUndefined();
      expect(sep.primaryTechnology).toBeUndefined();
    });
  });

  describe('addDeclaration', () => {
    it('should add an essentiality declaration', () => {
      const sep = createTestSEP();

      const declaration = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        standardVersion: 'Release 15',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
        essentialClaims: [1, 2, 5, 7],
      });

      expect(sep.declarations).toHaveLength(1);
      expect(declaration.id).toBeDefined();
      expect(declaration.standardsBody).toBe('ETSI');
      expect(declaration.frandCommitment).toBe('committed');
    });

    it('should update overall FRAND status to committed after declaration', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      expect(sep.overallFRANDStatus).toBe('committed');
      expect(sep.hasFRANDCommitment).toBe(true);
    });

    it('should update overall FRAND status to royalty_free', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'W3C',
        standard: 'WebRTC 1.0',
        technology: 'Other',
        declarationDate: new Date('2023-06-01'),
        declarant: 'Tech Standards Inc',
        declarationType: 'blanket',
        frandCommitment: 'royalty_free',
        essentialityStatus: 'declared_essential',
      });

      expect(sep.overallFRANDStatus).toBe('royalty_free');
      expect(sep.isRoyaltyFree).toBe(true);
    });

    it('should emit SEP.DeclarationAdded domain event', () => {
      const sep = createTestSEP();
      sep.pullDomainEvents();

      sep.addDeclaration({
        standardsBody: '3GPP',
        standard: 'TS 38.331',
        technology: '5G',
        declarationDate: new Date('2023-04-01'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      const events = sep.domainEvents;
      const declEvent = events.find(e => e.type === 'SEP.DeclarationAdded');

      expect(declEvent).toBeDefined();
      expect(declEvent?.payload).toMatchObject({
        standardsBody: '3GPP',
        standard: 'TS 38.331',
        frandCommitment: 'committed',
      });
    });

    it('should support multiple declarations for different standards bodies', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      sep.addDeclaration({
        standardsBody: 'IEEE',
        standard: 'IEEE 802.11ax',
        technology: 'WiFi',
        declarationDate: new Date('2023-04-20'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'blanket',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      expect(sep.declarations).toHaveLength(2);
    });

    it('should increment version after adding declaration', () => {
      const sep = createTestSEP();
      const props = sep.toPersistence();
      const initialVersion = props.version;

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      const updatedProps = sep.toPersistence();
      expect(updatedProps.version).toBe(initialVersion + 1);
    });
  });

  describe('updateFRANDCommitment', () => {
    it('should update FRAND commitment status for a declaration', () => {
      const sep = createTestSEP();

      const declaration = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });
      sep.pullDomainEvents();

      sep.updateFRANDCommitment(declaration.id, 'disputed');

      expect(sep.declarations[0].frandCommitment).toBe('disputed');
      expect(sep.overallFRANDStatus).toBe('disputed');
    });

    it('should emit SEP.FRANDStatusChanged domain event', () => {
      const sep = createTestSEP();

      const declaration = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });
      sep.pullDomainEvents();

      sep.updateFRANDCommitment(declaration.id, 'withdrawn');

      const events = sep.domainEvents;
      const frandEvent = events.find(e => e.type === 'SEP.FRANDStatusChanged');

      expect(frandEvent).toBeDefined();
      expect(frandEvent?.payload).toMatchObject({
        declarationId: declaration.id,
        previousStatus: 'committed',
        newStatus: 'withdrawn',
      });
    });

    it('should throw if declaration not found', () => {
      const sep = createTestSEP();

      expect(() => sep.updateFRANDCommitment('non-existent-id', 'committed'))
        .toThrow('Declaration non-existent-id not found');
    });
  });

  describe('updateDeclarationStatus', () => {
    it('should update essentiality status to confirmed_essential', () => {
      const sep = createTestSEP();

      const declaration = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      sep.updateDeclarationStatus(declaration.id, 'confirmed_essential', {
        validator: 'Patent Analytics Inc',
        validationDate: new Date('2024-01-10'),
        result: 'essential',
        report: 'Claim chart analysis confirms essentiality',
      });

      expect(sep.declarations[0].essentialityStatus).toBe('confirmed_essential');
      expect(sep.isConfirmedEssential).toBe(true);
      expect(sep.overallEssentialityStatus).toBe('confirmed_essential');
    });

    it('should emit SEP.EssentialityStatusChanged domain event', () => {
      const sep = createTestSEP();

      const declaration = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });
      sep.pullDomainEvents();

      sep.updateDeclarationStatus(declaration.id, 'non_essential');

      const events = sep.domainEvents;
      const statusEvent = events.find(e => e.type === 'SEP.EssentialityStatusChanged');

      expect(statusEvent).toBeDefined();
      expect(statusEvent?.payload).toMatchObject({
        declarationId: declaration.id,
        newStatus: 'non_essential',
        validated: false,
      });
    });

    it('should throw if declaration not found', () => {
      const sep = createTestSEP();

      expect(() => sep.updateDeclarationStatus('non-existent-id', 'confirmed_essential'))
        .toThrow('Declaration non-existent-id not found');
    });
  });

  describe('joinPool', () => {
    it('should add patent to licensing pool', () => {
      const sep = createTestSEP();

      const membership = sep.joinPool({
        poolName: 'MPEG LA AVC/H.264 Patent Pool',
        poolAdministrator: 'MPEG LA, LLC',
        joinDate: new Date('2023-06-01'),
        royaltyRate: {
          rate: 0.20,
          basis: 'per_unit',
          currency: 'USD',
          cap: 25000000,
        },
        contributionShare: 2.5,
        licensedTerritories: ['US', 'EP', 'CN', 'JP', 'KR'],
      });

      expect(sep.poolMemberships).toHaveLength(1);
      expect(membership.id).toBeDefined();
      expect(membership.status).toBe('active');
      expect(membership.poolName).toBe('MPEG LA AVC/H.264 Patent Pool');
    });

    it('should emit SEP.JoinedPool domain event', () => {
      const sep = createTestSEP();
      sep.pullDomainEvents();

      sep.joinPool({
        poolName: 'Via Licensing WiFi Patent Pool',
        poolAdministrator: 'Via Licensing Corporation',
        joinDate: new Date('2023-07-15'),
        licensedTerritories: ['Worldwide'],
      });

      const events = sep.domainEvents;
      const poolEvent = events.find(e => e.type === 'SEP.JoinedPool');

      expect(poolEvent).toBeDefined();
      expect(poolEvent?.payload).toMatchObject({
        poolName: 'Via Licensing WiFi Patent Pool',
        poolAdministrator: 'Via Licensing Corporation',
      });
    });

    it('should support multiple pool memberships', () => {
      const sep = createTestSEP();

      sep.joinPool({
        poolName: 'Pool A',
        poolAdministrator: 'Admin A',
        joinDate: new Date('2023-01-01'),
        licensedTerritories: ['US'],
      });

      sep.joinPool({
        poolName: 'Pool B',
        poolAdministrator: 'Admin B',
        joinDate: new Date('2023-02-01'),
        licensedTerritories: ['EP'],
      });

      expect(sep.poolMemberships).toHaveLength(2);
    });
  });

  describe('exitPool', () => {
    it('should mark pool membership as inactive', () => {
      const sep = createTestSEP();

      const membership = sep.joinPool({
        poolName: 'HEVC Advance Patent Pool',
        poolAdministrator: 'HEVC Advance LLC',
        joinDate: new Date('2022-01-15'),
        licensedTerritories: ['Worldwide'],
      });

      sep.exitPool(membership.id, new Date('2024-01-15'));

      expect(sep.poolMemberships[0].status).toBe('inactive');
      expect(sep.poolMemberships[0].exitDate).toEqual(new Date('2024-01-15'));
    });

    it('should emit SEP.ExitedPool domain event', () => {
      const sep = createTestSEP();

      const membership = sep.joinPool({
        poolName: 'HEVC Advance Patent Pool',
        poolAdministrator: 'HEVC Advance LLC',
        joinDate: new Date('2022-01-15'),
        licensedTerritories: ['Worldwide'],
      });
      sep.pullDomainEvents();

      sep.exitPool(membership.id, new Date('2024-01-15'));

      const events = sep.domainEvents;
      const exitEvent = events.find(e => e.type === 'SEP.ExitedPool');

      expect(exitEvent).toBeDefined();
      expect(exitEvent?.payload).toMatchObject({
        poolName: 'HEVC Advance Patent Pool',
        exitDate: '2024-01-15T00:00:00.000Z',
      });
    });

    it('should throw if pool membership not found', () => {
      const sep = createTestSEP();

      expect(() => sep.exitPool('non-existent-id', new Date()))
        .toThrow('Pool membership non-existent-id not found');
    });
  });

  describe('addGovernmentUseRight', () => {
    it('should record government use right for defense purposes', () => {
      const sep = createTestSEP();

      const right = sep.addGovernmentUseRight({
        governmentEntity: 'U.S. Department of Defense',
        country: 'US',
        grantDate: new Date('2023-09-01'),
        scope: 'defense',
        compensation: {
          amount: 500000,
          currency: 'USD',
          basis: 'annual royalty',
        },
        legalBasis: '28 USC 1498',
        notes: 'Licensed for military communication systems',
      });

      expect(sep.governmentUseRights).toHaveLength(1);
      expect(right.id).toBeDefined();
      expect(right.scope).toBe('defense');
      expect(right.legalBasis).toBe('28 USC 1498');
    });

    it('should record compulsory license for health emergency', () => {
      const sep = createTestSEP();

      const right = sep.addGovernmentUseRight({
        governmentEntity: 'Ministry of Health',
        country: 'BR',
        grantDate: new Date('2023-06-15'),
        expirationDate: new Date('2026-06-15'),
        scope: 'health_emergency',
        compensation: {
          amount: 2,
          currency: 'BRL',
          basis: 'percentage of net sales',
        },
        legalBasis: 'TRIPS Art. 31',
        notes: 'COVID-19 pandemic response',
      });

      expect(right.scope).toBe('health_emergency');
      expect(right.expirationDate).toEqual(new Date('2026-06-15'));
    });

    it('should emit SEP.GovernmentUseGranted domain event', () => {
      const sep = createTestSEP();
      sep.pullDomainEvents();

      sep.addGovernmentUseRight({
        governmentEntity: 'UK Crown',
        country: 'GB',
        grantDate: new Date('2023-11-01'),
        scope: 'general_government',
        legalBasis: 'Patents Act 1977, Sections 55-59',
      });

      const events = sep.domainEvents;
      const govEvent = events.find(e => e.type === 'SEP.GovernmentUseGranted');

      expect(govEvent).toBeDefined();
      expect(govEvent?.payload).toMatchObject({
        governmentEntity: 'UK Crown',
        country: 'GB',
        scope: 'general_government',
      });
    });

    it('should support multiple government use rights', () => {
      const sep = createTestSEP();

      sep.addGovernmentUseRight({
        governmentEntity: 'U.S. Government',
        country: 'US',
        grantDate: new Date('2023-01-01'),
        scope: 'defense',
        legalBasis: '28 USC 1498',
      });

      sep.addGovernmentUseRight({
        governmentEntity: 'German Federal Government',
        country: 'DE',
        grantDate: new Date('2023-03-01'),
        scope: 'general_government',
        legalBasis: 'PatG Section 13',
      });

      expect(sep.governmentUseRights).toHaveLength(2);
    });
  });

  describe('addDispute', () => {
    it('should record FRAND rate dispute', () => {
      const sep = createTestSEP();

      sep.addDispute({
        counterparty: 'Competitor Tech Inc',
        disputeType: 'frand_rate',
        startDate: new Date('2024-01-10'),
      });

      expect(sep.disputeHistory).toHaveLength(1);
      expect(sep.disputeHistory[0].status).toBe('pending');
      expect(sep.disputeHistory[0].disputeType).toBe('frand_rate');
    });

    it('should record essentiality dispute', () => {
      const sep = createTestSEP();

      sep.addDispute({
        counterparty: 'Patent Challenger LLC',
        disputeType: 'essentiality',
        startDate: new Date('2024-02-15'),
      });

      expect(sep.disputeHistory[0].disputeType).toBe('essentiality');
    });

    it('should emit SEP.DisputeFiled domain event', () => {
      const sep = createTestSEP();
      sep.pullDomainEvents();

      sep.addDispute({
        counterparty: 'Implementer Corp',
        disputeType: 'hold_out',
        startDate: new Date('2024-03-01'),
      });

      const events = sep.domainEvents;
      const disputeEvent = events.find(e => e.type === 'SEP.DisputeFiled');

      expect(disputeEvent).toBeDefined();
      expect(disputeEvent?.payload).toMatchObject({
        counterparty: 'Implementer Corp',
        disputeType: 'hold_out',
      });
    });
  });

  describe('resolveDispute', () => {
    it('should resolve dispute with outcome', () => {
      const sep = createTestSEP();

      sep.addDispute({
        counterparty: 'Competitor Tech Inc',
        disputeType: 'frand_rate',
        startDate: new Date('2024-01-10'),
      });
      const disputeId = sep.disputeHistory[0].id;

      sep.resolveDispute(disputeId, 'Settlement at $0.50 per unit', new Date('2024-06-15'));

      expect(sep.disputeHistory[0].status).toBe('settled');
      expect(sep.disputeHistory[0].outcome).toBe('Settlement at $0.50 per unit');
      expect(sep.disputeHistory[0].endDate).toEqual(new Date('2024-06-15'));
    });

    it('should throw if dispute not found', () => {
      const sep = createTestSEP();

      expect(() => sep.resolveDispute('non-existent-id', 'outcome', new Date()))
        .toThrow('Dispute non-existent-id not found');
    });
  });

  describe('setLicensingTerms', () => {
    it('should set published licensing terms', () => {
      const sep = createTestSEP();

      sep.setLicensingTerms({
        publishedRate: 0.50,
        rateBasis: 'USD per unit',
        licensingGuide: 'https://example.com/frand-licensing',
        availableLicenses: ['device', 'component'],
      });

      expect(sep.licensingTerms).toBeDefined();
      expect(sep.licensingTerms?.publishedRate).toBe(0.50);
      expect(sep.licensingTerms?.availableLicenses).toContain('device');
    });

    it('should emit SEP.LicensingTermsPublished domain event', () => {
      const sep = createTestSEP();
      sep.pullDomainEvents();

      sep.setLicensingTerms({
        publishedRate: 1.50,
        rateBasis: 'percentage of device ASP',
        availableLicenses: ['device', 'component', 'access_level'],
      });

      const events = sep.domainEvents;
      const termsEvent = events.find(e => e.type === 'SEP.LicensingTermsPublished');

      expect(termsEvent).toBeDefined();
      expect(termsEvent?.payload).toMatchObject({
        publishedRate: 1.50,
        rateBasis: 'percentage of device ASP',
        availableLicenses: ['device', 'component', 'access_level'],
      });
    });
  });

  describe('overall status calculations', () => {
    it('should set overall FRAND status to committed when any declaration is committed', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: 'Standard A',
        technology: '5G',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'specific',
        frandCommitment: 'no_commitment',
        essentialityStatus: 'declared_essential',
      });

      sep.addDeclaration({
        standardsBody: 'IEEE',
        standard: 'Standard B',
        technology: 'WiFi',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'blanket',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      expect(sep.overallFRANDStatus).toBe('committed');
    });

    it('should set overall essentiality status to confirmed when any is confirmed', () => {
      const sep = createTestSEP();

      const decl1 = sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: 'Standard A',
        technology: '5G',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      sep.addDeclaration({
        standardsBody: 'IEEE',
        standard: 'Standard B',
        technology: 'WiFi',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'blanket',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      sep.updateDeclarationStatus(decl1.id, 'confirmed_essential');

      expect(sep.overallEssentialityStatus).toBe('confirmed_essential');
      expect(sep.isConfirmedEssential).toBe(true);
    });

    it('should prioritize disputed FRAND status appropriately', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: 'Standard A',
        technology: '5G',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'specific',
        frandCommitment: 'disputed',
        essentialityStatus: 'declared_essential',
      });

      // committed takes precedence over disputed
      sep.addDeclaration({
        standardsBody: 'IEEE',
        standard: 'Standard B',
        technology: 'WiFi',
        declarationDate: new Date(),
        declarant: 'Declarant A',
        declarationType: 'blanket',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      expect(sep.overallFRANDStatus).toBe('committed');
    });
  });

  describe('fromPersistence', () => {
    it('should reconstitute SEP from persistence data', () => {
      const persistedData = {
        id: 'sep-reconstitute-123',
        patentId: 'patent-789',
        patentNumber: 'US11,222,333',
        patentTitle: 'LTE Channel Encoding Method',
        declarations: [{
          id: 'decl-1',
          standardsBody: 'ETSI' as const,
          standard: '3GPP TS 36.212',
          technology: '4G_LTE' as const,
          declarationDate: new Date('2022-01-15'),
          declarant: 'Tech Corp',
          declarationType: 'specific' as const,
          frandCommitment: 'committed' as const,
          essentialityStatus: 'confirmed_essential' as const,
        }],
        poolMemberships: [],
        governmentUseRights: [],
        primaryStandard: '3GPP TS 36.212',
        primaryTechnology: '4G_LTE' as const,
        overallFRANDStatus: 'committed' as const,
        overallEssentialityStatus: 'confirmed_essential' as const,
        disputeHistory: [],
        createdAt: new Date('2022-01-01'),
        updatedAt: new Date('2024-01-01'),
        version: 5,
      };

      const sep = StandardEssentialPatent.fromPersistence(persistedData);

      expect(sep.id).toBe('sep-reconstitute-123');
      expect(sep.patentNumber).toBe('US11,222,333');
      expect(sep.declarations).toHaveLength(1);
      expect(sep.overallFRANDStatus).toBe('committed');
      expect(sep.isConfirmedEssential).toBe(true);
    });
  });

  describe('toPersistence', () => {
    it('should return all properties for persistence', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date('2023-03-15'),
        declarant: 'Acme Wireless Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      sep.joinPool({
        poolName: '5G Patent Pool',
        poolAdministrator: 'Sisvel',
        joinDate: new Date('2023-06-01'),
        licensedTerritories: ['Worldwide'],
      });

      const props = sep.toPersistence();

      expect(props.id).toBe(sep.id);
      expect(props.patentNumber).toBe('US10,123,456');
      expect(props.declarations).toHaveLength(1);
      expect(props.poolMemberships).toHaveLength(1);
      expect(props.overallFRANDStatus).toBe('committed');
    });
  });

  describe('getters return defensive copies', () => {
    it('should return copy of declarations array', () => {
      const sep = createTestSEP();

      sep.addDeclaration({
        standardsBody: 'ETSI',
        standard: '3GPP TS 38.211',
        technology: '5G',
        declarationDate: new Date(),
        declarant: 'Test Corp',
        declarationType: 'specific',
        frandCommitment: 'committed',
        essentialityStatus: 'declared_essential',
      });

      const declarations = sep.declarations;
      declarations.push({} as any);

      expect(sep.declarations).toHaveLength(1);
    });

    it('should return copy of poolMemberships array', () => {
      const sep = createTestSEP();

      sep.joinPool({
        poolName: 'Test Pool',
        poolAdministrator: 'Admin',
        joinDate: new Date(),
        licensedTerritories: ['US'],
      });

      const memberships = sep.poolMemberships;
      memberships.push({} as any);

      expect(sep.poolMemberships).toHaveLength(1);
    });

    it('should return copy of governmentUseRights array', () => {
      const sep = createTestSEP();

      sep.addGovernmentUseRight({
        governmentEntity: 'Test Gov',
        country: 'US',
        grantDate: new Date(),
        scope: 'defense',
        legalBasis: 'Test Law',
      });

      const rights = sep.governmentUseRights;
      rights.push({} as any);

      expect(sep.governmentUseRights).toHaveLength(1);
    });

    it('should return copy of disputeHistory array', () => {
      const sep = createTestSEP();

      sep.addDispute({
        counterparty: 'Test Party',
        disputeType: 'frand_rate',
        startDate: new Date(),
      });

      const history = sep.disputeHistory;
      history.push({} as any);

      expect(sep.disputeHistory).toHaveLength(1);
    });
  });
});
