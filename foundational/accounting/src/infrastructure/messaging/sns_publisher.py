"""
AWS SNS Event Publisher for production deployments.

Publishes domain events to AWS SNS topics for cross-service communication.
Supports message attributes for filtering and routing.

Research Grounding: MISSION.md (ecosystem integration requirements)
"""

import json
from datetime import datetime, timezone
from typing import Any

import aioboto3
import structlog

from src.config import Settings, get_settings
from src.infrastructure.messaging.events import DomainEvent
from src.infrastructure.messaging.publisher import IEventPublisher, PublishError


logger = structlog.get_logger()


class SNSEventPublisher:
    """
    AWS SNS event publisher for production event distribution.

    Features:
    - Publishes domain events to SNS topics
    - Adds message attributes for filtering
    - Supports batch publishing for efficiency
    - Handles retries and errors gracefully
    - Compatible with SQS subscriptions for fan-out

    Usage:
        publisher = SNSEventPublisher(settings)
        await publisher.publish(JournalEntryPosted(...))
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """
        Initialize the SNS publisher.

        Args:
            settings: Application settings with AWS and messaging config
        """
        self.settings = settings or get_settings()
        self._session = aioboto3.Session(
            aws_access_key_id=self.settings.aws.access_key_id,
            aws_secret_access_key=self.settings.aws.secret_access_key,
            region_name=self.settings.aws.region,
        )
        self._topic_arn = self.settings.messaging.sns_topic_arn

    async def publish(self, event: DomainEvent) -> None:
        """
        Publish a single domain event to SNS.

        Args:
            event: The domain event to publish

        Raises:
            PublishError: If publishing fails after retries
        """
        if not self.settings.messaging.enabled:
            logger.debug("Messaging disabled, skipping event publish", event_type=event.event_type)
            return

        if not self._topic_arn:
            logger.warning("SNS topic ARN not configured, skipping event publish")
            return

        try:
            message = self._serialize_event(event)
            attributes = self._build_message_attributes(event)

            async with self._session.client(
                "sns",
                endpoint_url=self.settings.aws.endpoint_url,
            ) as sns:
                response = await sns.publish(
                    TopicArn=self._topic_arn,
                    Message=message,
                    MessageAttributes=attributes,
                    MessageGroupId=event.metadata.correlation_id or event.event_id,
                    MessageDeduplicationId=event.event_id,
                )

            logger.info(
                "domain_event_published_sns",
                event_type=event.event_type,
                event_id=event.event_id,
                message_id=response.get("MessageId"),
                correlation_id=event.metadata.correlation_id,
            )

        except Exception as e:
            logger.error(
                "sns_publish_failed",
                event_type=event.event_type,
                event_id=event.event_id,
                error=str(e),
            )
            raise PublishError(
                message=f"Failed to publish event to SNS: {e}",
                event_type=event.event_type,
                original_error=e,
            )

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """
        Publish multiple events in a batch.

        Note: SNS doesn't support native batching, so this iterates.
        Consider using SQS for true batch operations.

        Args:
            events: List of domain events to publish
        """
        errors: list[tuple[DomainEvent, Exception]] = []

        for event in events:
            try:
                await self.publish(event)
            except Exception as e:
                errors.append((event, e))

        if errors:
            error_types = [e.event_type for e, _ in errors]
            raise PublishError(
                message=f"Failed to publish {len(errors)} event(s): {error_types}",
                event_type="batch",
            )

    def _serialize_event(self, event: DomainEvent) -> str:
        """Serialize event to JSON string."""
        return json.dumps(event.to_dict(), default=self._json_serializer)

    def _json_serializer(self, obj: Any) -> Any:
        """Custom JSON serializer for datetime and other types."""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    def _build_message_attributes(self, event: DomainEvent) -> dict[str, dict[str, str]]:
        """
        Build SNS message attributes for filtering.

        These attributes allow SQS subscribers to filter messages
        based on event type, source, etc.
        """
        attributes = {
            "event_type": {
                "DataType": "String",
                "StringValue": event.event_type,
            },
            "source": {
                "DataType": "String",
                "StringValue": event.metadata.source,
            },
            "version": {
                "DataType": "Number",
                "StringValue": str(event.metadata.version),
            },
        }

        if event.metadata.correlation_id:
            attributes["correlation_id"] = {
                "DataType": "String",
                "StringValue": event.metadata.correlation_id,
            }

        if event.metadata.user_id:
            attributes["user_id"] = {
                "DataType": "String",
                "StringValue": event.metadata.user_id,
            }

        return attributes


class SQSEventConsumer:
    """
    AWS SQS event consumer for receiving events from other services.

    Polls SQS queues for domain events and dispatches to handlers.

    Usage:
        consumer = SQSEventConsumer(settings)
        consumer.register_handler("banking.payment.completed", handle_payment)
        await consumer.start()
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the SQS consumer."""
        self.settings = settings or get_settings()
        self._session = aioboto3.Session(
            aws_access_key_id=self.settings.aws.access_key_id,
            aws_secret_access_key=self.settings.aws.secret_access_key,
            region_name=self.settings.aws.region,
        )
        self._handlers: dict[str, list] = {}
        self._running = False

    def register_handler(self, event_type: str, handler) -> None:
        """
        Register a handler for an event type.

        Args:
            event_type: The event type to handle (e.g., "banking.payment.completed")
            handler: Async function to call when event is received
        """
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def process_message(self, message: dict) -> None:
        """
        Process a single SQS message.

        Args:
            message: The SQS message to process
        """
        try:
            body = json.loads(message.get("Body", "{}"))

            # Handle SNS envelope if present
            if "Message" in body:
                body = json.loads(body["Message"])

            event_type = body.get("event_type")
            if not event_type:
                logger.warning("Received message without event_type", message_id=message.get("MessageId"))
                return

            handlers = self._handlers.get(event_type, [])
            handlers.extend(self._handlers.get("*", []))

            for handler in handlers:
                try:
                    await handler(body)
                except Exception as e:
                    logger.error(
                        "event_handler_error",
                        event_type=event_type,
                        handler=handler.__name__,
                        error=str(e),
                    )

            logger.info(
                "domain_event_processed",
                event_type=event_type,
                event_id=body.get("event_id"),
                handlers_count=len(handlers),
            )

        except json.JSONDecodeError as e:
            logger.error("invalid_message_json", error=str(e))
        except Exception as e:
            logger.error("message_processing_error", error=str(e))

    async def poll_queue(self, queue_url: str, max_messages: int = 10) -> list[dict]:
        """
        Poll an SQS queue for messages.

        Args:
            queue_url: The SQS queue URL to poll
            max_messages: Maximum messages to receive (1-10)

        Returns:
            List of received messages
        """
        async with self._session.client(
            "sqs",
            endpoint_url=self.settings.aws.endpoint_url,
        ) as sqs:
            response = await sqs.receive_message(
                QueueUrl=queue_url,
                MaxNumberOfMessages=min(max_messages, 10),
                WaitTimeSeconds=20,  # Long polling
                MessageAttributeNames=["All"],
            )
            return response.get("Messages", [])

    async def delete_message(self, queue_url: str, receipt_handle: str) -> None:
        """Delete a processed message from the queue."""
        async with self._session.client(
            "sqs",
            endpoint_url=self.settings.aws.endpoint_url,
        ) as sqs:
            await sqs.delete_message(
                QueueUrl=queue_url,
                ReceiptHandle=receipt_handle,
            )

    async def start(self, queue_url: str) -> None:
        """
        Start polling the queue for messages.

        Args:
            queue_url: The SQS queue URL to poll
        """
        self._running = True
        logger.info("sqs_consumer_started", queue_url=queue_url)

        while self._running:
            try:
                messages = await self.poll_queue(queue_url)
                for message in messages:
                    await self.process_message(message)
                    await self.delete_message(queue_url, message["ReceiptHandle"])
            except Exception as e:
                logger.error("sqs_poll_error", error=str(e))

    def stop(self) -> None:
        """Stop the consumer."""
        self._running = False
        logger.info("sqs_consumer_stopped")
