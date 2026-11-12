import { jOfKey, todayKey, weekStart } from '@daroon/shared';
import { $, $$ } from '../core/util';
import { habit, reduced } from '../sculpture/engine';
import { Stage, engine, holdTraces, pickAnchor, stageEl } from '../stage/stage';
import { FLOW, S, isWide, newDraft, syncEngine } from '../state/app';
import { IC } from './icons';
import { closeSheet, fillDaySheet } from './sheets';
import { toast } from './toast';
import { archTitle, dayDetailHTML, monthHTML, warmArchive, weekHTML } from '../views/archive';
import { fineHTML, trayHTML, wordLabel, xbarHTML } from '../views/explore';
import { VIEWS } from '../views/index';

/* ═════════════════════════ rendering & navigation ═════════════════════════ */
export const TAB = { today: 0, explore: 0, guide: 0, login: 0, reflect: 0, archive: 1, patterns: 2 };
export const PAGER_EASE = 'cubic-bezier(.32,.72,0,1)';
export function renderView({ quiet = false, slide = 0 } = {}) {
  const host = $('#views'),
    old = host.querySelector('.view:not(.leaving)'),
    y0 = window.scrollY;
  slide = reduced() ? 0 : slide;
  const el = document.createElement('section');
  el.className = 'view v-' + S.view + (quiet || slide ? '' : ' enter');
  el.innerHTML = VIEWS[S.view]();
  if (old) {
    if (quiet || reduced()) old.remove();
    else if (slide) {
      old.classList.add('leaving', 'sliding');
      old.setAttribute('aria-hidden', 'true');
      old.style.top = -y0 + 'px';
      // a swipe may have left the page leaning with the finger; it leaves from there
      const lean = old.style.transform || 'translateX(0)';
      old.style.transition = '';
      old.animate(
        [
          { transform: lean, opacity: 1 },
          { transform: `translateX(${-slide * 28}%)`, opacity: 0.15, offset: 0.3 },
          { transform: `translateX(${-slide * 100}%)`, opacity: 0 },
        ],
        { duration: 560, easing: PAGER_EASE, fill: 'forwards' },
      ).onfinish = () => old.remove();
    } else {
      old.classList.add('leaving');
      old.setAttribute('aria-hidden', 'true');
      setTimeout(() => old.remove(), 280);
    }
  }
  host.appendChild(el);
  /* choreography: the old page leaves, the sculpture travels, and only then does the new page's content arrive */
  if (!quiet && !slide) {
    const flying =
      !reduced() && Stage.shown && $$('[data-anchor]', el).some((a) => getComputedStyle(a).display !== 'none');
    const d0 = flying ? Math.round(950 * (1 - 0.25 * habit()) * 0.72) : 140;
    el.style.setProperty('--d0', d0 + 'ms');
    el.classList.add('veil');
    setTimeout(() => {
      el.classList.remove('veil');
      el.style.removeProperty('--d0');
    }, d0 + 2600);
  }
  if (slide) {
    el.animate(
      [
        { transform: `translateX(${slide * 100}%)`, opacity: 0.4 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 560, easing: PAGER_EASE },
    );
    /* hand-off: the old sculpture fades out first, then the new one fades in riding with its page */
    Stage.hold = performance.now() + 240;
    stageEl.classList.add('quick');
    setTimeout(() => stageEl.classList.remove('quick'), 240);
  }
  document.body.dataset.flow = FLOW.has(S.view) ? '1' : '0';
  document.body.dataset.view = S.view;
  if (!quiet) {
    window.scrollTo(0, 0);
    if (Date.now() - (toast.at || 0) > 700) $('#toast').innerHTML = '';
  }
  holdTraces(quiet ? 60 : 420);
  updateNav();
  syncEngine();
  after(el, quiet);
  requestAnimationFrame(() => {
    pickAnchor();
    if (!quiet) {
      const f = el.querySelector<HTMLElement>('[data-autofocus]');
      f && f.focus({ preventScroll: true });
    }
  });
}
export function after(el, _quiet?: boolean) {
  if (S.view === 'today') {
    $$('.path', el).forEach((p) => {
      p.addEventListener('pointerenter', () => hintPath(p.dataset.hint));
      p.addEventListener('pointerleave', () => hintPath(null));
      p.addEventListener('focus', () => hintPath(p.dataset.hint));
      p.addEventListener('blur', () => hintPath(null));
    });
  }
}
export function hintPath(h) {
  engine.hintMod =
    h === 'A' ? { sep: 0.18, exp: 0.06 } : h === 'B' ? { diff: 0.2, energy: -0.12, lum: 0.12, coh: 0.1 } : {};
  if (h) engine.pulse(0.35, 500);
}
export function updateNav() {
  const sec = {
    today: 'today',
    explore: 'today',
    guide: 'today',
    reflect: S.editing ? 'archive' : 'today',
    archive: 'archive',
    patterns: 'patterns',
  }[S.view];
  $$('.topnav [data-go], .bottomnav [data-go]').forEach((b) =>
    b.dataset.go === sec ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'),
  );
}
export function go(view, { push = true, slide = 0 } = {}) {
  if (push && S.view !== view) {
    const i = S.prev.lastIndexOf(view);
    if (i >= 0) S.prev = S.prev.slice(0, i);
    else S.prev.push(S.view);
  }
  if (!push) S.prev = [];
  closeSheet(true);
  S.view = view;
  S.customOpen = false;
  S.confirmDel = null;
  S.discardArm = false;
  renderView({ slide });
}
export function back() {
  const v = S.prev.pop() || (S.editing ? 'archive' : 'today');
  S.view = v;
  S.discardArm = false;
  if (v === 'archive' && S.editing) {
    S.editing = null;
    S.draft = newDraft();
  }
  renderView();
}
/**
 * The feeling picker after a change: each verse word's state, the line of our own word and the buttons at once; what
 * the stone holds (its names and finer words, and the stone itself) only when `stone` is set, which a breathed word
 * asks for as it reaches the stone.
 */
export function refreshExplore({ stone = true } = {}) {
  const f = $('#field');
  if (!f) return;
  const full = S.draft.items.length >= 3;
  $$('.word', f).forEach((w) => {
    const on = S.draft.items.some((x) => x.key === w.dataset.key || x.parent === w.dataset.key);
    w.setAttribute('aria-pressed', String(on));
    w.setAttribute('aria-disabled', String(full && !on));
    const label = wordLabel(w.dataset.key);
    if (w.textContent !== label) w.textContent = label;
  });
  const tray = $('#tray');
  if (!(S.customOpen && tray.contains(document.activeElement))) tray.innerHTML = trayHTML();
  $('#xbar').innerHTML = xbarHTML();
  if (stone) refreshStone();
}
/** The finer words of the feeling in focus, under the stone; the stone takes the draft's feelings. */
export function refreshStone() {
  const fi = $('#xfine');
  if (fi) {
    const fh = fineHTML();
    if (fi.dataset.h !== fh) swapIn(fi, fh);
  }
  syncEngine();
}
function swapIn(el: HTMLElement, html: string) {
  el.innerHTML = html;
  el.dataset.h = html;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.classList.add('swap');
}
export function refreshArchive() {
  if (S.view !== 'archive') return;
  const cal = $('#archCal');
  if (!cal) return renderView({ quiet: true });
  const A = S.arch;
  cal.innerHTML = A.mode === 'month' ? monthHTML() : weekHTML();
  warmArchive();
  const t = archTitle();
  $('#archTitle').innerHTML = `${t.main} <span class="yr num">${t.yr}</span>${IC.down}`;
  const d = $('#archDetail');
  if (d && isWide()) d.innerHTML = dayDetailHTML(A.sel, false);
  const tb = $('[data-act="goToday"]');
  if (tb) {
    const a = jOfKey(A.cursor),
      b = jOfKey(todayKey());
    const inP = A.mode === 'month' ? a.jy === b.jy && a.jm === b.jm : weekStart(A.cursor) === weekStart(todayKey());
    tb.disabled = inP && A.sel === todayKey();
  }
  if (S.sheet === 'day') fillDaySheet();
  syncEngine();
  requestAnimationFrame(pickAnchor);
}
