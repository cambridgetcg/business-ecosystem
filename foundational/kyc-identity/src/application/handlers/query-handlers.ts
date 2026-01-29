/**
 * KYC Query Handlers
 */

import { eq, and, or, ilike, desc, asc, lt, count, sql } from 'drizzle-orm';
import { getDb, identities, documents, verificationRequests, amlScreeningResults, kycAuditLog } from '../../infrastructure/persistence/index.js';
import type {
  GetIdentityQuery,
  GetIdentityByExternalIdQuery,
  ListIdentitiesQuery,
  GetDocumentQuery,
  ListDocumentsQuery,
  GetVerificationRequestQuery,
  ListVerificationRequestsQuery,
  GetPendingReviewsQuery,
  GetAmlScreeningResultsQuery,
  GetIdentityAuditLogQuery,
  GetExpiringDocumentsQuery,
  GetVerificationStatisticsQuery,
} from '../queries/index.js';

export class IdentityQueryHandler {
  private db = getDb();

  async getIdentity(query: GetIdentityQuery) {
    const [identity] = await this.db.select()
      .from(identities)
      .where(and(
        eq(identities.id, query.identityId),
        eq(identities.tenantId, query.tenantId)
      ))
      .limit(1);

    return identity || null;
  }

  async getIdentityByExternalId(query: GetIdentityByExternalIdQuery) {
    const [identity] = await this.db.select()
      .from(identities)
      .where(and(
        eq(identities.externalId, query.externalId),
        eq(identities.tenantId, query.tenantId)
      ))
      .limit(1);

    return identity || null;
  }

  async listIdentities(query: ListIdentitiesQuery) {
    const conditions = [eq(identities.tenantId, query.tenantId)];

    if (query.type) {
      conditions.push(eq(identities.type, query.type));
    }
    if (query.verificationStatus) {
      conditions.push(eq(identities.verificationStatus, query.verificationStatus));
    }
    if (query.riskLevel) {
      conditions.push(eq(identities.riskLevel, query.riskLevel));
    }
    if (query.isPep !== undefined) {
      conditions.push(eq(identities.isPep, query.isPep));
    }
    if (query.isSanctioned !== undefined) {
      conditions.push(eq(identities.isSanctioned, query.isSanctioned));
    }
    if (query.search) {
      conditions.push(or(
        ilike(identities.firstName, '%' + query.search + '%'),
        ilike(identities.lastName, '%' + query.search + '%'),
        ilike(identities.legalName, '%' + query.search + '%'),
        ilike(identities.email, '%' + query.search + '%')
      )!);
    }

    const orderColumn = query.orderBy === 'createdAt' ? identities.createdAt
      : query.orderBy === 'updatedAt' ? identities.updatedAt
      : identities.verifiedAt;

    const orderFn = query.orderDirection === 'asc' ? asc : desc;

    const results = await this.db.select()
      .from(identities)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(query.limit)
      .offset(query.offset);

    const countResult = await this.db.select({ total: count() })
      .from(identities)
      .where(and(...conditions));

    const total = countResult[0]?.total ?? 0;

    return {
      items: results,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}

export class DocumentQueryHandler {
  private db = getDb();

  async getDocument(query: GetDocumentQuery) {
    const [document] = await this.db.select()
      .from(documents)
      .where(and(
        eq(documents.id, query.documentId),
        eq(documents.tenantId, query.tenantId)
      ))
      .limit(1);

    return document || null;
  }

  async listDocuments(query: ListDocumentsQuery) {
    const conditions = [
      eq(documents.identityId, query.identityId),
      eq(documents.tenantId, query.tenantId),
    ];

    if (query.type) {
      conditions.push(eq(documents.type, query.type));
    }
    if (query.status) {
      conditions.push(eq(documents.status, query.status));
    }

    const results = await this.db.select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.uploadedAt))
      .limit(query.limit)
      .offset(query.offset);

    const countResult = await this.db.select({ total: count() })
      .from(documents)
      .where(and(...conditions));

    const total = countResult[0]?.total ?? 0;

    return {
      items: results,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getExpiringDocuments(query: GetExpiringDocumentsQuery) {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + query.daysUntilExpiry);
    const expiryDateStr = expiryThreshold.toISOString().split('T')[0];

    const results = await this.db.select()
      .from(documents)
      .where(and(
        eq(documents.tenantId, query.tenantId),
        sql`${documents.expiryDate} < ${expiryDateStr}`
      ))
      .orderBy(asc(documents.expiryDate))
      .limit(query.limit);

    return results;
  }
}

export class VerificationRequestQueryHandler {
  private db = getDb();

  async getVerificationRequest(query: GetVerificationRequestQuery) {
    const [request] = await this.db.select()
      .from(verificationRequests)
      .where(and(
        eq(verificationRequests.id, query.requestId),
        eq(verificationRequests.tenantId, query.tenantId)
      ))
      .limit(1);

    return request || null;
  }

  async listVerificationRequests(query: ListVerificationRequestsQuery) {
    const conditions = [eq(verificationRequests.tenantId, query.tenantId)];

    if (query.identityId) {
      conditions.push(eq(verificationRequests.identityId, query.identityId));
    }
    if (query.status) {
      conditions.push(eq(verificationRequests.status, query.status));
    }
    if (query.type) {
      conditions.push(eq(verificationRequests.type, query.type));
    }
    if (query.assignedTo) {
      conditions.push(eq(verificationRequests.assignedTo, query.assignedTo));
    }
    if (query.priority) {
      conditions.push(eq(verificationRequests.priority, query.priority));
    }

    const orderColumn = query.orderBy === 'createdAt' ? verificationRequests.createdAt
      : query.orderBy === 'priority' ? verificationRequests.priority
      : verificationRequests.requestedAt;

    const orderFn = query.orderDirection === 'asc' ? asc : desc;

    const results = await this.db.select()
      .from(verificationRequests)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(query.limit)
      .offset(query.offset);

    const countResult = await this.db.select({ total: count() })
      .from(verificationRequests)
      .where(and(...conditions));

    const total = countResult[0]?.total ?? 0;

    return {
      items: results,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getPendingReviews(query: GetPendingReviewsQuery) {
    const conditions = [
      eq(verificationRequests.tenantId, query.tenantId),
      or(
        eq(verificationRequests.status, 'PENDING'),
        eq(verificationRequests.status, 'IN_REVIEW')
      )!,
    ];

    if (query.assignedTo) {
      conditions.push(eq(verificationRequests.assignedTo, query.assignedTo));
    }

    const results = await this.db.select()
      .from(verificationRequests)
      .where(and(...conditions))
      .orderBy(
        desc(sql`CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END`),
        asc(verificationRequests.requestedAt)
      )
      .limit(query.limit);

    return results;
  }

  async getVerificationStatistics(query: GetVerificationStatisticsQuery) {
    const conditions = [eq(verificationRequests.tenantId, query.tenantId)];

    if (query.startDate) {
      conditions.push(sql`${verificationRequests.createdAt} >= ${query.startDate}`);
    }
    if (query.endDate) {
      conditions.push(sql`${verificationRequests.createdAt} <= ${query.endDate}`);
    }

    const stats = await this.db.select({
      status: verificationRequests.status,
      count: count(),
    })
      .from(verificationRequests)
      .where(and(...conditions))
      .groupBy(verificationRequests.status);

    const byType = await this.db.select({
      type: verificationRequests.type,
      count: count(),
    })
      .from(verificationRequests)
      .where(and(...conditions))
      .groupBy(verificationRequests.type);

    return {
      byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {} as Record<string, number>),
      byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t.count }), {} as Record<string, number>),
    };
  }
}

export class AmlScreeningQueryHandler {
  private db = getDb();

  async getAmlScreeningResults(query: GetAmlScreeningResultsQuery) {
    const conditions = [
      eq(amlScreeningResults.identityId, query.identityId),
      eq(amlScreeningResults.tenantId, query.tenantId),
    ];

    if (query.screeningType) {
      conditions.push(eq(amlScreeningResults.screeningType, query.screeningType));
    }

    const results = await this.db.select()
      .from(amlScreeningResults)
      .where(and(...conditions))
      .orderBy(desc(amlScreeningResults.screenedAt));

    return results;
  }
}

export class AuditLogQueryHandler {
  private db = getDb();

  async getIdentityAuditLog(query: GetIdentityAuditLogQuery) {
    const results = await this.db.select()
      .from(kycAuditLog)
      .where(and(
        eq(kycAuditLog.entityId, query.identityId),
        eq(kycAuditLog.tenantId, query.tenantId)
      ))
      .orderBy(desc(kycAuditLog.performedAt))
      .limit(query.limit)
      .offset(query.offset);

    return results;
  }
}
