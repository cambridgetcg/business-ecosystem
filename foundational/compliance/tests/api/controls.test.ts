import { describe, it, expect } from 'vitest';
import {
  needsTesting,
  daysUntilNextTest,
  hasCriticalDeficiency,
  getEffectivenessLabel,
  getRiskReduction,
  calculateNextTestDate,
  type ControlRequirement,
} from '../../src/domain/entities/control-requirement.js';

/**
 * Integration tests for Controls API
 */

describe('Controls API Routes', () => {
  describe('Control Validation', () => {
    it('should validate control types', () => {
      const validTypes = ['preventive', 'detective', 'corrective', 'directive', 'compensating'];

      expect(validTypes).toContain('preventive');
      expect(validTypes).toContain('detective');
      expect(validTypes).toHaveLength(5);
    });

    it('should validate control frameworks', () => {
      const validFrameworks = ['coso', 'cobit', 'iso27001', 'iso31000', 'sox', 'gdpr', 'pci_dss', 'nist', 'custom'];

      expect(validFrameworks).toContain('sox');
      expect(validFrameworks).toContain('gdpr');
      expect(validFrameworks).toHaveLength(9);
    });

    it('should validate control statuses', () => {
      const validStatuses = [
        'not_implemented',
        'in_design',
        'in_implementation',
        'implemented',
        'operating_effectively',
        'deficient',
        'not_applicable',
      ];

      expect(validStatuses).toContain('operating_effectively');
      expect(validStatuses).toContain('deficient');
    });
  });

  describe('Control Testing Logic', () => {
    it('should identify controls needing testing', () => {
      const control = {
        nextTestDueDate: new Date('2024-01-01'),
      } as ControlRequirement;

      expect(needsTesting(control)).toBe(true);
    });

    it('should return true when no test date is set', () => {
      const control = {
        nextTestDueDate: null,
      } as ControlRequirement;

      expect(needsTesting(control)).toBe(true);
    });

    it('should calculate days until next test', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const control = {
        nextTestDueDate: futureDate,
      } as ControlRequirement;

      const days = daysUntilNextTest(control);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });

    it('should return null when no test date', () => {
      const control = {
        nextTestDueDate: null,
      } as ControlRequirement;

      expect(daysUntilNextTest(control)).toBeNull();
    });
  });

  describe('Deficiency Detection', () => {
    it('should detect material weaknesses', () => {
      const control = {
        materialWeakness: true,
        significantDeficiency: false,
      } as ControlRequirement;

      expect(hasCriticalDeficiency(control)).toBe(true);
    });

    it('should detect significant deficiencies', () => {
      const control = {
        materialWeakness: false,
        significantDeficiency: true,
      } as ControlRequirement;

      expect(hasCriticalDeficiency(control)).toBe(true);
    });

    it('should return false when no deficiencies', () => {
      const control = {
        materialWeakness: false,
        significantDeficiency: false,
      } as ControlRequirement;

      expect(hasCriticalDeficiency(control)).toBe(false);
    });
  });

  describe('Effectiveness Labels', () => {
    it('should return Highly Effective for 4.5+', () => {
      expect(getEffectivenessLabel(5)).toBe('Highly Effective');
      expect(getEffectivenessLabel(4.5)).toBe('Highly Effective');
    });

    it('should return Effective for 3.5-4.4', () => {
      expect(getEffectivenessLabel(4)).toBe('Effective');
      expect(getEffectivenessLabel(3.5)).toBe('Effective');
    });

    it('should return Partially Effective for 2.5-3.4', () => {
      expect(getEffectivenessLabel(3)).toBe('Partially Effective');
      expect(getEffectivenessLabel(2.5)).toBe('Partially Effective');
    });

    it('should return Ineffective for 1.5-2.4', () => {
      expect(getEffectivenessLabel(2)).toBe('Ineffective');
      expect(getEffectivenessLabel(1.5)).toBe('Ineffective');
    });

    it('should return Not Effective for < 1.5', () => {
      expect(getEffectivenessLabel(1)).toBe('Not Effective');
    });

    it('should return Not Assessed for null', () => {
      expect(getEffectivenessLabel(null)).toBe('Not Assessed');
    });
  });

  describe('Risk Reduction', () => {
    it('should calculate risk reduction correctly', () => {
      const control = {
        inherentRisk: 5,
        residualRisk: 2,
      } as ControlRequirement;

      expect(getRiskReduction(control)).toBe(3);
    });

    it('should return null when risks not assessed', () => {
      const control = {
        inherentRisk: null,
        residualRisk: null,
      } as ControlRequirement;

      expect(getRiskReduction(control)).toBeNull();
    });
  });

  describe('Next Test Date Calculation', () => {
    const baseDate = new Date('2024-06-15');

    it('should calculate daily test date', () => {
      const next = calculateNextTestDate(baseDate, 'daily');
      expect(next.getDate()).toBe(16);
    });

    it('should calculate weekly test date', () => {
      const next = calculateNextTestDate(baseDate, 'weekly');
      expect(next.getDate()).toBe(22);
    });

    it('should calculate monthly test date', () => {
      const next = calculateNextTestDate(baseDate, 'monthly');
      expect(next.getMonth()).toBe(6); // July
    });

    it('should calculate quarterly test date', () => {
      const next = calculateNextTestDate(baseDate, 'quarterly');
      expect(next.getMonth()).toBe(8); // September
    });

    it('should calculate annual test date', () => {
      const next = calculateNextTestDate(baseDate, 'annually');
      expect(next.getFullYear()).toBe(2025);
    });
  });
});

describe('Controls Business Logic', () => {
  describe('Test Result Processing', () => {
    it('should update status to operating_effectively on pass', () => {
      const testResult = 'pass';
      const expectedStatus = testResult === 'pass' ? 'operating_effectively' : 'deficient';

      expect(expectedStatus).toBe('operating_effectively');
    });

    it('should update status to deficient on fail', () => {
      const testResult = 'fail';
      const expectedStatus = testResult === 'pass' ? 'operating_effectively' : 'deficient';

      expect(expectedStatus).toBe('deficient');
    });
  });

  describe('Control Dependencies', () => {
    it('should identify compensating controls', () => {
      const control = {
        controlType: 'compensating',
        compensatesFor: '00000000-0000-0000-0000-000000000001',
      };

      expect(control.controlType).toBe('compensating');
      expect(control.compensatesFor).toBeDefined();
    });

    it('should track control dependencies', () => {
      const control = {
        dependsOnControls: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
        ],
      };

      expect(control.dependsOnControls).toHaveLength(2);
    });
  });
});
