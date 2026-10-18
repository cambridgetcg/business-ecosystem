/**
 * Certificate of Insurance (CoI) Templates
 *
 * Defines template structures matching industry-standard ACORD 25 format.
 * Supports multiple insurance types: General Liability, Professional Indemnity, D&O.
 */

import type { CertificateOfInsurance } from './coi-service.js';

// =============================================================================
// Template Types
// =============================================================================

export type CoiTemplateType =
  | 'standard'
  | 'acord_25'
  | 'acord_25_uk'
  | 'simple';

export interface CoiTemplateSection {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  border?: boolean;
  background?: string;
}

export interface CoiCoverageRow {
  typeOfInsurance: string;
  addlInsd: boolean;
  subrWvd: boolean;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  limits: string[];
}

export interface CoiTemplateData {
  // Header
  certificateNumber: string;
  revisionDate: string;

  // Producer (Broker)
  producerName: string;
  producerContact: string;
  producerAddress: string;
  producerPhone: string;
  producerFax?: string;
  producerEmail: string;

  // Insured
  insuredName: string;
  insuredAddress: string;

  // Insurer(s)
  insurers: Array<{
    letter: string; // A, B, C, D, E, F
    name: string;
    naic?: string;
  }>;

  // Coverages
  coverages: {
    generalLiability?: {
      enabled: boolean;
      claimsMade: boolean;
      occurrence: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      additionalInsured: boolean;
      subrogationWaived: boolean;
      limits: {
        eachOccurrence: string;
        damageToRentedPremises: string;
        medicalExpense: string;
        personalAndAdvInjury: string;
        generalAggregate: string;
        productsCompOpAgg: string;
      };
    };
    automobile?: {
      enabled: boolean;
      anyAuto: boolean;
      ownedAutos: boolean;
      hiredAutos: boolean;
      nonOwnedAutos: boolean;
      scheduledAutos: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      limits: {
        combinedSingleLimit: string;
        bodilyInjuryPerPerson: string;
        bodilyInjuryPerAccident: string;
        propertyDamage: string;
      };
    };
    umbrellaExcess?: {
      enabled: boolean;
      umbrella: boolean;
      excess: boolean;
      claimsMade: boolean;
      occurrence: boolean;
      deductible: boolean;
      retention: string;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      limits: {
        eachOccurrence: string;
        aggregate: string;
      };
    };
    workersCompensation?: {
      enabled: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      statutoryLimits: boolean;
      otherLimits?: string;
      limits: {
        elEachAccident: string;
        elDiseaseEaEmployee: string;
        elDiseasePolicyLimit: string;
      };
    };
    professionalIndemnity?: {
      enabled: boolean;
      claimsMade: boolean;
      occurrence: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      retroactiveDate?: string;
      limits: {
        perClaim: string;
        aggregate: string;
        deductible: string;
      };
    };
    directorsOfficers?: {
      enabled: boolean;
      claimsMade: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      limits: {
        aggregateLimit: string;
        retention: string;
      };
    };
    employersLiability?: {
      enabled: boolean;
      insurerLetter: string;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      limits: {
        anyOneEvent: string;
        aggregate: string;
      };
    };
  };

  // Certificate Holder
  certificateHolderName: string;
  certificateHolderAddress: string;

  // Description
  descriptionOfOperations: string;

  // Cancellation
  cancellationDays: number;

  // Authorized Representative
  authorizedRepresentative?: string;
  signatureDate: string;
}

// =============================================================================
// Template Layout Configuration (ACORD 25 Style)
// =============================================================================

export const ACORD_25_LAYOUT = {
  pageWidth: 612, // Letter size in points (8.5 inches)
  pageHeight: 792, // Letter size in points (11 inches)
  margin: 36, // 0.5 inch margins

  sections: {
    header: {
      y: 756,
      height: 40,
    },
    producer: {
      x: 36,
      y: 716,
      width: 270,
      height: 80,
    },
    contact: {
      x: 306,
      y: 716,
      width: 270,
      height: 40,
    },
    insurers: {
      x: 306,
      y: 676,
      width: 270,
      height: 40,
    },
    insured: {
      x: 36,
      y: 636,
      width: 270,
      height: 80,
    },
    coverageTable: {
      x: 36,
      y: 320,
      width: 540,
      height: 316,
    },
    description: {
      x: 36,
      y: 200,
      width: 540,
      height: 120,
    },
    certificateHolder: {
      x: 36,
      y: 80,
      width: 350,
      height: 120,
    },
    cancellation: {
      x: 386,
      y: 80,
      width: 190,
      height: 120,
    },
    footer: {
      y: 36,
      height: 44,
    },
  },

  fonts: {
    title: { size: 14, weight: 'bold' as const },
    sectionHeader: { size: 9, weight: 'bold' as const },
    body: { size: 8, weight: 'normal' as const },
    small: { size: 7, weight: 'normal' as const },
  },
};

// =============================================================================
// UK-Specific Layout (Modified ACORD 25 for UK market)
// =============================================================================

export const ACORD_25_UK_LAYOUT = {
  ...ACORD_25_LAYOUT,
  pageWidth: 595, // A4 width in points
  pageHeight: 842, // A4 height in points

  sections: {
    ...ACORD_25_LAYOUT.sections,
    // Adjusted for A4 proportions
    producer: {
      x: 36,
      y: 796,
      width: 261,
      height: 80,
    },
    contact: {
      x: 297,
      y: 796,
      width: 262,
      height: 40,
    },
    insurers: {
      x: 297,
      y: 756,
      width: 262,
      height: 40,
    },
    insured: {
      x: 36,
      y: 716,
      width: 261,
      height: 80,
    },
    coverageTable: {
      x: 36,
      y: 380,
      width: 523,
      height: 336,
    },
    description: {
      x: 36,
      y: 240,
      width: 523,
      height: 140,
    },
    certificateHolder: {
      x: 36,
      y: 100,
      width: 340,
      height: 140,
    },
    cancellation: {
      x: 376,
      y: 100,
      width: 183,
      height: 140,
    },
    footer: {
      y: 36,
      height: 64,
    },
  },
};

// =============================================================================
// Template Functions
// =============================================================================

/**
 * Convert CertificateOfInsurance to ACORD 25 template data
 */
export function mapCertificateToAcordTemplate(
  certificate: CertificateOfInsurance,
  options: {
    producerAddress?: string;
    insuredAddress?: string;
    certificateHolderAddress?: string;
  } = {}
): CoiTemplateData {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatMoney = (amount: string): string => {
    // Already formatted from coi-service
    return amount;
  };

  // Determine coverage type based on policy type
  const coverages: CoiTemplateData['coverages'] = {};
  const policyType = certificate.policyType.toLowerCase();

  if (policyType.includes('public') || policyType.includes('general')) {
    coverages.generalLiability = {
      enabled: true,
      claimsMade: false,
      occurrence: true,
      insurerLetter: 'A',
      policyNumber: certificate.policyNumber,
      effectiveDate: formatDate(certificate.effectiveDate),
      expirationDate: formatDate(certificate.expirationDate),
      additionalInsured: (certificate.additionalInsureds?.length ?? 0) > 0,
      subrogationWaived: false,
      limits: mapCoveragesToGeneralLiabilityLimits(certificate.coverages),
    };
  }

  if (policyType.includes('professional') || policyType.includes('indemnity')) {
    coverages.professionalIndemnity = {
      enabled: true,
      claimsMade: true,
      occurrence: false,
      insurerLetter: 'A',
      policyNumber: certificate.policyNumber,
      effectiveDate: formatDate(certificate.effectiveDate),
      expirationDate: formatDate(certificate.expirationDate),
      limits: mapCoveragesToProfessionalIndemnityLimits(certificate.coverages),
    };
  }

  if (policyType.includes('director') || policyType.includes('officer') || policyType.includes('d&o')) {
    coverages.directorsOfficers = {
      enabled: true,
      claimsMade: true,
      insurerLetter: 'A',
      policyNumber: certificate.policyNumber,
      effectiveDate: formatDate(certificate.effectiveDate),
      expirationDate: formatDate(certificate.expirationDate),
      limits: mapCoveragesToDOLimits(certificate.coverages),
    };
  }

  if (policyType.includes('employer')) {
    coverages.employersLiability = {
      enabled: true,
      insurerLetter: 'A',
      policyNumber: certificate.policyNumber,
      effectiveDate: formatDate(certificate.effectiveDate),
      expirationDate: formatDate(certificate.expirationDate),
      limits: mapCoveragesToEmployersLiabilityLimits(certificate.coverages),
    };
  }

  // Build description of operations
  let description = `Certificate of Insurance for ${certificate.insured.name}.\n`;
  if (certificate.additionalInsureds?.length) {
    description += `\nAdditional Insureds:\n`;
    certificate.additionalInsureds.forEach((ai) => {
      description += `- ${ai.name} (${ai.relationship})\n`;
    });
  }
  if (certificate.remarks) {
    description += `\nRemarks: ${certificate.remarks}`;
  }

  return {
    certificateNumber: certificate.certificateNumber,
    revisionDate: formatDate(certificate.issuedAt),

    producerName: certificate.broker?.name || 'Direct',
    producerContact: certificate.broker?.name || 'Insurance Department',
    producerAddress: options.producerAddress || '',
    producerPhone: '',
    producerEmail: certificate.broker?.contactEmail || '',

    insuredName: certificate.insured.name,
    insuredAddress: options.insuredAddress || certificate.insured.address || '',

    insurers: [
      {
        letter: 'A',
        name: certificate.insurer.name,
      },
    ],

    coverages,

    certificateHolderName: certificate.holder?.name || '',
    certificateHolderAddress:
      options.certificateHolderAddress || certificate.holder?.address || '',

    descriptionOfOperations: description,

    cancellationDays: certificate.cancellationNoticeDays,

    signatureDate: formatDate(certificate.issuedAt),
    authorizedRepresentative: certificate.issuedBy,
  };
}

// =============================================================================
// Coverage Mapping Helpers
// =============================================================================

function mapCoveragesToGeneralLiabilityLimits(
  coverages: CertificateOfInsurance['coverages']
): CoiTemplateData['coverages']['generalLiability']['limits'] {
  const findLimit = (keywords: string[]): string => {
    for (const cov of coverages) {
      const covLower = cov.type.toLowerCase();
      if (keywords.some((k) => covLower.includes(k))) {
        return cov.limit;
      }
    }
    return 'N/A';
  };

  // Get the first/main coverage as occurrence limit
  const mainCoverage = coverages[0];

  return {
    eachOccurrence: mainCoverage?.limit || 'N/A',
    damageToRentedPremises: findLimit(['property', 'premises', 'damage']),
    medicalExpense: findLimit(['medical']),
    personalAndAdvInjury: findLimit(['personal', 'injury']),
    generalAggregate: findLimit(['aggregate']),
    productsCompOpAgg: findLimit(['product', 'completed']),
  };
}

function mapCoveragesToProfessionalIndemnityLimits(
  coverages: CertificateOfInsurance['coverages']
): CoiTemplateData['coverages']['professionalIndemnity']['limits'] {
  const mainCoverage = coverages[0];
  const aggregateCoverage = coverages.find((c) =>
    c.type.toLowerCase().includes('aggregate')
  );

  return {
    perClaim: mainCoverage?.limit || 'N/A',
    aggregate: aggregateCoverage?.limit || mainCoverage?.limit || 'N/A',
    deductible: mainCoverage?.deductible || 'N/A',
  };
}

function mapCoveragesToDOLimits(
  coverages: CertificateOfInsurance['coverages']
): CoiTemplateData['coverages']['directorsOfficers']['limits'] {
  const mainCoverage = coverages[0];

  return {
    aggregateLimit: mainCoverage?.limit || 'N/A',
    retention: mainCoverage?.deductible || 'N/A',
  };
}

function mapCoveragesToEmployersLiabilityLimits(
  coverages: CertificateOfInsurance['coverages']
): CoiTemplateData['coverages']['employersLiability']['limits'] {
  const mainCoverage = coverages[0];
  const aggregateCoverage = coverages.find((c) =>
    c.type.toLowerCase().includes('aggregate')
  );

  return {
    anyOneEvent: mainCoverage?.limit || 'N/A',
    aggregate: aggregateCoverage?.limit || mainCoverage?.limit || 'N/A',
  };
}

// =============================================================================
// Template Selection
// =============================================================================

export function getTemplateLayout(templateType: CoiTemplateType) {
  switch (templateType) {
    case 'acord_25_uk':
      return ACORD_25_UK_LAYOUT;
    case 'acord_25':
    case 'standard':
    default:
      return ACORD_25_LAYOUT;
  }
}

/**
 * Get recommended template type based on policy characteristics
 */
export function getRecommendedTemplateType(
  policyType: string,
  territorialLimits?: string[]
): CoiTemplateType {
  // Check if UK-based
  const isUk =
    territorialLimits?.includes('GB') ||
    territorialLimits?.includes('UK') ||
    territorialLimits?.some((t) => t.toLowerCase().includes('united kingdom'));

  if (isUk) {
    return 'acord_25_uk';
  }

  return 'acord_25';
}

// =============================================================================
// Export template constants
// =============================================================================

export const COVERAGE_TYPE_LABELS = {
  generalLiability: 'COMMERCIAL GENERAL LIABILITY',
  automobile: 'AUTOMOBILE LIABILITY',
  umbrellaExcess: 'UMBRELLA LIAB / EXCESS LIAB',
  workersCompensation: "WORKERS COMPENSATION AND EMPLOYERS' LIABILITY",
  professionalIndemnity: 'PROFESSIONAL INDEMNITY',
  directorsOfficers: 'DIRECTORS & OFFICERS LIABILITY',
  employersLiability: "EMPLOYERS' LIABILITY",
  cyber: 'CYBER LIABILITY',
  property: 'PROPERTY',
} as const;

export const LIMIT_TYPE_LABELS = {
  eachOccurrence: 'EACH OCCURRENCE',
  generalAggregate: 'GENERAL AGGREGATE',
  productsCompOpAgg: 'PRODUCTS - COMP/OP AGG',
  personalAndAdvInjury: 'PERSONAL & ADV INJURY',
  damageToRentedPremises: 'DAMAGE TO RENTED PREMISES',
  medicalExpense: 'MED EXP (Any one person)',
  combinedSingleLimit: 'COMBINED SINGLE LIMIT',
  bodilyInjuryPerPerson: 'BODILY INJURY (Per person)',
  bodilyInjuryPerAccident: 'BODILY INJURY (Per accident)',
  propertyDamage: 'PROPERTY DAMAGE',
  perClaim: 'PER CLAIM',
  aggregate: 'AGGREGATE',
  anyOneEvent: 'ANY ONE EVENT',
  retention: 'RETENTION',
} as const;
