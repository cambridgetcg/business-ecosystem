/**
 * Event Publisher for outbound messaging
 */

import type { DomainEvent, MessageBrokerConfig } from './types.js';

export interface EventPublisher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish<T>(event: DomainEvent<T>): Promise<void>;
  publishToTopic<T>(topic: string, event: DomainEvent<T>): Promise<void>;
}

export abstract class BaseEventPublisher implements EventPublisher {
  protected config: MessageBrokerConfig;
  protected _connected = false;

  constructor(config: MessageBrokerConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract publish<T>(event: DomainEvent<T>): Promise<void>;
  abstract publishToTopic<T>(topic: string, event: DomainEvent<T>): Promise<void>;

  protected serializeEvent<T>(event: DomainEvent<T>): string {
    return JSON.stringify(event);
  }
}
