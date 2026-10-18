/**
 * DPIA Domain Tests
 * Tests for GDPR Art. 35-36 privacy impact assessment logic
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOverallRisk,
  requiresAuthorityConsultation,
  canSubmitForReview,
  canApprove,
  isTerminal,
  generateAssessmentNumber,
  generateRiskId,
  generateMitigationId,
  type PrivacyImpactAssessment,
  type IdentifiedRisk,
  type Mitigation,
  type ResidualRisk,
} from '../../src/domain/privacy-impact/models/privacy-impact-assessment.js';

describe('DPIA Domain Logic', () => {
  describe('calculateOverallRisk', () => {
    it('should return LOW for LOW likelihood and LOW impact', () => {
      expect(calculateOverallRisk('LOW', 'LOW')).toBe('LOW');
    });

    it('should return LOW for LOW likelihood and MEDIUM impact', () => {
      expect(calculateOverallRisk('LOW', 'MEDIUM')).toBe('LOW');
    });

    it('should return MEDIUM for LOW likelihood and HIGH impact', () => {
      expect(calculateOverallRisk('LOW', 'HIGH')).toBe('MEDIUM');
    });

    it('should return MEDIUM for MEDIUM likelihood and MEDIUM impact', () => {
      expect(calculateOverallRisk('MEDIUM', 'MEDIUM')).toBe('MEDIUM');
    });

    it('should return HIGH for HIGH likelihood and HIGH impact', () => {
      expect(calculateOverallRisk('HIGH', 'HIGH')).toBe('HIGH');
    });

    it('should return CRITICAL for CRITICAL likelihood and CRITICAL impact', () => {
      expect(calculateOverallRisk('CRITICAL', 'CRITICAL')).toBe('CRITICAL');
    });

    it('should return CRITICAL for HIGH likelihood and CRITICAL impact', () => {
      expect(calculateOverallRisk('HIGH', 'CRITICAL')).toBe('CRITICAL');
    });

    it('should return HIGH for CRITICAL likelihood and MEDIUM impact', () => {
      expect(calculateOverallRisk('CRITICAL', 'MEDIUM')).toBe('HIGH');
    });
  });

  describe('requiresAuthorityConsultation', () => {
    const baseDPIA: Omit<PrivacyImpactAssessment, 'risks' | 'residualRisks'> = {
      id: '1',
      entityId: 'entity-1',
      assessmentNumber: 'DPIA-001',
      title: 'Test DPIA',
      description: 'Test DPIA description',
      necessity: 'Necessary for service delivery',
      proportionality: 'Proportionate to risks',
      mitigations: [],
      dpoConsulted: false,
      authorityConsulted: false,
      status: 'IN_PROGRESS',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return true when risks include HIGH overall risk without residual risks', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'High risk',
          likelihood: 'HIGH',
          impact: 'HIGH',
          overallRisk: 'HIGH',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
      };

      expect(requiresAuthorityConsultation(dpia)).toBe(true);
    });

    it('should return true when risks include CRITICAL overall risk without residual risks', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'Critical risk',
          likelihood: 'CRITICAL',
          impact: 'CRITICAL',
          overallRisk: 'CRITICAL',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
      };

      expect(requiresAuthorityConsultation(dpia)).toBe(true);
    });

    it('should return false when all risks are LOW without residual risks', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'Low risk',
          likelihood: 'LOW',
          impact: 'LOW',
          overallRisk: 'LOW',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
      };

      expect(requiresAuthorityConsultation(dpia)).toBe(false);
    });

    it('should return true when residual risks include HIGH level', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'High risk',
          likelihood: 'HIGH',
          impact: 'HIGH',
          overallRisk: 'HIGH',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const residualRisks: ResidualRisk[] = [
        {
          riskId: 'risk-1',
          residualLevel: 'HIGH',
          justification: 'Cannot fully mitigate',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        residualRisks,
      };

      expect(requiresAuthorityConsultation(dpia)).toBe(true);
    });

    it('should return false when residual risks are all LOW/MEDIUM', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'High risk',
          likelihood: 'HIGH',
          impact: 'HIGH',
          overallRisk: 'HIGH',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const residualRisks: ResidualRisk[] = [
        {
          riskId: 'risk-1',
          residualLevel: 'LOW',
          justification: 'Fully mitigated',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        residualRisks,
      };

      expect(requiresAuthorityConsultation(dpia)).toBe(false);
    });
  });

  describe('canSubmitForReview', () => {
    const baseDPIA: Omit<PrivacyImpactAssessment, 'risks' | 'mitigations'> = {
      id: '1',
      entityId: 'entity-1',
      assessmentNumber: 'DPIA-001',
      title: 'Test DPIA',
      description: 'Test DPIA description',
      necessity: 'Necessary for service delivery',
      proportionality: 'Proportionate to risks',
      dpoConsulted: false,
      authorityConsulted: false,
      status: 'IN_PROGRESS',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when no risks are identified', () => {
      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks: [],
        mitigations: [],
      };

      expect(canSubmitForReview(dpia)).toBe(false);
    });

    it('should return true when only LOW risks exist without mitigations', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'Low risk',
          likelihood: 'LOW',
          impact: 'LOW',
          overallRisk: 'LOW',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        mitigations: [],
      };

      expect(canSubmitForReview(dpia)).toBe(true);
    });

    it('should return false when HIGH risk exists without mitigation', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'High risk',
          likelihood: 'HIGH',
          impact: 'HIGH',
          overallRisk: 'HIGH',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        mitigations: [],
      };

      expect(canSubmitForReview(dpia)).toBe(false);
    });

    it('should return true when HIGH risk has mitigation', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'High risk',
          likelihood: 'HIGH',
          impact: 'HIGH',
          overallRisk: 'HIGH',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const mitigations: Mitigation[] = [
        {
          id: 'mit-1',
          riskId: 'risk-1',
          description: 'Encryption',
          type: 'TECHNICAL',
          status: 'PLANNED',
          effectiveness: 'HIGH',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        mitigations,
      };

      expect(canSubmitForReview(dpia)).toBe(true);
    });

    it('should return false when CRITICAL risk exists without mitigation', () => {
      const risks: IdentifiedRisk[] = [
        {
          id: 'risk-1',
          description: 'Critical risk',
          likelihood: 'CRITICAL',
          impact: 'CRITICAL',
          overallRisk: 'CRITICAL',
          affectedRights: ['privacy'],
          category: 'data-processing',
        },
      ];

      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        risks,
        mitigations: [],
      };

      expect(canSubmitForReview(dpia)).toBe(false);
    });
  });

  describe('canApprove', () => {
    const baseDPIA: Omit<PrivacyImpactAssessment, 'status' | 'risks' | 'authorityConsulted'> = {
      id: '1',
      entityId: 'entity-1',
      assessmentNumber: 'DPIA-001',
      title: 'Test DPIA',
      description: 'Test DPIA description',
      necessity: 'Necessary for service delivery',
      proportionality: 'Proportionate to risks',
      mitigations: [],
      dpoConsulted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when status is not PENDING_APPROVAL', () => {
      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        status: 'IN_PROGRESS',
        risks: [],
        authorityConsulted: false,
      };

      expect(canApprove(dpia)).toBe(false);
    });

    it('should return true when PENDING_APPROVAL and no high risks', () => {
      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        status: 'PENDING_APPROVAL',
        risks: [
          {
            id: 'risk-1',
            description: 'Low risk',
            likelihood: 'LOW',
            impact: 'LOW',
            overallRisk: 'LOW',
            affectedRights: ['privacy'],
            category: 'data-processing',
          },
        ],
        authorityConsulted: false,
      };

      expect(canApprove(dpia)).toBe(true);
    });

    it('should return false when authority consultation required but not done', () => {
      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        status: 'PENDING_APPROVAL',
        risks: [
          {
            id: 'risk-1',
            description: 'High risk',
            likelihood: 'HIGH',
            impact: 'HIGH',
            overallRisk: 'HIGH',
            affectedRights: ['privacy'],
            category: 'data-processing',
          },
        ],
        authorityConsulted: false,
      };

      expect(canApprove(dpia)).toBe(false);
    });

    it('should return true when authority consultation required and done', () => {
      const dpia: PrivacyImpactAssessment = {
        ...baseDPIA,
        status: 'PENDING_APPROVAL',
        risks: [
          {
            id: 'risk-1',
            description: 'High risk',
            likelihood: 'HIGH',
            impact: 'HIGH',
            overallRisk: 'HIGH',
            affectedRights: ['privacy'],
            category: 'data-processing',
          },
        ],
        authorityConsulted: true,
      };

      expect(canApprove(dpia)).toBe(true);
    });
  });

  describe('isTerminal', () => {
    const baseDPIA: Omit<PrivacyImpactAssessment, 'status'> = {
      id: '1',
      entityId: 'entity-1',
      assessmentNumber: 'DPIA-001',
      title: 'Test DPIA',
      description: 'Test DPIA description',
      necessity: 'Necessary for service delivery',
      proportionality: 'Proportionate to risks',
      risks: [],
      mitigations: [],
      dpoConsulted: false,
      authorityConsulted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return true for APPROVED status', () => {
      expect(isTerminal({ ...baseDPIA, status: 'APPROVED' })).toBe(true);
    });

    it('should return true for REJECTED status', () => {
      expect(isTerminal({ ...baseDPIA, status: 'REJECTED' })).toBe(true);
    });

    it('should return false for DRAFT status', () => {
      expect(isTerminal({ ...baseDPIA, status: 'DRAFT' })).toBe(false);
    });

    it('should return false for IN_PROGRESS status', () => {
      expect(isTerminal({ ...baseDPIA, status: 'IN_PROGRESS' })).toBe(false);
    });

    it('should return false for PENDING_APPROVAL status', () => {
      expect(isTerminal({ ...baseDPIA, status: 'PENDING_APPROVAL' })).toBe(false);
    });
  });

  describe('ID generators', () => {
    describe('generateAssessmentNumber', () => {
      it('should generate unique assessment numbers', () => {
        const numbers = new Set<string>();
        for (let i = 0; i < 100; i++) {
          numbers.add(generateAssessmentNumber());
        }
        expect(numbers.size).toBe(100);
      });

      it('should start with DPIA- prefix', () => {
        const number = generateAssessmentNumber();
        expect(number.startsWith('DPIA-')).toBe(true);
      });
    });

    describe('generateRiskId', () => {
      it('should generate unique risk IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateRiskId());
        }
        expect(ids.size).toBe(100);
      });

      it('should start with RISK- prefix', () => {
        const id = generateRiskId();
        expect(id.startsWith('RISK-')).toBe(true);
      });
    });

    describe('generateMitigationId', () => {
      it('should generate unique mitigation IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateMitigationId());
        }
        expect(ids.size).toBe(100);
      });

      it('should start with MIT- prefix', () => {
        const id = generateMitigationId();
        expect(id.startsWith('MIT-')).toBe(true);
      });
    });
  });
});
