/**
 * Validation decorators for class-based validation
 */

import type { ZodSchema } from 'zod';
import { validateOrThrow, ValidationException } from './validators.js';

// Method decorator for validating method arguments
export function ValidateArgs(schemas: Record<number, ZodSchema>) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = function (...args: unknown[]) {
      for (const [index, schema] of Object.entries(schemas)) {
        const argIndex = parseInt(index, 10);
        if (args[argIndex] !== undefined) {
          args[argIndex] = validateOrThrow(schema, args[argIndex]);
        }
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Method decorator for validating return value
export function ValidateReturn(schema: ZodSchema) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args);
      return validateOrThrow(schema, result);
    };

    return descriptor;
  };
}
