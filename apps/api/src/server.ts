import { loadConfig } from './config';
import { connect } from './db/client';
import { runMigrations } from './db/migrate';
import { buildApp } from './app';
import { createMailer } from './modules/auth/mailer';
import { createGoogleVerifier } from './modules/auth/google';
import { createClaudeWriter } from './modules/stories/writer';

const config = loadConfig();
const db = connect(config.DATABASE_URL);
await runMigrations(db.db);

const logger = { level: config.LOG_LEVEL, redact: ['req.headers.cookie', 'req.headers.authorization'] };
// a small logger for services until the app's own logger exists
const bootLog = {
  info: (o: object, m: string) => console.log(m, o),
  warn: (o: object, m: string) => console.warn(m, o),
};

const app = await buildApp(
  {
    config,
    db,
    mailer: createMailer(config, bootLog),
    google: config.GOOGLE_CLIENT_ID ? createGoogleVerifier(config.GOOGLE_CLIENT_ID) : null,
    writer: config.ANTHROPIC_API_KEY ? createClaudeWriter(config.ANTHROPIC_API_KEY, config.ANTHROPIC_MODEL) : null,
    log: bootLog,
  },
  { logger },
);

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
