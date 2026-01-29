/**
 * Event Bus abstraction for pub/sub messaging
 */

import type { DomainEvent, EventHandler, EventSubscription } from './types.js';

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  publishMany<T>(events: DomainEvent<T>[]): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(eventType: string): Promise<void>;
}

export abstract class BaseEventBus implements EventBus {
  protected subscriptions: Map<string, EventSubscription[]> = new Map();

  abstract publish<T>(event: DomainEvent<T>): Promise<void>;
  
  async publishMany<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  abstract subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void>;
  abstract unsubscribe(eventType: string): Promise<void>;

  protected addSubscription(subscription: EventSubscription): void {
    const existing = this.subscriptions.get(subscription.eventType) || [];
    existing.push(subscription);
    this.subscriptions.set(subscription.eventType, existing);
  }
}
