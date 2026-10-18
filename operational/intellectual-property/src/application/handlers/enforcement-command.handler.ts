/**
 * Enforcement Command Handler
 *
 * CQRS command handler for enforcement matter operations.
 *
 * @module application/handlers
 */

import type { EnforcementRepository } from '../../infrastructure/persistence/enforcement.repository.js';
import {
  EnforcementMatter,
  type EnforcementAction,
  type EnforcementParty,
} from '../../domain/entities/enforcement-matter.entity.js';
import type {
  CreateEnforcementMatterCommand,
  UpdateEnforcementMatterCommand,
  StartInvestigationCommand,
  SendCeaseAndDesistCommand,
  EnterNegotiationsCommand,
  FileLitigationCommand,
  SettleMatterCommand,
  ResolveMatterCommand,
  AbandonMatterCommand,
  AddEnforcementActionCommand,
  UpdateActionStatusCommand,
  RecordActionResponseCommand,
  AddEnforcementPartyCommand,
  RemoveEnforcementPartyCommand,
  LinkAssetToMatterCommand,
  UpdateMatterPriorityCommand,
  UpdateMatterFinancialsCommand,
  DeleteEnforcementMatterCommand,
} from '../commands/enforcement.commands.js';
import { enforcementEventHandler } from './enforcement-event.handler.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export class EnforcementCommandHandler {
  constructor(
    private readonly repository: EnforcementRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  /**
   * Create a new enforcement matter.
   */
  async createMatter(command: CreateEnforcementMatterCommand): Promise<EnforcementMatter> {
    const matter = EnforcementMatter.create({
      title: command.title,
      description: command.description,
      type: command.enforcementType,
      priority: command.priority,
      ipAssetType: command.ipAssetType,
      ipAssetId: command.ipAssetId,
      jurisdiction: command.jurisdiction,
      venue: command.venue,
      detectedDate: command.detectedDate,
      estimatedDamages: command.estimatedDamages,
      assignedTo: command.assignedTo,
      tags: command.tags,
    });

    await this.repository.save(matter);

    await enforcementEventHandler.handleMatterCreated({
      matterId: matter.id,
      title: matter.title,
      type: matter.type,
      status: matter.status,
      priority: matter.priority,
      ipAssetType: matter.ipAssetType,
      ipAssetId: matter.ipAssetId,
      jurisdiction: matter.jurisdiction,
    }, { userId: command.actorId });

    return matter;
  }

  /**
   * Update matter details.
   */
  async updateMatter(command: UpdateEnforcementMatterCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.update({
      title: command.title,
      description: command.description,
      venue: command.venue,
      matterNumber: command.matterNumber,
    });

    await this.repository.save(matter);

    return matter;
  }

  /**
   * Start investigation.
   */
  async startInvestigation(command: StartInvestigationCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.startInvestigation(command.assignedTo);
    await this.repository.save(matter);

    await enforcementEventHandler.handleStatusChanged(
      matter.id,
      'monitoring',
      'investigation',
      undefined,
      { userId: command.actorId }
    );

    return matter;
  }

  /**
   * Send cease and desist.
   */
  async sendCeaseAndDesist(command: SendCeaseAndDesistCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.sendCeaseAndDesist();

    // Add the C&D action
    matter.addAction({
      actionType: 'cease_and_desist',
      status: 'completed',
      title: `Cease and Desist to ${command.recipientName}`,
      description: `Claims: ${command.claims.join(', ')}`,
      dueDate: command.responseDeadline,
      completedDate: new Date(),
    });

    await this.repository.save(matter);

    await enforcementEventHandler.handleCeaseAndDesistSent(
      matter.id,
      command.recipientName,
      new Date(),
      command.responseDeadline,
      command.claims,
      { userId: command.actorId }
    );

    return matter;
  }

  /**
   * Enter negotiations.
   */
  async enterNegotiations(command: EnterNegotiationsCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.enterNegotiations();
    await this.repository.save(matter);

    return matter;
  }

  /**
   * File litigation.
   */
  async fileLitigation(command: FileLitigationCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.fileLitigation(command.caseNumber, command.venue);

    // Add court filing action
    matter.addAction({
      actionType: 'court_filing',
      status: 'completed',
      title: `Initial Filing - ${command.court}`,
      description: `Case: ${command.caseNumber}. Claims: ${command.claims.join(', ')}`,
      scheduledDate: command.filingDate,
      completedDate: command.filingDate,
      courtName: command.court,
      filingNumber: command.caseNumber,
    });

    await this.repository.save(matter);

    await enforcementEventHandler.handleLitigationFiled(
      matter.id,
      command.court,
      command.caseNumber,
      command.filingDate,
      command.claims,
      [],
      { userId: command.actorId }
    );

    return matter;
  }

  /**
   * Settle a matter.
   */
  async settleMatter(command: SettleMatterCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.settle(command.settlementAmount, command.outcome, command.notes);
    await this.repository.save(matter);

    await enforcementEventHandler.handleSettlementReached({
      matterId: matter.id,
      settlementDate: new Date(),
      terms: command.terms ?? command.outcome,
      amount: command.settlementAmount,
    }, { userId: command.actorId });

    return matter;
  }

  /**
   * Resolve a matter.
   */
  async resolveMatter(command: ResolveMatterCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.resolve(command.outcome, command.notes);
    await this.repository.save(matter);

    return matter;
  }

  /**
   * Abandon a matter.
   */
  async abandonMatter(command: AbandonMatterCommand): Promise<EnforcementMatter> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.abandon(command.reason);
    await this.repository.save(matter);

    await enforcementEventHandler.handleMatterClosed(
      matter.id,
      new Date(),
      'abandoned',
      undefined,
      command.reason,
      { userId: command.actorId }
    );

    return matter;
  }

  /**
   * Add an action.
   */
  async addAction(command: AddEnforcementActionCommand): Promise<EnforcementAction> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    const action = matter.addAction({
      actionType: command.actionType,
      status: 'pending',
      title: command.title,
      description: command.description,
      scheduledDate: command.scheduledDate,
      dueDate: command.dueDate,
    });

    await this.repository.save(matter);

    await enforcementEventHandler.handleActionTaken({
      actionId: action.id,
      matterId: matter.id,
      actionType: command.actionType,
      description: command.title,
      actionDate: new Date(),
      deadline: command.dueDate,
    }, { userId: command.actorId });

    return action;
  }

  /**
   * Update action status.
   */
  async updateActionStatus(command: UpdateActionStatusCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.updateActionStatus(command.actionId, command.status, command.completedDate);
    await this.repository.save(matter);
  }

  /**
   * Record response to action.
   */
  async recordActionResponse(command: RecordActionResponseCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.recordActionResponse(command.actionId, command.responseDate, command.summary);
    await this.repository.save(matter);
  }

  /**
   * Add a party.
   */
  async addParty(command: AddEnforcementPartyCommand): Promise<EnforcementParty> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    const party = matter.addParty({
      role: command.role,
      name: command.name,
      organization: command.organization,
      contactEmail: command.contactEmail,
      contactPhone: command.contactPhone,
      address: command.address,
      barNumber: command.barNumber,
      firmName: command.firmName,
      notes: command.notes,
    });

    await this.repository.save(matter);

    return party;
  }

  /**
   * Remove a party.
   */
  async removeParty(command: RemoveEnforcementPartyCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.removeParty(command.partyId);
    await this.repository.save(matter);
  }

  /**
   * Link an asset to the matter.
   */
  async linkAsset(command: LinkAssetToMatterCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.addAdditionalAsset(command.asset);
    await this.repository.save(matter);
  }

  /**
   * Update priority.
   */
  async updatePriority(command: UpdateMatterPriorityCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.setPriority(command.priority);
    await this.repository.save(matter);
  }

  /**
   * Update financials.
   */
  async updateFinancials(command: UpdateMatterFinancialsCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    matter.updateFinancials({
      estimatedDamages: command.estimatedDamages,
      actualDamages: command.actualDamages,
      estimatedCosts: command.estimatedCosts,
      actualCosts: command.actualCosts,
    });

    await this.repository.save(matter);
  }

  /**
   * Delete a matter.
   */
  async deleteMatter(command: DeleteEnforcementMatterCommand): Promise<void> {
    const matter = await this.repository.findById(command.matterId);
    if (!matter) {
      throw new Error(`Enforcement matter not found: ${command.matterId}`);
    }

    await this.repository.delete(command.matterId);
  }
}
