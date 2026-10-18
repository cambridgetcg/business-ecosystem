# Access Control Policy

> **Version**: 1.0
> **Effective Date**: 2026-01-30
> **Owner**: Security Lead
> **Review Cycle**: Annual

---

## 1. Purpose

This policy establishes requirements for controlling access to information systems, applications, and data within the Business Ecosystem platform.

---

## 2. Scope

This policy applies to:
- All system access (production, staging, development)
- All user types (employees, contractors, service accounts)
- All access methods (console, API, CLI)

---

## 3. Access Control Model

### 3.1 Role-Based Access Control (RBAC)

The platform implements RBAC through the Corporate Security service.

```
User ──► Role ──► Permissions ──► Resources
```

### 3.2 Standard Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `system_admin` | Full system administration | All operations |
| `security_admin` | Security management | Identity, role, audit management |
| `entity_admin` | Entity management | Create, update entities |
| `entity_viewer` | Read-only entity access | Read entities |
| `compliance_officer` | Compliance management | Compliance operations |
| `auditor` | Read-only audit access | Read audit logs |
| `api_user` | API access | API operations per scope |

### 3.3 Permission Structure

```typescript
// Permission format
{
  resource: 'entity' | 'identity' | 'audit' | 'compliance' | '*',
  action: 'create' | 'read' | 'update' | 'delete' | '*',
  scope: 'own' | 'tenant' | 'global'
}
```

### 3.4 Attribute-Based Access Control (ABAC)

Additional access rules based on:
- Time of day restrictions
- IP address restrictions
- Resource attributes (status, classification)
- Environment (production vs non-production)

---

## 4. User Account Management

### 4.1 Account Lifecycle

| Stage | Process | Approval Required |
|-------|---------|-------------------|
| Request | User or manager submits request | Manager |
| Provision | Security creates account | Security Admin |
| Modify | Role or permission changes | Manager + Security |
| Disable | Temporary suspension | Manager or Security |
| Terminate | Permanent removal | Manager + HR |

### 4.2 Account Types

| Type | Purpose | Expiry | MFA |
|------|---------|--------|-----|
| Employee | Staff access | On termination | Required |
| Contractor | Temporary access | Contract end date | Required |
| Service Account | System-to-system | Never (rotated) | N/A |
| Emergency | Break-glass access | 24 hours | Required |

### 4.3 Naming Conventions

```
Employee:     firstname.lastname@company.com
Contractor:   c-firstname.lastname@company.com
Service:      svc-{service-name}-{environment}
Emergency:    emergency-{function}-{sequence}
```

---

## 5. Authentication Requirements

### 5.1 Password Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Complexity | Uppercase, lowercase, number, special |
| History | Last 12 passwords |
| Maximum age | 90 days |
| Lockout threshold | 5 attempts |
| Lockout duration | 15 minutes |

### 5.2 Multi-Factor Authentication

**MFA Required For:**
- All production system access
- All administrative access
- VPN access
- Privileged API access

**MFA Methods:**
- TOTP (Google Authenticator, Authy)
- Hardware tokens (YubiKey)
- Push notifications (where supported)

### 5.3 Session Management

| Setting | Value |
|---------|-------|
| Session timeout (inactive) | 30 minutes |
| Session timeout (absolute) | 8 hours |
| Concurrent sessions | 3 maximum |
| Session revocation | Immediate on logout |

---

## 6. Authorization

### 6.1 Access Decision Flow

```
Request
   │
   ▼
[Authentication] ── Fail ──► Deny (401)
   │
   Pass
   │
   ▼
[Authorization] ── Fail ──► Deny (403)
   │
   Pass
   │
   ▼
[Rate Limiting] ── Fail ──► Deny (429)
   │
   Pass
   │
   ▼
Allow
```

### 6.2 Least Privilege

- Default deny: No access unless explicitly granted
- Minimum necessary: Only permissions required for function
- Time-limited: Elevated access expires automatically

### 6.3 Separation of Duties

| Function | Separated From |
|----------|----------------|
| User creation | User approval |
| Code development | Production deployment |
| Financial entry | Financial approval |
| Audit review | Audited operations |

---

## 7. Privileged Access

### 7.1 Privileged Accounts

| Account Type | Use Case | Controls |
|--------------|----------|----------|
| System Admin | Infrastructure management | MFA + approval workflow |
| Database Admin | Database management | MFA + just-in-time access |
| Security Admin | Security management | MFA + dual approval |
| Emergency Admin | Break-glass scenarios | MFA + automatic audit |

### 7.2 Privileged Access Management

1. **Request**: Justify need for elevated access
2. **Approve**: Manager and security approval
3. **Grant**: Time-limited access (max 8 hours)
4. **Monitor**: All actions logged
5. **Revoke**: Automatic expiry or manual revocation

### 7.3 Emergency Access

Emergency (break-glass) procedures:
1. Request emergency access with justification
2. Security grants temporary admin access
3. All actions logged and alerted
4. Post-incident review required
5. Access revoked within 24 hours

---

## 8. Service Account Management

### 8.1 Service Account Requirements

- Unique account per service/purpose
- No interactive login capability
- Credentials stored in secrets manager
- Credentials rotated every 90 days
- Minimum permissions required

### 8.2 API Key Management

| Environment | Key Rotation | Rate Limit |
|-------------|--------------|------------|
| Production | 90 days | Per service SLA |
| Staging | 90 days | 1000/min |
| Development | 180 days | 100/min |

---

## 9. Remote Access

### 9.1 VPN Requirements

- Corporate VPN required for internal network access
- MFA required for VPN authentication
- Split tunneling disabled
- Session timeout: 8 hours

### 9.2 Cloud Console Access

- AWS Console: SSO via corporate IdP
- MFA required for all console access
- CloudTrail logging enabled
- Session duration: 4 hours maximum

---

## 10. Access Reviews

### 10.1 Review Schedule

| Review Type | Frequency | Reviewer |
|-------------|-----------|----------|
| Privileged access | Monthly | Security Team |
| User access | Quarterly | Managers |
| Service accounts | Quarterly | Service owners |
| Dormant accounts | Monthly | Security Team |

### 10.2 Review Process

1. Generate access report
2. Distribute to reviewers
3. Reviewers confirm/revoke access
4. Security implements changes
5. Document review completion

### 10.3 Dormant Account Policy

- Warning after 30 days of inactivity
- Disabled after 60 days of inactivity
- Deleted after 90 days of inactivity (non-employee)

---

## 11. Access Logging and Monitoring

### 11.1 Logged Events

| Event | Log Level | Retention |
|-------|-----------|-----------|
| Login success | Info | 2 years |
| Login failure | Warning | 2 years |
| Permission denied | Warning | 2 years |
| Privilege escalation | Alert | 2 years |
| Account modification | Info | 2 years |

### 11.2 Alerting

| Alert | Trigger | Response |
|-------|---------|----------|
| Brute force | 5 failures in 5 minutes | Auto-lockout |
| Impossible travel | Login from distant location | Verify user |
| Privilege abuse | Unusual admin activity | Investigate |
| After-hours access | Access outside business hours | Review next day |

---

## 12. Termination Procedures

### 12.1 Access Revocation Checklist

- [ ] Disable corporate account
- [ ] Revoke VPN access
- [ ] Remove from all systems
- [ ] Revoke API keys
- [ ] Remove from distribution lists
- [ ] Collect physical access cards
- [ ] Update emergency contacts

### 12.2 Timing

| Termination Type | Access Revocation |
|------------------|-------------------|
| Voluntary | Last business day |
| Involuntary | Immediate |
| Contractor end | Contract end date |
| Role change | Same day as role change |

---

## 13. Compliance

### 13.1 Policy Compliance

- Annual policy acknowledgment required
- Compliance monitored via access reviews
- Violations escalated to management

### 13.2 Audit Trail

All access control events are logged in:
- Corporate Security audit log
- CloudTrail (AWS operations)
- Application audit logs

---

## Appendices

### A. Access Request Form

```
Requestor: _______________
Date: _______________
User: _______________
Access Requested: _______________
Business Justification: _______________
Duration: _______________
Manager Approval: _______________
Security Approval: _______________
```

### B. Access Review Template

```
Review Period: _______________
Reviewer: _______________
Users Reviewed: _______________
Access Confirmed: _______________
Access Revoked: _______________
Issues Identified: _______________
```

---

*Document Control: This policy is controlled. Printed copies are uncontrolled.*
