/**
 * TOTP (Time-based One-Time Password) Models
 *
 * Implements RFC 6238 TOTP for multi-factor authentication.
 *
 * @module domain/mfa/models/totp
 */

import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

export const TOTPSecretSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Secret key (base32 encoded)
  secret: z.string().min(16).max(64),

  // Configuration
  algorithm: z.enum(['SHA1', 'SHA256', 'SHA512']).default('SHA1'),
  digits: z.number().int().min(6).max(8).default(6),
  period: z.number().int().min(30).max(60).default(30),

  // Status
  verified: z.boolean().default(false),
  verifiedAt: z.date().nullable().optional(),

  // Provisioning
  provisioningUri: z.string().url().optional(),
  qrCodeDataUrl: z.string().optional(),

  // Security
  lastUsedAt: z.date().nullable().optional(),
  useCount: z.number().int().default(0),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TOTPSecret = z.infer<typeof TOTPSecretSchema>;

export const CreateTOTPSecretInputSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  algorithm: z.enum(['SHA1', 'SHA256', 'SHA512']).default('SHA1'),
  digits: z.number().int().min(6).max(8).default(6),
  period: z.number().int().min(30).max(60).default(30),
});

export type CreateTOTPSecretInput = z.infer<typeof CreateTOTPSecretInputSchema>;

// =============================================================================
// BACKUP CODES
// =============================================================================

export const BackupCodeSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Code (hashed for storage)
  codeHash: z.string(),

  // Status
  used: z.boolean().default(false),
  usedAt: z.date().nullable().optional(),

  // Timestamps
  createdAt: z.date(),
  expiresAt: z.date().nullable().optional(),
});

export type BackupCode = z.infer<typeof BackupCodeSchema>;

export const BackupCodeSetSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  codes: z.array(BackupCodeSchema),
  generatedAt: z.date(),
  totalCodes: z.number().int(),
  usedCodes: z.number().int(),
  remainingCodes: z.number().int(),
});

export type BackupCodeSet = z.infer<typeof BackupCodeSetSchema>;

// =============================================================================
// MFA CHALLENGE
// =============================================================================

export const MFAChallengeSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionId: z.string().uuid(),

  // Challenge type
  challengeType: z.enum(['totp', 'backup_code', 'sms', 'email']),

  // Status
  status: z.enum(['pending', 'verified', 'failed', 'expired']).default('pending'),

  // Attempt tracking
  attempts: z.number().int().default(0),
  maxAttempts: z.number().int().default(3),

  // Timestamps
  createdAt: z.date(),
  expiresAt: z.date(),
  verifiedAt: z.date().nullable().optional(),
});

export type MFAChallenge = z.infer<typeof MFAChallengeSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

/**
 * Generate a cryptographically secure random secret.
 * Returns base32 encoded string suitable for TOTP.
 */
export function generateSecret(length: number = 20): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }

  return result;
}

/**
 * Generate TOTP provisioning URI for authenticator apps.
 */
export function generateProvisioningUri(
  secret: string,
  email: string,
  issuer: string = 'BusinessEcosystem',
  options: { algorithm?: string; digits?: number; period?: number } = {}
): string {
  const { algorithm = 'SHA1', digits = 6, period = 30 } = options;

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: digits.toString(),
    period: period.toString(),
  });

  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);

  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?${params.toString()}`;
}

/**
 * Calculate TOTP code for a given secret and time.
 * Implements RFC 6238.
 */
export async function calculateTOTP(
  secret: string,
  time: number = Date.now(),
  options: { digits?: number; period?: number; algorithm?: string } = {}
): Promise<string> {
  const { digits = 6, period = 30, algorithm = 'SHA1' } = options;

  // Calculate time counter
  const counter = Math.floor(time / 1000 / period);

  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false);

  // Decode base32 secret
  const secretBytes = base32Decode(secret);

  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: algorithm.replace('SHA', 'SHA-') },
    false,
    ['sign']
  );

  // Calculate HMAC
  const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  // Generate OTP
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify a TOTP code with time window tolerance.
 */
export async function verifyTOTP(
  secret: string,
  code: string,
  options: { digits?: number; period?: number; window?: number } = {}
): Promise<{ valid: boolean; drift: number }> {
  const { digits = 6, period = 30, window = 1 } = options;

  const now = Date.now();

  // Check current time and adjacent windows
  for (let i = -window; i <= window; i++) {
    const time = now + i * period * 1000;
    const expectedCode = await calculateTOTP(secret, time, { digits, period });

    if (timingSafeEqual(code, expectedCode)) {
      return { valid: true, drift: i };
    }
  }

  return { valid: false, drift: 0 };
}

/**
 * Generate backup codes for account recovery.
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);

    const code = Array.from(bytes)
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .slice(0, 8);

    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }

  return codes;
}

/**
 * Check if MFA challenge has expired.
 */
export function isChallengeExpired(challenge: MFAChallenge): boolean {
  return new Date() > challenge.expiresAt;
}

/**
 * Check if MFA challenge has exceeded max attempts.
 */
export function isChallengeExhausted(challenge: MFAChallenge): boolean {
  return challenge.attempts >= challenge.maxAttempts;
}

/**
 * Check if MFA challenge can accept more attempts.
 */
export function canAttemptChallenge(challenge: MFAChallenge): boolean {
  return (
    challenge.status === 'pending' &&
    !isChallengeExpired(challenge) &&
    !isChallengeExhausted(challenge)
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Base32 decode (RFC 4648).
 */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = input.toUpperCase().replace(/=+$/, '');

  const output: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;

  for (const char of cleanInput) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;

    buffer = (buffer << 5) | value;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      output.push((buffer >> bitsLeft) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
