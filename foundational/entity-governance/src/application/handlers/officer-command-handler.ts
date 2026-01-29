/**
 * Officer Command Handler
 *
 * Handles commands for officer operations and publishes domain events.
 */

import type { OfficerRepository } from '../../domain/officer/repositories/officer-repository.js';
import type { LegalEntityRepository } from '../../domain/entity/repositories/legal-entity-repository.js';
import type { Officer } from '../../domain/officer/models/officer.js';
import { canTerminate } from '../../domain/officer/models/officer.js';
import type { EventPublisher } from '../../infrastructure/integration/event-publisher.js';
import { EntityEventTypes } from '../../domain/events/entity-events.js';
import type {
  AppointOfficerCommand,
  UpdateOfficerCommand,
  TerminateOfficerCommand,
} from '../commands/officer-commands.js';

export class OfficerCommandHandler {
  constructor(
    private readonly officerRepository: OfficerRepository,
    private readonly entityRepository: LegalEntityRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async appointOfficer(command: AppointOfficerCommand): Promise<Officer> {
    // Verify entity exists
    const entityExists = await this.entityRepository.exists(command.entityId);
    if (!entityExists) {
      throw new Error('Entity not found: ' + command.entityId);
    }

    // Check if title already filled (for some roles like CEO, only one allowed)
    const exclusiveTitles = ['ceo', 'cfo', 'coo', 'cto', 'president'];
    if (exclusiveTitles.includes(command.title)) {
      const exists = await this.officerRepository.existsByTitle(command.entityId, command.title);
      if (exists) {
        throw new Error(`Entity already has an active ${command.title.toUpperCase()}`);
      }
    }

    const officer = await this.officerRepository.create(
      {
        entityId: command.entityId,
        personId: command.personId,
        name: command.name,
        title: command.title,
        customTitle: command.customTitle,
        email: command.email,
        appointmentDate: command.appointmentDate,
        compensationAmount: command.compensationAmount,
        metadata: command.metadata,
      },
      command.actorId
    );

    if (this.eventPublisher) {
      await this.eventPublisher.publish(EntityEventTypes.OFFICER_APPOINTED, command.entityId, {
        entityId: command.entityId,
        officerId: officer.id,
        personId: officer.personId,
        title: officer.title,
        appointmentDate: officer.appointmentDate,
      });
    }

    return officer;
  }

  async updateOfficer(command: UpdateOfficerCommand): Promise<Officer> {
    const existing = await this.officerRepository.findById(command.officerId);
    if (!existing) {
      throw new Error('Officer not found: ' + command.officerId);
    }

    if (existing.terminationDate !== null) {
      throw new Error('Cannot update terminated officer');
    }

    // Check title uniqueness if changing title
    if (command.title && command.title !== existing.title) {
      const exclusiveTitles = ['ceo', 'cfo', 'coo', 'cto', 'president'];
      if (exclusiveTitles.includes(command.title)) {
        const exists = await this.officerRepository.existsByTitle(existing.entityId, command.title);
        if (exists) {
          throw new Error(`Entity already has an active ${command.title.toUpperCase()}`);
        }
      }
    }

    const officer = await this.officerRepository.update(
      command.officerId,
      {
        title: command.title,
        customTitle: command.customTitle,
        email: command.email,
        compensationAmount: command.compensationAmount,
        metadata: command.metadata,
      },
      command.actorId
    );

    return officer;
  }

  async terminateOfficer(command: TerminateOfficerCommand): Promise<Officer> {
    const existing = await this.officerRepository.findById(command.officerId);
    if (!existing) {
      throw new Error('Officer not found: ' + command.officerId);
    }

    if (!canTerminate(existing)) {
      throw new Error('Officer is already terminated');
    }

    const officer = await this.officerRepository.terminate(
      command.officerId,
      command.terminationDate,
      command.actorId
    );

    if (this.eventPublisher) {
      await this.eventPublisher.publish(EntityEventTypes.OFFICER_TERMINATED, existing.entityId, {
        entityId: existing.entityId,
        officerId: officer.id,
        personId: officer.personId,
        terminationDate: command.terminationDate,
        reason: command.reason,
      });
    }

    return officer;
  }

  async deleteOfficer(officerId: string, actorId?: string): Promise<void> {
    const existing = await this.officerRepository.findById(officerId);
    if (!existing) {
      throw new Error('Officer not found: ' + officerId);
    }

    await this.officerRepository.delete(officerId, actorId);
  }
}
