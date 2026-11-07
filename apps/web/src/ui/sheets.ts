import { authCfg } from '../features/account';
import { fa, fmtDay } from '@daroon/shared';
import { $, esc } from '../core/util';
import { avatarHTML } from '../features/account';
import { mqReduce, reduced } from '../sculpture/engine';
import { Stage, grow, pickAnchor, usingGL } from '../stage/stage';
import { S, syncEngine } from '../state/app';
import { DB, dayList, visible } from '../state/store';
import { IC } from './icons';
import { canInstall } from '../features/install';
import { dayDetailHTML, entryDetailHTML, monthHTML, weekHTML } from '../views/archive';

/* sheets */
export function openSheet(kind: string, html: string, label?: string) {
  S.sheet = kind;
  const L = $('#layer');
  L.classList.remove('out');
  L.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${label}"><span class="grab" aria-hidden="true"></span>${html}</div>`;
  S.sheetReturn = document.activeElement;
  syncEngine();
  requestAnimationFrame(() => {
    pickAnchor();
    const f = L.querySelector('[data-autofocus], h2[tabindex], .sheet button');
    f && f.focus({ preventScroll: true });
  });
}
export function fillDaySheet() {
  const L = $('#layer .sheet');
  if (!L) return;
  const { head, body } = dayDetailHTML(S.arch.sel, true);
  L.innerHTML = `<span class="grab" aria-hidden="true"></span><div class="sheet-top"><span></span><button class="quiet" data-act="closeSheet">بستن</button></div>${head}<div class="sheet-scroll">${body}</div>`;
  requestAnimationFrame(pickAnchor);
}
export function openDaySheet(k) {
  S.arch.sel = k;
  const { head, body } = dayDetailHTML(k, true);
  openSheet(
    'day',
    `<div class="sheet-top"><span></span><button class="quiet" data-act="closeSheet">بستن</button></div>${head}<div class="sheet-scroll">${body}</div>`,
    fmtDay(k),
  );
}
/* one check-in in a sheet of its own; its living sculpture rises out of the mark that was tapped */
const GRAB = '<span class="grab" aria-hidden="true"></span>';
function flyFrom(r?: DOMRect | null) {
  if (!r || r.width < 4 || reduced() || !Stage.anchor?.closest?.('#layer')) return;
  const g = grow(r);
  Stage.from = { x: g.left, y: g.top, w: g.width, h: g.height };
  Stage.t0 = performance.now();
  Stage.dur = 640;
}
export function openEntry(id: string, from?: Element | null) {
  const e = DB.entries.find((x) => x.id === id && !x.deletedAt);
  if (!e) return;
  const r = from?.getBoundingClientRect() || null;
  S.entry = id;
  const label = `ردپای ساعت ${fa(e.time)}`;
  if (S.sheet === 'day' && $('#layer .sheet')) {
    // from the day's sheet: the same sheet goes one level in, with a way back to the day
    S.entFrom = 'day';
    S.sheet = 'entry';
    const L = $('#layer .sheet');
    L.setAttribute('aria-label', label);
    L.innerHTML = GRAB + entryDetailHTML(e, true);
    syncEngine();
    requestAnimationFrame(() => {
      pickAnchor();
      flyFrom(r);
      L.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    });
    return;
  }
  S.entFrom = null;
  openSheet('entry', entryDetailHTML(e), label);
  // the tapped mark has gone up into the sheet; the title takes focus, not the first arrow
  from?.closest('.ent')?.classList.add('is-open');
  requestAnimationFrame(() => {
    flyFrom(r);
    ($('#layer .ed-title') as HTMLElement | null)?.focus({ preventScroll: true });
  });
}
/** Another check-in of the same day, in place: the sculpture changes shape where it stands. */
export function stepEntry(d: number) {
  const e = DB.entries.find((x) => x.id === S.entry && !x.deletedAt);
  const L = $('#layer .sheet');
  if (!e || !L) return;
  const list = dayList(e.day);
  const next = list[list.findIndex((x) => x.id === e.id) + d];
  if (!next) return;
  S.entry = next.id;
  L.innerHTML = GRAB + entryDetailHTML(next, S.entFrom === 'day');
  L.querySelector('.ed-info')?.classList.add('step', d > 0 ? 'fwd' : 'back');
  syncEngine();
  requestAnimationFrame(() => {
    pickAnchor();
    // keep focus on the arrow that was used, or on the title once that end of the day is reached
    const f =
      (L.querySelector(`[data-act=entGo][data-d="${d}"]:not([disabled])`) as HTMLElement | null) ||
      (L.querySelector('[data-autofocus]') as HTMLElement | null);
    f?.focus({ preventScroll: true });
  });
}
/** Back from a check-in to the day's sheet it was opened from. */
export function backToDay() {
  S.entry = null;
  S.entFrom = null;
  S.sheet = 'day';
  const L = $('#layer .sheet');
  L?.setAttribute('aria-label', fmtDay(S.arch.sel));
  fillDaySheet();
  syncEngine();
}
export function closeSheet(instant = false) {
  if (!S.sheet) return;
  const L = $('#layer');
  S.sheet = null;
  S.entry = null;
  S.entFrom = null;
  S.confirmDel = null;
  const done = () => {
    L.innerHTML = '';
    L.classList.remove('out');
  };
  document.querySelectorAll('.ent.is-open').forEach((el) => el.classList.remove('is-open'));
  if (instant || reduced()) done();
  else {
    L.classList.add('out');
    L.querySelector('.sheet')?.classList.add('out');
    setTimeout(done, 280);
  }
  syncEngine();
  requestAnimationFrame(pickAnchor);
  if (S.view === 'archive' && !instant) refreshArchiveSelOnly();
  S.sheetReturn && S.sheetReturn.focus && S.sheetReturn.focus({ preventScroll: true });
}
export function refreshArchiveSelOnly() {
  const cal = $('#archCal');
  if (cal) cal.innerHTML = S.arch.mode === 'month' ? monthHTML() : weekHTML();
}
export function settingsHTML() {
  const s = DB.settings,
    dirs = [
      [
        'auto',
        'پیروی از دستگاه',
        'روشن یا تیره، مثل دستگاهت',
        'linear-gradient(110deg,#f8f6f4 50%,#110e18 50%)',
        '#c9b8e8',
        '#c9b8e8',
      ],
      [
        'night',
        'هاله‌ی شب',
        'جوهر و بنفش نیمه‌شب',
        'radial-gradient(circle at 50% 40%,#2a2040,#110e18)',
        'radial-gradient(circle at 35% 30%,#fff,#b9a6e3 50%,#5a4a8a)',
        '#b9a6e3',
      ],
      [
        'light',
        'روشنای ادبی',
        'چینی سفید، مه یاسی و هلویی',
        'radial-gradient(circle at 80% 0%,#ece7f4,#f8f6f4 60%)',
        'radial-gradient(circle at 35% 30%,#fff,#e9b7a3 55%,#9f8fd0)',
        '#e9b7a3',
      ],
      [
        'spectrum',
        'طیف واکنشی',
        'رنگ‌های پرتر؛ فضا با احساس همرنگ می‌شه',
        'radial-gradient(circle at 40% 40%,#3a1d3c,#0e0b16 70%)',
        'conic-gradient(from 30deg,#f2b083,#cf6a8b,#7e74b2,#5f9693,#f2b083)',
        '#cf6a8b',
      ],
    ];
  const sw = (act, on, title, sub) =>
    `<button class="swrow" role="switch" data-act="${act}" aria-checked="${on}"><span><b>${title}</b><small>${sub}</small></span><span class="sw" aria-hidden="true"></span></button>`;
  const all = visible(),
    days = new Set(all.map((e) => e.day)).size,
    words = new Set(all.flatMap((e) => e.emotions.map((x) => x.key))).size;
  const acc = DB.account,
    page = S.setPage || 'account';
  const row = (act, title, sub) =>
    `<button class="navrow" data-act="${act}"><span><b>${title}</b><small>${sub}</small></span>${IC.next}</button>`;
  if (page === 'account')
    return `<div class="sheet-top"><span></span><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div>
  <div class="sheet-scroll set">
    <section class="profile">${avatarHTML(72)}<div><h2 class="ed" style="font-size:24px" tabindex="-1" data-autofocus>${acc ? esc(acc.name) : 'بدون حساب'}</h2>
      <p class="fine">${acc ? `${acc.provider === 'google' ? 'با Google' : 'با ایمیل'} · از ${fmtDay(acc.since, { weekday: false })}` : 'ردپاها فقط روی همین دستگاه هستن.'}</p></div>
      <div class="pstats"><div><b class="num">${fa(all.length)}</b><span>ردپا</span></div><div><b class="num">${fa(days)}</b><span>روز</span></div><div><b class="num">${fa(words)}</b><span>کلمه‌ی متفاوت</span></div></div>
      ${acc ? '' : `<div class="auth-btns"><button class="gbtn" data-act="loginGoogle"${authCfg.google ? '' : ' hidden'}><span class="g" aria-hidden="true">G</span>ادامه با Google</button><button class="gbtn" data-act="loginEmail"><span class="g" aria-hidden="true">@</span>ادامه با ایمیل</button></div>`}</section>
    <section class="set-sec rows">${canInstall() ? row('installApp', 'نصب روی گوشی', 'از صفحه‌ی اصلی، مثل یه برنامه باز می‌شه') : ''}${row('setPage', 'تنظیمات و ظاهر', 'حال‌وهوای بصری، حرکت، داده‌ها')}${row('aboutPage', 'درباره‌ی کلمه‌ها و شکل‌ها', 'پژوهش‌ها و این‌که شکل چه چیزی نیست')}</section>
    ${
      acc
        ? `<section class="set-sec"><button class="outline danger" data-act="signOut">خروج از حساب</button><p class="fine" style="margin-top:8px">ردپاها روی این دستگاه می‌مونن.</p>
      <button class="link danger-link" data-act="${S.deleteArm ? 'deleteYes' : 'deleteAsk'}">${S.deleteArm ? 'مطمئنی؟ حساب و همه‌ی ردپاهاش از همه‌ی دستگاه‌ها پاک می‌شه' : 'حذف حساب'}</button></section>`
        : ''
    }
  </div>`;
  const head = (t) =>
    `<div class="sheet-top"><button class="back" data-act="accountPage">${IC.back}حساب</button><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div><h2 class="ed sub-h" tabindex="-1" data-autofocus>${t}</h2>`;
  if (page === 'about')
    return `${head('درباره‌ی کلمه‌ها و شکل‌ها')}<div class="sheet-scroll set">
    <section class="set-sec about">
      <p>واژه‌های درون با الهام از پژوهش‌هایی درباره‌ی واژگان احساس در زبان فارسی انتخاب شده‌اند؛ از جمله کشکولی (${fa(2014)}) درباره‌ی ساختار واژگان احساس فارسی، محجوب‌نواز و همکاران (${fa(2024)}) درباره‌ی هنجارهای عاطفی واژه‌ها، و نعمتی و همکاران (${fa(2026)}). این منابع به انتخاب واژه‌ها جهت می‌دهند، اما شکل‌ها، رنگ‌ها و پیشنهادهای این برنامه را تأیید علمی نمی‌کنند.</p>
      <p>شکل درون یک استعاره‌ی بصریه که با انتخاب‌های خودت ساخته می‌شه. چیزی رو اندازه نمی‌گیره و تشخیص نمی‌ده. پیشنهادهای مسیر راهنمایی از قبل نوشته شده‌اند. داستان‌های هفته فقط از روی ردپاها و یادداشت‌های همون هفته نوشته می‌شن؛ یادداشت‌ها فقط برای نوشتن همون داستان فرستاده می‌شن و جایی نگه داشته نمی‌شن. بدون حساب، یه خلاصه‌ی ساده روی همین دستگاه نوشته می‌شه.</p>
      ${usingGL ? '' : '<p>مرورگرت WebGL2 نداره؛ نسخه‌ی ساده‌تر شکل نمایش داده می‌شه.</p>'}</section>
  </div>`;
  return `${head('تنظیمات و ظاهر')}<div class="sheet-scroll set">
    <section class="set-sec"><h3 class="sec">حال‌وهوای بصری</h3><div class="dirs" role="radiogroup" aria-label="حال‌وهوای بصری">${dirs.map(([id, t, sub, bg, sd, gl]) => `<button class="dir" role="radio" data-act="dir" data-d="${id}" aria-checked="${s.direction === id}"><span class="pv" style="background:${bg};--pvs:${sd};--pvg:${gl}"></span><span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div></section>
    <section class="set-sec"><h3 class="sec">حرکت</h3>
      ${sw('toggleMotion', reduced(), 'حرکت کمتر', mqReduce.matches && s.motion === 'system' ? 'دستگاهت حرکت کمتر رو خواسته.' : 'شکل آهسته‌تر نفس می‌کشه و جابه‌جایی‌ها فوری می‌شن.')}</section>
    <section class="set-sec"><h3 class="sec">داده‌ها</h3>
      <div class="btnrow"><button class="outline danger" data-act="${S.wipeArm ? 'wipeYes' : 'wipeAsk'}">${S.wipeArm ? (acc ? 'مطمئنی؟ از همه‌ی دستگاه‌هات پاک می‌شه' : 'مطمئنی؟ همه‌ی ردپاهای خودت پاک می‌شه') : 'پاک کردن ردپاهای خودم'}</button></div>
      <p class="fine">${IC.lock.replace('class="ic"', 'class="ic" style="width:14px;height:14px;vertical-align:-2px"')} ${acc ? 'ردپاها با حسابت روی دستگاه‌هات همگام می‌شن. یادداشت‌ها فقط روی همین دستگاه می‌مونن و به سرور فرستاده نمی‌شن.' : 'همه‌چیز فقط در همین مرورگر ذخیره می‌شه و به هیچ سروری فرستاده نمی‌شه.'}</p></section>
  </div>`;
}
export function openSettings() {
  S.wipeArm = false;
  S.deleteArm = false;
  S.setPage = 'account';
  openSheet('settings', settingsHTML(), 'حساب و تنظیمات');
}
export function gotoSetPage(pg) {
  S.setPage = pg;
  refreshSettings();
  const sh = $('#layer .sheet-scroll');
  if (sh) sh.scrollTop = 0;
  requestAnimationFrame(() => $('#layer [data-autofocus]')?.focus({ preventScroll: true }));
}
export function refreshSettings() {
  const sh = $('#layer .sheet');
  if (sh && S.sheet === 'settings') {
    const sc = sh.querySelector('.sheet-scroll')?.scrollTop || 0;
    sh.innerHTML = `<span class="grab" aria-hidden="true"></span>${settingsHTML()}`;
    const n = sh.querySelector('.sheet-scroll');
    if (n) n.scrollTop = sc;
  }
}
