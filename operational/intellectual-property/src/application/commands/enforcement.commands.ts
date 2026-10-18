/**
 * Enforcement Commands
 *
 * CQRS commands for enforcement matter operations.
 *
 * @module application/commands
 */

import type {
  EnforcementType,
  EnforcementPriority,
  IPAssetType,
  ActionType,
  ActionStatus,
  PartyRole,
  IPAssetReference,
} from '../../domain/entities/enforcement-matter.entity.js';

/**
 * Create a new enforcement matter.
 */
export interface CreateEnforcementMatterCommand {
  type: 'CreateEnforcementMatter';
  title: string;
  description?: string;
  enforcementType: EnforcementType;
  priority?: EnforcementPriority;
  ipAssetType: IPAssetType;
  ipAssetId: string;
  jurisdiction: string;
  venue?: string;
  detectedDate: Date;
  estimatedDamages?: number;
  assignedTo?: string;
  tags?: string[];
  actorId: string;
}

/**
 * Update enforcement matter details.
 */
export interface UpdateEnforcementMatterCommand {
  type: 'UpdateEnforcementMatter';
  matterId: string;
  title?: string;
  description?: string;
  venue?: string;
  matterNumber?: string;
  actorId: string;
}

/**
 * Start investigation on a matter.
 */
export interface StartInvestigationCommand {
  type: 'StartInvestigation';
  matterId: string;
  assignedTo?: string;
  actorId: string;
}

/**
 * Send cease and desist.
 */
export interface SendCeaseAndDesistCommand {
  type: 'SendCeaseAndDesist';
  matterId: string;
  recipientName: string;
  responseDeadline: Date;
  claims: string[];
  actorId: string;
}

/**
 * Enter negotiations.
 */
export interface EnterNegotiationsCommand {
  type: 'EnterNegotiations';
  matterId: string;
  notes?: string;
  actorId: string;
}

/**
 * File litigation.
 */
export interface FileLitigationCommand {
  type: 'FileLitigation';
  matterId: string;
  caseNumber: string;
  venue: string;
  court: string;
  filingDate: Date;
  claims: string[];
  actorId: string;
}

/**
 * Settle a matter.
 */
export interface SettleMatterCommand {
  type: 'SettleMatter';
  matterId: string;
  settlementAmount: number;
  outcome: string;
  terms?: string;
  notes?: string;
  actorId: string;
}

/**
 * Resolve a matter (without settlement).
 */
export interface ResolveMatterCommand {
  type: 'ResolveMatter';
  matterId: string;
  outcome: string;
  notes?: string;
  actorId: string;
}

/**
 * Abandon a matter.
 */
export interface AbandonMatterCommand {
  type: 'AbandonMatter';
  matterId: string;
  reason: string;
  actorId: string;
}

/**
 * Add an action to a matter.
 */
export interface AddEnforcementActionCommand {
  type: 'AddEnforcementAction';
  matterId: string;
  actionType: ActionType;
  title: string;
  description?: string;
  scheduledDate?: Date;
  dueDate?: Date;
  actorId: string;
}

/**
 * Update action status.
 */
export interface UpdateActionStatusCommand {
  type: 'UpdateActionStatus';
  matterId: string;
  actionId: string;
  status: ActionStatus;
  completedDate?: Date;
  actorId: string;
}

/**
 * Record response to an action.
 */
export interface RecordActionResponseCommand {
  type: 'RecordActionResponse';
  matterId: string;
  actionId: string;
  responseDate: Date;
  summary: string;
  actorId: string;
}

/**
 * Add a party to a matter.
 */
export interface AddEnforcementPartyCommand {
  type: 'AddEnforcementParty';
  matterId: string;
  role: PartyRole;
  name: string;
  organization?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  barNumber?: string;
  firmName?: string;
  notes?: string;
  actorId: string;
}

/**
 * Remove a party from a matter.
 */
export interface RemoveEnforcementPartyCommand {
  type: 'RemoveEnforcementParty';
  matterId: string;
  partyId: string;
  actorId: string;
}

/**
 * Link additional IP asset to matter.
 */
export interface LinkAssetToMatterCommand {
  type: 'LinkAssetToMatter';
  matterId: string;
  asset: IPAssetReference;
  actorId: string;
}

/**
 * Update matter priority.
 */
export interface UpdateMatterPriorityCommand {
  type: 'UpdateMatterPriority';
  matterId: string;
  priority: EnforcementPriority;
  actorId: string;
}

/**
 * Update matter financials.
 */
export interface UpdateMatterFinancialsCommand {
  type: 'UpdateMatterFinancials';
  matterId: string;
  estimatedDamages?: number;
  actualDamages?: number;
  estimatedCosts?: number;
  actualCosts?: number;
  actorId: string;
}

/**
 * Delete an enforcement matter.
 */
export interface DeleteEnforcementMatterCommand {
  type: 'DeleteEnforcementMatter';
  matterId: string;
  actorId: string;
}

/**
 * Union type of all enforcement commands.
 */
export type EnforcementCommand =
  | CreateEnforcementMatterCommand
  | UpdateEnforcementMatterCommand
  | StartInvestigationCommand
  | SendCeaseAndDesistCommand
  | EnterNegotiationsCommand
  | FileLitigationCommand
  | SettleMatterCommand
  | ResolveMatterCommand
  | AbandonMatterCommand
  | AddEnforcementActionCommand
  | UpdateActionStatusCommand
  | RecordActionResponseCommand
  | AddEnforcementPartyCommand
  | RemoveEnforcementPartyCommand
  | LinkAssetToMatterCommand
  | UpdateMatterPriorityCommand
  | UpdateMatterFinancialsCommand
  | DeleteEnforcementMatterCommand;
