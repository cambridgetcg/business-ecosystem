/**
 * Trademark Command Handler
 * Handles commands for trademark operations and publishes domain events.
 */

import type { TrademarkRepository } from '../../infrastructure/persistence/trademark.repository.js';
import { Trademark } from '../../domain/entities/trademark.entity.js';
import type {
  CreateTrademarkCommand,
  UpdateTrademarkCommand,
  FileTrademarkCommand,
  RegisterTrademarkCommand,
  RenewTrademarkCommand,
  AddNiceClassCommand,
  OpposeTrademarkCommand,
  CancelTrademarkCommand,
  DeleteTrademarkCommand,
} from '../commands/index.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export class TrademarkCommandHandler {
  constructor(
    private readonly repository: TrademarkRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async createTrademark(command: CreateTrademarkCommand): Promise<Trademark> {
    const trademark = Trademark.create({
      mark: command.mark,
      description: command.description,
      type: command.type,
      ownerId: command.ownerId,
      niceClasses: command.niceClasses,
      jurisdictions: command.jurisdictions,
      logoUrl: command.logoUrl,
    });

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkCreated', trademark.id, {
        trademarkId: trademark.id,
        mark: trademark.mark,
        type: trademark.type,
        ownerId: trademark.ownerId,
      });
    }

    return trademark;
  }

  async updateTrademark(command: UpdateTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    // Note: Trademark entity may need update methods added for description/logoUrl
    // For now, we save as-is after fetching
    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkUpdated', trademark.id, {
        trademarkId: trademark.id,
        description: command.description,
        logoUrl: command.logoUrl,
      });
    }

    return trademark;
  }

  async fileTrademark(command: FileTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.file(command.applicationNumber, command.filingDate, command.actorId);

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkFiled', trademark.id, {
        trademarkId: trademark.id,
        applicationNumber: command.applicationNumber,
        filingDate: command.filingDate,
        mark: trademark.mark,
        type: trademark.type,
      });
    }

    return trademark;
  }

  async registerTrademark(command: RegisterTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.register(
      command.registrationNumber,
      command.registrationDate,
      command.expirationDate,
      command.actorId
    );

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkRegistered', trademark.id, {
        trademarkId: trademark.id,
        registrationNumber: command.registrationNumber,
        applicationNumber: trademark.applicationNumber,
        mark: trademark.mark,
        registrationDate: command.registrationDate,
        expirationDate: command.expirationDate,
      });
    }

    return trademark;
  }

  async renewTrademark(command: RenewTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.renew(command.newExpirationDate, command.actorId);

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkRenewed', trademark.id, {
        trademarkId: trademark.id,
        registrationNumber: trademark.registrationNumber,
        mark: trademark.mark,
        newExpirationDate: command.newExpirationDate,
      });
    }

    return trademark;
  }

  async addNiceClass(command: AddNiceClassCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.addNiceClass(command.niceClass, command.actorId);

    await this.repository.save(trademark);

    return trademark;
  }

  async opposeTrademark(command: OpposeTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.oppose(command.actorId);

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkOpposed', trademark.id, {
        trademarkId: trademark.id,
        mark: trademark.mark,
        applicationNumber: trademark.applicationNumber,
      });
    }

    return trademark;
  }

  async cancelTrademark(command: CancelTrademarkCommand): Promise<Trademark> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    trademark.cancel(command.actorId);

    await this.repository.save(trademark);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('TrademarkCancelled', trademark.id, {
        trademarkId: trademark.id,
        mark: trademark.mark,
        registrationNumber: trademark.registrationNumber,
      });
    }

    return trademark;
  }

  async deleteTrademark(command: DeleteTrademarkCommand): Promise<void> {
    const trademark = await this.repository.findById(command.trademarkId);
    if (!trademark) {
      throw new Error('Trademark not found: ' + command.trademarkId);
    }

    await this.repository.delete(command.trademarkId);
  }
}
