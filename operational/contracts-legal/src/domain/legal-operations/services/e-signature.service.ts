/**
 * E-Signature Service
 * 
 * Handles signature ceremony tracking for ESIGN/UETA compliance.
 * Captures the four requirements: Intent, Consent, Association, Retention.
 */

import { PrismaClient, SignatureEvent, SignatureType, Prisma } from '@prisma/client';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

export interface CreateSignatureEventInput {
  contractPartyId: string;
  documentHash: string;
  documentVersion: number;
  signatureType: SignatureType;
  signatureData?: string | undefined;
  consentGiven: boolean;
  consentMethod: string;
  consentText: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string | undefined;
  geolocation?: string | undefined;
  ceremonyStarted: Date;
  signedAt: Date;
  providerRef?: string | undefined;
  providerName?: string | undefined;
  providerData?: Record<string, unknown> | undefined;
}

export interface SignatureEventQuery {
  contractPartyId?: string | undefined;
  providerName?: string | undefined;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
  page: number;
  limit: number;
}

export class ESignatureService {
  private log = logger.child({ service: 'e-signature' });

  constructor(private prisma: PrismaClient) {}

  /**
   * Record a signature event for ESIGN/UETA compliance
   */
  async recordSignatureEvent(input: CreateSignatureEventInput): Promise<SignatureEvent> {
    // Validate consent was given (ESIGN requirement)
    if (!input.consentGiven) {
      throw new ValidationError('Consent must be given for electronic signature');
    }

    // Verify contract party exists
    const contractParty = await this.prisma.contractParty.findUnique({
      where: { id: input.contractPartyId },
      include: { contract: true },
    });

    if (!contractParty) {
      throw new NotFoundError('ContractParty', input.contractPartyId);
    }

    // Build create data, only including defined optional fields
    const createData: Prisma.SignatureEventCreateInput = {
      contractParty: { connect: { id: input.contractPartyId } },
      documentHash: input.documentHash,
      documentVersion: input.documentVersion,
      signatureType: input.signatureType,
      consentGiven: input.consentGiven,
      consentMethod: input.consentMethod,
      consentText: input.consentText,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      ceremonyStarted: input.ceremonyStarted,
      signedAt: input.signedAt,
    };

    // Add optional fields only if they have values
    if (input.signatureData) createData.signatureData = input.signatureData;
    if (input.deviceId) createData.deviceId = input.deviceId;
    if (input.geolocation) createData.geolocation = input.geolocation;
    if (input.providerRef) createData.providerRef = input.providerRef;
    if (input.providerName) createData.providerName = input.providerName;
    if (input.providerData) createData.providerData = input.providerData as Prisma.InputJsonValue;

    // Create signature event
    const signatureEvent = await this.prisma.signatureEvent.create({
      data: createData,
    });

    // Update contract party signature status
    await this.prisma.contractParty.update({
      where: { id: input.contractPartyId },
      data: {
        signedAt: input.signedAt,
        signatureRef: input.providerRef || signatureEvent.id,
      },
    });

    this.log.info({
      signatureEventId: signatureEvent.id,
      contractPartyId: input.contractPartyId,
      signatureType: input.signatureType,
    }, 'Signature event recorded');

    return signatureEvent;
  }

  /**
   * Get signature event by ID
   */
  async getSignatureEvent(id: string): Promise<SignatureEvent> {
    const event = await this.prisma.signatureEvent.findUnique({
      where: { id },
      include: {
        contractParty: {
          include: {
            party: true,
            contract: { select: { id: true, contractNumber: true, title: true } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('SignatureEvent', id);
    }

    return event;
  }

  /**
   * List signature events with filtering
   */
  async listSignatureEvents(query: SignatureEventQuery) {
    const where: Prisma.SignatureEventWhereInput = {};
    if (query.contractPartyId) where.contractPartyId = query.contractPartyId;
    if (query.providerName) where.providerName = query.providerName;
    if (query.fromDate) where.signedAt = { gte: query.fromDate };
    if (query.toDate) where.signedAt = { ...where.signedAt as object, lte: query.toDate };

    const [data, total] = await Promise.all([
      this.prisma.signatureEvent.findMany({
        where,
        include: {
          contractParty: {
            include: {
              party: { select: { id: true, name: true } },
              contract: { select: { id: true, contractNumber: true, title: true } },
            },
          },
        },
        orderBy: { signedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.signatureEvent.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Get all signature events for a contract
   */
  async getContractSignatures(contractId: string): Promise<SignatureEvent[]> {
    return this.prisma.signatureEvent.findMany({
      where: {
        contractParty: { contractId },
      },
      include: {
        contractParty: {
          include: { party: true },
        },
      },
      orderBy: { signedAt: 'asc' },
    });
  }

  /**
   * Verify document integrity by comparing hash
   */
  async verifyDocumentIntegrity(signatureEventId: string, currentDocumentHash: string): Promise<{
    valid: boolean;
    signedHash: string;
    currentHash: string;
    signedAt: Date;
  }> {
    const event = await this.getSignatureEvent(signatureEventId);
    
    return {
      valid: event.documentHash === currentDocumentHash,
      signedHash: event.documentHash,
      currentHash: currentDocumentHash,
      signedAt: event.signedAt,
    };
  }
}

export function createESignatureService(prisma: PrismaClient): ESignatureService {
  return new ESignatureService(prisma);
}
