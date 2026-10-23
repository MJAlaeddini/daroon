import { CORE_KEYS, REFINE, fa, labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { LEX, cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { glyph } from '../ui/glyph';
import { IC } from '../ui/icons';
import { emoji } from './common';

export function vExplore(){
  const d = S.draft;
  const words = CORE_KEYS.map((k, i) => {
    const it = d.items.find(x => x.key === k || x.parent === k), on = !!it;
    return `<button class="word" type="button" data-act="word" data-key="${k}" data-angle="${LEX[k].angle}" aria-pressed="${on}" style="--i:${i};${cvars(k, it?.color)}">${glyph(k, it?.color)}<span>${k}</span>${emoji(k)}${it && it.key !== k ? `<span class="rfn">${esc(labelOf(it.key))}</span>` : ''}</button>`;
  }).join('');
  return `<div class="flow-head"><button class="back" data-act="back">${IC.back}بازگشت</button><span class="step">${S.editing ? 'ویرایش ردپا' : 'راه اول: کلمه‌ها'}</span></div>
  <div class="x-grid">
    <div class="x-intro"><h1 class="ed r" style="--i:0" tabindex="-1" data-autofocus>بین احساس‌ها بگرد</h1><p class="lede r" style="--i:1">یک تا سه کلمه انتخاب کن. هر کلمه، شکل درون رو کمی تغییر می‌ده.</p></div>
    <div class="field ${d.items.length >= 3 ? 'full' : ''}" id="field" role="group" aria-label="کلمه‌های احساس">
      <div class="anchor-field" data-anchor></div>${words}
    </div>
    <aside class="tray" id="tray" aria-label="انتخاب‌های تو">${trayHTML()}</aside>
    <div class="actionbar" id="xbar">${xbarHTML()}</div>
  </div>`;
}
export function trayHTML(){
  const d = S.draft, n = d.items.length;
  const list = d.items.map((it, i) => {
    const par = it.parent && REFINE[it.parent] ? it.parent : null, focus = d.focus === i;
    return `<li class="sel">
      <button class="sel-chip" data-act="focusSel" data-i="${i}" aria-expanded="${par ? focus : 'false'}" style="${cvars(it.key, it.color)}">${glyph(it.key, it.color)}<span>${esc(labelOf(it.key))}</span>${emoji(it.key)}${par && it.key !== par ? `<small>از «${par}»</small>` : ''}</button>
      <button class="x" data-act="removeSel" data-i="${i}" aria-label="برداشتن ${esc(labelOf(it.key))}">${IC.close}</button>
      ${par && focus ? `<div class="refine"><p class="refine-q">دقیق‌ترش کنی؟ این‌ها کلمه‌های نزدیک‌ان، نه معادل.</p><div class="refine-opts">
        ${REFINE[par].map(r => `<button class="rf" data-act="refine" data-i="${i}" data-key="${r}" aria-pressed="${it.key === r}" style="${cvars(r)}">${glyph(r)}${r}</button>`).join('')}
        <button class="rf keep" data-act="refine" data-i="${i}" data-key="${par}" aria-pressed="${it.key === par}">همین «${par}» خوبه</button></div></div>` : ''}
    </li>`; }).join('');
  return `${n ? `<div class="tray-head"><h2 class="sec">انتخاب‌های تو</h2><span class="count num" role="status">${fa(n)} از ${fa(3)}</span></div><ul class="sel-list">${list}</ul>` : '<span class="vh" role="status">هنوز کلمه‌ای انتخاب نشده</span>'}
    ${n < 3 ? customHTML() : ''}`;
}
export function customHTML(){ return S.customOpen ? `<form class="custom" data-form="custom"><label class="vh" for="customInput">کلمه‌ی خودت</label>
      <input class="inp" id="customInput" maxlength="28" autocomplete="off" placeholder="کلمه‌ی خودت…"><button class="addbtn" type="submit">افزودن</button></form>`
    : `<div><button class="link" data-act="openCustom">با کلمه‌ی خودم بگم</button></div>`; }
export function xbarHTML(){ const n = S.draft.items.length;
  return `<div class="ab-in"><button class="quiet" data-act="${S.editing ? 'back' : 'toGuide'}">${S.editing ? 'انصراف' : 'نمی‌دونم؛ کمکم کن'}</button>
    <button class="primary" data-act="toReflect" ${n ? '' : 'disabled'}>همینه${n ? ` <small class="num">${fa(n)} کلمه</small>` : ''}</button></div>`; }
