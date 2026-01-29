/**
 * JWT token management
 */

import * as jose from 'jose';
import type { AuthConfig, TokenPayload, User } from './types.js';

export interface JwtService {
  generateAccessToken(user: User): Promise<string>;
  generateRefreshToken(user: User): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload>;
  decodeToken(token: string): TokenPayload | null;
}

export class JoseJwtService implements JwtService {
  private secret: Uint8Array;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.secret = new TextEncoder().encode(config.jwtSecret);
  }

  async generateAccessToken(user: User): Promise<string> {
    return new jose.SignJWT({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(this.config.issuer || 'ecosystem')
      .setAudience(this.config.audience || 'ecosystem')
      .setExpirationTime(this.config.jwtExpiresIn)
      .sign(this.secret);
  }

  async generateRefreshToken(user: User): Promise<string> {
    return new jose.SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.config.refreshExpiresIn)
      .sign(this.secret);
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const { payload } = await jose.jwtVerify(token, this.secret, {
      issuer: this.config.issuer || 'ecosystem',
      audience: this.config.audience || 'ecosystem',
    });
    return payload as unknown as TokenPayload;
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      const decoded = jose.decodeJwt(token);
      return decoded as unknown as TokenPayload;
    } catch {
      return null;
    }
  }
}
