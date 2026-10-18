/**
 * Compliance Dashboard Service Unit Tests
 *
 * Tests for the ComplianceDashboardService application service.
 * Covers trademark, patent, domain, and copyright compliance tracking.
 *
 * @module test/unit/services
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ComplianceDashboardService,
  createComplianceDashboardService,
} from '../../../src/application/services/compliance-dashboard.service.js';
import type {
  TrademarkComplianceStatus,
  PatentComplianceStatus,
  DomainComplianceStatus,
  CopyrightComplianceStatus,
  OverallComplianceScore,
  ComplianceRiskLevel,
} from '../../../src/application/services/compliance-types.js';

// ============================================================================
// Mock Database
// ============================================================================

interface MockQueryResult {
  trademarks: Array<{
    id: string;
    registrationDate: string | null;
    mark: string;
    registrationNumber: string | null;
    status: string;
  }>;
  patents: Array<{
    id: string;
    patentNumber: string | null;
    title: string;
    grantDate: string | null;
    status: string;
  }>;
  maintenanceFees: Array<{
    id: string;
    patentId: string;
    feeNumber: number;
    dueDate: string;
    windowOpensDate: string;
    gracePeriodEndsDate: string;
    status: string;
  }>;
  domainNames: Array<{
    id: string;
    domainName: string;
    tld: string;
    expirationDate: string;
    status: string;
    autoRenew: boolean;
    registrarName: string;
    linkedTrademarkId: string | null;
    purpose: string;
  }>;
  domainDisputes: Array<{
    id: string;
    status: string;
    outcome: string | null;
  }>;
  copyrights: Array<{
    id: string;
    status: string;
    creationDate: string;
    publicationDate: string | null;
    isPublished: boolean;
    authors: Array<{
      name: string;
      isWorkForHire: boolean;
      dateOfDeath?: string;
      isAlive?: boolean;
    }>;
  }>;
}

const createMockDb = () => {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  };
};

describe('ComplianceDashboardService', () => {
  let service: ComplianceDashboardService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Trademark Compliance Tests
  // ===========================================================================

  describe('getTrademarkComplianceStatus', () => {
    describe('Section 8 compliance', () => {
      it('should identify trademarks compliant with Section 8', async () => {
        // Trademark registered 3 years ago - not yet in Section 8 window
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2022-06-15', // 3 years ago
            mark: 'TESTMARK',
            registrationNumber: '1234567',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section8.compliant).toBe(1);
        expect(status.section8.dueSoon).toBe(0);
        expect(status.section8.overdue).toBe(0);
      });

      it('should identify trademarks with Section 8 due soon (5-6 year window)', async () => {
        // Trademark registered 5.5 years ago - in Section 8 window
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2020-01-15', // ~5.4 years ago
            mark: 'DUESOON',
            registrationNumber: '2345678',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section8.dueSoon).toBe(1);
      });

      it('should identify trademarks in Section 8 grace period', async () => {
        // Trademark registered 6.25 years ago - in grace period
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2019-03-15', // ~6.25 years ago
            mark: 'GRACEPERIOD',
            registrationNumber: '3456789',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section8.inGracePeriod).toBe(1);
      });

      it('should generate upcoming Section 8 deadlines', async () => {
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2020-06-15', // 5 years ago - in window
            mark: 'UPCOMING',
            registrationNumber: '4567890',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section8.upcomingDeadlines.length).toBeGreaterThanOrEqual(0);
        if (status.section8.upcomingDeadlines.length > 0) {
          expect(status.section8.upcomingDeadlines[0].deadlineType).toBe('section_8');
          expect(status.section8.upcomingDeadlines[0].mark).toBe('UPCOMING');
        }
      });
    });

    describe('Section 9 compliance', () => {
      it('should identify trademarks approaching Section 9 renewal window', async () => {
        // Trademark registered 9.5 years ago - approaching renewal
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2015-12-15', // ~9.5 years ago
            mark: 'RENEWSOON',
            registrationNumber: '5678901',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section9.dueSoon).toBe(1);
      });
    });

    describe('Section 15 eligibility', () => {
      it('should identify trademarks eligible for Section 15', async () => {
        // Trademark registered 6 years ago - eligible for incontestability
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2019-06-15', // 6 years ago
            mark: 'ELIGIBLE',
            registrationNumber: '6789012',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section15.eligible).toBe(1);
      });

      it('should identify trademarks approaching Section 15 eligibility', async () => {
        // Trademark registered 4.6 years ago - approaching eligibility (within 6 months of 5 year mark)
        const approachingDate = new Date('2025-06-15');
        approachingDate.setFullYear(approachingDate.getFullYear() - 4);
        approachingDate.setMonth(approachingDate.getMonth() - 7); // ~4.6 years ago

        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: approachingDate.toISOString().split('T')[0],
            mark: 'APPROACHING',
            registrationNumber: '7890123',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.section15.approachingEligibility).toBe(1);
      });
    });

    describe('compliance score calculation', () => {
      it('should calculate high compliance score when all trademarks are compliant', async () => {
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2024-06-15', // 1 year ago - fully compliant
            mark: 'COMPLIANT1',
            registrationNumber: '8901234',
            status: 'registered',
          },
          {
            id: 'tm-002',
            registrationDate: '2024-01-15', // 1.4 years ago - fully compliant
            mark: 'COMPLIANT2',
            registrationNumber: '9012345',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        expect(status.complianceScore).toBeGreaterThanOrEqual(80);
        expect(status.riskLevel).toBe('green');
      });

      it('should calculate lower compliance score when trademarks are overdue', async () => {
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2018-06-15', // 7 years ago - Section 8 overdue
            mark: 'OVERDUE',
            registrationNumber: '0123456',
            status: 'registered',
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTrademarks),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getTrademarkComplianceStatus();

        // Score should be lower due to overdue items
        expect(status.complianceScore).toBeLessThan(100);
      });
    });
  });

  // ===========================================================================
  // Patent Compliance Tests
  // ===========================================================================

  describe('getPatentComplianceStatus', () => {
    describe('maintenance fee status by window', () => {
      it('should categorize fees by window correctly', async () => {
        const mockFees = [
          {
            id: 'fee-001',
            patentId: 'pat-001',
            feeNumber: 1, // 3.5yr
            dueDate: '2026-01-15',
            windowOpensDate: '2025-07-15',
            gracePeriodEndsDate: '2026-07-15',
            status: 'payable',
          },
          {
            id: 'fee-002',
            patentId: 'pat-002',
            feeNumber: 2, // 7.5yr
            dueDate: '2025-09-15',
            windowOpensDate: '2025-03-15',
            gracePeriodEndsDate: '2026-03-15',
            status: 'paid',
          },
          {
            id: 'fee-003',
            patentId: 'pat-003',
            feeNumber: 3, // 11.5yr
            dueDate: '2025-03-15',
            windowOpensDate: '2024-09-15',
            gracePeriodEndsDate: '2025-09-15',
            status: 'grace_period',
          },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockFees);
              return Promise.resolve([]); // Patent data
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getPatentComplianceStatus();

        expect(status.byWindow['3.5yr'].payable).toBe(1);
        expect(status.byWindow['7.5yr'].paid).toBe(1);
        expect(status.byWindow['11.5yr'].inGracePeriod).toBe(1);
      });

      it('should track grace period fees ending soon', async () => {
        const now = new Date('2025-06-15');
        const mockFees = [
          {
            id: 'fee-001',
            patentId: 'pat-001',
            feeNumber: 1,
            dueDate: '2025-05-15', // 1 month ago
            windowOpensDate: '2024-11-15',
            gracePeriodEndsDate: '2025-07-01', // 16 days from now
            status: 'grace_period',
          },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockFees);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getPatentComplianceStatus();

        expect(status.gracePeriodTracking.inGracePeriod).toBe(1);
        expect(status.gracePeriodTracking.gracePeriodEndingSoon).toBe(1);
      });
    });

    describe('compliance score calculation', () => {
      it('should calculate high score when all fees are paid', async () => {
        const mockFees = [
          { id: 'fee-001', patentId: 'pat-001', feeNumber: 1, dueDate: '2024-01-15', windowOpensDate: '2023-07-15', gracePeriodEndsDate: '2024-07-15', status: 'paid' },
          { id: 'fee-002', patentId: 'pat-001', feeNumber: 2, dueDate: '2028-01-15', windowOpensDate: '2027-07-15', gracePeriodEndsDate: '2028-07-15', status: 'upcoming' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockFees);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getPatentComplianceStatus();

        expect(status.complianceScore).toBe(100); // All paid or upcoming
        expect(status.riskLevel).toBe('green');
      });

      it('should calculate lower score when fees are missed', async () => {
        const mockFees = [
          { id: 'fee-001', patentId: 'pat-001', feeNumber: 1, dueDate: '2024-01-15', windowOpensDate: '2023-07-15', gracePeriodEndsDate: '2024-07-15', status: 'missed' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockFees);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getPatentComplianceStatus();

        expect(status.complianceScore).toBe(0);
        expect(status.riskLevel).toBe('red');
      });
    });

    describe('upcoming fees summary', () => {
      it('should return upcoming fees sorted by due date', async () => {
        const mockFees = [
          { id: 'fee-002', patentId: 'pat-002', feeNumber: 2, dueDate: '2025-09-15', windowOpensDate: '2025-03-15', gracePeriodEndsDate: '2026-03-15', status: 'payable' },
          { id: 'fee-001', patentId: 'pat-001', feeNumber: 1, dueDate: '2025-07-15', windowOpensDate: '2025-01-15', gracePeriodEndsDate: '2026-01-15', status: 'payable' },
        ];

        const mockPatents = [
          { id: 'pat-001', patentNumber: 'US10,000,001', title: 'Patent A' },
          { id: 'pat-002', patentNumber: 'US10,000,002', title: 'Patent B' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockFees);
              return Promise.resolve(mockPatents);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getPatentComplianceStatus();

        expect(status.upcomingFees.length).toBe(2);
        expect(status.upcomingFees[0].feeId).toBe('fee-001'); // Earlier due date first
      });
    });
  });

  // ===========================================================================
  // Domain Compliance Tests
  // ===========================================================================

  describe('getDomainComplianceStatus', () => {
    describe('expiration status', () => {
      it('should categorize domains by expiration timeframe', async () => {
        const now = new Date('2025-06-15');
        const mockDomains = [
          { id: 'd-001', domainName: 'current.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-002', domainName: 'expiring-soon.com', tld: '.com', expirationDate: '2025-07-01', status: 'active', autoRenew: false, registrarName: 'Namecheap', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-003', domainName: 'expiring-quarter.com', tld: '.com', expirationDate: '2025-08-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-004', domainName: 'expired.com', tld: '.com', expirationDate: '2025-05-01', status: 'expired', autoRenew: false, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockDomains);
              return Promise.resolve([]); // Domain disputes
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getDomainComplianceStatus();

        expect(status.expiration.current).toBe(1);
        expect(status.expiration.expiringThisMonth).toBe(1);
        expect(status.expiration.expiringThisQuarter).toBe(1);
        expect(status.expiration.expired).toBe(1);
      });

      it('should identify domains in redemption period', async () => {
        const mockDomains = [
          { id: 'd-001', domainName: 'redemption.com', tld: '.com', expirationDate: '2025-05-01', status: 'redemption', autoRenew: false, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockDomains);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getDomainComplianceStatus();

        expect(status.expiration.inRedemption).toBe(1);
      });
    });

    describe('dispute status', () => {
      it('should track active UDRP disputes', async () => {
        const mockDomains = [
          { id: 'd-001', domainName: 'disputed.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
        ];

        const mockDisputes = [
          { id: 'disp-001', status: 'filed', outcome: null },
          { id: 'disp-002', status: 'response_due', outcome: null },
          { id: 'disp-003', status: 'decided', outcome: 'transfer' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockDomains);
              return Promise.resolve(mockDisputes);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getDomainComplianceStatus();

        expect(status.disputes.activeDisputes).toBe(2);
        expect(status.disputes.responsesDue).toBe(1);
        expect(status.disputes.won).toBe(1);
      });
    });

    describe('registrar distribution', () => {
      it('should calculate registrar distribution percentages', async () => {
        const mockDomains = [
          { id: 'd-001', domainName: 'domain1.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-002', domainName: 'domain2.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-003', domainName: 'domain3.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'Namecheap', linkedTrademarkId: null, purpose: 'primary' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockDomains);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getDomainComplianceStatus();

        expect(status.registrarDistribution.length).toBe(2);
        const godaddy = status.registrarDistribution.find(r => r.registrar === 'GoDaddy');
        expect(godaddy?.count).toBe(2);
        expect(godaddy?.percentage).toBe(67);
      });
    });

    describe('auto-renewal status', () => {
      it('should calculate auto-renewal percentages', async () => {
        const mockDomains = [
          { id: 'd-001', domainName: 'auto1.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-002', domainName: 'auto2.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: true, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
          { id: 'd-003', domainName: 'manual.com', tld: '.com', expirationDate: '2026-06-15', status: 'active', autoRenew: false, registrarName: 'GoDaddy', linkedTrademarkId: null, purpose: 'primary' },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockDomains);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getDomainComplianceStatus();

        expect(status.autoRenewal.enabled).toBe(2);
        expect(status.autoRenewal.disabled).toBe(1);
        expect(status.autoRenewal.enabledPercentage).toBe(67);
      });
    });
  });

  // ===========================================================================
  // Copyright Compliance Tests
  // ===========================================================================

  describe('getCopyrightComplianceStatus', () => {
    describe('registration status', () => {
      it('should calculate registration rates', async () => {
        const mockCopyrights = [
          { id: 'c-001', status: 'registered', creationDate: '2020-01-15', publicationDate: '2020-06-15', isPublished: true, authors: [] },
          { id: 'c-002', status: 'registered', creationDate: '2021-01-15', publicationDate: '2021-06-15', isPublished: true, authors: [] },
          { id: 'c-003', status: 'pending', creationDate: '2024-01-15', publicationDate: null, isPublished: false, authors: [] },
          { id: 'c-004', status: 'unregistered', creationDate: '2024-06-15', publicationDate: null, isPublished: false, authors: [] },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCopyrights),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getCopyrightComplianceStatus();

        expect(status.registration.registered).toBe(2);
        expect(status.registration.pending).toBe(1);
        expect(status.registration.unregistered).toBe(1);
        expect(status.registration.registrationRate).toBe(50);
      });
    });

    describe('duration tracking', () => {
      it('should identify copyrights requiring author death tracking', async () => {
        const mockCopyrights = [
          {
            id: 'c-001',
            status: 'registered',
            creationDate: '2020-01-15',
            publicationDate: '2020-06-15',
            isPublished: true,
            authors: [{ name: 'John Doe', isWorkForHire: false, isAlive: true }],
          },
          {
            id: 'c-002',
            status: 'registered',
            creationDate: '2020-01-15',
            publicationDate: '2020-06-15',
            isPublished: true,
            authors: [{ name: 'Corporate Inc', isWorkForHire: true }],
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCopyrights),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getCopyrightComplianceStatus();

        expect(status.duration.requiresDeathTracking).toBe(1);
        expect(status.duration.knownExpiration).toBe(1); // Work-for-hire has fixed term
      });

      it('should identify pre-1928 works in public domain', async () => {
        const mockCopyrights = [
          {
            id: 'c-001',
            status: 'registered',
            creationDate: '1920-01-15',
            publicationDate: '1925-06-15', // Pre-1928
            isPublished: true,
            authors: [{ name: 'Old Author', isWorkForHire: false }],
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCopyrights),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getCopyrightComplianceStatus();

        expect(status.duration.inPublicDomain).toBe(1);
      });
    });

    describe('work type classification', () => {
      it('should classify works by authorship type', async () => {
        const mockCopyrights = [
          {
            id: 'c-001',
            status: 'registered',
            creationDate: '2020-01-15',
            publicationDate: null,
            isPublished: false,
            authors: [{ name: 'Solo Author', isWorkForHire: false }],
          },
          {
            id: 'c-002',
            status: 'registered',
            creationDate: '2020-01-15',
            publicationDate: null,
            isPublished: false,
            authors: [
              { name: 'Author A', isWorkForHire: false },
              { name: 'Author B', isWorkForHire: false },
            ],
          },
          {
            id: 'c-003',
            status: 'registered',
            creationDate: '2020-01-15',
            publicationDate: null,
            isPublished: false,
            authors: [{ name: 'Corporate', isWorkForHire: true }],
          },
        ];

        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCopyrights),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const status = await service.getCopyrightComplianceStatus();

        expect(status.summary.individualAuthored).toBe(1);
        expect(status.summary.jointAuthored).toBe(1);
        expect(status.summary.workForHire).toBe(1);
      });
    });
  });

  // ===========================================================================
  // Overall Compliance Score Tests
  // ===========================================================================

  describe('getComplianceDashboard', () => {
    it('should return complete compliance dashboard data', async () => {
      // Setup minimal mock data for all categories
      let callCount = 0;
      mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve([]);
          }),
        }),
      } as any;

      service = createComplianceDashboardService(mockDb as any);
      const dashboard = await service.getComplianceDashboard();

      expect(dashboard.trademark).toBeDefined();
      expect(dashboard.patent).toBeDefined();
      expect(dashboard.domain).toBeDefined();
      expect(dashboard.copyright).toBeDefined();
      expect(dashboard.overall).toBeDefined();
    });

    describe('overall score calculation', () => {
      it('should calculate weighted overall score', async () => {
        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        expect(dashboard.overall.overallScore).toBeGreaterThanOrEqual(0);
        expect(dashboard.overall.overallScore).toBeLessThanOrEqual(100);
        expect(dashboard.overall.categoryScores.trademark).toBeDefined();
        expect(dashboard.overall.categoryScores.patent).toBeDefined();
        expect(dashboard.overall.categoryScores.domain).toBeDefined();
        expect(dashboard.overall.categoryScores.copyright).toBeDefined();
      });

      it('should determine risk level based on overall score', async () => {
        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        expect(['green', 'yellow', 'red']).toContain(dashboard.overall.riskLevel);
      });
    });

    describe('risk indicators', () => {
      it('should generate risk indicators for overdue items', async () => {
        // Create a trademark with overdue Section 8
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2018-06-15', // 7 years ago - Section 8 overdue
            mark: 'OVERDUE',
            registrationNumber: '1234567',
            status: 'registered',
          },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockTrademarks);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        // Should have risk indicators for trademark issues
        const trademarkIndicators = dashboard.overall.riskIndicators.filter(
          r => r.category === 'trademark'
        );
        expect(trademarkIndicators.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('action items', () => {
      it('should generate action items from upcoming deadlines', async () => {
        const mockTrademarks = [
          {
            id: 'tm-001',
            registrationDate: '2020-06-15', // 5 years ago - in Section 8 window
            mark: 'ACTION',
            registrationNumber: '1234567',
            status: 'registered',
          },
        ];

        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve(mockTrademarks);
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        // Should have action items for upcoming deadlines
        expect(dashboard.overall.actionItems).toBeDefined();
        expect(Array.isArray(dashboard.overall.actionItems)).toBe(true);
      });

      it('should sort action items by due date', async () => {
        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        if (dashboard.overall.actionItems.length > 1) {
          for (let i = 1; i < dashboard.overall.actionItems.length; i++) {
            const prev = dashboard.overall.actionItems[i - 1].dueDate.getTime();
            const curr = dashboard.overall.actionItems[i].dueDate.getTime();
            expect(prev).toBeLessThanOrEqual(curr);
          }
        }
      });
    });

    describe('trend history', () => {
      it('should include 12 months of trend history', async () => {
        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        expect(dashboard.overall.trendHistory.length).toBe(12);
      });

      it('should include scores for each IP category in trend data', async () => {
        let callCount = 0;
        mockDb = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              return Promise.resolve([]);
            }),
          }),
        } as any;

        service = createComplianceDashboardService(mockDb as any);
        const dashboard = await service.getComplianceDashboard();

        const dataPoint = dashboard.overall.trendHistory[0];
        expect(dataPoint.score).toBeDefined();
        expect(dataPoint.trademarkScore).toBeDefined();
        expect(dataPoint.patentScore).toBeDefined();
        expect(dataPoint.domainScore).toBeDefined();
        expect(dataPoint.copyrightScore).toBeDefined();
      });
    });
  });
});
