/**
 * Compliance Aggregator
 * Aggregates compliance status from all operational domains
 */

import { pino } from 'pino';
import type {
  EntityComplianceOverview,
  DomainComplianceStatus,
  ComplianceFinding,
  ComplianceStatus,
  OperationalDomain,
  RegulatoryMapping,
  RegulationStatus,
} from './types.js';

const logger = pino({ name: 'compliance-aggregator' });

export interface ComplianceStore {
  getEntityCompliance(entityId: string): Promise<EntityComplianceOverview | undefined>;
  saveEntityCompliance(overview: EntityComplianceOverview): Promise<void>;
  getFindings(entityId: string, domain?: OperationalDomain): Promise<ComplianceFinding[]>;
  saveFinding(finding: ComplianceFinding): Promise<void>;
  updateFinding(findingId: string, updates: Partial<ComplianceFinding>): Promise<void>;
}

export interface DomainComplianceClient {
  getComplianceStatus(entityId: string): Promise<DomainComplianceStatus>;
  getFindings(entityId: string): Promise<ComplianceFinding[]>;
}

export class ComplianceAggregator {
  private store: ComplianceStore;
  private domainClients: Map<OperationalDomain, DomainComplianceClient>;
  private regulatoryMappings: Map<string, RegulatoryMapping>;

  constructor(
    store: ComplianceStore,
    domainClients: Map<OperationalDomain, DomainComplianceClient>,
    regulatoryMappings: RegulatoryMapping[]
  ) {
    this.store = store;
    this.domainClients = domainClients;
    this.regulatoryMappings = new Map(regulatoryMappings.map(r => [r.regulation, r]));
  }

  /**
   * Get aggregated compliance overview for an entity
   */
  async getEntityOverview(entityId: string): Promise<EntityComplianceOverview> {
    // Try to get cached overview
    let overview = await this.store.getEntityCompliance(entityId);

    if (!overview) {
      // Build new overview
      overview = await this.buildEntityOverview(entityId);
      await this.store.saveEntityCompliance(overview);
    }

    return overview;
  }

  /**
   * Refresh compliance data from all domains for an entity
   */
  async refreshEntityCompliance(entityId: string): Promise<EntityComplianceOverview> {
    logger.info({ entityId }, 'Refreshing entity compliance');

    const overview = await this.buildEntityOverview(entityId);
    await this.store.saveEntityCompliance(overview);

    logger.info({
      entityId,
      overallStatus: overview.overallStatus,
      totalFindings: overview.totalFindings,
    }, 'Entity compliance refreshed');

    return overview;
  }

  private async buildEntityOverview(entityId: string): Promise<EntityComplianceOverview> {
    const domains = new Map<OperationalDomain, DomainComplianceStatus>();
    let totalFindings = 0;
    let criticalFindings = 0;

    // Fetch from each domain
    for (const [domain, client] of this.domainClients) {
      try {
        const status = await client.getComplianceStatus(entityId);
        const findings = await client.getFindings(entityId);

        status.openFindings = findings.filter(f => f.status === 'open' || f.status === 'in-progress').length;
        domains.set(domain, status);

        totalFindings += status.openFindings;
        criticalFindings += findings.filter(f =>
          (f.status === 'open' || f.status === 'in-progress') && f.severity === 'critical'
        ).length;
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch domain compliance');
        domains.set(domain, {
          domain,
          status: 'pending',
          regulations: new Map(),
          openFindings: 0,
        });
      }
    }

    const overallStatus = this.calculateOverallStatus(Array.from(domains.values()));

    return {
      entityId,
      overallStatus,
      domains,
      totalFindings,
      criticalFindings,
      lastUpdated: new Date(),
    };
  }

  private calculateOverallStatus(domainStatuses: DomainComplianceStatus[]): ComplianceStatus {
    // If any domain is non-compliant, overall is non-compliant
    if (domainStatuses.some(d => d.status === 'non-compliant')) {
      return 'non-compliant';
    }

    // If any domain is pending, overall is pending
    if (domainStatuses.some(d => d.status === 'pending')) {
      return 'pending';
    }

    // If all applicable domains are compliant
    const applicableDomains = domainStatuses.filter(d => d.status !== 'not-applicable');
    if (applicableDomains.every(d => d.status === 'compliant')) {
      return 'compliant';
    }

    return 'pending';
  }

  /**
   * Handle compliance status change event from a domain
   */
  async handleStatusChange(
    entityId: string,
    domain: OperationalDomain,
    regulation: string,
    newStatus: ComplianceStatus
  ): Promise<void> {
    logger.info({ entityId, domain, regulation, newStatus }, 'Handling compliance status change');

    const overview = await this.getEntityOverview(entityId);
    const domainStatus = overview.domains.get(domain);

    if (domainStatus) {
      const regStatus = domainStatus.regulations.get(regulation);
      if (regStatus) {
        regStatus.status = newStatus;
        regStatus.lastAssessment = new Date();
      } else {
        domainStatus.regulations.set(regulation, {
          regulation,
          status: newStatus,
          lastAssessment: new Date(),
          findings: [],
        });
      }

      // Recalculate domain status
      domainStatus.status = this.calculateDomainStatus(domainStatus);
    }

    // Recalculate overall status
    overview.overallStatus = this.calculateOverallStatus(Array.from(overview.domains.values()));
    overview.lastUpdated = new Date();

    await this.store.saveEntityCompliance(overview);
  }

  private calculateDomainStatus(domainStatus: DomainComplianceStatus): ComplianceStatus {
    const regulations = Array.from(domainStatus.regulations.values());

    if (regulations.some(r => r.status === 'non-compliant')) {
      return 'non-compliant';
    }

    if (regulations.some(r => r.status === 'pending')) {
      return 'pending';
    }

    if (regulations.every(r => r.status === 'compliant' || r.status === 'not-applicable')) {
      return 'compliant';
    }

    return 'pending';
  }

  /**
   * Handle new compliance finding
   */
  async handleFinding(finding: ComplianceFinding): Promise<void> {
    logger.info({
      entityId: finding.entityId,
      domain: finding.domain,
      severity: finding.severity,
    }, 'Handling new compliance finding');

    await this.store.saveFinding(finding);

    // Refresh entity compliance
    await this.refreshEntityCompliance(finding.entityId);
  }

  /**
   * Get all findings for an entity
   */
  async getFindings(
    entityId: string,
    options?: {
      domain?: OperationalDomain;
      status?: 'open' | 'resolved' | 'all';
      severity?: 'critical' | 'high' | 'medium' | 'low';
    }
  ): Promise<ComplianceFinding[]> {
    let findings = await this.store.getFindings(entityId, options?.domain);

    if (options?.status && options.status !== 'all') {
      const statusFilter = options.status === 'open'
        ? ['open', 'in-progress']
        : ['resolved', 'accepted'];
      findings = findings.filter(f => statusFilter.includes(f.status));
    }

    if (options?.severity) {
      findings = findings.filter(f => f.severity === options.severity);
    }

    return findings;
  }

  /**
   * Get compliance dashboard data for an entity
   */
  async getDashboard(entityId: string): Promise<{
    overview: EntityComplianceOverview;
    findings: {
      critical: ComplianceFinding[];
      high: ComplianceFinding[];
      other: ComplianceFinding[];
    };
    byDomain: Map<OperationalDomain, {
      status: ComplianceStatus;
      findingCount: number;
      regulations: string[];
    }>;
    upcomingAssessments: Array<{
      domain: OperationalDomain;
      regulation: string;
      dueDate: Date;
    }>;
  }> {
    const overview = await this.getEntityOverview(entityId);
    const allFindings = await this.getFindings(entityId, { status: 'open' });

    const findings = {
      critical: allFindings.filter(f => f.severity === 'critical'),
      high: allFindings.filter(f => f.severity === 'high'),
      other: allFindings.filter(f => f.severity !== 'critical' && f.severity !== 'high'),
    };

    const byDomain = new Map<OperationalDomain, {
      status: ComplianceStatus;
      findingCount: number;
      regulations: string[];
    }>();

    for (const [domain, status] of overview.domains) {
      byDomain.set(domain, {
        status: status.status,
        findingCount: status.openFindings,
        regulations: Array.from(status.regulations.keys()),
      });
    }

    // Collect upcoming assessments
    const upcomingAssessments: Array<{
      domain: OperationalDomain;
      regulation: string;
      dueDate: Date;
    }> = [];

    for (const [domain, status] of overview.domains) {
      for (const [regulation, regStatus] of status.regulations) {
        if (regStatus.nextAssessmentDue) {
          upcomingAssessments.push({
            domain,
            regulation,
            dueDate: regStatus.nextAssessmentDue,
          });
        }
      }
    }

    // Sort by due date
    upcomingAssessments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      overview,
      findings,
      byDomain,
      upcomingAssessments: upcomingAssessments.slice(0, 10), // Top 10
    };
  }
}
