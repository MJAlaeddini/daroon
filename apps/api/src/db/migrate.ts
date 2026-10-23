import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './client';

/** The SQL migrations live in apps/api/drizzle (generated with `pnpm db:generate`). */
export function migrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, here.endsWith('dist') ? '../drizzle' : '../../drizzle');
}
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
}
