/**
 * Domain Names API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DomainName } from '../../../domain/entities/domain-name.entity.js';
import { DrizzleDomainNameRepository } from '../../../infrastructure/persistence/domain-name.repository.js';

// Validation schemas
const createDomainNameSchema = z.object({
  domainName: z.string().min(3).max(255),
  registrantId: z.string().uuid(),
  registrarName: z.string().min(1).max(255),
  registrationDate: z.string().datetime(),
  expirationDate: z.string().datetime(),
  purpose: z.enum(['primary', 'redirect', 'defensive', 'regional', 'campaign', 'product']).optional(),
  adminContactId: z.string().uuid().optional(),
  techContactId: z.string().uuid().optional(),
  registrarIanaId: z.string().max(50).optional(),
  autoRenew: z.boolean().optional(),
  privacyEnabled: z.boolean().optional(),
  locked: z.boolean().optional(),
  dnssecEnabled: z.boolean().optional(),
  linkedTrademarkId: z.string().uuid().optional(),
  defensiveNotes: z.string().optional(),
  nameservers: z.array(z.string()).optional(),
});

const renewDomainSchema = z.object({
  newExpirationDate: z.string().datetime(),
});

const transferDomainSchema = z.object({
  newRegistrarName: z.string().min(1).max(255),
});

const linkTrademarkSchema = z.object({
  trademarkId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateNameserversSchema = z.object({
  nameservers: z.array(z.string()).min(1).max(10),
});

const updateContactsSchema = z.object({
  adminContactId: z.string().uuid().optional(),
  techContactId: z.string().uuid().optional(),
});

export const domainNamesRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleDomainNameRepository((app as any).db);

  // List domain names
  app.get('/', {
    schema: {
      tags: ['domain-names'],
      summary: 'List all domain names',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['active', 'pending_transfer', 'expired', 'redemption', 'deleted', 'reserved'] },
          purpose: { type: 'string', enum: ['primary', 'redirect', 'defensive', 'regional', 'campaign', 'product'] },
          registrantId: { type: 'string', format: 'uuid' },
          tld: { type: 'string' },
          linkedTrademarkId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, purpose, registrantId, tld, linkedTrademarkId } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      purpose?: string;
      registrantId?: string;
      tld?: string;
      linkedTrademarkId?: string;
    };
    const repo = getRepository();

    const domainsList = await repo.findAll({
      limit,
      offset,
      status,
      purpose,
      registrantId,
      tld,
      linkedTrademarkId,
    });

    const total = await repo.count({ status, purpose, registrantId, tld });
    return { data: domainsList, total, limit, offset };
  });

  // Get expiring domains
  app.get('/expiring', {
    schema: {
      tags: ['domain-names'],
      summary: 'Get domains expiring soon',
      querystring: {
        type: 'object',
        properties: {
          daysAhead: { type: 'integer', minimum: 1, maximum: 365, default: 90 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
        },
      },
    },
  }, async (request) => {
    const { daysAhead, limit } = request.query as { daysAhead?: number; limit?: number };
    const repo = getRepository();
    const expiringDomains = await repo.findExpiring({ daysAhead, limit });
    return { data: expiringDomains, daysAhead: daysAhead ?? 90 };
  });

  // Search domains
  app.get('/search', {
    schema: {
      tags: ['domain-names'],
      summary: 'Search domain names',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        required: ['q'],
      },
    },
  }, async (request) => {
    const { q, limit } = request.query as { q: string; limit?: number };
    const repo = getRepository();
    const domainsList = await repo.searchByName(q, limit);
    return { data: domainsList, query: q };
  });

  // Get domains by TLD
  app.get('/by-tld/:tld', {
    schema: {
      tags: ['domain-names'],
      summary: 'Get domains by TLD',
      params: {
        type: 'object',
        properties: {
          tld: { type: 'string' },
        },
        required: ['tld'],
      },
    },
  }, async (request) => {
    const { tld } = request.params as { tld: string };
    const repo = getRepository();
    const domainsList = await repo.findByTld(tld);
    return { data: domainsList, tld };
  });

  // Get defensive registrations for a trademark
  app.get('/defensive/:trademarkId', {
    schema: {
      tags: ['domain-names'],
      summary: 'Get defensive domain registrations for a trademark',
      params: {
        type: 'object',
        properties: {
          trademarkId: { type: 'string', format: 'uuid' },
        },
        required: ['trademarkId'],
      },
    },
  }, async (request) => {
    const { trademarkId } = request.params as { trademarkId: string };
    const repo = getRepository();
    const domainsList = await repo.findByLinkedTrademark(trademarkId);
    return { data: domainsList, trademarkId };
  });

  // Get domain by ID
  app.get('/:id', {
    schema: {
      tags: ['domain-names'],
      summary: 'Get domain name by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();
    const domain = await repo.findById(id);

    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    return domain;
  });

  // Lookup by domain name
  app.get('/lookup/:domainName', {
    schema: {
      tags: ['domain-names'],
      summary: 'Lookup domain by name',
      params: {
        type: 'object',
        properties: {
          domainName: { type: 'string' },
        },
        required: ['domainName'],
      },
    },
  }, async (request, reply) => {
    const { domainName } = request.params as { domainName: string };
    const repo = getRepository();
    const domain = await repo.findByDomainName(domainName);

    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    return domain;
  });

  // Create domain name
  app.post('/', {
    schema: {
      tags: ['domain-names'],
      summary: 'Register a new domain name',
      body: {
        type: 'object',
        required: ['domainName', 'registrantId', 'registrarName', 'registrationDate', 'expirationDate'],
        properties: {
          domainName: { type: 'string' },
          registrantId: { type: 'string', format: 'uuid' },
          registrarName: { type: 'string' },
          registrationDate: { type: 'string', format: 'date-time' },
          expirationDate: { type: 'string', format: 'date-time' },
          purpose: { type: 'string', enum: ['primary', 'redirect', 'defensive', 'regional', 'campaign', 'product'] },
          adminContactId: { type: 'string', format: 'uuid' },
          techContactId: { type: 'string', format: 'uuid' },
          registrarIanaId: { type: 'string' },
          autoRenew: { type: 'boolean' },
          privacyEnabled: { type: 'boolean' },
          locked: { type: 'boolean' },
          dnssecEnabled: { type: 'boolean' },
          linkedTrademarkId: { type: 'string', format: 'uuid' },
          defensiveNotes: { type: 'string' },
          nameservers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createDomainNameSchema.parse(request.body);
    const repo = getRepository();

    // Check if domain already exists
    const existing = await repo.findByDomainName(parsed.domainName);
    if (existing) {
      return reply.status(409).send({ error: 'Domain name already registered' });
    }

    const domain = DomainName.create({
      domainName: parsed.domainName,
      registrantId: parsed.registrantId,
      registrarName: parsed.registrarName,
      registrationDate: new Date(parsed.registrationDate),
      expirationDate: new Date(parsed.expirationDate),
      ...(parsed.purpose && { purpose: parsed.purpose }),
      ...(parsed.adminContactId && { adminContactId: parsed.adminContactId }),
      ...(parsed.techContactId && { techContactId: parsed.techContactId }),
      ...(parsed.registrarIanaId && { registrarIanaId: parsed.registrarIanaId }),
      ...(parsed.autoRenew !== undefined && { autoRenew: parsed.autoRenew }),
      ...(parsed.privacyEnabled !== undefined && { privacyEnabled: parsed.privacyEnabled }),
      ...(parsed.locked !== undefined && { locked: parsed.locked }),
      ...(parsed.dnssecEnabled !== undefined && { dnssecEnabled: parsed.dnssecEnabled }),
      ...(parsed.linkedTrademarkId && { linkedTrademarkId: parsed.linkedTrademarkId }),
      ...(parsed.defensiveNotes && { defensiveNotes: parsed.defensiveNotes }),
      ...(parsed.nameservers && { nameservers: parsed.nameservers }),
    });

    await repo.save(domain);
    return reply.status(201).send(domain);
  });

  // Renew domain
  app.post('/:id/renew', {
    schema: {
      tags: ['domain-names'],
      summary: 'Renew a domain name',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = renewDomainSchema.parse(request.body);
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.renew(new Date(data.newExpirationDate));
    await repo.save(domain);

    return domain;
  });

  // Initiate transfer
  app.post('/:id/transfer', {
    schema: {
      tags: ['domain-names'],
      summary: 'Initiate domain transfer to new registrar',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = transferDomainSchema.parse(request.body);
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    try {
      domain.initiateTransfer(data.newRegistrarName);
      await repo.save(domain);
      return domain;
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Complete transfer
  app.post('/:id/transfer/complete', {
    schema: {
      tags: ['domain-names'],
      summary: 'Complete domain transfer',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { registrarIanaId?: string } | undefined;
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    try {
      domain.completeTransfer(body?.registrarIanaId);
      await repo.save(domain);
      return domain;
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Cancel transfer
  app.post('/:id/transfer/cancel', {
    schema: {
      tags: ['domain-names'],
      summary: 'Cancel domain transfer',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    try {
      domain.cancelTransfer();
      await repo.save(domain);
      return domain;
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Link to trademark (defensive registration)
  app.post('/:id/link-trademark', {
    schema: {
      tags: ['domain-names'],
      summary: 'Link domain to a trademark as defensive registration',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = linkTrademarkSchema.parse(request.body);
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.linkToTrademark(data.trademarkId, data.notes);
    await repo.save(domain);

    return domain;
  });

  // Unlink from trademark
  app.post('/:id/unlink-trademark', {
    schema: {
      tags: ['domain-names'],
      summary: 'Unlink domain from trademark',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.unlinkFromTrademark();
    await repo.save(domain);

    return domain;
  });

  // Lock domain
  app.post('/:id/lock', {
    schema: {
      tags: ['domain-names'],
      summary: 'Lock domain to prevent unauthorized transfers',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.lock();
    await repo.save(domain);

    return domain;
  });

  // Unlock domain
  app.post('/:id/unlock', {
    schema: {
      tags: ['domain-names'],
      summary: 'Unlock domain to allow transfers',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.unlock();
    await repo.save(domain);

    return domain;
  });

  // Update nameservers
  app.patch('/:id/nameservers', {
    schema: {
      tags: ['domain-names'],
      summary: 'Update domain nameservers',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateNameserversSchema.parse(request.body);
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.updateNameservers(data.nameservers);
    await repo.save(domain);

    return domain;
  });

  // Update contacts
  app.patch('/:id/contacts', {
    schema: {
      tags: ['domain-names'],
      summary: 'Update domain contacts',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateContactsSchema.parse(request.body);
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.updateContacts(data);
    await repo.save(domain);

    return domain;
  });

  // Toggle auto-renew
  app.post('/:id/auto-renew', {
    schema: {
      tags: ['domain-names'],
      summary: 'Toggle auto-renewal for domain',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    domain.setAutoRenew(enabled);
    await repo.save(domain);

    return domain;
  });

  // Delete domain (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['domain-names'],
      summary: 'Delete a domain name (soft delete)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const domain = await repo.findById(id);
    if (!domain) {
      return reply.status(404).send({ error: 'Domain name not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
