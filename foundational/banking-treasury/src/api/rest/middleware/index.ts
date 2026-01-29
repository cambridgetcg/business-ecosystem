/**
 * Middleware Barrel Export
 *
 * @module api/rest/middleware
 */

export { createErrorHandler, notFoundHandler } from './error-handler.js';
export {
  registerContextMiddleware,
  getContext,
  resolveFromContext,
  type RequestContext,
} from './context.js';
