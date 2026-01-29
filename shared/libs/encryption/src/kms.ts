/**
 * AWS KMS encryption for production environments
 */

import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import type { EncryptedData, EncryptionConfig, EncryptionService } from './types.js';

export class KmsEncryptionService implements EncryptionService {
  private client: KMSClient;
  private keyId: string;

  constructor(config: EncryptionConfig) {
    if (!config.kmsKeyId) {
      throw new Error('KMS Key ID is required for KMS encryption');
    }
    
    this.keyId = config.kmsKeyId;
    this.client = new KMSClient({
      region: config.awsRegion || process.env.AWS_REGION || 'us-east-1',
    });
  }

  async encrypt(plaintext: string): Promise<EncryptedData> {
    const command = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: Buffer.from(plaintext, 'utf8'),
    });

    const response = await this.client.send(command);
    
    if (!response.CiphertextBlob) {
      throw new Error('KMS encryption failed: no ciphertext returned');
    }

    return {
      ciphertext: Buffer.from(response.CiphertextBlob).toString('base64'),
      iv: '', // KMS handles IV internally
      algorithm: 'aws-kms',
      keyId: this.keyId,
    };
  }

  async decrypt(encrypted: EncryptedData): Promise<string> {
    const command = new DecryptCommand({
      KeyId: this.keyId,
      CiphertextBlob: Buffer.from(encrypted.ciphertext, 'base64'),
    });

    const response = await this.client.send(command);
    
    if (!response.Plaintext) {
      throw new Error('KMS decryption failed: no plaintext returned');
    }

    return Buffer.from(response.Plaintext).toString('utf8');
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
