/**
 * Wire and storage shapes shared by the app and the API. Every request body is validated against these.
 */
import { z } from 'zod';
import { DAY_KEY } from './jalali';
import { MAX_CUSTOM_LEN, MAX_EMOTIONS, isCustomEmotion, isKnownEmotion, CUSTOM_PREFIX } from './lexicon';
import { MAX_SCENES, SCENE_IDS, isScene } from './insights';
import { MEANING_AS, MEANING_QS } from './meaning';

export const SWATCH_IDS = ['mist', 'sage', 'apricot', 'gold', 'rose', 'lilac', 'indigo', 'ember', 'graphite'] as const;

export const EmotionKey = z
  .string()
  .min(1)
  .max(CUSTOM_PREFIX.length + MAX_CUSTOM_LEN)
  .refine((k) => isKnownEmotion(k) || isCustomEmotion(k), 'unknown emotion');

export const EmotionItem = z.object({
  key: EmotionKey,
  parent: z.string().max(32).nullable().default(null),
  custom: z.boolean().default(false),
  color: z.enum(SWATCH_IDS).nullable().default(null),
});
export type EmotionItem = z.infer<typeof EmotionItem>;

export const EntryContext = z.object({
  kind: z.enum(['situation', 'thoughts', 'body', 'felt']),
  name: z.string().max(32),
  q1: z.string().max(16),
  q2: z.string().max(16).nullable(),
  value: z.string().max(120),
});
export type EntryContext = z.infer<typeof EntryContext>;

const iso = z.iso.datetime({ offset: true });

/** Who or what was around: at most two settings, no repeats. */
export const Scenes = z
  .array(z.enum(SCENE_IDS))
  .max(MAX_SCENES)
  .refine((a) => new Set(a).size === a.length, 'repeated scene');

/** One small question about what was going on, and its answer. */
export const Meaning = z.object({ q: z.enum(MEANING_QS), a: z.enum(MEANING_AS) });
export type Meaning = z.infer<typeof Meaning>;

/** One saved check-in ("ردپا"). Notes never leave the device, so they are not part of the synced shape. */
export const SyncedEntry = z.object({
  id: z
    .string()
    .min(6)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  day: z.string().regex(DAY_KEY),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  emotions: z.array(EmotionItem).max(MAX_EMOTIONS),
  suggested: z.array(z.string().max(40)).max(8).default([]),
  context: EntryContext.nullable().default(null),
  scenes: Scenes.default([]),
  /** how strong it was, 1..3 (absent on check-ins made before it was asked) */
  intensity: z.number().int().min(1).max(3).nullable().default(null),
  meaning: Meaning.nullable().default(null),
  unnamed: z.boolean(),
  path: z.enum(['explore', 'guide', 'write']).default('explore'),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: iso.nullable().default(null),
});
export type SyncedEntry = z.infer<typeof SyncedEntry>;

/** The person's answer to a pattern, with the counts they were shown, so it can be read against later data. */
const count = z.number().int().min(0).max(1_000_000);
export const InsightFeedback = z.object({
  id: z
    .string()
    .max(80)
    .refine((id) => isScene(id.split('|')[0]) && id.split('|').length === 2, 'bad pattern id'),
  verdict: z.enum(['yes', 'partly', 'no']),
  group: count,
  hits: count,
  others: count,
  elsewhere: count,
  at: iso,
});
export type InsightFeedback = z.infer<typeof InsightFeedback>;

export const SyncRequest = z.object({
  /** Server cursor from the last successful sync; 0 for a first sync. */
  since: z.coerce.number().int().min(0),
  changes: z.array(SyncedEntry).max(500),
  feedback: z.array(InsightFeedback).max(100).default([]),
});
export type SyncRequest = z.infer<typeof SyncRequest>;
export interface SyncResponse {
  cursor: number;
  changes: SyncedEntry[];
  /** Every answer this person has given to a pattern (a few dozen at most). */
  feedback: InsightFeedback[];
}

export const StoryPage = z.object({ key: z.string().nullable(), text: z.string().max(300) });
export const Story = z.object({
  id: z.string(),
  week: z.string().regex(DAY_KEY),
  title: z.string().max(48),
  pages: z.array(StoryPage).min(2).max(6),
  weekKeys: z.array(z.string()).max(3),
  source: z.enum(['writer', 'local']),
  createdAt: iso,
});
export type Story = z.infer<typeof Story>;

/** What the app sends to have a week's story written. Notes are included only for this one request. */
export const StoryEntryInput = SyncedEntry.pick({
  day: true,
  time: true,
  emotions: true,
  context: true,
  scenes: true,
  intensity: true,
  meaning: true,
}).extend({
  note: z.string().max(2000).default(''),
});
export const StoryRequest = z.object({
  week: z.string().regex(DAY_KEY),
  entries: z.array(StoryEntryInput).min(2).max(200),
  weekKeys: z.array(z.string()).max(3),
});
export type StoryRequest = z.infer<typeof StoryRequest>;

export const Email = z.string().trim().toLowerCase().email().max(254);
export const RequestCodeBody = z.object({ email: Email });
export const VerifyCodeBody = z.object({
  email: Email,
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().max(24).optional(),
});
/** Usernames are Latin, so they type the same on every keyboard: 3–24 of a–z, 0–9, dot and underscore. */
export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,24}$/);
export const Password = z.string().min(8).max(128);
export const UsernameQuery = z.object({ u: Username });
/** Whether a username can still be taken, and a few free ones close to it when it cannot. */
export interface UsernameStatus {
  available: boolean;
  suggestions: string[];
}
export const SignupBody = z.object({
  username: Username,
  password: Password,
  name: z.string().trim().max(24).optional(),
});
export const PasswordLoginBody = z.object({ username: Username, password: z.string().min(1).max(128) });
export const GoogleBody = z.object({ credential: z.string().min(20).max(4096) });
export const ProfileBody = z.object({ name: z.string().trim().min(1).max(24) });

export interface Account {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  provider: 'email' | 'google' | 'password';
  since: string;
}
