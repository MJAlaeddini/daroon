/**
 * Offline-first sync. Every entry carries `updatedAt`; an entry whose last pushed version (`syncedAt`)
 * differs from it still has to travel. Notes and sample entries never leave the device.
 */
import { MAX_SCENES, MEANING_AS, MEANING_QS, isScene, type InsightFeedback, type SyncedEntry } from '@daroon/shared';
import { api, ApiError } from '../net/api';
import { DB, onPersist, persist, reindex } from '../state/store';

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;
const listeners = new Set<(changed: boolean) => void>();
const expiredListeners = new Set<() => void>();

export const isSignedIn = (): boolean => !!(DB.account && DB.account.id);
/** Called after a sync that brought something new from another device. */
export const onSynced = (fn: (changed: boolean) => void) => listeners.add(fn);
/** Called when the server no longer knows this device's session. */
export const onSessionExpired = (fn: () => void) => expiredListeners.add(fn);

function toWire(e): SyncedEntry {
  return {
    id: e.id,
    day: e.day,
    time: e.time,
    emotions: e.emotions.map((x) => ({
      key: x.key,
      parent: x.parent ?? null,
      custom: !!x.custom,
      color: x.color ?? null,
    })),
    suggested: (e.suggested || []).slice(0, 8),
    context: e.context ?? null,
    scenes: (e.scenes || []).filter(isScene).slice(0, MAX_SCENES),
    intensity: [1, 2, 3].includes(e.intensity) ? e.intensity : null,
    meaning: e.meaning && MEANING_QS.includes(e.meaning.q) && MEANING_AS.includes(e.meaning.a) ? e.meaning : null,
    unnamed: !!e.unnamed,
    path: e.path === 'guide' ? 'guide' : 'explore',
    createdAt: e.createdAt,
    updatedAt: e.updatedAt || e.createdAt,
    deletedAt: e.deletedAt ?? null,
  };
}

const pending = () => DB.entries.filter((e) => !e.demo && e.syncedAt !== (e.updatedAt || e.createdAt));
/** Answers to patterns («درسته / تا حدی / نه») not yet on the server. */
const pendingAnswers = (): InsightFeedback[] =>
  Object.entries<any>(DB.insights || {})
    .filter(([, f]) => f.syncedAt !== f.at)
    .map(([id, f]) => ({
      id,
      verdict: f.verdict,
      group: f.group,
      hits: f.hits,
      others: f.others,
      elsewhere: f.elsewhere,
      at: f.at,
    }));
function mergeAnswers(sent: InsightFeedback[], incoming: InsightFeedback[] = []) {
  const mine = (DB.insights = DB.insights || {});
  for (const f of sent) if (mine[f.id]?.at === f.at) mine[f.id].syncedAt = f.at;
  for (const f of incoming)
    if (!mine[f.id] || mine[f.id].at < f.at) {
      const { id, ...rest } = f;
      mine[id] = { ...rest, syncedAt: f.at };
    }
}

/** Applies what the server sent. The newer edit wins; a local note is kept on the local copy. */
function merge(incoming: SyncedEntry[]): boolean {
  let changed = false;
  const byId = new Map<string, any>(DB.entries.map((e) => [e.id, e]));
  for (const r of incoming) {
    const local = byId.get(r.id);
    if (local && (local.updatedAt || local.createdAt) > r.updatedAt) continue;
    if (local) {
      if (local.updatedAt === r.updatedAt && local.syncedAt === r.updatedAt) continue;
      Object.assign(local, r, { note: local.note || '', demo: false, syncedAt: r.updatedAt });
    } else {
      const e = { ...r, note: '', demo: false, syncedAt: r.updatedAt };
      DB.entries.push(e);
      byId.set(r.id, e);
    }
    changed = true;
  }
  return changed;
}

async function run(): Promise<void> {
  if (!isSignedIn() || !navigator.onLine) return;
  const batch = pending().slice(0, 400),
    answers = pendingAnswers().slice(0, 100);
  const sent = new Map(batch.map((e) => [e.id, e.updatedAt || e.createdAt]));
  try {
    const res = await api.sync(DB.sync.cursor || 0, batch.map(toWire), answers);
    mergeAnswers(answers, res.feedback);
    for (const e of DB.entries)
      if (sent.has(e.id) && (e.updatedAt || e.createdAt) === sent.get(e.id)) e.syncedAt = sent.get(e.id);
    const changed = merge(res.changes);
    DB.sync.cursor = res.cursor;
    DB.sync.at = new Date().toISOString();
    persist({ quiet: true });
    if (changed) reindex();
    listeners.forEach((fn) => fn(changed));
    if (pending().length) again = true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) expiredListeners.forEach((fn) => fn());
    // offline or server trouble: the changes stay pending and go with the next sync
  }
}

/** Runs a sync now, or right after the one in flight. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      scheduleSync(300);
    }
  });
  return running;
}

export function scheduleSync(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

/** Forgets the server cursor so the next sign-in pulls and pushes everything again. */
export function resetSync() {
  DB.sync = { cursor: 0, at: null };
  for (const e of DB.entries) delete e.syncedAt;
  for (const f of Object.values<any>(DB.insights || {})) delete f.syncedAt;
}

export function startSync() {
  onPersist(() => {
    if (isSignedIn() && (pending().length || pendingAnswers().length)) scheduleSync();
  });
  addEventListener('online', () => scheduleSync(200));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(200);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') syncNow();
  }, 60_000);
  if (isSignedIn()) scheduleSync(400);
}
