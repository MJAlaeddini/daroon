import { REFINE, keyOf, pad } from '@daroon/shared';
import { mulberry32 } from '../core/util';
import { ctxFor } from '../domain/guide';
import { toast } from '../ui/toast';

/* ═════════════════════════ storage & demo data ═════════════════════════ */
export const STORE_KEY = 'daroon.v1';
export let DB: any = { entries: [], stories: [], account: null, loginDone: false, settings: { direction:'auto', emoji:false, motion:'system', showDemo:true }, visits: 0, seeded: false, sync: { cursor: 0, at: null } };
const persistListeners = new Set<() => void>();
/** Lets other parts (sync) react to local saves without the store knowing about them. */
export const onPersist = (fn: () => void) => persistListeners.add(fn);
export let storageOK = true;
export function load(){
  try { const raw = localStorage.getItem(STORE_KEY); if (raw){ const d = JSON.parse(raw); if (d && Array.isArray(d.entries)) DB = { ...DB, ...d, settings: { ...DB.settings, ...(d.settings || {}) } }; } }
  catch (e){ storageOK = false; }
  if (!DB.seeded){ DB.entries = DB.entries.filter(e => !e.demo).concat(genDemo()); DB.seeded = true; }
  DB.sync = DB.sync || { cursor: 0, at: null };
  DB.entries.forEach(e => { if (!e.updatedAt) e.updatedAt = e.createdAt; });
  /* without an account, deleted entries have nowhere to travel: drop their tombstones */
  if (!(DB.account && DB.account.id)) DB.entries = DB.entries.filter(e => !e.deletedAt);
  DB.visits = (DB.visits || 0) + 1; persist();
}
export function persist(opts: { quiet?: boolean } = {}){ try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e){ if (storageOK){ storageOK = false; setTimeout(() => toast('این مرورگر اجازه‌ی ذخیره نمی‌ده؛ ردپاها فقط تا بستن صفحه می‌مونن.'), 900); } } if (!opts.quiet) persistListeners.forEach(fn => fn()); }
export const NOTES = [
  'صبح زود بیدار شدم و یه مدت فقط به نور پشت پنجره نگاه کردم.', 'تلفن مامان که تموم شد، یه چیزی ته دلم موند.',
  'جلسه بهتر از چیزی که فکر می‌کردم پیش رفت.', 'نمی‌دونم چرا امروز همه‌چیز یه کم دور به نظر می‌رسید.',
  'با سارا قدم زدیم و خیلی خندیدیم.', 'هنوز جواب ایمیل رو ندادن.', 'کارها روی هم تلنبار شده.',
  'یه آهنگ قدیمی شنیدم و یاد خونه‌ی مادربزرگ افتادم.', 'حرفش رو زد و رفت؛ من موندم و کلی فکر.',
  'بارون اومد. هوا بوی خاک می‌داد.', 'امروز کار خاصی نکردم و این بار اشکالی نداشت.', 'فردا ارائه دارم.',
  'دلم برای حرف زدن با کسی که منو بشناسه تنگ شده.', 'بالاخره اون نقاشی رو تموم کردم.', 'چند بار خواستم پیام بدم و ننوشتم.',
  'از صبح یه سنگینی توی شونه‌هام هست.', 'خبر خوبی رسید، ولی هنوز باورم نشده.', 'شب، چای و یه کتاب. همین.',
  'توی صف نونوایی یه پیرمرد از جوونیش برام تعریف کرد.', 'برنامه‌ها باز عوض شد.', 'سفر نزدیکه و هنوز چمدون رو نبستم.',
];
export function genDemo(){
  const rnd = mulberry32(14050801), pick = a => a[Math.floor(rnd() * a.length)];
  const wpick = o => { let t = 0; for (const k in o) t += o[k]; let r = rnd() * t; for (const k in o){ r -= o[k]; if (r <= 0) return k; } return Object.keys(o)[0]; };
  const CH = [
    { from:320, to:205, w:{'دلتنگی':4,'آرامش':3,'غم':2,'صمیمیت':3,'امید':2,'نگرانی':1,'سردرگمی':1} },
    { from:205, to:150, w:{'خوشحالی':4,'اشتیاق':3,'امید':3,'صمیمیت':3,'آرامش':2,'دلتنگی':1} },
    { from:150, to:95, w:{'نگرانی':4,'سردرگمی':3,'اشتیاق':2,'دلخوری':2,'امید':2,'ترس':1,'آرامش':1} },
    { from:95, to:45, w:{'خشم':2,'دلخوری':3,'غم':3,'آرامش':2,'دلتنگی':2,'خوشحالی':1,'نگرانی':1} },
    { from:45, to:-1, w:{'امید':4,'آرامش':3,'نگرانی':2,'اشتیاق':2,'صمیمیت':2,'دلتنگی':2,'خوشحالی':2} },
  ];
  const GS = [['event','person'],['event','expect'],['event','change'],['thoughts','future'],['thoughts','tasks'],['thoughts','past'],['body','heavy'],['body','tense'],['body','light'],['vague','missing'],['vague','between'],['vague','changing']];
  const out = [], base = new Date(); base.setHours(12, 0, 0, 0);
  const mk = (d, back, tmin?: number) => {
    const ch = CH.find(c => back <= c.from && back > c.to) || CH[CH.length - 1];
    const h = tmin != null ? Math.floor(tmin / 60) : pick([8,9,11,13,16,18,19,20,21,21,22,22,23]), m = tmin != null ? tmin % 60 : Math.floor(rnd() * 60);
    const day = keyOf(d);
    const e = { id: 'demo-' + day + '-' + Math.floor(rnd() * 1e8).toString(36), day, time: `${pad(h)}:${pad(m)}`, createdAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString(),
      emotions: [], suggested: [], context: null, unnamed: false, note: '', path: 'explore', demo: true };
    const r = rnd();
    if (r < .08) e.unnamed = true;
    else { const n = r < .64 ? 1 : (r < .93 ? 2 : 3), used = new Set<string>(); let guard = 0; while (used.size < n && guard++ < 20) used.add(wpick(ch.w));
      e.emotions = [...used].map(key => (rnd() < .28 && REFINE[key as keyof typeof REFINE]) ? { key: pick(REFINE[key as keyof typeof REFINE]), parent: key } : { key, parent: key }); }
    if (rnd() < .3){ const [a, b] = pick(GS); e.path = 'guide'; e.context = ctxFor(a, b); }
    if (rnd() < .45) e.note = pick(NOTES);
    return e;
  };
  for (let back = 320; back >= 1; back--){ const d = new Date(base); d.setDate(d.getDate() - back); const p = .24 + .38 * (1 - back / 320);
    if (rnd() > p) continue; const n = rnd() < .2 ? (rnd() < .25 ? 3 : 2) : 1; for (let i = 0; i < n; i++) out.push(mk(d, back)); }
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  if (mins > 90) out.push(mk(new Date(base), 0, Math.min(8 * 60 + 40, mins - 30)));
  return out;
}
export const visible = () => DB.entries.filter(e => !e.deletedAt && (DB.settings.showDemo || !e.demo));
export let BYDAY = new Map();
export function reindex(){ BYDAY = new Map(); visible().slice().sort((a, b) => a.time < b.time ? -1 : 1).forEach(e => { if (!BYDAY.has(e.day)) BYDAY.set(e.day, []); BYDAY.get(e.day).push(e); }); }
export const dayList = k => BYDAY.get(k) || [];
