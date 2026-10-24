import { toast } from '../ui/toast';

/* ═════════════════════════ storage ═════════════════════════ */
export const STORE_KEY = 'daroon.v1';
export let DB: any = {
  entries: [],
  stories: [],
  account: null,
  loginDone: false,
  settings: { direction: 'auto', motion: 'system' },
  visits: 0,
  sync: { cursor: 0, at: null },
};
const persistListeners = new Set<() => void>();
/** Lets other parts (sync) react to local saves without the store knowing about them. */
export const onPersist = (fn: () => void) => persistListeners.add(fn);
export let storageOK = true;
/**
 * Reads the saved state. Sample entries (`demo: true`, made by earlier versions) are dropped; the browser tests
 * pass `sample` to get a fixed set of them back.
 */
export function load(sample?: () => any[]) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.entries)) DB = { ...DB, ...d, settings: { ...DB.settings, ...(d.settings || {}) } };
    }
  } catch (e) {
    storageOK = false;
  }
  if (!sample) DB.entries = DB.entries.filter((e) => !e.demo);
  else if (!DB.seeded) {
    DB.entries = DB.entries.concat(sample());
    DB.seeded = true;
  }
  delete DB.settings.showDemo;
  delete DB.settings.emoji;
  DB.sync = DB.sync || { cursor: 0, at: null };
  DB.entries.forEach((e) => {
    if (!e.updatedAt) e.updatedAt = e.createdAt;
  });
  /* without an account, deleted entries have nowhere to travel: drop their tombstones */
  if (!(DB.account && DB.account.id)) DB.entries = DB.entries.filter((e) => !e.deletedAt);
  DB.visits = (DB.visits || 0) + 1;
  persist();
}
export function persist(opts: { quiet?: boolean } = {}) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(DB));
  } catch (e) {
    if (storageOK) {
      storageOK = false;
      setTimeout(() => toast('این مرورگر اجازه‌ی ذخیره نمی‌ده؛ ردپاها فقط تا بستن صفحه می‌مونن.'), 900);
    }
  }
  if (!opts.quiet) persistListeners.forEach((fn) => fn());
}
export const visible = () => DB.entries.filter((e) => !e.deletedAt);
export let BYDAY = new Map();
export function reindex() {
  BYDAY = new Map();
  visible()
    .slice()
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .forEach((e) => {
      if (!BYDAY.has(e.day)) BYDAY.set(e.day, []);
      BYDAY.get(e.day).push(e);
    });
}
export const dayList = (k) => BYDAY.get(k) || [];
