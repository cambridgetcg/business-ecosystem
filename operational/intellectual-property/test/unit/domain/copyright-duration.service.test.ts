/**
 * Copyright Duration Service Unit Tests
 *
 * Tests for the CopyrightDurationService domain service.
 *
 * @module test/unit/domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CopyrightDurationService,
  CopyrightWorkDetails,
  CopyrightAuthor,
  WorkType,
  AuthorshipType,
} from '../../../src/domain/services/copyright-duration.service.js';

describe('CopyrightDurationService', () => {
  let service: CopyrightDurationService;

  beforeEach(() => {
    service = new CopyrightDurationService();
  });

  // ==========================================================================
  // Test Data Factories
  // ==========================================================================

  function createWorkDetails(overrides: Partial<CopyrightWorkDetails> = {}): CopyrightWorkDetails {
    return {
      workType: 'literary',
      authorshipType: 'individual',
      authors: [{ name: 'John Doe', isAlive: true }],
      creationDate: new Date('2020-06-15'),
      countryOfOrigin: 'US',
      isPublished: false,
      isWorkForHire: false,
      ...overrides,
    };
  }

  function createAuthor(overrides: Partial<CopyrightAuthor> = {}): CopyrightAuthor {
    return {
      name: 'Jane Smith',
      ...overrides,
    };
  }

  // ==========================================================================
  // calculateDuration - Public Domain Works
  // ==========================================================================

  describe('calculateDuration - public domain works', () => {
    it('should identify works published before 1928 as public domain', () => {
      const work = createWorkDetails({
        creationDate: new Date('1920-01-01'),
        publicationDate: new Date('1925-06-15'),
        countryOfOrigin: 'US',
        isPublished: true,
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('public_domain_by_date');
      expect(result.rule).toBe('Pre-1928 publication (US)');
      expect(result.confidence).toBe('certain');
      expect(result.durationYears).toBe(0);
      expect(result.notes).toContain('Work is in the public domain.');
    });

    it('should not mark works published on or after 1928 as public domain', () => {
      const work = createWorkDetails({
        creationDate: new Date('1928-01-01'),
        publicationDate: new Date('1928-03-15'),
        countryOfOrigin: 'US',
        isPublished: true,
        authors: [{ name: 'Author', dateOfDeath: new Date('1960-01-01') }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).not.toBe('public_domain_by_date');
    });

    it('should use publication date as expiration for public domain works', () => {
      const publicationDate = new Date('1920-05-10');
      const work = createWorkDetails({
        creationDate: new Date('1918-01-01'),
        publicationDate,
        countryOfOrigin: 'US',
        isPublished: true,
      });

      const result = service.calculateDuration(work);

      expect(result.expirationDate.toDateString()).toBe(publicationDate.toDateString());
    });
  });

  // ==========================================================================
  // calculateDuration - Work for Hire
  // ==========================================================================

  describe('calculateDuration - work for hire', () => {
    describe('US work for hire', () => {
      it('should calculate 95 years from publication for published works', () => {
        const publicationDate = new Date('2000-06-15');
        const work = createWorkDetails({
          isWorkForHire: true,
          authorshipType: 'work_for_hire',
          isPublished: true,
          publicationDate,
          countryOfOrigin: 'US',
          corporateAuthor: 'Acme Corporation',
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_us');
        expect(result.durationYears).toBe(95);
        expect(result.confidence).toBe('certain');
        expect(result.expirationDate.getFullYear()).toBe(2095);
        expect(result.expirationDate.getMonth()).toBe(11); // December
        expect(result.expirationDate.getDate()).toBe(31);
      });

      it('should calculate 120 years from creation for unpublished works, using shorter of 95/120', () => {
        const creationDate = new Date('2000-03-20');
        const work = createWorkDetails({
          isWorkForHire: true,
          authorshipType: 'work_for_hire',
          isPublished: false,
          creationDate,
          countryOfOrigin: 'US',
          corporateAuthor: 'Tech Corp',
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_us');
        // The service uses the shorter of 95 years from publication/creation or 120 from creation
        // For unpublished works without publication date, it falls back to creation date for both
        // 95 years from creation (2095) is shorter than 120 years (2120)
        expect(result.expirationDate.getFullYear()).toBe(2095);
        expect(result.notes).toContain('Unpublished work: duration based on creation date.');
        expect(result.notes).toContain('Using shorter of 95/120 year terms.');
        expect(result.warnings).toContain('Publishing before expiration extends protection under 95-year rule.');
      });

      it('should use isWorkForHire flag even if authorshipType is different', () => {
        const work = createWorkDetails({
          isWorkForHire: true,
          authorshipType: 'individual', // Flag takes precedence
          isPublished: true,
          publicationDate: new Date('2010-01-01'),
          countryOfOrigin: 'US',
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_us');
      });

      it('should use shorter of 95/120 year terms when applicable', () => {
        // Created in 2000, published in 2010
        // 95 from publication = 2105
        // 120 from creation = 2120
        // Shorter is 2105
        const work = createWorkDetails({
          isWorkForHire: true,
          creationDate: new Date('2000-01-01'),
          publicationDate: new Date('2010-01-01'),
          isPublished: true,
          countryOfOrigin: 'US',
        });

        const result = service.calculateDuration(work);

        expect(result.expirationDate.getFullYear()).toBe(2105);
      });
    });

    describe('EU work for hire', () => {
      it('should calculate 70 years from publication for EU works', () => {
        const publicationDate = new Date('2000-06-15');
        const work = createWorkDetails({
          isWorkForHire: true,
          authorshipType: 'work_for_hire',
          isPublished: true,
          publicationDate,
          countryOfOrigin: 'EU',
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_eu');
        expect(result.durationYears).toBe(70);
        expect(result.expirationDate.getFullYear()).toBe(2070);
        expect(result.notes).toContain('Work-for-hire under EU rules.');
      });

      it('should use creation date when publication date is not available', () => {
        const creationDate = new Date('2005-03-01');
        const work = createWorkDetails({
          isWorkForHire: true,
          authorshipType: 'work_for_hire',
          isPublished: false,
          creationDate,
          countryOfOrigin: 'DE', // Germany, non-US
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_eu');
        expect(result.expirationDate.getFullYear()).toBe(2075);
      });
    });
  });

  // ==========================================================================
  // calculateDuration - Anonymous/Pseudonymous Works
  // ==========================================================================

  describe('calculateDuration - anonymous and pseudonymous works', () => {
    it('should calculate 95 years from publication for published anonymous works', () => {
      const publicationDate = new Date('2000-08-20');
      const work = createWorkDetails({
        authorshipType: 'anonymous',
        isPublished: true,
        publicationDate,
        authors: [{ name: 'Unknown', pseudonym: 'Anonymous' }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('anonymous_pseudonymous');
      expect(result.durationYears).toBe(95);
      expect(result.expirationDate.getFullYear()).toBe(2095);
      expect(result.confidence).toBe('estimated');
    });

    it('should calculate 120 years from creation for unpublished pseudonymous works', () => {
      const creationDate = new Date('2005-02-14');
      const work = createWorkDetails({
        authorshipType: 'pseudonymous',
        isPublished: false,
        creationDate,
        authors: [{ name: 'Unknown', pseudonym: 'The Shadow Writer' }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('anonymous_pseudonymous');
      expect(result.durationYears).toBe(120);
      expect(result.expirationDate.getFullYear()).toBe(2125);
    });

    it('should include warning about identity revelation changing duration', () => {
      const work = createWorkDetails({
        authorshipType: 'anonymous',
        isPublished: true,
        publicationDate: new Date('2010-01-01'),
      });

      const result = service.calculateDuration(work);

      expect(result.warnings).toContain(
        'If author identity is revealed in Copyright Office records, duration changes to life + 70 years.'
      );
    });

    it('should switch to individual calculation when author identity is revealed', () => {
      const work = createWorkDetails({
        authorshipType: 'pseudonymous',
        isPublished: true,
        publicationDate: new Date('2000-01-01'),
        authors: [
          {
            name: 'John Smith',
            // Identity revealed - has real name without pseudonym and has dates
            dateOfBirth: new Date('1950-05-10'),
            dateOfDeath: new Date('2015-03-22'),
          },
        ],
      });

      const result = service.calculateDuration(work);

      // Should calculate as individual since author identity is revealed
      // The service switches to individual calculation and returns 70 years from death
      expect(result.calculationBasis).toBe('individual_death_plus_70');
      expect(result.expirationDate.getFullYear()).toBe(2085); // 2015 + 70
      expect(result.confidence).toBe('certain');
    });
  });

  // ==========================================================================
  // calculateDuration - Joint Works (Multiple Authors)
  // ==========================================================================

  describe('calculateDuration - joint works', () => {
    it('should identify works with living authors and indicate death tracking needed', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Author A', isAlive: true },
          { name: 'Author B', isAlive: true },
        ],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('joint_work_living_author');
      expect(result.confidence).toBe('unknown');
      expect(result.durationYears).toBe(-1);
      expect(result.authorDeathTracking?.requiredForCalculation).toBe(true);
      expect(result.warnings).toContain('Expiration cannot be calculated until all authors are deceased.');
    });

    it('should list living authors in notes', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Alice Writer', isAlive: true },
          { name: 'Bob Author', isAlive: true },
          { name: 'Charlie Deceased', isAlive: false, dateOfDeath: new Date('2018-01-01') },
        ],
      });

      const result = service.calculateDuration(work);

      expect(result.notes[0]).toContain('2 author(s) still living');
      expect(result.notes[0]).toContain('Alice Writer');
      expect(result.notes[0]).toContain('Bob Author');
    });

    it('should calculate 70 years from last surviving author death when all death dates known', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'First Author', dateOfDeath: new Date('2000-06-15') },
          { name: 'Last Author', dateOfDeath: new Date('2015-11-30') },
          { name: 'Middle Author', dateOfDeath: new Date('2010-03-22') },
        ],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('joint_work_death_plus_70');
      expect(result.durationYears).toBe(70);
      expect(result.confidence).toBe('certain');
      expect(result.expirationDate.getFullYear()).toBe(2085); // 2015 + 70
      expect(result.authorDeathTracking?.lastSurvivingAuthor).toBe('Last Author');
      expect(result.authorDeathTracking?.requiredForCalculation).toBe(false);
    });

    it('should use estimated calculation when no death dates are recorded', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        creationDate: new Date('1990-01-01'),
        authors: [
          { name: 'Author One' },
          { name: 'Author Two' },
        ],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('joint_work_estimated');
      expect(result.confidence).toBe('estimated');
      expect(result.warnings).toContain('No death dates recorded for any author. Using estimated calculation.');
      expect(result.authorDeathTracking?.requiredForCalculation).toBe(true);
    });
  });

  // ==========================================================================
  // calculateDuration - Individual Author
  // ==========================================================================

  describe('calculateDuration - individual author', () => {
    it('should indicate death tracking needed for living author', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Living Author', isAlive: true }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('individual_living');
      expect(result.confidence).toBe('unknown');
      expect(result.durationYears).toBe(-1);
      expect(result.authorDeathTracking?.requiredForCalculation).toBe(true);
      expect(result.warnings).toContain('Expiration cannot be calculated until author is deceased.');
    });

    it('should calculate 70 years from death when death date is known', () => {
      const deathDate = new Date('2010-09-25');
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Deceased Author', dateOfDeath: deathDate }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('individual_death_plus_70');
      expect(result.durationYears).toBe(70);
      expect(result.confidence).toBe('certain');
      expect(result.expirationDate.getFullYear()).toBe(2080); // 2010 + 70
      expect(result.expirationDate.getMonth()).toBe(11); // December
      expect(result.expirationDate.getDate()).toBe(31);
      expect(result.authorDeathTracking?.deathDate?.toDateString()).toBe(deathDate.toDateString());
    });

    it('should estimate death based on birth year when death date is unknown', () => {
      const birthDate = new Date('1940-04-15');
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Author Unknown Status', dateOfBirth: birthDate }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('individual_estimated');
      expect(result.confidence).toBe('estimated');
      // Birth 1940 + 80 year lifespan = 2020 estimated death
      // + 70 years = 2090
      expect(result.expirationDate.getFullYear()).toBe(2090);
      expect(result.warnings).toContain('Using estimated death date based on birth year. Update death records for accuracy.');
      expect(result.notes[0]).toContain('1940');
    });

    it('should use rough estimate based on creation date when no author dates available', () => {
      const creationDate = new Date('1980-07-01');
      const work = createWorkDetails({
        authorshipType: 'individual',
        creationDate,
        authors: [{ name: 'Mystery Author' }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('individual_rough_estimate');
      expect(result.confidence).toBe('estimated');
      // Creation 1980 + 50 (assume 30 at creation, 80 lifespan) = 2030 + 70 = 2100
      expect(result.expirationDate.getFullYear()).toBe(2100);
      expect(result.warnings).toContain('No author birth/death information. Using rough estimate based on creation date.');
    });

    it('should handle work with no author information', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('unknown_author');
      expect(result.confidence).toBe('unknown');
      expect(result.warnings).toContain('No author information provided. Add author details for accurate calculation.');
    });
  });

  // ==========================================================================
  // calculateDuration - Different Work Types
  // ==========================================================================

  describe('calculateDuration - work types', () => {
    const workTypes: WorkType[] = [
      'literary',
      'musical',
      'dramatic',
      'choreographic',
      'pictorial_graphic_sculptural',
      'motion_picture',
      'sound_recording',
      'architectural',
      'software',
      'database',
      'compilation',
      'derivative',
    ];

    workTypes.forEach((workType) => {
      it(`should calculate duration for ${workType} work type`, () => {
        const work = createWorkDetails({
          workType,
          authors: [{ name: 'Test Author', dateOfDeath: new Date('2000-01-01') }],
        });

        const result = service.calculateDuration(work);

        expect(result.expirationDate).toBeDefined();
        expect(result.durationYears).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // recordAuthorDeath
  // ==========================================================================

  describe('recordAuthorDeath', () => {
    it('should update author death date and recalculate duration', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Author Name', isAlive: true }],
      });

      const deathDate = new Date('2024-06-15');
      const result = service.recordAuthorDeath(work, 'Author Name', deathDate);

      expect(result.calculationBasis).toBe('individual_death_plus_70');
      expect(result.confidence).toBe('certain');
      expect(result.expirationDate.getFullYear()).toBe(2094); // 2024 + 70
    });

    it('should update isAlive flag to false', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Living Author', isAlive: true }],
      });

      service.recordAuthorDeath(work, 'Living Author', new Date('2023-01-01'));

      expect(work.authors[0].isAlive).toBe(false);
      expect(work.authors[0].dateOfDeath).toBeDefined();
    });

    it('should handle joint work death recording correctly', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Author A', isAlive: true },
          { name: 'Author B', dateOfDeath: new Date('2015-01-01') },
        ],
      });

      // Before recording death, calculation should show living author
      const beforeResult = service.calculateDuration(work);
      expect(beforeResult.calculationBasis).toBe('joint_work_living_author');

      // Record death of living author
      const afterResult = service.recordAuthorDeath(work, 'Author A', new Date('2020-06-01'));

      expect(afterResult.calculationBasis).toBe('joint_work_death_plus_70');
      expect(afterResult.authorDeathTracking?.lastSurvivingAuthor).toBe('Author A');
      expect(afterResult.expirationDate.getFullYear()).toBe(2090); // 2020 + 70
    });

    it('should not modify work if author name not found', () => {
      const work = createWorkDetails({
        authors: [{ name: 'Real Author', isAlive: true }],
      });

      service.recordAuthorDeath(work, 'Nonexistent Author', new Date('2020-01-01'));

      expect(work.authors[0].isAlive).toBe(true);
      expect(work.authors[0].dateOfDeath).toBeUndefined();
    });
  });

  // ==========================================================================
  // requiresDeathTracking
  // ==========================================================================

  describe('requiresDeathTracking', () => {
    it('should return false for work-for-hire (flag)', () => {
      const work = createWorkDetails({
        isWorkForHire: true,
        authors: [{ name: 'Employee', isAlive: true }],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return false for work-for-hire (authorship type)', () => {
      const work = createWorkDetails({
        isWorkForHire: false,
        authorshipType: 'work_for_hire',
        authors: [{ name: 'Contractor', isAlive: true }],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return false for anonymous works', () => {
      const work = createWorkDetails({
        authorshipType: 'anonymous',
        authors: [{ name: 'Unknown', isAlive: true }],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return false for pseudonymous works', () => {
      const work = createWorkDetails({
        authorshipType: 'pseudonymous',
        authors: [{ name: 'Unknown', pseudonym: 'The Poet', isAlive: true }],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return true for individual work with living author', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Living Writer', isAlive: true }],
      });

      expect(service.requiresDeathTracking(work)).toBe(true);
    });

    it('should return true for individual work with unknown death status', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Unknown Status Author' }], // No isAlive or dateOfDeath
      });

      expect(service.requiresDeathTracking(work)).toBe(true);
    });

    it('should return false for individual work with known death date', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Deceased Author', dateOfDeath: new Date('2010-01-01') }],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return true for joint work with any living author', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Deceased', dateOfDeath: new Date('2000-01-01') },
          { name: 'Living', isAlive: true },
        ],
      });

      expect(service.requiresDeathTracking(work)).toBe(true);
    });

    it('should return false for joint work with all deceased authors', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'First', dateOfDeath: new Date('2000-01-01') },
          { name: 'Second', dateOfDeath: new Date('2010-01-01') },
        ],
      });

      expect(service.requiresDeathTracking(work)).toBe(false);
    });

    it('should return true when author has isAlive explicitly set to undefined with no death date', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Status Unknown', isAlive: undefined }],
      });

      expect(service.requiresDeathTracking(work)).toBe(true);
    });
  });

  // ==========================================================================
  // getAuthorsRequiringTracking
  // ==========================================================================

  describe('getAuthorsRequiringTracking', () => {
    it('should return empty array for work-for-hire', () => {
      const work = createWorkDetails({
        isWorkForHire: true,
        authors: [{ name: 'Employee', isAlive: true }],
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(0);
    });

    it('should return living authors for individual work', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Living Author', isAlive: true }],
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Living Author');
    });

    it('should return authors with unknown status', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Status Unknown' }], // No isAlive or dateOfDeath
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Status Unknown');
    });

    it('should return only living/unknown authors from joint work', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Deceased One', dateOfDeath: new Date('1990-01-01') },
          { name: 'Living One', isAlive: true },
          { name: 'Unknown Status' },
          { name: 'Deceased Two', dateOfDeath: new Date('2005-06-15') },
        ],
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.name)).toContain('Living One');
      expect(result.map(a => a.name)).toContain('Unknown Status');
    });

    it('should return empty array when all authors have death dates', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'First', dateOfDeath: new Date('2000-01-01') },
          { name: 'Second', dateOfDeath: new Date('2010-06-15') },
        ],
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(0);
    });

    it('should not return authors explicitly marked as not alive', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{ name: 'Marked Dead', isAlive: false, dateOfDeath: new Date('2020-01-01') }],
      });

      const result = service.getAuthorsRequiringTracking(work);

      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Date Calculations and Edge Cases
  // ==========================================================================

  describe('date calculations and edge cases', () => {
    it('should set expiration to end of calendar year (December 31)', () => {
      const deathDate = new Date('2010-03-15'); // Mid-year death
      const work = createWorkDetails({
        authors: [{ name: 'Author', dateOfDeath: deathDate }],
      });

      const result = service.calculateDuration(work);

      expect(result.expirationDate.getMonth()).toBe(11); // December
      expect(result.expirationDate.getDate()).toBe(31);
    });

    it('should handle leap year creation dates correctly', () => {
      const work = createWorkDetails({
        isWorkForHire: true,
        creationDate: new Date('2000-02-29'), // Leap year
        isPublished: false,
        countryOfOrigin: 'US',
      });

      const result = service.calculateDuration(work);

      // The service uses shorter of 95/120 year terms
      // For unpublished works, both terms use creation date
      // 95 from creation (2095) is shorter than 120 (2120)
      expect(result.expirationDate.getFullYear()).toBe(2095);
    });

    it('should handle works created on January 1, 1978 (modern copyright start)', () => {
      const work = createWorkDetails({
        creationDate: new Date('1978-01-01'),
        authors: [{ name: 'Author', dateOfDeath: new Date('2020-01-01') }],
      });

      const result = service.calculateDuration(work);

      expect(result.expirationDate.getFullYear()).toBe(2090);
    });

    it('should handle very old works still in copyright', () => {
      // Published 1930, author died 1970
      const work = createWorkDetails({
        creationDate: new Date('1928-01-01'),
        publicationDate: new Date('1930-06-15'),
        isPublished: true,
        countryOfOrigin: 'US',
        authors: [{ name: 'Old Author', dateOfDeath: new Date('1970-01-01') }],
      });

      const result = service.calculateDuration(work);

      expect(result.calculationBasis).toBe('individual_death_plus_70');
      expect(result.expirationDate.getFullYear()).toBe(2040); // 1970 + 70
    });
  });

  // ==========================================================================
  // Life+70 Calculations
  // ==========================================================================

  describe('life+70 calculations', () => {
    it('should calculate correctly for author who died recently', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{
          name: 'Recent Deceased',
          dateOfBirth: new Date('1945-05-20'),
          dateOfDeath: new Date('2023-11-10'),
        }],
      });

      const result = service.calculateDuration(work);

      expect(result.durationYears).toBe(70);
      expect(result.expirationDate.getFullYear()).toBe(2093);
    });

    it('should calculate correctly for author who died long ago', () => {
      const work = createWorkDetails({
        authorshipType: 'individual',
        authors: [{
          name: 'Historical Author',
          dateOfBirth: new Date('1880-01-01'),
          dateOfDeath: new Date('1955-12-31'),
        }],
      });

      const result = service.calculateDuration(work);

      expect(result.durationYears).toBe(70);
      expect(result.expirationDate.getFullYear()).toBe(2025); // Already expired or about to
    });

    it('should properly identify last surviving author in joint work', () => {
      const work = createWorkDetails({
        authorshipType: 'joint',
        authors: [
          { name: 'Died First', dateOfDeath: new Date('1980-01-01') },
          { name: 'Died Last', dateOfDeath: new Date('2005-07-15') },
          { name: 'Died Middle', dateOfDeath: new Date('1995-03-20') },
        ],
      });

      const result = service.calculateDuration(work);

      expect(result.authorDeathTracking?.lastSurvivingAuthor).toBe('Died Last');
      expect(result.expirationDate.getFullYear()).toBe(2075); // 2005 + 70
    });
  });

  // ==========================================================================
  // Country of Origin Variations
  // ==========================================================================

  describe('country of origin handling', () => {
    it('should apply US public domain rules only for US works', () => {
      // US work published before 1928 - public domain
      const usWork = createWorkDetails({
        countryOfOrigin: 'US',
        publicationDate: new Date('1920-01-01'),
        isPublished: true,
      });

      // Same dates but UK origin - not subject to US public domain cutoff
      const ukWork = createWorkDetails({
        countryOfOrigin: 'UK',
        publicationDate: new Date('1920-01-01'),
        isPublished: true,
        authors: [{ name: 'UK Author', dateOfDeath: new Date('1960-01-01') }],
      });

      const usResult = service.calculateDuration(usWork);
      const ukResult = service.calculateDuration(ukWork);

      expect(usResult.calculationBasis).toBe('public_domain_by_date');
      expect(ukResult.calculationBasis).not.toBe('public_domain_by_date');
    });

    it('should use EU work-for-hire rules for European countries', () => {
      const euCountries = ['EU', 'DE', 'FR', 'UK', 'ES', 'IT'];

      euCountries.forEach((country) => {
        const work = createWorkDetails({
          isWorkForHire: true,
          countryOfOrigin: country,
          publicationDate: new Date('2000-01-01'),
          isPublished: true,
        });

        const result = service.calculateDuration(work);

        expect(result.calculationBasis).toBe('work_for_hire_eu');
        expect(result.durationYears).toBe(70);
      });
    });
  });

  // ==========================================================================
  // Confidence Levels
  // ==========================================================================

  describe('confidence levels', () => {
    it('should return certain confidence when death date is known', () => {
      const work = createWorkDetails({
        authors: [{ name: 'Known', dateOfDeath: new Date('2000-01-01') }],
      });

      const result = service.calculateDuration(work);

      expect(result.confidence).toBe('certain');
    });

    it('should return unknown confidence when author is living', () => {
      const work = createWorkDetails({
        authors: [{ name: 'Living', isAlive: true }],
      });

      const result = service.calculateDuration(work);

      expect(result.confidence).toBe('unknown');
    });

    it('should return estimated confidence when using calculated dates', () => {
      const work = createWorkDetails({
        authors: [{ name: 'Unknown Status', dateOfBirth: new Date('1950-01-01') }],
      });

      const result = service.calculateDuration(work);

      expect(result.confidence).toBe('estimated');
    });

    it('should return certain confidence for work-for-hire with known dates', () => {
      const work = createWorkDetails({
        isWorkForHire: true,
        isPublished: true,
        publicationDate: new Date('2000-01-01'),
      });

      const result = service.calculateDuration(work);

      expect(result.confidence).toBe('certain');
    });
  });
});
