/**
 * Report Generator
 * Generates reports from definitions by fetching data from operational domains
 */

import { pino } from 'pino';
import type {
  ReportDefinition,
  ReportData,
  ReportSectionData,
  ReportItem,
  ReportSummary,
  OperationalDomain,
} from './types.js';

const logger = pino({ name: 'report-generator' });

export interface DomainClientConfig {
  baseUrl: string;
  timeout?: number;
}

export class ReportGenerator {
  private domainEndpoints: Map<OperationalDomain, string>;
  private timeout: number;

  constructor(
    domainEndpoints: Record<OperationalDomain, string>,
    timeout = 30000
  ) {
    this.domainEndpoints = new Map(Object.entries(domainEndpoints) as [OperationalDomain, string][]);
    this.timeout = timeout;
  }

  async generate(
    definition: ReportDefinition,
    parameters: Record<string, unknown>
  ): Promise<ReportData> {
    const startTime = Date.now();
    logger.info({ reportId: definition.id, parameters }, 'Generating report');

    // Validate and apply default parameters
    const resolvedParams = this.resolveParameters(definition, parameters);

    // Fetch data from all sources in parallel
    const sourceData = await Promise.all(
      definition.sources.map((source) =>
        this.fetchSourceData(source.domain, source.query, resolvedParams)
      )
    );

    // Combine all source data
    const allItems = sourceData.flat();

    // Build sections
    const sections = definition.output.sections.map((section) =>
      this.buildSection(section, allItems)
    );

    // Build summary if requested
    const summary = definition.output.summary
      ? this.buildSummary(allItems, Date.now() - startTime)
      : undefined;

    logger.info({
      reportId: definition.id,
      totalItems: allItems.length,
      sectionCount: sections.length,
      generationTime: Date.now() - startTime,
    }, 'Report generated');

    return {
      reportId: definition.id,
      reportName: definition.name,
      generatedAt: new Date(),
      parameters: resolvedParams,
      sections,
      summary,
    };
  }

  private resolveParameters(
    definition: ReportDefinition,
    provided: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const param of definition.parameters) {
      if (param.name in provided) {
        resolved[param.name] = provided[param.name];
      } else if (param.default !== undefined) {
        resolved[param.name] = param.default;
      } else if (param.required) {
        throw new Error('Missing required parameter: ' + param.name);
      }
    }

    return resolved;
  }

  private async fetchSourceData(
    domain: OperationalDomain,
    query: string,
    parameters: Record<string, unknown>
  ): Promise<ReportItem[]> {
    const baseUrl = this.domainEndpoints.get(domain);
    if (!baseUrl) {
      logger.warn({ domain }, 'No endpoint configured for domain');
      return [];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Build query string from parameters
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value));
        }
      }

      const url = baseUrl + '/reports/' + query + '?' + queryParams.toString();
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn({ domain, query, status: response.status }, 'Source query failed');
        return [];
      }

      const data = await response.json() as { items: ReportItem[] };
      return (data.items || []).map((item) => ({
        ...item,
        domain,
      }));
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.warn({ domain, query }, 'Source query timed out');
      } else {
        logger.error({ domain, query, error }, 'Source query error');
      }
      return [];
    }
  }

  private buildSection(
    config: { title: string; filter?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; fields?: string[] },
    allItems: ReportItem[]
  ): ReportSectionData {
    let items = [...allItems];

    // Apply filter
    if (config.filter) {
      items = items.filter((item) => this.evaluateFilter(config.filter!, item));
    }

    // Apply sort
    if (config.sortBy) {
      items.sort((a, b) => {
        const aVal = this.getNestedValue(a, config.sortBy!);
        const bVal = this.getNestedValue(b, config.sortBy!);
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return config.sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    // Select fields if specified
    if (config.fields && config.fields.length > 0) {
      items = items.map((item) => {
        const filtered: Record<string, unknown> = {
          domain: item.domain,
          type: item.type,
          id: item.id,
        };
        for (const field of config.fields!) {
          filtered[field] = this.getNestedValue(item, field);
        }
        return filtered as unknown as ReportItem;
      });
    }

    return {
      title: config.title,
      items,
      count: items.length,
    };
  }

  private evaluateFilter(filter: string, item: ReportItem): boolean {
    // Simple filter evaluation: supports field <= value, field >= value, field == value
    const operators = ['<=', '>=', '==', '!=', '<', '>'];

    for (const op of operators) {
      if (filter.includes(op)) {
        const [field, valueStr] = filter.split(op).map((s) => s.trim());
        const fieldValue = this.getNestedValue(item, field);
        const compareValue = this.parseValue(valueStr);

        switch (op) {
          case '<=':
            return fieldValue <= compareValue;
          case '>=':
            return fieldValue >= compareValue;
          case '<':
            return fieldValue < compareValue;
          case '>':
            return fieldValue > compareValue;
          case '==':
            return fieldValue === compareValue;
          case '!=':
            return fieldValue !== compareValue;
        }
      }
    }

    return true;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }

  private parseValue(str: string): unknown {
    // Try number
    const num = Number(str);
    if (!isNaN(num)) return num;

    // Try boolean
    if (str === 'true') return true;
    if (str === 'false') return false;

    // String (remove quotes if present)
    return str.replace(/^['"]|['"]$/g, '');
  }

  private buildSummary(items: ReportItem[], generationTime: number): ReportSummary {
    const byDomain: Record<OperationalDomain, number> = {
      'contracts-legal': 0,
      'insurance': 0,
      'intellectual-property': 0,
      'data-privacy': 0,
    };

    const byType: Record<string, number> = {};

    for (const item of items) {
      byDomain[item.domain] = (byDomain[item.domain] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return {
      totalItems: items.length,
      byDomain,
      byType,
      generationTime,
    };
  }
}
