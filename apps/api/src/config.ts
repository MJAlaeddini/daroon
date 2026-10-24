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
  /**
   * SMTP connection string, e.g. smtps://user:pass@smtp.example.com:465. Without it, login codes are written to the
   * API log instead (fine for an owner trying the app; nobody else can sign in).
   */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('درون <no-reply@localhost>'),
  /** Development and tests only: write login mails as JSON files into this folder instead of sending them. */
  MAIL_OUTBOX: z.string().optional(),
  /** OAuth client id for Google sign-in. Without it the Google button is hidden. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  /** Claude API key for weekly stories. Without it the app writes a plain local summary instead. */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  /** Sign-in attempts allowed per IP address every 15 minutes. */
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(8),
  STORIES_PER_DAY: z.coerce.number().int().min(0).default(12),
  /**
   * Whether the session cookie is marked Secure (HTTPS only). Defaults to true in production; set to false
   * only for a temporary plain-HTTP setup, e.g. http://SERVER_IP:8080.
   */
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === '1')),
  /** Set to true behind a reverse proxy (Caddy) so client addresses come from X-Forwarded-For. */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export type Config = Omit<z.infer<typeof Env>, 'COOKIE_SECURE'> & { isProd: boolean; COOKIE_SECURE: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${msg}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production' && c.MAIL_OUTBOX) throw new Error('MAIL_OUTBOX must not be set in production');
  return { ...c, isProd: c.NODE_ENV === 'production', COOKIE_SECURE: c.COOKIE_SECURE ?? c.NODE_ENV === 'production' };
}
