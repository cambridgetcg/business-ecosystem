# Shared Config - Purpose

## Purpose

**To provide consistent, type-safe configuration management** across all services in the business ecosystem.

---

## What This Module Does

The `shared/config` module provides:

1. **Configuration schemas** — Zod-based validation for environment variables
2. **Environment handling** — Development, staging, production environment support
3. **Secret references** — Integration patterns for secret management
4. **Service discovery** — Standard configuration for locating other services

---

## Why This Exists

Without shared configuration patterns:
- Each service invents its own configuration approach
- Environment variable naming becomes inconsistent
- Configuration validation is ad-hoc or missing
- Secrets handling varies by service

With shared config:
- Consistent configuration patterns across all services
- Type-safe environment variable access
- Centralized schema definitions
- Standardized secret management integration

---

## Usage

```typescript
import { createConfig, baseConfigSchema } from '@ecosystem/config';

const config = createConfig({
  schema: baseConfigSchema.extend({
    // Service-specific configuration
    CUSTOM_SETTING: z.string(),
  }),
});

// Type-safe access
console.log(config.DATABASE_URL);
console.log(config.CUSTOM_SETTING);
```

---

## Key Principles

1. **Validation at startup** — Fail fast if configuration is invalid
2. **Type safety** — Configuration access is fully typed
3. **Environment-aware** — Different defaults for dev/staging/prod
4. **Secret integration** — Patterns for AWS Secrets Manager, Vault

---

*This module ensures configuration consistency across the ecosystem.*
