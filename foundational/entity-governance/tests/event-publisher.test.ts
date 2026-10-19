/**
 * Entity events as src/api/rest/app.ts publishes them: EntityEventPublisher
 * over @ecosystem/messaging's RabbitMQPublisher in confirm mode. Covers what
 * #14 changed in messaging: in confirm mode a publish waits for the broker's
 * ack, so a nacked message rejects it.
 *
 * connect() would open an AMQP connection and then a confirm (or plain)
 * channel. The publisher is never connected here: it is handed a stub channel
 * that records each publish and acks or nacks it, so nothing touches the
 * network.
 */
import { createRabbitMQPublisher } from '@ecosystem/messaging';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityEventTypes } from '../src/domain/events/entity-events.js';
import { createEventPublisher } from '../src/infrastructure/integration/event-publisher.js';

interface Published {
  exchange: string;
  routingKey: string;
  body: Record<string, unknown>;
  options: { headers: Record<string, string>; messageId: string; persistent: boolean };
}

const broker = {
  published: [] as Published[],
  confirm: (): Promise<void> => Promise.resolve(),
};

const channel = {
  publish: (
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Published['options']
  ) => {
    const body = JSON.parse(content.toString()) as Record<string, unknown>;
    broker.published.push({ exchange, routingKey, body, options });
    return true;
  },
  waitForConfirms: () => broker.confirm(),
};

const ENTITY = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function publisher(confirmMode = true) {
  const rabbit = createRabbitMQPublisher('amqp://broker.invalid', {
    exchange: 'ecosystem.events',
    exchangeType: 'topic',
    confirmMode,
  });
  // The stub takes the place of RabbitMQPublisher's private channel field. If
  // messaging renames that field, fail here rather than on a confusing publish.
  expect(rabbit).toHaveProperty('channel', null);
  Object.assign(rabbit, { channel });
  return createEventPublisher(rabbit);
}

beforeEach(() => {
  broker.published = [];
  broker.confirm = () => Promise.resolve();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('entity events over RabbitMQ in confirm mode', () => {
  it('publishes to the topic exchange under the event type, with tracing headers', async () => {
    const events = publisher();
    await events.publish(EntityEventTypes.ENTITY_CREATED, ENTITY, { name: 'Acme Ltd' });

    const [message] = broker.published;
    // The workflow engine's entity-onboarding workflow triggers on this key.
    expect(message?.routingKey).toBe('entity-governance.entity.created');
    expect(message?.exchange).toBe('ecosystem.events');
    expect(message?.body).toMatchObject({
      type: 'entity-governance.entity.created',
      aggregateId: ENTITY,
      aggregateType: 'LegalEntity',
      payload: { name: 'Acme Ltd' },
      version: 1,
    });
    expect(message?.options.persistent).toBe(true);
    expect(message?.options.messageId).toBe(message?.body.id);
    expect(message?.options.headers).toMatchObject({
      'x-event-type': 'entity-governance.entity.created',
      'x-aggregate-type': 'LegalEntity',
      'x-aggregate-id': ENTITY,
      'x-source': 'entity-governance',
    });
  });

  it('rejects the publish when the broker nacks it', async () => {
    const events = publisher();
    broker.confirm = () => Promise.reject(new Error('message nacked'));
    await expect(
      events.publish(EntityEventTypes.ENTITY_DISSOLVED, ENTITY, { reason: 'merger' })
    ).rejects.toThrow('message nacked');
  });

  it('gives every event of a batch the same correlation id, and each batch its own', async () => {
    const events = publisher();
    const batch = [
      { type: EntityEventTypes.ENTITY_CREATED, aggregateId: ENTITY, payload: {} },
      { type: EntityEventTypes.ENTITY_UPDATED, aggregateId: ENTITY, payload: {} },
    ];
    await events.publishMany(batch);
    await events.publishMany(batch);
    const correlation = broker.published.map(
      (m) => (m.body.metadata as { correlationId: string }).correlationId
    );
    expect(correlation).toHaveLength(4);
    expect(correlation[1]).toBe(correlation[0]);
    expect(correlation[3]).toBe(correlation[2]);
    expect(correlation[2]).not.toBe(correlation[0]);
  });

  it.each([
    [EntityEventTypes.OWNERSHIP_CHANGED, 'CorporateStructure'],
    [EntityEventTypes.DIRECTOR_APPOINTED, 'Governance'],
    [EntityEventTypes.SHARES_TRANSFERRED, 'Shareholder'],
    [EntityEventTypes.FILING_OVERDUE, 'Compliance'],
  ])('files %s under the %s aggregate', async (type, aggregateType) => {
    await publisher().publish(type, ENTITY, {});
    expect(broker.published[0]?.options.headers['x-aggregate-type']).toBe(aggregateType);
  });

  it('does not wait for the broker without confirm mode', async () => {
    const events = publisher(false);
    broker.confirm = () => Promise.reject(new Error('should not be awaited'));
    await events.publish(EntityEventTypes.ENTITY_CREATED, ENTITY, {});
    expect(broker.published).toHaveLength(1);
  });
});
