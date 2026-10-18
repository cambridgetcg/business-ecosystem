/**
 * Security Service
 *
 * Core security operations including authentication, authorization, and audit.
 * Publishes domain events to the ecosystem event bus for cross-service integration.
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull, gt, lt, or, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/persistence/database.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import {
  getGlobalEventPublisher,
  type RabbitMQSecurityEventPublisher,
} from '../../infrastructure/messaging/index.js';
import {
  type Identity,
  type CreateIdentityInput,
  recordFailedLogin,
  recordSuccessfulLogin,
  canAuthenticate,
  isLocked,
  requiresMFA,
} from '../../domain/identity/models/identity.js';
import {
  type Role,
  type RoleAssignment,
  type CreateRoleInput,
  hasPermission,
  isAssignmentActive,
  getEffectivePermissions,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../domain/access-control/models/role.js';
import {
  type AccessPolicy,
  type AccessRequest,
  type AccessDecision,
  evaluatePolicy,
  isPolicyActive,
} from '../../domain/access-control/models/policy.js';
import {
  type AuditLog,
  type CreateAuditLogInput,
  getEventCategory,
  getEventSeverity,
  calculateChecksum,
} from '../../domain/audit/models/audit-log.js';

export class SecurityService {
  constructor(private readonly db: Database) {}

  /**
   * Get the event publisher (may be null if event bus not initialized)
   */
  private getPublisher(): RabbitMQSecurityEventPublisher | null {
    return getGlobalEventPublisher() as RabbitMQSecurityEventPublisher | null;
  }

  // ===========================================================================
  // Identity Management
  // ===========================================================================

  async createIdentity(input: CreateIdentityInput): Promise<Identity> {
    const id = uuidv4();
    const now = new Date();

    // Hash password if provided (in production, use bcrypt)
    let passwordHash: string | null = null;
    let passwordSalt: string | null = null;
    if (input.password) {
      passwordSalt = uuidv4().replace(/-/g, '');
      // Simple hash for demo - use bcrypt in production
      passwordHash = Buffer.from(input.password + passwordSalt).toString('base64');
    }

    const [identity] = await this.db.insert(schema.identities).values({
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      email: input.email,
      username: input.username || null,
      status: input.ssoProvider ? 'active' : 'pending_verification',
      mfaStatus: input.requireMFA ? 'enforced' : 'not_configured',
      passwordHash,
      passwordSalt,
      ssoProvider: input.ssoProvider || null,
      ssoExternalId: input.ssoExternalId || null,
      emailVerified: !!input.ssoProvider,
      emailVerifiedAt: input.ssoProvider ? now : null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).returning();

    // Log the creation
    await this.createAuditLog({
      tenantId: input.tenantId,
      eventType: 'user_created',
      actorType: 'system',
      targetType: 'identity',
      targetId: id,
      action: 'create_identity',
      outcome: 'success',
    });

    // Publish identity created event
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishIdentityCreated({
        identityId: id,
        tenantId: input.tenantId,
        email: input.email,
        status: input.ssoProvider ? 'active' : 'pending_verification',
        createdBy: input.userId,
      });
    }

    return identity as unknown as Identity;
  }

  async getIdentity(id: string): Promise<Identity | null> {
    const [identity] = await this.db
      .select()
      .from(schema.identities)
      .where(and(
        eq(schema.identities.id, id),
        isNull(schema.identities.deletedAt)
      ));

    return identity as unknown as Identity || null;
  }

  async getIdentityByEmail(tenantId: string, email: string): Promise<Identity | null> {
    const [identity] = await this.db
      .select()
      .from(schema.identities)
      .where(and(
        eq(schema.identities.tenantId, tenantId),
        eq(schema.identities.email, email),
        isNull(schema.identities.deletedAt)
      ));

    return identity as unknown as Identity || null;
  }

  async authenticatePassword(
    tenantId: string,
    email: string,
    password: string,
    ip: string,
    userAgent: string
  ): Promise<{ success: boolean; identity?: Identity; requiresMFA?: boolean; error?: string }> {
    const identity = await this.getIdentityByEmail(tenantId, email);

    if (!identity) {
      await this.createAuditLog({
        tenantId,
        eventType: 'login_failure',
        actorType: 'anonymous',
        actorEmail: email,
        action: 'password_login',
        outcome: 'failure',
        reason: 'Identity not found',
        ipAddress: ip,
        userAgent,
      });
      return { success: false, error: 'Invalid credentials' };
    }

    if (!canAuthenticate(identity)) {
      const reason = isLocked(identity) ? 'Account locked' : 'Account not active';
      await this.createAuditLog({
        tenantId,
        eventType: 'login_failure',
        actorType: 'user',
        actorId: identity.id,
        actorEmail: email,
        action: 'password_login',
        outcome: 'failure',
        reason,
        ipAddress: ip,
        userAgent,
      });
      return { success: false, error: reason };
    }

    // Verify password
    const expectedHash = Buffer.from(password + identity.passwordSalt).toString('base64');
    if (identity.passwordHash !== expectedHash) {
      // Record failed attempt
      const updates = recordFailedLogin(identity);
      await this.db
        .update(schema.identities)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.identities.id, identity.id));

      await this.createAuditLog({
        tenantId,
        eventType: 'login_failure',
        actorType: 'user',
        actorId: identity.id,
        actorEmail: email,
        action: 'password_login',
        outcome: 'failure',
        reason: 'Invalid password',
        ipAddress: ip,
        userAgent,
      });

      // Publish login failure event
      const publisher = this.getPublisher();
      if (publisher) {
        await publisher.publishLoginFailure({
          email,
          tenantId,
          reason: 'Invalid password',
          failedAttempts: (identity.failedLoginAttempts || 0) + 1,
          ipAddress: ip,
        });
      }

      return { success: false, error: 'Invalid credentials' };
    }

    // Record successful login
    const updates = recordSuccessfulLogin(identity, ip, userAgent);
    await this.db
      .update(schema.identities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.identities.id, identity.id));

    await this.createAuditLog({
      tenantId,
      eventType: 'login_success',
      actorType: 'user',
      actorId: identity.id,
      actorEmail: email,
      action: 'password_login',
      outcome: 'success',
      ipAddress: ip,
      userAgent,
    });

    const updatedIdentity = { ...identity, ...updates };

    // Publish login success event (we'll include session info after session is created)
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishLoginSuccess({
        identityId: identity.id,
        tenantId,
        email,
        sessionId: '', // Session created separately
        mfaUsed: false,
        ipAddress: ip,
      });
    }

    if (requiresMFA(identity)) {
      return { success: true, identity: updatedIdentity as Identity, requiresMFA: true };
    }

    return { success: true, identity: updatedIdentity as Identity };
  }

  // ===========================================================================
  // Role Management
  // ===========================================================================

  async createRole(input: CreateRoleInput): Promise<Role> {
    const id = uuidv4();
    const now = new Date();

    const permissions = input.permissions.map(p => ({
      id: uuidv4(),
      ...p,
      scope: p.scope || 'tenant',
      conditions: p.conditions || null,
    }));

    const [role] = await this.db.insert(schema.roles).values({
      id,
      tenantId: input.tenantId || null,
      name: input.name,
      description: input.description || null,
      parentRoleId: input.parentRoleId || null,
      permissions,
      requiresMFA: input.requiresMFA || false,
      sessionTimeout: input.sessionTimeout || null,
      ipRestrictions: input.ipRestrictions || null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).returning();

    return role as unknown as Role;
  }

  async getRole(id: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(
        eq(schema.roles.id, id),
        isNull(schema.roles.deletedAt)
      ));

    return role as unknown as Role || null;
  }

  async getRolesByTenant(tenantId: string): Promise<Role[]> {
    const roles = await this.db
      .select()
      .from(schema.roles)
      .where(and(
        or(
          eq(schema.roles.tenantId, tenantId),
          isNull(schema.roles.tenantId) // System roles
        ),
        isNull(schema.roles.deletedAt)
      ));

    return roles as unknown as Role[];
  }

  async assignRole(
    tenantId: string,
    identityId: string,
    roleId: string,
    assignedBy: string,
    options?: {
      entityId?: string;
      validUntil?: Date;
      delegatable?: boolean;
    }
  ): Promise<RoleAssignment> {
    const id = uuidv4();
    const now = new Date();

    const [assignment] = await this.db.insert(schema.roleAssignments).values({
      id,
      tenantId,
      identityId,
      roleId,
      entityId: options?.entityId || null,
      validFrom: now,
      validUntil: options?.validUntil || null,
      delegatable: options?.delegatable || false,
      assignedAt: now,
      assignedBy,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await this.createAuditLog({
      tenantId,
      eventType: 'role_assigned',
      actorType: 'user',
      actorId: assignedBy,
      targetType: 'identity',
      targetId: identityId,
      action: 'assign_role',
      outcome: 'success',
      newValue: { roleId, entityId: options?.entityId },
    });

    // Publish role assigned event
    const publisher = this.getPublisher();
    if (publisher) {
      // Fetch role name for the event
      const role = await this.getRole(roleId);
      await publisher.publishRoleAssigned({
        assignmentId: id,
        identityId,
        tenantId,
        roleId,
        roleName: role?.name ?? 'Unknown',
        assignedBy,
        entityId: options?.entityId,
      });
    }

    return assignment as unknown as RoleAssignment;
  }

  async getIdentityRoles(tenantId: string, identityId: string): Promise<Role[]> {
    const assignments = await this.db
      .select()
      .from(schema.roleAssignments)
      .where(and(
        eq(schema.roleAssignments.tenantId, tenantId),
        eq(schema.roleAssignments.identityId, identityId),
        isNull(schema.roleAssignments.revokedAt)
      ));

    const activeAssignments = (assignments as unknown as RoleAssignment[])
      .filter(a => isAssignmentActive(a));

    if (activeAssignments.length === 0) return [];

    const roleIds = activeAssignments.map(a => a.roleId);
    const roles = await this.db
      .select()
      .from(schema.roles)
      .where(and(
        or(...roleIds.map(id => eq(schema.roles.id, id))),
        isNull(schema.roles.deletedAt)
      ));

    return roles as unknown as Role[];
  }

  // ===========================================================================
  // Authorization (Policy Evaluation)
  // ===========================================================================

  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    const startTime = Date.now();

    // Get identity's roles
    const roles = await this.getIdentityRoles(
      request.subjectAttributes.tenantId as string,
      request.subjectId
    );

    // First check RBAC permissions
    for (const role of roles) {
      if (hasPermission(role, request.resourceType, request.action)) {
        return {
          decision: 'allow',
          matchedPolicies: [],
          matchedRules: [],
          reason: `Allowed by role: ${role.name}`,
          evaluatedAt: new Date(),
          evaluationTimeMs: Date.now() - startTime,
        };
      }
    }

    // Then evaluate ABAC policies
    const policies = await this.db
      .select()
      .from(schema.accessPolicies)
      .where(and(
        or(
          eq(schema.accessPolicies.tenantId, request.subjectAttributes.tenantId as string),
          isNull(schema.accessPolicies.tenantId)
        ),
        eq(schema.accessPolicies.enabled, true),
        isNull(schema.accessPolicies.deletedAt)
      ));

    const activePolicies = (policies as unknown as AccessPolicy[])
      .filter(p => isPolicyActive(p));

    let finalDecision: AccessDecision = {
      decision: 'deny',
      matchedPolicies: [],
      matchedRules: [],
      reason: 'No matching policies',
      evaluatedAt: new Date(),
      evaluationTimeMs: 0,
    };

    for (const policy of activePolicies) {
      const decision = evaluatePolicy(policy, request);
      if (decision.decision === 'allow') {
        finalDecision = decision;
        break;
      }
      if (decision.matchedRules.length > 0) {
        finalDecision = decision;
      }
    }

    finalDecision.evaluationTimeMs = Date.now() - startTime;

    // Log the access decision
    await this.createAuditLog({
      tenantId: request.subjectAttributes.tenantId as string,
      eventType: finalDecision.decision === 'allow' ? 'access_granted' : 'access_denied',
      actorType: request.subjectType === 'service' ? 'service' : 'user',
      actorId: request.subjectId,
      targetType: request.resourceType,
      targetId: request.resourceId,
      action: request.action,
      outcome: finalDecision.decision === 'allow' ? 'success' : 'denied',
      reason: finalDecision.reason,
      ipAddress: request.environment.ipAddress,
      userAgent: request.environment.userAgent,
      requestId: request.environment.requestId,
    });

    return finalDecision;
  }

  // ===========================================================================
  // Audit Logging
  // ===========================================================================

  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    const id = uuidv4();
    const now = new Date();
    const category = getEventCategory(input.eventType);
    const severity = getEventSeverity(input.eventType, input.outcome);

    // Get previous log for chain linking
    const [previousLog] = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.tenantId, input.tenantId))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(1);

    const logData = {
      id,
      tenantId: input.tenantId,
      eventType: input.eventType,
      eventCategory: category,
      severity,
      actorId: input.actorId || null,
      actorType: input.actorType,
      actorEmail: input.actorEmail || null,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason || null,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      requestId: input.requestId || null,
      sessionId: input.sessionId || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      resourcePath: input.resourcePath || null,
      previousValue: input.previousValue || null,
      newValue: input.newValue || null,
      metadata: input.metadata || null,
      tags: input.tags || null,
      timestamp: now,
      previousLogId: previousLog?.id || null,
    };

    const checksum = calculateChecksum(logData as Partial<AuditLog>, previousLog?.checksum || undefined);

    const [auditLog] = await this.db.insert(schema.auditLogs).values({
      ...logData,
      checksum,
    }).returning();

    return auditLog as unknown as AuditLog;
  }

  async getAuditLogs(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      eventType?: string;
      actorId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]> {
    const conditions = [eq(schema.auditLogs.tenantId, tenantId)];

    if (options?.startDate) {
      conditions.push(gt(schema.auditLogs.timestamp, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lt(schema.auditLogs.timestamp, options.endDate));
    }
    if (options?.eventType) {
      conditions.push(eq(schema.auditLogs.eventType, options.eventType));
    }
    if (options?.actorId) {
      conditions.push(eq(schema.auditLogs.actorId, options.actorId));
    }

    const logs = await this.db
      .select()
      .from(schema.auditLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    return logs as unknown as AuditLog[];
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  async createSession(
    tenantId: string,
    identityId: string,
    ip: string,
    userAgent: string,
    expiresInHours: number = 24
  ): Promise<{ sessionId: string; sessionToken: string }> {
    const id = uuidv4();
    const sessionToken = `${uuidv4()}-${uuidv4()}`.replace(/-/g, '');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    await this.db.insert(schema.sessions).values({
      id,
      tenantId,
      identityId,
      sessionToken,
      status: 'active',
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      ipAddress: ip,
      userAgent,
    });

    return { sessionId: id, sessionToken };
  }

  async validateSession(sessionToken: string): Promise<{ valid: boolean; identityId?: string; tenantId?: string }> {
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(and(
        eq(schema.sessions.sessionToken, sessionToken),
        eq(schema.sessions.status, 'active'),
        gt(schema.sessions.expiresAt, new Date())
      ));

    if (!session) {
      return { valid: false };
    }

    // Update last activity
    await this.db
      .update(schema.sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(schema.sessions.id, session.id));

    return {
      valid: true,
      identityId: session.identityId,
      tenantId: session.tenantId,
    };
  }

  async revokeSession(sessionToken: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(schema.sessions.sessionToken, sessionToken));
  }

  // ===========================================================================
  // Security Incident Management
  // ===========================================================================

  async reportSecurityIncident(input: {
    tenantId: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    detectedBy: 'system' | 'user' | 'external';
    detectionSource?: string;
    affectedResources?: string[];
    reportedBy?: string;
  }): Promise<{ incidentId: string; incidentNumber: string }> {
    const id = uuidv4();
    const now = new Date();

    // Generate incident number (format: INC-YYYYMMDD-XXXX)
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const incidentNumber = `INC-${dateStr}-${randomSuffix}`;

    await this.db.insert(schema.securityIncidents).values({
      id,
      tenantId: input.tenantId,
      incidentNumber,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'open',
      category: input.category,
      detectedAt: now,
      detectedBy: input.detectedBy,
      detectionSource: input.detectionSource || null,
      affectedResources: input.affectedResources || null,
      createdAt: now,
      updatedAt: now,
      createdBy: input.reportedBy || null,
      version: 1,
    });

    // Log the incident creation
    await this.createAuditLog({
      tenantId: input.tenantId,
      eventType: 'security_incident_created',
      actorType: input.detectedBy === 'user' ? 'user' : 'system',
      actorId: input.reportedBy,
      targetType: 'security_incident',
      targetId: id,
      action: 'create_incident',
      outcome: 'success',
      newValue: { incidentNumber, severity: input.severity, category: input.category },
    });

    // Publish incident created event
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishIncidentCreated({
        incidentId: id,
        tenantId: input.tenantId,
        incidentNumber,
        title: input.title,
        severity: input.severity,
        category: input.category,
        detectedBy: input.detectedBy,
      });
    }

    return { incidentId: id, incidentNumber };
  }

  async escalateSecurityIncident(input: {
    tenantId: string;
    incidentId: string;
    newSeverity: 'critical' | 'high' | 'medium' | 'low';
    reason: string;
    escalatedBy: string;
  }): Promise<void> {
    // Get current incident
    const [incident] = await this.db
      .select()
      .from(schema.securityIncidents)
      .where(eq(schema.securityIncidents.id, input.incidentId));

    if (!incident) {
      throw new Error(`Incident not found: ${input.incidentId}`);
    }

    const previousSeverity = incident.severity;
    const now = new Date();

    // Update incident severity
    await this.db
      .update(schema.securityIncidents)
      .set({
        severity: input.newSeverity,
        updatedAt: now,
        updatedBy: input.escalatedBy,
        version: (incident.version || 1) + 1,
      })
      .where(eq(schema.securityIncidents.id, input.incidentId));

    // Log the escalation
    await this.createAuditLog({
      tenantId: input.tenantId,
      eventType: 'security_incident_escalated',
      actorType: 'user',
      actorId: input.escalatedBy,
      targetType: 'security_incident',
      targetId: input.incidentId,
      action: 'escalate_incident',
      outcome: 'success',
      previousValue: { severity: previousSeverity },
      newValue: { severity: input.newSeverity },
      reason: input.reason,
    });

    // Publish incident escalated event
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishIncidentEscalated({
        incidentId: input.incidentId,
        tenantId: input.tenantId,
        incidentNumber: incident.incidentNumber,
        previousSeverity,
        newSeverity: input.newSeverity,
        reason: input.reason,
        escalatedBy: input.escalatedBy,
      });
    }
  }

  async logCriticalAction(input: {
    tenantId: string;
    actorId: string;
    actorEmail?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    description: string;
    ipAddress?: string;
  }): Promise<void> {
    const auditLogId = uuidv4();

    // Log the critical action
    await this.createAuditLog({
      tenantId: input.tenantId,
      eventType: 'critical_action',
      actorType: 'user',
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      targetType: input.resourceType,
      targetId: input.resourceId,
      action: input.action,
      outcome: 'success',
      reason: input.description,
      ipAddress: input.ipAddress,
    });

    // Publish critical action event
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishCriticalAction({
        auditLogId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        description: input.description,
        ipAddress: input.ipAddress,
      });
    }
  }

  async reportAnomalyDetected(input: {
    tenantId: string;
    anomalyType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    affectedIdentityId?: string;
    indicators: Record<string, unknown>;
  }): Promise<void> {
    const anomalyId = uuidv4();

    // Log the anomaly detection
    await this.createAuditLog({
      tenantId: input.tenantId,
      eventType: 'anomaly_detected',
      actorType: 'system',
      action: 'detect_anomaly',
      outcome: 'success',
      targetType: input.affectedIdentityId ? 'identity' : undefined,
      targetId: input.affectedIdentityId,
      reason: input.description,
      metadata: {
        anomalyType: input.anomalyType,
        severity: input.severity,
        indicators: input.indicators,
      },
    });

    // Publish anomaly detected event
    const publisher = this.getPublisher();
    if (publisher) {
      await publisher.publishAnomalyDetected({
        anomalyId,
        tenantId: input.tenantId,
        anomalyType: input.anomalyType,
        severity: input.severity,
        description: input.description,
        affectedIdentityId: input.affectedIdentityId,
        indicators: input.indicators,
      });
    }
  }
}
