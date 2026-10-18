/**
 * Notification Worker
 *
 * BullMQ worker for processing notification jobs including:
 * - Obligation reminders
 * - Renewal alerts
 * - Expiry warnings
 * - Scheduled notifications
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { NotificationService, createNotificationService } from '../services/notification-service.js';
import { getEventPublisher } from '../events/index.js';

export interface NotificationJobData {
  type: 'SEND_NOTIFICATION' | 'OBLIGATION_REMINDER' | 'RENEWAL_CHECK' | 'EXPIRY_CHECK';
  notificationId?: string;
  contractId?: string;
  obligationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ObligationReminderData {
  type: 'OBLIGATION_REMINDER';
  obligationId: string;
  contractId: string;
  contractNumber: string;
  obligationType: string;
  description: string;
  dueDate: string;
  daysUntilDue: number;
  recipients: string[];
}

export interface RenewalCheckData {
  type: 'RENEWAL_CHECK';
  daysAhead: number;
}

export interface ExpiryCheckData {
  type: 'EXPIRY_CHECK';
  daysAhead: number;
}

const QUEUE_NAME = 'contracts-legal:notifications';
const log = logger.child({ component: 'notification-worker' });

export class NotificationWorker {
  private worker: Worker | null = null;
  private queue: Queue | null = null;
  private connection: Redis | null = null;
  private notificationService: NotificationService;

  constructor(
    private prisma: PrismaClient,
    redisUrl?: string
  ) {
    this.notificationService = createNotificationService(prisma);

    if (redisUrl || process.env.REDIS_URL) {
      this.connection = new Redis(redisUrl || process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });
    }
  }

  async start(): Promise<void> {
    if (!this.connection) {
      log.warn('Redis not configured - notification worker disabled');
      return;
    }

    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<NotificationJobData>) => {
        return this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      log.info({ jobId: job.id, type: job.data.type }, 'Job completed');
    });

    this.worker.on('failed', (job, error) => {
      log.error({ jobId: job?.id, type: job?.data.type, error }, 'Job failed');
    });

    log.info('Notification worker started');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
    log.info('Notification worker stopped');
  }

  async scheduleNotification(
    notificationId: string,
    delay?: number
  ): Promise<string | undefined> {
    if (!this.queue) {
      log.warn('Queue not available - cannot schedule notification');
      return undefined;
    }

    const job = await this.queue.add(
      'send-notification',
      { type: 'SEND_NOTIFICATION', notificationId },
      { delay }
    );

    return job.id;
  }

  async scheduleObligationReminder(
    data: Omit<ObligationReminderData, 'type'>
  ): Promise<string | undefined> {
    if (!this.queue) {
      log.warn('Queue not available - cannot schedule obligation reminder');
      return undefined;
    }

    const job = await this.queue.add('obligation-reminder', {
      type: 'OBLIGATION_REMINDER',
      ...data,
    });

    return job.id;
  }

  async scheduleRenewalCheck(daysAhead: number = 30): Promise<string | undefined> {
    if (!this.queue) {
      return undefined;
    }

    const job = await this.queue.add(
      'renewal-check',
      { type: 'RENEWAL_CHECK', daysAhead },
      { repeat: { pattern: '0 8 * * *' } } // Daily at 8am
    );

    return job.id;
  }

  async scheduleExpiryCheck(daysAhead: number = 90): Promise<string | undefined> {
    if (!this.queue) {
      return undefined;
    }

    const job = await this.queue.add(
      'expiry-check',
      { type: 'EXPIRY_CHECK', daysAhead },
      { repeat: { pattern: '0 9 * * *' } } // Daily at 9am
    );

    return job.id;
  }

  private async processJob(job: Job<NotificationJobData>): Promise<void> {
    log.info({ jobId: job.id, type: job.data.type }, 'Processing job');

    switch (job.data.type) {
      case 'SEND_NOTIFICATION':
        await this.processSendNotification(job.data.notificationId!);
        break;

      case 'OBLIGATION_REMINDER':
        await this.processObligationReminder(job.data as unknown as ObligationReminderData);
        break;

      case 'RENEWAL_CHECK':
        await this.processRenewalCheck((job.data as unknown as RenewalCheckData).daysAhead);
        break;

      case 'EXPIRY_CHECK':
        await this.processExpiryCheck((job.data as unknown as ExpiryCheckData).daysAhead);
        break;

      default:
        log.warn({ type: job.data.type }, 'Unknown job type');
    }
  }

  private async processSendNotification(notificationId: string): Promise<void> {
    const result = await this.notificationService.sendNotification(notificationId);

    if (!result.success) {
      throw new Error(result.error);
    }
  }

  private async processObligationReminder(data: ObligationReminderData): Promise<void> {
    const notification = await this.notificationService.createObligationReminder(
      data.contractId,
      data.contractNumber,
      data.obligationId,
      data.obligationType,
      data.description,
      new Date(data.dueDate),
      data.daysUntilDue,
      data.recipients
    );

    await this.notificationService.sendNotification(notification.id);

    // Publish event
    const publisher = getEventPublisher();
    await publisher.publishObligationDue({
      obligationId: data.obligationId,
      contractId: data.contractId,
      contractNumber: data.contractNumber,
      type: data.obligationType,
      description: data.description,
      dueDate: data.dueDate,
      daysUntilDue: data.daysUntilDue,
      responsiblePartyId: undefined,
    });
  }

  private async processRenewalCheck(daysAhead: number): Promise<void> {
    const contracts = await this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: {
          lte: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
        OR: [
          { autoRenewal: true },
          { renewalTermDays: { not: null } },
        ],
      },
      include: {
        parties: {
          include: { party: true },
        },
      },
    });

    for (const contract of contracts) {
      const daysUntilExpiry = Math.ceil(
        (contract.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const recipients = contract.parties
        .map((p) => p.party.primaryEmail)
        .filter((email): email is string => !!email);

      if (recipients.length > 0) {
        const notification = await this.notificationService.createRenewalReminder(
          contract.id,
          contract.contractNumber,
          contract.title,
          contract.expiryDate!,
          daysUntilExpiry,
          contract.autoRenewal,
          recipients
        );

        await this.notificationService.sendNotification(notification.id);
      }
    }

    log.info({ checked: contracts.length, daysAhead }, 'Renewal check completed');
  }

  private async processExpiryCheck(daysAhead: number): Promise<void> {
    const contracts = await this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        autoRenewal: false,
        expiryDate: {
          lte: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: {
        parties: {
          include: { party: true },
        },
      },
    });

    for (const contract of contracts) {
      const daysUntilExpiry = Math.ceil(
        (contract.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const recipients = contract.parties
        .map((p) => p.party.primaryEmail)
        .filter((email): email is string => !!email);

      if (recipients.length > 0) {
        const notification = await this.notificationService.createExpiryWarning(
          contract.id,
          contract.contractNumber,
          contract.title,
          contract.expiryDate!,
          daysUntilExpiry,
          recipients
        );

        await this.notificationService.sendNotification(notification.id);
      }

      // Publish event
      const publisher = getEventPublisher();
      await publisher.publishContractExpiring({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        expiryDate: contract.expiryDate!.toISOString(),
        daysUntilExpiry,
        autoRenewal: contract.autoRenewal,
        renewalNoticeDays: contract.renewalNoticeDays ?? undefined,
        partyIds: contract.parties.map((p) => p.partyId),
      });
    }

    log.info({ checked: contracts.length, daysAhead }, 'Expiry check completed');
  }
}

export function createNotificationWorker(
  prisma: PrismaClient,
  redisUrl?: string
): NotificationWorker {
  return new NotificationWorker(prisma, redisUrl);
}
