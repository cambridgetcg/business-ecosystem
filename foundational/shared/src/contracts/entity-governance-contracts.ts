import {
  EntityReference,
  EntityType,
  EntityStatus,
  Jurisdiction,
  JurisdictionContext,
  TaxIdentifier,
  OwnershipRelationship,
  EntityHierarchyNode,
} from '../value-objects/index.js';

/**
 * Entity Governance Query Contracts
 *
 * These interfaces define what other domains can query from Entity Governance.
 * Entity Governance is the single source of truth for legal entity data.
 */

// ============================================================
// Entity Queries
// ============================================================

/**
 * Get basic entity reference by ID
 * Used by: All domains when they need entity context
 */
export interface GetEntityReferenceQuery {
  entityId: string;
}

export interface GetEntityReferenceResult {
  entity: EntityReference | null;
}

/**
 * Get entity with full jurisdiction context
 * Used by: Tax (for nexus), Compliance (for regulatory), Banking (for account opening)
 */
export interface GetEntityJurisdictionContextQuery {
  entityId: string;
}

export interface GetEntityJurisdictionContextResult {
  entity: EntityReference | null;
  jurisdictionContext: JurisdictionContext | null;
}

/**
 * Get entity with tax identifiers
 * Used by: Tax, Banking, Compliance
 */
export interface GetEntityWithTaxIdsQuery {
  entityId: string;
}

export interface GetEntityWithTaxIdsResult {
  entity: EntityReference | null;
  taxIds: TaxIdentifier[];
}

/**
 * List entities by status
 */
export interface ListEntitiesByStatusQuery {
  status: EntityStatus;
  limit?: number;
  offset?: number;
}

export interface ListEntitiesByStatusResult {
  entities: EntityReference[];
  total: number;
}

/**
 * List entities by type
 */
export interface ListEntitiesByTypeQuery {
  entityType: EntityType;
  status?: EntityStatus;
  limit?: number;
  offset?: number;
}

export interface ListEntitiesByTypeResult {
  entities: EntityReference[];
  total: number;
}

// ============================================================
// Ownership & Hierarchy Queries
// ============================================================

/**
 * Get ownership relationships for an entity
 * Used by: Tax (for CFC determination), Accounting (for consolidation)
 */
export interface GetOwnershipRelationshipsQuery {
  entityId: string;
  direction: 'parents' | 'children' | 'both';
}

export interface GetOwnershipRelationshipsResult {
  parentRelationships: OwnershipRelationship[];
  childRelationships: OwnershipRelationship[];
}

/**
 * Get full entity hierarchy
 * Used by: Tax (for controlled group analysis), Reporting
 */
export interface GetEntityHierarchyQuery {
  rootEntityId: string;
  maxDepth?: number;
}

export interface GetEntityHierarchyResult {
  hierarchy: EntityHierarchyNode | null;
}

/**
 * Check if one entity controls another (>50% ownership)
 * Used by: Tax (for CFC), Transfer Pricing
 */
export interface CheckEntityControlQuery {
  potentialParentId: string;
  potentialSubsidiaryId: string;
}

export interface CheckEntityControlResult {
  isControlled: boolean;
  directOwnership?: string; // Decimal as string
  effectiveOwnership?: string; // Including indirect
  controlPath?: string[]; // Entity IDs in chain
}

// ============================================================
// Cap Table Queries
// ============================================================

/**
 * Get current cap table summary
 * Used by: Tax (for 409A), Accounting (for equity)
 */
export interface GetCapTableSummaryQuery {
  entityId: string;
}

export interface GetCapTableSummaryResult {
  totalSharesAuthorized: number;
  totalSharesIssued: number;
  shareClasses: ShareClassSummary[];
  lastValuationDate?: string; // ISO date
  lastValuationAmount?: string; // Decimal as string
  is409ARequired: boolean;
  next409ADeadline?: string; // ISO date
}

export interface ShareClassSummary {
  className: string;
  classType: 'common' | 'preferred' | 'convertible';
  sharesAuthorized: number;
  sharesIssued: number;
  sharesOutstanding: number;
  parValue?: string; // Decimal as string
  liquidationPreference?: string; // Decimal as string
}

// ============================================================
// Governance Queries
// ============================================================

/**
 * Get current officers and directors
 * Used by: Banking (for signatories), Compliance (for BOI)
 */
export interface GetOfficersAndDirectorsQuery {
  entityId: string;
}

export interface GetOfficersAndDirectorsResult {
  officers: OfficerRecord[];
  directors: DirectorRecord[];
}

export interface OfficerRecord {
  personId: string;
  name: string;
  title: string;
  appointmentDate: string; // ISO date
  isSignatory: boolean;
}

export interface DirectorRecord {
  personId: string;
  name: string;
  appointmentDate: string; // ISO date
  committees: string[];
  isIndependent: boolean;
}

/**
 * Get beneficial owners (for CTA compliance)
 * Used by: Compliance, Banking (for KYC)
 */
export interface GetBeneficialOwnersQuery {
  entityId: string;
}

export interface GetBeneficialOwnersResult {
  beneficialOwners: BeneficialOwnerRecord[];
  ctaFilingRequired: boolean;
  lastFilingDate?: string; // ISO date
  nextFilingDeadline?: string; // ISO date
}

export interface BeneficialOwnerRecord {
  personId: string;
  name: string;
  ownershipPercentage?: string; // Decimal as string
  controlType: 'ownership' | 'control' | 'both';
  identityVerified: boolean;
}

// ============================================================
// Veil Protection Queries
// ============================================================

/**
 * Get veil protection status
 * Used by: Compliance, Internal Audit
 */
export interface GetVeilProtectionStatusQuery {
  entityId: string;
}

export interface GetVeilProtectionStatusResult {
  entityId: string;
  entityType: EntityType;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastFormalityDate?: string; // ISO date
  daysSinceLastFormality: number;
  missingFormalities: string[];
  recommendations: string[];
  separateBooksConfirmed: boolean;
  separateBankAccountConfirmed: boolean;
}

// ============================================================
// Service Interface
// ============================================================

/**
 * Entity Governance Service Interface
 * Implemented by Entity Governance, consumed by other domains
 */
export interface IEntityGovernanceService {
  // Entity queries
  getEntityReference(query: GetEntityReferenceQuery): Promise<GetEntityReferenceResult>;
  getEntityJurisdictionContext(query: GetEntityJurisdictionContextQuery): Promise<GetEntityJurisdictionContextResult>;
  getEntityWithTaxIds(query: GetEntityWithTaxIdsQuery): Promise<GetEntityWithTaxIdsResult>;
  listEntitiesByStatus(query: ListEntitiesByStatusQuery): Promise<ListEntitiesByStatusResult>;
  listEntitiesByType(query: ListEntitiesByTypeQuery): Promise<ListEntitiesByTypeResult>;

  // Ownership queries
  getOwnershipRelationships(query: GetOwnershipRelationshipsQuery): Promise<GetOwnershipRelationshipsResult>;
  getEntityHierarchy(query: GetEntityHierarchyQuery): Promise<GetEntityHierarchyResult>;
  checkEntityControl(query: CheckEntityControlQuery): Promise<CheckEntityControlResult>;

  // Cap table queries
  getCapTableSummary(query: GetCapTableSummaryQuery): Promise<GetCapTableSummaryResult>;

  // Governance queries
  getOfficersAndDirectors(query: GetOfficersAndDirectorsQuery): Promise<GetOfficersAndDirectorsResult>;
  getBeneficialOwners(query: GetBeneficialOwnersQuery): Promise<GetBeneficialOwnersResult>;

  // Veil protection
  getVeilProtectionStatus(query: GetVeilProtectionStatusQuery): Promise<GetVeilProtectionStatusResult>;
}
