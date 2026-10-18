/**
 * Enforcement Matter Entity
 *
 * Aggregate root for IP enforcement tracking.
 * Handles cross-IP enforcement matters including infringement,
 * misappropriation, counterfeiting, and litigation.
 *
 * @module domain/entities
 */

import { PropsAggregateRoot, type DomainEvent } from './base.entity.js';

/**
 * Types of enforcement matters.
 */
export type EnforcementType =
  | 'infringement'
  | 'misappropriation'
  | 'counterfeiting'
  | 'cybersquatting'
  | 'unfair_competition'
  | 'breach_of_license'
  | 'other';

/**
 * Enforcement matter lifecycle status.
 */
export type EnforcementStatus =
  | 'monitoring'
  | 'investigation'
  | 'cease_and_desist'
  | 'negotiation'
  | 'litigation'
  | 'settled'
  | 'resolved'
  | 'abandoned';

/**
 * Priority levels for enforcement matters.
 */
export type EnforcementPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * IP asset types that can be enforced.
 */
export type IPAssetType = 'patent' | 'trademark' | 'copyright' | 'trade_secret';

/**
 * Reference to an IP asset.
 */
export interface IPAssetReference {
  type: IPAssetType;
  id: string;
  description: string;
}

/**
 * Types of enforcement actions.
 */
export type ActionType =
  | 'cease_and_desist'
  | 'dmca_takedown'
  | 'customs_recordation'
  | 'court_filing'
  | 'motion'
  | 'discovery'
  | 'settlement_offer'
  | 'judgment'
  | 'appeal'
  | 'monitoring_alert'
  | 'investigation'
  | 'negotiation'
  | 'other';

/**
 * Enforcement action status.
 */
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

/**
 * Enforcement action value object.
 */
export interface EnforcementAction {
  id: string;
  actionType: ActionType;
  status: ActionStatus;
  title: string;
  description?: string;
  scheduledDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  filingNumber?: string;
  courtName?: string;
  judgeName?: string;
  responseReceived: boolean;
  responseDate?: Date;
  responseSummary?: string;
  cost?: number;
  documents: Array<{ name: string; s3Key: string; uploadedAt: string }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Party roles in enforcement matters.
 */
export type PartyRole =
  | 'infringer'
  | 'defendant'
  | 'plaintiff'
  | 'respondent'
  | 'petitioner'
  | 'internal_counsel'
  | 'external_counsel'
  | 'investigator'
  | 'expert_witness';

/**
 * Party involved in an enforcement matter.
 */
export interface EnforcementParty {
  id: string;
  role: PartyRole;
  name: string;
  organization?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  barNumber?: string;
  firmName?: string;
  internalContactId?: string;
  notes?: string;
}

/**
 * Enforcement matter properties.
 */
export interface EnforcementMatterProps {
  id: string;
  matterNumber?: string;
  title: string;
  description?: string;
  type: EnforcementType;
  status: EnforcementStatus;
  priority: EnforcementPriority;
  ipAssetType: IPAssetType;
  ipAssetId: string;
  additionalAssets: IPAssetReference[];
  jurisdiction: string;
  venue?: string;
  caseNumber?: string;
  detectedDate: Date;
  openedDate?: Date;
  resolvedDate?: Date;
  estimatedDamages?: number;
  actualDamages?: number;
  settlementAmount?: number;
  estimatedCosts?: number;
  actualCosts?: number;
  outcome?: string;
  outcomeNotes?: string;
  assignedTo?: string;
  tags: string[];
  actions: EnforcementAction[];
  parties: EnforcementParty[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Create enforcement matter input.
 */
export interface CreateEnforcementMatterInput {
  title: string;
  description?: string;
  type: EnforcementType;
  priority?: EnforcementPriority;
  ipAssetType: IPAssetType;
  ipAssetId: string;
  jurisdiction: string;
  venue?: string;
  detectedDate: Date;
  estimatedDamages?: number;
  assignedTo?: string;
  tags?: string[];
}

/**
 * Status transition validation.
 */
const VALID_STATUS_TRANSITIONS: Record<EnforcementStatus, EnforcementStatus[]> = {
  monitoring: ['investigation', 'cease_and_desist', 'abandoned'],
  investigation: ['cease_and_desist', 'negotiation', 'litigation', 'abandoned'],
  cease_and_desist: ['negotiation', 'litigation', 'resolved', 'abandoned'],
  negotiation: ['litigation', 'settled', 'resolved', 'abandoned'],
  litigation: ['settled', 'resolved', 'abandoned'],
  settled: [], // Terminal state
  resolved: [], // Terminal state
  abandoned: [], // Terminal state
};

/**
 * Enforcement Matter Aggregate Root
 *
 * Manages IP enforcement matters across all IP asset types.
 */
export class EnforcementMatter extends PropsAggregateRoot<EnforcementMatterProps> {
  private constructor(props: EnforcementMatterProps) {
    super(props);
  }

  /**
   * Create a new enforcement matter.
   */
  static create(input: CreateEnforcementMatterInput): EnforcementMatter {
    const now = new Date();
    const id = crypto.randomUUID();

    const matter = new EnforcementMatter({
      id,
      title: input.title,
      description: input.description,
      type: input.type,
      status: 'monitoring',
      priority: input.priority ?? 'medium',
      ipAssetType: input.ipAssetType,
      ipAssetId: input.ipAssetId,
      additionalAssets: [],
      jurisdiction: input.jurisdiction,
      venue: input.venue,
      detectedDate: input.detectedDate,
      estimatedDamages: input.estimatedDamages,
      assignedTo: input.assignedTo,
      tags: input.tags ?? [],
      actions: [],
      parties: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    matter.addDomainEvent({
      type: 'EnforcementMatter.Opened',
      aggregateId: id,
      occurredAt: now,
      payload: {
        title: input.title,
        type: input.type,
        ipAssetType: input.ipAssetType,
        ipAssetId: input.ipAssetId,
        jurisdiction: input.jurisdiction,
        priority: matter.props.priority,
      },
    });

    return matter;
  }

  /**
   * Reconstitute from persistence.
   */
  static fromPersistence(props: EnforcementMatterProps): EnforcementMatter {
    return new EnforcementMatter(props);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string { return this.props.id; }
  get matterNumber(): string | undefined { return this.props.matterNumber; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get type(): EnforcementType { return this.props.type; }
  get status(): EnforcementStatus { return this.props.status; }
  get priority(): EnforcementPriority { return this.props.priority; }
  get ipAssetType(): IPAssetType { return this.props.ipAssetType; }
  get ipAssetId(): string { return this.props.ipAssetId; }
  get additionalAssets(): IPAssetReference[] { return [...this.props.additionalAssets]; }
  get jurisdiction(): string { return this.props.jurisdiction; }
  get venue(): string | undefined { return this.props.venue; }
  get caseNumber(): string | undefined { return this.props.caseNumber; }
  get detectedDate(): Date { return this.props.detectedDate; }
  get openedDate(): Date | undefined { return this.props.openedDate; }
  get resolvedDate(): Date | undefined { return this.props.resolvedDate; }
  get estimatedDamages(): number | undefined { return this.props.estimatedDamages; }
  get actualDamages(): number | undefined { return this.props.actualDamages; }
  get settlementAmount(): number | undefined { return this.props.settlementAmount; }
  get estimatedCosts(): number | undefined { return this.props.estimatedCosts; }
  get actualCosts(): number | undefined { return this.props.actualCosts; }
  get outcome(): string | undefined { return this.props.outcome; }
  get assignedTo(): string | undefined { return this.props.assignedTo; }
  get tags(): string[] { return [...this.props.tags]; }
  get actions(): EnforcementAction[] { return [...this.props.actions]; }
  get parties(): EnforcementParty[] { return [...this.props.parties]; }
  get isOpen(): boolean { return !['settled', 'resolved', 'abandoned'].includes(this.props.status); }
  get isInLitigation(): boolean { return this.props.status === 'litigation'; }

  // ============================================================================
  // Status Transitions
  // ============================================================================

  /**
   * Validate status transition.
   */
  private canTransitionTo(newStatus: EnforcementStatus): boolean {
    return VALID_STATUS_TRANSITIONS[this.props.status].includes(newStatus);
  }

  /**
   * Transition status with validation.
   */
  private transitionStatus(newStatus: EnforcementStatus, notes?: string): void {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.props.status} to ${newStatus}`
      );
    }

    const oldStatus = this.props.status;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();
    this.props.version++;

    this.addDomainEvent({
      type: 'EnforcementMatter.StatusChanged',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        oldStatus,
        newStatus,
        notes,
      },
    });
  }

  /**
   * Start investigation.
   */
  startInvestigation(assignedTo?: string): void {
    this.transitionStatus('investigation');
    if (assignedTo) {
      this.props.assignedTo = assignedTo;
    }
    this.props.openedDate = new Date();
  }

  /**
   * Send cease and desist.
   */
  sendCeaseAndDesist(): void {
    this.transitionStatus('cease_and_desist');
  }

  /**
   * Enter negotiations.
   */
  enterNegotiations(): void {
    this.transitionStatus('negotiation');
  }

  /**
   * File litigation.
   */
  fileLitigation(caseNumber: string, venue: string): void {
    this.transitionStatus('litigation');
    this.props.caseNumber = caseNumber;
    this.props.venue = venue;

    this.addDomainEvent({
      type: 'EnforcementMatter.LitigationFiled',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        caseNumber,
        venue,
        jurisdiction: this.props.jurisdiction,
        ipAssetType: this.props.ipAssetType,
        ipAssetId: this.props.ipAssetId,
      },
    });
  }

  /**
   * Settle the matter.
   */
  settle(settlementAmount: number, outcome: string, notes?: string): void {
    this.transitionStatus('settled', notes);
    this.props.settlementAmount = settlementAmount;
    this.props.outcome = outcome;
    this.props.outcomeNotes = notes;
    this.props.resolvedDate = new Date();

    this.addDomainEvent({
      type: 'EnforcementMatter.Settled',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        settlementAmount,
        outcome,
        totalCosts: this.props.actualCosts,
      },
    });
  }

  /**
   * Resolve the matter (without settlement).
   */
  resolve(outcome: string, notes?: string): void {
    this.transitionStatus('resolved', notes);
    this.props.outcome = outcome;
    this.props.outcomeNotes = notes;
    this.props.resolvedDate = new Date();

    this.addDomainEvent({
      type: 'EnforcementMatter.Resolved',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        outcome,
        actualDamages: this.props.actualDamages,
        totalCosts: this.props.actualCosts,
      },
    });
  }

  /**
   * Abandon the matter.
   */
  abandon(reason: string): void {
    this.transitionStatus('abandoned', reason);
    this.props.outcome = 'abandoned';
    this.props.outcomeNotes = reason;
    this.props.resolvedDate = new Date();
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Add an enforcement action.
   */
  addAction(action: Omit<EnforcementAction, 'id' | 'createdAt' | 'updatedAt' | 'responseReceived' | 'documents'>): EnforcementAction {
    const now = new Date();
    const newAction: EnforcementAction = {
      ...action,
      id: crypto.randomUUID(),
      responseReceived: false,
      documents: [],
      createdAt: now,
      updatedAt: now,
    };

    this.props.actions.push(newAction);
    this.props.updatedAt = now;
    this.props.version++;

    this.addDomainEvent({
      type: 'EnforcementMatter.ActionAdded',
      aggregateId: this.props.id,
      occurredAt: now,
      payload: {
        actionId: newAction.id,
        actionType: newAction.actionType,
        title: newAction.title,
        dueDate: newAction.dueDate?.toISOString(),
      },
    });

    return newAction;
  }

  /**
   * Update action status.
   */
  updateActionStatus(actionId: string, status: ActionStatus, completedDate?: Date): void {
    const action = this.props.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    action.status = status;
    action.updatedAt = new Date();
    if (status === 'completed' && completedDate) {
      action.completedDate = completedDate;
    }

    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Record response to an action.
   */
  recordActionResponse(actionId: string, responseDate: Date, summary: string): void {
    const action = this.props.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    action.responseReceived = true;
    action.responseDate = responseDate;
    action.responseSummary = summary;
    action.updatedAt = new Date();

    this.props.updatedAt = new Date();
    this.props.version++;

    this.addDomainEvent({
      type: 'EnforcementMatter.ResponseReceived',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        actionId,
        actionType: action.actionType,
        responseDate: responseDate.toISOString(),
      },
    });
  }

  /**
   * Add document to an action.
   */
  addDocumentToAction(actionId: string, name: string, s3Key: string): void {
    const action = this.props.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    action.documents.push({
      name,
      s3Key,
      uploadedAt: new Date().toISOString(),
    });
    action.updatedAt = new Date();

    this.props.updatedAt = new Date();
    this.props.version++;
  }

  // ============================================================================
  // Parties
  // ============================================================================

  /**
   * Add a party to the matter.
   */
  addParty(party: Omit<EnforcementParty, 'id'>): EnforcementParty {
    const newParty: EnforcementParty = {
      ...party,
      id: crypto.randomUUID(),
    };

    this.props.parties.push(newParty);
    this.props.updatedAt = new Date();
    this.props.version++;

    this.addDomainEvent({
      type: 'EnforcementMatter.PartyAdded',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        partyId: newParty.id,
        role: newParty.role,
        name: newParty.name,
      },
    });

    return newParty;
  }

  /**
   * Remove a party from the matter.
   */
  removeParty(partyId: string): void {
    const index = this.props.parties.findIndex(p => p.id === partyId);
    if (index === -1) {
      throw new Error(`Party ${partyId} not found`);
    }

    this.props.parties.splice(index, 1);
    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Get parties by role.
   */
  getPartiesByRole(role: PartyRole): EnforcementParty[] {
    return this.props.parties.filter(p => p.role === role);
  }

  // ============================================================================
  // Additional Assets
  // ============================================================================

  /**
   * Add an additional IP asset to this matter.
   */
  addAdditionalAsset(asset: IPAssetReference): void {
    // Check for duplicates
    const exists = this.props.additionalAssets.some(
      a => a.type === asset.type && a.id === asset.id
    );
    if (exists) {
      return;
    }

    this.props.additionalAssets.push(asset);
    this.props.updatedAt = new Date();
    this.props.version++;

    this.addDomainEvent({
      type: 'EnforcementMatter.AssetLinked',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        assetType: asset.type,
        assetId: asset.id,
      },
    });
  }

  // ============================================================================
  // Financial Updates
  // ============================================================================

  /**
   * Update financial estimates.
   */
  updateFinancials(updates: {
    estimatedDamages?: number;
    actualDamages?: number;
    estimatedCosts?: number;
    actualCosts?: number;
  }): void {
    if (updates.estimatedDamages !== undefined) {
      this.props.estimatedDamages = updates.estimatedDamages;
    }
    if (updates.actualDamages !== undefined) {
      this.props.actualDamages = updates.actualDamages;
    }
    if (updates.estimatedCosts !== undefined) {
      this.props.estimatedCosts = updates.estimatedCosts;
    }
    if (updates.actualCosts !== undefined) {
      this.props.actualCosts = updates.actualCosts;
    }

    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Add cost from an action.
   */
  recordActionCost(actionId: string, cost: number): void {
    const action = this.props.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    action.cost = cost;
    action.updatedAt = new Date();

    // Update total actual costs
    this.props.actualCosts = (this.props.actualCosts ?? 0) + cost;
    this.props.updatedAt = new Date();
    this.props.version++;
  }

  // ============================================================================
  // Priority and Assignment
  // ============================================================================

  /**
   * Update priority.
   */
  setPriority(priority: EnforcementPriority): void {
    if (this.props.priority === priority) return;

    const oldPriority = this.props.priority;
    this.props.priority = priority;
    this.props.updatedAt = new Date();
    this.props.version++;

    if (priority === 'critical') {
      this.addDomainEvent({
        type: 'EnforcementMatter.EscalatedToCritical',
        aggregateId: this.props.id,
        occurredAt: new Date(),
        payload: {
          oldPriority,
          reason: 'Manual escalation',
        },
      });
    }
  }

  /**
   * Assign to a user.
   */
  assignTo(userId: string): void {
    this.props.assignedTo = userId;
    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Add a tag.
   */
  addTag(tag: string): void {
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
      this.props.updatedAt = new Date();
      this.props.version++;
    }
  }

  /**
   * Remove a tag.
   */
  removeTag(tag: string): void {
    const index = this.props.tags.indexOf(tag);
    if (index !== -1) {
      this.props.tags.splice(index, 1);
      this.props.updatedAt = new Date();
      this.props.version++;
    }
  }

  /**
   * Update general information.
   */
  update(updates: {
    title?: string;
    description?: string;
    venue?: string;
    matterNumber?: string;
  }): void {
    if (updates.title !== undefined) this.props.title = updates.title;
    if (updates.description !== undefined) this.props.description = updates.description;
    if (updates.venue !== undefined) this.props.venue = updates.venue;
    if (updates.matterNumber !== undefined) this.props.matterNumber = updates.matterNumber;

    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Convert to persistence format.
   */
  toPersistence(): EnforcementMatterProps {
    return { ...this.props };
  }
}
