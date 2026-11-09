import { jOfKey, keyAdd, wdIndex, weekStart } from '@daroon/shared';
import { ACT, reRenderReflect, setIntensity } from './actions';
import { $ } from './core/util';
import { submitCode, submitEmail, submitPassword } from './features/account';
import { addCustom, swapGuide } from './features/draft';
import { closeStory } from './features/stories';
import { isDark, mqDark, mqReduce } from './sculpture/engine';
import { pickAnchor } from './stage/stage';
import { FLOW, S, isWide, newDraft, syncEngine } from './state/app';
import { DB } from './state/store';
import { selectDay } from './ui/day-select';
import { IC } from './ui/icons';
import { TAB, go, refreshArchive, refreshExplore, renderView } from './ui/render';
import { closeSheet, refreshArchiveSelOnly } from './ui/sheets';
import { applyTheme, themeChanged } from './ui/theme';

/* ═════════════════════════ events ═════════════════════════ */
document.addEventListener('click', (e: any) => {
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) {
    const f = ACT[a.dataset.act];
    if (f) {
      e.preventDefault();
      f(a, e);
      return;
    }
  }
  const g = e.target.closest('[data-go]');
  if (g) {
    e.preventDefault();
    const v = g.dataset.go;
    if (v === S.view && !FLOW.has(v)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (FLOW.has(S.view) && !S.editing && v !== 'today') {
      /* leaving a flow keeps the draft for later */
    }
    const from = S.editing && S.view === 'reflect' ? 1 : TAB[S.view],
      to = TAB[v],
      slide = from === to ? 0 : to > from ? -1 : 1;
    if (S.editing && v !== 'archive') {
      S.editing = null;
      S.draft = newDraft();
    }
    closeSheet(true);
    go(v, { push: false, slide });
    return;
  }
  const day = e.target.closest('[data-day]');
  if (day) {
    const k = day.dataset.day;
    if (S.view === 'today') {
      S.arch.sel = k;
      S.arch.cursor = k;
      S.arch.mode = 'week';
      go('archive', { push: false });
    } else if (S.view === 'archive') selectDay(k, true);
  }
});
document.addEventListener('submit', (e: any) => {
  const le = e.target.closest('[data-form="loginEmail"]');
  if (le) {
    e.preventDefault();
    submitEmail(le.email.value);
    return;
  }
  const lp = e.target.closest('[data-form="loginPassword"]');
  if (lp) {
    e.preventDefault();
    submitPassword(lp.username.value, lp.password.value, lp.elements.name?.value || '');
    return;
  }
  const lc = e.target.closest('[data-form="loginCode"]');
  if (lc) {
    e.preventDefault();
    submitCode(lc.code.value, lc.elements.name.value);
    return;
  }
  const f = e.target.closest('[data-form="custom"]');
  if (!f) return;
  e.preventDefault();
  const inp = f.querySelector('input');
  if (addCustom(inp.value)) {
    inp.value = '';
    S.customOpen = false;
    if (S.view === 'explore') refreshExplore();
    else {
      syncEngine();
      swapGuide();
    }
  }
});
document.addEventListener('input', (e: any) => {
  if (e.target.id === 'noteInput') {
    S.draft.note = e.target.value;
    if (S.discardArm) {
      S.discardArm = false;
      const b = $('[data-act="discard"]');
      if (b) b.textContent = 'بستن';
    }
  }
});
document.addEventListener('keydown', (e: any) => {
  if (e.key === 'Escape') {
    if (S.story) {
      closeStory();
      return;
    }
    if (S.done) {
      ACT.doneClose();
      return;
    }
    if (S.sheet) {
      closeSheet();
      return;
    }
    if (S.arch.jump && S.view === 'archive') {
      ACT.toggleJump();
      return;
    }
    if (S.view === 'reflect' && S.draft.palette >= 0) {
      S.draft.palette = -1;
      reRenderReflect();
      return;
    }
  }
  if (S.story && S.story.st) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ACT.storyNext();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ACT.storyPrev();
      return;
    }
  }
  const cell = e.target.closest && e.target.closest('#calGrid [data-day]');
  if (cell && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const k = cell.dataset.day,
      wk = S.arch.mode === 'week';
    const step = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -7, ArrowDown: 7, Home: -wdIndex(k), End: 6 - wdIndex(k) }[
      e.key
    ];
    const n = keyAdd(k, step);
    S.arch.sel = n;
    const j = jOfKey(n),
      c = jOfKey(S.arch.cursor);
    if ((!wk && (j.jy !== c.jy || j.jm !== c.jm)) || (wk && weekStart(n) !== weekStart(S.arch.cursor)))
      S.arch.cursor = n;
    if (isWide() || wk) refreshArchive();
    else refreshArchiveSelOnly();
    $(`#calGrid [data-day="${n}"]`)?.focus();
  }
});
document.addEventListener('focusin', (e: any) => {
  if (e.target.matches('input, textarea') && !isWide()) document.body.dataset.kb = '1';
});
document.addEventListener('focusout', (e: any) => {
  if (e.target.matches('input, textarea')) document.body.dataset.kb = '0';
});
export let lastWide = isWide(),
  rT;
addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    const w = isWide();
    if (w !== lastWide) {
      lastWide = w;
      if (S.sheet === 'day' && w) closeSheet(true);
      renderView({ quiet: true });
    } else requestAnimationFrame(pickAnchor);
  }, 120);
});
mqDark.addEventListener?.('change', () => {
  if (DB.settings.direction === 'auto') themeChanged();
});
mqReduce.addEventListener?.('change', () => applyTheme(false));
new MutationObserver(() => {
  const t = $('#themeBtn');
  if (t) t.innerHTML = isDark() ? IC.sun : IC.moon;
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
document.addEventListener(
  'load',
  (e: any) => {
    if (e.target.classList?.contains('tr') && !e.target.hasAttribute('data-hold')) e.target.style.opacity = '';
  },
  true,
);

/* «how strong was it?»: holding the stone raises it through a little, medium, a lot (a small tick at each), and
   letting go keeps where it reached; a short tap does nothing, so scrolling past it never changes the answer */
let hold: { t0: number; id: number; timer: ReturnType<typeof setInterval> } | null = null;
const endHold = () => {
  if (hold) clearInterval(hold.timer);
  hold = null;
};
document.addEventListener('pointerdown', (e: PointerEvent) => {
  const a = (e.target as HTMLElement).closest?.('.r-grid[data-step="strength"] .anchor-reflect');
  if (!a || !e.isPrimary) return;
  endHold();
  const t0 = performance.now();
  hold = {
    t0,
    id: e.pointerId,
    timer: setInterval(() => {
      const held = performance.now() - t0;
      if (held >= 220) setIntensity(held < 700 ? 1 : held < 1200 ? 2 : 3);
      if (held >= 1200) endHold();
    }, 50),
  };
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'blur'] as const)
  addEventListener(ev, (e: Event) => {
    if (hold && (!(e instanceof PointerEvent) || e.pointerId === hold.id)) endHold();
  });
