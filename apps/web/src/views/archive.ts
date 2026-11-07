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
          <div class="navbtns"><button class="today-btn" data-act="goToday" aria-label="برگشت به امروز" ${inPeriod && A.sel === todayKey() ? 'disabled' : ''}><span class="tb-long">برگشت به </span>امروز</button>
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
    cells += `<button class="day ${list.length ? 'has' : ''} ${k === tk ? 'is-today' : ''} ${k === A.sel ? 'is-sel' : ''} ${k > tk ? 'is-future' : ''} ${list.length && !named ? 'is-unnamed' : ''}" data-day="${k}" aria-label="${dayLabel(k, list)}" aria-pressed="${k === A.sel}" ${k === tk ? 'aria-current="date"' : ''} tabindex="${k === A.sel || (d === 1 && !A.sel.startsWith(first.slice(0, 7))) ? 0 : -1}" style="${dayTint(k)}">
      <span class="dn">${fa(d)}</span><span class="trw"><span class="aura" aria-hidden="true"></span>${list.length ? traceImg(daySpec(k)) : ''}</span></button>`;
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
      return `<button class="wpill ${list.length ? 'has' : ''} ${k === A.sel ? 'is-sel' : ''} ${k === tk ? 'is-today' : ''} ${k > tk ? 'is-future' : ''} ${list.length && !named ? 'is-unnamed' : ''}" data-day="${k}" aria-label="${dayLabel(k, list)}" aria-pressed="${k === A.sel}" tabindex="${k === A.sel ? 0 : -1}" style="${dayTint(k)}">
      <span class="wk-wd">${WD_S[i]}</span><span class="wk-dn num">${fa(j.jd)}</span><span class="trw"><span class="aura" aria-hidden="true"></span>${list.length ? traceImg(daySpec(k)) : '<span class="wk-empty"></span>'}</span></button>`;
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
  return `<div class="wk2">${strip}${dayHeroHTML(A.sel)}<div class="wk2-list">${dayEntriesHTML(A.sel)}</div>${summary}</div>`;
}
/** The chosen day as one shape (the live sculpture takes this day's feelings), its words and a short count. */
/**
 * How a day reads in one line: how many check-ins. No «·», which in Persian digits reads as a zero.
 */
export function dayMeta(list: { time: string }[]) {
  // each card already shows its own time; the day only says how many
  return list.length ? `${fa(list.length)} ردپا` : '';
}
/** The colour of a day's first feeling, for the soft light under its stone when it is chosen. */
function dayTint(k: string) {
  const sp = daySpec(k);
  return sp.items[0] ? `--dc:${palFor(sp.items[0].key, sp.items[0].color)[1]}` : '';
}
/**
 * The chosen day on a phone: its shape, then its date as the title and one line of when. The words live in the
 * entries below, said once.
 */
export function dayHeroHTML(k: string) {
  const list = dayList(k),
    tk = todayKey(),
    j = jOfKey(k),
    rel = k === tk ? 'امروز' : k === keyAdd(tk, -1) ? 'دیروز' : '';
  const meta = dayMeta(list) || (k > tk ? 'این روز هنوز نیومده.' : 'ردپایی نداره.');
  return `<section class="wk2-day" aria-label="${fmtDay(k)}">
    <div class="wk2-stage"><div class="anchor-day" data-anchor data-scale=".5"></div></div>
    <h2 class="wk2-title" aria-live="polite">${WD[wdIndex(k)]}، ${fa(j.jd)} ${J_MONTHS[j.jm - 1]}${rel ? `<span class="rel">${rel}</span>` : ''}</h2>
    <p class="wk2-meta">${meta}</p></section>`;
}
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
export function ctxLine(c) {
  return c ? `<p class="ent-ctx"><span>${c.name}:</span> ${esc(c.value)}</p>` : '';
}
export const entryColor = (e) =>
  e.emotions.length ? palFor(e.emotions[0].key, e.emotions[0].color)[1] : NEUTRAL_PAL[1];
/**
 * One check-in as a card: its shape, when and with whom, its feelings as soft capsules in their own colours, the
 * note. A tap on the card (or its shape, for the keyboard) opens the check-in in a sheet of its own. On a phone the card is swiped to the left to show its actions underneath (delete at the outer edge, as in a
 * mail app); with a mouse or a keyboard the same actions open from a quiet «⋯».
 */
export function entryHTML(e, next?) {
  const t = fa(e.time),
    scenes = (e.scenes || []).filter(isScene).map((s) => SCENES[s]);
  const feels = e.emotions.length
    ? e.emotions.map((x) => `<span style="--c1:${palFor(x.key, x.color)[1]}">${esc(labelOf(x.key))}</span>`).join('')
    : '<span class="un">حالی بی‌نام</span>';
  return `<li class="ent ${next ? 'has-next' : ''}" data-id="${e.id}" style="--ec:${entryColor(e)}">
    <div class="ent-swipe" aria-hidden="true">
      <button class="sw-del" data-act="delYes" data-id="${e.id}" tabindex="-1">${IC.trash}<span>حذف</span></button>
      <button class="sw-edit" data-act="edit" data-id="${e.id}" tabindex="-1">${IC.edit}<span>ویرایش</span></button>
    </div>
    <div class="ent-card" data-act="openEnt" data-id="${e.id}">
      <button class="ent-mark ${e.emotions.length ? '' : 'un'}" data-act="openEnt" data-id="${e.id}" aria-label="دیدن ردپای ساعت ${t}">${traceImg(entrySpec(e))}</button>
      <div class="ent-body">
        <p class="ent-when"><span class="num">${t}</span>${scenes.length ? `<span>${scenes.join('، ')}</span>` : ''}${e.demo ? '<span class="ent-demo">نمونه</span>' : ''}</p>
        <p class="ent-feels">${feels}</p>
        ${ctxLine(e.context)}
        ${e.note ? `<p class="ent-note">${esc(e.note)}</p>` : ''}
      </div>
      <div class="ent-tools">
        <button class="tool more" data-act="entMore" data-id="${e.id}" aria-expanded="false" aria-label="ویرایش یا حذف ردپای ساعت ${t}">${IC.more}</button>
        <span class="ent-acts"><button class="tool" data-act="edit" data-id="${e.id}" aria-label="ویرایش ردپای ساعت ${t}" title="ویرایش">${IC.edit}</button><button class="tool danger del" data-act="askDel" data-id="${e.id}" aria-label="حذف ردپای ساعت ${t}" title="حذف">${IC.trash}<span class="del-t" aria-hidden="true">حذف؟</span></button></span>
      </div>
    </div></li>`;
}
/**
 * One check-in opened on its own: the living sculpture of that moment, when it was, its feelings, where, the whole
 * note, then what can be done with it. When the day has several, the top bar steps between them; opened from the
 * day's sheet, it also leads back to the day.
 */
export function entryDetailHTML(e, back = false) {
  const list = dayList(e.day),
    i = list.findIndex((x) => x.id === e.id),
    n = list.length,
    t = fa(e.time),
    j = jOfKey(e.day),
    scenes = (e.scenes || []).filter(isScene).map((s) => SCENES[s]);
  const feels = e.emotions.length
    ? e.emotions.map((x) => `<span style="--c1:${palFor(x.key, x.color)[1]}">${esc(labelOf(x.key))}</span>`).join('')
    : '<span class="un">حالی بی‌نام</span>';
  const pager =
    n > 1
      ? `<span class="ed-pager"><button class="ib" data-act="entGo" data-d="-1" aria-label="ردپای قبلی" ${i <= 0 ? 'disabled' : ''}>${IC.prev}</button><span class="num" aria-live="polite">${fa(i + 1)} از ${fa(n)}</span><button class="ib" data-act="entGo" data-d="1" aria-label="ردپای بعدی" ${i >= n - 1 ? 'disabled' : ''}>${IC.next}</button></span>`
      : '<span></span>';
  return `<div class="sheet-top ed-top">${back ? `<button class="back" data-act="entBack">${IC.back}روز</button>` : '<span></span>'}${pager}<button class="quiet" data-act="closeSheet">بستن</button></div>
    <div class="sheet-scroll ed">
      <div class="ed-stage"><div class="anchor-ent" data-anchor data-over data-scale=".5"></div></div>
      <div class="ed-info">
        <h2 class="ed-title" tabindex="-1" data-autofocus>${WD[wdIndex(e.day)]}، ${fa(j.jd)} ${J_MONTHS[j.jm - 1]}<span class="ed-time">ساعت <span class="num">${t}</span></span></h2>
        <p class="ent-feels ed-feels">${feels}</p>
        ${scenes.length ? `<p class="ed-scenes">${scenes.map((s) => `<span>${s}</span>`).join('')}</p>` : ''}
        ${ctxLine(e.context)}
        ${e.note ? `<p class="ed-note">${esc(e.note)}</p>` : ''}
        ${e.demo ? '<p class="ed-demo">این یه ردپای نمونه‌ست.</p>' : ''}
      </div>
      <div class="ed-acts">
        <button class="ed-edit" data-act="edit" data-id="${e.id}">${IC.edit}ویرایش</button>
        <button class="ed-del" data-act="askDel" data-id="${e.id}" aria-label="حذف این ردپا">${IC.trash}<span class="ed-del-l">حذف</span><span class="ed-del-q" aria-hidden="true">حذف؟</span></button>
      </div>
    </div>`;
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
    <div class="dd-title"><p class="eyebrow">${WD[wdIndex(k)]}${k === tk ? '، امروز' : ''}</p><h2 class="ed" tabindex="-1" id="ddTitle">${fa(j.jd)} ${J_MONTHS[j.jm - 1]} ${fa(j.jy)}</h2>
      <p class="dd-meta">${dayMeta(list)}</p></div></div>`;
  const body = list.length
    ? dayEntriesHTML(k)
    : `<div class="dd-empty">${k > tk ? '<p>این روز هنوز نیومده.</p>' : k === tk ? '<p>امروز هنوز ردپایی نداره.</p><button class="primary" data-act="newToday">ثبت ردپای امروز</button>' : '<p>این روز ردپایی نداره. لازم نیست همه‌ی روزها ثبت بشن.</p>'}</div>`;
  return inSheet ? { head, body } : `<div class="dd">${head}<div class="dd-body">${body}</div></div>`;
}
