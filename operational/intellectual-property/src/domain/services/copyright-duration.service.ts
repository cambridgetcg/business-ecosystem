/**
 * Copyright Duration Calculator Service
 *
 * Domain service for calculating copyright expiration dates.
 * Handles complex duration rules based on:
 * - Creation/publication date
 * - Author type (individual, joint, corporate)
 * - Work-made-for-hire status
 * - Anonymous/pseudonymous works
 * - Author death tracking
 *
 * Based on US Copyright Act provisions and international treaties.
 *
 * @module domain/services
 */

/**
 * Work type classification for duration calculation.
 */
export type WorkType =
  | 'literary'
  | 'musical'
  | 'dramatic'
  | 'choreographic'
  | 'pictorial_graphic_sculptural'
  | 'motion_picture'
  | 'sound_recording'
  | 'architectural'
  | 'software'
  | 'database'
  | 'compilation'
  | 'derivative';

/**
 * Authorship classification.
 */
export type AuthorshipType =
  | 'individual'           // Single natural person
  | 'joint'                // Multiple authors
  | 'work_for_hire'        // Corporate/employer ownership
  | 'anonymous'            // Author identity not revealed
  | 'pseudonymous';        // Author uses fictitious name

/**
 * Author information for duration calculation.
 */
export interface CopyrightAuthor {
  name: string;
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  isAlive?: boolean;
  nationality?: string;
  contribution?: string;
  pseudonym?: string;
}

/**
 * Copyright work details for duration calculation.
 */
export interface CopyrightWorkDetails {
  workType: WorkType;
  authorshipType: AuthorshipType;
  authors: CopyrightAuthor[];
  creationDate: Date;
  publicationDate?: Date;
  registrationDate?: Date;
  countryOfOrigin: string;
  isPublished: boolean;
  isWorkForHire: boolean;
  corporateAuthor?: string;
}

/**
 * Duration calculation result.
 */
export interface DurationResult {
  expirationDate: Date;
  durationYears: number;
  calculationBasis: string;
  rule: string;
  confidence: 'certain' | 'estimated' | 'unknown';
  notes: string[];
  warnings: string[];
  authorDeathTracking?: {
    requiredForCalculation: boolean;
    lastSurvivingAuthor?: string;
    deathDate?: Date;
    yearsFromDeath: number;
  };
}

/**
 * Key copyright term thresholds.
 */
const COPYRIGHT_TERMS = {
  // US terms
  US: {
    // Works created on or after Jan 1, 1978
    MODERN: {
      LIFE_PLUS: 70,              // Life of author + 70 years
      WORK_FOR_HIRE: 95,          // 95 years from publication or 120 from creation
      WORK_FOR_HIRE_UNPUBLISHED: 120,
      ANONYMOUS_FROM_PUBLICATION: 95,
      ANONYMOUS_FROM_CREATION: 120,
    },
    // Works created before 1978
    LEGACY: {
      PRE_1928: 0,                // Public domain
      PRE_1978_PUBLISHED: 95,     // If copyright renewed
      PRE_1978_UNPUBLISHED: 2002, // Protected until at least 2002
    },
    // Key dates
    MODERN_START: new Date('1978-01-01'),
    PUBLIC_DOMAIN_CUTOFF: new Date('1928-01-01'),
  },
  // EU terms (varies by country, using common rule)
  EU: {
    LIFE_PLUS: 70,
    WORK_FOR_HIRE: 70,           // From publication/creation
  },
  // UK terms
  UK: {
    LIFE_PLUS: 70,
    SOUND_RECORDING: 70,         // From release
  },
};

/**
 * Copyright Duration Calculator Service
 *
 * Calculates copyright expiration based on complex duration rules.
 */
export class CopyrightDurationService {
  /**
   * Calculate copyright expiration date.
   */
  calculateDuration(work: CopyrightWorkDetails): DurationResult {
    const notes: string[] = [];
    const warnings: string[] = [];

    // Check if work is in public domain due to age
    if (this.isPublicDomainByDate(work)) {
      return this.createPublicDomainResult(work);
    }

    // Route based on authorship type
    if (work.isWorkForHire || work.authorshipType === 'work_for_hire') {
      return this.calculateWorkForHire(work);
    }

    if (work.authorshipType === 'anonymous' || work.authorshipType === 'pseudonymous') {
      return this.calculateAnonymousPseudonymous(work);
    }

    if (work.authorshipType === 'joint') {
      return this.calculateJointWork(work);
    }

    // Individual author
    return this.calculateIndividualAuthor(work);
  }

  /**
   * Check if work is public domain by date.
   */
  private isPublicDomainByDate(work: CopyrightWorkDetails): boolean {
    if (work.countryOfOrigin === 'US') {
      // Works published before 1928 are in public domain
      if (work.publicationDate && work.publicationDate < COPYRIGHT_TERMS.US.PUBLIC_DOMAIN_CUTOFF) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create result for public domain works.
   */
  private createPublicDomainResult(work: CopyrightWorkDetails): DurationResult {
    return {
      expirationDate: work.publicationDate ?? work.creationDate,
      durationYears: 0,
      calculationBasis: 'public_domain_by_date',
      rule: 'Pre-1928 publication (US)',
      confidence: 'certain',
      notes: ['Work is in the public domain.'],
      warnings: [],
    };
  }

  /**
   * Calculate duration for work-made-for-hire.
   */
  private calculateWorkForHire(work: CopyrightWorkDetails): DurationResult {
    const notes: string[] = [];
    const warnings: string[] = [];

    if (work.countryOfOrigin !== 'US') {
      // EU and most countries: use publication date + term
      const baseDate = work.publicationDate ?? work.creationDate;
      const expirationDate = this.addYears(baseDate, COPYRIGHT_TERMS.EU.WORK_FOR_HIRE);

      return {
        expirationDate,
        durationYears: COPYRIGHT_TERMS.EU.WORK_FOR_HIRE,
        calculationBasis: 'work_for_hire_eu',
        rule: `${COPYRIGHT_TERMS.EU.WORK_FOR_HIRE} years from publication/creation`,
        confidence: 'certain',
        notes: ['Work-for-hire under EU rules.'],
        warnings: [],
      };
    }

    // US rules
    let expirationDate: Date;
    let durationYears: number;
    let rule: string;

    if (work.isPublished && work.publicationDate) {
      // 95 years from publication
      durationYears = COPYRIGHT_TERMS.US.MODERN.WORK_FOR_HIRE;
      expirationDate = this.addYears(work.publicationDate, durationYears);
      rule = `95 years from first publication (${work.publicationDate.getFullYear()})`;
      notes.push('Duration based on publication date.');
    } else {
      // 120 years from creation
      durationYears = COPYRIGHT_TERMS.US.MODERN.WORK_FOR_HIRE_UNPUBLISHED;
      expirationDate = this.addYears(work.creationDate, durationYears);
      rule = `120 years from creation (${work.creationDate.getFullYear()})`;
      notes.push('Unpublished work: duration based on creation date.');
      warnings.push('Publishing before expiration extends protection under 95-year rule.');
    }

    // Use shorter of the two terms
    const altExpirationDate = work.isPublished && work.publicationDate
      ? this.addYears(work.creationDate, COPYRIGHT_TERMS.US.MODERN.WORK_FOR_HIRE_UNPUBLISHED)
      : this.addYears(work.publicationDate ?? work.creationDate, COPYRIGHT_TERMS.US.MODERN.WORK_FOR_HIRE);

    if (altExpirationDate < expirationDate) {
      expirationDate = altExpirationDate;
      notes.push('Using shorter of 95/120 year terms.');
    }

    return {
      expirationDate,
      durationYears,
      calculationBasis: 'work_for_hire_us',
      rule,
      confidence: 'certain',
      notes,
      warnings,
    };
  }

  /**
   * Calculate duration for anonymous/pseudonymous works.
   */
  private calculateAnonymousPseudonymous(work: CopyrightWorkDetails): DurationResult {
    const notes: string[] = [];
    const warnings: string[] = [];

    // Check if author identity has been revealed
    const authorRevealed = work.authors.some(a =>
      a.name && !a.pseudonym && (a.dateOfBirth || a.dateOfDeath)
    );

    if (authorRevealed) {
      notes.push('Author identity revealed: calculating as individual work.');
      return this.calculateIndividualAuthor(work);
    }

    // Anonymous/pseudonymous: same as work for hire
    const rule = work.isPublished
      ? `95 years from publication (anonymous/pseudonymous)`
      : `120 years from creation (anonymous/pseudonymous)`;

    const baseDate = work.isPublished && work.publicationDate
      ? work.publicationDate
      : work.creationDate;

    const years = work.isPublished
      ? COPYRIGHT_TERMS.US.MODERN.ANONYMOUS_FROM_PUBLICATION
      : COPYRIGHT_TERMS.US.MODERN.ANONYMOUS_FROM_CREATION;

    const expirationDate = this.addYears(baseDate, years);

    warnings.push('If author identity is revealed in Copyright Office records, duration changes to life + 70 years.');

    return {
      expirationDate,
      durationYears: years,
      calculationBasis: 'anonymous_pseudonymous',
      rule,
      confidence: 'estimated',
      notes,
      warnings,
    };
  }

  /**
   * Calculate duration for joint works (multiple authors).
   */
  private calculateJointWork(work: CopyrightWorkDetails): DurationResult {
    const notes: string[] = [];
    const warnings: string[] = [];

    // Find last surviving author
    const authorsWithDeath = work.authors.filter(a => a.dateOfDeath);
    const livingAuthors = work.authors.filter(a => a.isAlive === true);

    if (livingAuthors.length > 0) {
      return {
        expirationDate: new Date('2200-01-01'), // Placeholder
        durationYears: -1,
        calculationBasis: 'joint_work_living_author',
        rule: 'Life of last surviving author + 70 years',
        confidence: 'unknown',
        notes: [`${livingAuthors.length} author(s) still living: ${livingAuthors.map(a => a.name).join(', ')}`],
        warnings: ['Expiration cannot be calculated until all authors are deceased.'],
        authorDeathTracking: {
          requiredForCalculation: true,
          lastSurvivingAuthor: livingAuthors[0].name,
          yearsFromDeath: 70,
        },
      };
    }

    if (authorsWithDeath.length === 0) {
      warnings.push('No death dates recorded for any author. Using estimated calculation.');

      // Estimate: assume 70 years old at creation, average lifespan 80 years
      const estimatedDeathYear = work.creationDate.getFullYear() + 80 - 70;
      const estimatedExpiration = this.addYears(new Date(estimatedDeathYear, 0, 1), 70);

      return {
        expirationDate: estimatedExpiration,
        durationYears: -1,
        calculationBasis: 'joint_work_estimated',
        rule: 'Life of last surviving author + 70 years (ESTIMATED)',
        confidence: 'estimated',
        notes: ['Using statistical estimate. Update author death records for accurate calculation.'],
        warnings,
        authorDeathTracking: {
          requiredForCalculation: true,
          yearsFromDeath: 70,
        },
      };
    }

    // Find last surviving author by death date
    const lastSurvivor = authorsWithDeath.reduce((latest, author) =>
      author.dateOfDeath! > latest.dateOfDeath! ? author : latest
    );

    const expirationDate = this.addYears(lastSurvivor.dateOfDeath!, 70);

    return {
      expirationDate,
      durationYears: 70,
      calculationBasis: 'joint_work_death_plus_70',
      rule: `70 years from death of last surviving author (${lastSurvivor.name}, died ${lastSurvivor.dateOfDeath!.getFullYear()})`,
      confidence: 'certain',
      notes: [`Last surviving author: ${lastSurvivor.name}`],
      warnings: [],
      authorDeathTracking: {
        requiredForCalculation: false,
        lastSurvivingAuthor: lastSurvivor.name,
        deathDate: lastSurvivor.dateOfDeath,
        yearsFromDeath: 70,
      },
    };
  }

  /**
   * Calculate duration for individual author.
   */
  private calculateIndividualAuthor(work: CopyrightWorkDetails): DurationResult {
    const notes: string[] = [];
    const warnings: string[] = [];

    const author = work.authors[0];

    if (!author) {
      return {
        expirationDate: new Date('2200-01-01'),
        durationYears: -1,
        calculationBasis: 'unknown_author',
        rule: 'Unable to calculate: no author information',
        confidence: 'unknown',
        notes: [],
        warnings: ['No author information provided. Add author details for accurate calculation.'],
      };
    }

    if (author.isAlive === true) {
      return {
        expirationDate: new Date('2200-01-01'),
        durationYears: -1,
        calculationBasis: 'individual_living',
        rule: 'Life of author + 70 years',
        confidence: 'unknown',
        notes: [`Author ${author.name} is still living.`],
        warnings: ['Expiration cannot be calculated until author is deceased.'],
        authorDeathTracking: {
          requiredForCalculation: true,
          lastSurvivingAuthor: author.name,
          yearsFromDeath: 70,
        },
      };
    }

    if (author.dateOfDeath) {
      const expirationDate = this.addYears(author.dateOfDeath, 70);

      return {
        expirationDate,
        durationYears: 70,
        calculationBasis: 'individual_death_plus_70',
        rule: `70 years from death of author (${author.name}, died ${author.dateOfDeath.getFullYear()})`,
        confidence: 'certain',
        notes: [],
        warnings: [],
        authorDeathTracking: {
          requiredForCalculation: false,
          lastSurvivingAuthor: author.name,
          deathDate: author.dateOfDeath,
          yearsFromDeath: 70,
        },
      };
    }

    // No death date - estimate
    if (author.dateOfBirth) {
      // Estimate: average lifespan of 80 years
      const estimatedDeathYear = author.dateOfBirth.getFullYear() + 80;
      const estimatedDeathDate = new Date(estimatedDeathYear, 0, 1);
      const expirationDate = this.addYears(estimatedDeathDate, 70);

      warnings.push('Using estimated death date based on birth year. Update death records for accuracy.');

      return {
        expirationDate,
        durationYears: 70,
        calculationBasis: 'individual_estimated',
        rule: 'Life of author + 70 years (ESTIMATED based on birth date)',
        confidence: 'estimated',
        notes: [`Estimated based on birth year ${author.dateOfBirth.getFullYear()} + 80 year lifespan.`],
        warnings,
        authorDeathTracking: {
          requiredForCalculation: true,
          lastSurvivingAuthor: author.name,
          yearsFromDeath: 70,
        },
      };
    }

    // No birth or death date - use creation date estimate
    const estimatedDeathYear = work.creationDate.getFullYear() + 50; // Assume 30 years old at creation, 80 year lifespan
    const expirationDate = this.addYears(new Date(estimatedDeathYear, 0, 1), 70);

    warnings.push('No author birth/death information. Using rough estimate based on creation date.');

    return {
      expirationDate,
      durationYears: -1,
      calculationBasis: 'individual_rough_estimate',
      rule: 'Life of author + 70 years (ROUGH ESTIMATE)',
      confidence: 'estimated',
      notes: ['Add author birth/death dates for accurate calculation.'],
      warnings,
      authorDeathTracking: {
        requiredForCalculation: true,
        lastSurvivingAuthor: author.name,
        yearsFromDeath: 70,
      },
    };
  }

  /**
   * Update author death date and recalculate.
   */
  recordAuthorDeath(
    work: CopyrightWorkDetails,
    authorName: string,
    deathDate: Date
  ): DurationResult {
    // Update author in work
    const author = work.authors.find(a => a.name === authorName);
    if (author) {
      author.dateOfDeath = deathDate;
      author.isAlive = false;
    }

    return this.calculateDuration(work);
  }

  /**
   * Check if copyright requires author death tracking.
   */
  requiresDeathTracking(work: CopyrightWorkDetails): boolean {
    if (work.isWorkForHire) return false;
    if (work.authorshipType === 'work_for_hire') return false;
    if (work.authorshipType === 'anonymous') return false;
    if (work.authorshipType === 'pseudonymous') return false;

    // Individual or joint authorship requires death tracking
    return work.authors.some(a => a.isAlive === true || (!a.dateOfDeath && a.isAlive !== false));
  }

  /**
   * Get authors requiring death tracking.
   */
  getAuthorsRequiringTracking(work: CopyrightWorkDetails): CopyrightAuthor[] {
    if (!this.requiresDeathTracking(work)) return [];

    return work.authors.filter(a =>
      a.isAlive === true || (!a.dateOfDeath && a.isAlive !== false)
    );
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    // Copyright typically expires at end of calendar year
    result.setMonth(11);
    result.setDate(31);
    return result;
  }
}

// Singleton instance
export const copyrightDurationService = new CopyrightDurationService();
