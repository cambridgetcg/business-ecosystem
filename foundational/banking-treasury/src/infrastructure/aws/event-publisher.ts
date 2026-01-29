/**
 * AWS SNS Event Publisher
 * 
 * Publishes domain events to SNS for cross-domain integration.
 * Supports message attributes for filtering by subscribers.
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { awsConfig } from './config.js';
import type { DomainEvent } from '../../domain/events/domain-event.js';

const client = new SNSClient({ region: awsConfig.region });

export class EventPublisher {
  private topicArn: string;

  constructor(topicArn: string = awsConfig.sns.bankingTreasuryEvents) {
    this.topicArn = topicArn;
  }

  async publish(event: DomainEvent): Promise<string> {
    const command = new PublishCommand({
      TopicArn: this.topicArn,
      Message: JSON.stringify(event),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.type,
        },
        aggregateType: {
          DataType: 'String',
          StringValue: event.aggregateType,
        },
        aggregateId: {
          DataType: 'String',
          StringValue: event.aggregateId,
        },
      },
    });

    const response = await client.send(command);
    return response.MessageId ?? '';
  }

  async publishAll(events: DomainEvent[]): Promise<string[]> {
    const messageIds: string[] = [];
    
    for (const event of events) {
      const id = await this.publish(event);
      messageIds.push(id);
    }
    
    return messageIds;
  }
}

// Singleton instance
export const eventPublisher = new EventPublisher();
