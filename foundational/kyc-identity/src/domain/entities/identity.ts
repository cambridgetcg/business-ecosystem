/**
 * Identity Entity
 * Represents a verified identity (individual or corporate)
 */

import { z } from 'zod';
import {
  IdentityType,
  identityTypeSchema,
  VerificationStatus,
  verificationStatusSchema,
  RiskLevel,
  riskLevelSchema,
  personNameSchema,
  addressSchema,
  dateOfBirthSchema,
  corporateDetailsSchema,
  beneficialOwnerSchema,
  riskAssessmentSchema,
  type PersonName,
  type Address,
  type DateOfBirth,
  type CorporateDetails,
  type BeneficialOwner,
  type RiskAssessment,
} from '../value-objects/index.js';

export const identitySchema = z.object({
  id: z.string().uuid(),
  externalId: z.string().max(255).optional(),
  tenantId: z.string().uuid(),
  
  // Type
  type: identityTypeSchema,
  
  // Individual fields
  name: personNameSchema.optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  nationality: z.string().length(2).optional(),
  taxId: z.string().max(50).optional(),
  
  // Corporate fields  
  corporateDetails: corporateDetailsSchema.optional(),
  beneficialOwners: z.array(beneficialOwnerSchema).optional(),
  
  // Contact
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: addressSchema.optional(),
  
  // Verification
  verificationStatus: verificationStatusSchema,
  verifiedAt: z.date().optional(),
  verifiedBy: z.string().optional(),
  verificationExpiresAt: z.date().optional(),
  
  // Risk
  riskLevel: riskLevelSchema.optional(),
  riskAssessment: riskAssessmentSchema.optional(),
  
  // Flags
  isPep: z.boolean().default(false),
  isSanctioned: z.boolean().default(false),
  hasAdverseMedia: z.boolean().default(false),
  
  // Metadata
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Identity = z.infer<typeof identitySchema>;

export const createIdentitySchema = identitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  verificationStatus: true,
  verifiedAt: true,
  verifiedBy: true,
}).extend({
  verificationStatus: verificationStatusSchema.optional(),
});

export type CreateIdentityInput = z.infer<typeof createIdentitySchema>;

export const updateIdentitySchema = identitySchema.partial().omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>;

// Domain logic
export class IdentityEntity {
  constructor(private readonly data: Identity) {}

  get id(): string {
    return this.data.id;
  }

  get tenantId(): string {
    return this.data.tenantId;
  }

  get type(): IdentityType {
    return this.data.type;
  }

  get verificationStatus(): VerificationStatus {
    return this.data.verificationStatus;
  }

  get riskLevel(): RiskLevel | undefined {
    return this.data.riskLevel;
  }

  get isVerified(): boolean {
    return this.data.verificationStatus === VerificationStatus.APPROVED;
  }

  get isExpired(): boolean {
    if (!this.data.verificationExpiresAt) return false;
    return new Date() > this.data.verificationExpiresAt;
  }

  get requiresEnhancedDueDiligence(): boolean {
    return (
      this.data.isPep ||
      this.data.riskLevel === RiskLevel.HIGH ||
      this.data.riskLevel === RiskLevel.VERY_HIGH
    );
  }

  get displayName(): string {
    if (this.data.type === IdentityType.INDIVIDUAL && this.data.name) {
      const { firstName, middleName, lastName } = this.data.name;
      return [firstName, middleName, lastName].filter(Boolean).join(' ');
    }
    if (this.data.corporateDetails) {
      return this.data.corporateDetails.legalName;
    }
    return this.data.id;
  }

  canBeVerified(): boolean {
    return (
      this.data.verificationStatus === VerificationStatus.PENDING ||
      this.data.verificationStatus === VerificationStatus.IN_REVIEW ||
      this.data.verificationStatus === VerificationStatus.REQUIRES_UPDATE
    );
  }

  approve(verifiedBy: string): Identity {
    if (!this.canBeVerified()) {
      throw new Error('Identity cannot be approved in current status: ' + this.data.verificationStatus);
    }
    return {
      ...this.data,
      verificationStatus: VerificationStatus.APPROVED,
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    };
  }

  reject(reason: string): Identity {
    if (!this.canBeVerified()) {
      throw new Error('Identity cannot be rejected in current status: ' + this.data.verificationStatus);
    }
    return {
      ...this.data,
      verificationStatus: VerificationStatus.REJECTED,
      updatedAt: new Date(),
      metadata: {
        ...this.data.metadata,
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
      },
    };
  }

  requestUpdate(reason: string): Identity {
    return {
      ...this.data,
      verificationStatus: VerificationStatus.REQUIRES_UPDATE,
      updatedAt: new Date(),
      metadata: {
        ...this.data.metadata,
        updateRequestReason: reason,
        updateRequestedAt: new Date().toISOString(),
      },
    };
  }

  setRiskAssessment(assessment: RiskAssessment): Identity {
    return {
      ...this.data,
      riskLevel: assessment.overallRisk,
      riskAssessment: assessment,
      updatedAt: new Date(),
    };
  }

  toJSON(): Identity {
    return { ...this.data };
  }
}
