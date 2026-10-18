/**
 * Drizzle-backed HMRC Token Store
 *
 * Persists HMRC OAuth tokens to PostgreSQL for production use.
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HMRCTokenStore, HMRCTokenSet } from './oauth-client.js';
import { hmrcOAuthTokens } from '../persistence/schema.js';

export class DrizzleTokenStore implements HMRCTokenStore {
  constructor(
    private readonly db: NodePgDatabase<any>,
    private readonly tenantId: string
  ) {}

  async getToken(entityId: string, scope: string): Promise<HMRCTokenSet | null> {
    const [token] = await this.db
      .select()
      .from(hmrcOAuthTokens)
      .where(
        and(
          eq(hmrcOAuthTokens.entityId, entityId),
          eq(hmrcOAuthTokens.scope, scope),
          eq(hmrcOAuthTokens.tenantId, this.tenantId)
        )
      )
      .limit(1);

    if (!token) {
      return null;
    }

    // Update last used timestamp
    await this.db
      .update(hmrcOAuthTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(hmrcOAuthTokens.id, token.id));

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scope: token.grantedScopes ?? [scope],
    };
  }

  async saveToken(entityId: string, scope: string, tokenSet: HMRCTokenSet): Promise<void> {
    // Try to find existing token
    const [existing] = await this.db
      .select({ id: hmrcOAuthTokens.id })
      .from(hmrcOAuthTokens)
      .where(
        and(
          eq(hmrcOAuthTokens.entityId, entityId),
          eq(hmrcOAuthTokens.scope, scope),
          eq(hmrcOAuthTokens.tenantId, this.tenantId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing token
      await this.db
        .update(hmrcOAuthTokens)
        .set({
          accessToken: tokenSet.accessToken,
          refreshToken: tokenSet.refreshToken,
          expiresAt: tokenSet.expiresAt,
          grantedScopes: tokenSet.scope,
          updatedAt: new Date(),
        })
        .where(eq(hmrcOAuthTokens.id, existing.id));
    } else {
      // Insert new token
      await this.db.insert(hmrcOAuthTokens).values({
        tenantId: this.tenantId,
        entityId,
        registrationId: entityId, // Typically the same, but could be different
        scope,
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        expiresAt: tokenSet.expiresAt,
        grantedScopes: tokenSet.scope,
      });
    }
  }

  async deleteToken(entityId: string, scope: string): Promise<void> {
    await this.db
      .delete(hmrcOAuthTokens)
      .where(
        and(
          eq(hmrcOAuthTokens.entityId, entityId),
          eq(hmrcOAuthTokens.scope, scope),
          eq(hmrcOAuthTokens.tenantId, this.tenantId)
        )
      );
  }

  /**
   * Get all tokens for an entity
   */
  async getAllTokensForEntity(entityId: string): Promise<Array<{ scope: string; expiresAt: Date }>> {
    const tokens = await this.db
      .select({
        scope: hmrcOAuthTokens.scope,
        expiresAt: hmrcOAuthTokens.expiresAt,
      })
      .from(hmrcOAuthTokens)
      .where(
        and(
          eq(hmrcOAuthTokens.entityId, entityId),
          eq(hmrcOAuthTokens.tenantId, this.tenantId)
        )
      );

    return tokens;
  }

  /**
   * Delete all tokens for an entity
   */
  async deleteAllTokensForEntity(entityId: string): Promise<void> {
    await this.db
      .delete(hmrcOAuthTokens)
      .where(
        and(
          eq(hmrcOAuthTokens.entityId, entityId),
          eq(hmrcOAuthTokens.tenantId, this.tenantId)
        )
      );
  }
}
