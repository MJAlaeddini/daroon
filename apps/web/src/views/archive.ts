import {
  J_MONTHS,
  SCENES,
  WD,
  WD_S,
  fa,
  fmtDay,
  isScene,
  jMonthLen,
  jOfKey,
  keyAdd,
  keyOfJ,
  labelOf,
  todayKey,
  wdIndex,
  weekStart,
} from '@daroon/shared';
import { esc } from '../core/util';
import { NEUTRAL_PAL, palFor } from '../domain/lexicon';
import { daySpec, entrySpec } from '../domain/specs';
import { traceImg } from '../sculpture/traces';
import { S, isWide } from '../state/app';
import { DB, dayList } from '../state/store';
import { IC } from '../ui/icons';
import { wordWithGlyph } from './common';

/* archive */
export function archTitle() {
  const A = S.arch;
  if (A.mode === 'month') {
    const j = jOfKey(A.cursor);
    return { main: J_MONTHS[j.jm - 1], yr: fa(j.jy) };
  }
  const s = weekStart(A.cursor),
    e = keyAdd(s, 6),
    js = jOfKey(s),
    je = jOfKey(e);
  return {
    main:
      js.jm === je.jm
        ? `${fa(js.jd)} تا ${fa(je.jd)} ${J_MONTHS[js.jm - 1]}`
        : `${fa(js.jd)} ${J_MONTHS[js.jm - 1]} تا ${fa(je.jd)} ${J_MONTHS[je.jm - 1]}`,
    yr: fa(je.jy),
  };
}
/**
 * Queues the day marks of the shown month and its neighbours, so switching between week and month (or to the
 * next month) finds them drawn already instead of fading them in one by one.
 */
export function warmArchive() {
  const j = jOfKey(S.arch.cursor);
  for (let off = -1; off <= 1; off++) {
    const m = j.jy * 12 + j.jm - 1 + off,
      jy = Math.floor(m / 12),
      jm = (m % 12) + 1;
    for (let d = 1; d <= jMonthLen(jy, jm); d++) {
      const k = keyOfJ(jy, jm, d);
      if (dayList(k).length) traceImg(daySpec(k));
    }
  }
}
export function vArchive() {
  warmArchive();
  const A = S.arch,
    t = archTitle();
  const inPeriod =
    A.mode === 'month'
      ? (() => {
          const a = jOfKey(A.cursor),
            b = jOfKey(todayKey());
          return a.jy === b.jy && a.jm === b.jm;
        })()
      : weekStart(A.cursor) === weekStart(todayKey());
  return `<div class="a-grid">
    <div class="a-main">
      <div class="a-head">
        <h1 class="a-title r" style="--i:0"><span class="vh">ردپای من</span><button class="title-jump" data-act="toggleJump" aria-expanded="${A.jump}" id="archTitle">${t.main} <span class="yr num">${t.yr}</span>${IC.down}</button></h1>
        <span></span>
        <div class="a-ctrls">
          <div class="seg" role="group" aria-label="نمای تقویم"><button data-act="mode" data-m="month" aria-pressed="${A.mode === 'month'}">ماه</button><button data-act="mode" data-m="week" aria-pressed="${A.mode === 'week'}">هفته</button></div>
          <div class="navbtns"><button class="today-btn" data-act="goToday" ${inPeriod && A.sel === todayKey() ? 'disabled' : ''}>امروز</button>
            <button class="ib" data-act="shift" data-d="-1" aria-label="${A.mode === 'month' ? 'ماه قبل' : 'هفته‌ی قبل'}">${IC.prev}</button>
            <button class="ib" data-act="shift" data-d="1" aria-label="${A.mode === 'month' ? 'ماه بعد' : 'هفته‌ی بعد'}">${IC.next}</button></div>
        </div>
      </div>
      ${A.jump ? jumpHTML() : ''}
      <div id="archCal">${A.mode === 'month' ? monthHTML() : weekHTML()}</div>

    </div>
    <aside class="a-detail" id="archDetail" aria-label="جزئیات روز">${isWide() ? dayDetailHTML(A.sel, false) : ''}</aside>
  </div>`;
}
export function jumpHTML() {
  const A = S.arch,
    cur = jOfKey(A.cursor),
    y = A.jy ?? cur.jy;
  const counts = J_MONTHS.map((_, i) => {
    let c = 0;
    const len = jMonthLen(y, i + 1);
    for (let d = 1; d <= len; d++) c += dayList(keyOfJ(y, i + 1, d)).length;
    return c;
  });
  return `<div class="jump" role="group" aria-label="رفتن به ماه یا سال">
    <div class="jy"><button class="ib" data-act="jy" data-d="-1" aria-label="سال قبل">${IC.prev}</button><strong class="num">${fa(y)}</strong><button class="ib" data-act="jy" data-d="1" aria-label="سال بعد">${IC.next}</button></div>
    <div class="jm">${J_MONTHS.map((m, i) => `<button data-act="jm" data-m="${i + 1}" aria-pressed="${cur.jy === y && cur.jm === i + 1}">${m}<small class="num">${counts[i] ? fa(counts[i]) + ' ردپا' : ''}</small></button>`).join('')}</div></div>`;
}
export function dayLabel(k, list) {
  return `${fmtDay(k)}، ${list.length ? fa(list.length) + ' ردپا' : 'بدون ردپا'}${k === todayKey() ? '، امروز' : ''}`;
}
export function dots(list) {
  if (list.length < 2) return '<span class="dots"></span>';
  return `<span class="dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(list.length, 3))}${list.length > 3 ? '<b>+</b>' : ''}</span>`;
}
export function monthHTML() {
  const A = S.arch,
    j = jOfKey(A.cursor),
    first = keyOfJ(j.jy, j.jm, 1),
    lead = wdIndex(first),
    len = jMonthLen(j.jy, j.jm),
    tk = todayKey();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span aria-hidden="true"></span>';
  for (let d = 1; d <= len; d++) {
    const k = keyOfJ(j.jy, j.jm, d),
      list = dayList(k),
      named = list.some((e) => e.emotions.length);
    cells += `<button class="day ${list.length ? 'has' : ''} ${k === tk ? 'is-today' : ''} ${k === A.sel ? 'is-sel' : ''} ${k > tk ? 'is-future' : ''} ${list.length && !named ? 'is-unnamed' : ''}" data-day="${k}" aria-label="${dayLabel(k, list)}" aria-pressed="${k === A.sel}" ${k === tk ? 'aria-current="date"' : ''} tabindex="${k === A.sel || (d === 1 && !A.sel.startsWith(first.slice(0, 7))) ? 0 : -1}">
      <span class="dn">${fa(d)}</span><span class="trw">${list.length ? traceImg(daySpec(k)) : ''}</span>${list.length ? dots(list) : '<span class="dots"></span>'}</button>`;
  }
  return `<div class="cal-wd" aria-hidden="true">${WD_S.map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-grid" id="calGrid" role="group" aria-label="روزهای ${J_MONTHS[j.jm - 1]} ${fa(j.jy)}">${cells}</div>`;
}
export function weekHTML() {
  const A = S.arch,
    s0 = weekStart(A.cursor),
    tk = todayKey(),
    days = [...Array(7)].map((_, i) => keyAdd(s0, i));
  const ribbon = days
    .map((k, i) => {
      const j = jOfKey(k),
        list = dayList(k),
        named = list.some((e) => e.emotions.length);
      return `<button class="wpill ${list.length ? 'has' : ''} ${k === A.sel ? 'is-sel' : ''} ${k === tk ? 'is-today' : ''} ${k > tk ? 'is-future' : ''} ${list.length && !named ? 'is-unnamed' : ''}" data-day="${k}" aria-label="${dayLabel(k, list)}" aria-pressed="${k === A.sel}" tabindex="${k === A.sel ? 0 : -1}">
      <span class="wk-wd">${WD_S[i]}</span><span class="wk-dn num">${fa(j.jd)}</span><span class="trw">${list.length ? traceImg(daySpec(k)) : '<span class="wk-empty"></span>'}</span>${dots(list)}</button>`;
    })
    .join('');
  const all = days.flatMap(dayList),
    withT = days.filter((k) => dayList(k).length).length,
    cnt = new Map();
  all.forEach((e) => e.emotions.forEach((x) => cnt.set(x.key, (cnt.get(x.key) || 0) + 1)));
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const flow = days
    .map((k, i) => {
      const list = dayList(k),
        sp = daySpec(k),
        c = !list.length
          ? 'var(--line)'
          : !sp.items.length
            ? 'var(--ink-3)'
            : palFor(sp.items[0].key, sp.items[0].color)[1];
      return `${c} ${((i / 6) * 100).toFixed(1)}%`;
    })
    .join(',');
  const story = DB.stories.find((x) => x.week === s0);
  const summary = `<div class="wsum"><div class="wflow" style="background:linear-gradient(to left,${flow})" aria-hidden="true"></div>
      <p class="wsum-t">${all.length ? `${fa(withT)} روز از هفت روز این هفته ردپا داره${top.length ? `؛ بیشتر از همه ${top.map(([k]) => `«${esc(labelOf(k))}»`).join('، ')}` : ''}.` : s0 > tk ? 'این هفته هنوز نیومده.' : 'این هفته ردپایی نداره.'}</p>
      ${all.length >= 2 ? `<button class="storybtn" data-act="weekStory" data-w="${s0}"><span class="ring" style="--rg:${ringGrad(days)}"></span>${story ? 'داستان این هفته' : 'ساختن داستان این هفته'}</button>` : ''}</div>`;
  const strip = `<div class="wribbon" id="calGrid" role="group" aria-label="روزهای هفته">${ribbon}</div>`;
  if (isWide()) return strip + summary;
  return `<div class="wk2">${dayNavHTML(A.sel)}${strip}${dayHeroHTML(A.sel)}<div class="wk2-list">${dayEntriesHTML(A.sel)}</div>${summary}</div>`;
}
/* phone week view: the chosen day on top with arrows to step a day, the week below it, then the day itself */
export function dayNavHTML(k: string) {
  const tk = todayKey(),
    j = jOfKey(k),
    rel = k === tk ? 'امروز' : k === keyAdd(tk, -1) ? 'دیروز' : '';
  return `<div class="wk2-nav"><button class="ib" data-act="dayShift" data-d="-1" aria-label="روز قبل">${IC.prev}</button>
    <p class="wk2-date" aria-live="polite"><b>${WD[wdIndex(k)]}، ${fa(j.jd)} ${J_MONTHS[j.jm - 1]}</b>${rel ? `<small>${rel}</small>` : ''}</p>
    <button class="ib" data-act="dayShift" data-d="1" aria-label="روز بعد" ${k >= tk ? 'disabled' : ''}>${IC.next}</button></div>`;
}
/** The chosen day as one shape (the live sculpture takes this day's feelings), its words and a short count. */
export function dayHeroHTML(k: string) {
  const list = dayList(k),
    tk = todayKey(),
    sp = daySpec(k);
  const words = sp.items.length
    ? sp.items.map((it) => `<span style="${cvarsFor(it)}">${esc(labelOf(it.key))}</span>`).join('<i>، </i>')
    : list.length
      ? 'حالی بی‌نام'
      : k > tk
        ? 'این روز هنوز نیومده'
        : 'ردپایی نداره';
  const times = list.map((e) => e.time).sort();
  const meta = list.length
    ? `<span class="num">${fa(list.length)} ردپا</span>${times.length > 1 ? `<span class="num">${fa(times[0])} تا ${fa(times[times.length - 1])}</span>` : `<span class="num">ساعت ${fa(times[0])}</span>`}`
    : '';
  return `<section class="wk2-day" aria-label="${fmtDay(k)}"><div class="wk2-stage"><div class="anchor-day" data-anchor data-scale=".5"></div></div>
    <p class="wk2-words ${list.length ? '' : 'empty'}">${words}</p>${meta ? `<p class="wk2-meta">${meta}</p>` : ''}</section>`;
}
const cvarsFor = (it) => {
  const p = palFor(it.key, it.color);
  return `--c1:${p[1]}`;
};
export function ringGrad(days) {
  const cs = days
    .map((k) => {
      const sp = daySpec(k);
      return sp.items[0] ? palFor(sp.items[0].key, sp.items[0].color)[1] : null;
    })
    .filter(Boolean);
  if (!cs.length) return 'var(--line-2)';
  return `conic-gradient(${cs.concat(cs[0]).join(',')})`;
}
/** «خانواده، بیرون» after the time, when the check-in says who or what was around. */
export function sceneLine(scenes?: string[]) {
  const l = (scenes || []).filter(isScene).map((s) => SCENES[s]);
  return l.length ? `<span class="ent-sc">${l.join('، ')}</span>` : '';
}
export function ctxLine(c) {
  return c ? `<p class="ent-ctx"><span>${c.name}:</span> ${esc(c.value)}</p>` : '';
}
export const entryColor = (e) =>
  e.emotions.length ? palFor(e.emotions[0].key, e.emotions[0].color)[1] : NEUTRAL_PAL[1];
export function entryHTML(e, next?) {
  return `<li class="ent ${next ? 'has-next' : ''}" data-id="${e.id}" style="--ec:${entryColor(e)};--en:${next ? entryColor(next) : 'transparent'}">
    <div class="ent-mark ${e.emotions.length ? '' : 'un'}">${traceImg(entrySpec(e))}</div>
    <div class="ent-body">
      <div class="ent-meta"><span class="num">${fa(e.time)}</span>${sceneLine(e.scenes)}${e.demo ? '<span class="tag">نمونه</span>' : ''}
        <span class="ent-tools"><button class="tool" data-act="edit" data-id="${e.id}" aria-label="ویرایش ردپای ساعت ${fa(e.time)}" title="ویرایش">${IC.edit}</button><button class="tool danger del" data-act="askDel" data-id="${e.id}" aria-label="حذف ردپای ساعت ${fa(e.time)}" title="حذف">${IC.trash}<span class="del-t" aria-hidden="true">حذف؟</span></button></span></div>
      ${e.emotions.length ? `<p class="ent-words">${e.emotions.map((x) => wordWithGlyph(x.key, x.color)).join('')}</p>` : `<p class="ent-words un">حالی بی‌نام</p>`}
      ${ctxLine(e.context)}
      ${e.note ? `<p class="ent-note">${esc(e.note)}</p>` : ''}
    </div></li>`;
}
/** The day's entries (or what to say when there are none), shared by the day detail and the phone week view. */
export function dayEntriesHTML(k: string) {
  const list = dayList(k),
    tk = todayKey();
  return list.length
    ? `<ol class="ents">${list.map((e, i) => entryHTML(e, list[i + 1])).join('')}</ol>${k === tk ? '<div class="dd-empty"><button class="link" data-act="newToday">ردپای تازه برای امروز</button></div>' : ''}`
    : `<div class="dd-empty">${k > tk ? '' : k === tk ? '<button class="primary" data-act="newToday">ثبت ردپای امروز</button>' : '<p>لازم نیست همه‌ی روزها ثبت بشن.</p>'}</div>`;
}
export function dayDetailHTML(k: string, inSheet?: boolean): any {
  const list = dayList(k),
    j = jOfKey(k),
    tk = todayKey();
  const head = `<div class="dd-head">
    <div class="dd-title"><p class="eyebrow">${WD[wdIndex(k)]}${k === tk ? ' · امروز' : ''}</p><h2 class="ed" tabindex="-1" id="ddTitle">${fa(j.jd)} ${J_MONTHS[j.jm - 1]} ${fa(j.jy)}</h2>
      <p class="dd-meta">${list.length ? `${fa(list.length)} ردپا` : ''}</p></div></div>`;
  const body = list.length
    ? dayEntriesHTML(k)
    : `<div class="dd-empty">${k > tk ? '<p>این روز هنوز نیومده.</p>' : k === tk ? '<p>امروز هنوز ردپایی نداره.</p><button class="primary" data-act="newToday">ثبت ردپای امروز</button>' : '<p>این روز ردپایی نداره. لازم نیست همه‌ی روزها ثبت بشن.</p>'}</div>`;
  return inSheet ? { head, body } : `<div class="dd">${head}<div class="dd-body">${body}</div></div>`;
}
