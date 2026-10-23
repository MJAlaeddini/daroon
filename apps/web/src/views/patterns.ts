import { J_MONTHS, WD_S, fa, fmtDay, jMonthLen, jOfKey, keyAdd, keyOfJ, labelOf, todayKey, wdIndex, weekStart } from '@daroon/shared';
import { clamp, esc } from '../core/util';
import { cvars, palFor } from '../domain/lexicon';
import { daySpec } from '../domain/specs';
import { S, isWide } from '../state/app';
import { DB, dayList, visible } from '../state/store';
import { glyph } from '../ui/glyph';
import { IC } from '../ui/icons';
import { ringGrad } from './archive';

/* patterns */
export function patternData(){
  const R = S.pat.range, tk = todayKey(), from = R ? keyAdd(tk, -(R - 1)) : (visible().reduce((m, e) => e.day < m ? e.day : m, tk));
  const list = visible().filter(e => e.day >= from && e.day <= tk), named = list.filter(e => e.emotions.length);
  const freq = new Map(), pairs = new Map(), ctx = { situation: 0, thoughts: 0, body: 0, felt: 0 }; let un = 0;
  list.forEach(e => { if (!e.emotions.length) un++; if (e.context) ctx[e.context.kind] = (ctx[e.context.kind] || 0) + 1;
    const ks = [...new Set(e.emotions.map(x => x.key))]; ks.forEach(k => freq.set(k, (freq.get(k) || 0) + 1));
    for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++){ const p = [ks[a], ks[b]].sort().join('|'); pairs.set(p, (pairs.get(p) || 0) + 1); } });
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return { from, list, named, top, pairs: [...pairs.entries()].sort((a, b) => b[1] - a[1]), ctx, un,
    spec: { items: top.slice(0, 3).map(([key]) => ({ key })), neutral: top.length ? 0 : 1, seed: .31 } };
}
export function monthCal(jy, jm){
  const first = keyOfJ(jy, jm, 1), lead = wdIndex(first), len = jMonthLen(jy, jm), tk = todayKey(); let c = '';
  for (let i = 0; i < lead; i++) c += '<span class="wv pad"></span>';
  for (let d = 1; d <= len; d++){ const k = keyOfJ(jy, jm, d), list = dayList(k), t = k === tk ? ' today' : '';
    if (k > tk){ c += '<span class="wv fut"></span>'; continue; }
    if (!list.length){ c += `<span class="wv${t}"></span>`; continue; }
    const sp = daySpec(k); if (!sp.items.length){ c += `<span class="wv un${t}"></span>`; continue; }
    const p1 = palFor(sp.items[0].key, sp.items[0].color), p2 = sp.items[1] ? palFor(sp.items[1].key, sp.items[1].color) : null;
    c += `<span class="wv has${t}" title="${fmtDay(k, { weekday: false, year: false })}" style="--a:${p1[0]};--b:${p2 ? p2[1] : p1[1]};--c:${p1[2]}"></span>`; }
  return `<div class="mcal"><p class="mcal-t">${J_MONTHS[jm - 1]} <span class="num">${fa(jy)}</span></p><div class="mgrid mwd" aria-hidden="true">${WD_S.map(w => `<span>${w}</span>`).join('')}</div><div class="mgrid">${c}</div></div>`;
}
export function monthsPage(){
  const n = isWide() ? 3 : 2, cur = jOfKey(todayKey()), idx = cur.jy * 12 + cur.jm - 1;
  const earliest = visible().reduce((m, e) => e.day < m ? e.day : m, todayKey()), ej = jOfKey(earliest), eIdx = ej.jy * 12 + ej.jm - 1;
  const maxOff = Math.max(0, Math.ceil((idx - eIdx + 1) / n) - 1); S.pat.mOff = clamp(S.pat.mOff, 0, maxOff);
  const months = []; for (let i = n - 1; i >= 0; i--){ const m = idx - S.pat.mOff * n - i; months.push([Math.floor(m / 12), m % 12 + 1]); }
  if (!isWide()) months.reverse();
  return { html: months.map(([y, m]) => monthCal(y, m)).join(''), n, older: S.pat.mOff < maxOff, newer: S.pat.mOff > 0 };
}
export function storiesRow(){
  const tk = todayKey(), ws = weekStart(tk), cnt = k => [...Array(7)].reduce((a, _, i) => a + dayList(keyAdd(k, i)).length, 0);
  const cands = []; if (!DB.stories.some(x => x.week === ws) && cnt(ws) >= 2) cands.push(ws); const lw = keyAdd(ws, -7); if (!DB.stories.some(x => x.week === lw) && cnt(lw) >= 2) cands.push(lw);
  const days = w => [...Array(7)].map((_, i) => keyAdd(w, i));
  const fresh = cands.map(w => `<button class="sring new" data-act="weekStory" data-w="${w}"><span class="ring big" style="--rg:${ringGrad(days(w))}"><b>+</b></span><span>${w === ws ? 'این هفته' : 'هفته‌ی پیش'}</span></button>`).join('');
  const saved = DB.stories.slice().sort((a, b) => b.week < a.week ? -1 : 1).slice(0, 12).map(st => { const j = jOfKey(st.week);
    return `<button class="sring" data-act="openStory" data-id="${st.id}"><span class="ring big" style="--rg:${ringGrad(days(st.week))}">${st.seen ? '' : '<i></i>'}</span><span>${fa(j.jd)} ${J_MONTHS[j.jm - 1]}</span></button>`; }).join('');
  if (!fresh && !saved) return '';
  return `<section class="p-sec wide"><div class="p-sec-h"><h2>داستان‌های هفته</h2></div><p class="fine">چند صفحه‌ی کوتاه درباره‌ی هفته‌ات، از روی ردپاها و یادداشت‌هایی که خودت نوشتی. داستان‌ها همین‌جا نگه داشته می‌شن.</p><div class="srow">${fresh}${saved}</div></section>`;
}
export function vPatterns(){
  const D = patternData(), R = S.pat.range, M = monthsPage();
  const seg = `<div class="seg" role="group" aria-label="بازه">${[[30,'۳۰ روز'],[90,'۹۰ روز'],[0,'همه']].map(([v, l]) => `<button data-act="range" data-r="${v}" aria-pressed="${R === v}">${l}</button>`).join('')}</div>`;
  const head = `<div class="p-head"><div class="p-head-txt"><h1 class="ed r" style="--i:0" tabindex="-1" data-autofocus>الگوها</h1>
    <p class="lede r" style="--i:1">فقط چیزهایی که خودت تأیید کردی؛ نه تحلیل روانی، نه تشخیص.</p></div>
    </div>`;
  const months = `<section class="p-sec wide"><div class="p-sec-h"><h2>ردپای روزها</h2><div class="navbtns"><button class="ib" data-act="pm" data-d="1" ${M.older ? '' : 'disabled'} aria-label="ماه‌های قبل">${IC.prev}</button><button class="ib" data-act="pm" data-d="-1" ${M.newer ? '' : 'disabled'} aria-label="ماه‌های بعد">${IC.next}</button></div></div>
    <div class="mcals" id="mcals" style="--n:${M.n}">${M.html}</div><p class="fine">دایره‌ی رنگی یعنی روزی با ردپا؛ دایره‌ی توخالی یعنی حالی بی‌نام.</p></section>`;
  if (D.named.length < 3) return head + `<div class="p-grid">${storiesRow()}${months}</div><div class="p-empty"><p>در این بازه هنوز ردپای کافی برای شمردن نیست.</p>${seg}</div>`;
  const maxF = D.top[0][1];
  const freq = D.top.slice(0, 7).map(([k, n]) => `<li style="${cvars(k)}"><span class="w">${glyph(k)}<span>${esc(labelOf(k))}</span></span><span class="filament" aria-hidden="true"><i style="--p:${Math.max(6, n / maxF * 100).toFixed(1)}%"></i></span><span class="n num">${fa(n)} بار</span></li>`).join('');
  const pairs = D.pairs.slice(0, 5).map(([p, n]) => { const [a, b] = p.split('|'); return `<li><span class="pg">${glyph(a)}${glyph(b)}</span><span class="pw">${esc(labelOf(a))} و ${esc(labelOf(b))}</span><span class="n num">${fa(n)} بار</span></li>`; }).join('');
  return head + `<div class="p-grid">${storiesRow()}${months}
    <div class="p-sec wide p-range"><h2>شمارش انتخاب‌ها</h2>${seg}</div>
    <section class="p-sec"><h2>کلمه‌هایی که بیشتر برگزیدی</h2><ul class="freq">${freq}</ul></section>
    <section class="p-sec"><h2>احساس‌هایی که کنار هم اومدن</h2>${pairs ? `<ul class="pairs">${pairs}</ul>` : '<p class="fine">هنوز ردپایی با چند کلمه در این بازه نیست.</p>'}</section>
  </div>`;
}
