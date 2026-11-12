import { isSignedIn } from './features/sync';
import { MAX_SCENES, fa, jOfKey, keyAdd, keyOfJ, labelOf, todayKey, weekStart } from '@daroon/shared';
import { $, $$ } from './core/util';
import { Q2, ctxFor } from './domain/guide';
import { lex } from './domain/lexicon';
import {
  deleteAccount,
  loginStep,
  offerKeep,
  openLogin,
  pickUsername,
  resendCode,
  signOut,
  togglePassword,
} from './features/account';
import { draftFromEntry, exitFlow, itemFor, saveDraft, startGuide, swapGuide, toReflect } from './features/draft';
import { closeStory, openStoryView, weekStory } from './features/stories';
import { isDark, reduced } from './sculpture/engine';
import { angleToward, engine, pickAnchor } from './stage/stage';
import { S, isWide, newDraft, syncEngine } from './state/app';
import { DB, persist, reindex } from './state/store';
import { installNow, openInstall } from './features/install';
import { selectDay } from './ui/day-select';
import { closeDone } from './ui/done';
import { back, go, hintPath, refreshArchive, refreshExplore, refreshStone, renderView } from './ui/render';
import {
  backToDay,
  closeSheet,
  fillDaySheet,
  gotoSetPage,
  openDaySheet,
  openEntry,
  openSettings,
  refreshSettings,
  stepEntry,
} from './ui/sheets';
import { applyTheme, themeChanged } from './ui/theme';
import { toast } from './ui/toast';
import { dayDetailHTML, jumpHTML } from './views/archive';
import { trayHTML, wordColour } from './views/explore';
import { breatheIn, breatheOut } from './features/breath';
import { monthsPage, shownPatterns } from './views/patterns';
import { LEVEL_SAY, STEPS, reflectBody, reflectProgress, vReflect } from './views/reflect';
import { haptic } from './ui/haptics';

/** Move to a step of the check-in: only its body is swapped, so the header and the stone stay where they are. */
export function goStep(n: number) {
  const d = S.draft;
  d.note = $('#noteInput')?.value ?? d.note;
  d.step = Math.max(0, Math.min(STEPS.length - 1, n));
  S.discardArm = false;
  const body = $('#rbody'),
    grid = $('.r-grid');
  if (!body || !grid) return renderView({ quiet: true });
  grid.setAttribute('data-step', STEPS[d.step]);
  body.classList.remove('swap');
  void body.offsetWidth;
  body.innerHTML = reflectBody();
  body.classList.add('swap');
  const prog = $('.r-prog');
  if (prog) prog.outerHTML = reflectProgress();
  const backBtn = $('[data-act="rBack"]');
  if (backBtn && backBtn.lastChild) backBtn.lastChild.textContent = d.step ? 'قبلی' : 'کلمه‌ها';
  syncEngine();
  requestAnimationFrame(() =>
    (body.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true }),
  );
  if (!isWide()) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
}
/** How strong it was: the buttons follow, the stone answers. */
export function setIntensity(n: number) {
  n = Math.max(1, Math.min(3, Math.round(n)));
  if (S.draft.intensity === n) return;
  S.draft.intensity = n;
  $$('[data-act="rIntensity"]').forEach((b) => {
    const on = String(+b.dataset.n === n);
    b.setAttribute('aria-checked', on);
    b.setAttribute('aria-pressed', on);
  });
  const meter = $('.r-meter'),
    say = $('.r-say');
  if (meter) meter.style.setProperty('--lvl', String((n - 1) / 2));
  if (say) say.textContent = LEVEL_SAY[n as 1 | 2 | 3];
  haptic(6 + 4 * n);
  syncEngine();
  engine.pulse(0.25 * n);
}

export const ACT = {
  startA() {
    if (!S.editing) {
      S.draft.context = S.draft.path === 'guide' ? S.draft.context : null;
      S.draft.path = S.draft.path || 'explore';
    }
    engine.pulse(1, 520);
    hintPath(null);
    go('explore');
  },
  startB() {
    startGuide(true);
    engine.pulse(0.6, 420);
    hintPath(null);
    go('guide');
  },
  back() {
    back();
  },
  /* a word is breathed into the stone, or drawn back out of it to its place in the verse */
  word(el) {
    const k = el.dataset.key,
      d = S.draft,
      idx = d.items.findIndex((x) => x.key === k || x.parent === k);
    if (idx >= 0) {
      const it = d.items[idx];
      d.items.splice(idx, 1);
      d.focus = d.items.length - 1;
      breatheOut(el, labelOf(it.key), wordColour(it.key));
      engine.rippleAt(angleToward(el), it.key, false);
      refreshExplore();
      return;
    }
    if (d.items.length >= 3) {
      toast('سه کلمه انتخاب کردی. برای کلمه‌ی تازه، یکی رو بردار.');
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
      return;
    }
    const it = { key: k, parent: k };
    d.items.push(it);
    d.focus = d.items.length - 1;
    const colour = wordColour(k);
    refreshExplore({ stone: false });
    breatheIn(el, k, colour, () => {
      if (S.view !== 'explore') return;
      refreshStone();
      if (d.items.includes(it)) engine.rippleAt(angleToward(el), k, true);
    });
  },
  openCustom() {
    S.customOpen = true;
    if (S.view === 'explore') $('#tray').innerHTML = trayHTML();
    else swapGuide();
    requestAnimationFrame(() => $('#customInput')?.focus());
  },
  /* a name under the stone: its finer words take the line below it */
  focusSel(el) {
    const i = +el.dataset.i;
    if (S.draft.focus === i) return;
    S.draft.focus = i;
    refreshStone();
    $(`#xnames [data-act="focusSel"][data-i="${i}"]`)?.focus({ preventScroll: true });
  },
  removeSel(el) {
    const i = +el.dataset.i,
      it = S.draft.items[i];
    if (!it) return;
    S.draft.items.splice(i, 1);
    S.draft.focus = S.draft.items.length - 1;
    engine.rippleAt((lex(it.key).angle * Math.PI) / 180, it.key, false);
    refreshExplore();
    $('#tray button, #customInput')?.focus({ preventScroll: true });
  },
  refine(el) {
    const i = +el.dataset.i,
      it = S.draft.items[i];
    if (!it) return;
    // a finer word replaces the general one; tapping the chosen finer word again goes back to the general one
    const k = it.key === el.dataset.key && it.parent ? it.parent : el.dataset.key;
    if (it.key === k) return;
    it.key = k;
    engine.rippleAt((lex(k).angle * Math.PI) / 180, k, true);
    refreshStone();
    $(`#xfine [data-act="refine"][data-key="${el.dataset.key}"]`)?.focus({ preventScroll: true });
  },
  toGuide() {
    const keep = S.draft.items.slice();
    startGuide(true);
    S.draft.items = keep;
    go('guide');
  },
  toReflect() {
    if (!S.draft.items.length && !(S.view === 'guide' && S.guide?.q1 === 'body')) return;
    toReflect();
  },
  guideBack() {
    const g = S.guide;
    if (g.step === 'q1') {
      back();
      return;
    }
    if (g.step === 'q2') {
      g.step = 'q1';
      g.q1 = null;
    } else if (g.step === 'sug' || g.step === 'ambig') {
      if (g.q1 === 'none' || !g.q2) {
        g.step = 'q1';
        g.q1 = null;
        g.q2 = null;
      } else {
        g.step = 'q2';
        g.q2 = null;
      }
      S.draft.suggested = [];
    }
    S.draft.context = ctxFor(g.q1, g.q2);
    swapGuide();
  },
  answer(el) {
    const g = S.guide,
      id = el.dataset.id,
      list = el.closest('.stones');
    el.classList.add('chosen');
    list.classList.add('settling');
    $$('.stone', list).forEach((b) => (b.disabled = true));
    const proceed = () => {
      if (g.step === 'q1') {
        g.q1 = id;
        g.step = 'q2';
        S.draft.context = ctxFor(g.q1, null);
        engine.pulse(0.35, 360);
        swapGuide();
        return;
      }
      if (g.q1 === 'none') {
        const o = Q2.none.opts.find((x) => x.id === id);
        g.q2 = id;
        if (o.go === 'explore') {
          S.draft.path = 'guide';
          S.draft.context = null;
          go('explore');
        } else if (o.go === 'write') {
          S.draft.items = [];
          S.draft.context = null;
          toReflect();
          setTimeout(() => $('#noteInput')?.focus(), 700);
        } else if (o.go === 'unnamed') {
          S.draft.items = [];
          S.draft.context = null;
          toReflect();
        } else exitFlow();
        return;
      }
      g.q2 = id;
      S.draft.context = ctxFor(g.q1, g.q2);
      const o = Q2[g.q1].opts.find((x) => x.id === id);
      engine.pulse(0.8, 520);
      if (o.sug.length) {
        g.step = 'sug';
        S.draft.suggested = o.sug.slice();
      } else {
        g.step = 'ambig';
        S.draft.suggested = [];
      }
      setTimeout(swapGuide, reduced() ? 0 : 160);
    };
    setTimeout(proceed, reduced() ? 0 : 420);
  },
  pickSug(el) {
    const k = el.dataset.key,
      d = S.draft,
      i = d.items.findIndex((x) => x.key === k);
    if (i >= 0) {
      d.items.splice(i, 1);
      engine.rippleAt(angleToward(el), k, false);
    } else {
      if (d.items.length >= 3) {
        toast('سه کلمه انتخاب کردی. برای کلمه‌ی تازه، یکی رو بردار.');
        return;
      }
      d.items.push(itemFor(k));
      engine.rippleAt(angleToward(el), k, true);
    }
    el.setAttribute('aria-pressed', String(i < 0));
    const n = d.items.length,
      body = S.guide.q1 === 'body',
      p = $('#gbody .acts .primary');
    p.disabled = !(n || body);
    p.textContent = !n && body ? 'همین حس جسمی رو ثبت کن' : 'ادامه';
    syncEngine();
  },
  noneFit() {
    S.guide.step = 'ambig';
    S.draft.items = S.draft.items.filter((i) => !S.draft.suggested.includes(i.key));
    engine.pulse(-0.3, 400);
    swapGuide();
  },
  toExplore() {
    S.draft.path = 'guide';
    go('explore');
  },
  saveUnnamed() {
    S.draft.items = [];
    toReflect();
  },
  writeUnnamed() {
    S.draft.items = [];
    toReflect();
    setTimeout(() => $('#noteInput')?.focus(), 700);
  },
  exitFlow() {
    exitFlow();
  },
  palette(el) {
    const i = +el.dataset.i;
    S.draft.note = $('#noteInput')?.value ?? S.draft.note;
    S.draft.palette = S.draft.palette === i ? -1 : i;
    reRenderReflect();
    $(`[data-act="palette"][data-i="${i}"]`)?.focus({ preventScroll: true });
  },
  setColor(el) {
    const i = +el.dataset.i,
      it = S.draft.items[i];
    it.color = el.dataset.c || null;
    S.draft.note = $('#noteInput')?.value ?? S.draft.note;
    syncEngine();
    engine.rippleAt((lex(it.key).angle * Math.PI) / 180, it.key);
    reRenderReflect();
    $(`[data-act="setColor"][data-i="${i}"][data-c="${el.dataset.c}"]`)?.focus({ preventScroll: true });
  },
  rRemove(el) {
    const i = +el.dataset.i;
    S.draft.note = $('#noteInput')?.value ?? S.draft.note;
    const it = S.draft.items.splice(i, 1)[0];
    S.draft.palette = -1;
    engine.rippleAt((lex(it.key).angle * Math.PI) / 180, it.key, false);
    syncEngine();
    reRenderReflect();
  },
  verdict(el) {
    const p = shownPatterns().find((x) => x.id === el.dataset.id);
    if (!p) return;
    const { id, scene: _s, key: _k, ...counts } = p;
    DB.insights = DB.insights || {};
    DB.insights[id] = { verdict: el.dataset.v, ...counts, at: new Date().toISOString() };
    persist();
    const row = el.closest('.ins');
    row?.querySelectorAll('[data-act="verdict"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
    if (el.dataset.v !== 'no') return toast('ممنون؛ ثبت شد.');
    // «نه»: the row (or the card, if it was the only one) folds away, the way a deleted entry does
    toast('باشه؛ دیگه نشونش نمی‌دیم.');
    const target = row && row.parentElement?.children.length === 1 ? (row.closest('.card') as HTMLElement | null) : row;
    if (!target || reduced()) return renderView({ quiet: true });
    target.style.overflow = 'hidden';
    target.animate(
      [
        { height: target.offsetHeight + 'px', opacity: 1 },
        { height: '0px', opacity: 0, paddingBlock: '0px', marginBlock: '0px', borderWidth: '0px' },
      ],
      { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    ).onfinish = () => renderView({ quiet: true });
  },
  /* ── the check-in, step by step (views/reflect.ts) ── */
  rIntensity(el) {
    setIntensity(+el.dataset.n);
  },
  /* a sentence starter goes where the note continues, and the caret waits after it */
  noteStart(el) {
    const t = $('#noteInput');
    if (!t) return;
    const v = t.value.replace(/\s+$/, '');
    t.value = `${v}${v ? '\n' : ''}${el.dataset.t} `;
    S.draft.note = t.value;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
    haptic(6);
  },
  rNext() {
    goStep(S.draft.step + 1);
  },
  rBack() {
    if (S.draft.step > 0) goStep(S.draft.step - 1);
    else back();
  },
  /* one touch answers, and the next step follows on its own */
  rAnswer(el) {
    S.draft.meaning = { q: el.dataset.q, a: el.dataset.a };
    $$('[data-act="rAnswer"]').forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    haptic(8);
    engine.pulse(0.5);
    setTimeout(() => S.view === 'reflect' && STEPS[S.draft.step] === 'ask' && goStep(S.draft.step + 1), 280);
  },
  rSkip() {
    S.draft.meaning = null;
    goStep(S.draft.step + 1);
  },
  scene(el) {
    const id = el.dataset.s,
      on = S.draft.scenes;
    const i = on.indexOf(id);
    if (i >= 0) on.splice(i, 1);
    else {
      on.push(id);
      if (on.length > MAX_SCENES) on.shift();
    }
    $$('[data-act="scene"]').forEach((b) => b.setAttribute('aria-pressed', String(on.includes(b.dataset.s))));
  },
  changeWords() {
    S.draft.note = $('#noteInput')?.value ?? S.draft.note;
    S.prev = S.prev.filter((v) => v !== 'explore');
    S.prev.push('reflect');
    S.view = 'explore';
    S.customOpen = false;
    renderView();
  },
  save() {
    saveDraft();
  },
  /* closing loses the check-in; with something written in it, the first touch asks */
  discard() {
    const v = ($('#noteInput')?.value ?? S.draft.note).trim();
    if (v && !S.discardArm) {
      S.discardArm = true;
      S.draft.note = $('#noteInput')?.value ?? S.draft.note;
      const b = $('[data-act="discard"]');
      if (b) b.textContent = 'پاک بشه؟';
      return;
    }
    exitFlow('چیزی ثبت نشد.');
  },
  quickTheme() {
    DB.settings.direction = isDark() ? 'light' : 'night';
    persist();
    themeChanged();
  },
  openSettings() {
    openSettings();
  },
  closeSheet() {
    closeSheet();
  },
  dir(el) {
    DB.settings.direction = el.dataset.d;
    persist();
    themeChanged();
  },
  toggleMotion() {
    DB.settings.motion = reduced() ? 'full' : 'calm';
    persist();
    applyTheme(false);
    refreshSettings();
  },
  wipeAsk() {
    S.wipeArm = true;
    refreshSettings();
  },
  wipeYes() {
    const own = DB.entries.filter((e) => !e.demo && !e.deletedAt),
      n = own.length,
      t = new Date().toISOString();
    if (isSignedIn())
      own.forEach((e) => {
        e.deletedAt = t;
        e.updatedAt = t;
        e.note = '';
      });
    else DB.entries = DB.entries.filter((e) => e.demo);
    S.wipeArm = false;
    persist();
    reindex();
    refreshSettings();
    renderView({ quiet: true });
    toast(n ? `${fa(n)} ردپای خودت پاک شد.` : 'ردپایی از خودت نبود.');
  },
  mode(el) {
    S.arch.mode = el.dataset.m;
    S.arch.cursor = S.arch.sel;
    $$('.seg [data-act="mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === S.arch.mode)));
    $$('[data-act="shift"]').forEach((b) =>
      b.setAttribute(
        'aria-label',
        S.arch.mode === 'month'
          ? b.dataset.d < 0
            ? 'ماه قبل'
            : 'ماه بعد'
          : b.dataset.d < 0
            ? 'هفته‌ی قبل'
            : 'هفته‌ی بعد',
      ),
    );
    refreshArchive();
    // the calendar's new shape settles in quietly instead of snapping
    if (!reduced())
      $('#archCal')?.animate(
        [
          { opacity: 0, translate: '0 8px' },
          { opacity: 1, translate: '0 0' },
        ],
        { duration: 280, easing: 'cubic-bezier(.32,.72,0,1)' },
      );
  },
  shift(el) {
    const A = S.arch,
      d = +el.dataset.d;
    if (A.mode === 'month') {
      const j = jOfKey(A.cursor);
      let jy = j.jy,
        jm = j.jm + d;
      if (jm < 1) {
        jm = 12;
        jy--;
      }
      if (jm > 12) {
        jm = 1;
        jy++;
      }
      A.cursor = keyOfJ(jy, jm, 1);
    } else A.cursor = keyAdd(weekStart(A.cursor), 7 * d);
    if (A.jump) {
      A.jy = jOfKey(A.cursor).jy;
    }
    refreshArchive();
    if (A.jump) reRenderJump();
  },
  goToday() {
    const k = todayKey();
    S.arch.cursor = k;
    selectDay(k, false);
    refreshArchive();
    if (!isWide() && S.arch.mode === 'month') openDaySheet(k);
  },
  toggleJump() {
    const A = S.arch;
    A.jump = !A.jump;
    A.jy = jOfKey(A.cursor).jy;
    renderView({ quiet: true });
    requestAnimationFrame(() =>
      (A.jump ? $('.jm [aria-pressed="true"]') || $('.jm button') : $('#archTitle'))?.focus({ preventScroll: true }),
    );
  },
  jy(el) {
    S.arch.jy = (S.arch.jy ?? jOfKey(S.arch.cursor).jy) + +el.dataset.d;
    reRenderJump();
  },
  jm(el) {
    const A = S.arch;
    A.cursor = keyOfJ(A.jy, +el.dataset.m, 1);
    A.jump = false;
    renderView({ quiet: true });
    requestAnimationFrame(() => $('#archTitle')?.focus({ preventScroll: true }));
  },
  edit(el) {
    const e = DB.entries.find((x) => x.id === el.dataset.id);
    if (!e) return;
    S.editing = e.id;
    S.draft = draftFromEntry(e);
    S.guide = null;
    closeSheet(true);
    S.prev = ['archive'];
    S.view = 'reflect';
    renderView();
  },
  /* a check-in opens in a sheet of its own; its sculpture rises out of the tapped card's mark */
  openEnt(el) {
    const mark = el.closest('.ent')?.querySelector('.ent-mark');
    openEntry(el.dataset.id, mark);
  },
  entGo(el) {
    stepEntry(+el.dataset.d);
  },
  entBack() {
    backToDay();
  },
  entMore(el) {
    toggleEntActs(el);
  },
  askDel(el) {
    armDelete(el);
  },
  /* deletions are kept as tombstones so they reach the person's other devices */
  delYes(el) {
    const e = DB.entries.find((x) => x.id === el.dataset.id && !x.deletedAt);
    if (!e) return;
    disarmDelete(el);
    // from a check-in's own sheet: the sheet goes down first, then the check-in is gone (with an undo)
    if (el.closest('#layer')) {
      closeSheet();
      deleteEntry(e);
      return;
    }
    const row = el.closest('.ent');
    if (row && !reduced()) {
      // the row folds away before the list is redrawn without it
      row.style.overflow = 'hidden';
      row.animate(
        [
          { height: row.offsetHeight + 'px', opacity: 1 },
          { height: '0px', opacity: 0, paddingBlock: '0px', marginBlock: '0px' },
        ],
        { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
      ).onfinish = () => deleteEntry(e);
    } else deleteEntry(e);
  },
  newToday() {
    closeSheet(true);
    S.draft = newDraft();
    go('today', { push: false });
  },
  range(el) {
    S.pat.range = +el.dataset.r;
    renderView({ quiet: true });
  },
  pm(el) {
    S.pat.mOff += +el.dataset.d;
    const M = monthsPage(),
      box = $('#mcals');
    if (!box) return;
    box.style.setProperty('--n', M.n);
    box.innerHTML = M.html;
    box.classList.remove('slide-l', 'slide-r');
    void box.offsetWidth;
    box.classList.add(+el.dataset.d > 0 ? 'slide-l' : 'slide-r');
    const [o, nw] = $$('[data-act="pm"]');
    o.disabled = !M.older;
    nw.disabled = !M.newer;
  },
  doneClose() {
    closeDone(() => {
      window.scrollTo(0, 0);
      requestAnimationFrame(pickAnchor);
      /* once the stone has come home, and only the first time: «نگهش داریم؟» */
      setTimeout(() => S.view === 'today' && !S.sheet && offerKeep(), 900);
    });
  },
  doneArchive() {
    closeDone(() => {
      const k = todayKey();
      S.arch.sel = k;
      S.arch.cursor = k;
      S.arch.mode = 'week';
      go('archive', { push: false });
    });
  },
  setPage() {
    gotoSetPage('settings');
  },
  aboutPage() {
    gotoSetPage('about');
  },
  accountPage() {
    gotoSetPage('account');
  },
  loginGoogle() {
    if (S.sheet === 'login') loginStep('google');
    else openLogin('google');
  },
  loginEmail() {
    if (S.sheet === 'login') loginStep('email');
    else openLogin('email');
  },
  loginSignup() {
    if (S.sheet === 'login') loginStep('password', 'signup');
    else openLogin('password', 'signup');
  },
  loginPassword() {
    if (S.sheet === 'login') loginStep('password', 'login');
    else openLogin('password', 'login');
  },
  userPick(el) {
    pickUsername(el.dataset.u);
  },
  pwToggle() {
    togglePassword();
  },
  loginResend() {
    resendCode();
  },
  installApp() {
    openInstall();
  },
  installNow() {
    installNow();
  },
  loginSkip() {
    DB.loginDone = true;
    persist();
    S.prev = [];
    S.view = 'today';
    renderView();
  },
  signOut() {
    signOut();
  },
  deleteAsk() {
    S.deleteArm = true;
    refreshSettings();
  },
  deleteYes() {
    S.deleteArm = false;
    deleteAccount();
  },
  weekStory(el) {
    weekStory(el.dataset.w);
  },
  openStory(el) {
    const st = DB.stories.find((x) => x.id === el.dataset.id);
    if (st) openStoryView(st, 0);
  },
  storyNext() {
    const s0 = S.story;
    if (s0 && s0.st) openStoryView(s0.st, s0.i + 1, s0.el);
  },
  storyPrev() {
    const s0 = S.story;
    if (s0 && s0.st) openStoryView(s0.st, s0.i - 1, s0.el);
  },
  storyClose() {
    closeStory();
  },
  storyRegen() {
    const s0 = S.story;
    if (s0 && s0.st) weekStory(s0.st.week, true);
  },
  toastAct() {
    const f = toast.fn;
    $('#toast').innerHTML = '';
    f && f();
  },
};
export function reRenderReflect() {
  const v = $('#views .view:not(.leaving)');
  if (!v) return;
  const y = scrollY;
  v.innerHTML = vReflect();
  v.classList.remove('enter');
  window.scrollTo(0, y);
  requestAnimationFrame(pickAnchor);
}
export function reRenderDetail() {
  if (S.sheet === 'day') {
    const sc = $('#layer .sheet-scroll')?.scrollTop || 0;
    fillDaySheet();
    const n = $('#layer .sheet-scroll');
    if (n) n.scrollTop = sc;
  } else {
    const d = isWide() ? $('#archDetail') : $('.winline');
    if (d) d.innerHTML = dayDetailHTML(S.arch.sel, false);
    requestAnimationFrame(pickAnchor);
  }
}
export function reRenderJump() {
  const j = $('.jump');
  if (j) j.outerHTML = jumpHTML();
}

/* an entry's «⋯» opens a small pill of its actions in place; a tap anywhere else or Escape closes it */
function closeEntActs(box) {
  if (!box.classList.contains('open')) return;
  box.classList.remove('open');
  box.querySelector('.more')?.setAttribute('aria-expanded', 'false');
  const del = box.querySelector('.tool.del.arm');
  if (del) disarmDelete(del);
  document.removeEventListener('pointerdown', box._away, true);
  document.removeEventListener('keydown', box._key, true);
}
function toggleEntActs(b) {
  const box = b.closest('.ent-tools');
  if (!box) return;
  const opening = !box.classList.contains('open');
  document.querySelectorAll('.ent-tools.open').forEach(closeEntActs);
  if (!opening) return;
  box.classList.add('open');
  b.setAttribute('aria-expanded', 'true');
  box._away = (ev) => {
    if (!box.contains(ev.target)) closeEntActs(box);
  };
  box._key = (ev) => {
    if (ev.key !== 'Escape') return;
    closeEntActs(box);
    b.focus({ preventScroll: true });
  };
  document.addEventListener('pointerdown', box._away, true);
  document.addEventListener('keydown', box._key, true);
  box.querySelector('.ent-acts .tool')?.focus({ preventScroll: true });
}

/* delete in place: the trash icon opens into a «حذف؟» pill; a second tap deletes, anything else closes it */
let disarmTimer: ReturnType<typeof setTimeout> | undefined;
function disarmDelete(b) {
  clearTimeout(disarmTimer);
  if (!b.classList.contains('arm')) return;
  b.classList.remove('arm');
  b.dataset.act = 'askDel';
  b.setAttribute('aria-label', b.dataset.label);
  b.closest('.ent-tools')?.classList.remove('arming');
  document.removeEventListener('pointerdown', b._away, true);
}
function armDelete(b) {
  $$('.tool.del.arm').forEach(disarmDelete);
  b.dataset.label = b.getAttribute('aria-label');
  b.classList.add('arm');
  b.dataset.act = 'delYes';
  b.setAttribute('aria-label', 'برای حذف، دوباره بزن');
  b.closest('.ent-tools')?.classList.add('arming');
  b._away = (ev) => {
    if (!b.contains(ev.target)) disarmDelete(b);
  };
  document.addEventListener('pointerdown', b._away, true);
  disarmTimer = setTimeout(() => disarmDelete(b), 4000);
}
function deleteEntry(e) {
  const t = new Date().toISOString();
  e.deletedAt = t;
  e.updatedAt = t;
  S.lastDel = { e };
  S.confirmDel = null;
  persist();
  reindex();
  refreshArchive();
  toast('ردپا حذف شد.', {
    label: 'برگردون',
    fn: () => {
      if (!S.lastDel) return;
      const d = S.lastDel.e;
      d.deletedAt = null;
      d.updatedAt = new Date().toISOString();
      S.lastDel = null;
      persist();
      reindex();
      refreshArchive();
      toast('برگشت.');
    },
  });
}
