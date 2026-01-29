/**
 * Shareholder Command Handler
 */

import type { ShareholderRepository } from '../../domain/shareholder/repositories/shareholder-repository.js';
import type { LegalEntityRepository } from '../../domain/entity/repositories/legal-entity-repository.js';
import type { Shareholder } from '../../domain/shareholder/models/shareholder.js';
import type { EventPublisher } from '../../infrastructure/integration/event-publisher.js';
import { EntityEventTypes } from '../../domain/events/entity-events.js';
import type {
  AddShareholderCommand,
  UpdateShareholderCommand,
  RemoveShareholderCommand,
} from '../commands/shareholder-commands.js';

export class ShareholderCommandHandler {
  constructor(
    private readonly shareholderRepository: ShareholderRepository,
    private readonly entityRepository: LegalEntityRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async addShareholder(command: AddShareholderCommand): Promise<Shareholder> {
    // Verify entity exists
    const entityExists = await this.entityRepository.exists(command.entityId);
    if (!entityExists) {
      throw new Error('Entity not found: ' + command.entityId);
    }

    const shareholder = await this.shareholderRepository.create(
      {
        entityId: command.entityId,
        shareholderType: command.shareholderType,
        name: command.name,
        taxId: command.taxId,
        contactEmail: command.contactEmail,
        address: command.address,
        metadata: command.metadata,
      },
      command.actorId
    );

    if (this.eventPublisher) {
      await this.eventPublisher.publish(EntityEventTypes.SHARES_ISSUED, command.entityId, {
        entityId: command.entityId,
        shareholderId: shareholder.id,
        shareholderName: shareholder.name,
        shareholderType: shareholder.shareholderType,
      });
    }

    return shareholder;
  }

  async updateShareholder(command: UpdateShareholderCommand): Promise<Shareholder> {
    const existing = await this.shareholderRepository.findById(command.shareholderId);
    if (!existing) {
      throw new Error('Shareholder not found: ' + command.shareholderId);
    }

    const shareholder = await this.shareholderRepository.update(
      command.shareholderId,
      {
        name: command.name,
        taxId: command.taxId,
        contactEmail: command.contactEmail,
        address: command.address,
        metadata: command.metadata,
      },
      command.actorId
    );

    return shareholder;
  }

  async removeShareholder(command: RemoveShareholderCommand): Promise<void> {
    const existing = await this.shareholderRepository.findById(command.shareholderId);
    if (!existing) {
      throw new Error('Shareholder not found: ' + command.shareholderId);
    }

    await this.shareholderRepository.delete(command.shareholderId, command.actorId);
  }
}
