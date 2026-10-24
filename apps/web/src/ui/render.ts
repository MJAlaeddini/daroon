import { jOfKey, labelOf, todayKey, weekStart } from '@daroon/shared';
import { $, $$, esc, lerp } from '../core/util';
import { habit, reduced } from '../sculpture/engine';
import { Stage, engine, holdTraces, pickAnchor, stageEl } from '../stage/stage';
import { FLOW, S, isWide, newDraft, syncEngine } from '../state/app';
import { IC } from './icons';
import { closeSheet, fillDaySheet } from './sheets';
import { toast } from './toast';
import { archTitle, dayDetailHTML, monthHTML, warmArchive, weekHTML } from '../views/archive';
import { trayHTML, xbarHTML } from '../views/explore';
import { VIEWS } from '../views/index';

/* ═════════════════════════ rendering & navigation ═════════════════════════ */
export let fieldRO = null;
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
      old.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
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
  if (S.view === 'explore') {
    const f = $('#field', el);
    layoutField(f);
    fieldRO && fieldRO.disconnect();
    fieldRO = new ResizeObserver(() => layoutField(f));
    fieldRO.observe(f);
  }
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
export function layoutField(f) {
  if (!f) return;
  const W = f.clientWidth,
    H = f.clientHeight,
    cx = W / 2,
    cy = H / 2,
    narrow = W < 560;
  const hx = narrow ? W / 2 - 48 : Math.min(W / 2 - 80, H * 0.62),
    hy = narrow ? H / 2 - 24 : H / 2 - 34,
    bl = narrow ? 0.72 : 0.28;
  $$('.word', f).forEach((w) => {
    const a = (+w.dataset.angle * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a);
    const t = Math.min(hx / Math.max(Math.abs(c), 1e-6), hy / Math.max(Math.abs(s), 1e-6));
    const x = cx + lerp(hx * c, t * c, bl),
      y = cy - lerp(hy * s, t * s, bl);
    w.style.left = x + 'px';
    w.style.top = y + 'px';
    w.style.setProperty('--fx', cx - x + 'px');
    w.style.setProperty('--fy', cy - y + 'px');
  });
  const A = $('.anchor-field', f),
    sz = narrow ? Math.min(W * 0.62, H * 0.5) : Math.min(hx * 1.3, hy * 1.4, 480);
  A.style.width = A.style.height = sz + 'px';
  A.style.left = cx - sz / 2 + 'px';
  A.style.top = cy - sz / 2 + 'px';
  f.classList.toggle('full', S.draft.items.length >= 3);
  $$('.word', f).forEach((w) =>
    w.setAttribute('aria-disabled', String(S.draft.items.length >= 3 && w.getAttribute('aria-pressed') !== 'true')),
  );
}
export function refreshExplore() {
  const f = $('#field');
  if (!f) return;
  $$('.word', f).forEach((w) => {
    const k = w.dataset.key,
      it = S.draft.items.find((x) => x.key === k || x.parent === k);
    w.setAttribute('aria-pressed', String(!!it));
    w.querySelector('.rfn')?.remove();
    if (it && it.key !== k) w.insertAdjacentHTML('beforeend', `<span class="rfn">${esc(labelOf(it.key))}</span>`);
  });
  layoutField(f);
  $('#tray').innerHTML = trayHTML();
  $('#xbar').innerHTML = xbarHTML();
  syncEngine();
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
