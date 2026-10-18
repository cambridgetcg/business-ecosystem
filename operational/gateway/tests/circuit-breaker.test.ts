/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
} from '../src/middleware/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeout: 1000,
      successThreshold: 2,
      windowDuration: 5000,
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should have zero failures initially', () => {
      const stats = breaker.getStats();
      expect(stats.recentFailures).toBe(0);
      expect(stats.state).toBe('CLOSED');
    });
  });

  describe('CLOSED state behavior', () => {
    it('should allow requests in CLOSED state', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should record failures', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }

      const stats = breaker.getStats();
      expect(stats.recentFailures).toBe(1);
    });

    it('should transition to OPEN after failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should clear failures on success', async () => {
      // Record one failure
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }
      expect(breaker.getStats().recentFailures).toBe(1);

      // Success should clear failures
      await breaker.execute(async () => 'success');
      expect(breaker.getStats().recentFailures).toBe(0);
    });
  });

  describe('OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reject requests immediately when OPEN', async () => {
      await expect(
        breaker.execute(async () => 'should not run')
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should include service name in CircuitOpenError', async () => {
      try {
        await breaker.execute(async () => 'should not run');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).serviceName).toBe('test-service');
      }
    });

    it('should record openedAt timestamp', () => {
      const stats = breaker.getStats();
      expect(stats.openedAt).not.toBeNull();
    });

    it('should provide remaining timeout', () => {
      const stats = breaker.getStats();
      expect(stats.remainingTimeout).not.toBeNull();
      expect(stats.remainingTimeout!).toBeGreaterThan(0);
      expect(stats.remainingTimeout!).toBeLessThanOrEqual(1000);
    });
  });

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    it('should transition to HALF_OPEN after reset timeout', () => {
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should allow test requests in HALF_OPEN state', async () => {
      const result = await breaker.execute(async () => 'test-request');
      expect(result).toBe('test-request');
    });

    it('should transition to CLOSED after success threshold', async () => {
      await breaker.execute(async () => 'success-1');
      expect(breaker.getState()).toBe('HALF_OPEN');

      await breaker.execute(async () => 'success-2');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition back to OPEN on any failure', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('executeWithFallback', () => {
    it('should return result when circuit is closed', async () => {
      const result = await breaker.executeWithFallback(
        async () => 'success',
        'fallback'
      );
      expect(result).toBe('success');
    });

    it('should return fallback when circuit is open', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const result = await breaker.executeWithFallback(
        async () => 'should not run',
        'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('should call fallback function when provided', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const fallbackFn = vi.fn().mockReturnValue('dynamic-fallback');
      const result = await breaker.executeWithFallback(
        async () => 'should not run',
        fallbackFn
      );

      expect(result).toBe('dynamic-fallback');
      expect(fallbackFn).toHaveBeenCalled();
    });

    it('should propagate non-circuit errors', async () => {
      await expect(
        breaker.executeWithFallback(
          async () => {
            throw new Error('application error');
          },
          'fallback'
        )
      ).rejects.toThrow('application error');
    });
  });

  describe('manual controls', () => {
    it('should allow manual reset', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }
      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStats().recentFailures).toBe(0);
    });

    it('should allow manual force open', async () => {
      expect(breaker.getState()).toBe('CLOSED');

      breaker.forceOpen();
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('sliding window', () => {
    it('should prune old failures outside window', async () => {
      const shortWindowBreaker = new CircuitBreaker('short-window', {
        failureThreshold: 5,
        windowDuration: 100,
      });

      // Record 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await shortWindowBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }
      expect(shortWindowBreaker.getStats().recentFailures).toBe(2);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger state check (any operation will prune)
      shortWindowBreaker.getState();
      expect(shortWindowBreaker.getStats().recentFailures).toBe(0);
    });
  });

  describe('state change callback', () => {
    it('should call onStateChange when state changes', async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker('callback-test', {
        failureThreshold: 2,
        resetTimeout: 100,
        onStateChange,
      });

      // Trip the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      expect(onStateChange).toHaveBeenCalledWith('callback-test', 'CLOSED', 'OPEN');

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 150));
      breaker.getState(); // Trigger transition check

      expect(onStateChange).toHaveBeenCalledWith('callback-test', 'OPEN', 'HALF_OPEN');
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry({
      failureThreshold: 3,
      resetTimeout: 1000,
    });
  });

  describe('get', () => {
    it('should create a new breaker if not exists', () => {
      const breaker = registry.get('new-service');
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should return the same breaker on subsequent calls', () => {
      const breaker1 = registry.get('same-service');
      const breaker2 = registry.get('same-service');
      expect(breaker1).toBe(breaker2);
    });

    it('should allow custom options per breaker', async () => {
      const breaker = registry.get('custom', { failureThreshold: 1 });

      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // expected
      }

      // Should be open with just 1 failure
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all breakers', () => {
      registry.get('service-1');
      registry.get('service-2');
      registry.get('service-3');

      const stats = registry.getAllStats();
      expect(stats).toHaveLength(3);
      expect(stats.map(s => s.name)).toContain('service-1');
      expect(stats.map(s => s.name)).toContain('service-2');
      expect(stats.map(s => s.name)).toContain('service-3');
    });
  });

  describe('getByState', () => {
    it('should filter breakers by state', async () => {
      const open = registry.get('open-service');
      registry.get('closed-service');

      // Trip the open service
      for (let i = 0; i < 3; i++) {
        try {
          await open.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const openBreakers = registry.getByState('OPEN');
      expect(openBreakers).toHaveLength(1);
      expect(openBreakers[0].getStats().name).toBe('open-service');

      const closedBreakers = registry.getByState('CLOSED');
      expect(closedBreakers).toHaveLength(1);
    });
  });

  describe('resetAll', () => {
    it('should reset all breakers', async () => {
      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-2');

      // Trip both breakers
      for (const breaker of [breaker1, breaker2]) {
        for (let i = 0; i < 3; i++) {
          try {
            await breaker.execute(async () => {
              throw new Error('fail');
            });
          } catch {
            // expected
          }
        }
      }

      expect(breaker1.getState()).toBe('OPEN');
      expect(breaker2.getState()).toBe('OPEN');

      registry.resetAll();

      expect(breaker1.getState()).toBe('CLOSED');
      expect(breaker2.getState()).toBe('CLOSED');
    });
  });

  describe('hasOpenCircuits', () => {
    it('should return false when no circuits are open', () => {
      registry.get('service-1');
      registry.get('service-2');
      expect(registry.hasOpenCircuits()).toBe(false);
    });

    it('should return true when any circuit is open', async () => {
      const breaker = registry.get('fail-service');
      registry.get('ok-service');

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      expect(registry.hasOpenCircuits()).toBe(true);
    });
  });

  describe('getStateCounts', () => {
    it('should count breakers by state', async () => {
      const openBreaker = registry.get('open');

      registry.get('closed-1');
      registry.get('closed-2');

      for (let i = 0; i < 3; i++) {
        try {
          await openBreaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const counts = registry.getStateCounts();
      expect(counts.OPEN).toBe(1);
      expect(counts.CLOSED).toBe(2);
      expect(counts.HALF_OPEN).toBe(0);
    });
  });
});

describe('CircuitOpenError', () => {
  it('should have correct name and message', () => {
    const error = new CircuitOpenError('test-service', 5000);
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toContain('test-service');
    expect(error.serviceName).toBe('test-service');
    expect(error.remainingTimeout).toBe(5000);
  });
});
