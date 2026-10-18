/**
 * Cross-Border Transfer Domain Tests
 * Tests for GDPR Chapter V transfer logic
 */

import { describe, it, expect } from 'vitest';
import {
  hasAdequacyDecision,
  getAdequacyDecision,
  isUSDataPrivacyFramework,
  requiresTransferImpactAssessment,
  canApprove,
  recommendTransferBasis,
  getTransferComplianceStatus,
  calculateTransferRisk,
  type DataTransfer,
  type TransferImpactAssessment,
} from '../../src/domain/cross-border-transfer/models/data-transfer.js';

describe('Cross-Border Transfer Domain Logic', () => {
  describe('hasAdequacyDecision', () => {
    it('should return true for countries with adequacy decisions', () => {
      expect(hasAdequacyDecision('GB')).toBe(true);
      expect(hasAdequacyDecision('JP')).toBe(true);
      expect(hasAdequacyDecision('CH')).toBe(true);
      expect(hasAdequacyDecision('NZ')).toBe(true);
      expect(hasAdequacyDecision('KR')).toBe(true);
    });

    it('should return false for countries without adequacy decisions', () => {
      expect(hasAdequacyDecision('CN')).toBe(false);
      expect(hasAdequacyDecision('IN')).toBe(false);
      expect(hasAdequacyDecision('BR')).toBe(false);
      expect(hasAdequacyDecision('US')).toBe(false); // US has DPF, not full adequacy
    });

    it('should be case-insensitive', () => {
      expect(hasAdequacyDecision('gb')).toBe(true);
      expect(hasAdequacyDecision('Gb')).toBe(true);
    });
  });

  describe('getAdequacyDecision', () => {
    it('should return decision details for adequacy countries', () => {
      const decision = getAdequacyDecision('GB');
      expect(decision).not.toBeNull();
      expect(decision?.decision).toBe('2021/1772');
    });

    it('should return null for non-adequacy countries', () => {
      expect(getAdequacyDecision('CN')).toBeNull();
      expect(getAdequacyDecision('US')).toBeNull();
    });

    it('should be case-insensitive', () => {
      const decision = getAdequacyDecision('jp');
      expect(decision).not.toBeNull();
      expect(decision?.decision).toBe('2019/419');
    });
  });

  describe('isUSDataPrivacyFramework', () => {
    it('should return true for US with ADEQUACY_DECISION basis', () => {
      expect(isUSDataPrivacyFramework('US', 'ADEQUACY_DECISION')).toBe(true);
    });

    it('should return false for US with other basis', () => {
      expect(isUSDataPrivacyFramework('US', 'STANDARD_CONTRACTUAL_CLAUSES')).toBe(false);
    });

    it('should return false for non-US countries', () => {
      expect(isUSDataPrivacyFramework('GB', 'ADEQUACY_DECISION')).toBe(false);
    });

    it('should be case-insensitive for country code', () => {
      expect(isUSDataPrivacyFramework('us', 'ADEQUACY_DECISION')).toBe(true);
    });
  });

  describe('requiresTransferImpactAssessment', () => {
    const baseTransfer: Omit<DataTransfer, 'destinationCountry' | 'transferBasis'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Transfer',
      description: 'Test transfer description',
      sourceCountry: 'GB',
      recipientName: 'Test Recipient',
      recipientType: 'PROCESSOR',
      dataCategories: ['personal'],
      dataSubjects: ['customers'],
      transferPurposes: ['service delivery'],
      technicalMeasures: [],
      organizationalMeasures: [],
      contractualMeasures: [],
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false for adequacy country', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'JP',
        transferBasis: 'ADEQUACY_DECISION',
      };
      expect(requiresTransferImpactAssessment(transfer)).toBe(false);
    });

    it('should return true for SCC to non-adequacy country', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
      };
      expect(requiresTransferImpactAssessment(transfer)).toBe(true);
    });

    it('should return true for BCR to non-adequacy country', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'IN',
        transferBasis: 'BINDING_CORPORATE_RULES',
      };
      expect(requiresTransferImpactAssessment(transfer)).toBe(true);
    });

    it('should return false for EXPLICIT_CONSENT derogation', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'EXPLICIT_CONSENT',
      };
      expect(requiresTransferImpactAssessment(transfer)).toBe(false);
    });

    it('should return false for CONTRACT_PERFORMANCE derogation', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'CONTRACT_PERFORMANCE',
      };
      expect(requiresTransferImpactAssessment(transfer)).toBe(false);
    });
  });

  describe('canApprove', () => {
    const baseTransfer: Omit<DataTransfer, 'status' | 'transferImpactAssessment' | 'destinationCountry' | 'transferBasis' | 'technicalMeasures'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Transfer',
      description: 'Test transfer description',
      sourceCountry: 'GB',
      recipientName: 'Test Recipient',
      recipientType: 'PROCESSOR',
      dataCategories: ['personal'],
      dataSubjects: ['customers'],
      transferPurposes: ['service delivery'],
      organizationalMeasures: [],
      contractualMeasures: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when status is not PENDING_REVIEW', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'DRAFT',
        destinationCountry: 'JP',
        transferBasis: 'ADEQUACY_DECISION',
        technicalMeasures: [],
      };
      expect(canApprove(transfer)).toBe(false);
    });

    it('should return true for adequacy country with PENDING_REVIEW', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'JP',
        transferBasis: 'ADEQUACY_DECISION',
        technicalMeasures: [],
      };
      expect(canApprove(transfer)).toBe(true);
    });

    it('should return false when TIA required but missing', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        technicalMeasures: [],
      };
      expect(canApprove(transfer)).toBe(false);
    });

    it('should return true when TIA required and present with LOW risk', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'LOW',
        conclusion: 'Acceptable',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: [],
      };
      expect(canApprove(transfer)).toBe(true);
    });

    it('should return false for CRITICAL risk TIA', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'CRITICAL',
        conclusion: 'Unacceptable risk',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: ['encryption'],
      };
      expect(canApprove(transfer)).toBe(false);
    });

    it('should return false for HIGH risk without supplementary measures', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'HIGH',
        conclusion: 'Requires measures',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: [],
      };
      expect(canApprove(transfer)).toBe(false);
    });

    it('should return true for HIGH risk with supplementary measures', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'HIGH',
        conclusion: 'Acceptable with measures',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        status: 'PENDING_REVIEW',
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: ['encryption', 'pseudonymization'],
      };
      expect(canApprove(transfer)).toBe(true);
    });
  });

  describe('recommendTransferBasis', () => {
    it('should recommend ADEQUACY_DECISION for adequacy countries', () => {
      const result = recommendTransferBasis('JP');
      expect(result.recommended).toBe('ADEQUACY_DECISION');
      expect(result.requiresTIA).toBe(false);
    });

    it('should recommend ADEQUACY_DECISION for US with alternatives', () => {
      const result = recommendTransferBasis('US');
      expect(result.recommended).toBe('ADEQUACY_DECISION');
      expect(result.alternatives).toContain('STANDARD_CONTRACTUAL_CLAUSES');
      expect(result.requiresTIA).toBe(true);
    });

    it('should recommend SCC for non-adequacy countries', () => {
      const result = recommendTransferBasis('CN');
      expect(result.recommended).toBe('STANDARD_CONTRACTUAL_CLAUSES');
      expect(result.alternatives).toContain('BINDING_CORPORATE_RULES');
      expect(result.requiresTIA).toBe(true);
    });

    it('should be case-insensitive', () => {
      const result = recommendTransferBasis('jp');
      expect(result.recommended).toBe('ADEQUACY_DECISION');
    });
  });

  describe('getTransferComplianceStatus', () => {
    const baseTransfer: Omit<DataTransfer, 'destinationCountry' | 'transferBasis' | 'basisReference' | 'transferImpactAssessment' | 'technicalMeasures' | 'organizationalMeasures'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Transfer',
      description: 'Test transfer description',
      sourceCountry: 'GB',
      recipientName: 'Test Recipient',
      recipientType: 'PROCESSOR',
      dataCategories: ['personal'],
      dataSubjects: ['customers'],
      transferPurposes: ['service delivery'],
      contractualMeasures: [],
      status: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return compliant for adequacy country with proper basis', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'JP',
        transferBasis: 'ADEQUACY_DECISION',
        technicalMeasures: [],
        organizationalMeasures: [],
      };

      const status = getTransferComplianceStatus(transfer);
      expect(status.compliant).toBe(true);
      expect(status.issues).toHaveLength(0);
    });

    it('should flag invalid adequacy claim', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'ADEQUACY_DECISION',
        technicalMeasures: [],
        organizationalMeasures: [],
      };

      const status = getTransferComplianceStatus(transfer);
      expect(status.compliant).toBe(false);
      expect(status.issues).toContain('Adequacy decision claimed but country has no adequacy decision');
    });

    it('should flag missing TIA', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        basisReference: 'SCC 2021',
        technicalMeasures: [],
        organizationalMeasures: [],
      };

      const status = getTransferComplianceStatus(transfer);
      expect(status.compliant).toBe(false);
      expect(status.issues).toContain('Transfer Impact Assessment required but not completed');
    });

    it('should flag missing SCC reference', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'LOW',
        conclusion: 'Acceptable',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: [],
        organizationalMeasures: [],
      };

      const status = getTransferComplianceStatus(transfer);
      expect(status.issues).toContain('SCC reference/version not specified');
    });

    it('should flag high-risk transfer without supplementary measures', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'HIGH',
        conclusion: 'Requires measures',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        basisReference: 'SCC 2021',
        transferImpactAssessment: tia,
        technicalMeasures: [],
        organizationalMeasures: [],
      };

      const status = getTransferComplianceStatus(transfer);
      expect(status.issues).toContain('High-risk transfer requires supplementary measures');
    });
  });

  describe('calculateTransferRisk', () => {
    const baseTransfer: Omit<DataTransfer, 'destinationCountry' | 'transferBasis' | 'transferImpactAssessment' | 'technicalMeasures'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Transfer',
      description: 'Test transfer description',
      sourceCountry: 'GB',
      recipientName: 'Test Recipient',
      recipientType: 'PROCESSOR',
      dataCategories: ['personal'],
      dataSubjects: ['customers'],
      transferPurposes: ['service delivery'],
      organizationalMeasures: [],
      contractualMeasures: [],
      status: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return LOW for adequacy country', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'JP',
        transferBasis: 'ADEQUACY_DECISION',
        technicalMeasures: [],
      };
      expect(calculateTransferRisk(transfer)).toBe('LOW');
    });

    it('should return MEDIUM for non-adequacy country with TIA', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'LOW',
        conclusion: 'Acceptable',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: ['encryption'],
      };
      expect(calculateTransferRisk(transfer)).toBe('MEDIUM');
    });

    it('should return HIGH for non-adequacy without TIA', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        technicalMeasures: [],
      };
      expect(calculateTransferRisk(transfer)).toBe('HIGH');
    });

    it('should return CRITICAL for TIA with CRITICAL risk', () => {
      const tia: TransferImpactAssessment = {
        assessedAt: new Date(),
        assessedBy: 'user-1',
        recipientCountryLaws: 'Review completed',
        riskLevel: 'CRITICAL',
        conclusion: 'Unacceptable',
      };

      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'CN',
        transferBasis: 'STANDARD_CONTRACTUAL_CLAUSES',
        transferImpactAssessment: tia,
        technicalMeasures: [],
      };
      expect(calculateTransferRisk(transfer)).toBe('CRITICAL');
    });

    it('should increase risk for derogation basis', () => {
      const transfer: DataTransfer = {
        ...baseTransfer,
        destinationCountry: 'JP',
        transferBasis: 'EXPLICIT_CONSENT',
        technicalMeasures: [],
      };
      expect(calculateTransferRisk(transfer)).toBe('LOW'); // Adequacy country but derogation adds 1
    });
  });
});
