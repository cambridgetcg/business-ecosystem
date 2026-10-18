/**
 * Obligation Reminder Job
 *
 * Scheduled job to check for upcoming obligation due dates
 * and create/send reminder notifications
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { NotificationService, createNotificationService } from '../services/notification-service.js';
import { getEventPublisher } from '../events/index.js';

const log = logger.child({ component: 'obligation-reminder-job' });

export interface ObligationReminderConfig {
  reminderDays: number[];  // Days before due date to send reminders
  defaultRecipients?: string[];
}

const DEFAULT_CONFIG: ObligationReminderConfig = {
  reminderDays: [30, 14, 7, 3, 1],
};

export async function runObligationReminders(
  prisma: PrismaClient,
  config: ObligationReminderConfig = DEFAULT_CONFIG
): Promise<{ processed: number; notified: number }> {
  const notificationService = createNotificationService(prisma);
  const publisher = getEventPublisher();

  let processed = 0;
  let notified = 0;

  for (const daysAhead of config.reminderDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    targetDate.setHours(23, 59, 59, 999);

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const obligations = await prisma.obligation.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: {
          gte: startOfDay,
          lte: targetDate,
        },
        contract: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      include: {
        contract: {
          include: {
            parties: {
              include: { party: true },
            },
          },
        },
      },
    });

    for (const obligation of obligations) {
      processed++;

      const contract = obligation.contract;
      const daysUntilDue = Math.ceil(
        (obligation.dueDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Get recipients from contract parties or use defaults
      const recipients = contract.parties
        .map((p) => p.party.primaryEmail)
        .filter((email): email is string => !!email);

      if (recipients.length === 0 && config.defaultRecipients) {
        recipients.push(...config.defaultRecipients);
      }

      if (recipients.length === 0) {
        log.warn(
          { obligationId: obligation.id, contractId: contract.id },
          'No recipients found for obligation reminder'
        );
        continue;
      }

      try {
        // Create and send notification
        const notification = await notificationService.createObligationReminder(
          contract.id,
          contract.contractNumber,
          obligation.id,
          obligation.type,
          obligation.description,
          obligation.dueDate!,
          daysUntilDue,
          recipients
        );

        await notificationService.sendNotification(notification.id);

        // Publish event
        await publisher.publishObligationDue({
          obligationId: obligation.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          type: obligation.type,
          description: obligation.description,
          dueDate: obligation.dueDate!.toISOString(),
          daysUntilDue,
          responsiblePartyId: obligation.responsiblePartyId ?? undefined,
        });

        notified++;

        log.info(
          {
            obligationId: obligation.id,
            contractId: contract.id,
            daysUntilDue,
            recipientCount: recipients.length,
          },
          'Obligation reminder sent'
        );
      } catch (error) {
        log.error(
          { error, obligationId: obligation.id },
          'Failed to send obligation reminder'
        );
      }
    }
  }

  log.info({ processed, notified }, 'Obligation reminder job completed');
  return { processed, notified };
}

export async function markOverdueObligations(
  prisma: PrismaClient
): Promise<number> {
  const result = await prisma.obligation.updateMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lt: new Date() },
    },
    data: {
      status: 'OVERDUE',
    },
  });

  if (result.count > 0) {
    log.info({ count: result.count }, 'Marked obligations as overdue');
  }

  return result.count;
}
