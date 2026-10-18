/**
 * Certificate of Insurance (CoI) Service
 *
 * Generates and manages Certificates of Insurance for policies.
 * A CoI provides proof of insurance coverage to third parties.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Policy, Coverage } from '../../domain/policy/models/policy.js';

// =============================================================================
// Types
// =============================================================================

export interface CertificateOfInsurance {
  id: string;
  certificateNumber: string;
  issuedAt: Date;

  // Policy reference
  policyId: string;
  policyNumber: string;
  policyType: string;

  // Period
  effectiveDate: Date;
  expirationDate: Date;

  // Insured party
  insured: {
    name: string;
    address?: string;
    entityId: string;
  };

  // Certificate holder (who is receiving the CoI)
  holder?: {
    name: string;
    address?: string;
    relationship?: string; // e.g., "Landlord", "Client", "Contractor"
  };

  // Additional insured (if any)
  additionalInsureds?: Array<{
    name: string;
    relationship: string;
    endorsementNumber?: string;
  }>;

  // Insurer information
  insurer: {
    name: string;
    contactEmail?: string;
    contactPhone?: string;
  };

  // Broker information (if applicable)
  broker?: {
    name: string;
    reference?: string;
    contactEmail?: string;
    contactPhone?: string;
  };

  // Coverages summary
  coverages: Array<{
    type: string;
    description: string;
    limit: string;
    deductible?: string;
    subjectivity?: string;
  }>;

  // Territorial limits
  territorialLimits?: string[];

  // Special conditions/remarks
  remarks?: string;

  // Cancellation notice period (UK standard is usually 30 days)
  cancellationNoticeDays: number;

  // Issuer information
  issuedBy?: string;

  // Certificate data for rendering
  metadata?: Record<string, unknown>;
}

export interface GenerateCoiInput {
  policyId: string;
  holder?: {
    name: string;
    address?: string;
    relationship?: string;
  };
  additionalInsureds?: Array<{
    name: string;
    relationship: string;
  }>;
  remarks?: string;
  issuedBy?: string;
}

export interface CoiPdfData {
  certificate: CertificateOfInsurance;
  html: string;
}

// =============================================================================
// Service
// =============================================================================

export class CertificateOfInsuranceService {
  /**
   * Generate a Certificate of Insurance from a policy
   */
  async generateCertificate(
    policy: Policy,
    insuredName: string,
    input: Omit<GenerateCoiInput, 'policyId'>
  ): Promise<CertificateOfInsurance> {
    const id = uuidv4();
    const now = new Date();

    // Find primary insurer
    const primaryInsurer = policy.insurers.find(i => i.insurerType === 'primary')
      || policy.insurers[0];

    const certificate: CertificateOfInsurance = {
      id,
      certificateNumber: this.generateCertificateNumber(policy.policyNumber),
      issuedAt: now,

      policyId: policy.id,
      policyNumber: policy.policyNumber,
      policyType: this.formatPolicyType(policy.policyType),

      effectiveDate: policy.inceptionDate,
      expirationDate: policy.expiryDate,

      insured: {
        name: insuredName,
        entityId: policy.entityId,
      },

      holder: input.holder,
      additionalInsureds: input.additionalInsureds,

      insurer: {
        name: primaryInsurer.name,
        contactEmail: primaryInsurer.contactEmail ?? undefined,
        contactPhone: primaryInsurer.contactPhone ?? undefined,
      },

      broker: policy.brokerId ? {
        name: 'Broker', // Would normally fetch from broker service
        reference: policy.brokerReference ?? undefined,
      } : undefined,

      coverages: policy.coverages.map(c => this.formatCoverage(c)),

      territorialLimits: policy.territorialLimits ?? undefined,

      remarks: input.remarks,

      cancellationNoticeDays: 30, // UK standard

      issuedBy: input.issuedBy,
    };

    return certificate;
  }

  /**
   * Render certificate as HTML for PDF conversion
   */
  renderCertificateHtml(certificate: CertificateOfInsurance): string {
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const coverageRows = certificate.coverages.map(c => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${c.type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${c.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${c.limit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${c.deductible || 'N/A'}</td>
      </tr>
    `).join('');

    const additionalInsuredSection = certificate.additionalInsureds?.length ? `
      <div style="margin-top: 20px;">
        <h3 style="color: #1a365d; border-bottom: 2px solid #2c5282; padding-bottom: 5px;">
          Additional Insureds
        </h3>
        <ul style="list-style: none; padding: 0;">
          ${certificate.additionalInsureds.map(ai => `
            <li style="padding: 5px 0;">${ai.name} (${ai.relationship})</li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    const holderSection = certificate.holder ? `
      <div style="background: #f0f4f8; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <h3 style="color: #1a365d; margin-top: 0;">Certificate Holder</h3>
        <p style="margin: 5px 0;"><strong>${certificate.holder.name}</strong></p>
        ${certificate.holder.address ? `<p style="margin: 5px 0;">${certificate.holder.address}</p>` : ''}
        ${certificate.holder.relationship ? `<p style="margin: 5px 0; font-style: italic;">Relationship: ${certificate.holder.relationship}</p>` : ''}
      </div>
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate of Insurance - ${certificate.certificateNumber}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2c5282;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a365d;
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      color: #1a365d;
      border-bottom: 2px solid #2c5282;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .label {
      font-weight: bold;
      color: #555;
    }
    .value {
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background: #2c5282;
      color: white;
      padding: 10px 8px;
      text-align: left;
    }
    .disclaimer {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 5px;
      padding: 15px;
      margin-top: 30px;
      font-size: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CERTIFICATE OF INSURANCE</h1>
    <p>This certificate is issued as a matter of information only and confers no rights upon the certificate holder.</p>
    <p style="font-size: 14px; margin-top: 15px;">
      <strong>Certificate Number:</strong> ${certificate.certificateNumber}
    </p>
  </div>

  <div class="section">
    <h2 class="section-title">Insured Details</h2>
    <div class="grid">
      <div>
        <p class="label">Named Insured:</p>
        <p class="value">${certificate.insured.name}</p>
      </div>
      <div>
        <p class="label">Policy Number:</p>
        <p class="value">${certificate.policyNumber}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Coverage Period</h2>
    <div class="grid">
      <div>
        <p class="label">Effective Date:</p>
        <p class="value">${formatDate(certificate.effectiveDate)}</p>
      </div>
      <div>
        <p class="label">Expiration Date:</p>
        <p class="value">${formatDate(certificate.expirationDate)}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Insurance Provider</h2>
    <div class="grid">
      <div>
        <p class="label">Insurer:</p>
        <p class="value">${certificate.insurer.name}</p>
        ${certificate.insurer.contactEmail ? `<p class="value" style="font-size: 11px;">${certificate.insurer.contactEmail}</p>` : ''}
      </div>
      ${certificate.broker ? `
        <div>
          <p class="label">Broker:</p>
          <p class="value">${certificate.broker.name}</p>
          ${certificate.broker.reference ? `<p class="value" style="font-size: 11px;">Ref: ${certificate.broker.reference}</p>` : ''}
        </div>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Coverage Details - ${certificate.policyType}</h2>
    <table>
      <thead>
        <tr>
          <th>Coverage Type</th>
          <th>Description</th>
          <th style="text-align: right;">Limit</th>
          <th style="text-align: right;">Deductible</th>
        </tr>
      </thead>
      <tbody>
        ${coverageRows}
      </tbody>
    </table>
  </div>

  ${additionalInsuredSection}
  ${holderSection}

  ${certificate.territorialLimits?.length ? `
    <div class="section">
      <h2 class="section-title">Territorial Limits</h2>
      <p>${certificate.territorialLimits.join(', ')}</p>
    </div>
  ` : ''}

  ${certificate.remarks ? `
    <div class="section">
      <h2 class="section-title">Special Remarks</h2>
      <p>${certificate.remarks}</p>
    </div>
  ` : ''}

  <div class="disclaimer">
    <strong>IMPORTANT NOTICE:</strong>
    <p>This certificate does not amend, extend or alter the coverage afforded by the policies listed.
    The insurance afforded by the policies described herein is subject to all the terms, exclusions
    and conditions of such policies.</p>
    <p><strong>Cancellation:</strong> Should any of the above described policies be cancelled before
    the expiration date thereof, notice will be delivered in accordance with the policy provisions.
    Standard cancellation notice period: ${certificate.cancellationNoticeDays} days.</p>
  </div>

  <div class="footer">
    <p>
      <strong>Date Issued:</strong> ${formatDate(certificate.issuedAt)}
      ${certificate.issuedBy ? ` | <strong>Issued By:</strong> ${certificate.issuedBy}` : ''}
    </p>
    <p>This certificate was generated electronically and is valid without signature.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get certificate data with HTML for PDF conversion
   */
  async generateCertificatePdf(
    policy: Policy,
    insuredName: string,
    input: Omit<GenerateCoiInput, 'policyId'>
  ): Promise<CoiPdfData> {
    const certificate = await this.generateCertificate(policy, insuredName, input);
    const html = this.renderCertificateHtml(certificate);

    return { certificate, html };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private generateCertificateNumber(policyNumber: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `COI-${policyNumber}-${dateStr}-${random}`;
  }

  private formatPolicyType(type: string): string {
    const labels: Record<string, string> = {
      public_liability: 'Public Liability',
      employers_liability: 'Employers\' Liability',
      professional_indemnity: 'Professional Indemnity',
      directors_officers: 'Directors & Officers',
      cyber: 'Cyber Liability',
      property: 'Property',
      business_interruption: 'Business Interruption',
      motor_fleet: 'Motor Fleet',
      marine_cargo: 'Marine Cargo',
      keyman: 'Key Person',
      product_liability: 'Product Liability',
      fidelity: 'Fidelity',
      crime: 'Crime',
      environmental: 'Environmental',
      combined: 'Combined/Package',
      umbrella: 'Umbrella/Excess',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private formatCoverage(coverage: Coverage): CertificateOfInsurance['coverages'][0] {
    const formatMoney = (money: { amount: number; currency: string }) =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: money.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(money.amount);

    const limitTypes: Record<string, string> = {
      per_occurrence: 'Per Occurrence',
      per_claim: 'Per Claim',
      aggregate: 'Aggregate',
      any_one_event: 'Any One Event',
      combined_single_limit: 'Combined Single Limit',
    };

    return {
      type: coverage.name,
      description: `${limitTypes[coverage.limitType] || coverage.limitType}${coverage.basis ? ` (${coverage.basis})` : ''}`,
      limit: formatMoney(coverage.limit),
      deductible: coverage.deductible ? formatMoney(coverage.deductible) : undefined,
      subjectivity: coverage.subjectivity ?? undefined,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

let globalCoiService: CertificateOfInsuranceService | null = null;

export function getCoiService(): CertificateOfInsuranceService {
  if (!globalCoiService) {
    globalCoiService = new CertificateOfInsuranceService();
  }
  return globalCoiService;
}
