/**
 * Event Handlers for Compliance Service
 *
 * Consumes domain events from other services to maintain compliance state:
 * - Accounting: Journal entries posted, fiscal periods closed
 * - Tax: Tax filings submitted, provisions recorded
 * - Entity-Governance: Entity created, officers changed
 * - Banking-Treasury: Payment compliance checks
 *
 * @module infrastructure/messaging/event-handlers
 */

import type { Database } from '../persistence/index.js';
import { ComplianceService } from '../../application/services/compliance-service.js';

// =============================================================================
// Event Types from Other Services
// =============================================================================

export interface DomainEvent {
  event_type: string;
  event_id: string;
  timestamp: string;
  correlation_id?: string;
  source: string;
  user_id?: string;
  version: number;
  data: Record<string, unknown>;
}

// =============================================================================
// Accounting Event Handlers
// =============================================================================

/**
 * Handle journal entry posted events from Accounting service
 *
 * When a journal entry is posted, we may need to:
 * - Update compliance status if this relates to a regulatory submission
 * - Record evidence of financial reporting compliance
 * - Trigger related compliance checks
 */
export async function handleJournalEntryPosted(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entry_id, entry_number, total_debits, total_credits, description } = event.data;

  console.log('[Compliance] Received journal entry posted event', {
    entry_id,
    entry_number,
    event_id: event.event_id,
  });

  // Check if this journal entry relates to any compliance obligations
  // For example, recording tax provisions, regulatory fees, etc.
  const descriptionLower = (description as string || '').toLowerCase();

  if (descriptionLower.includes('tax provision') ||
      descriptionLower.includes('vat') ||
      descriptionLower.includes('corporation tax')) {
    console.log('[Compliance] Journal entry may relate to tax compliance', {
      entry_id,
      description,
    });
    // In a full implementation, this would update related compliance obligations
  }
}

/**
 * Handle fiscal period closed events from Accounting service
 *
 * When a fiscal period is closed, we may need to:
 * - Verify all financial reporting obligations are met
 * - Generate compliance reports for the period
 * - Check for upcoming tax filing deadlines
 */
export async function handleFiscalPeriodClosed(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { period_id, period_key, fiscal_year, total_entries, tenant_id, entity_id, period_end_date } = event.data;

  console.log('[Compliance] Received fiscal period closed event', {
    period_id,
    period_key,
    fiscal_year,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const periodEndDate = period_end_date ? new Date(period_end_date as string) : new Date();

  try {
    // Generate compliance report for the closed period
    const periodStart = new Date(periodEndDate);
    periodStart.setFullYear(periodStart.getFullYear() - 1);

    const report = await service.generateComplianceReport(
      tenantId,
      periodStart,
      periodEndDate,
      entity_id as string | undefined
    );

    console.log(`[Compliance] Generated compliance report ${report.id} for fiscal period ${period_key}`);

    // Check for overdue obligations that might have been missed
    const overdueObligations = await service.getOverdueObligations(tenantId);

    if (overdueObligations.length > 0) {
      console.log(`[Compliance] Found ${overdueObligations.length} overdue obligations at period close`);

      // Create audit finding for overdue compliance items
      for (const obl of overdueObligations.slice(0, 5)) { // Limit to first 5
        await service.createFinding({
          tenantId,
          entityId: obl.entityId,
          title: `Overdue Compliance: ${obl.title}`,
          description: `Obligation was overdue at fiscal period close. Due date: ${obl.dueDate.toISOString().slice(0, 10)}`,
          findingType: 'compliance_gap',
          severity: obl.priority === 'critical' ? 'high' : 'medium',
          auditType: 'period_close_review',
          auditDate: new Date(),
          regulator: obl.regulator,
          obligationId: obl.id,
          remediationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
    }

    // Check upcoming deadlines in next 90 days
    const upcomingDeadlines = await service.getUpcomingDeadlines(tenantId, 90);
    console.log(`[Compliance] ${upcomingDeadlines.length} compliance deadlines in next 90 days`);

  } catch (error) {
    console.error('[Compliance] Failed to process fiscal period close:', error);
  }
}

// =============================================================================
// Tax Event Handlers
// =============================================================================

/**
 * Handle tax filing submitted events from Tax service
 *
 * When a tax filing is submitted, we update the compliance obligation status.
 */
export async function handleTaxFilingSubmitted(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { filing_id, tax_type, period, submission_reference, entity_id, tenant_id } = event.data;

  console.log('[Compliance] Received tax filing submitted event', {
    filing_id,
    tax_type,
    period,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;
  const taxType = tax_type as string;

  try {
    // Find obligations related to this tax filing
    const obligations = await service.getObligationsByEntity(tenantId, entityId, {
      status: 'pending',
      category: 'tax',
    });

    // Match obligation by tax type in title or metadata
    const matchingObligation = obligations.find(obl =>
      obl.title.toLowerCase().includes(taxType.toLowerCase()) ||
      obl.title.toLowerCase().includes('ct600') && taxType.toLowerCase().includes('corporation') ||
      obl.title.toLowerCase().includes('vat') && taxType.toLowerCase().includes('vat')
    );

    if (matchingObligation) {
      await service.updateObligation(matchingObligation.id, {
        status: 'submitted',
        metadata: {
          ...matchingObligation.metadata as object,
          filingId: filing_id,
          submissionReference: submission_reference,
          submittedAt: new Date().toISOString(),
        },
      });

      console.log(`[Compliance] Updated obligation ${matchingObligation.id} to submitted status`);
    } else {
      console.log(`[Compliance] No matching obligation found for tax filing: ${taxType}`);
    }
  } catch (error) {
    console.error('[Compliance] Failed to update tax filing obligation:', error);
  }
}

/**
 * Handle tax registration completed events
 */
export async function handleTaxRegistrationCompleted(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { registration_id, tax_type, registration_number } = event.data;

  console.log('[Compliance] Received tax registration completed event', {
    registration_id,
    tax_type,
    registration_number,
    event_id: event.event_id,
  });

  // Update VAT registration status, PAYE status, etc.
}

// =============================================================================
// Entity-Governance Event Handlers
// =============================================================================

/**
 * Handle entity created events from Entity-Governance service
 *
 * When a new entity is created, we need to set up its compliance obligations.
 */
export async function handleEntityCreated(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entity_id, entity_type, name, jurisdiction, incorporation_date, tenant_id } = event.data;

  console.log('[Compliance] Received entity created event', {
    entity_id,
    entity_type,
    name,
    event_id: event.event_id,
  });

  // Only create obligations for UK entities
  const isUKEntity = (jurisdiction as string || '').toLowerCase().includes('uk') ||
                     (jurisdiction as string || '').toLowerCase().includes('gb') ||
                     (jurisdiction as string || '').toLowerCase() === 'united kingdom';

  if (!isUKEntity) {
    console.log('[Compliance] Non-UK entity, skipping default obligations');
    return;
  }

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;
  const incDate = incorporation_date ? new Date(incorporation_date as string) : new Date();

  try {
    // Get active requirements for this tenant
    const requirements = await service.getActiveRequirements(tenantId);

    // Default UK compliance obligations to create
    const defaultObligations = [
      {
        pattern: 'annual_accounts',
        title: 'Annual Accounts Filing - Companies House',
        description: 'File annual accounts with Companies House within 9 months of accounting reference date.',
        dueMonths: 9, // 9 months from incorporation
      },
      {
        pattern: 'confirmation_statement',
        title: 'Confirmation Statement (Annual Return)',
        description: 'File confirmation statement with Companies House within 14 days of anniversary.',
        dueMonths: 12,
      },
      {
        pattern: 'psc_register',
        title: 'PSC Register Maintenance',
        description: 'Maintain accurate Person of Significant Control register.',
        dueMonths: 1, // Initial setup within 1 month
      },
      {
        pattern: 'corporation_tax',
        title: 'Corporation Tax Return (CT600)',
        description: 'File corporation tax return with HMRC within 12 months of accounting period end.',
        dueMonths: 12,
      },
    ];

    for (const oblTemplate of defaultObligations) {
      // Find matching requirement
      const matchingReq = requirements.find(r =>
        r.category.toLowerCase().includes(oblTemplate.pattern) ||
        r.regulationName.toLowerCase().includes(oblTemplate.pattern.replace('_', ' '))
      );

      if (matchingReq) {
        const dueDate = new Date(incDate);
        dueDate.setMonth(dueDate.getMonth() + oblTemplate.dueMonths);

        await service.createObligation({
          tenantId,
          entityId,
          requirementId: matchingReq.id,
          title: oblTemplate.title,
          description: oblTemplate.description,
          dueDate,
          periodStart: incDate,
          periodEnd: dueDate,
        });

        console.log(`[Compliance] Created obligation: ${oblTemplate.title} for entity ${entityId}`);
      }
    }

    console.log(`[Compliance] Set up default obligations for new entity: ${name}`);
  } catch (error) {
    console.error('[Compliance] Failed to create default obligations:', error);
  }
}

/**
 * Handle PSC change events
 */
export async function handlePSCChanged(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entity_id, psc_id, change_type, tenant_id } = event.data;

  console.log('[Compliance] Received PSC changed event', {
    entity_id,
    psc_id,
    change_type,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;

  try {
    // Get PSC-related requirements
    const requirements = await service.getActiveRequirements(tenantId);
    const pscReq = requirements.find(r =>
      r.category === 'psc' ||
      r.regulationName.toLowerCase().includes('psc') ||
      r.regulationName.toLowerCase().includes('person of significant control')
    );

    if (pscReq) {
      // PSC changes must be notified within 14 days
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      await service.createObligation({
        tenantId,
        entityId,
        requirementId: pscReq.id,
        title: `PSC Register Update - ${change_type}`,
        description: `Update PSC register following ${change_type} change. Notification to Companies House required within 14 days.`,
        dueDate,
        priority: 'high',
        metadata: { pscId: psc_id, changeType: change_type },
      });

      console.log(`[Compliance] Created 14-day PSC update obligation for entity ${entityId}`);
    } else {
      console.log('[Compliance] No PSC requirement found, skipping obligation creation');
    }
  } catch (error) {
    console.error('[Compliance] Failed to create PSC change obligation:', error);
  }
}

// =============================================================================
// Banking-Treasury Event Handlers
// =============================================================================

/**
 * Handle compliance blocked events from Banking-Treasury
 *
 * When a payment is blocked for compliance reasons, we need to track it.
 */
export async function handleComplianceBlocked(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entity_id, payment_id, rule_id, rule_name, reason, severity } = event.data;

  console.log('[Compliance] Received compliance blocked event', {
    entity_id,
    payment_id,
    rule_name,
    severity,
    event_id: event.event_id,
  });

  // Create an audit finding for the compliance block
  // This helps track compliance issues and their resolution
}

// =============================================================================
// Data Privacy Event Handlers
// =============================================================================

/**
 * Handle data breach identified events from Data Privacy service
 *
 * GDPR requires notification to ICO within 72 hours of becoming aware of a breach.
 */
export async function handleDataBreachIdentified(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { breach_id, entity_id, tenant_id, breach_type, severity, affected_records, description } = event.data;

  console.log('[Compliance] Received data breach identified event', {
    breach_id,
    entity_id,
    severity,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;

  try {
    // Get ICO/GDPR notification requirement
    const requirements = await service.getActiveRequirements(tenantId);
    const breachReq = requirements.find(r =>
      r.regulator === 'ico' ||
      r.category === 'data_breach' ||
      r.regulationName.toLowerCase().includes('gdpr')
    );

    // GDPR requires 72-hour notification
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 72);

    if (breachReq) {
      // Create critical compliance obligation
      const obligation = await service.createObligation({
        tenantId,
        entityId,
        requirementId: breachReq.id,
        title: `URGENT: Data Breach Notification - ${breach_type}`,
        description: `Report data breach to ICO within 72 hours as required by GDPR Article 33.\n\nBreach Details:\n- Type: ${breach_type}\n- Severity: ${severity}\n- Affected Records: ${affected_records || 'Unknown'}\n\n${description || ''}`,
        dueDate,
        priority: 'critical',
        metadata: {
          breachId: breach_id,
          breachType: breach_type,
          severity,
          affectedRecords: affected_records,
          notificationDeadline: dueDate.toISOString(),
        },
      });

      console.log(`[Compliance] Created 72-hour GDPR breach notification obligation: ${obligation.id}`);
    }

    // Also create an audit finding
    await service.createFinding({
      tenantId,
      entityId,
      title: `Data Breach Detected: ${breach_type}`,
      description: `A ${severity} severity data breach has been identified. ${description || ''}`,
      findingType: 'data_breach',
      severity: severity as string === 'critical' ? 'critical' : severity as string === 'high' ? 'high' : 'medium',
      auditType: 'incident_response',
      auditDate: new Date(),
      regulator: 'ico',
      remediationDueDate: dueDate,
      metadata: { breachId: breach_id, affectedRecords: affected_records },
    });

    console.log(`[Compliance] Created audit finding for data breach: ${breach_id}`);

  } catch (error) {
    console.error('[Compliance] Failed to process data breach event:', error);
  }
}

// =============================================================================
// Officer/Shareholder Event Handlers
// =============================================================================

/**
 * Handle officer appointed events from Entity-Governance service
 */
export async function handleOfficerAppointed(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entity_id, officer_id, name, title, tenant_id } = event.data;

  console.log('[Compliance] Received officer appointed event', {
    entity_id,
    officer_id,
    name,
    title,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;

  try {
    // Companies House notification required within 14 days
    const requirements = await service.getActiveRequirements(tenantId);
    const directorReq = requirements.find(r =>
      r.category === 'directors_duties' ||
      r.category === 'company_filing' ||
      r.regulationName.toLowerCase().includes('director') ||
      r.regulationName.toLowerCase().includes('officer')
    );

    if (directorReq) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      await service.createObligation({
        tenantId,
        entityId,
        requirementId: directorReq.id,
        title: `Director/Officer Appointment Notification - ${name}`,
        description: `Notify Companies House of appointment of ${name} as ${title}. Required within 14 days.`,
        dueDate,
        priority: 'high',
        metadata: { officerId: officer_id, officerName: name, officerTitle: title },
      });

      console.log(`[Compliance] Created 14-day officer appointment notification obligation`);
    }
  } catch (error) {
    console.error('[Compliance] Failed to process officer appointed event:', error);
  }
}

/**
 * Handle shareholder added events from Entity-Governance service
 *
 * Check if new shareholder exceeds PSC threshold (25%)
 */
export async function handleShareholderAdded(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const { entity_id, shareholder_id, name, ownership_percentage, tenant_id } = event.data;

  console.log('[Compliance] Received shareholder added event', {
    entity_id,
    shareholder_id,
    name,
    ownership_percentage,
    event_id: event.event_id,
  });

  const tenantId = tenant_id as string || event.correlation_id as string;
  const entityId = entity_id as string;
  const ownershipPct = ownership_percentage as number || 0;

  try {
    // PSC threshold is 25% or more
    if (ownershipPct >= 25) {
      const requirements = await service.getActiveRequirements(tenantId);
      const pscReq = requirements.find(r =>
        r.category === 'psc' ||
        r.regulationName.toLowerCase().includes('psc') ||
        r.regulationName.toLowerCase().includes('significant control')
      );

      if (pscReq) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        await service.createObligation({
          tenantId,
          entityId,
          requirementId: pscReq.id,
          title: `PSC Registration - ${name} (${ownershipPct}%)`,
          description: `Register ${name} as Person of Significant Control. Ownership: ${ownershipPct}% exceeds 25% threshold. Notification required within 14 days.`,
          dueDate,
          priority: 'high',
          metadata: {
            shareholderId: shareholder_id,
            shareholderName: name,
            ownershipPercentage: ownershipPct,
            pscThresholdExceeded: true,
          },
        });

        console.log(`[Compliance] Created PSC registration obligation for ${name} (${ownershipPct}%)`);
      }
    }
  } catch (error) {
    console.error('[Compliance] Failed to process shareholder added event:', error);
  }
}

// =============================================================================
// Event Handler Registry
// =============================================================================

export const EVENT_HANDLERS: Record<string, (event: DomainEvent, service: ComplianceService) => Promise<void>> = {
  // Accounting events
  'accounting.journal_entry.posted': handleJournalEntryPosted,
  'accounting.fiscal_period.closed': handleFiscalPeriodClosed,

  // Tax events
  'tax.filing.submitted': handleTaxFilingSubmitted,
  'tax.registration.completed': handleTaxRegistrationCompleted,

  // Entity-Governance events
  'entity-governance.entity.created': handleEntityCreated,
  'entity-governance.psc.changed': handlePSCChanged,
  'entity-governance.officer.appointed': handleOfficerAppointed,
  'entity-governance.shareholder.added': handleShareholderAdded,

  // Banking-Treasury events
  'banking.compliance.blocked': handleComplianceBlocked,

  // Data Privacy events
  'data-privacy.breach.identified': handleDataBreachIdentified,
  'data-privacy.breach.reported': handleDataBreachIdentified, // Alias
};

/**
 * Dispatch an event to the appropriate handler
 */
export async function dispatchEvent(
  event: DomainEvent,
  service: ComplianceService
): Promise<void> {
  const handler = EVENT_HANDLERS[event.event_type];

  if (handler) {
    try {
      await handler(event, service);
    } catch (error) {
      console.error('[Compliance] Event handler error', {
        event_type: event.event_type,
        event_id: event.event_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    console.debug('[Compliance] No handler for event type', {
      event_type: event.event_type,
    });
  }
}
