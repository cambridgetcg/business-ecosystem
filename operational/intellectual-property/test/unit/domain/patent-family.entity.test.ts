/**
 * Patent Family Entity Unit Tests
 *
 * Tests for the PatentFamily domain entity which manages relationships
 * between related patents sharing a common priority claim.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { PatentFamily } from '../../../src/domain/entities/patent-family.entity.js';

describe('PatentFamily Entity', () => {
  const createTestPatentFamily = () => PatentFamily.create({
    familyName: 'Widget Manufacturing Process Family',
    priorityPatentId: 'patent-original-001',
    priorityDate: new Date('2023-01-15'),
    description: 'Patent family covering widget manufacturing innovations',
    technologyArea: 'Manufacturing Technology',
  });

  describe('create', () => {
    it('should create a patent family with the priority patent as original member', () => {
      const family = createTestPatentFamily();

      expect(family.familyName).toBe('Widget Manufacturing Process Family');
      expect(family.priorityPatentId).toBe('patent-original-001');
      expect(family.priorityDate.toISOString().split('T')[0]).toBe('2023-01-15');
      expect(family.description).toBe('Patent family covering widget manufacturing innovations');
      expect(family.technologyArea).toBe('Manufacturing Technology');
    });

    it('should generate a unique ID', () => {
      const family1 = createTestPatentFamily();
      const family2 = createTestPatentFamily();

      expect(family1.id).toBeDefined();
      expect(family2.id).toBeDefined();
      expect(family1.id).not.toBe(family2.id);
    });

    it('should automatically add priority patent as original member', () => {
      const family = createTestPatentFamily();

      expect(family.memberCount).toBe(1);
      expect(family.members[0].patentId).toBe('patent-original-001');
      expect(family.members[0].continuationType).toBe('original');
      expect(family.members[0].isTrueDivisional).toBe(false);
    });

    it('should emit PatentFamilyCreated domain event', () => {
      const family = createTestPatentFamily();

      const events = family.domainEvents;
      const createdEvent = events.find(e => e.type === 'ip.patent_family.created');

      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload).toMatchObject({
        familyName: 'Widget Manufacturing Process Family',
        priorityPatentId: 'patent-original-001',
      });
    });

    it('should create without optional fields', () => {
      const family = PatentFamily.create({
        familyName: 'Minimal Family',
        priorityPatentId: 'patent-minimal-001',
        priorityDate: new Date('2023-06-01'),
      });

      expect(family.familyName).toBe('Minimal Family');
      expect(family.description).toBeUndefined();
      expect(family.technologyArea).toBeUndefined();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence data', () => {
      const family = PatentFamily.reconstitute('family-123', {
        familyName: 'Reconstituted Family',
        priorityPatentId: 'patent-recon-001',
        priorityDate: new Date('2022-05-10'),
        description: 'A reconstituted family',
        technologyArea: 'Software',
        members: [
          {
            id: 'member-001',
            patentId: 'patent-recon-001',
            continuationType: 'original',
            isTrueDivisional: false,
          },
        ],
      });

      expect(family.id).toBe('family-123');
      expect(family.familyName).toBe('Reconstituted Family');
      expect(family.memberCount).toBe(1);
    });
  });

  describe('addMember', () => {
    it('should add a continuation to the family', () => {
      const family = createTestPatentFamily();

      const member = family.addMember({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
        notes: 'First continuation filing',
      }, 'user-1');

      expect(family.memberCount).toBe(2);
      expect(member.patentId).toBe('patent-continuation-001');
      expect(member.parentPatentId).toBe('patent-original-001');
      expect(member.continuationType).toBe('continuation');
      expect(member.notes).toBe('First continuation filing');
    });

    it('should add a divisional to the family', () => {
      const family = createTestPatentFamily();

      const member = family.addMember({
        patentId: 'patent-divisional-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'divisional',
        isTrueDivisional: true,
        restrictionDate: new Date('2023-06-15'),
      }, 'user-1');

      expect(member.continuationType).toBe('divisional');
      expect(member.isTrueDivisional).toBe(true);
      expect(member.restrictionDate?.toISOString().split('T')[0]).toBe('2023-06-15');
    });

    it('should add a continuation-in-part to the family', () => {
      const family = createTestPatentFamily();

      const member = family.addMember({
        patentId: 'patent-cip-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation_in_part',
        notes: 'Adds new matter for enhanced widget features',
      }, 'user-1');

      expect(member.continuationType).toBe('continuation_in_part');
      expect(family.continuationsInPart).toHaveLength(1);
    });

    it('should emit PatentFamilyMemberAdded domain event', () => {
      const family = createTestPatentFamily();
      // Clear events by pulling them
      family.pullDomainEvents();

      family.addMember({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');

      const events = family.domainEvents;
      const addedEvent = events.find(e => e.type === 'ip.patent_family.member_added');

      expect(addedEvent).toBeDefined();
      expect(addedEvent?.payload).toMatchObject({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      });
    });

    it('should throw if patent is already a member', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');

      expect(() => family.addMember({
        patentId: 'patent-continuation-001',
        continuationType: 'divisional',
      }, 'user-1')).toThrow('Patent patent-continuation-001 is already a member of this family');
    });

    it('should throw if parent patent is not a member', () => {
      const family = createTestPatentFamily();

      expect(() => family.addMember({
        patentId: 'patent-orphan-001',
        parentPatentId: 'non-existent-patent',
        continuationType: 'continuation',
      }, 'user-1')).toThrow('Parent patent non-existent-patent is not a member of this family');
    });

    it('should allow adding member without parent (for original filings)', () => {
      const family = createTestPatentFamily();

      const member = family.addMember({
        patentId: 'patent-standalone-001',
        continuationType: 'continuation',
      }, 'user-1');

      expect(member.parentPatentId).toBeUndefined();
      expect(family.memberCount).toBe(2);
    });

    it('should default isTrueDivisional to false', () => {
      const family = createTestPatentFamily();

      const member = family.addMember({
        patentId: 'patent-divisional-001',
        continuationType: 'divisional',
      }, 'user-1');

      expect(member.isTrueDivisional).toBe(false);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from the family', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');

      expect(family.memberCount).toBe(2);

      family.removeMember('patent-continuation-001', 'user-1');

      expect(family.memberCount).toBe(1);
      expect(family.getMemberByPatentId('patent-continuation-001')).toBeUndefined();
    });

    it('should throw when trying to remove priority patent', () => {
      const family = createTestPatentFamily();

      expect(() => family.removeMember('patent-original-001', 'user-1'))
        .toThrow('Cannot remove the priority patent from the family');
    });

    it('should throw if patent is not a member', () => {
      const family = createTestPatentFamily();

      expect(() => family.removeMember('non-existent-patent', 'user-1'))
        .toThrow('Patent non-existent-patent is not a member of this family');
    });

    it('should throw if patent has child members', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-continuation-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');
      family.addMember({
        patentId: 'patent-continuation-002',
        parentPatentId: 'patent-continuation-001',
        continuationType: 'continuation',
      }, 'user-1');

      expect(() => family.removeMember('patent-continuation-001', 'user-1'))
        .toThrow('Cannot remove patent patent-continuation-001 as it has child patents in the family');
    });
  });

  describe('updateMemberNotes', () => {
    it('should update notes for a member', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-continuation-001',
        continuationType: 'continuation',
      }, 'user-1');

      family.updateMemberNotes('patent-continuation-001', 'Updated prosecution notes', 'user-1');

      const member = family.getMemberByPatentId('patent-continuation-001');
      expect(member?.notes).toBe('Updated prosecution notes');
    });

    it('should throw if patent is not a member', () => {
      const family = createTestPatentFamily();

      expect(() => family.updateMemberNotes('non-existent-patent', 'Notes', 'user-1'))
        .toThrow('Patent non-existent-patent is not a member of this family');
    });
  });

  describe('updateDescription', () => {
    it('should update the family description', () => {
      const family = createTestPatentFamily();

      family.updateDescription('Updated family description covering all widget innovations', 'user-1');

      expect(family.description).toBe('Updated family description covering all widget innovations');
    });
  });

  describe('updateTechnologyArea', () => {
    it('should update the technology area', () => {
      const family = createTestPatentFamily();

      family.updateTechnologyArea('Advanced Manufacturing & AI', 'user-1');

      expect(family.technologyArea).toBe('Advanced Manufacturing & AI');
    });
  });

  describe('computed properties', () => {
    it('should return correct memberCount', () => {
      const family = createTestPatentFamily();

      expect(family.memberCount).toBe(1);

      family.addMember({ patentId: 'patent-2', continuationType: 'continuation' }, 'user-1');
      family.addMember({ patentId: 'patent-3', continuationType: 'divisional' }, 'user-1');

      expect(family.memberCount).toBe(3);
    });

    it('should filter continuations correctly', () => {
      const family = createTestPatentFamily();
      family.addMember({ patentId: 'patent-cont-1', continuationType: 'continuation' }, 'user-1');
      family.addMember({ patentId: 'patent-cont-2', continuationType: 'continuation' }, 'user-1');
      family.addMember({ patentId: 'patent-div-1', continuationType: 'divisional' }, 'user-1');

      expect(family.continuations).toHaveLength(2);
      expect(family.continuations.every(m => m.continuationType === 'continuation')).toBe(true);
    });

    it('should filter divisionals correctly', () => {
      const family = createTestPatentFamily();
      family.addMember({ patentId: 'patent-div-1', continuationType: 'divisional' }, 'user-1');
      family.addMember({ patentId: 'patent-div-2', continuationType: 'divisional' }, 'user-1');
      family.addMember({ patentId: 'patent-cont-1', continuationType: 'continuation' }, 'user-1');

      expect(family.divisionals).toHaveLength(2);
      expect(family.divisionals.every(m => m.continuationType === 'divisional')).toBe(true);
    });

    it('should filter continuations-in-part correctly', () => {
      const family = createTestPatentFamily();
      family.addMember({ patentId: 'patent-cip-1', continuationType: 'continuation_in_part' }, 'user-1');
      family.addMember({ patentId: 'patent-cip-2', continuationType: 'continuation_in_part' }, 'user-1');
      family.addMember({ patentId: 'patent-cont-1', continuationType: 'continuation' }, 'user-1');

      expect(family.continuationsInPart).toHaveLength(2);
      expect(family.continuationsInPart.every(m => m.continuationType === 'continuation_in_part')).toBe(true);
    });
  });

  describe('getMemberByPatentId', () => {
    it('should return the member if found', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-continuation-001',
        continuationType: 'continuation',
        notes: 'Test notes',
      }, 'user-1');

      const member = family.getMemberByPatentId('patent-continuation-001');

      expect(member).toBeDefined();
      expect(member?.patentId).toBe('patent-continuation-001');
      expect(member?.notes).toBe('Test notes');
    });

    it('should return undefined if not found', () => {
      const family = createTestPatentFamily();

      const member = family.getMemberByPatentId('non-existent-patent');

      expect(member).toBeUndefined();
    });
  });

  describe('getChildMembers', () => {
    it('should return direct children of a patent', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-child-1',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');
      family.addMember({
        patentId: 'patent-child-2',
        parentPatentId: 'patent-original-001',
        continuationType: 'divisional',
      }, 'user-1');
      family.addMember({
        patentId: 'patent-grandchild-1',
        parentPatentId: 'patent-child-1',
        continuationType: 'continuation',
      }, 'user-1');

      const children = family.getChildMembers('patent-original-001');

      expect(children).toHaveLength(2);
      expect(children.map(c => c.patentId)).toContain('patent-child-1');
      expect(children.map(c => c.patentId)).toContain('patent-child-2');
      expect(children.map(c => c.patentId)).not.toContain('patent-grandchild-1');
    });

    it('should return empty array if no children', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-leaf-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');

      const children = family.getChildMembers('patent-leaf-001');

      expect(children).toHaveLength(0);
    });
  });

  describe('getAncestorChain', () => {
    it('should return the full ancestor chain', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-gen2',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');
      family.addMember({
        patentId: 'patent-gen3',
        parentPatentId: 'patent-gen2',
        continuationType: 'continuation',
      }, 'user-1');
      family.addMember({
        patentId: 'patent-gen4',
        parentPatentId: 'patent-gen3',
        continuationType: 'continuation',
      }, 'user-1');

      const ancestors = family.getAncestorChain('patent-gen4');

      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].patentId).toBe('patent-original-001');
      expect(ancestors[1].patentId).toBe('patent-gen2');
      expect(ancestors[2].patentId).toBe('patent-gen3');
    });

    it('should return empty array for root member', () => {
      const family = createTestPatentFamily();

      const ancestors = family.getAncestorChain('patent-original-001');

      expect(ancestors).toHaveLength(0);
    });

    it('should handle single-level ancestry', () => {
      const family = createTestPatentFamily();
      family.addMember({
        patentId: 'patent-child-001',
        parentPatentId: 'patent-original-001',
        continuationType: 'continuation',
      }, 'user-1');

      const ancestors = family.getAncestorChain('patent-child-001');

      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].patentId).toBe('patent-original-001');
    });
  });

  describe('members array immutability', () => {
    it('should return a copy of members array', () => {
      const family = createTestPatentFamily();

      const members1 = family.members;
      const members2 = family.members;

      expect(members1).not.toBe(members2);
      expect(members1).toEqual(members2);
    });

    it('should not allow external modification of members', () => {
      const family = createTestPatentFamily();

      const members = family.members;
      members.push({
        id: 'fake-member',
        patentId: 'fake-patent',
        continuationType: 'continuation',
        isTrueDivisional: false,
      });

      expect(family.memberCount).toBe(1);
      expect(family.getMemberByPatentId('fake-patent')).toBeUndefined();
    });
  });

  describe('complex family tree scenarios', () => {
    it('should handle a realistic patent family structure', () => {
      const family = PatentFamily.create({
        familyName: 'AI Widget Manufacturing Suite',
        priorityPatentId: 'US-2023-001-ORIG',
        priorityDate: new Date('2023-01-01'),
        technologyArea: 'Artificial Intelligence in Manufacturing',
      });

      // First generation children
      family.addMember({
        patentId: 'US-2023-001-CON1',
        parentPatentId: 'US-2023-001-ORIG',
        continuationType: 'continuation',
        notes: 'Broadening claims to method aspects',
      }, 'user-1');

      family.addMember({
        patentId: 'US-2023-001-DIV1',
        parentPatentId: 'US-2023-001-ORIG',
        continuationType: 'divisional',
        isTrueDivisional: true,
        restrictionDate: new Date('2023-06-15'),
        notes: 'System claims after restriction requirement',
      }, 'user-1');

      family.addMember({
        patentId: 'US-2023-001-CIP1',
        parentPatentId: 'US-2023-001-ORIG',
        continuationType: 'continuation_in_part',
        notes: 'Adds new ML training methodology',
      }, 'user-1');

      // Second generation
      family.addMember({
        patentId: 'US-2023-001-CON2',
        parentPatentId: 'US-2023-001-CON1',
        continuationType: 'continuation',
        notes: 'Further method refinements',
      }, 'user-1');

      expect(family.memberCount).toBe(5);
      expect(family.continuations).toHaveLength(2);
      expect(family.divisionals).toHaveLength(1);
      expect(family.continuationsInPart).toHaveLength(1);

      // Verify relationships
      const origChildren = family.getChildMembers('US-2023-001-ORIG');
      expect(origChildren).toHaveLength(3);

      const con2Ancestors = family.getAncestorChain('US-2023-001-CON2');
      expect(con2Ancestors).toHaveLength(2);
      expect(con2Ancestors[0].patentId).toBe('US-2023-001-ORIG');
      expect(con2Ancestors[1].patentId).toBe('US-2023-001-CON1');
    });
  });
});
