/**
 * RabbitMQ Event Bus
 * Unified pub/sub implementation combining publisher and subscriber
 */

import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import amqplib from 'amqplib';
import type { DomainEvent, EventHandler, MessageBrokerConfig } from './types.js';
import type { EventBus } from './event-bus.js';

export interface RabbitMQEventBusConfig extends MessageBrokerConfig {
  exchange?: string;
  exchangeType?: 'topic' | 'direct' | 'fanout';
  queue?: string;
  prefetch?: number;
  deadLetterExchange?: string;
  confirmMode?: boolean;
  serviceName: string;
}

export class RabbitMQEventBus implements EventBus {
  private connection: ChannelModel | null = null;
  private publishChannel: Channel | null = null;
  private consumeChannel: Channel | null = null;
  private readonly config: RabbitMQEventBusConfig;
  private readonly exchange: string;
  private readonly exchangeType: 'topic' | 'direct' | 'fanout';
  private readonly queueName: string;
  private readonly prefetch: number;
  private readonly deadLetterExchange: string;
  private readonly confirmMode: boolean;
  private handlers: Map<string, EventHandler[]> = new Map();
  private _connected = false;
  private consuming = false;

  constructor(config: RabbitMQEventBusConfig) {
    this.config = config;
    this.exchange = config.exchange ?? 'ecosystem.events';
    this.exchangeType = config.exchangeType ?? 'topic';
    this.queueName = config.queue ?? `${config.serviceName}.events`;
    this.prefetch = config.prefetch ?? 10;
    this.deadLetterExchange = config.deadLetterExchange ?? 'ecosystem.events.dlx';
    this.confirmMode = config.confirmMode ?? true;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    try {
      this.connection = await amqplib.connect(this.config.url);

      // Create separate channels for publishing and consuming
      if (this.confirmMode) {
        this.publishChannel = await this.connection.createConfirmChannel();
      } else {
        this.publishChannel = await this.connection.createChannel();
      }
      this.consumeChannel = await this.connection.createChannel();

      // Set prefetch for fair dispatch
      await this.consumeChannel.prefetch(this.prefetch);

      // Declare the main exchange
      await this.publishChannel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });

      // Declare dead letter exchange
      await this.consumeChannel.assertExchange(this.deadLetterExchange, 'topic', {
        durable: true,
      });

      // Declare the queue with dead letter routing
      await this.consumeChannel.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': this.deadLetterExchange,
        },
      });

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error(`[EventBus:${this.config.serviceName}] Connection error:`, err);
        this._connected = false;
      });

      this.connection.on('close', () => {
        console.warn(`[EventBus:${this.config.serviceName}] Connection closed`);
        this._connected = false;
      });

      this._connected = true;
      console.log(`[EventBus:${this.config.serviceName}] Connected to RabbitMQ`);
    } catch (error) {
      console.error(`[EventBus:${this.config.serviceName}] Failed to connect:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected) {
      return;
    }

    try {
      if (this.publishChannel) {
        await this.publishChannel.close();
        this.publishChannel = null;
      }
      if (this.consumeChannel) {
        await this.consumeChannel.close();
        this.consumeChannel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this._connected = false;
      this.consuming = false;
      console.log(`[EventBus:${this.config.serviceName}] Disconnected from RabbitMQ`);
    } catch (error) {
      console.error(`[EventBus:${this.config.serviceName}] Error during disconnect:`, error);
      throw error;
    }
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    if (!this.publishChannel) {
      throw new Error('Not connected to RabbitMQ');
    }

    const message = Buffer.from(JSON.stringify(event));
    const routingKey = event.type;

    const published = this.publishChannel.publish(
      this.exchange,
      routingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        timestamp: event.occurredAt.getTime(),
        headers: {
          'x-event-type': event.type,
          'x-aggregate-type': event.aggregateType,
          'x-aggregate-id': event.aggregateId,
          'x-correlation-id': event.metadata.correlationId,
          'x-source': event.metadata.source,
        },
      }
    );

    if (!published) {
      throw new Error('Failed to publish message - channel buffer full');
    }

    console.log(`[EventBus:${this.config.serviceName}] Published: ${event.type}`, {
      id: event.id,
      aggregateId: event.aggregateId,
    });
  }

  async publishMany<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  async subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void> {
    if (!this.consumeChannel) {
      throw new Error('Not connected to RabbitMQ');
    }

    // Register handler locally
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);

    // Bind queue to exchange for this event type
    await this.consumeChannel.bindQueue(this.queueName, this.exchange, eventType);

    console.log(`[EventBus:${this.config.serviceName}] Subscribed to: ${eventType}`);
  }

  async unsubscribe(eventType: string): Promise<void> {
    if (!this.consumeChannel) {
      return;
    }

    this.handlers.delete(eventType);
    await this.consumeChannel.unbindQueue(this.queueName, this.exchange, eventType);

    console.log(`[EventBus:${this.config.serviceName}] Unsubscribed from: ${eventType}`);
  }

  /**
   * Start consuming messages from the queue
   * Call this after registering all handlers
   */
  async startConsuming(): Promise<void> {
    if (!this.consumeChannel) {
      throw new Error('Not connected to RabbitMQ');
    }

    if (this.consuming) {
      console.warn(`[EventBus:${this.config.serviceName}] Already consuming`);
      return;
    }

    const channel = this.consumeChannel;

    await channel.consume(
      this.queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          const event = JSON.parse(msg.content.toString()) as DomainEvent;
          const eventType = event.type;

          console.log(`[EventBus:${this.config.serviceName}] Received: ${eventType}`, {
            id: event.id,
            aggregateId: event.aggregateId,
          });

          // Dispatch to handlers
          const handlers = this.handlers.get(eventType) || [];

          // Also check for wildcard handlers (e.g., "entity-governance.*")
          for (const [pattern, patternHandlers] of this.handlers) {
            if (pattern.includes('*') && this.matchesPattern(eventType, pattern)) {
              handlers.push(...patternHandlers);
            }
          }

          if (handlers.length === 0) {
            console.warn(`[EventBus:${this.config.serviceName}] No handlers for: ${eventType}`);
          }

          await Promise.all(handlers.map(handler => handler.handle(event)));

          // Acknowledge the message
          channel.ack(msg);
        } catch (error) {
          console.error(`[EventBus:${this.config.serviceName}] Error processing message:`, error);
          // Reject and don't requeue (will go to DLX)
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    this.consuming = true;
    console.log(`[EventBus:${this.config.serviceName}] Started consuming from: ${this.queueName}`);
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(eventType);
  }
}

/**
 * Create a configured RabbitMQ event bus
 */
export function createRabbitMQEventBus(
  url: string,
  serviceName: string,
  options?: Partial<Omit<RabbitMQEventBusConfig, 'url' | 'serviceName'>>
): RabbitMQEventBus {
  return new RabbitMQEventBus({
    url,
    serviceName,
    ...options,
  });
}
