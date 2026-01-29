/**
 * Dependency Injection Barrel Export
 *
 * @module core/di
 */

export { TOKENS, getToken, type TokenKey } from './tokens.js';
export {
  initializeContainer,
  registerServices,
  getContainer,
  resolve,
  isRegistered,
  createChildContainer,
  clearContainer,
  registerMock,
  type ContainerConfig,
} from './container.js';
