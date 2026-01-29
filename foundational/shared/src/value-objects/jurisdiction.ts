/**
 * ISO 3166-1 alpha-2 Country Codes (common subset)
 */
export type CountryCode =
  | 'US' | 'GB' | 'DE' | 'FR' | 'JP' | 'CN' | 'CA' | 'AU'
  | 'CH' | 'SG' | 'HK' | 'IE' | 'NL' | 'LU' | 'KY' | 'BM'
  | 'VG' | 'JE' | 'GG' | 'IM' | 'MX' | 'BR' | 'IN' | 'KR';

/**
 * US State Codes (ISO 3166-2:US)
 */
export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC' | 'PR' | 'VI';

/**
 * Basic Jurisdiction - a location with country and optional subdivision
 *
 * Research insight: Jurisdiction is FOUR-DIMENSIONAL
 * - Formation: Where entity was legally created
 * - Qualification: Where entity is authorized to do business
 * - Nexus: Where entity has tax presence
 * - Regulatory: Where entity is subject to regulation
 */
export interface Jurisdiction {
  readonly country: CountryCode;
  readonly subdivision?: string; // ISO 3166-2 subdivision code (e.g., 'US-DE', 'US-CA')
  readonly locality?: string;    // City or local jurisdiction
}

/**
 * Foreign Qualification - authorization to do business in a jurisdiction
 * other than formation jurisdiction
 */
export interface ForeignQualification {
  readonly jurisdiction: Jurisdiction;
  readonly qualificationDate: string; // ISO date
  readonly status: 'active' | 'withdrawn' | 'revoked' | 'pending';
  readonly registrationNumber?: string;
  readonly annualReportDueDate?: string; // ISO date
}

/**
 * Tax Nexus - presence creating tax obligations in a jurisdiction
 *
 * Research insight: Nexus can arise from physical presence, economic activity,
 * factor presence, or affiliations - independent of qualification status
 */
export interface TaxNexus {
  readonly jurisdiction: Jurisdiction;
  readonly nexusType: 'physical' | 'economic' | 'factor' | 'affiliate' | 'voluntary';
  readonly effectiveDate: string; // ISO date
  readonly taxTypes: TaxType[];
  readonly thresholdMet?: {
    sales?: string;     // Decimal as string
    transactions?: number;
    property?: string;  // Decimal as string
    payroll?: string;   // Decimal as string
  };
}

export type TaxType =
  | 'income'
  | 'franchise'
  | 'sales'
  | 'use'
  | 'payroll'
  | 'property'
  | 'vat'
  | 'withholding';

/**
 * Regulatory Jurisdiction - where entity is subject to specific regulations
 * independent of formation or qualification
 */
export interface RegulatoryJurisdiction {
  readonly jurisdiction: Jurisdiction;
  readonly regulatoryBodies: string[]; // e.g., ['SEC', 'FINRA'] or ['FCA']
  readonly registrations: RegulatoryRegistration[];
}

export interface RegulatoryRegistration {
  readonly body: string;
  readonly registrationType: string;
  readonly registrationNumber?: string;
  readonly effectiveDate: string; // ISO date
  readonly status: 'active' | 'pending' | 'suspended' | 'revoked';
}

/**
 * Complete Jurisdiction Context for an entity
 * Captures all four dimensions of jurisdiction
 */
export interface JurisdictionContext {
  readonly formation: Jurisdiction;
  readonly qualifications: ForeignQualification[];
  readonly taxNexus: TaxNexus[];
  readonly regulatory: RegulatoryJurisdiction[];
}

/**
 * Create a basic jurisdiction
 */
export function createJurisdiction(
  country: CountryCode,
  subdivision?: string,
  locality?: string
): Jurisdiction {
  return { country, subdivision, locality };
}

/**
 * Create a US jurisdiction with state
 */
export function createUSJurisdiction(state: USStateCode, locality?: string): Jurisdiction {
  return {
    country: 'US',
    subdivision: `US-${state}`,
    locality,
  };
}

/**
 * Check if two jurisdictions are the same
 */
export function jurisdictionsEqual(a: Jurisdiction, b: Jurisdiction): boolean {
  return (
    a.country === b.country &&
    a.subdivision === b.subdivision &&
    a.locality === b.locality
  );
}

/**
 * Get display name for a jurisdiction
 */
export function jurisdictionDisplayName(j: Jurisdiction): string {
  const parts: string[] = [];
  if (j.locality) parts.push(j.locality);
  if (j.subdivision) parts.push(j.subdivision.split('-')[1] || j.subdivision);
  parts.push(j.country);
  return parts.join(', ');
}
