/**
 * Certificate of Insurance (CoI) PDF Generator
 *
 * Generates professional PDF certificates using pdf-lib.
 * Supports ACORD 25 format and UK-specific layouts.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import type { CertificateOfInsurance } from './coi-service.js';
import {
  type CoiTemplateType,
  type CoiTemplateData,
  getTemplateLayout,
  mapCertificateToAcordTemplate,
  COVERAGE_TYPE_LABELS,
  LIMIT_TYPE_LABELS,
} from './coi-templates.js';

// =============================================================================
// Types
// =============================================================================

export interface CoiGeneratorOptions {
  templateType?: CoiTemplateType;
  includeWatermark?: boolean;
  watermarkText?: string;
  producerAddress?: string;
  insuredAddress?: string;
  certificateHolderAddress?: string;
  companyLogo?: Uint8Array; // PNG or JPEG bytes
}

export interface GeneratedCertificatePdf {
  pdfBytes: Uint8Array;
  pdfBase64: string;
  certificateNumber: string;
  generatedAt: Date;
  templateType: CoiTemplateType;
  pageCount: number;
}

// =============================================================================
// Color Definitions
// =============================================================================

const COLORS = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  darkBlue: rgb(0.1, 0.2, 0.4),
  lightGray: rgb(0.9, 0.9, 0.9),
  mediumGray: rgb(0.6, 0.6, 0.6),
  headerBg: rgb(0.17, 0.32, 0.51),
  tableBorder: rgb(0.7, 0.7, 0.7),
  checkboxFill: rgb(0.2, 0.2, 0.2),
};

// =============================================================================
// CoI Generator Class
// =============================================================================

export class CoiGenerator {
  private fonts: {
    regular: PDFFont;
    bold: PDFFont;
  } | null = null;

  /**
   * Generate a PDF Certificate of Insurance
   */
  async generateCertificate(
    certificate: CertificateOfInsurance,
    options: CoiGeneratorOptions = {}
  ): Promise<GeneratedCertificatePdf> {
    const templateType = options.templateType || 'acord_25';
    const layout = getTemplateLayout(templateType);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.fonts = { regular: regularFont, bold: boldFont };

    // Add page with appropriate size
    const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);

    // Convert certificate to template data
    const templateData = mapCertificateToAcordTemplate(certificate, {
      producerAddress: options.producerAddress,
      insuredAddress: options.insuredAddress,
      certificateHolderAddress: options.certificateHolderAddress,
    });

    // Draw sections
    await this.drawHeader(page, layout, templateData);
    this.drawProducerSection(page, layout, templateData);
    this.drawContactSection(page, layout, templateData);
    this.drawInsurersSection(page, layout, templateData);
    this.drawInsuredSection(page, layout, templateData);
    this.drawCoverageTable(page, layout, templateData);
    this.drawDescriptionSection(page, layout, templateData);
    this.drawCertificateHolderSection(page, layout, templateData);
    this.drawCancellationSection(page, layout, templateData);
    this.drawFooter(page, layout, templateData);

    // Add watermark if requested
    if (options.includeWatermark) {
      this.drawWatermark(
        page,
        layout,
        options.watermarkText || 'COPY'
      );
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = this.bytesToBase64(pdfBytes);

    return {
      pdfBytes,
      pdfBase64,
      certificateNumber: certificate.certificateNumber,
      generatedAt: new Date(),
      templateType,
      pageCount: pdfDoc.getPageCount(),
    };
  }

  /**
   * Generate multiple certificates in batch
   */
  async generateBatch(
    certificates: CertificateOfInsurance[],
    options: CoiGeneratorOptions = {}
  ): Promise<GeneratedCertificatePdf[]> {
    const results: GeneratedCertificatePdf[] = [];

    for (const certificate of certificates) {
      const result = await this.generateCertificate(certificate, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Merge multiple certificate PDFs into one document
   */
  async mergeCertificates(
    pdfs: Uint8Array[]
  ): Promise<{ pdfBytes: Uint8Array; pdfBase64: string; pageCount: number }> {
    const mergedDoc = await PDFDocument.create();

    for (const pdfBytes of pdfs) {
      const srcDoc = await PDFDocument.load(pdfBytes);
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach((page) => mergedDoc.addPage(page));
    }

    const pdfBytes = await mergedDoc.save();
    return {
      pdfBytes,
      pdfBase64: this.bytesToBase64(pdfBytes),
      pageCount: mergedDoc.getPageCount(),
    };
  }

  // ===========================================================================
  // Section Drawing Methods
  // ===========================================================================

  private async drawHeader(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): Promise<void> {
    const { bold } = this.fonts!;
    const section = layout.sections.header;

    // Draw title
    page.drawText('CERTIFICATE OF LIABILITY INSURANCE', {
      x: layout.pageWidth / 2 - 150,
      y: section.y,
      size: 14,
      font: bold,
      color: COLORS.darkBlue,
    });

    // Draw date and certificate number
    page.drawText(`DATE (MM/DD/YYYY)`, {
      x: layout.pageWidth - 150,
      y: section.y,
      size: 7,
      font: this.fonts!.regular,
      color: COLORS.black,
    });

    page.drawText(data.revisionDate, {
      x: layout.pageWidth - 150,
      y: section.y - 12,
      size: 8,
      font: this.fonts!.regular,
      color: COLORS.black,
    });
  }

  private drawProducerSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.producer;
    const { regular, bold } = this.fonts!;

    // Box
    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    // Header
    page.drawText('PRODUCER', {
      x: section.x + 4,
      y: section.y - 12,
      size: 8,
      font: bold,
      color: COLORS.darkBlue,
    });

    // Producer details
    const lines = [
      data.producerName,
      data.producerAddress,
      data.producerPhone ? `Phone: ${data.producerPhone}` : '',
      data.producerEmail ? `Email: ${data.producerEmail}` : '',
    ].filter(Boolean);

    lines.forEach((line, i) => {
      page.drawText(line, {
        x: section.x + 4,
        y: section.y - 26 - i * 11,
        size: 8,
        font: regular,
        color: COLORS.black,
      });
    });
  }

  private drawContactSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.contact;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('CONTACT', {
      x: section.x + 4,
      y: section.y - 12,
      size: 7,
      font: bold,
      color: COLORS.mediumGray,
    });

    page.drawText(data.producerContact, {
      x: section.x + 50,
      y: section.y - 12,
      size: 8,
      font: regular,
      color: COLORS.black,
    });

    page.drawText('PHONE', {
      x: section.x + 4,
      y: section.y - 26,
      size: 7,
      font: bold,
      color: COLORS.mediumGray,
    });

    page.drawText(data.producerPhone || 'N/A', {
      x: section.x + 50,
      y: section.y - 26,
      size: 8,
      font: regular,
      color: COLORS.black,
    });

    page.drawText('E-MAIL', {
      x: section.x + 140,
      y: section.y - 26,
      size: 7,
      font: bold,
      color: COLORS.mediumGray,
    });

    page.drawText(data.producerEmail || 'N/A', {
      x: section.x + 170,
      y: section.y - 26,
      size: 8,
      font: regular,
      color: COLORS.black,
    });
  }

  private drawInsurersSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.insurers;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('INSURER(S) AFFORDING COVERAGE', {
      x: section.x + 4,
      y: section.y - 12,
      size: 8,
      font: bold,
      color: COLORS.darkBlue,
    });

    data.insurers.forEach((insurer, i) => {
      page.drawText(`INSURER ${insurer.letter}:`, {
        x: section.x + 4,
        y: section.y - 26 - i * 11,
        size: 7,
        font: bold,
        color: COLORS.mediumGray,
      });
      page.drawText(insurer.name, {
        x: section.x + 60,
        y: section.y - 26 - i * 11,
        size: 8,
        font: regular,
        color: COLORS.black,
      });
    });
  }

  private drawInsuredSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.insured;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('INSURED', {
      x: section.x + 4,
      y: section.y - 12,
      size: 8,
      font: bold,
      color: COLORS.darkBlue,
    });

    page.drawText(data.insuredName, {
      x: section.x + 4,
      y: section.y - 28,
      size: 9,
      font: bold,
      color: COLORS.black,
    });

    if (data.insuredAddress) {
      const addressLines = this.wrapText(data.insuredAddress, 40);
      addressLines.forEach((line, i) => {
        page.drawText(line, {
          x: section.x + 4,
          y: section.y - 42 - i * 11,
          size: 8,
          font: regular,
          color: COLORS.black,
        });
      });
    }
  }

  private drawCoverageTable(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.coverageTable;
    const { regular, bold } = this.fonts!;

    // Table header
    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    // Header row background
    page.drawRectangle({
      x: section.x,
      y: section.y - 20,
      width: section.width,
      height: 20,
      color: COLORS.headerBg,
    });

    page.drawText('THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE', {
      x: section.x + 4,
      y: section.y - 14,
      size: 7,
      font: regular,
      color: COLORS.white,
    });

    // Column headers
    const colY = section.y - 35;
    const headers = [
      { text: 'TYPE OF INSURANCE', x: section.x + 4, width: 120 },
      { text: 'ADDL\nINSD', x: section.x + 130, width: 25 },
      { text: 'SUBR\nWVD', x: section.x + 158, width: 25 },
      { text: 'POLICY NUMBER', x: section.x + 188, width: 100 },
      { text: 'POLICY EFF\n(MM/DD/YYYY)', x: section.x + 293, width: 60 },
      { text: 'POLICY EXP\n(MM/DD/YYYY)', x: section.x + 358, width: 60 },
      { text: 'LIMITS', x: section.x + 423, width: 115 },
    ];

    headers.forEach((h) => {
      page.drawText(h.text.split('\n')[0], {
        x: h.x,
        y: colY,
        size: 7,
        font: bold,
        color: COLORS.darkBlue,
      });
      if (h.text.includes('\n')) {
        page.drawText(h.text.split('\n')[1], {
          x: h.x,
          y: colY - 10,
          size: 6,
          font: regular,
          color: COLORS.mediumGray,
        });
      }
    });

    // Coverage rows
    let currentY = section.y - 60;
    const rowHeight = 45;

    // General Liability
    if (data.coverages.generalLiability?.enabled) {
      currentY = this.drawCoverageRow(page, section.x, currentY, section.width, rowHeight, {
        type: COVERAGE_TYPE_LABELS.generalLiability,
        subTypes: [
          data.coverages.generalLiability.claimsMade ? '[ X ] CLAIMS-MADE' : '[   ] CLAIMS-MADE',
          data.coverages.generalLiability.occurrence ? '[ X ] OCCUR' : '[   ] OCCUR',
        ],
        additionalInsured: data.coverages.generalLiability.additionalInsured,
        subrogationWaived: data.coverages.generalLiability.subrogationWaived,
        policyNumber: data.coverages.generalLiability.policyNumber,
        effectiveDate: data.coverages.generalLiability.effectiveDate,
        expirationDate: data.coverages.generalLiability.expirationDate,
        limits: [
          { label: LIMIT_TYPE_LABELS.eachOccurrence, value: data.coverages.generalLiability.limits.eachOccurrence },
          { label: LIMIT_TYPE_LABELS.generalAggregate, value: data.coverages.generalLiability.limits.generalAggregate },
          { label: LIMIT_TYPE_LABELS.personalAndAdvInjury, value: data.coverages.generalLiability.limits.personalAndAdvInjury },
        ],
      });
    }

    // Professional Indemnity
    if (data.coverages.professionalIndemnity?.enabled) {
      currentY = this.drawCoverageRow(page, section.x, currentY, section.width, rowHeight, {
        type: COVERAGE_TYPE_LABELS.professionalIndemnity,
        subTypes: [
          data.coverages.professionalIndemnity.claimsMade ? '[ X ] CLAIMS-MADE' : '[   ] CLAIMS-MADE',
        ],
        additionalInsured: false,
        subrogationWaived: false,
        policyNumber: data.coverages.professionalIndemnity.policyNumber,
        effectiveDate: data.coverages.professionalIndemnity.effectiveDate,
        expirationDate: data.coverages.professionalIndemnity.expirationDate,
        limits: [
          { label: LIMIT_TYPE_LABELS.perClaim, value: data.coverages.professionalIndemnity.limits.perClaim },
          { label: LIMIT_TYPE_LABELS.aggregate, value: data.coverages.professionalIndemnity.limits.aggregate },
        ],
      });
    }

    // Directors & Officers
    if (data.coverages.directorsOfficers?.enabled) {
      currentY = this.drawCoverageRow(page, section.x, currentY, section.width, rowHeight, {
        type: COVERAGE_TYPE_LABELS.directorsOfficers,
        subTypes: ['[ X ] CLAIMS-MADE'],
        additionalInsured: false,
        subrogationWaived: false,
        policyNumber: data.coverages.directorsOfficers.policyNumber,
        effectiveDate: data.coverages.directorsOfficers.effectiveDate,
        expirationDate: data.coverages.directorsOfficers.expirationDate,
        limits: [
          { label: 'AGGREGATE LIMIT', value: data.coverages.directorsOfficers.limits.aggregateLimit },
          { label: LIMIT_TYPE_LABELS.retention, value: data.coverages.directorsOfficers.limits.retention },
        ],
      });
    }

    // Employers' Liability
    if (data.coverages.employersLiability?.enabled) {
      currentY = this.drawCoverageRow(page, section.x, currentY, section.width, rowHeight, {
        type: COVERAGE_TYPE_LABELS.employersLiability,
        subTypes: [],
        additionalInsured: false,
        subrogationWaived: false,
        policyNumber: data.coverages.employersLiability.policyNumber,
        effectiveDate: data.coverages.employersLiability.effectiveDate,
        expirationDate: data.coverages.employersLiability.expirationDate,
        limits: [
          { label: LIMIT_TYPE_LABELS.anyOneEvent, value: data.coverages.employersLiability.limits.anyOneEvent },
          { label: LIMIT_TYPE_LABELS.aggregate, value: data.coverages.employersLiability.limits.aggregate },
        ],
      });
    }
  }

  private drawCoverageRow(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    data: {
      type: string;
      subTypes: string[];
      additionalInsured: boolean;
      subrogationWaived: boolean;
      policyNumber: string;
      effectiveDate: string;
      expirationDate: string;
      limits: Array<{ label: string; value: string }>;
    }
  ): number {
    const { regular, bold } = this.fonts!;

    // Row border
    page.drawLine({
      start: { x, y },
      end: { x: x + width, y },
      thickness: 0.5,
      color: COLORS.tableBorder,
    });

    // Type of insurance
    page.drawText(data.type, {
      x: x + 4,
      y: y - 12,
      size: 8,
      font: bold,
      color: COLORS.black,
    });

    data.subTypes.forEach((st, i) => {
      page.drawText(st, {
        x: x + 8,
        y: y - 24 - i * 10,
        size: 7,
        font: regular,
        color: COLORS.black,
      });
    });

    // Checkboxes for ADDL INSD and SUBR WVD
    this.drawCheckbox(page, x + 135, y - 15, data.additionalInsured);
    this.drawCheckbox(page, x + 163, y - 15, data.subrogationWaived);

    // Policy number
    page.drawText(data.policyNumber, {
      x: x + 188,
      y: y - 12,
      size: 8,
      font: regular,
      color: COLORS.black,
    });

    // Dates
    page.drawText(data.effectiveDate, {
      x: x + 293,
      y: y - 12,
      size: 8,
      font: regular,
      color: COLORS.black,
    });

    page.drawText(data.expirationDate, {
      x: x + 358,
      y: y - 12,
      size: 8,
      font: regular,
      color: COLORS.black,
    });

    // Limits
    data.limits.forEach((limit, i) => {
      page.drawText(limit.label, {
        x: x + 423,
        y: y - 12 - i * 11,
        size: 6,
        font: regular,
        color: COLORS.mediumGray,
      });
      page.drawText(limit.value, {
        x: x + 490,
        y: y - 12 - i * 11,
        size: 7,
        font: regular,
        color: COLORS.black,
      });
    });

    return y - height;
  }

  private drawDescriptionSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.description;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES (ACORD 101, Additional Remarks Schedule, may be attached if more space is required)', {
      x: section.x + 4,
      y: section.y - 12,
      size: 7,
      font: bold,
      color: COLORS.darkBlue,
    });

    // Wrap and draw description text
    const lines = this.wrapText(data.descriptionOfOperations, 100);
    lines.slice(0, 8).forEach((line, i) => {
      page.drawText(line, {
        x: section.x + 4,
        y: section.y - 28 - i * 11,
        size: 8,
        font: regular,
        color: COLORS.black,
      });
    });
  }

  private drawCertificateHolderSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.certificateHolder;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('CERTIFICATE HOLDER', {
      x: section.x + 4,
      y: section.y - 12,
      size: 8,
      font: bold,
      color: COLORS.darkBlue,
    });

    if (data.certificateHolderName) {
      page.drawText(data.certificateHolderName, {
        x: section.x + 4,
        y: section.y - 30,
        size: 9,
        font: bold,
        color: COLORS.black,
      });

      if (data.certificateHolderAddress) {
        const addressLines = this.wrapText(data.certificateHolderAddress, 50);
        addressLines.forEach((line, i) => {
          page.drawText(line, {
            x: section.x + 4,
            y: section.y - 45 - i * 11,
            size: 8,
            font: regular,
            color: COLORS.black,
          });
        });
      }
    } else {
      page.drawText('N/A - Certificate issued without holder', {
        x: section.x + 4,
        y: section.y - 30,
        size: 8,
        font: regular,
        color: COLORS.mediumGray,
      });
    }
  }

  private drawCancellationSection(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const section = layout.sections.cancellation;
    const { regular, bold } = this.fonts!;

    this.drawBox(page, section.x, section.y - section.height, section.width, section.height);

    page.drawText('CANCELLATION', {
      x: section.x + 4,
      y: section.y - 12,
      size: 8,
      font: bold,
      color: COLORS.darkBlue,
    });

    const cancellationText = `SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.`;

    const lines = this.wrapText(cancellationText, 28);
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: section.x + 4,
        y: section.y - 28 - i * 10,
        size: 7,
        font: regular,
        color: COLORS.black,
      });
    });

    page.drawText(`Standard notice period: ${data.cancellationDays} days`, {
      x: section.x + 4,
      y: section.y - 80,
      size: 7,
      font: bold,
      color: COLORS.black,
    });

    // Authorized representative
    page.drawText('AUTHORIZED REPRESENTATIVE', {
      x: section.x + 4,
      y: section.y - 100,
      size: 6,
      font: bold,
      color: COLORS.mediumGray,
    });

    if (data.authorizedRepresentative) {
      page.drawText(data.authorizedRepresentative, {
        x: section.x + 4,
        y: section.y - 112,
        size: 8,
        font: regular,
        color: COLORS.black,
      });
    }

    page.drawText(`Date: ${data.signatureDate}`, {
      x: section.x + 4,
      y: section.y - 125,
      size: 7,
      font: regular,
      color: COLORS.black,
    });
  }

  private drawFooter(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    data: CoiTemplateData
  ): void {
    const { regular } = this.fonts!;
    const section = layout.sections.footer;

    // Disclaimer
    page.drawText(
      'This certificate is issued as a matter of information only and confers no rights upon the certificate holder.',
      {
        x: layout.margin,
        y: section.y + 20,
        size: 7,
        font: regular,
        color: COLORS.mediumGray,
      }
    );

    page.drawText(
      'This certificate does not affirmatively or negatively amend, extend or alter the coverage afforded by the policies below.',
      {
        x: layout.margin,
        y: section.y + 8,
        size: 7,
        font: regular,
        color: COLORS.mediumGray,
      }
    );

    // Certificate number
    page.drawText(`Certificate No: ${data.certificateNumber}`, {
      x: layout.pageWidth - 200,
      y: section.y + 8,
      size: 8,
      font: regular,
      color: COLORS.black,
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private drawBox(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { fill?: boolean } = {}
  ): void {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: COLORS.tableBorder,
      borderWidth: 0.5,
      color: options.fill ? COLORS.lightGray : undefined,
    });
  }

  private drawCheckbox(
    page: PDFPage,
    x: number,
    y: number,
    checked: boolean
  ): void {
    const size = 8;
    page.drawRectangle({
      x,
      y,
      width: size,
      height: size,
      borderColor: COLORS.black,
      borderWidth: 0.5,
    });

    if (checked) {
      page.drawText('X', {
        x: x + 1.5,
        y: y + 1,
        size: 7,
        font: this.fonts!.bold,
        color: COLORS.checkboxFill,
      });
    }
  }

  private drawWatermark(
    page: PDFPage,
    layout: ReturnType<typeof getTemplateLayout>,
    text: string
  ): void {
    const { bold } = this.fonts!;

    page.drawText(text, {
      x: layout.pageWidth / 2 - 80,
      y: layout.pageHeight / 2,
      size: 60,
      font: bold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: { type: 'degrees' as const, angle: 45 },
      opacity: 0.3,
    });
  }

  private wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// =============================================================================
// Factory
// =============================================================================

let globalCoiGenerator: CoiGenerator | null = null;

export function getCoiGenerator(): CoiGenerator {
  if (!globalCoiGenerator) {
    globalCoiGenerator = new CoiGenerator();
  }
  return globalCoiGenerator;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick function to generate a PDF certificate
 */
export async function generateCertificatePdf(
  certificate: CertificateOfInsurance,
  options?: CoiGeneratorOptions
): Promise<GeneratedCertificatePdf> {
  const generator = getCoiGenerator();
  return generator.generateCertificate(certificate, options);
}

/**
 * Generate batch of certificates
 */
export async function generateBatchCertificates(
  certificates: CertificateOfInsurance[],
  options?: CoiGeneratorOptions
): Promise<GeneratedCertificatePdf[]> {
  const generator = getCoiGenerator();
  return generator.generateBatch(certificates, options);
}
