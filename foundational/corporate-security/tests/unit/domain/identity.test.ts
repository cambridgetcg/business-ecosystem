/**
 * Identity Domain Tests
 */

import { describe, it, expect } from 'vitest';
import {
  canAuthenticate,
  isLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  requiresMFA,
  isPasswordExpired,
  getLockoutRemainingSeconds,
  getVerificationExpiry,
  getUpdatedPasswordHistory,
  type Identity,
} from '../../../src/domain/identity/models/identity.js';

describe('Identity Domain', () => {
  const baseIdentity: Identity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    tenantId: '123e4567-e89b-12d3-a456-426614174001',
    userId: '123e4567-e89b-12d3-a456-426614174002',
    email: 'test@example.com',
    username: 'testuser',
    status: 'active',
    mfaStatus: 'not_configured',
    mfaConfig: null,
    passwordHash: 'hash',
    passwordSalt: 'salt',
    passwordHistory: null,
    passwordExpiresAt: null,
    lastPasswordChange: null,
    lastLoginAt: null,
    lastLoginIp: null,
    lastLoginUserAgent: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    trustedDevices: null,
    ssoProvider: null,
    ssoExternalId: null,
    ssoAttributes: null,
    apiKeyEnabled: false,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    verificationToken: null,
    verificationExpires: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    deletedAt: null,
  };

  describe('canAuthenticate', () => {
    it('should return true for active identity', () => {
      expect(canAuthenticate(baseIdentity)).toBe(true);
    });

    it('should return false for inactive identity', () => {
      const inactive = { ...baseIdentity, status: 'inactive' as const };
      expect(canAuthenticate(inactive)).toBe(false);
    });

    it('should return false for suspended identity', () => {
      const suspended = { ...baseIdentity, status: 'suspended' as const };
      expect(canAuthenticate(suspended)).toBe(false);
    });

    it('should return false for locked identity', () => {
      const locked = { ...baseIdentity, status: 'locked' as const };
      expect(canAuthenticate(locked)).toBe(false);
    });

    it('should return false for deleted identity', () => {
      const deleted = { ...baseIdentity, deletedAt: new Date() };
      expect(canAuthenticate(deleted)).toBe(false);
    });

    it('should return false for temporarily locked identity', () => {
      const lockedUntil = new Date(Date.now() + 60000); // 1 minute from now
      const temporarilyLocked = { ...baseIdentity, lockedUntil };
      expect(canAuthenticate(temporarilyLocked)).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return false for active identity', () => {
      expect(isLocked(baseIdentity)).toBe(false);
    });

    it('should return true for locked status', () => {
      const locked = { ...baseIdentity, status: 'locked' as const };
      expect(isLocked(locked)).toBe(true);
    });

    it('should return true for future lockedUntil', () => {
      const lockedUntil = new Date(Date.now() + 60000);
      const locked = { ...baseIdentity, lockedUntil };
      expect(isLocked(locked)).toBe(true);
    });

    it('should return false for past lockedUntil', () => {
      const lockedUntil = new Date(Date.now() - 60000);
      const locked = { ...baseIdentity, lockedUntil };
      expect(isLocked(locked)).toBe(false);
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment failed attempts', () => {
      const result = recordFailedLogin(baseIdentity);
      expect(result.failedLoginAttempts).toBe(1);
    });

    it('should lock after 5 failed attempts', () => {
      const identity = { ...baseIdentity, failedLoginAttempts: 4 };
      const result = recordFailedLogin(identity);
      expect(result.failedLoginAttempts).toBe(5);
      expect(result.status).toBe('locked');
      expect(result.lockedUntil).toBeDefined();
    });

    it('should not lock before 5 attempts', () => {
      const identity = { ...baseIdentity, failedLoginAttempts: 3 };
      const result = recordFailedLogin(identity);
      expect(result.status).toBe('active');
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should reset failed attempts', () => {
      const identity = { ...baseIdentity, failedLoginAttempts: 3 };
      const result = recordSuccessfulLogin(identity, '192.168.1.1', 'Chrome');
      expect(result.failedLoginAttempts).toBe(0);
    });

    it('should clear lockout', () => {
      const identity = { ...baseIdentity, lockedUntil: new Date() };
      const result = recordSuccessfulLogin(identity, '192.168.1.1', 'Chrome');
      expect(result.lockedUntil).toBeNull();
    });

    it('should record login details', () => {
      const result = recordSuccessfulLogin(baseIdentity, '192.168.1.1', 'Chrome');
      expect(result.lastLoginIp).toBe('192.168.1.1');
      expect(result.lastLoginUserAgent).toBe('Chrome');
      expect(result.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('requiresMFA', () => {
    it('should return false for not_configured', () => {
      expect(requiresMFA(baseIdentity)).toBe(false);
    });

    it('should return true for configured', () => {
      const identity = { ...baseIdentity, mfaStatus: 'configured' as const };
      expect(requiresMFA(identity)).toBe(true);
    });

    it('should return true for enforced', () => {
      const identity = { ...baseIdentity, mfaStatus: 'enforced' as const };
      expect(requiresMFA(identity)).toBe(true);
    });

    it('should return false for bypassed', () => {
      const identity = { ...baseIdentity, mfaStatus: 'bypassed' as const };
      expect(requiresMFA(identity)).toBe(false);
    });
  });

  describe('isPasswordExpired', () => {
    it('should return false when no expiry set', () => {
      expect(isPasswordExpired(baseIdentity)).toBe(false);
    });

    it('should return true when password expired', () => {
      const expired = {
        ...baseIdentity,
        passwordExpiresAt: new Date(Date.now() - 86400000),
      };
      expect(isPasswordExpired(expired)).toBe(true);
    });

    it('should return false when password not expired', () => {
      const notExpired = {
        ...baseIdentity,
        passwordExpiresAt: new Date(Date.now() + 86400000),
      };
      expect(isPasswordExpired(notExpired)).toBe(false);
    });
  });

  describe('getLockoutRemainingSeconds', () => {
    it('should return 0 when not locked', () => {
      expect(getLockoutRemainingSeconds(baseIdentity)).toBe(0);
    });

    it('should return remaining seconds when locked', () => {
      const lockedUntil = new Date(Date.now() + 60000);
      const identity = { ...baseIdentity, lockedUntil };
      const remaining = getLockoutRemainingSeconds(identity);
      expect(remaining).toBeGreaterThan(55);
      expect(remaining).toBeLessThanOrEqual(60);
    });

    it('should return 0 when lockout expired', () => {
      const lockedUntil = new Date(Date.now() - 60000);
      const identity = { ...baseIdentity, lockedUntil };
      expect(getLockoutRemainingSeconds(identity)).toBe(0);
    });
  });

  describe('getVerificationExpiry', () => {
    it('should return date 24 hours in future', () => {
      const expiry = getVerificationExpiry();
      const expected = Date.now() + 24 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBeCloseTo(expected, -3);
    });
  });

  describe('getUpdatedPasswordHistory', () => {
    it('should add new hash to history', () => {
      const result = getUpdatedPasswordHistory('newhash', null);
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('newhash');
    });

    it('should prepend new hash to existing history', () => {
      const existing = [{ hash: 'old1', createdAt: new Date() }];
      const result = getUpdatedPasswordHistory('newhash', existing);
      expect(result.length).toBe(2);
      expect(result[0].hash).toBe('newhash');
      expect(result[1].hash).toBe('old1');
    });

    it('should limit history to 12 entries', () => {
      const existing = Array.from({ length: 15 }, (_, i) => ({
        hash: `hash${i}`,
        createdAt: new Date(),
      }));
      const result = getUpdatedPasswordHistory('newhash', existing);
      expect(result.length).toBe(12);
      expect(result[0].hash).toBe('newhash');
    });
  });
});
