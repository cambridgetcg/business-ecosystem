/**
 * Payment Approval Service Types
 *
 * Type definitions for the payment approval workflow system.
 *
 * @module services/approval/types
 */

export interface ApprovalPolicy {
  id: string;
  name: string;
  entityId?: string;
  minAmount: number;
  maxAmount?: number;
  currency?: string;
  paymentMethod?: string;
  requiredLevels: number;
  approversPerLevel: ApproverConfig[];
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface ApproverConfig {
  level: number;
  requiredCount: number;
  approverIds?: string[];
  approverRoles?: string[];
  timeoutHours?: number;
}

export interface PaymentApproval {
  id: string;
  paymentId: string;
  policyId: string;
  currentLevel: number;
  totalLevels: number;
  status: ApprovalStatus;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  decisions: ApprovalDecision[];
}

export interface ApprovalDecision {
  id: string;
  approvalId: string;
  level: number;
  approverId: string;
  decision: 'approve' | 'reject';
  reason?: string;
  decidedAt: Date;
  metadata?: Record<string, unknown>;
}

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface CreateApprovalPolicyInput {
  name: string;
  entityId?: string;
  minAmount: number;
  maxAmount?: number;
  currency?: string;
  paymentMethod?: string;
  requiredLevels: number;
  approversPerLevel: ApproverConfig[];
  priority?: number;
  createdBy?: string;
}

export interface ApprovalDecisionInput {
  approvalId: string;
  approverId: string;
  decision: 'approve' | 'reject';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalCheckResult {
  requiresApproval: boolean;
  matchedPolicy?: ApprovalPolicy;
  reason: string;
}

export interface PendingApproval {
  approval: PaymentApproval;
  payment: {
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
  };
  policy: ApprovalPolicy;
  pendingAtLevel: number;
  decisionsAtCurrentLevel: ApprovalDecision[];
  requiredApprovalsAtCurrentLevel: number;
}
