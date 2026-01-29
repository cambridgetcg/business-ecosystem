/**
 * Validation utilities and helpers
 */

import { z, type ZodSchema, type ZodError } from 'zod';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

export class ValidationException extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.errors = errors;
  }

  static fromZodError(error: ZodError): ValidationException {
    return new ValidationException(formatZodErrors(error));
  }
}

// Schema composition helpers
export function withId<T extends ZodSchema>(schema: T) {
  return z.object({ id: z.string().uuid() }).merge(schema as unknown as z.ZodObject<z.ZodRawShape>);
}

export function withTimestamps<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.extend({
    createdAt: z.date(),
    updatedAt: z.date(),
  });
}

export function withSoftDelete<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.extend({
    deletedAt: z.date().nullable(),
    deletedBy: z.string().nullable(),
  });
}
