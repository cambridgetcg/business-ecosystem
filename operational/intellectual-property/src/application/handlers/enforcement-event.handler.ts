/**
 * Enforcement Event Handler
 *
 * Handles enforcement-related domain events and integrates with AWS infrastructure.
 * Manages matter creation, action tracking, litigation events, and settlements.
 *
 * @module application/handlers
 */

import { eventOrchestratorService, type EventContext } from '../services/event-orchestrator.service.js';

/**
 * Enforcement event types.
 */
export type EnforcementEventType =
  | 'Enforcement.MatterCreated'
  | 'Enforcement.MatterUpdated'
  | 'Enforcement.ActionTaken'
  | 'Enforcement.PartyAdded'
  | 'Enforcement.StatusChanged'
  | 'Enforcement.CeaseAndDesistSent'
  | 'Enforcement.DMCATakedownFiled'
  | 'Enforcement.LitigationFiled'
  | 'Enforcement.MotionFiled'
  | 'Enforcement.SettlementReached'
  | 'Enforcement.JudgmentEntered'
  | 'Enforcement.MatterClosed';

/**
 * Enforcement matter payload.
 */
export interface EnforcementMatterPayload {
  matterId: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  ipAssetType: string;
  ipAssetId: string;
  jurisdiction: string;
  venue?: string;
  filingDate?: Date;
  estimatedValue?: number;
  description?: string;
}

/**
 * Enforcement action payload.
 */
export interface EnforcementActionPayload {
  actionId: string;
  matterId: string;
  actionType: string;
  description: string;
  actionDate: Date;
  deadline?: Date;
  assignedTo?: string;
  cost?: number;
  outcome?: string;
}

/**
 * Settlement payload.
 */
export interface SettlementPayload {
  matterId: string;
  settlementDate: Date;
  terms: string;
  amount?: number;
  currency?: string;
  licensingTerms?: string;
  injunctiveRelief?: boolean;
}

/**
 * Enforcement Event Handler
 *
 * Processes enforcement domain events through the orchestration pipeline.
 */
export class EnforcementEventHandler {
  /**
   * Handle matter created event.
   */
  async handleMatterCreated(
    matter: EnforcementMatterPayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.MatterCreated',
      'EnforcementMatter',
      matter.matterId,
      {
        title: matter.title,
        type: matter.type,
        status: matter.status,
        priority: matter.priority,
        ipAssetType: matter.ipAssetType,
        ipAssetId: matter.ipAssetId,
        jurisdiction: matter.jurisdiction,
        venue: matter.venue,
        estimatedValue: matter.estimatedValue,
      },
      context
    );
  }

  /**
   * Handle matter status changed event.
   */
  async handleStatusChanged(
    matterId: string,
    previousStatus: string,
    newStatus: string,
    reason?: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.StatusChanged',
      'EnforcementMatter',
      matterId,
      {
        previousStatus,
        newStatus,
        reason,
        changedAt: new Date().toISOString(),
      },
      context
    );
  }

  /**
   * Handle enforcement action taken.
   */
  async handleActionTaken(
    action: EnforcementActionPayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.ActionTaken',
      'EnforcementMatter',
      action.matterId,
      {
        actionId: action.actionId,
        actionType: action.actionType,
        description: action.description,
        actionDate: action.actionDate.toISOString(),
        deadline: action.deadline?.toISOString(),
        assignedTo: action.assignedTo,
        cost: action.cost,
        outcome: action.outcome,
      },
      context
    );
  }

  /**
   * Handle cease and desist sent.
   */
  async handleCeaseAndDesistSent(
    matterId: string,
    recipientName: string,
    sentDate: Date,
    responseDeadline: Date,
    claims: string[],
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.CeaseAndDesistSent',
      'EnforcementMatter',
      matterId,
      {
        recipientName,
        sentDate: sentDate.toISOString(),
        responseDeadline: responseDeadline.toISOString(),
        claims,
        daysToRespond: Math.ceil((responseDeadline.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      context
    );
  }

  /**
   * Handle DMCA takedown filed.
   */
  async handleDMCATakedownFiled(
    matterId: string,
    platform: string,
    contentUrl: string,
    filedDate: Date,
    copyrightId: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.DMCATakedownFiled',
      'EnforcementMatter',
      matterId,
      {
        platform,
        contentUrl,
        filedDate: filedDate.toISOString(),
        copyrightId,
      },
      context
    );
  }

  /**
   * Handle litigation filed.
   */
  async handleLitigationFiled(
    matterId: string,
    court: string,
    caseNumber: string,
    filedDate: Date,
    claims: string[],
    defendants: string[],
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.LitigationFiled',
      'EnforcementMatter',
      matterId,
      {
        court,
        caseNumber,
        filedDate: filedDate.toISOString(),
        claims,
        defendants,
      },
      context
    );
  }

  /**
   * Handle settlement reached.
   */
  async handleSettlementReached(
    settlement: SettlementPayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.SettlementReached',
      'EnforcementMatter',
      settlement.matterId,
      {
        settlementDate: settlement.settlementDate.toISOString(),
        terms: settlement.terms,
        amount: settlement.amount,
        currency: settlement.currency,
        licensingTerms: settlement.licensingTerms,
        injunctiveRelief: settlement.injunctiveRelief,
      },
      context
    );
  }

  /**
   * Handle judgment entered.
   */
  async handleJudgmentEntered(
    matterId: string,
    judgmentDate: Date,
    outcome: 'favorable' | 'unfavorable' | 'partial' | 'dismissed',
    damages?: number,
    injunction?: boolean,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.JudgmentEntered',
      'EnforcementMatter',
      matterId,
      {
        judgmentDate: judgmentDate.toISOString(),
        outcome,
        damages,
        injunction,
      },
      context
    );
  }

  /**
   * Handle matter closed.
   */
  async handleMatterClosed(
    matterId: string,
    closedDate: Date,
    resolution: string,
    totalCost?: number,
    lessonsLearned?: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Enforcement.MatterClosed',
      'EnforcementMatter',
      matterId,
      {
        closedDate: closedDate.toISOString(),
        resolution,
        totalCost,
        lessonsLearned,
      },
      context
    );
  }
}

// Singleton instance
export const enforcementEventHandler = new EnforcementEventHandler();
