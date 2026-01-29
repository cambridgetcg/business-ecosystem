import { Jurisdiction } from './jurisdiction.js';

/**
 * Legal Entity Types
 */
export type EntityType =
  | 'corporation'        // C-Corp, S-Corp
  | 'llc'               // Limited Liability Company
  | 'lp'                // Limited Partnership
  | 'llp'               // Limited Liability Partnership
  | 'gp'                // General Partnership
  | 'sole_proprietorship'
  | 'trust'
  | 'nonprofit'
  | 'cooperative'
  | 'branch'            // Foreign branch
  | 'representative_office';

/**
 * Entity Status
 */
export type EntityStatus =
  | 'active'
  | 'inactive'
  | 'dissolved'
  | 'merged'
  | 'converted'
  | 'suspended'
  | 'pending_formation';

/**
 * Entity Reference - lightweight reference to a legal entity
 * Used when domains need to reference an entity without full details
 */
export interface EntityReference {
  readonly entityId: string;
  readonly entityName: string;
  readonly entityType: EntityType;
  readonly formationJurisdiction: Jurisdiction;
  readonly status: EntityStatus;
}

/**
 * Extended Entity Reference with tax identifiers
 * Used when tax context is needed
 */
export interface EntityReferenceWithTaxIds extends EntityReference {
  readonly taxIds: TaxIdentifier[];
}

/**
 * Tax Identifier
 */
export interface TaxIdentifier {
  readonly type: TaxIdType;
  readonly value: string;
  readonly jurisdiction: Jurisdiction;
  readonly issuedDate?: string; // ISO date
}

export type TaxIdType =
  | 'ein'           // US Employer Identification Number
  | 'ssn'           // US Social Security Number (sole props)
  | 'itin'          // US Individual Taxpayer Identification Number
  | 'vat'           // VAT Registration Number
  | 'gst'           // GST Registration Number
  | 'corporate_tax' // Generic corporate tax ID
  | 'state_tax'     // State-specific tax ID
  | 'local_tax';    // Local tax ID

/**
 * Ownership relationship between entities
 */
export interface OwnershipRelationship {
  readonly parentEntityId: string;
  readonly childEntityId: string;
  readonly ownershipPercentage: string; // Decimal as string (0-100)
  readonly votingPercentage?: string;   // May differ from ownership
  readonly effectiveDate: string;       // ISO date
  readonly ownershipType: 'direct' | 'indirect' | 'attributed';
}

/**
 * Entity hierarchy node for organizational structure
 */
export interface EntityHierarchyNode {
  readonly entity: EntityReference;
  readonly ownershipPercentage?: string;
  readonly votingPercentage?: string;
  readonly children: EntityHierarchyNode[];
}

/**
 * Create an entity reference
 */
export function createEntityReference(
  entityId: string,
  entityName: string,
  entityType: EntityType,
  formationJurisdiction: Jurisdiction,
  status: EntityStatus = 'active'
): EntityReference {
  return {
    entityId,
    entityName,
    entityType,
    formationJurisdiction,
    status,
  };
}

/**
 * Check if entity is a pass-through for US tax purposes
 */
export function isPassThroughEntity(entityType: EntityType): boolean {
  return ['llc', 'lp', 'llp', 'gp', 'sole_proprietorship'].includes(entityType);
}

/**
 * Check if entity type is subject to veil piercing risk
 *
 * Research insight: SMLLCs have higher veil piercing risk due to
 * single-member structure and tendency to ignore formalities
 */
export function hasVeilPiercingRisk(entityType: EntityType): boolean {
  return ['llc', 'corporation'].includes(entityType);
}
