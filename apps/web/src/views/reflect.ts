import { REFINE, fa, fmtDay, labelOf, pad, todayKey } from '@daroon/shared';
import { esc } from '../core/util';
import { SWATCHES, cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { DB } from '../state/store';
import { glyph } from '../ui/glyph';
import { IC } from '../ui/icons';

export function vReflect(){
  const d = S.draft, items = d.items, ed = S.editing ? DB.entries.find(e => e.id === S.editing) : null;
  const now = new Date(), when = ed ? `${fmtDay(ed.day)} · ${fa(ed.time)}` : `${fmtDay(todayKey())} · ${fa(pad(now.getHours()) + ':' + pad(now.getMinutes()))}`;
  const title = items.length ? items.map((it, i) => `${i ? (i === items.length - 1 ? '<span class="amp"> و </span>' : '<span class="amp">، </span>') : ''}<span class="hw" style="${cvars(it.key, it.color)}">${esc(labelOf(it.key))}</span>`).join('')
    : (d.context && d.context.kind === 'body' ? 'حسی در بدن' : 'حالی بی‌نام');
  const recWords = items.map((it, i) => `<span class="rw" style="${cvars(it.key, it.color)}"><button class="swb" data-act="palette" data-i="${i}" aria-label="رنگ شخصی برای ${esc(labelOf(it.key))}" aria-expanded="${d.palette === i}" title="رنگ شخصی">${glyph(it.key, it.color)}</button><span>${esc(labelOf(it.key))}</span>${it.parent && it.parent !== it.key && REFINE[it.parent] ? `<small>از «${it.parent}»</small>` : ''}
</span>
      ${d.palette === i ? paletteHTML(i) : ''}`).join('');
  const unchosen = (d.suggested || []).filter(k => !items.some(i => i.key === k));
  return `<div class="flow-head"><button class="back" data-act="back">${IC.back}بازگشت</button><span class="step">${ed ? 'ویرایش ردپا' : 'پیش از ثبت'}</span></div>
  <div class="r-grid">
    <div class="r-stage"><div class="anchor-reflect" data-anchor></div></div>
    <div class="r-body">
      <p class="eyebrow r" style="--i:0">${ed && ed.demo ? 'ردپای نمونه · ' : ''}${when}</p>
      <h1 class="r-title r" style="--i:1" tabindex="-1" data-autofocus>${title}</h1>
      <dl class="record r" style="--i:2">
        ${items.length ? `<div class="rec"><dt>احساس‌هایی که خودت انتخاب کردی</dt><dd>${recWords}</dd></div>`
          : `<div class="rec"><dt>حال بی‌نام</dt><dd>اسمی براش انتخاب نکردی؛ این هم یه جوابه.</dd></div>`}
        ${d.context ? `<div class="rec"><dt>${d.context.name}</dt><dd>${esc(d.context.value)} <small>· از جواب‌های خودت</small></dd></div>` : ''}
        <div class="rec" style="border-top:0;padding-top:0"><dd><button class="link" data-act="changeWords">${items.length ? 'تغییر کلمه‌ها' : 'افزودن کلمه'}</button></dd></div>
        ${unchosen.length ? `<p class="fine">پیشنهادهایی که انتخاب نکردی و ثبت نمی‌شن: ${unchosen.map(esc).join('، ')}</p>` : ''}
      </dl>
      <div class="note r" style="--i:3"><label class="vh" for="noteInput">یادداشت</label>
        <textarea id="noteInput" rows="4" placeholder="اگر دوست داری، چند خط بنویس…">${esc(d.note)}</textarea>
        <span class="private">${IC.lock}فقط روی همین دستگاه می‌مونه.</span></div>
      <div class="acts r" style="--i:4"><button class="primary" data-act="save">${ed ? 'ذخیره‌ی تغییرات' : 'ثبت در ردپای من'}</button>
        <button class="quiet" data-act="${ed ? 'back' : 'discard'}">${ed ? 'انصراف' : (S.discardArm ? 'یادداشت پاک می‌شه؛ مطمئنی؟' : 'بیرون رفتن بدون ثبت')}</button></div>
    </div>
  </div>`;
}
export function paletteHTML(i){ const it = S.draft.items[i];
  return `<div class="palette"><p class="fine">رنگی که برای «${esc(labelOf(it.key))}» حس می‌کنی؛ یه تداعی شخصی، نه قاعده‌ی علمی.</p><div class="palette-row">
    <button class="pal def" data-act="setColor" data-i="${i}" data-c="" aria-pressed="${!it.color}">رنگ پیشنهادی</button>
    ${Object.entries(SWATCHES).map(([id, s]) => `<button class="pal" data-act="setColor" data-i="${i}" data-c="${id}" aria-pressed="${it.color === id}" aria-label="${s.n}" style="--c0:${s.pal[0]};--c1:${s.pal[1]};--c2:${s.pal[2]}"><i></i></button>`).join('')}</div></div>`; }
