/**
 * RabbitMQ Event Publisher
 * Concrete implementation for publishing events to RabbitMQ
 */

import type { Channel, ChannelModel, ConfirmChannel } from 'amqplib';
import amqplib from 'amqplib';
import type { DomainEvent, MessageBrokerConfig } from './types.js';
import { BaseEventPublisher } from './publisher.js';

export interface RabbitMQPublisherConfig extends MessageBrokerConfig {
  exchange?: string;
  exchangeType?: 'topic' | 'direct' | 'fanout';
  confirmMode?: boolean;
}

export class RabbitMQPublisher extends BaseEventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;
  private readonly exchangeType: 'topic' | 'direct' | 'fanout';
  private readonly confirmMode: boolean;

  constructor(config: RabbitMQPublisherConfig) {
    super(config);
    this.exchange = config.exchange ?? 'ecosystem.events';
    this.exchangeType = config.exchangeType ?? 'topic';
    this.confirmMode = config.confirmMode ?? true;
  }

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    try {
      this.connection = await amqplib.connect(this.config.url);

      if (this.confirmMode) {
        this.channel = await this.connection.createConfirmChannel();
      } else {
        this.channel = await this.connection.createChannel();
      }

      // Declare the exchange
      await this.channel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('[RabbitMQPublisher] Connection error:', err);
        this._connected = false;
      });

      this.connection.on('close', () => {
        console.warn('[RabbitMQPublisher] Connection closed');
        this._connected = false;
      });

      this._connected = true;
      console.log('[RabbitMQPublisher] Connected to RabbitMQ');
    } catch (error) {
      console.error('[RabbitMQPublisher] Failed to connect:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected) {
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
      this._connected = false;
      console.log('[RabbitMQPublisher] Disconnected from RabbitMQ');
    } catch (error) {
      console.error('[RabbitMQPublisher] Error during disconnect:', error);
      throw error;
    }
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    // Use event type as routing key
    await this.publishToTopic(event.type, event);
  }

  async publishToTopic<T>(topic: string, event: DomainEvent<T>): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    const message = Buffer.from(this.serializeEvent(event));

    const published = this.channel.publish(
      this.exchange,
      topic,
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

    // In confirmMode connect() opened a confirm channel: wait for the broker's
    // ack, so a nacked message or a closed channel rejects the publish.
    if (this.confirmMode) {
      await (this.channel as ConfirmChannel).waitForConfirms();
    }

    console.log(`[RabbitMQPublisher] Published event: ${event.type}`, {
      id: event.id,
      aggregateId: event.aggregateId,
      topic,
    });
  }
}

/**
 * Create a configured RabbitMQ publisher
 */
export function createRabbitMQPublisher(
  url: string,
  options?: Partial<Omit<RabbitMQPublisherConfig, 'url'>>
): RabbitMQPublisher {
  return new RabbitMQPublisher({
    url,
    ...options,
  });
}
