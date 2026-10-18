/**
 * Security Headers Middleware
 * Implements OWASP security header recommendations
 */

import type { Context, Next } from 'hono';

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /**
   * Enable Content Security Policy
   * @default true
   */
  enableCSP?: boolean;

  /**
   * Custom CSP directives
   */
  cspDirectives?: Record<string, string>;

  /**
   * Enable HSTS (HTTP Strict Transport Security)
   * @default true
   */
  enableHSTS?: boolean;

  /**
   * HSTS max age in seconds
   * @default 31536000 (1 year)
   */
  hstsMaxAge?: number;

  /**
   * Enable frame options
   * @default true
   */
  enableFrameOptions?: boolean;

  /**
   * Frame options value
   * @default 'DENY'
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN';
}

const defaultConfig: Required<SecurityHeadersConfig> = {
  enableCSP: true,
  cspDirectives: {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline' https://unpkg.com",  // For Swagger UI
    'style-src': "'self' 'unsafe-inline' https://unpkg.com",   // For Swagger UI
    'img-src': "'self' data: https:",
    'font-src': "'self' https:",
    'connect-src': "'self'",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
  },
  enableHSTS: true,
  hstsMaxAge: 31536000,
  enableFrameOptions: true,
  frameOptions: 'DENY',
};

/**
 * Build CSP header string from directives
 */
function buildCSP(directives: Record<string, string>): string {
  return Object.entries(directives)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
}

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  return async (c: Context, next: Next) => {
    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // XSS protection (legacy browsers)
    c.header('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy (disable unnecessary features)
    c.header('Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()');

    // Frame options
    if (mergedConfig.enableFrameOptions) {
      c.header('X-Frame-Options', mergedConfig.frameOptions);
    }

    // Content Security Policy
    if (mergedConfig.enableCSP) {
      const csp = buildCSP({
        ...defaultConfig.cspDirectives,
        ...mergedConfig.cspDirectives,
      });
      c.header('Content-Security-Policy', csp);
    }

    // HSTS (only in production with HTTPS)
    if (mergedConfig.enableHSTS && process.env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security',
        `max-age=${mergedConfig.hstsMaxAge}; includeSubDomains`);
    }

    // Cache control for API responses
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');

    await next();
  };
}

/**
 * API-specific security headers (stricter CSP)
 */
export function apiSecurityHeaders() {
  return securityHeaders({
    enableCSP: true,
    cspDirectives: {
      'default-src': "'none'",
      'frame-ancestors': "'none'",
    },
  });
}
