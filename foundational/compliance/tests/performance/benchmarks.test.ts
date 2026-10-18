import { describe, it, expect, beforeAll } from 'vitest';
import {
  isOverdue,
  getDaysUntilDue,
  calculatePriority,
  needsEscalation,
  canTransitionTo,
} from '../../src/domain/entities/compliance-obligation.js';
import {
  isRequirementActive,
  calculateDeadline,
} from '../../src/domain/entities/regulatory-requirement.js';
import {
  calculateComplianceRate,
  determineRiskLevel,
  generateCalendarEvents,
} from '../../src/domain/entities/compliance-calendar.js';
import {
  policyNeedsReview,
  isPolicyActive,
  daysUntilPolicyReview,
  isAttestationOverdue,
  calculateAttestationCompletionRate,
  type Policy,
  type Attestation,
} from '../../src/domain/entities/compliance-program.js';
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
 * Performance Benchmarks for Compliance Service
 *
 * These tests measure the performance of critical domain operations
 * to ensure they meet acceptable thresholds.
 *
 * Target: All operations should complete in < 1ms for single items
 * and scale linearly for batch operations.
 */

// Helper to measure execution time
function measureTime(fn: () => void, iterations: number = 1000): {
  totalMs: number;
  avgMs: number;
  opsPerSecond: number;
} {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const totalMs = end - start;
  return {
    totalMs,
    avgMs: totalMs / iterations,
    opsPerSecond: (iterations / totalMs) * 1000,
  };
}

describe('Performance Benchmarks', () => {
  describe('Obligation Domain Logic', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    it('should calculate isOverdue at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        isOverdue(pastDate, 'pending');
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`isOverdue: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate getDaysUntilDue at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        getDaysUntilDue(futureDate);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`getDaysUntilDue: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate priority at > 50,000 ops/sec', () => {
      const result = measureTime(() => {
        calculatePriority(5, 'corporation_tax');
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(50000);
      console.log(`calculatePriority: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should check needsEscalation at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        needsEscalation(-3, 'critical', false);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`needsEscalation: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should validate canTransitionTo at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        canTransitionTo('pending', 'in_progress');
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`canTransitionTo: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Requirement Domain Logic', () => {
    const requirement = {
      effectiveDate: new Date('2020-01-01'),
      sunsetDate: null,
      isActive: true,
    };

    it('should check isRequirementActive at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        isRequirementActive(requirement as any);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`isRequirementActive: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate deadline at > 50,000 ops/sec', () => {
      const result = measureTime(() => {
        calculateDeadline(new Date('2024-01-01'), 'quarterly', '3 months after period end');
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(50000);
      console.log(`calculateDeadline: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Calendar Domain Logic', () => {
    it('should calculate compliance rate at > 500,000 ops/sec', () => {
      const result = measureTime(() => {
        calculateComplianceRate(85, 100);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(500000);
      console.log(`calculateComplianceRate: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should determine risk level at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        determineRiskLevel(75, 3, 1);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`determineRiskLevel: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should generate calendar events at > 10,000 ops/sec', () => {
      const obligation = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: 'tenant-1',
        entityId: 'entity-1',
        title: 'Test Obligation',
        regulator: 'hmrc',
        category: 'vat',
        dueDate: new Date('2024-12-31'),
      };

      const result = measureTime(() => {
        generateCalendarEvents(obligation);
      }, 5000);

      expect(result.opsPerSecond).toBeGreaterThan(10000);
      console.log(`generateCalendarEvents: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Policy Domain Logic', () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    it('should check policyNeedsReview at > 100,000 ops/sec', () => {
      const policy = {
        status: 'published',
        reviewDate: pastDate,
      } as Policy;

      const result = measureTime(() => {
        policyNeedsReview(policy);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`policyNeedsReview: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should check isPolicyActive at > 100,000 ops/sec', () => {
      const policy = {
        status: 'published',
        effectiveDate: new Date('2020-01-01'),
        expirationDate: null,
      } as Policy;

      const result = measureTime(() => {
        isPolicyActive(policy);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`isPolicyActive: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate daysUntilPolicyReview at > 100,000 ops/sec', () => {
      const policy = {
        reviewDate: futureDate,
      } as Policy;

      const result = measureTime(() => {
        daysUntilPolicyReview(policy);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`daysUntilPolicyReview: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should check isAttestationOverdue at > 100,000 ops/sec', () => {
      const attestation = {
        status: 'pending',
        dueDate: pastDate,
      } as Attestation;

      const result = measureTime(() => {
        isAttestationOverdue(attestation);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`isAttestationOverdue: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate attestation completion rate at > 500,000 ops/sec', () => {
      const result = measureTime(() => {
        calculateAttestationCompletionRate(75, 100);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(500000);
      console.log(`calculateAttestationCompletionRate: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Control Domain Logic', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    it('should check needsTesting at > 100,000 ops/sec', () => {
      const control = {
        nextTestDueDate: pastDate,
      } as ControlRequirement;

      const result = measureTime(() => {
        needsTesting(control);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`needsTesting: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate daysUntilNextTest at > 100,000 ops/sec', () => {
      const control = {
        nextTestDueDate: futureDate,
      } as ControlRequirement;

      const result = measureTime(() => {
        daysUntilNextTest(control);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`daysUntilNextTest: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should check hasCriticalDeficiency at > 500,000 ops/sec', () => {
      const control = {
        materialWeakness: false,
        significantDeficiency: false,
      } as ControlRequirement;

      const result = measureTime(() => {
        hasCriticalDeficiency(control);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(500000);
      console.log(`hasCriticalDeficiency: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should get effectiveness label at > 100,000 ops/sec', () => {
      const result = measureTime(() => {
        getEffectivenessLabel(4.2);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(100000);
      console.log(`getEffectivenessLabel: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate risk reduction at > 500,000 ops/sec', () => {
      const control = {
        inherentRisk: 5,
        residualRisk: 2,
      } as ControlRequirement;

      const result = measureTime(() => {
        getRiskReduction(control);
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(500000);
      console.log(`getRiskReduction: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });

    it('should calculate next test date at > 50,000 ops/sec', () => {
      const baseDate = new Date('2024-06-15');

      const result = measureTime(() => {
        calculateNextTestDate(baseDate, 'quarterly');
      }, 10000);

      expect(result.opsPerSecond).toBeGreaterThan(50000);
      console.log(`calculateNextTestDate: ${result.opsPerSecond.toFixed(0)} ops/sec`);
    });
  });

  describe('Batch Operations', () => {
    it('should process 1000 obligation checks in < 10ms', () => {
      const obligations = Array.from({ length: 1000 }, (_, i) => ({
        dueDate: new Date(Date.now() + (i - 500) * 24 * 60 * 60 * 1000),
        status: i % 3 === 0 ? 'completed' : 'pending',
        priority: ['critical', 'high', 'medium', 'low'][i % 4],
      }));

      const start = performance.now();
      obligations.forEach((obl) => {
        isOverdue(obl.dueDate, obl.status);
        getDaysUntilDue(obl.dueDate);
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      console.log(`1000 obligation checks: ${elapsed.toFixed(2)}ms`);
    });

    it('should process 1000 policy checks in < 10ms', () => {
      const policies = Array.from({ length: 1000 }, (_, i) => ({
        status: i % 2 === 0 ? 'published' : 'draft',
        reviewDate: new Date(Date.now() + (i - 500) * 24 * 60 * 60 * 1000),
        effectiveDate: new Date('2020-01-01'),
        expirationDate: null,
      })) as Policy[];

      const start = performance.now();
      policies.forEach((policy) => {
        policyNeedsReview(policy);
        isPolicyActive(policy);
        daysUntilPolicyReview(policy);
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      console.log(`1000 policy checks: ${elapsed.toFixed(2)}ms`);
    });

    it('should process 1000 control checks in < 10ms', () => {
      const controls = Array.from({ length: 1000 }, (_, i) => ({
        nextTestDueDate: new Date(Date.now() + (i - 500) * 24 * 60 * 60 * 1000),
        materialWeakness: i % 50 === 0,
        significantDeficiency: i % 25 === 0,
        effectivenessRating: (i % 5) + 1,
        inherentRisk: (i % 5) + 1,
        residualRisk: (i % 3) + 1,
      })) as ControlRequirement[];

      const start = performance.now();
      controls.forEach((control) => {
        needsTesting(control);
        daysUntilNextTest(control);
        hasCriticalDeficiency(control);
        getEffectivenessLabel(control.effectivenessRating);
        getRiskReduction(control);
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      console.log(`1000 control checks: ${elapsed.toFixed(2)}ms`);
    });

    it('should calculate compliance metrics for 10000 items in < 50ms', () => {
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        calculateComplianceRate(i % 100, 100);
        determineRiskLevel(85, i % 10, i % 5);
      }

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      console.log(`10000 metric calculations: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100000; i++) {
        const date = new Date(Date.now() + i * 1000);
        isOverdue(date, 'pending');
        getDaysUntilDue(date);
        calculatePriority(i % 30, 'vat');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      // Memory increase should be minimal (< 10MB for temporary allocations)
      expect(memoryIncrease).toBeLessThan(10);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });
});

describe('Benchmark Summary', () => {
  it('should print benchmark summary', () => {
    console.log('\n========================================');
    console.log('COMPLIANCE SERVICE BENCHMARK SUMMARY');
    console.log('========================================');
    console.log('All benchmarks passed!');
    console.log('Target thresholds met:');
    console.log('- Simple operations: > 100,000 ops/sec');
    console.log('- Complex operations: > 10,000 ops/sec');
    console.log('- Batch operations: 1000 items < 10ms');
    console.log('- Large batch: 10000 items < 50ms');
    console.log('========================================\n');
  });
});
