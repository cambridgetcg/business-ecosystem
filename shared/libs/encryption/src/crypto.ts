/**
 * Local encryption using Node.js crypto
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  CipherGCM,
  DecipherGCM,
} from 'crypto';
import type { EncryptedData, EncryptionConfig, EncryptionService } from './types.js';

export class AesEncryptionService implements EncryptionService {
  private key: Buffer;
  private algorithm: 'aes-256-gcm' | 'aes-256-cbc';

  constructor(encryptionKey: string, config: EncryptionConfig = {}) {
    this.algorithm = config.algorithm || 'aes-256-gcm';
    // Derive a 32-byte key from the provided key
    this.key = scryptSync(encryptionKey, 'ecosystem-salt', 32);
  }

  // Node's ciphers are synchronous. They run inside a promise executor, so a
  // throw (such as a failed GCM tag check) still rejects the returned promise.
  encrypt(plaintext: string): Promise<EncryptedData> {
    return new Promise((resolve) => {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.key, iv);

      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');

      const result: EncryptedData = {
        ciphertext,
        iv: iv.toString('base64'),
        algorithm: this.algorithm,
      };

      if (this.algorithm === 'aes-256-gcm') {
        result.authTag = (cipher as CipherGCM).getAuthTag().toString('base64');
      }

      resolve(result);
    });
  }

  decrypt(encrypted: EncryptedData): Promise<string> {
    return new Promise((resolve) => {
      const iv = Buffer.from(encrypted.iv, 'base64');
      const decipher = createDecipheriv(this.algorithm, this.key, iv);

      if (this.algorithm === 'aes-256-gcm' && encrypted.authTag) {
        (decipher as DecipherGCM).setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
      }

      let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      resolve(plaintext);
    });
  }

  async encryptField<T extends object>(obj: T, fields: (keyof T)[]): Promise<T> {
    const result = { ...obj };
    for (const field of fields) {
      const value = obj[field];
      if (typeof value === 'string') {
        const encrypted = await this.encrypt(value);
        (result[field] as unknown) = JSON.stringify(encrypted);
      }
    }
    return result;
  }

  async decryptField<T extends object>(obj: T, fields: (keyof T)[]): Promise<T> {
    const result = { ...obj };
    for (const field of fields) {
      const value = obj[field];
      if (typeof value === 'string') {
        try {
          const encrypted = JSON.parse(value) as EncryptedData;
          (result[field] as unknown) = await this.decrypt(encrypted);
        } catch {
          // Field is not encrypted, leave as-is
        }
      }
    }
    return result;
  }
}
