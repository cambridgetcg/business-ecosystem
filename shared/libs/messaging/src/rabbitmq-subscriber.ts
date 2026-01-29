/**
 * RabbitMQ Event Subscriber
 * Concrete implementation for consuming events from RabbitMQ
 */

import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import amqplib from 'amqplib';
import type { DomainEvent, EventHandler, MessageBrokerConfig } from './types.js';
import { BaseEventSubscriber } from './subscriber.js';

export interface RabbitMQSubscriberConfig extends MessageBrokerConfig {
  exchange?: string;
  exchangeType?: 'topic' | 'direct' | 'fanout';
  queue?: string;
  prefetch?: number;
  deadLetterExchange?: string;
}

export class RabbitMQSubscriber extends BaseEventSubscriber {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;
  private readonly exchangeType: 'topic' | 'direct' | 'fanout';
  private readonly queueName: string;
  private readonly prefetch: number;
  private readonly deadLetterExchange: string;

  constructor(config: RabbitMQSubscriberConfig) {
    super(config);
    this.exchange = config.exchange ?? 'ecosystem.events';
    this.exchangeType = config.exchangeType ?? 'topic';
    this.queueName = config.queue ?? 'workflow-engine';
    this.prefetch = config.prefetch ?? 10;
    this.deadLetterExchange = config.deadLetterExchange ?? 'ecosystem.events.dlx';
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      this.connection = await amqplib.connect(this.config.url);
      this.channel = await this.connection.createChannel();

      // Set prefetch for fair dispatch
      await this.channel.prefetch(this.prefetch);

      // Declare the main exchange
      await this.channel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });

      // Declare dead letter exchange for failed messages
      await this.channel.assertExchange(this.deadLetterExchange, 'topic', {
        durable: true,
      });

      // Declare the queue with dead letter routing
      await this.channel.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': this.deadLetterExchange,
        },
      });

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('[RabbitMQSubscriber] Connection error:', err);
        this.connected = false;
      });

      this.connection.on('close', () => {
        console.warn('[RabbitMQSubscriber] Connection closed');
        this.connected = false;
      });

      this.connected = true;
      console.log('[RabbitMQSubscriber] Connected to RabbitMQ');
    } catch (error) {
      console.error('[RabbitMQSubscriber] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.connected = false;
      console.log('[RabbitMQSubscriber] Disconnected from RabbitMQ');
    } catch (error) {
      console.error('[RabbitMQSubscriber] Error during disconnect:', error);
      throw error;
    }
  }

  async subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    // Register handler
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);

    // Bind queue to exchange for this event type
    // Use eventType as routing key (e.g., "entity-governance.entity.created")
    await this.channel.bindQueue(this.queueName, this.exchange, eventType);

    console.log(`[RabbitMQSubscriber] Subscribed to event type: ${eventType}`);
  }

  async subscribeToTopic<T>(topic: string, handler: EventHandler<T>): Promise<void> {
    // Topic subscription with wildcard support (e.g., "entity-governance.*")
    await this.subscribe(topic, handler);
  }

  /**
   * Subscribe to multiple event types with a single handler
   */
  async subscribeToMany(eventTypes: string[], handler: EventHandler): Promise<void> {
    for (const eventType of eventTypes) {
      await this.subscribe(eventType, handler);
    }
  }

  /**
   * Start consuming messages from the queue
   */
  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    const channel = this.channel;

    await channel.consume(
      this.queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          const event = this.deserializeEvent(msg.content.toString());
          const eventType = event.type;

          console.log(`[RabbitMQSubscriber] Received event: ${eventType}`, {
            id: event.id,
            aggregateId: event.aggregateId,
          });

          await this.dispatchToHandlers(eventType, event);

          // Acknowledge the message
          channel.ack(msg);
        } catch (error) {
          console.error('[RabbitMQSubscriber] Error processing message:', error);

          // Reject and don't requeue (will go to DLX)
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    console.log(`[RabbitMQSubscriber] Started consuming from queue: ${this.queueName}`);
  }
}

/**
 * Create a configured RabbitMQ subscriber
 */
export function createRabbitMQSubscriber(
  url: string,
  options?: Partial<Omit<RabbitMQSubscriberConfig, 'url'>>
): RabbitMQSubscriber {
  return new RabbitMQSubscriber({
    url,
    ...options,
  });
}
