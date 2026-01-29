/**
 * Event Subscriber for inbound messaging
 */

import type { DomainEvent, EventHandler, MessageBrokerConfig } from './types.js';

export interface EventSubscriber {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void>;
  subscribeToTopic<T>(topic: string, handler: EventHandler<T>): Promise<void>;
}

export abstract class BaseEventSubscriber implements EventSubscriber {
  protected config: MessageBrokerConfig;
  protected connected = false;
  protected handlers: Map<string, EventHandler[]> = new Map();

  constructor(config: MessageBrokerConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void>;
  abstract subscribeToTopic<T>(topic: string, handler: EventHandler<T>): Promise<void>;

  protected deserializeEvent<T>(message: string): DomainEvent<T> {
    return JSON.parse(message) as DomainEvent<T>;
  }

  protected async dispatchToHandlers<T>(eventType: string, event: DomainEvent<T>): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    await Promise.all(handlers.map(handler => handler.handle(event)));
  }
}
