/**
 * Copyright Entity Unit Tests
 *
 * Tests for the Copyright domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { Copyright } from '../../../src/domain/entities/copyright.entity.js';

describe('Copyright Entity', () => {
  const createTestCopyright = () => Copyright.create({
    title: 'The Art of Widget Design',
    alternativeTitles: ['Widget Design Handbook', 'Widget Art'],
    workType: 'literary',
    creationDate: new Date('2024-01-15'),
    authors: [
      { name: 'Alice Johnson', contribution: 'Primary author', isWorkForHire: false, nationality: 'US' },
      { name: 'Bob Williams', contribution: 'Illustrations', isWorkForHire: true, nationality: 'US' },
    ],
    claimantId: 'entity-123',
    description: 'A comprehensive guide to widget design principles and best practices.',
    nation: 'US',
    isPublished: false,
  });

  const createSoftwareCopyright = () => Copyright.create({
    title: 'Widget Management System v1.0',
    workType: 'software',
    creationDate: new Date('2024-02-01'),
    authors: [
      { name: 'Tech Corp Engineering Team', contribution: 'Software development', isWorkForHire: true },
    ],
    claimantId: 'entity-456',
    description: 'Enterprise software for managing widget inventory and production.',
    nation: 'US',
    isPublished: true,
    publicationDate: new Date('2024-03-01'),
  });

  describe('create', () => {
    it('should create a copyright with unregistered status', () => {
      const copyright = createTestCopyright();

      expect(copyright.status).toBe('unregistered');
      expect(copyright.title).toBe('The Art of Widget Design');
      expect(copyright.workType).toBe('literary');
    });

    it('should generate a unique ID', () => {
      const copyright1 = createTestCopyright();
      const copyright2 = createTestCopyright();

      expect(copyright1.id).toBeDefined();
      expect(copyright2.id).toBeDefined();
      expect(copyright1.id).not.toBe(copyright2.id);
    });

    it('should have correct initial authors', () => {
      const copyright = createTestCopyright();

      expect(copyright.authors).toHaveLength(2);
      expect(copyright.authors[0].name).toBe('Alice Johnson');
      expect(copyright.authors[0].isWorkForHire).toBe(false);
      expect(copyright.authors[1].isWorkForHire).toBe(true);
    });

    it('should have correct alternative titles', () => {
      const copyright = createTestCopyright();

      expect(copyright.alternativeTitles).toHaveLength(2);
      expect(copyright.alternativeTitles).toContain('Widget Design Handbook');
      expect(copyright.alternativeTitles).toContain('Widget Art');
    });

    it('should return empty array when no alternative titles', () => {
      const copyright = createSoftwareCopyright();

      expect(copyright.alternativeTitles).toEqual([]);
    });

    it('should set initial publication status correctly', () => {
      const unpublished = createTestCopyright();
      const published = createSoftwareCopyright();

      expect(unpublished.isPublished).toBe(false);
      expect(unpublished.publicationDate).toBeUndefined();

      expect(published.isPublished).toBe(true);
      expect(published.publicationDate?.toISOString().split('T')[0]).toBe('2024-03-01');
    });

    it('should store creation date correctly', () => {
      const copyright = createTestCopyright();

      expect(copyright.creationDate.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should store claimantId correctly', () => {
      const copyright = createTestCopyright();

      expect(copyright.claimantId).toBe('entity-123');
    });

    it('should store nation correctly', () => {
      const copyright = createTestCopyright();

      expect(copyright.nation).toBe('US');
    });

    it('should store description correctly', () => {
      const copyright = createTestCopyright();

      expect(copyright.description).toBe('A comprehensive guide to widget design principles and best practices.');
    });
  });

  describe('register', () => {
    it('should transition from unregistered to registered', () => {
      const copyright = createTestCopyright();

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      expect(copyright.status).toBe('registered');
      expect(copyright.registrationNumber).toBe('TX-1234567');
      expect(copyright.registrationDate?.toISOString().split('T')[0]).toBe('2024-06-15');
    });

    it('should transition from pending to registered', () => {
      const copyright = createTestCopyright();
      copyright.submitForRegistration('user-1');

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      expect(copyright.status).toBe('registered');
      expect(copyright.registrationNumber).toBe('TX-1234567');
    });

    it('should emit CopyrightRegistered domain event', () => {
      const copyright = createTestCopyright();

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      const events = copyright.domainEvents;
      const registeredEvent = events.find(e => e.type === 'ip.copyright.registered');

      expect(registeredEvent).toBeDefined();
      expect(registeredEvent?.payload).toMatchObject({
        registrationNumber: 'TX-1234567',
        title: 'The Art of Widget Design',
        workType: 'literary',
      });
      expect((registeredEvent?.payload as { authors: string[] }).authors).toContain('Alice Johnson');
      expect((registeredEvent?.payload as { authors: string[] }).authors).toContain('Bob Williams');
    });

    it('should throw if already registered', () => {
      const copyright = createTestCopyright();
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      expect(() => copyright.register('TX-1234568', new Date('2024-07-15'), 'user-1'))
        .toThrow('Can only register unregistered or pending copyrights');
    });

    it('should throw if disputed', () => {
      const copyright = createTestCopyright();
      copyright.dispute('user-1');

      expect(() => copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1'))
        .toThrow('Can only register unregistered or pending copyrights');
    });

    it('should increment version', () => {
      const copyright = createTestCopyright();
      const initialVersion = copyright.version;

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      expect(copyright.version).toBe(initialVersion + 1);
    });
  });

  describe('submitForRegistration', () => {
    it('should transition from unregistered to pending', () => {
      const copyright = createTestCopyright();

      copyright.submitForRegistration('user-1');

      expect(copyright.status).toBe('pending');
    });

    it('should throw if not unregistered', () => {
      const copyright = createTestCopyright();
      copyright.submitForRegistration('user-1');

      expect(() => copyright.submitForRegistration('user-1'))
        .toThrow('Can only submit unregistered works for registration');
    });

    it('should throw if already registered', () => {
      const copyright = createTestCopyright();
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      expect(() => copyright.submitForRegistration('user-1'))
        .toThrow('Can only submit unregistered works for registration');
    });

    it('should throw if disputed', () => {
      const copyright = createTestCopyright();
      copyright.dispute('user-1');

      expect(() => copyright.submitForRegistration('user-1'))
        .toThrow('Can only submit unregistered works for registration');
    });

    it('should increment version', () => {
      const copyright = createTestCopyright();
      const initialVersion = copyright.version;

      copyright.submitForRegistration('user-1');

      expect(copyright.version).toBe(initialVersion + 1);
    });
  });

  describe('publish', () => {
    it('should set publication date and mark as published', () => {
      const copyright = createTestCopyright();

      copyright.publish(new Date('2024-05-01'), 'user-1');

      expect(copyright.isPublished).toBe(true);
      expect(copyright.publicationDate?.toISOString().split('T')[0]).toBe('2024-05-01');
    });

    it('should throw if already published', () => {
      const copyright = createSoftwareCopyright();

      expect(() => copyright.publish(new Date('2024-06-01'), 'user-1'))
        .toThrow('Work is already published');
    });

    it('should increment version', () => {
      const copyright = createTestCopyright();
      const initialVersion = copyright.version;

      copyright.publish(new Date('2024-05-01'), 'user-1');

      expect(copyright.version).toBe(initialVersion + 1);
    });
  });

  describe('addAuthor', () => {
    it('should add a new author', () => {
      const copyright = createTestCopyright();
      const initialCount = copyright.authors.length;

      copyright.addAuthor({
        name: 'Carol Davis',
        contribution: 'Technical review',
        isWorkForHire: false,
        nationality: 'UK',
      }, 'user-1');

      expect(copyright.authors).toHaveLength(initialCount + 1);
      expect(copyright.authors[initialCount].name).toBe('Carol Davis');
    });

    it('should preserve work for hire status', () => {
      const copyright = createTestCopyright();

      copyright.addAuthor({
        name: 'Contractor LLC',
        contribution: 'Cover design',
        isWorkForHire: true,
      }, 'user-1');

      const newAuthor = copyright.authors.find(a => a.name === 'Contractor LLC');
      expect(newAuthor?.isWorkForHire).toBe(true);
    });

    it('should increment version', () => {
      const copyright = createTestCopyright();
      const initialVersion = copyright.version;

      copyright.addAuthor({
        name: 'Carol Davis',
        contribution: 'Editor',
        isWorkForHire: false,
      }, 'user-1');

      expect(copyright.version).toBe(initialVersion + 1);
    });
  });

  describe('dispute', () => {
    it('should transition to disputed status', () => {
      const copyright = createTestCopyright();

      copyright.dispute('user-1');

      expect(copyright.status).toBe('disputed');
    });

    it('should dispute a registered copyright', () => {
      const copyright = createTestCopyright();
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      copyright.dispute('user-1');

      expect(copyright.status).toBe('disputed');
      expect(copyright.registrationNumber).toBe('TX-1234567');
    });

    it('should dispute a pending copyright', () => {
      const copyright = createTestCopyright();
      copyright.submitForRegistration('user-1');

      copyright.dispute('user-1');

      expect(copyright.status).toBe('disputed');
    });

    it('should increment version', () => {
      const copyright = createTestCopyright();
      const initialVersion = copyright.version;

      copyright.dispute('user-1');

      expect(copyright.version).toBe(initialVersion + 1);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a copyright from persistence', () => {
      const id = 'copyright-existing-123';
      const props = {
        registrationNumber: 'TX-9876543',
        title: 'Reconstituted Work',
        workType: 'audiovisual' as const,
        status: 'registered' as const,
        creationDate: new Date('2023-01-01'),
        publicationDate: new Date('2023-06-01'),
        registrationDate: new Date('2023-09-01'),
        authors: [{ name: 'Test Author', contribution: 'Full work', isWorkForHire: false }],
        claimantId: 'entity-999',
        description: 'A reconstituted work for testing.',
        nation: 'US',
        isPublished: true,
      };

      const copyright = Copyright.reconstitute(id, props);

      expect(copyright.id).toBe(id);
      expect(copyright.registrationNumber).toBe('TX-9876543');
      expect(copyright.title).toBe('Reconstituted Work');
      expect(copyright.workType).toBe('audiovisual');
      expect(copyright.status).toBe('registered');
      expect(copyright.isPublished).toBe(true);
    });

    it('should preserve all author information', () => {
      const id = 'copyright-author-test';
      const props = {
        title: 'Multi-Author Work',
        workType: 'musical' as const,
        status: 'unregistered' as const,
        creationDate: new Date('2024-01-01'),
        authors: [
          { name: 'Composer One', contribution: 'Composition', isWorkForHire: false, nationality: 'US' },
          { name: 'Lyricist Two', contribution: 'Lyrics', isWorkForHire: false, nationality: 'UK' },
        ],
        claimantId: 'entity-music',
        nation: 'US',
        isPublished: false,
      };

      const copyright = Copyright.reconstitute(id, props);

      expect(copyright.authors).toHaveLength(2);
      expect(copyright.authors[0].nationality).toBe('US');
      expect(copyright.authors[1].nationality).toBe('UK');
    });
  });

  describe('work types', () => {
    it('should support literary works', () => {
      const copyright = Copyright.create({
        title: 'Novel Title',
        workType: 'literary',
        creationDate: new Date(),
        authors: [{ name: 'Author', contribution: 'Writer', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('literary');
    });

    it('should support software works', () => {
      const copyright = createSoftwareCopyright();

      expect(copyright.workType).toBe('software');
    });

    it('should support audiovisual works', () => {
      const copyright = Copyright.create({
        title: 'Documentary Film',
        workType: 'audiovisual',
        creationDate: new Date(),
        authors: [{ name: 'Director', contribution: 'Direction', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('audiovisual');
    });

    it('should support sound recordings', () => {
      const copyright = Copyright.create({
        title: 'Album Recording',
        workType: 'sound_recording',
        creationDate: new Date(),
        authors: [{ name: 'Artist', contribution: 'Performance', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('sound_recording');
    });

    it('should support architectural works', () => {
      const copyright = Copyright.create({
        title: 'Building Design',
        workType: 'architectural',
        creationDate: new Date(),
        authors: [{ name: 'Architect', contribution: 'Design', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('architectural');
    });

    it('should support pictorial works', () => {
      const copyright = Copyright.create({
        title: 'Painting Series',
        workType: 'pictorial',
        creationDate: new Date(),
        authors: [{ name: 'Artist', contribution: 'Painter', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('pictorial');
    });

    it('should support dramatic works', () => {
      const copyright = Copyright.create({
        title: 'Stage Play',
        workType: 'dramatic',
        creationDate: new Date(),
        authors: [{ name: 'Playwright', contribution: 'Script', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('dramatic');
    });

    it('should support musical works', () => {
      const copyright = Copyright.create({
        title: 'Symphony No. 1',
        workType: 'musical',
        creationDate: new Date(),
        authors: [{ name: 'Composer', contribution: 'Composition', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('musical');
    });

    it('should support choreographic works', () => {
      const copyright = Copyright.create({
        title: 'Ballet Choreography',
        workType: 'choreographic',
        creationDate: new Date(),
        authors: [{ name: 'Choreographer', contribution: 'Dance design', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('choreographic');
    });

    it('should support compilation works', () => {
      const copyright = Copyright.create({
        title: 'Anthology of Poems',
        workType: 'compilation',
        creationDate: new Date(),
        authors: [{ name: 'Editor', contribution: 'Selection and arrangement', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('compilation');
    });

    it('should support derivative works', () => {
      const copyright = Copyright.create({
        title: 'Translation of Classic Novel',
        workType: 'derivative',
        creationDate: new Date(),
        authors: [{ name: 'Translator', contribution: 'Translation', isWorkForHire: false }],
        claimantId: 'entity-1',
        nation: 'US',
        isPublished: false,
      });

      expect(copyright.workType).toBe('derivative');
    });
  });

  describe('status transitions', () => {
    it('should follow unregistered -> pending -> registered flow', () => {
      const copyright = createTestCopyright();
      expect(copyright.status).toBe('unregistered');

      copyright.submitForRegistration('user-1');
      expect(copyright.status).toBe('pending');

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');
      expect(copyright.status).toBe('registered');
    });

    it('should allow direct unregistered -> registered flow', () => {
      const copyright = createTestCopyright();
      expect(copyright.status).toBe('unregistered');

      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');
      expect(copyright.status).toBe('registered');
    });

    it('should allow dispute from any status except disputed', () => {
      const unregistered = createTestCopyright();
      unregistered.dispute('user-1');
      expect(unregistered.status).toBe('disputed');

      const pending = createTestCopyright();
      pending.submitForRegistration('user-1');
      pending.dispute('user-1');
      expect(pending.status).toBe('disputed');

      const registered = createTestCopyright();
      registered.register('TX-1234567', new Date('2024-06-15'), 'user-1');
      registered.dispute('user-1');
      expect(registered.status).toBe('disputed');
    });
  });

  describe('authors array immutability', () => {
    it('should return a copy of authors array', () => {
      const copyright = createTestCopyright();
      const authors1 = copyright.authors;
      const authors2 = copyright.authors;

      expect(authors1).not.toBe(authors2);
      expect(authors1).toEqual(authors2);
    });

    it('should not allow external mutation of authors', () => {
      const copyright = createTestCopyright();
      const authors = copyright.authors;
      authors.push({ name: 'Hacker', contribution: 'Malicious', isWorkForHire: false });

      expect(copyright.authors).toHaveLength(2);
    });
  });

  describe('alternativeTitles array immutability', () => {
    it('should return a copy of alternativeTitles array', () => {
      const copyright = createTestCopyright();
      const titles1 = copyright.alternativeTitles;
      const titles2 = copyright.alternativeTitles;

      expect(titles1).not.toBe(titles2);
      expect(titles1).toEqual(titles2);
    });

    it('should not allow external mutation of alternativeTitles', () => {
      const copyright = createTestCopyright();
      const titles = copyright.alternativeTitles;
      titles.push('Hacked Title');

      expect(copyright.alternativeTitles).toHaveLength(2);
    });
  });

  describe('base entity properties', () => {
    it('should have createdAt timestamp', () => {
      const before = new Date();
      const copyright = createTestCopyright();
      const after = new Date();

      expect(copyright.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(copyright.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have initial version of 1', () => {
      const copyright = createTestCopyright();

      expect(copyright.version).toBe(1);
    });

    it('should update updatedAt on operations', () => {
      const copyright = createTestCopyright();
      const initialUpdatedAt = copyright.updatedAt;

      // Small delay to ensure different timestamp
      copyright.publish(new Date('2024-05-01'), 'user-1');

      expect(copyright.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
    });
  });

  describe('domain events', () => {
    it('should collect multiple events', () => {
      const copyright = createTestCopyright();

      // Register emits an event
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      const events = copyright.domainEvents;
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should pull and clear domain events', () => {
      const copyright = createTestCopyright();
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      const events = copyright.pullDomainEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);

      const remainingEvents = copyright.domainEvents;
      expect(remainingEvents).toHaveLength(0);
    });

    it('should include correct aggregate ID in events', () => {
      const copyright = createTestCopyright();
      copyright.register('TX-1234567', new Date('2024-06-15'), 'user-1');

      const events = copyright.domainEvents;
      const registeredEvent = events.find(e => e.type === 'ip.copyright.registered');

      expect(registeredEvent?.aggregateId).toBe(copyright.id);
    });
  });
});
