import { connect } from './client';
import { runMigrations } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const d = connect(url);
await runMigrations(d.db);
await d.close();
console.log('migrations applied');
