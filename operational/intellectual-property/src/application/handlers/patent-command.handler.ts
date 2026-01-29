/**
 * Patent Command Handler
 * Handles commands for patent operations and publishes domain events.
 */

import type { PatentRepository } from '../../infrastructure/persistence/patent.repository.js';
import { Patent } from '../../domain/entities/patent.entity.js';
import type {
  CreatePatentCommand,
  UpdatePatentCommand,
  FilePatentCommand,
  GrantPatentCommand,
  AbandonPatentCommand,
  AddPatentClaimCommand,
  AssignPatentCommand,
  DeletePatentCommand,
} from '../commands/index.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export class PatentCommandHandler {
  constructor(
    private readonly repository: PatentRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async createPatent(command: CreatePatentCommand): Promise<Patent> {
    const patent = Patent.create({
      title: command.title,
      abstract: command.abstract,
      type: command.type,
      inventors: command.inventors,
      assigneeId: command.assigneeId,
      jurisdictions: command.jurisdictions,
      claims: command.claims,
    });

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentCreated', patent.id, {
        patentId: patent.id,
        title: patent.title,
        type: patent.type,
        inventors: patent.inventors,
      });
    }

    return patent;
  }

  async updatePatent(command: UpdatePatentCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    if (command.title) {
      patent.updateTitle(command.title, command.actorId);
    }

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentUpdated', patent.id, {
        patentId: patent.id,
        title: command.title,
        abstract: command.abstract,
      });
    }

    return patent;
  }

  async filePatent(command: FilePatentCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    patent.file(command.applicationNumber, command.filingDate, command.actorId);

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentFiled', patent.id, {
        patentId: patent.id,
        applicationNumber: command.applicationNumber,
        filingDate: command.filingDate,
        title: patent.title,
        type: patent.type,
        inventors: patent.inventors,
      });
    }

    return patent;
  }

  async grantPatent(command: GrantPatentCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    patent.grant(
      command.patentNumber,
      command.grantDate,
      command.expirationDate,
      command.actorId
    );

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentGranted', patent.id, {
        patentId: patent.id,
        patentNumber: command.patentNumber,
        applicationNumber: patent.applicationNumber,
        title: patent.title,
        grantDate: command.grantDate,
        expirationDate: command.expirationDate,
      });
    }

    return patent;
  }

  async abandonPatent(command: AbandonPatentCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    patent.abandon(command.reason, command.actorId);

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentAbandoned', patent.id, {
        patentId: patent.id,
        applicationNumber: patent.applicationNumber,
        patentNumber: patent.patentNumber,
        reason: command.reason,
      });
    }

    return patent;
  }

  async addClaim(command: AddPatentClaimCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    patent.addClaim({
      number: command.claim.number,
      text: command.claim.text,
      isIndependent: command.claim.isIndependent,
      dependsOn: command.claim.dependsOn,
    }, command.actorId);

    await this.repository.save(patent);

    return patent;
  }

  async assignPatent(command: AssignPatentCommand): Promise<Patent> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    const previousAssignee = patent.assigneeId;
    patent.assignTo(command.assigneeId, command.actorId);

    await this.repository.save(patent);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('PatentAssigned', patent.id, {
        patentId: patent.id,
        previousAssigneeId: previousAssignee,
        newAssigneeId: command.assigneeId,
      });
    }

    return patent;
  }

  async deletePatent(command: DeletePatentCommand): Promise<void> {
    const patent = await this.repository.findById(command.patentId);
    if (!patent) {
      throw new Error('Patent not found: ' + command.patentId);
    }

    await this.repository.delete(command.patentId);
  }
}
