import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { EmotionItem, EntryContext, Meaning, SceneId } from '@daroon/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  googleSub: text('google_sub').unique(),
  username: text('username').unique(),
  /** scrypt$N$r$p$salt$hash, for accounts made with a username */
  passwordHash: text('password_hash'),
  name: text('name').notNull().default(''),
  provider: text('provider', { enum: ['email', 'google', 'password'] }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** One-time login codes sent by email. Only a keyed hash of the code is stored. */
export const authCodes = pgTable(
  'auth_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('auth_codes_email_idx').on(t.email, t.createdAt)],
);

/** Sessions are identified by the SHA-256 of a random token kept in an httpOnly cookie. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Every write to an entry takes the next value, so a device can ask for "everything after N". */
export const entrySeq = pgSequence('entry_seq');

export const entries = pgTable(
  'entries',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    day: text('day').notNull(),
    time: text('time').notNull(),
    emotions: jsonb('emotions').$type<EmotionItem[]>().notNull(),
    suggested: jsonb('suggested')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    context: jsonb('context').$type<EntryContext | null>(),
    scenes: jsonb('scenes')
      .$type<SceneId[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    intensity: smallint('intensity'),
    meaning: jsonb('meaning').$type<Meaning | null>(),
    unnamed: boolean('unnamed').notNull(),
    path: text('path').notNull(),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
    deletedAt: ts('deleted_at'),
    seq: bigint('seq', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('entries_user_seq_idx').on(t.userId, t.seq),
    index('entries_user_day_idx').on(t.userId, t.day),
  ],
);

/**
 * What a person said about a pattern («درسته / تا حدی / نه»), with the counts they were shown at the time. Kept
 * apart from the entries: an answer never changes what was recorded.
 */
export const insightFeedback = pgTable(
  'insight_feedback',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    verdict: text('verdict', { enum: ['yes', 'partly', 'no'] }).notNull(),
    groupSize: integer('group_size').notNull(),
    hits: integer('hits').notNull(),
    others: integer('others').notNull(),
    elsewhere: integer('elsewhere').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const stories = pgTable(
  'stories',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    week: text('week').notNull(),
    id: text('id').notNull(),
    title: text('title').notNull(),
    pages: jsonb('pages').$type<{ key: string | null; text: string }[]>().notNull(),
    weekKeys: jsonb('week_keys').$type<string[]>().notNull(),
    source: text('source', { enum: ['writer', 'local'] }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.week] })],
);

/** Counts writer calls per user and day, to keep costs predictable. */
export const storyUsage = pgTable(
  'story_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
