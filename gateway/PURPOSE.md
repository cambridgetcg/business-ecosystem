# API Gateway - Purpose & Mission

## Mission Statement

**To provide a unified entry point for all business ecosystem services** — enabling secure, authenticated, and observable API access through centralized routing, rate limiting, authentication, and service discovery.

---

## The Problem We Solve

### Business Challenge

Distributed microservices architectures face:

1. **Client complexity** - Clients must know about and connect to multiple service endpoints
2. **Authentication sprawl** - Each service implementing its own auth leads to inconsistency
3. **Rate limiting gaps** - No centralized protection against abuse or denial of service
4. **Observability blindspots** - Request flows difficult to trace across services
5. **Security inconsistency** - CORS, headers, and security policies implemented differently
6. **Service discovery burden** - Clients must track service locations and health

### What This Leads To

- **Integration friction** when clients must coordinate with multiple services
- **Security vulnerabilities** from inconsistent authentication and header policies
- **Availability issues** when services are overwhelmed without rate limiting
- **Debugging nightmares** when requests cannot be traced across services
- **Operational burden** when service locations change and clients must update

---

## Our Solution

### What the API Gateway Provides

A **unified API access layer** that:

1. **Routes requests** - Single entry point with prefix-based routing to backend services
2. **Authenticates requests** - JWT validation and user context extraction
3. **Rate limits traffic** - Global and per-service rate limiting
4. **Secures headers** - CORS, Helmet, and security headers applied consistently
5. **Propagates context** - Correlation IDs, user headers, and tracing context
6. **Discovers services** - Service registry and aggregate health checks

### How It Works

```
Client Request
        |
        ├──> CORS and Helmet security headers applied
        ├──> Rate limiting checked
        ├──> JWT token validated
        ├──> Correlation ID assigned/propagated
        |
        v
Request Routing
        |
        ├──> Prefix matched to service (/api/v1/entities -> entity-governance)
        ├──> User context headers injected (x-user-id, x-user-roles)
        ├──> Request proxied to upstream service
        |
        v
Response Handling
        |
        ├──> Response returned to client
        ├──> Correlation ID in response headers
        └──> Metrics recorded for observability
```

---

## Scope & Boundaries

### In Scope

**Request Routing**
- Prefix-based routing to backend services
- Path rewriting when needed
- Service configuration management

**Authentication**
- JWT token validation
- User context extraction
- Auth requirement enforcement per route
- User header propagation to services

**Security**
- CORS policy enforcement
- Security headers (Helmet)
- Request/response sanitization
- SSL termination (in production)

**Rate Limiting**
- Global rate limits (requests per time window)
- Per-service rate limits
- Rate limit bypass for internal services

**Observability**
- Correlation ID generation and propagation
- Request ID tracking
- Request logging
- Latency metrics

**Service Management**
- Service discovery endpoint
- Aggregate health checks
- Service health monitoring

### Out of Scope

**Not the Gateway's Responsibility:**

- **Business logic** -> Individual services (gateway is a pass-through, not a processor)
- **Data transformation** -> Individual services or BFF layer
- **User management** -> Auth service (gateway validates tokens, doesn't issue them)
- **Detailed authorization** -> Individual services (gateway handles auth, services handle authz)
- **API versioning strategy** -> Individual services (gateway routes, services version)
- **Request validation** -> Individual services (gateway validates auth, services validate payload)

### Integration Points

API Gateway **provides to**:
- **All clients** - Unified entry point for ecosystem services
- **Monitoring** - Request metrics and health data

API Gateway **consumes from**:
- **All backend services** - Proxied requests
- **Auth service** - JWT secret for validation
- **Service registry** - Service configuration (if dynamic)

---

## Key Design Principles

### 1. Pass-Through Architecture

The gateway routes and secures, but doesn't transform. Business logic lives in services.

### 2. Fail-Open vs Fail-Closed

Authentication failures reject requests. Rate limit failures may allow degraded access. Health check failures remove services from routing.

### 3. Observability First

Every request gets a correlation ID. Every response includes tracing headers. Metrics are emitted for monitoring.

### 4. Zero Trust

Every request is validated. Internal services still receive authenticated context. No implicit trust based on network location.

### 5. Horizontal Scalability

Stateless design. Multiple gateway instances behind load balancer. No shared state between instances.

---

## Success Metrics

### Operational Metrics
- **Availability**: 99.99% uptime
- **Latency overhead**: <10ms added to request latency
- **Error rate**: <0.1% gateway-caused errors (5xx not from upstream)
- **Auth validation time**: <5ms for JWT validation
- **Rate limit accuracy**: 100% enforcement of configured limits

### Business Metrics
- **Client integration time**: Reduced from days to hours
- **Security consistency**: 100% of requests secured by policy
- **Observability coverage**: 100% of requests traceable via correlation ID
- **Service availability**: Aggregate health check enables rapid problem detection

---

## Non-Goals

**What We Explicitly Do Not Aim To Do:**

1. **Implement business logic** - We route, services process
2. **Transform payloads** - We pass through, services transform
3. **Cache responses** - We route, CDN/services cache
4. **Manage API versions** - We route by prefix, services version
5. **Issue auth tokens** - We validate, auth service issues

---

## Configuration

### Service Configuration

```typescript
interface ServiceConfig {
  name: string;           // Service identifier
  upstream: string;       // Backend URL (e.g., http://entity-governance:3001)
  prefix: string;         // Route prefix (e.g., /api/v1/entities)
  healthCheck?: string;   // Health endpoint path
  authRequired?: boolean; // Whether route requires authentication
  rateLimit?: {
    max: number;          // Max requests
    timeWindow: string;   // Time window (e.g., '1 minute')
  };
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Gateway listen port | 8080 |
| `JWT_SECRET` | Secret for JWT validation | - |
| `CORS_ORIGINS` | Allowed CORS origins | http://localhost:3000 |
| `LOG_LEVEL` | Logging verbosity | info |

---

## Roadmap Considerations

### Near-term Enhancements
- Dynamic service registration
- Circuit breaker for failing services
- Request/response logging toggle
- API key support for external integrations

### Long-term Vision
- GraphQL gateway federation
- WebSocket support
- API analytics dashboard
- Traffic shadowing for testing
- Canary deployment support

---

## Conclusion

The API Gateway serves as the **front door** for the business ecosystem. By providing unified routing, authentication, and observability, it enables clients to integrate with the ecosystem simply while maintaining security and operational visibility.

**Our success is measured by low latency overhead, high availability, and consistent security enforcement across all ecosystem services.**

---

*This document defines the purpose and scope of the API Gateway within the Business Ecosystem. It should be reviewed quarterly or when significant architectural changes occur.*
