/**
 * Legal Entity Command Handler
 *
 * Handles commands for legal entity operations and publishes domain events.
 */

import type { LegalEntityRepository } from '../../domain/entity/repositories/legal-entity-repository.js';
import type { LegalEntity } from '../../domain/entity/models/legal-entity.js';
import { canDissolve } from '../../domain/entity/models/legal-entity.js';
import type { EventPublisher } from '../../infrastructure/integration/event-publisher.js';
import { EntityEventTypes } from '../../domain/events/entity-events.js';
import type {
  CreateLegalEntityCommand,
  UpdateLegalEntityCommand,
  DissolveLegalEntityCommand,
} from '../commands/index.js';

export class LegalEntityCommandHandler {
  constructor(
    private readonly repository: LegalEntityRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async createLegalEntity(command: CreateLegalEntityCommand): Promise<LegalEntity> {
    const entity = await this.repository.create(
      {
        name: command.name,
        legalName: command.legalName,
        entityType: command.entityType,
        jurisdictionCountry: command.jurisdictionCountry,
        jurisdictionState: command.jurisdictionState,
        incorporationDate: command.incorporationDate,
        taxId: command.taxId,
        registrationNumber: command.registrationNumber,
        metadata: command.metadata,
      },
      command.actorId
    );

    if (this.eventPublisher) {
      await this.eventPublisher.publish(EntityEventTypes.ENTITY_CREATED, entity.id, {
        entityId: entity.id,
        name: entity.name,
        legalName: entity.legalName,
        entityType: entity.entityType,
        jurisdictionCountry: entity.jurisdiction.country,
        jurisdictionState: entity.jurisdiction.state,
        incorporationDate: entity.incorporationDate,
        taxId: entity.taxId,
        registrationNumber: entity.registrationNumber,
      });
    }

    return entity;
  }

  async updateLegalEntity(command: UpdateLegalEntityCommand): Promise<LegalEntity> {
    const existing = await this.repository.findById(command.entityId);
    if (!existing) {
      throw new Error('Entity not found: ' + command.entityId);
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (command.name !== undefined && command.name !== existing.name) {
      changes['name'] = { old: existing.name, new: command.name };
    }
    if (command.legalName !== undefined && command.legalName !== existing.legalName) {
      changes['legalName'] = { old: existing.legalName, new: command.legalName };
    }
    if (command.status !== undefined && command.status !== existing.status) {
      changes['status'] = { old: existing.status, new: command.status };
    }

    const entity = await this.repository.update(
      command.entityId,
      {
        name: command.name,
        legalName: command.legalName,
        status: command.status,
        taxId: command.taxId,
        registrationNumber: command.registrationNumber,
        metadata: command.metadata,
      },
      command.actorId
    );

    if (this.eventPublisher && Object.keys(changes).length > 0) {
      await this.eventPublisher.publish(EntityEventTypes.ENTITY_UPDATED, entity.id, {
        entityId: entity.id,
        changes,
      });
    }

    return entity;
  }

  async dissolveLegalEntity(command: DissolveLegalEntityCommand): Promise<LegalEntity> {
    const existing = await this.repository.findById(command.entityId);
    if (!existing) {
      throw new Error('Entity not found: ' + command.entityId);
    }

    if (!canDissolve(existing)) {
      throw new Error('Entity cannot be dissolved in current status: ' + existing.status);
    }

    const entity = await this.repository.update(
      command.entityId,
      { status: 'dissolved' },
      command.actorId
    );

    if (this.eventPublisher) {
      await this.eventPublisher.publish(EntityEventTypes.ENTITY_DISSOLVED, entity.id, {
        entityId: entity.id,
        dissolutionDate: command.dissolutionDate,
        reason: command.reason,
      });
    }

    return entity;
  }

  async deleteLegalEntity(entityId: string, actorId?: string): Promise<void> {
    const existing = await this.repository.findById(entityId);
    if (!existing) {
      throw new Error('Entity not found: ' + entityId);
    }

    await this.repository.delete(entityId, actorId);
  }
}
