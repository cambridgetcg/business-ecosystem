/**
 * Processing Activity (Data Inventory) Routes
 * GDPR Article 30 - Records of Processing Activities
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ActivityService } from '../domain/data-inventory/services/activity.service.js';
import type { ActivityQueryFilter } from '../domain/data-inventory/models/processing-activity.js';
import { eventPublisher, EventTypes } from '../lib/events.js';

const activityRoutes = new Hono();

// ===========================================================================
// Validation Schemas
// ===========================================================================

const lawfulBasisSchema = z.enum([
  'CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST',
]);

const dataCategorySchema = z.enum([
  'BASIC_IDENTITY', 'CONTACT_DETAILS', 'FINANCIAL', 'EMPLOYMENT', 'EDUCATION',
  'ONLINE_IDENTIFIERS', 'LOCATION', 'BEHAVIORAL', 'PREFERENCES', 'DEVICE_DATA',
  'COMMUNICATION', 'IMAGES', 'AUDIO_VIDEO', 'OTHER',
]);

const specialCategorySchema = z.enum([
  'RACIAL_ETHNIC_ORIGIN', 'POLITICAL_OPINIONS', 'RELIGIOUS_BELIEFS', 'TRADE_UNION_MEMBERSHIP',
  'GENETIC_DATA', 'BIOMETRIC_DATA', 'HEALTH_DATA', 'SEX_LIFE', 'SEXUAL_ORIENTATION', 'CRIMINAL_CONVICTIONS',
]);

const createActivitySchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  purposes: z.array(z.string()).min(1),
  lawfulBasis: z.array(lawfulBasisSchema).min(1),
  legitimateInterest: z.string().max(2000).optional(),
  dataCategories: z.array(dataCategorySchema).min(1),
  specialCategories: z.array(specialCategorySchema).optional(),
  subjectCategories: z.array(z.string()).min(1),
  controller: z.string().min(1).max(255),
});

const updateActivitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(5000).optional(),
  purposes: z.array(z.string()).optional(),
  lawfulBasis: z.array(lawfulBasisSchema).optional(),
  legitimateInterest: z.string().max(2000).optional(),
  dataCategories: z.array(dataCategorySchema).optional(),
  specialCategories: z.array(specialCategorySchema).optional(),
  subjectCategories: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
  thirdCountryTransfers: z.array(z.string()).optional(),
  transferSafeguards: z.string().max(2000).optional(),
  retentionPeriod: z.string().max(500).optional(),
  retentionCriteria: z.string().max(1000).optional(),
  technicalMeasures: z.array(z.string()).optional(),
  organizationalMeasures: z.array(z.string()).optional(),
  dpiaRequired: z.boolean().optional(),
  dpiaReference: z.string().uuid().optional(),
  processor: z.string().max(255).optional(),
  dpo: z.string().max(255).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const entityIdParamSchema = z.object({
  entityId: z.string().uuid(),
});

// ===========================================================================
// Activity CRUD
// ===========================================================================

// Create processing activity
activityRoutes.post(
  '/',
  zValidator('json', createActivitySchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.createActivity({
      ...body,
      createdBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const activity = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.ACTIVITY_CREATED,
      'ProcessingActivity',
      activity.id,
      {
        entityId: activity.entityId,
        name: activity.name,
        purposes: activity.purposes,
        lawfulBasis: activity.lawfulBasis,
        hasSpecialCategories: activity.specialCategories && activity.specialCategories.length > 0,
      },
      userId
    );

    return c.json(activity, 201);
  }
);

// Get activity by ID
activityRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');

    const result = await service.getActivity(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

// Update activity
activityRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateActivitySchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.updateActivity(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// List activities
activityRoutes.get(
  '/',
  async (c) => {
    const service = c.get('activityService') as ActivityService;

    const filter: ActivityQueryFilter = {
      entityId: c.req.query('entityId') || undefined,
      status: c.req.query('status') as ActivityQueryFilter['status'] || undefined,
      dpiaRequired: c.req.query('dpiaRequired') === 'true' ? true :
                    c.req.query('dpiaRequired') === 'false' ? false : undefined,
      hasSpecialCategories: c.req.query('hasSpecialCategories') === 'true' ? true :
                            c.req.query('hasSpecialCategories') === 'false' ? false : undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
    };

    const result = await service.listActivities(filter);
    return c.json(result);
  }
);

// ===========================================================================
// Status Transitions
// ===========================================================================

// Activate activity (DRAFT -> ACTIVE)
activityRoutes.post(
  '/:id/activate',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');

    const result = await service.activateActivity(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const activity = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.ACTIVITY_ACTIVATED,
      'ProcessingActivity',
      activity.id,
      {
        entityId: activity.entityId,
        name: activity.name,
        activatedAt: new Date(),
      }
    );

    return c.json(activity);
  }
);

// Suspend activity
activityRoutes.post(
  '/:id/suspend',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');

    const result = await service.suspendActivity(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const activity = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.ACTIVITY_SUSPENDED,
      'ProcessingActivity',
      activity.id,
      {
        entityId: activity.entityId,
        name: activity.name,
        suspendedAt: new Date(),
      }
    );

    return c.json(activity);
  }
);

// Archive activity
activityRoutes.post(
  '/:id/archive',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');

    const result = await service.archiveActivity(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const activity = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.ACTIVITY_ARCHIVED,
      'ProcessingActivity',
      activity.id,
      {
        entityId: activity.entityId,
        name: activity.name,
        archivedAt: new Date(),
      }
    );

    return c.json(activity);
  }
);

// ===========================================================================
// Review & DPIA
// ===========================================================================

// Record annual review
activityRoutes.post(
  '/:id/review',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');
    const userId = c.get('userId') || 'system';

    const result = await service.recordReview(id, userId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Link DPIA to activity
activityRoutes.post(
  '/:id/link-dpia',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({ dpiaReference: z.string().uuid() })),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { id } = c.req.valid('param');
    const { dpiaReference } = c.req.valid('json');

    const result = await service.linkDPIA(id, dpiaReference);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Reports
// ===========================================================================

// Get activities due for review
activityRoutes.get(
  '/due-for-review',
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const entityId = c.req.query('entityId') || undefined;

    const result = await service.getReviewDueReport(entityId);
    return c.json(result);
  }
);

// Get Article 30 summary for entity
activityRoutes.get(
  '/summary/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('activityService') as ActivityService;
    const { entityId } = c.req.valid('param');

    const summary = await service.getArticle30Summary(entityId);
    return c.json(summary);
  }
);

export { activityRoutes };
