/**
 * Example: Setting up Event Bus in a service
 *
 * This shows the recommended pattern for integrating the Event Bus
 * into a Fastify-based service.
 */

import Fastify from 'fastify';
import {
  createEventBus,
  createHandlerRegistry,
  createDomainEvent,
  type DomainEvent,
  type EventBusHandle,
} from '@ecosystem/messaging';

// ==========================================================================
// 1. Define your event handlers
// ==========================================================================

const registry = createHandlerRegistry()
  // Handle entity creation events from entity-governance
  .register(
    'entity-governance.entity.created',
    async (event: DomainEvent<{ entityId: string; name: string }>) => {
      console.log(`Entity created: ${event.payload.name}`);
      // Do something: create default accounts, trigger KYC check, etc.
    },
    { name: 'EntityCreatedHandler' }
  )

  // Handle payment events from banking-treasury
  .register(
    'banking-treasury.payment.completed',
    async (event: DomainEvent<{ paymentId: string; amount: number }>) => {
      console.log(`Payment completed: $${event.payload.amount}`);
      // Do something: update ledger, send notification, etc.
    },
    { name: 'PaymentCompletedHandler' }
  )

  // Handle multiple event types with one handler
  .registerForTypes(
    ['kyc.verification.passed', 'kyc.verification.failed'],
    async (event: DomainEvent<{ personId: string; status: string }>) => {
      console.log(`KYC status changed: ${event.payload.status}`);
    },
    { name: 'KYCStatusHandler' }
  );

// ==========================================================================
// 2. Create the event bus
// ==========================================================================

let eventBusHandle: EventBusHandle;

async function setupEventBus(rabbitmqUrl?: string) {
  eventBusHandle = await createEventBus({
    serviceName: 'my-service',
    rabbitmqUrl, // If undefined, uses InMemoryEventBus
    handlers: registry,
    autoStart: true, // Start consuming immediately
  });

  return eventBusHandle;
}

// ==========================================================================
// 3. Integrate with Fastify
// ==========================================================================

async function buildApp() {
  const app = Fastify({ logger: true });

  // Set up event bus (use env var for RabbitMQ URL)
  const { bus } = await setupEventBus(process.env.RABBITMQ_URL);

  // Example: Publish an event from a route handler
  app.post('/entities', async (request, reply) => {
    const { name } = request.body as { name: string };

    // Create the entity (your business logic here)
    const entityId = crypto.randomUUID();

    // Publish domain event
    await bus.publish(
      createDomainEvent(
        'my-service.entity.created',
        entityId,
        'Entity',
        { entityId, name },
        {
          correlationId: request.id,
          source: 'my-service',
        }
      )
    );

    return reply.status(201).send({ id: entityId, name });
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await eventBusHandle.stop();
    app.log.info('Event bus disconnected');
  });

  return app;
}

// ==========================================================================
// 4. Testing example
// ==========================================================================

import { createTestEventBus, InMemoryEventBus } from '@ecosystem/messaging';

async function runTests() {
  // Create a test event bus (synchronous, captures events)
  const testBus = createTestEventBus();

  // Register a test handler
  const receivedEvents: DomainEvent[] = [];
  await testBus.subscribe('test.event', {
    handle: async (event) => {
      receivedEvents.push(event);
    },
  });

  // Publish a test event
  await testBus.publish(
    createDomainEvent('test.event', '123', 'TestAggregate', { foo: 'bar' })
  );

  // Assert
  console.assert(testBus.hasPublished('test.event'), 'Event should be published');
  console.assert(receivedEvents.length === 1, 'Handler should receive event');
  console.assert(
    testBus.getEventsOfType('test.event')[0].payload.foo === 'bar',
    'Payload should match'
  );

  console.log('All tests passed!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
