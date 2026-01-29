/**
 * Base entity for IP domain objects
 * Pattern from: scripts/templates/service/src/domain/base-entity.ts.template
 */

import { randomUUID } from 'crypto';
import type { DomainEvent } from '../events/domain-event.js';

export abstract class Entity {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public createdBy: string | undefined;
  public updatedBy: string | undefined;
  public version: number;
  public deletedAt: Date | undefined;

  protected constructor(id?: string) {
    this.id = id ?? randomUUID();
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.createdBy = undefined;
    this.updatedBy = undefined;
    this.version = 1;
    this.deletedAt = undefined;
  }

  public equals(other: Entity): boolean {
    if (!(other instanceof Entity)) return false;
    return this.id === other.id;
  }

  public isDeleted(): boolean {
    return this.deletedAt !== undefined;
  }

  public touch(userId?: string): void {
    this.updatedAt = new Date();
    if (userId !== undefined) {
      this.updatedBy = userId;
    }
    this.version += 1;
  }
}

export abstract class AggregateRoot extends Entity {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }
}

export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
