/**
 * Trade Secret Command Handler
 * Handles commands for trade secret operations and publishes domain events.
 */

import type { TradeSecretRepository } from '../../infrastructure/persistence/trade-secret.repository.js';
import { TradeSecret } from '../../domain/entities/trade-secret.entity.js';
import type {
  CreateTradeSecretCommand,
  GrantAccessCommand,
  RevokeAccessCommand,
  DiscloseTradeSecretCommand,
  AbandonTradeSecretCommand,
  ConvertToPatentCommand,
  UpdateReviewDateCommand,
  UpdateEstimatedValueCommand,
  AssignCustodianCommand,
  UpdateSensitivityLevelCommand,
  DeleteTradeSecretCommand,
} from '../commands/trade-secret.commands.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export class TradeSecretCommandHandler {
  constructor(
    private readonly repository: TradeSecretRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async createTradeSecret(command: CreateTradeSecretCommand): Promise<TradeSecret> {
    const tradeSecret = TradeSecret.create({
      title: command.title,
      description: command.description,
      category: command.category,
      sensitivityLevel: command.sensitivityLevel,
      ownerId: command.ownerId,
      identifiedDate: command.identifiedDate,
      economicValueDescription: command.economicValueDescription,
      ...(command.custodianId && { custodianId: command.custodianId }),
      ...(command.estimatedValue && { estimatedValue: command.estimatedValue }),
    });

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretCreated', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        title: tradeSecret.title,
        category: tradeSecret.category,
        sensitivityLevel: tradeSecret.sensitivityLevel,
        ownerId: tradeSecret.ownerId,
      });
    }

    return tradeSecret;
  }

  async grantAccess(command: GrantAccessCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.grantAccess(
      command.userId,
      command.accessLevel,
      command.grantedBy,
      command.actorId
    );

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretAccessGranted', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        userId: command.userId,
        accessLevel: command.accessLevel,
        grantedBy: command.grantedBy,
      });
    }

    return tradeSecret;
  }

  async revokeAccess(command: RevokeAccessCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.revokeAccess(command.userId, command.actorId);

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretAccessRevoked', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        userId: command.userId,
      });
    }

    return tradeSecret;
  }

  async discloseTradeSecret(command: DiscloseTradeSecretCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.markAsDisclosed(command.reason, command.actorId);

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretDisclosed', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        title: tradeSecret.title,
        reason: command.reason,
      });
    }

    return tradeSecret;
  }

  async abandonTradeSecret(command: AbandonTradeSecretCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.abandon(command.actorId);

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretAbandoned', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        title: tradeSecret.title,
      });
    }

    return tradeSecret;
  }

  async convertToPatent(command: ConvertToPatentCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.convertToPatent(command.actorId);

    await this.repository.save(tradeSecret);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TradeSecretConvertedToPatent', tradeSecret.id, {
        tradeSecretId: tradeSecret.id,
        title: tradeSecret.title,
        patentApplicationId: command.patentApplicationId,
      });
    }

    return tradeSecret;
  }

  async updateReviewDate(command: UpdateReviewDateCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.updateReviewDate(command.reviewDate, command.actorId);

    await this.repository.save(tradeSecret);

    return tradeSecret;
  }

  async updateEstimatedValue(command: UpdateEstimatedValueCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.updateEstimatedValue(command.estimatedValue, command.actorId);

    await this.repository.save(tradeSecret);

    return tradeSecret;
  }

  async assignCustodian(command: AssignCustodianCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.assignCustodian(command.custodianId, command.actorId);

    await this.repository.save(tradeSecret);

    return tradeSecret;
  }

  async updateSensitivityLevel(command: UpdateSensitivityLevelCommand): Promise<TradeSecret> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    tradeSecret.updateSensitivityLevel(command.sensitivityLevel, command.actorId);

    await this.repository.save(tradeSecret);

    return tradeSecret;
  }

  async deleteTradeSecret(command: DeleteTradeSecretCommand): Promise<void> {
    const tradeSecret = await this.repository.findById(command.tradeSecretId);
    if (!tradeSecret) {
      throw new Error('Trade secret not found: ' + command.tradeSecretId);
    }

    await this.repository.delete(command.tradeSecretId);
  }
}
