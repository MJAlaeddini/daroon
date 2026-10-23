import { z } from 'zod';

/** All configuration comes from the environment and is validated once at start-up. */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  /** Public origin of the web app, e.g. https://daroon.example. Used for CSRF checks and links in mail. */
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** Secret mixed into stored login-code hashes. At least 32 characters. */
  AUTH_SECRET: z.string().min(32),
  SESSION_DAYS: z.coerce.number().int().min(1).max(400).default(180),
  /** SMTP connection string, e.g. smtps://user:pass@smtp.example.com:465. Without it, codes are only logged (development). */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('درون <no-reply@localhost>'),
  /** OAuth client id for Google sign-in. Without it the Google button is hidden. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  /** Claude API key for weekly stories. Without it the app writes a plain local summary instead. */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  /** Sign-in attempts allowed per IP address every 15 minutes. */
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(8),
  STORIES_PER_DAY: z.coerce.number().int().min(0).default(12),
  TRUST_PROXY: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export type Config = z.infer<typeof Env> & { isProd: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${msg}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production' && !c.SMTP_URL) throw new Error('SMTP_URL is required in production');
  return { ...c, isProd: c.NODE_ENV === 'production' };
}
