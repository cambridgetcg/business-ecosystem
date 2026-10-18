/**
 * Enforcement Matter Entity Unit Tests
 *
 * Tests for the EnforcementMatter domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { EnforcementMatter } from '../../../src/domain/entities/enforcement-matter.entity.js';

describe('EnforcementMatter Entity', () => {
  const createTestMatter = () => EnforcementMatter.create({
    title: 'Patent Infringement - Widget Co',
    description: 'Suspected infringement of Patent US12345678',
    type: 'infringement',
    priority: 'high',
    ipAssetType: 'patent',
    ipAssetId: 'patent-123',
    jurisdiction: 'US',
    venue: 'N.D. California',
    detectedDate: new Date('2024-01-15'),
    estimatedDamages: 1000000,
    assignedTo: 'attorney-1',
    tags: ['urgent', 'tech'],
  });

  describe('create', () => {
    it('should create a matter with monitoring status', () => {
      const matter = createTestMatter();

      expect(matter.status).toBe('monitoring');
      expect(matter.title).toBe('Patent Infringement - Widget Co');
      expect(matter.type).toBe('infringement');
    });

    it('should generate a unique ID', () => {
      const matter1 = createTestMatter();
      const matter2 = createTestMatter();

      expect(matter1.id).toBeDefined();
      expect(matter2.id).toBeDefined();
      expect(matter1.id).not.toBe(matter2.id);
    });

    it('should emit EnforcementMatter.Opened event', () => {
      const matter = createTestMatter();

      const events = matter.getUncommittedEvents();
      const openedEvent = events.find(e => e.type === 'EnforcementMatter.Opened');

      expect(openedEvent).toBeDefined();
      expect(openedEvent?.payload).toMatchObject({
        type: 'infringement',
        ipAssetType: 'patent',
      });
    });

    it('should default priority to medium if not specified', () => {
      const matter = EnforcementMatter.create({
        title: 'Test Matter',
        type: 'infringement',
        ipAssetType: 'patent',
        ipAssetId: 'patent-123',
        jurisdiction: 'US',
        detectedDate: new Date(),
      });

      expect(matter.priority).toBe('medium');
    });
  });

  describe('status transitions', () => {
    describe('startInvestigation', () => {
      it('should transition from monitoring to investigation', () => {
        const matter = createTestMatter();

        matter.startInvestigation('investigator-1');

        expect(matter.status).toBe('investigation');
        expect(matter.assignedTo).toBe('investigator-1');
        expect(matter.openedDate).toBeDefined();
      });

      it('should emit StatusChanged event', () => {
        const matter = createTestMatter();
        matter.clearEvents();

        matter.startInvestigation();

        const events = matter.getUncommittedEvents();
        const statusEvent = events.find(e => e.type === 'EnforcementMatter.StatusChanged');

        expect(statusEvent).toBeDefined();
        expect(statusEvent?.payload).toMatchObject({
          oldStatus: 'monitoring',
          newStatus: 'investigation',
        });
      });
    });

    describe('sendCeaseAndDesist', () => {
      it('should transition to cease_and_desist status', () => {
        const matter = createTestMatter();
        matter.startInvestigation();

        matter.sendCeaseAndDesist();

        expect(matter.status).toBe('cease_and_desist');
      });
    });

    describe('enterNegotiations', () => {
      it('should transition to negotiation status', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();

        matter.enterNegotiations();

        expect(matter.status).toBe('negotiation');
      });
    });

    describe('fileLitigation', () => {
      it('should transition to litigation status', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();

        matter.fileLitigation('1:24-cv-12345', 'N.D. California');

        expect(matter.status).toBe('litigation');
        expect(matter.caseNumber).toBe('1:24-cv-12345');
        expect(matter.venue).toBe('N.D. California');
      });

      it('should emit LitigationFiled event', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();
        matter.clearEvents();

        matter.fileLitigation('1:24-cv-12345', 'N.D. California');

        const events = matter.getUncommittedEvents();
        const litigationEvent = events.find(e => e.type === 'EnforcementMatter.LitigationFiled');

        expect(litigationEvent).toBeDefined();
        expect(litigationEvent?.payload).toMatchObject({
          caseNumber: '1:24-cv-12345',
          venue: 'N.D. California',
        });
      });
    });

    describe('settle', () => {
      it('should transition to settled status', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();
        matter.enterNegotiations();

        matter.settle(500000, 'Settlement with licensing agreement', 'Includes 5-year license');

        expect(matter.status).toBe('settled');
        expect(matter.settlementAmount).toBe(500000);
        expect(matter.outcome).toBe('Settlement with licensing agreement');
        expect(matter.resolvedDate).toBeDefined();
      });

      it('should emit Settled event', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();
        matter.enterNegotiations();
        matter.clearEvents();

        matter.settle(500000, 'Settlement with licensing agreement');

        const events = matter.getUncommittedEvents();
        const settledEvent = events.find(e => e.type === 'EnforcementMatter.Settled');

        expect(settledEvent).toBeDefined();
        expect(settledEvent?.payload).toMatchObject({
          settlementAmount: 500000,
        });
      });
    });

    describe('abandon', () => {
      it('should transition to abandoned status', () => {
        const matter = createTestMatter();
        matter.startInvestigation();

        matter.abandon('Insufficient evidence');

        expect(matter.status).toBe('abandoned');
        expect(matter.outcome).toBe('abandoned');
        expect(matter.outcomeNotes).toBe('Insufficient evidence');
      });
    });

    describe('invalid transitions', () => {
      it('should throw on invalid status transition', () => {
        const matter = createTestMatter();

        // Cannot go directly from monitoring to litigation
        expect(() => matter.fileLitigation('1:24-cv-12345', 'N.D. California'))
          .toThrow('Cannot transition');
      });

      it('should not allow transitions from terminal states', () => {
        const matter = createTestMatter();
        matter.startInvestigation();
        matter.sendCeaseAndDesist();
        matter.enterNegotiations();
        matter.settle(500000, 'Done');

        // Settled is a terminal state
        expect(() => matter.abandon('Changed mind'))
          .toThrow('Cannot transition');
      });
    });
  });

  describe('actions', () => {
    describe('addAction', () => {
      it('should add an action to the matter', () => {
        const matter = createTestMatter();

        const action = matter.addAction({
          actionType: 'cease_and_desist',
          status: 'pending',
          title: 'Initial C&D Letter',
          description: 'First cease and desist letter to Widget Co',
          dueDate: new Date('2024-02-15'),
        });

        expect(matter.actions).toHaveLength(1);
        expect(action.id).toBeDefined();
        expect(action.actionType).toBe('cease_and_desist');
        expect(action.responseReceived).toBe(false);
        expect(action.documents).toHaveLength(0);
      });

      it('should emit ActionAdded event', () => {
        const matter = createTestMatter();
        matter.clearEvents();

        matter.addAction({
          actionType: 'investigation',
          status: 'pending',
          title: 'Market Survey',
        });

        const events = matter.getUncommittedEvents();
        const actionEvent = events.find(e => e.type === 'EnforcementMatter.ActionAdded');

        expect(actionEvent).toBeDefined();
        expect(actionEvent?.payload).toMatchObject({
          actionType: 'investigation',
          title: 'Market Survey',
        });
      });
    });

    describe('updateActionStatus', () => {
      it('should update action status', () => {
        const matter = createTestMatter();
        const action = matter.addAction({
          actionType: 'investigation',
          status: 'pending',
          title: 'Market Survey',
        });

        matter.updateActionStatus(action.id, 'completed', new Date());

        const updatedAction = matter.actions.find(a => a.id === action.id);
        expect(updatedAction?.status).toBe('completed');
        expect(updatedAction?.completedDate).toBeDefined();
      });
    });

    describe('recordActionResponse', () => {
      it('should record response to an action', () => {
        const matter = createTestMatter();
        const action = matter.addAction({
          actionType: 'cease_and_desist',
          status: 'completed',
          title: 'C&D Letter',
        });

        matter.recordActionResponse(action.id, new Date(), 'Infringer agreed to cease');

        const updatedAction = matter.actions.find(a => a.id === action.id);
        expect(updatedAction?.responseReceived).toBe(true);
        expect(updatedAction?.responseSummary).toBe('Infringer agreed to cease');
      });
    });
  });

  describe('parties', () => {
    describe('addParty', () => {
      it('should add a party to the matter', () => {
        const matter = createTestMatter();

        const party = matter.addParty({
          role: 'infringer',
          name: 'Widget Co Inc.',
          organization: 'Widget Co',
          contactEmail: 'legal@widgetco.com',
        });

        expect(matter.parties).toHaveLength(1);
        expect(party.id).toBeDefined();
        expect(party.role).toBe('infringer');
        expect(party.name).toBe('Widget Co Inc.');
      });

      it('should emit PartyAdded event', () => {
        const matter = createTestMatter();
        matter.clearEvents();

        matter.addParty({
          role: 'external_counsel',
          name: 'Attorney Jane',
          firmName: 'Smith & Associates',
          barNumber: '12345',
        });

        const events = matter.getUncommittedEvents();
        const partyEvent = events.find(e => e.type === 'EnforcementMatter.PartyAdded');

        expect(partyEvent).toBeDefined();
        expect(partyEvent?.payload).toMatchObject({
          role: 'external_counsel',
          name: 'Attorney Jane',
        });
      });
    });

    describe('removeParty', () => {
      it('should remove a party from the matter', () => {
        const matter = createTestMatter();
        const party = matter.addParty({
          role: 'infringer',
          name: 'Widget Co',
        });

        matter.removeParty(party.id);

        expect(matter.parties).toHaveLength(0);
      });

      it('should throw if party not found', () => {
        const matter = createTestMatter();

        expect(() => matter.removeParty('non-existent-id'))
          .toThrow('Party non-existent-id not found');
      });
    });

    describe('getPartiesByRole', () => {
      it('should filter parties by role', () => {
        const matter = createTestMatter();
        matter.addParty({ role: 'infringer', name: 'Bad Actor 1' });
        matter.addParty({ role: 'infringer', name: 'Bad Actor 2' });
        matter.addParty({ role: 'external_counsel', name: 'Lawyer' });

        const infringers = matter.getPartiesByRole('infringer');

        expect(infringers).toHaveLength(2);
        expect(infringers.every(p => p.role === 'infringer')).toBe(true);
      });
    });
  });

  describe('additional assets', () => {
    it('should add additional IP assets', () => {
      const matter = createTestMatter();

      matter.addAdditionalAsset({
        type: 'trademark',
        id: 'trademark-456',
        description: 'Widget Mark',
      });

      expect(matter.additionalAssets).toHaveLength(1);
      expect(matter.additionalAssets[0].type).toBe('trademark');
    });

    it('should not add duplicate assets', () => {
      const matter = createTestMatter();

      matter.addAdditionalAsset({
        type: 'trademark',
        id: 'trademark-456',
        description: 'Widget Mark',
      });

      matter.addAdditionalAsset({
        type: 'trademark',
        id: 'trademark-456',
        description: 'Widget Mark',
      });

      expect(matter.additionalAssets).toHaveLength(1);
    });
  });

  describe('financials', () => {
    it('should update financial estimates', () => {
      const matter = createTestMatter();

      matter.updateFinancials({
        estimatedDamages: 2000000,
        actualDamages: 1500000,
        estimatedCosts: 100000,
        actualCosts: 75000,
      });

      expect(matter.estimatedDamages).toBe(2000000);
      expect(matter.actualDamages).toBe(1500000);
      expect(matter.estimatedCosts).toBe(100000);
      expect(matter.actualCosts).toBe(75000);
    });

    it('should record action costs', () => {
      const matter = createTestMatter();
      const action = matter.addAction({
        actionType: 'court_filing',
        status: 'completed',
        title: 'Initial Filing',
      });

      matter.recordActionCost(action.id, 5000);

      const updatedAction = matter.actions.find(a => a.id === action.id);
      expect(updatedAction?.cost).toBe(5000);
      expect(matter.actualCosts).toBe(5000);
    });
  });

  describe('priority', () => {
    it('should update priority', () => {
      const matter = createTestMatter();

      matter.setPriority('critical');

      expect(matter.priority).toBe('critical');
    });

    it('should emit escalation event when escalating to critical', () => {
      const matter = createTestMatter();
      matter.clearEvents();

      matter.setPriority('critical');

      const events = matter.getUncommittedEvents();
      const escalationEvent = events.find(e => e.type === 'EnforcementMatter.EscalatedToCritical');

      expect(escalationEvent).toBeDefined();
    });
  });

  describe('computed properties', () => {
    it('should report open status correctly', () => {
      const matter = createTestMatter();
      expect(matter.isOpen).toBe(true);

      matter.startInvestigation();
      matter.sendCeaseAndDesist();
      matter.enterNegotiations();
      matter.settle(100000, 'Done');

      expect(matter.isOpen).toBe(false);
    });

    it('should report litigation status correctly', () => {
      const matter = createTestMatter();
      expect(matter.isInLitigation).toBe(false);

      matter.startInvestigation();
      matter.sendCeaseAndDesist();
      matter.fileLitigation('1:24-cv-12345', 'N.D. Cal');

      expect(matter.isInLitigation).toBe(true);
    });
  });
});
