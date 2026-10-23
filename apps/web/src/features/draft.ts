import { keyOf, pad } from '@daroon/shared';
import { $, uid } from '../core/util';
import { lex } from '../domain/lexicon';
import { reduced } from '../sculpture/engine';
import { Stage, engine, snapshot } from '../stage/stage';
import { S, isWide, newDraft, syncEngine } from '../state/app';
import { DB, persist, reindex } from '../state/store';
import { showDone } from '../ui/done';
import { go, renderView } from '../ui/render';
import { openDaySheet } from '../ui/sheets';
import { toast } from '../ui/toast';
import { guideBody, guideStepLabel } from '../views/guide';

/* ═════════════════════════ actions ═════════════════════════ */
export function itemFor(key) {
  const L = lex(key);
  return { key, parent: L.parent || null, custom: key.startsWith('custom:') };
}
export function addCustom(text) {
  text = text.trim().replace(/\s+/g, ' ');
  if (!text) return false;
  if (S.draft.items.length >= 3) {
    toast('سه کلمه انتخاب کردی. برای کلمه‌ی تازه، یکی رو بردار.');
    return false;
  }
  const key = 'custom:' + text;
  if (S.draft.items.some((i) => i.key === key)) return false;
  S.draft.items.push({ key, parent: null, custom: true });
  S.draft.focus = -1;
  engine.rippleAt((lex(key).angle * Math.PI) / 180, key);
  return true;
}
export function startGuide(fresh = true) {
  if (fresh) {
    S.draft = newDraft();
  }
  S.draft.path = 'guide';
  S.guide = { step: 'q1', q1: null, q2: null };
}
export function swapGuide() {
  const b = $('#gbody');
  if (!b) return;
  b.classList.remove('swap');
  void b.offsetWidth;
  b.innerHTML = guideBody();
  b.classList.add('swap');
  $('#gstep').textContent = guideStepLabel();
  syncEngine();
  requestAnimationFrame(() => b.querySelector('[data-autofocus]')?.focus({ preventScroll: true }));
  if (!isWide()) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
}
export function toReflect() {
  S.draft.palette = -1;
  go('reflect');
  engine.pulse(-0.4, 600);
}
export function exitFlow(msg = 'باشه. هر وقت خواستی، همین‌جاست.') {
  S.draft = newDraft();
  S.guide = null;
  S.editing = null;
  go('today', { push: false });
  toast(msg);
}
export function draftFromEntry(e) {
  return {
    items: e.emotions.map((x) => ({
      key: x.key,
      parent: x.parent || lex(x.key).parent || null,
      custom: !!x.custom,
      color: x.color || null,
    })),
    suggested: [],
    context: e.context,
    path: e.path,
    note: e.note || '',
    focus: -1,
    palette: -1,
  };
}

export async function saveDraft() {
  const d = S.draft,
    noteEl = $('#noteInput');
  if (noteEl) d.note = noteEl.value;
  const emotions = d.items.map((it) => ({
    key: it.key,
    parent: it.parent || null,
    custom: !!it.custom,
    color: it.color || null,
  }));
  if (S.editing) {
    const e = DB.entries.find((x) => x.id === S.editing);
    if (e) {
      Object.assign(e, {
        emotions,
        unnamed: !emotions.length,
        note: d.note.trim(),
        updatedAt: new Date().toISOString(),
      });
      persist();
      reindex();
    }
    const day = e ? e.day : S.arch.sel;
    S.editing = null;
    S.draft = newDraft();
    S.arch.sel = day;
    S.arch.cursor = day;
    S.prev = [];
    S.view = 'archive';
    renderView();
    if (!isWide() && e && S.arch.mode === 'month') setTimeout(() => openDaySheet(day), 350);
    toast('تغییرات ذخیره شد.');
    return;
  }
  const now = new Date();
  const entry = {
    id: uid(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    day: keyOf(now),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    emotions,
    suggested: (d.suggested || []).filter((k) => !emotions.some((x) => x.key === k)),
    context: d.context || null,
    unnamed: !emotions.length,
    note: d.note.trim(),
    path: d.path || 'explore',
    demo: false,
  };
  DB.entries.push(entry);
  persist();
  reindex();
  const shot = snapshot(),
    from = Stage.rect ? { ...Stage.rect } : null;
  S.draft = newDraft();
  S.guide = null;
  S.prev = [];
  S.view = 'today';
  window.scrollTo(0, 0);
  renderView({ quiet: true });
  showDone(entry, shot, from);
}
