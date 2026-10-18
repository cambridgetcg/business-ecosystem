/**
 * MFA Service
 *
 * Manages multi-factor authentication setup, verification, and challenges.
 *
 * @module domain/mfa/services/mfa-service
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/database.js';
import {
  type TOTPSecret,
  type CreateTOTPSecretInput,
  type MFAChallenge,
  type BackupCode,
  generateSecret,
  generateProvisioningUri,
  verifyTOTP,
  generateBackupCodes,
  canAttemptChallenge,
} from '../models/totp.js';

// =============================================================================
// TYPES
// =============================================================================

export interface MFASetupResult {
  secret: TOTPSecret;
  provisioningUri: string;
  qrCodeDataUrl?: string;
  backupCodes: string[];
}

export interface MFAVerifyResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

export interface MFAChallengeResult {
  challengeId: string;
  challengeType: 'totp' | 'backup_code';
  expiresAt: Date;
}

// =============================================================================
// SERVICE
// =============================================================================

export class MFAService {
  private readonly issuer: string;
  private readonly challengeExpiryMinutes: number;
  private readonly maxChallengeAttempts: number;
  private readonly backupCodeCount: number;

  // In-memory storage for demo - use database in production
  private secrets: Map<string, TOTPSecret> = new Map();
  private backupCodes: Map<string, BackupCode[]> = new Map();
  private challenges: Map<string, MFAChallenge> = new Map();

  constructor(options?: {
    issuer?: string;
    challengeExpiryMinutes?: number;
    maxChallengeAttempts?: number;
    backupCodeCount?: number;
  }) {
    this.issuer = options?.issuer ?? 'BusinessEcosystem';
    this.challengeExpiryMinutes = options?.challengeExpiryMinutes ?? 5;
    this.maxChallengeAttempts = options?.maxChallengeAttempts ?? 3;
    this.backupCodeCount = options?.backupCodeCount ?? 10;
  }

  // ===========================================================================
  // MFA SETUP
  // ===========================================================================

  /**
   * Initialize MFA setup for an identity.
   * Generates TOTP secret and backup codes.
   */
  async setupMFA(
    identityId: string,
    tenantId: string,
    email: string
  ): Promise<MFASetupResult> {
    // Check if MFA already set up
    const existing = await this.getSecret(identityId);
    if (existing?.verified) {
      throw new Error('MFA already configured for this identity');
    }

    // Generate new secret
    const secret = generateSecret(32);
    const now = new Date();

    const totpSecret: TOTPSecret = {
      id: uuidv4(),
      identityId,
      tenantId,
      secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      verified: false,
      verifiedAt: null,
      lastUsedAt: null,
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Generate provisioning URI
    const provisioningUri = generateProvisioningUri(secret, email, this.issuer, {
      algorithm: totpSecret.algorithm,
      digits: totpSecret.digits,
      period: totpSecret.period,
    });

    totpSecret.provisioningUri = provisioningUri;

    // Generate backup codes
    const backupCodesPlain = generateBackupCodes(this.backupCodeCount);
    const backupCodeRecords = await this.storeBackupCodes(
      identityId,
      tenantId,
      backupCodesPlain
    );

    // Store secret (unverified)
    this.secrets.set(identityId, totpSecret);

    return {
      secret: totpSecret,
      provisioningUri,
      backupCodes: backupCodesPlain,
    };
  }

  /**
   * Verify MFA setup with initial code from authenticator app.
   */
  async verifySetup(identityId: string, code: string): Promise<MFAVerifyResult> {
    const secret = await this.getSecret(identityId);

    if (!secret) {
      return { success: false, error: 'MFA not initialized' };
    }

    if (secret.verified) {
      return { success: false, error: 'MFA already verified' };
    }

    // Verify the TOTP code
    const result = await verifyTOTP(secret.secret, code, {
      digits: secret.digits,
      period: secret.period,
      window: 1,
    });

    if (!result.valid) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Mark as verified
    secret.verified = true;
    secret.verifiedAt = new Date();
    secret.updatedAt = new Date();
    this.secrets.set(identityId, secret);

    return { success: true };
  }

  /**
   * Disable MFA for an identity.
   */
  async disableMFA(identityId: string): Promise<void> {
    this.secrets.delete(identityId);
    this.backupCodes.delete(identityId);
  }

  // ===========================================================================
  // MFA CHALLENGE
  // ===========================================================================

  /**
   * Create an MFA challenge for login verification.
   */
  async createChallenge(
    identityId: string,
    tenantId: string,
    sessionId: string
  ): Promise<MFAChallengeResult> {
    const secret = await this.getSecret(identityId);

    if (!secret?.verified) {
      throw new Error('MFA not configured for this identity');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.challengeExpiryMinutes * 60 * 1000);

    const challenge: MFAChallenge = {
      id: uuidv4(),
      identityId,
      tenantId,
      sessionId,
      challengeType: 'totp',
      status: 'pending',
      attempts: 0,
      maxAttempts: this.maxChallengeAttempts,
      createdAt: now,
      expiresAt,
      verifiedAt: null,
    };

    this.challenges.set(challenge.id, challenge);

    return {
      challengeId: challenge.id,
      challengeType: 'totp',
      expiresAt,
    };
  }

  /**
   * Verify an MFA challenge with TOTP code.
   */
  async verifyChallenge(
    challengeId: string,
    code: string
  ): Promise<MFAVerifyResult> {
    const challenge = this.challenges.get(challengeId);

    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }

    if (!canAttemptChallenge(challenge)) {
      if (challenge.status !== 'pending') {
        return { success: false, error: `Challenge ${challenge.status}` };
      }
      if (challenge.attempts >= challenge.maxAttempts) {
        challenge.status = 'failed';
        this.challenges.set(challengeId, challenge);
        return { success: false, error: 'Maximum attempts exceeded' };
      }
      challenge.status = 'expired';
      this.challenges.set(challengeId, challenge);
      return { success: false, error: 'Challenge expired' };
    }

    // Increment attempt counter
    challenge.attempts++;
    this.challenges.set(challengeId, challenge);

    const secret = await this.getSecret(challenge.identityId);

    if (!secret) {
      return { success: false, error: 'MFA configuration not found' };
    }

    // Try TOTP verification
    const totpResult = await verifyTOTP(secret.secret, code, {
      digits: secret.digits,
      period: secret.period,
      window: 1,
    });

    if (totpResult.valid) {
      challenge.status = 'verified';
      challenge.verifiedAt = new Date();
      this.challenges.set(challengeId, challenge);

      // Update secret usage
      secret.lastUsedAt = new Date();
      secret.useCount++;
      this.secrets.set(challenge.identityId, secret);

      return { success: true };
    }

    // Try backup code
    const backupResult = await this.verifyBackupCode(challenge.identityId, code);

    if (backupResult) {
      challenge.status = 'verified';
      challenge.verifiedAt = new Date();
      challenge.challengeType = 'backup_code';
      this.challenges.set(challengeId, challenge);

      return { success: true };
    }

    const remainingAttempts = challenge.maxAttempts - challenge.attempts;

    if (remainingAttempts <= 0) {
      challenge.status = 'failed';
      this.challenges.set(challengeId, challenge);
    }

    return {
      success: false,
      error: 'Invalid code',
      remainingAttempts,
    };
  }

  // ===========================================================================
  // BACKUP CODES
  // ===========================================================================

  /**
   * Regenerate backup codes (invalidates existing codes).
   */
  async regenerateBackupCodes(
    identityId: string,
    tenantId: string
  ): Promise<string[]> {
    const newCodes = generateBackupCodes(this.backupCodeCount);
    await this.storeBackupCodes(identityId, tenantId, newCodes);
    return newCodes;
  }

  /**
   * Get count of remaining backup codes.
   */
  async getRemainingBackupCodeCount(identityId: string): Promise<number> {
    const codes = this.backupCodes.get(identityId) ?? [];
    return codes.filter(c => !c.used).length;
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  /**
   * Check if MFA is enabled for an identity.
   */
  async isMFAEnabled(identityId: string): Promise<boolean> {
    const secret = await this.getSecret(identityId);
    return !!secret?.verified;
  }

  /**
   * Get MFA status for an identity.
   */
  async getMFAStatus(identityId: string): Promise<{
    enabled: boolean;
    verifiedAt?: Date;
    lastUsedAt?: Date;
    remainingBackupCodes: number;
  }> {
    const secret = await this.getSecret(identityId);
    const remainingBackupCodes = await this.getRemainingBackupCodeCount(identityId);

    return {
      enabled: !!secret?.verified,
      verifiedAt: secret?.verifiedAt ?? undefined,
      lastUsedAt: secret?.lastUsedAt ?? undefined,
      remainingBackupCodes,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async getSecret(identityId: string): Promise<TOTPSecret | null> {
    return this.secrets.get(identityId) ?? null;
  }

  private async storeBackupCodes(
    identityId: string,
    tenantId: string,
    codes: string[]
  ): Promise<BackupCode[]> {
    const now = new Date();
    const records: BackupCode[] = codes.map(code => ({
      id: uuidv4(),
      identityId,
      tenantId,
      codeHash: this.hashCode(code),
      used: false,
      usedAt: null,
      createdAt: now,
      expiresAt: null,
    }));

    this.backupCodes.set(identityId, records);
    return records;
  }

  private async verifyBackupCode(
    identityId: string,
    code: string
  ): Promise<boolean> {
    const codes = this.backupCodes.get(identityId) ?? [];
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const codeHash = this.hashCode(normalizedCode);

    for (const record of codes) {
      if (!record.used && record.codeHash === codeHash) {
        record.used = true;
        record.usedAt = new Date();
        this.backupCodes.set(identityId, codes);
        return true;
      }
    }

    return false;
  }

  private hashCode(code: string): string {
    // Simple hash for demo - use bcrypt or argon2 in production
    const normalized = code.replace(/-/g, '').toUpperCase();
    return Buffer.from(normalized).toString('base64');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createMFAService(options?: {
  issuer?: string;
  challengeExpiryMinutes?: number;
  maxChallengeAttempts?: number;
  backupCodeCount?: number;
}): MFAService {
  return new MFAService(options);
}
