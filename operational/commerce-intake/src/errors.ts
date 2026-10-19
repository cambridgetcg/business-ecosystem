import { z } from 'zod';

/** An input, contract or spool error: the CLI exits 2 and nothing is written. */
export class IntakeError extends Error {
  override name = 'IntakeError';

  constructor(
    message: string,
    readonly details: Record<string, string> = {}
  ) {
    super(message);
  }
}

/** One line per issue, each with its path, so a refused record says where and why. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join('; ');
}
