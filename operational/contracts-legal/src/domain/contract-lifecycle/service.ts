/**
 * Contract Lifecycle - Service Layer
 *
 * Business logic for contract state transitions, renewals, and lifecycle management
 */

import { addDays } from 'date-fns';
import { Contract } from '@prisma/client';
import { LifecycleRepository, ContractWithRelations, ExpiringContract } from './repository.js';
import {
  LifecycleStatus,
  TransitionRequest,
  RenewalRequest,
  ExpirationQuery,
  BulkRenewalRequest,
  ContractHealth,
  LifecycleEvent,
  isValidTransition,
  getAllowedTransitions,
  ACTION_TARGET_STATUS,
} from './validators.js';
import { NotFoundError, BusinessRuleError, ContractStatusError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export interface TransitionResult {
  success: boolean;
  contract: Contract;
  previousStatus: LifecycleStatus;
  newStatus: LifecycleStatus;
  event: LifecycleEvent;
}

export interface BulkRenewalResult {
  successful: string[];
  failed: Array<{ contractId: string; reason: string }>;
  totalProcessed: number;
}

export class ContractLifecycleService {
  private log = logger.child({ domain: 'contract-lifecycle' });

  constructor(private repository: LifecycleRepository) {}

  async getContract(id: string): Promise<ContractWithRelations> {
    const contract = await this.repository.findById(id);
    if (!contract) {
      throw new NotFoundError('Contract', id);
    }
    return contract;
  }

  async transition(request: TransitionRequest, userId: string): Promise<TransitionResult> {
    const contract = await this.getContract(request.contractId);
    const currentStatus = contract.status as LifecycleStatus;
    const targetStatus = ACTION_TARGET_STATUS[request.action];

    // Validate the transition
    if (!isValidTransition(currentStatus, targetStatus)) {
      throw new ContractStatusError(
        currentStatus,
        getAllowedTransitions(currentStatus),
        request.action.toLowerCase().replace(/_/g, ' ')
      );
    }

    // Additional business rules for specific transitions
    await this.validateTransitionRules(contract, request.action, targetStatus);

    // Perform the transition
    const updatedContract = await this.repository.updateStatus(
      contract.id,
      targetStatus,
      userId,
      this.getAdditionalUpdateData(request.action)
    );

    // Record the activity
    await this.repository.recordActivity(
      contract.id,
      'STATUS_CHANGED',
      `Contract transitioned from ${currentStatus} to ${targetStatus} via ${request.action}`,
      userId,
      {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        action: request.action,
        reason: request.reason,
        ...request.metadata,
      }
    );

    const event: LifecycleEvent = {
      contractId: contract.id,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      action: request.action,
      performedBy: userId,
      performedAt: new Date(),
      reason: request.reason,
      metadata: request.metadata,
    };

    this.log.info(
      { contractId: contract.id, from: currentStatus, to: targetStatus, action: request.action },
      'Contract lifecycle transition completed'
    );

    return {
      success: true,
      contract: updatedContract,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      event,
    };
  }

  async renew(request: RenewalRequest, userId: string): Promise<Contract> {
    const contract = await this.getContract(request.contractId);
    const status = contract.status as LifecycleStatus;

    if (!['ACTIVE', 'EXPIRED'].includes(status)) {
      throw new ContractStatusError(status, ['ACTIVE', 'EXPIRED'], 'renew');
    }

    const renewalDays = request.renewalTermDays ?? contract.renewalTermDays;
    if (!renewalDays && !request.newExpiryDate) {
      throw new BusinessRuleError(
        'Contract does not have renewal terms defined and no new expiry date provided'
      );
    }

    const newExpiryDate =
      request.newExpiryDate ?? addDays(contract.expiryDate ?? new Date(), renewalDays!);

    const updates: Record<string, unknown> = {};
    if (request.updateValue !== undefined) {
      updates.value = request.updateValue;
    }
    if (request.updateCurrency) {
      updates.currency = request.updateCurrency;
    }

    const renewedContract = await this.repository.renewContract(
      contract.id,
      newExpiryDate,
      userId,
      updates
    );

    await this.repository.recordActivity(
      contract.id,
      'RENEWED',
      `Contract renewed. New expiry date: ${newExpiryDate.toISOString()}`,
      userId,
      {
        previousExpiryDate: contract.expiryDate?.toISOString(),
        newExpiryDate: newExpiryDate.toISOString(),
        notes: request.notes,
      }
    );

    this.log.info(
      { contractId: contract.id, newExpiryDate },
      'Contract renewed successfully'
    );

    return renewedContract;
  }

  async bulkRenew(request: BulkRenewalRequest, userId: string): Promise<BulkRenewalResult> {
    const result: BulkRenewalResult = {
      successful: [],
      failed: [],
      totalProcessed: 0,
    };

    for (const contractId of request.contractIds) {
      result.totalProcessed++;
      try {
        await this.renew(
          {
            contractId,
            renewalTermDays: request.renewalTermDays,
          },
          userId
        );
        result.successful.push(contractId);
      } catch (error) {
        if (!request.skipInvalid) {
          throw error;
        }
        result.failed.push({
          contractId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.log.info(
      {
        total: result.totalProcessed,
        successful: result.successful.length,
        failed: result.failed.length,
      },
      'Bulk renewal completed'
    );

    return result;
  }

  async getExpiringContracts(query: ExpirationQuery): Promise<ExpiringContract[]> {
    return this.repository.findExpiring(query);
  }

  async getContractsForRenewal(daysAhead: number = 30): Promise<Contract[]> {
    return this.repository.findForRenewal(daysAhead);
  }

  async getContractHealth(contractId: string): Promise<ContractHealth> {
    const health = await this.repository.getContractHealth(contractId);
    if (!health) {
      throw new NotFoundError('Contract', contractId);
    }
    return health;
  }

  async processExpiredContracts(userId: string): Promise<number> {
    const expiredCount = await this.repository.bulkUpdateExpired(userId);

    if (expiredCount > 0) {
      this.log.info({ count: expiredCount }, 'Marked contracts as expired');
    }

    return expiredCount;
  }

  async autoRenewEligible(userId: string): Promise<BulkRenewalResult> {
    const contracts = await this.repository.findExpiring({
      daysAhead: 1, // Contracts expiring within 1 day
      includeAutoRenewal: true,
    });

    const autoRenewContracts = contracts.filter((c) => c.autoRenewal);

    if (autoRenewContracts.length === 0) {
      return { successful: [], failed: [], totalProcessed: 0 };
    }

    return this.bulkRenew(
      {
        contractIds: autoRenewContracts.map((c) => c.id),
        skipInvalid: true,
      },
      userId
    );
  }

  async getActivityHistory(contractId: string, limit?: number) {
    await this.getContract(contractId); // Verify contract exists
    return this.repository.getActivityHistory(contractId, limit);
  }

  async getStatusSummary(): Promise<Record<string, number>> {
    return this.repository.getStatusCounts();
  }

  async getAllowedActions(contractId: string): Promise<string[]> {
    const contract = await this.getContract(contractId);
    const status = contract.status as LifecycleStatus;
    const allowedStatuses = getAllowedTransitions(status);

    return Object.entries(ACTION_TARGET_STATUS)
      .filter(([, targetStatus]) => allowedStatuses.includes(targetStatus))
      .map(([action]) => action);
  }

  private async validateTransitionRules(
    contract: ContractWithRelations,
    action: string,
    _targetStatus: LifecycleStatus
  ): Promise<void> {
    switch (action) {
      case 'APPROVE':
        // Ensure all required approvals are in place (could check against approval workflow)
        break;
      case 'ACTIVATE':
        // Ensure all parties have signed
        // This is typically handled by the signing flow
        break;
      case 'TERMINATE':
        // Check for any termination restrictions
        if (contract.obligations.some((o) => o.status === 'IN_PROGRESS')) {
          this.log.warn(
            { contractId: contract.id },
            'Terminating contract with in-progress obligations'
          );
        }
        break;
    }
  }

  private getAdditionalUpdateData(action: string): Record<string, unknown> {
    const now = new Date();
    switch (action) {
      case 'TERMINATE':
        return { terminatedDate: now };
      case 'ACTIVATE':
      case 'COUNTERSIGN':
        return { signedDate: now };
      default:
        return {};
    }
  }
}

export function createContractLifecycleService(
  repository: LifecycleRepository
): ContractLifecycleService {
  return new ContractLifecycleService(repository);
}
