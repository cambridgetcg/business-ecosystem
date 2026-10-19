/**
 * Compliance rules that hold without stored records: the Corporate
 * Transparency Act large-operating-company exemption, the compliance score's
 * weighting, and the validation the BOI and obligation schemas enforce.
 */
import { describe, expect, it } from 'vitest';
import {
  BeneficialOwnerInfoSchema,
  ComplianceObligationSchema,
  ComplianceService,
  CreateObligationInputSchema,
} from '../src/index.js';

const ENTITY = '7b0e1c52-55a4-4f7e-9d2b-3c1f0e6a8d11';
const REQUIREMENT = '0f6c2c3e-2b1d-4a59-9e57-1a3b4c5d6e7f';

describe('ComplianceService.checkCTARequirement', () => {
  const service = new ComplianceService();

  it('exempts a large operating company: over 20 employees, over $5M revenue, US presence', async () => {
    const result = await service.checkCTARequirement(ENTITY, 'corporation', 21, 5_000_001, true);
    expect(result.required).toBe(false);
    expect(result.exemptionReason).toMatch(/Large operating company/);
    expect(result.deadline).toBeUndefined();
  });

  it.each([
    ['exactly 20 employees', 20, 6_000_000, true],
    ['exactly $5M revenue', 50, 5_000_000, true],
    ['no US presence', 50, 6_000_000, false],
  ])('requires a filing with %s', async (_case, employees, revenue, usPresence) => {
    const result = await service.checkCTARequirement(
      ENTITY,
      'corporation',
      employees,
      revenue,
      usPresence
    );
    expect(result.required).toBe(true);
    // A required filing comes with a deadline; its date is a constant in the code.
    expect(result.deadline).toBeInstanceOf(Date);
  });
});

describe('ComplianceService.calculateComplianceScore', () => {
  it('weights obligations 40%, findings 40% and BOI 20%, so no BOI filing caps it at 80', async () => {
    const score = await new ComplianceService().calculateComplianceScore(ENTITY);
    expect(score).toEqual({
      score: 80,
      breakdown: { obligationsOnTime: 100, findingsResolved: 100, boiCompliant: false },
    });
  });

  it('reports no BOI filing as neither active nor compliant', async () => {
    expect(await new ComplianceService().getBOIFilingStatus(ENTITY)).toEqual({
      hasActiveFiling: false,
      isCompliant: false,
    });
  });
});

describe('compliance schemas', () => {
  const owner = {
    id: '3d6f0a8b-1c2e-4f5a-8b9c-0d1e2f3a4b5c',
    legalName: 'Ada Lovelace',
    dateOfBirth: new Date('1990-12-10'),
    residentialAddress: {
      street1: '1 High Street',
      city: 'Cambridge',
      state: 'Cambridgeshire',
      postalCode: 'CB1 1AA',
      country: 'GB',
    },
    identificationDocument: {
      type: 'passport',
      number: '123456789',
      issuingJurisdiction: 'GB',
    },
    ownershipPercentage: 25,
    controlType: 'ownership',
  };

  it('accepts a beneficial owner and defaults isCompanyApplicant to false', () => {
    const parsed = BeneficialOwnerInfoSchema.parse(owner);
    expect(parsed.isCompanyApplicant).toBe(false);
  });

  it.each([
    ['an ownership share above 100%', { ownershipPercentage: 100.5 }],
    [
      'a three-letter country code',
      { residentialAddress: { ...owner.residentialAddress, country: 'GBR' } },
    ],
    [
      'an unknown identification document',
      {
        identificationDocument: { ...owner.identificationDocument, type: 'library_card' },
      },
    ],
  ])('rejects a beneficial owner with %s', (_case, change) => {
    expect(BeneficialOwnerInfoSchema.safeParse({ ...owner, ...change }).success).toBe(false);
  });

  it('requires uuids and a non-empty title on a new obligation', () => {
    const input = {
      entityId: ENTITY,
      requirementId: REQUIREMENT,
      title: 'File BOI report',
      dueDate: new Date(),
    };
    expect(CreateObligationInputSchema.safeParse(input).success).toBe(true);
    expect(CreateObligationInputSchema.safeParse({ ...input, title: '' }).success).toBe(false);
    expect(CreateObligationInputSchema.safeParse({ ...input, entityId: 'entity-1' }).success).toBe(
      false
    );
  });

  it('defaults reminder and escalation flags and needs a positive version', () => {
    const now = new Date();
    const obligation = {
      id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
      entityId: ENTITY,
      requirementId: REQUIREMENT,
      regulator: 'fincen',
      category: 'cta',
      title: 'Initial BOI report',
      status: 'pending',
      dueDate: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    expect(ComplianceObligationSchema.parse(obligation)).toMatchObject({
      reminderSent: false,
      escalated: false,
    });
    expect(ComplianceObligationSchema.safeParse({ ...obligation, version: 0 }).success).toBe(false);
  });
});
