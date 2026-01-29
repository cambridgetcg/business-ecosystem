/**
 * Core encryption types
 */

export interface EncryptionConfig {
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc';
  keyDerivation?: 'pbkdf2' | 'scrypt';
  kmsKeyId?: string;
  awsRegion?: string;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag?: string;
  algorithm: string;
  keyId?: string;
}

export interface EncryptionService {
  encrypt(plaintext: string): Promise<EncryptedData>;
  decrypt(encrypted: EncryptedData): Promise<string>;
  encryptField<T extends object>(obj: T, fields: (keyof T)[]): Promise<T>;
  decryptField<T extends object>(obj: T, fields: (keyof T)[]): Promise<T>;
}
