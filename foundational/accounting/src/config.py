"""
Application configuration using pydantic-settings.

Configuration is loaded from environment variables with sensible defaults.
Supports .env files for local development.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database connection settings."""

    model_config = SettingsConfigDict(env_prefix="DB_")

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="accounting", description="Database name")
    user: str = Field(default="accounting", description="Database user")
    password: str = Field(default="", description="Database password")
    pool_size: int = Field(default=10, description="Connection pool size")
    pool_overflow: int = Field(default=20, description="Max overflow connections")
    echo: bool = Field(default=False, description="Echo SQL statements")

    @computed_field
    @property
    def url(self) -> str:
        """Construct async database URL."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.user,
                password=self.password,
                host=self.host,
                port=self.port,
                path=self.name,
            )
        )

    @computed_field
    @property
    def sync_url(self) -> str:
        """Construct sync database URL (for Alembic migrations)."""
        return str(
            PostgresDsn.build(
                scheme="postgresql",
                username=self.user,
                password=self.password,
                host=self.host,
                port=self.port,
                path=self.name,
            )
        )


class AWSSettings(BaseSettings):
    """AWS configuration settings."""

    model_config = SettingsConfigDict(env_prefix="AWS_")

    region: str = Field(default="us-east-1", description="AWS region")
    access_key_id: str | None = Field(default=None, description="AWS access key ID")
    secret_access_key: str | None = Field(default=None, description="AWS secret access key")
    endpoint_url: str | None = Field(default=None, description="Custom endpoint (for LocalStack)")


class MessagingSettings(BaseSettings):
    """Event messaging configuration settings."""

    model_config = SettingsConfigDict(env_prefix="MESSAGING_")

    enabled: bool = Field(default=True, description="Enable event publishing")
    provider: Literal["in_memory", "sns", "rabbitmq"] = Field(
        default="in_memory", description="Messaging provider"
    )

    # SNS settings
    sns_topic_arn: str | None = Field(
        default=None, description="SNS topic ARN for domain events"
    )
    sns_topic_name: str = Field(
        default="accounting-events", description="SNS topic name"
    )

    # SQS settings for consuming events
    sqs_banking_queue_url: str | None = Field(
        default=None, description="SQS queue URL for banking-treasury events"
    )
    sqs_compliance_queue_url: str | None = Field(
        default=None, description="SQS queue URL for compliance events"
    )

    # RabbitMQ settings (for local/hybrid deployments)
    rabbitmq_url: str = Field(
        default="amqp://guest:guest@localhost:5672/",
        description="RabbitMQ connection URL"
    )
    rabbitmq_exchange: str = Field(
        default="ecosystem.events", description="RabbitMQ exchange name"
    )


class Settings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = Field(default="Accounting System", description="Application name")
    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Deployment environment"
    )
    debug: bool = Field(default=False, description="Debug mode")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO", description="Logging level"
    )

    # API
    api_prefix: str = Field(default="/api/v1", description="API route prefix")
    api_host: str = Field(default="0.0.0.0", description="API host")
    api_port: int = Field(default=8000, description="API port")

    # Security
    secret_key: str = Field(
        default="CHANGE-ME-IN-PRODUCTION",
        description="Secret key for signing",
    )
    allowed_origins: list[str] = Field(
        default=["http://localhost:3000"],
        description="CORS allowed origins",
    )

    # Accounting defaults
    default_currency: str = Field(default="USD", description="Default currency code")
    decimal_precision: int = Field(default=4, description="Decimal places for amounts")
    fiscal_year_start_month: int = Field(
        default=1, ge=1, le=12, description="Fiscal year start month"
    )

    # Import settings
    max_import_file_size_mb: int = Field(
        default=100, ge=1, le=1000, description="Maximum import file size in MB"
    )
    max_import_rows: int = Field(
        default=100000, ge=1, description="Maximum rows per import file"
    )

    # Rate limiting
    rate_limit_enabled: bool = Field(
        default=True, description="Enable rate limiting"
    )
    rate_limit_requests: int = Field(
        default=100, ge=1, description="Maximum requests per window"
    )
    rate_limit_window_seconds: int = Field(
        default=60, ge=1, description="Rate limit window in seconds"
    )
    rate_limit_import_requests: int = Field(
        default=10, ge=1, description="Maximum import requests per window"
    )
    rate_limit_import_window_seconds: int = Field(
        default=60, ge=1, description="Import rate limit window in seconds"
    )

    # Authentication
    api_keys: str | None = Field(
        default=None,
        description="Comma-separated API key:user_id pairs (e.g., 'key1:user1,key2:user2')",
    )
    admin_users: str | None = Field(
        default=None,
        description="Comma-separated list of admin user IDs",
    )

    @computed_field
    @property
    def max_import_file_size_bytes(self) -> int:
        """Maximum import file size in bytes."""
        return self.max_import_file_size_mb * 1024 * 1024

    # Nested settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    aws: AWSSettings = Field(default_factory=AWSSettings)
    messaging: MessagingSettings = Field(default_factory=MessagingSettings)

    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
