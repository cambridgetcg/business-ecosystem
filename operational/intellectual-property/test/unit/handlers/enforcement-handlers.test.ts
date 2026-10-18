/**
 * Enforcement Handlers Unit Tests
 *
 * Tests for CQRS command and query handlers for enforcement matters.
 * Uses mock objects to test handler logic independently of entity implementation.
 *
 * @module test/unit/handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  EnforcementStatus,
  EnforcementPriority,
  EnforcementType,
  IPAssetType,
  EnforcementAction,
  EnforcementParty,
  EnforcementMatterProps,
} from '../../../src/domain/entities/enforcement-matter.entity.js';
import type { EnforcementRepository, EnforcementSearchFilters } from '../../../src/infrastructure/persistence/enforcement.repository.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the event handler - must be defined inline in vi.mock
vi.mock('../../../src/application/handlers/enforcement-event.handler.js', () => ({
  enforcementEventHandler: {
    handleMatterCreated: vi.fn().mockResolvedValue(undefined),
    handleStatusChanged: vi.fn().mockResolvedValue(undefined),
    handleCeaseAndDesistSent: vi.fn().mockResolvedValue(undefined),
    handleLitigationFiled: vi.fn().mockResolvedValue(undefined),
    handleSettlementReached: vi.fn().mockResolvedValue(undefined),
    handleActionTaken: vi.fn().mockResolvedValue(undefined),
    handleMatterClosed: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import the mock after vi.mock to access it
import { enforcementEventHandler as mockEventHandler } from '../../../src/application/handlers/enforcement-event.handler.js';

// Create a mock matter factory that produces proper mock objects
const createMockMatterObject = (overrides?: Partial<EnforcementMatterProps>) => {
  const now = new Date();
  const id = crypto.randomUUID();

  const state: EnforcementMatterProps = {
    id,
    title: 'Test Patent Infringement',
    description: 'Test description',
    type: 'infringement' as EnforcementType,
    status: 'monitoring' as EnforcementStatus,
    priority: 'high' as EnforcementPriority,
    ipAssetType: 'patent' as IPAssetType,
    ipAssetId: 'patent-123',
    additionalAssets: [],
    jurisdiction: 'US',
    venue: 'Northern District of California',
    detectedDate: new Date('2024-01-15'),
    estimatedDamages: 500000,
    assignedTo: 'user-1',
    tags: ['urgent', 'tech'],
    actions: [],
    parties: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };

  // Create a mock object that behaves like EnforcementMatter
  return {
    // Getters - return values from state
    get id() { return state.id; },
    get matterNumber() { return state.matterNumber; },
    get title() { return state.title; },
    get description() { return state.description; },
    get type() { return state.type; },
    get status() { return state.status; },
    get priority() { return state.priority; },
    get ipAssetType() { return state.ipAssetType; },
    get ipAssetId() { return state.ipAssetId; },
    get additionalAssets() { return [...state.additionalAssets]; },
    get jurisdiction() { return state.jurisdiction; },
    get venue() { return state.venue; },
    get caseNumber() { return state.caseNumber; },
    get detectedDate() { return state.detectedDate; },
    get openedDate() { return state.openedDate; },
    get resolvedDate() { return state.resolvedDate; },
    get estimatedDamages() { return state.estimatedDamages; },
    get actualDamages() { return state.actualDamages; },
    get settlementAmount() { return state.settlementAmount; },
    get estimatedCosts() { return state.estimatedCosts; },
    get actualCosts() { return state.actualCosts; },
    get outcome() { return state.outcome; },
    get assignedTo() { return state.assignedTo; },
    get tags() { return [...state.tags]; },
    get actions() { return [...state.actions]; },
    get parties() { return [...state.parties]; },
    get isOpen() { return !['settled', 'resolved', 'abandoned'].includes(state.status); },
    get isInLitigation() { return state.status === 'litigation'; },

    // Methods that modify state
    startInvestigation(assignedTo?: string) {
      state.status = 'investigation';
      if (assignedTo) state.assignedTo = assignedTo;
      state.openedDate = new Date();
      state.version++;
    },

    sendCeaseAndDesist() {
      state.status = 'cease_and_desist';
      state.version++;
    },

    enterNegotiations() {
      state.status = 'negotiation';
      state.version++;
    },

    fileLitigation(caseNumber: string, venue: string) {
      state.status = 'litigation';
      state.caseNumber = caseNumber;
      state.venue = venue;
      state.version++;
    },

    settle(settlementAmount: number, outcome: string, notes?: string) {
      state.status = 'settled';
      state.settlementAmount = settlementAmount;
      state.outcome = outcome;
      state.outcomeNotes = notes;
      state.resolvedDate = new Date();
      state.version++;
    },

    resolve(outcome: string, notes?: string) {
      state.status = 'resolved';
      state.outcome = outcome;
      state.outcomeNotes = notes;
      state.resolvedDate = new Date();
      state.version++;
    },

    abandon(reason: string) {
      state.status = 'abandoned';
      state.outcome = 'abandoned';
      state.outcomeNotes = reason;
      state.resolvedDate = new Date();
      state.version++;
    },

    addAction(action: Partial<EnforcementAction>): EnforcementAction {
      const newAction: EnforcementAction = {
        id: crypto.randomUUID(),
        actionType: action.actionType ?? 'other',
        status: action.status ?? 'pending',
        title: action.title ?? '',
        description: action.description,
        scheduledDate: action.scheduledDate,
        dueDate: action.dueDate,
        completedDate: action.completedDate,
        filingNumber: action.filingNumber,
        courtName: action.courtName,
        judgeName: action.judgeName,
        responseReceived: false,
        documents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.actions.push(newAction);
      state.version++;
      return newAction;
    },

    updateActionStatus(actionId: string, status: string, completedDate?: Date) {
      const action = state.actions.find(a => a.id === actionId);
      if (!action) throw new Error(`Action ${actionId} not found`);
      action.status = status as any;
      if (completedDate) action.completedDate = completedDate;
      action.updatedAt = new Date();
      state.version++;
    },

    recordActionResponse(actionId: string, responseDate: Date, summary: string) {
      const action = state.actions.find(a => a.id === actionId);
      if (!action) throw new Error(`Action ${actionId} not found`);
      action.responseReceived = true;
      action.responseDate = responseDate;
      action.responseSummary = summary;
      action.updatedAt = new Date();
      state.version++;
    },

    addParty(party: Partial<EnforcementParty>): EnforcementParty {
      const newParty: EnforcementParty = {
        id: crypto.randomUUID(),
        role: party.role ?? 'infringer',
        name: party.name ?? '',
        organization: party.organization,
        contactEmail: party.contactEmail,
        contactPhone: party.contactPhone,
        address: party.address,
        barNumber: party.barNumber,
        firmName: party.firmName,
        notes: party.notes,
      };
      state.parties.push(newParty);
      state.version++;
      return newParty;
    },

    removeParty(partyId: string) {
      const index = state.parties.findIndex(p => p.id === partyId);
      if (index === -1) throw new Error(`Party ${partyId} not found`);
      state.parties.splice(index, 1);
      state.version++;
    },

    addAdditionalAsset(asset: { type: IPAssetType; id: string; description: string }) {
      state.additionalAssets.push(asset);
      state.version++;
    },

    updateFinancials(updates: Partial<Pick<EnforcementMatterProps, 'estimatedDamages' | 'actualDamages' | 'estimatedCosts' | 'actualCosts'>>) {
      if (updates.estimatedDamages !== undefined) state.estimatedDamages = updates.estimatedDamages;
      if (updates.actualDamages !== undefined) state.actualDamages = updates.actualDamages;
      if (updates.estimatedCosts !== undefined) state.estimatedCosts = updates.estimatedCosts;
      if (updates.actualCosts !== undefined) state.actualCosts = updates.actualCosts;
      state.version++;
    },

    setPriority(priority: EnforcementPriority) {
      state.priority = priority;
      state.version++;
    },

    update(updates: Partial<Pick<EnforcementMatterProps, 'title' | 'description' | 'venue' | 'matterNumber'>>) {
      if (updates.title !== undefined) state.title = updates.title;
      if (updates.description !== undefined) state.description = updates.description;
      if (updates.venue !== undefined) state.venue = updates.venue;
      if (updates.matterNumber !== undefined) state.matterNumber = updates.matterNumber;
      state.version++;
    },

    toPersistence() {
      return { ...state };
    },
  };
};

// Mock the EnforcementMatter class - inline factory since it's hoisted
vi.mock('../../../src/domain/entities/enforcement-matter.entity.js', async () => {
  // Define the mock factory inside the mock function
  const createMockMatter = (overrides?: any) => {
    const now = new Date();
    const id = crypto.randomUUID();

    const state = {
      id,
      title: 'Test Patent Infringement',
      description: 'Test description',
      type: 'infringement',
      status: 'monitoring',
      priority: 'high',
      ipAssetType: 'patent',
      ipAssetId: 'patent-123',
      additionalAssets: [],
      jurisdiction: 'US',
      venue: 'Northern District of California',
      detectedDate: new Date('2024-01-15'),
      estimatedDamages: 500000,
      assignedTo: 'user-1',
      tags: ['urgent', 'tech'],
      actions: [] as any[],
      parties: [] as any[],
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...overrides,
    };

    return {
      get id() { return state.id; },
      get matterNumber() { return state.matterNumber; },
      get title() { return state.title; },
      get description() { return state.description; },
      get type() { return state.type; },
      get status() { return state.status; },
      get priority() { return state.priority; },
      get ipAssetType() { return state.ipAssetType; },
      get ipAssetId() { return state.ipAssetId; },
      get additionalAssets() { return [...state.additionalAssets]; },
      get jurisdiction() { return state.jurisdiction; },
      get venue() { return state.venue; },
      get caseNumber() { return state.caseNumber; },
      get detectedDate() { return state.detectedDate; },
      get openedDate() { return state.openedDate; },
      get resolvedDate() { return state.resolvedDate; },
      get estimatedDamages() { return state.estimatedDamages; },
      get actualDamages() { return state.actualDamages; },
      get settlementAmount() { return state.settlementAmount; },
      get estimatedCosts() { return state.estimatedCosts; },
      get actualCosts() { return state.actualCosts; },
      get outcome() { return state.outcome; },
      get assignedTo() { return state.assignedTo; },
      get tags() { return [...state.tags]; },
      get actions() { return [...state.actions]; },
      get parties() { return [...state.parties]; },
      get isOpen() { return !['settled', 'resolved', 'abandoned'].includes(state.status); },
      get isInLitigation() { return state.status === 'litigation'; },

      startInvestigation(assignedTo?: string) {
        state.status = 'investigation';
        if (assignedTo) state.assignedTo = assignedTo;
        state.openedDate = new Date();
        state.version++;
      },

      sendCeaseAndDesist() {
        state.status = 'cease_and_desist';
        state.version++;
      },

      enterNegotiations() {
        state.status = 'negotiation';
        state.version++;
      },

      fileLitigation(caseNumber: string, venue: string) {
        state.status = 'litigation';
        state.caseNumber = caseNumber;
        state.venue = venue;
        state.version++;
      },

      settle(settlementAmount: number, outcome: string, notes?: string) {
        state.status = 'settled';
        state.settlementAmount = settlementAmount;
        state.outcome = outcome;
        state.outcomeNotes = notes;
        state.resolvedDate = new Date();
        state.version++;
      },

      resolve(outcome: string, notes?: string) {
        state.status = 'resolved';
        state.outcome = outcome;
        state.outcomeNotes = notes;
        state.resolvedDate = new Date();
        state.version++;
      },

      abandon(reason: string) {
        state.status = 'abandoned';
        state.outcome = 'abandoned';
        state.outcomeNotes = reason;
        state.resolvedDate = new Date();
        state.version++;
      },

      addAction(action: any) {
        const newAction = {
          id: crypto.randomUUID(),
          actionType: action.actionType ?? 'other',
          status: action.status ?? 'pending',
          title: action.title ?? '',
          description: action.description,
          scheduledDate: action.scheduledDate,
          dueDate: action.dueDate,
          completedDate: action.completedDate,
          filingNumber: action.filingNumber,
          courtName: action.courtName,
          judgeName: action.judgeName,
          responseReceived: false,
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.actions.push(newAction);
        state.version++;
        return newAction;
      },

      updateActionStatus(actionId: string, status: string, completedDate?: Date) {
        const action = state.actions.find((a: any) => a.id === actionId);
        if (!action) throw new Error(`Action ${actionId} not found`);
        action.status = status;
        if (completedDate) action.completedDate = completedDate;
        action.updatedAt = new Date();
        state.version++;
      },

      recordActionResponse(actionId: string, responseDate: Date, summary: string) {
        const action = state.actions.find((a: any) => a.id === actionId);
        if (!action) throw new Error(`Action ${actionId} not found`);
        action.responseReceived = true;
        action.responseDate = responseDate;
        action.responseSummary = summary;
        action.updatedAt = new Date();
        state.version++;
      },

      addParty(party: any) {
        const newParty = {
          id: crypto.randomUUID(),
          role: party.role ?? 'infringer',
          name: party.name ?? '',
          organization: party.organization,
          contactEmail: party.contactEmail,
          contactPhone: party.contactPhone,
          address: party.address,
          barNumber: party.barNumber,
          firmName: party.firmName,
          notes: party.notes,
        };
        state.parties.push(newParty);
        state.version++;
        return newParty;
      },

      removeParty(partyId: string) {
        const index = state.parties.findIndex((p: any) => p.id === partyId);
        if (index === -1) throw new Error(`Party ${partyId} not found`);
        state.parties.splice(index, 1);
        state.version++;
      },

      addAdditionalAsset(asset: any) {
        state.additionalAssets.push(asset);
        state.version++;
      },

      updateFinancials(updates: any) {
        if (updates.estimatedDamages !== undefined) state.estimatedDamages = updates.estimatedDamages;
        if (updates.actualDamages !== undefined) state.actualDamages = updates.actualDamages;
        if (updates.estimatedCosts !== undefined) state.estimatedCosts = updates.estimatedCosts;
        if (updates.actualCosts !== undefined) state.actualCosts = updates.actualCosts;
        state.version++;
      },

      setPriority(priority: string) {
        state.priority = priority;
        state.version++;
      },

      update(updates: any) {
        if (updates.title !== undefined) state.title = updates.title;
        if (updates.description !== undefined) state.description = updates.description;
        if (updates.venue !== undefined) state.venue = updates.venue;
        if (updates.matterNumber !== undefined) state.matterNumber = updates.matterNumber;
        state.version++;
      },

      toPersistence() {
        return { ...state };
      },
    };
  };

  return {
    EnforcementMatter: {
      create: (input: any) => createMockMatter({
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority ?? 'medium',
        ipAssetType: input.ipAssetType,
        ipAssetId: input.ipAssetId,
        jurisdiction: input.jurisdiction,
        venue: input.venue,
        detectedDate: input.detectedDate,
        estimatedDamages: input.estimatedDamages,
        assignedTo: input.assignedTo,
        tags: input.tags ?? [],
      }),
      fromPersistence: (props: any) => createMockMatter(props),
    },
  };
});

// Now import handlers (after mocks are set up)
import { EnforcementCommandHandler } from '../../../src/application/handlers/enforcement-command.handler.js';
import { EnforcementQueryHandler } from '../../../src/application/handlers/enforcement-query.handler.js';

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Create a mock enforcement repository.
 */
const createMockRepository = () => ({
  findById: vi.fn(),
  findByMatterNumber: vi.fn(),
  findByIPAsset: vi.fn(),
  findByStatus: vi.fn(),
  findByPriority: vi.fn(),
  findAssignedTo: vi.fn(),
  findWithUpcomingActions: vi.fn(),
  search: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
});

/**
 * Create a mock event publisher.
 */
const createMockEventPublisher = () => ({
  publish: vi.fn().mockResolvedValue(undefined),
});

// ============================================================================
// EnforcementCommandHandler Tests
// ============================================================================

describe('EnforcementCommandHandler', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockEventPublisher: ReturnType<typeof createMockEventPublisher>;
  let handler: EnforcementCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = createMockRepository();
    mockEventPublisher = createMockEventPublisher();
    handler = new EnforcementCommandHandler(
      mockRepository as unknown as EnforcementRepository,
      mockEventPublisher
    );
  });

  describe('createMatter', () => {
    it('should create a new enforcement matter with monitoring status', async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.createMatter({
        title: 'Patent Infringement - Widget Corp',
        description: 'Unauthorized use of patented widget design',
        enforcementType: 'infringement',
        priority: 'high',
        ipAssetType: 'patent',
        ipAssetId: 'patent-456',
        jurisdiction: 'US',
        venue: 'Eastern District of Texas',
        detectedDate: new Date('2024-02-01'),
        estimatedDamages: 1000000,
        assignedTo: 'user-2',
        tags: ['widget', 'manufacturing'],
        actorId: 'user-2',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('monitoring');
      expect(result.title).toBe('Patent Infringement - Widget Corp');
      expect(result.type).toBe('infringement');
      expect(result.priority).toBe('high');
      expect(result.ipAssetType).toBe('patent');
      expect(result.ipAssetId).toBe('patent-456');
      expect(result.jurisdiction).toBe('US');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should generate unique ID for each matter', async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const matter1 = await handler.createMatter({
        title: 'Matter 1',
        enforcementType: 'infringement',
        ipAssetType: 'patent',
        ipAssetId: 'patent-1',
        jurisdiction: 'US',
        detectedDate: new Date(),
        actorId: 'user-1',
      });

      const matter2 = await handler.createMatter({
        title: 'Matter 2',
        enforcementType: 'infringement',
        ipAssetType: 'patent',
        ipAssetId: 'patent-2',
        jurisdiction: 'US',
        detectedDate: new Date(),
        actorId: 'user-1',
      });

      expect(matter1.id).toBeDefined();
      expect(matter2.id).toBeDefined();
      expect(matter1.id).not.toBe(matter2.id);
    });

    it('should default to medium priority if not specified', async () => {
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.createMatter({
        title: 'Default Priority Matter',
        enforcementType: 'infringement',
        ipAssetType: 'trademark',
        ipAssetId: 'tm-123',
        jurisdiction: 'EU',
        detectedDate: new Date(),
        actorId: 'user-1',
      });

      expect(result.priority).toBe('medium');
    });

    it('should call event handler after creation', async () => {
      mockRepository.save.mockResolvedValue(undefined);

      await handler.createMatter({
        title: 'Test Matter',
        enforcementType: 'infringement',
        ipAssetType: 'patent',
        ipAssetId: 'patent-1',
        jurisdiction: 'US',
        detectedDate: new Date(),
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleMatterCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('startInvestigation', () => {
    it('should transition matter from monitoring to investigation', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.startInvestigation({
        matterId: matter.id,
        assignedTo: 'investigator-1',
        actorId: 'user-1',
      });

      expect(result.status).toBe('investigation');
      expect(result.assignedTo).toBe('investigator-1');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.startInvestigation({
          matterId: 'non-existent-id',
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: non-existent-id');
    });

    it('should set openedDate when investigation starts', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.startInvestigation({
        matterId: matter.id,
        actorId: 'user-1',
      });

      expect(result.openedDate).toBeDefined();
    });

    it('should call event handler on status change', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      await handler.startInvestigation({
        matterId: matter.id,
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleStatusChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendCeaseAndDesist', () => {
    it('should transition matter to cease_and_desist status', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.sendCeaseAndDesist({
        matterId: matter.id,
        recipientName: 'Infringer Corp',
        recipientAddress: '123 Main St, Anytown USA',
        claims: ['Claim 1', 'Claim 2'],
        responseDeadline: new Date('2024-03-15'),
        actorId: 'user-1',
      });

      expect(result.status).toBe('cease_and_desist');
      expect(result.actions.length).toBeGreaterThan(0);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should add a cease_and_desist action to the matter', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.sendCeaseAndDesist({
        matterId: matter.id,
        recipientName: 'Bad Actor LLC',
        recipientAddress: '456 Elm St',
        claims: ['Patent claim 1'],
        responseDeadline: new Date('2024-04-01'),
        actorId: 'user-1',
      });

      const cdAction = result.actions.find(a => a.actionType === 'cease_and_desist');
      expect(cdAction).toBeDefined();
      expect(cdAction?.title).toContain('Bad Actor LLC');
      expect(cdAction?.status).toBe('completed');
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.sendCeaseAndDesist({
          matterId: 'missing-id',
          recipientName: 'Test',
          recipientAddress: 'Test',
          claims: [],
          responseDeadline: new Date(),
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: missing-id');
    });

    it('should call event handler for cease and desist', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      await handler.sendCeaseAndDesist({
        matterId: matter.id,
        recipientName: 'Test Corp',
        recipientAddress: 'Test Address',
        claims: ['Test claim'],
        responseDeadline: new Date('2024-05-01'),
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleCeaseAndDesistSent).toHaveBeenCalledTimes(1);
    });
  });

  describe('fileLitigation', () => {
    it('should transition matter to litigation status', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.fileLitigation({
        matterId: matter.id,
        court: 'US District Court, Northern District of California',
        caseNumber: '3:24-cv-12345',
        filingDate: new Date('2024-03-01'),
        claims: ['Claim 1 infringement', 'Claim 2 infringement'],
        venue: 'San Francisco',
        actorId: 'user-1',
      });

      expect(result.status).toBe('litigation');
      expect(result.caseNumber).toBe('3:24-cv-12345');
      expect(result.venue).toBe('San Francisco');
    });

    it('should add court_filing action to the matter', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.fileLitigation({
        matterId: matter.id,
        court: 'US District Court',
        caseNumber: 'CV-2024-001',
        filingDate: new Date('2024-03-15'),
        claims: ['Patent infringement'],
        venue: 'District Court',
        actorId: 'user-1',
      });

      const filingAction = result.actions.find(a => a.actionType === 'court_filing');
      expect(filingAction).toBeDefined();
      expect(filingAction?.filingNumber).toBe('CV-2024-001');
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.fileLitigation({
          matterId: 'invalid-id',
          court: 'Test Court',
          caseNumber: 'TEST-001',
          filingDate: new Date(),
          claims: [],
          venue: 'Test',
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: invalid-id');
    });

    it('should call event handler for litigation filed', async () => {
      const matter = createMockMatterObject({ status: 'investigation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      await handler.fileLitigation({
        matterId: matter.id,
        court: 'Test Court',
        caseNumber: 'TEST-001',
        filingDate: new Date(),
        claims: ['Test claim'],
        venue: 'Test Venue',
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleLitigationFiled).toHaveBeenCalledTimes(1);
    });
  });

  describe('settleMatter', () => {
    it('should transition matter to settled status', async () => {
      const matter = createMockMatterObject({ status: 'negotiation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.settleMatter({
        matterId: matter.id,
        settlementAmount: 250000,
        outcome: 'Favorable settlement with licensing agreement',
        terms: 'License granted for 5 years with royalties',
        notes: 'Settled to avoid prolonged litigation',
        actorId: 'user-1',
      });

      expect(result.status).toBe('settled');
      expect(result.settlementAmount).toBe(250000);
      expect(result.outcome).toBe('Favorable settlement with licensing agreement');
    });

    it('should set resolvedDate when settled', async () => {
      const matter = createMockMatterObject({ status: 'negotiation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.settleMatter({
        matterId: matter.id,
        settlementAmount: 100000,
        outcome: 'Settlement reached',
        actorId: 'user-1',
      });

      expect(result.resolvedDate).toBeDefined();
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.settleMatter({
          matterId: 'ghost-id',
          settlementAmount: 50000,
          outcome: 'Test',
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: ghost-id');
    });

    it('should call event handler for settlement', async () => {
      const matter = createMockMatterObject({ status: 'negotiation' });
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      await handler.settleMatter({
        matterId: matter.id,
        settlementAmount: 100000,
        outcome: 'Settled',
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleSettlementReached).toHaveBeenCalledTimes(1);
    });
  });

  describe('addAction', () => {
    it('should add a new action to the matter', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.addAction({
        matterId: matter.id,
        actionType: 'investigation',
        title: 'Initial Evidence Gathering',
        description: 'Collect and analyze evidence of infringement',
        scheduledDate: new Date('2024-02-15'),
        dueDate: new Date('2024-03-01'),
        actorId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.actionType).toBe('investigation');
      expect(result.title).toBe('Initial Evidence Gathering');
      expect(result.status).toBe('pending');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should generate unique ID for each action', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const action1 = await handler.addAction({
        matterId: matter.id,
        actionType: 'investigation',
        title: 'Action 1',
        actorId: 'user-1',
      });

      const action2 = await handler.addAction({
        matterId: matter.id,
        actionType: 'negotiation',
        title: 'Action 2',
        actorId: 'user-1',
      });

      expect(action1.id).not.toBe(action2.id);
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.addAction({
          matterId: 'fake-id',
          actionType: 'investigation',
          title: 'Test Action',
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: fake-id');
    });

    it('should call event handler for action taken', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      await handler.addAction({
        matterId: matter.id,
        actionType: 'investigation',
        title: 'Test Action',
        actorId: 'user-1',
      });

      expect(mockEventHandler.handleActionTaken).toHaveBeenCalledTimes(1);
    });
  });

  describe('addParty', () => {
    it('should add a new party to the matter', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.addParty({
        matterId: matter.id,
        role: 'external_counsel',
        name: 'Jane Attorney',
        organization: 'IP Law Firm LLP',
        contactEmail: 'jane@iplawfirm.com',
        contactPhone: '+1-555-123-4567',
        barNumber: 'CA123456',
        firmName: 'IP Law Firm LLP',
        actorId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.role).toBe('external_counsel');
      expect(result.name).toBe('Jane Attorney');
      expect(result.organization).toBe('IP Law Firm LLP');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should add infringer party', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const result = await handler.addParty({
        matterId: matter.id,
        role: 'infringer',
        name: 'Bad Corp',
        organization: 'Bad Corporation Inc',
        contactEmail: 'legal@badcorp.com',
        address: '123 Bad Street, Evil City',
        actorId: 'user-1',
      });

      expect(result.role).toBe('infringer');
      expect(result.name).toBe('Bad Corp');
    });

    it('should throw error if matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        handler.addParty({
          matterId: 'nonexistent',
          role: 'infringer',
          name: 'Test Party',
          actorId: 'user-1',
        })
      ).rejects.toThrow('Enforcement matter not found: nonexistent');
    });

    it('should generate unique ID for each party', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);
      mockRepository.save.mockResolvedValue(undefined);

      const party1 = await handler.addParty({
        matterId: matter.id,
        role: 'infringer',
        name: 'Party 1',
        actorId: 'user-1',
      });

      const party2 = await handler.addParty({
        matterId: matter.id,
        role: 'external_counsel',
        name: 'Party 2',
        actorId: 'user-1',
      });

      expect(party1.id).not.toBe(party2.id);
    });
  });
});

// ============================================================================
// EnforcementQueryHandler Tests
// ============================================================================

describe('EnforcementQueryHandler', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let handler: EnforcementQueryHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = createMockRepository();
    handler = new EnforcementQueryHandler(
      mockRepository as unknown as EnforcementRepository
    );
  });

  describe('getMatterById', () => {
    it('should return matter when found', async () => {
      const matter = createMockMatterObject();
      mockRepository.findById.mockResolvedValue(matter);

      const result = await handler.getMatterById(matter.id);

      expect(result).toBe(matter);
      expect(mockRepository.findById).toHaveBeenCalledWith(matter.id);
    });

    it('should return null when matter not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await handler.getMatterById('non-existent-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('getMattersByStatus', () => {
    it('should return matters with single status', async () => {
      const matters = [createMockMatterObject(), createMockMatterObject()];
      mockRepository.findByStatus.mockResolvedValue(matters);

      const result = await handler.getMattersByStatus('investigation');

      expect(result).toHaveLength(2);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith('investigation', undefined);
    });

    it('should return matters with multiple statuses', async () => {
      const matters = [createMockMatterObject(), createMockMatterObject()];
      mockRepository.findByStatus.mockResolvedValue(matters);

      const result = await handler.getMattersByStatus(['investigation', 'cease_and_desist']);

      expect(result).toHaveLength(2);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        ['investigation', 'cease_and_desist'],
        undefined
      );
    });

    it('should respect limit parameter', async () => {
      const matters = [createMockMatterObject()];
      mockRepository.findByStatus.mockResolvedValue(matters);

      await handler.getMattersByStatus('monitoring', 10);

      expect(mockRepository.findByStatus).toHaveBeenCalledWith('monitoring', 10);
    });

    it('should return empty array when no matters match', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      const result = await handler.getMattersByStatus('litigation');

      expect(result).toEqual([]);
    });
  });

  describe('getOpenMatters', () => {
    it('should return all non-terminal status matters', async () => {
      const matters = [createMockMatterObject(), createMockMatterObject()];
      mockRepository.findByStatus.mockResolvedValue(matters);

      const result = await handler.getOpenMatters();

      expect(result).toBe(matters);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'],
        undefined
      );
    });

    it('should respect limit parameter', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      await handler.getOpenMatters(25);

      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'],
        25
      );
    });

    it('should return empty array when no open matters exist', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      const result = await handler.getOpenMatters();

      expect(result).toEqual([]);
    });
  });

  describe('getCriticalMatters', () => {
    it('should return matters with critical priority', async () => {
      const criticalMatter = createMockMatterObject({ priority: 'critical' });
      mockRepository.findByPriority.mockResolvedValue([criticalMatter]);

      const result = await handler.getCriticalMatters();

      expect(result).toHaveLength(1);
      expect(mockRepository.findByPriority).toHaveBeenCalledWith('critical');
    });

    it('should return empty array when no critical matters', async () => {
      mockRepository.findByPriority.mockResolvedValue([]);

      const result = await handler.getCriticalMatters();

      expect(result).toEqual([]);
    });
  });

  describe('getMattersByPriority', () => {
    it('should return matters with specified priority', async () => {
      const highPriorityMatters = [
        createMockMatterObject({ priority: 'high' }),
        createMockMatterObject({ priority: 'high' }),
      ];
      mockRepository.findByPriority.mockResolvedValue(highPriorityMatters);

      const result = await handler.getMattersByPriority('high');

      expect(result).toHaveLength(2);
      expect(mockRepository.findByPriority).toHaveBeenCalledWith('high', undefined);
    });

    it('should respect limit parameter', async () => {
      mockRepository.findByPriority.mockResolvedValue([]);

      await handler.getMattersByPriority('low', 5);

      expect(mockRepository.findByPriority).toHaveBeenCalledWith('low', 5);
    });
  });

  describe('getMattersByIPAsset', () => {
    it('should return matters for specific IP asset', async () => {
      const matter = createMockMatterObject();
      mockRepository.findByIPAsset.mockResolvedValue([matter]);

      const result = await handler.getMattersByIPAsset('patent', 'patent-123');

      expect(result).toHaveLength(1);
      expect(mockRepository.findByIPAsset).toHaveBeenCalledWith('patent', 'patent-123');
    });

    it('should return empty array when no matters for asset', async () => {
      mockRepository.findByIPAsset.mockResolvedValue([]);

      const result = await handler.getMattersByIPAsset('trademark', 'tm-999');

      expect(result).toEqual([]);
    });
  });

  describe('getMattersAssignedTo', () => {
    it('should return matters assigned to user', async () => {
      const matter = createMockMatterObject({ assignedTo: 'user-42' });
      mockRepository.findAssignedTo.mockResolvedValue([matter]);

      const result = await handler.getMattersAssignedTo('user-42');

      expect(result).toHaveLength(1);
      expect(mockRepository.findAssignedTo).toHaveBeenCalledWith('user-42');
    });

    it('should return empty array when user has no assignments', async () => {
      mockRepository.findAssignedTo.mockResolvedValue([]);

      const result = await handler.getMattersAssignedTo('user-without-work');

      expect(result).toEqual([]);
    });
  });

  describe('searchMatters', () => {
    it('should return paginated results with correct metadata', async () => {
      const matters = [createMockMatterObject(), createMockMatterObject()];
      mockRepository.search.mockResolvedValue({ matters, total: 2 });

      const result = await handler.searchMatters({ status: 'monitoring' });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should calculate hasMore correctly when more results exist', async () => {
      const matters = [createMockMatterObject()];
      mockRepository.search.mockResolvedValue({ matters, total: 100 });

      const result = await handler.searchMatters({ limit: 10, offset: 0 });

      expect(result.hasMore).toBe(true);
    });

    it('should respect custom limit and offset', async () => {
      const matters = [createMockMatterObject()];
      mockRepository.search.mockResolvedValue({ matters, total: 50 });

      const result = await handler.searchMatters({ limit: 25, offset: 25 });

      expect(result.limit).toBe(25);
      expect(result.offset).toBe(25);
    });
  });

  describe('getMattersWithUpcomingActions', () => {
    it('should return matters with upcoming action deadlines', async () => {
      const matter = createMockMatterObject();
      mockRepository.findWithUpcomingActions.mockResolvedValue([matter]);

      const result = await handler.getMattersWithUpcomingActions(7);

      expect(result).toHaveLength(1);
      expect(mockRepository.findWithUpcomingActions).toHaveBeenCalledWith(7);
    });

    it('should return empty array when no upcoming actions', async () => {
      mockRepository.findWithUpcomingActions.mockResolvedValue([]);

      const result = await handler.getMattersWithUpcomingActions(30);

      expect(result).toEqual([]);
    });
  });

  describe('getMatterByNumber', () => {
    it('should return matter when found by matter number', async () => {
      const matter = createMockMatterObject();
      mockRepository.findByMatterNumber.mockResolvedValue(matter);

      const result = await handler.getMatterByNumber('IP-2024-001');

      expect(result).toBe(matter);
      expect(mockRepository.findByMatterNumber).toHaveBeenCalledWith('IP-2024-001');
    });

    it('should return null when matter number not found', async () => {
      mockRepository.findByMatterNumber.mockResolvedValue(null);

      const result = await handler.getMatterByNumber('NON-EXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('getMattersInLitigation', () => {
    it('should return matters currently in litigation', async () => {
      const litigationMatter = createMockMatterObject({ status: 'litigation' });
      mockRepository.findByStatus.mockResolvedValue([litigationMatter]);

      const result = await handler.getMattersInLitigation();

      expect(result).toHaveLength(1);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith('litigation');
    });

    it('should return empty array when no matters in litigation', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      const result = await handler.getMattersInLitigation();

      expect(result).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregated statistics', async () => {
      const matters = [
        createMockMatterObject({ priority: 'high', estimatedDamages: 100000 }),
        createMockMatterObject({ priority: 'critical', estimatedDamages: 500000 }),
      ];
      mockRepository.search.mockResolvedValue({ matters, total: 2 });

      const result = await handler.getStatistics();

      expect(result.total).toBe(2);
      expect(result.byStatus).toBeDefined();
      expect(result.byPriority).toBeDefined();
      expect(result.byType).toBeDefined();
      expect(result.totalEstimatedDamages).toBe(600000);
    });

    it('should handle empty results', async () => {
      mockRepository.search.mockResolvedValue({ matters: [], total: 0 });

      const result = await handler.getStatistics();

      expect(result.total).toBe(0);
      expect(result.totalEstimatedDamages).toBe(0);
      expect(result.totalSettlementAmounts).toBe(0);
      expect(result.totalCosts).toBe(0);
    });

    it('should count matters by status correctly', async () => {
      const matters = [
        createMockMatterObject({ status: 'monitoring' }),
        createMockMatterObject({ status: 'monitoring' }),
        createMockMatterObject({ status: 'investigation' }),
      ];
      mockRepository.search.mockResolvedValue({ matters, total: 3 });

      const result = await handler.getStatistics();

      expect(result.byStatus['monitoring']).toBe(2);
      expect(result.byStatus['investigation']).toBe(1);
    });

    it('should count matters by type correctly', async () => {
      const matters = [
        createMockMatterObject({ type: 'infringement' }),
        createMockMatterObject({ type: 'infringement' }),
        createMockMatterObject({ type: 'counterfeiting' }),
      ];
      mockRepository.search.mockResolvedValue({ matters, total: 3 });

      const result = await handler.getStatistics();

      expect(result.byType['infringement']).toBe(2);
      expect(result.byType['counterfeiting']).toBe(1);
    });
  });
});
