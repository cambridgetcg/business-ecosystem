/**
 * Cross-Domain Search Routes
 * Search across all operational domains
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import type { DomainClient } from '../domain-client.js';
import type { OperationalDomain, DomainDocument } from '../types.js';

const logger = pino({ name: 'operational-gateway-search' });

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  entityId: z.string().uuid().optional(),
  domains: z.string().optional().transform(s => s?.split(',') as OperationalDomain[] | undefined),
  status: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface SearchResult {
  id: string;
  domain: OperationalDomain;
  type: string;
  title: string;
  description?: string;
  status: string;
  entityId: string;
  createdAt: Date;
  updatedAt: Date;
  relevanceScore: number;
  highlights?: string[];
}

export function createSearchRoutes(domainClients: Map<OperationalDomain, DomainClient>) {
  const router = new Hono();

  /**
   * GET /search
   * Cross-domain search
   */
  router.get('/', zValidator('query', searchQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const { q, entityId, domains, status, type, dateFrom, dateTo, limit, offset } = query;

    logger.info({ query: q, entityId, domains }, 'Cross-domain search');

    const targetDomains = domains || (Array.from(domainClients.keys()) as OperationalDomain[]);

    // Search across domains in parallel
    const searchPromises = targetDomains.map(async (domain) => {
      const client = domainClients.get(domain);
      if (!client) return [];

      try {
        // Each domain client would have a search endpoint
        // For now, simulate by fetching documents and filtering
        const docs = entityId ? await client.getDocuments(entityId) : [];
        return docs
          .filter(doc => {
            const matchesQuery = doc.title.toLowerCase().includes(q.toLowerCase());
            const matchesStatus = !status || doc.status === status;
            const matchesType = !type || doc.type === type;
            const matchesDateFrom = !dateFrom || new Date(doc.createdAt) >= new Date(dateFrom);
            const matchesDateTo = !dateTo || new Date(doc.createdAt) <= new Date(dateTo);
            return matchesQuery && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
          })
          .map(doc => ({
            ...doc,
            domain,
            relevanceScore: calculateRelevance(q, doc),
            highlights: generateHighlights(q, doc.title),
          }));
      } catch (error) {
        logger.error({ domain, error }, 'Search failed for domain');
        return [];
      }
    });

    const results = (await Promise.all(searchPromises)).flat();

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return c.json({
      query: q,
      results: paginatedResults,
      total: results.length,
      limit,
      offset,
      domains: targetDomains,
    });
  });

  /**
   * GET /search/suggestions
   * Search suggestions/autocomplete
   */
  router.get('/suggestions', zValidator('query', z.object({
    q: z.string().min(1).max(100),
    entityId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })), async (c) => {
    const { q, entityId, limit } = c.req.valid('query');

    // Simulate suggestions based on query
    const suggestions = [
      { text: `${q} contract`, type: 'contract' },
      { text: `${q} policy`, type: 'insurance' },
      { text: `${q} patent`, type: 'ip' },
      { text: `${q} privacy`, type: 'data-privacy' },
    ].slice(0, limit);

    return c.json({ suggestions });
  });

  /**
   * GET /search/recent
   * Recent search activity
   */
  router.get('/recent', zValidator('query', z.object({
    entityId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })), async (c) => {
    const { entityId, limit } = c.req.valid('query');

    // This would typically come from a search history store
    // For now, return empty
    return c.json({
      recentSearches: [],
      recentViews: [],
    });
  });

  return router;
}

function calculateRelevance(query: string, doc: DomainDocument): number {
  const queryLower = query.toLowerCase();
  const titleLower = doc.title.toLowerCase();

  let score = 0;

  // Exact match
  if (titleLower === queryLower) score += 100;
  // Starts with query
  else if (titleLower.startsWith(queryLower)) score += 75;
  // Contains query
  else if (titleLower.includes(queryLower)) score += 50;

  // Boost for recent documents
  const daysSinceUpdate = (Date.now() - new Date(doc.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) score += 20;
  else if (daysSinceUpdate < 30) score += 10;

  // Boost for active status
  if (doc.status === 'active') score += 15;

  return score;
}

function generateHighlights(query: string, text: string): string[] {
  const highlights: string[] = [];
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  const index = textLower.indexOf(queryLower);
  if (index >= 0) {
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + query.length + 20);
    const highlight = (start > 0 ? '...' : '') +
      text.substring(start, index) +
      `<mark>${text.substring(index, index + query.length)}</mark>` +
      text.substring(index + query.length, end) +
      (end < text.length ? '...' : '');
    highlights.push(highlight);
  }

  return highlights;
}
