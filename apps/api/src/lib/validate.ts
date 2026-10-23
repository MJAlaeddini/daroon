import type { ZodType } from 'zod';
import { AppError } from './errors';

/** Parses a request part with a zod schema; failures become a 400 with the first issue's path. */
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new AppError(400, 'invalid_input', `${i.path.join('.') || 'body'}: ${i.message}`);
  }
  return r.data;
}
