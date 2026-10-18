/**
 * Ecosystem Integration Events
 *
 * Cross-domain events for integration with other services:
 * - Contracts-Legal: License agreements, IP assignments
 * - Accounting: Asset valuations, royalty revenue
 * - Compliance: Regulatory deadlines, audit trails
 *
 * @module domain/events
 */

/**
 * Base event structure for ecosystem integration.
 */
export interface EcosystemEvent {
  eventId: string;
  eventType: string;
  source: 'intellectual-property';
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: {
    tenantId?: string;
    userId?: string;
    traceId?: string;
  };
}

// ============================================================================
// Events for Contracts-Legal Service
// ============================================================================

/**
 * Emitted when a license agreement should be drafted.
 */
export interface LicenseAgreementRequested extends EcosystemEvent {
  eventType: 'IP.LicenseAgreementRequested';
  payload: {
    licenseId: string;
    licenseType: 'exclusive' | 'non_exclusive' | 'sole';
    licensorEntityId: string;
    licenseeEntityId: string;
    ipAssets: Array<{
      type: 'patent' | 'trademark' | 'copyright' | 'trade_secret';
      id: string;
      name: string;
    }>;
    territory: string[];
    fieldOfUse?: string;
    term: {
      startDate: Date;
      endDate?: Date;
      perpetual: boolean;
    };
    financialTerms: {
      upfrontFee?: number;
      royaltyRate?: number;
      royaltyBasis?: string;
      minimumRoyalty?: number;
      currency: string;
    };
    requestedBy: string;
    priority: 'standard' | 'urgent';
    notes?: string;
  };
}

/**
 * Emitted when IP ownership is being transferred.
 */
export interface IPAssignmentRequested extends EcosystemEvent {
  eventType: 'IP.AssignmentRequested';
  payload: {
    assignmentType: 'full' | 'partial';
    assignorEntityId: string;
    assigneeEntityId: string;
    ipAssets: Array<{
      type: 'patent' | 'trademark' | 'copyright' | 'trade_secret';
      id: string;
      name: string;
      registrationNumber?: string;
    }>;
    consideration: {
      amount: number;
      currency: string;
      paymentTerms: string;
    };
    effectiveDate: Date;
    governingLaw: string;
    requestedBy: string;
    notes?: string;
  };
}

/**
 * Emitted when an NDA is needed for trade secret disclosure.
 */
export interface NDARequested extends EcosystemEvent {
  eventType: 'IP.NDARequested';
  payload: {
    tradeSecretId: string;
    tradeSecretName: string;
    disclosingPartyId: string;
    receivingPartyId: string;
    purpose: string;
    confidentialityPeriod: number; // years
    territoryCoverage: string[];
    requestedBy: string;
    urgency: 'standard' | 'urgent';
  };
}

/**
 * Emitted when an enforcement action requires legal contract.
 */
export interface SettlementAgreementRequested extends EcosystemEvent {
  eventType: 'IP.SettlementAgreementRequested';
  payload: {
    enforcementMatterId: string;
    matterTitle: string;
    partiesInvolved: Array<{
      entityId?: string;
      name: string;
      role: 'plaintiff' | 'defendant' | 'settlor';
    }>;
    settlementTerms: {
      monetaryAmount?: number;
      currency?: string;
      licensingTerms?: string;
      injunctiveRelief?: boolean;
      admissions?: string;
    };
    confidential: boolean;
    effectiveDate: Date;
    requestedBy: string;
  };
}

// ============================================================================
// Events for Accounting Service
// ============================================================================

/**
 * Emitted when an IP valuation is completed and needs recording.
 */
export interface IPValuationCompleted extends EcosystemEvent {
  eventType: 'IP.ValuationCompleted';
  payload: {
    valuationId: string;
    valuationNumber: string;
    purpose: string;
    methodology: string;
    valuationDate: Date;
    ipAssets: Array<{
      type: string;
      id: string;
      name: string;
      allocatedValue: number;
    }>;
    totalValue: number;
    currency: string;
    confidenceLevel: number;
    preparedBy: string;
    approvedBy?: string;
    effectiveDate: Date;
    accountingTreatment: 'capitalize' | 'expense' | 'impairment_test';
    usefulLife?: number; // years
    amortizationMethod?: 'straight_line' | 'units_of_production' | 'none';
  };
}

/**
 * Emitted when royalty revenue is due for recognition.
 */
export interface RoyaltyRevenueRecognized extends EcosystemEvent {
  eventType: 'IP.RoyaltyRevenueRecognized';
  payload: {
    licenseId: string;
    licenseeEntityId: string;
    period: {
      startDate: Date;
      endDate: Date;
    };
    ipAssets: Array<{
      type: string;
      id: string;
      name: string;
    }>;
    revenueAmount: number;
    currency: string;
    calculationBasis: string;
    salesVolume?: number;
    royaltyRate?: number;
    invoiceRequired: boolean;
    dueDate: Date;
    paymentTerms: string;
  };
}

/**
 * Emitted when IP-related expense needs recording.
 */
export interface IPExpenseIncurred extends EcosystemEvent {
  eventType: 'IP.ExpenseIncurred';
  payload: {
    expenseType: 'maintenance_fee' | 'renewal_fee' | 'filing_fee' | 'legal_fee' | 'enforcement_cost' | 'licensing_cost';
    ipAssetType?: string;
    ipAssetId?: string;
    ipAssetName?: string;
    amount: number;
    currency: string;
    vendor?: string;
    invoiceNumber?: string;
    description: string;
    expenseDate: Date;
    dueDate?: Date;
    jurisdiction?: string;
    costCenter?: string;
    projectCode?: string;
  };
}

/**
 * Emitted when IP asset should be capitalized.
 */
export interface IPAssetCapitalized extends EcosystemEvent {
  eventType: 'IP.AssetCapitalized';
  payload: {
    assetType: 'patent' | 'trademark' | 'copyright' | 'software' | 'trade_secret';
    assetId: string;
    assetName: string;
    acquisitionType: 'internal_development' | 'purchase' | 'license_in' | 'merger_acquisition';
    capitalizedAmount: number;
    currency: string;
    capitalizationDate: Date;
    usefulLife: number;
    amortizationMethod: 'straight_line' | 'units_of_production' | 'none';
    residualValue?: number;
    costComponents: Array<{
      description: string;
      amount: number;
    }>;
    entityId: string;
  };
}

/**
 * Emitted when IP asset is impaired.
 */
export interface IPAssetImpaired extends EcosystemEvent {
  eventType: 'IP.AssetImpaired';
  payload: {
    assetType: string;
    assetId: string;
    assetName: string;
    previousCarryingValue: number;
    newCarryingValue: number;
    impairmentLoss: number;
    currency: string;
    impairmentDate: Date;
    reason: string;
    triggeringEvent: 'market_decline' | 'technology_obsolescence' | 'legal_challenge' | 'abandonment' | 'other';
    recoverable: boolean;
    notes?: string;
  };
}

// ============================================================================
// Events for Compliance Service
// ============================================================================

/**
 * Emitted when an IP deadline is created.
 */
export interface IPDeadlineCreated extends EcosystemEvent {
  eventType: 'IP.DeadlineCreated';
  payload: {
    deadlineId: string;
    deadlineType: string;
    ipAssetType: string;
    ipAssetId: string;
    ipAssetName: string;
    dueDate: Date;
    windowOpens?: Date;
    graceDeadline?: Date;
    jurisdiction: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    responsibleParty?: string;
    estimatedCost?: number;
    currency?: string;
    description: string;
    reminderDates: Date[];
  };
}

/**
 * Emitted when a deadline is approaching.
 */
export interface IPDeadlineApproaching extends EcosystemEvent {
  eventType: 'IP.DeadlineApproaching';
  payload: {
    deadlineId: string;
    deadlineType: string;
    ipAssetType: string;
    ipAssetId: string;
    ipAssetName: string;
    dueDate: Date;
    daysRemaining: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    escalationLevel: number;
    assignedTo?: string;
    estimatedCost?: number;
    currency?: string;
    actionRequired: string;
  };
}

/**
 * Emitted when a deadline is missed.
 */
export interface IPDeadlineMissed extends EcosystemEvent {
  eventType: 'IP.DeadlineMissed';
  payload: {
    deadlineId: string;
    deadlineType: string;
    ipAssetType: string;
    ipAssetId: string;
    ipAssetName: string;
    dueDate: Date;
    missedDate: Date;
    gracePeriodAvailable: boolean;
    graceDeadline?: Date;
    consequence: string;
    remediationOptions: string[];
    estimatedImpact?: {
      financial?: number;
      currency?: string;
      legal?: string;
    };
    responsibleParty?: string;
  };
}

/**
 * Emitted when regulatory filing is required.
 */
export interface RegulatoryFilingRequired extends EcosystemEvent {
  eventType: 'IP.RegulatoryFilingRequired';
  payload: {
    filingType: 'section_8' | 'section_9' | 'section_15' | 'madrid_renewal' | 'maintenance_fee' | 'annual_report';
    ipAssetType: string;
    ipAssetId: string;
    ipAssetName: string;
    registrationNumber?: string;
    jurisdiction: string;
    regulatoryBody: string;
    dueDate: Date;
    windowOpens?: Date;
    graceDeadline?: Date;
    fee: number;
    currency: string;
    documentsRequired: string[];
    onlineFilingAvailable: boolean;
    filingUrl?: string;
  };
}

// ============================================================================
// Events for Entity-Governance Service
// ============================================================================

/**
 * Emitted when IP ownership changes due to corporate restructuring.
 */
export interface IPOwnershipChanged extends EcosystemEvent {
  eventType: 'IP.OwnershipChanged';
  payload: {
    ipAssets: Array<{
      type: string;
      id: string;
      name: string;
      registrationNumber?: string;
    }>;
    previousOwnerId: string;
    newOwnerId: string;
    changeReason: 'merger' | 'acquisition' | 'spinoff' | 'internal_transfer' | 'assignment';
    effectiveDate: Date;
    recordationRequired: boolean;
    jurisdictionsAffected: string[];
  };
}

// ============================================================================
// Event Type Union
// ============================================================================

export type IntegrationEventType =
  // Contracts-Legal
  | LicenseAgreementRequested
  | IPAssignmentRequested
  | NDARequested
  | SettlementAgreementRequested
  // Accounting
  | IPValuationCompleted
  | RoyaltyRevenueRecognized
  | IPExpenseIncurred
  | IPAssetCapitalized
  | IPAssetImpaired
  // Compliance
  | IPDeadlineCreated
  | IPDeadlineApproaching
  | IPDeadlineMissed
  | RegulatoryFilingRequired
  // Entity-Governance
  | IPOwnershipChanged;
