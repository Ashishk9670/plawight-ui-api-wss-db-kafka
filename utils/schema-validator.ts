import type { ZodTypeAny, z } from 'zod';

/** Parses `data` with a zod schema and throws one readable error listing every violation. */
export function validate<S extends ZodTypeAny>(schema: S, data: unknown, label = 'payload'): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Schema validation failed for ${label}:\n${issues}\nActual: ${JSON.stringify(data)}`);
  }
  return result.data;
}
