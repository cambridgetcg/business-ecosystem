/**
 * Password hashing and verification
 */

import bcrypt from 'bcryptjs';

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  isStrong(password: string): boolean;
}

export class BcryptPasswordService implements PasswordService {
  private rounds: number;

  constructor(rounds = 12) {
    this.rounds = rounds;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  isStrong(password: string): boolean {
    // Minimum 8 characters, at least one uppercase, one lowercase, one number, one special char
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  }
}
