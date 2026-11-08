import { CORE_KEYS, REFINE, fa, labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { LEX, cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { glyph } from '../ui/glyph';
import { IC } from '../ui/icons';
import { progressBar } from './reflect';

export function vExplore() {
  const d = S.draft;
  const words = CORE_KEYS.map((k, i) => {
    const it = d.items.find((x) => x.key === k || x.parent === k),
      on = !!it;
    return `<button class="word" type="button" data-act="word" data-key="${k}" data-angle="${LEX[k].angle}" aria-pressed="${on}" style="--i:${i};${cvars(k, it?.color)}">${glyph(k, it?.color)}<span>${k}</span>${it && it.key !== k ? `<span class="rfn">${esc(labelOf(it.key))}</span>` : ''}</button>`;
  }).join('');
  return `<div class="flow-head"><button class="back" data-act="back">${IC.back}بازگشت</button>${S.editing ? '<span class="step">ویرایش ردپا</span>' : progressBar(0)}<span class="r-close-pad" aria-hidden="true"></span></div>
  <div class="x-grid">
    <div class="x-intro"><h1 class="ed r" style="--i:0" tabindex="-1" data-autofocus>بین احساس‌ها بگرد</h1><p class="lede r" style="--i:1">تا سه تا. هر کدوم، درونت رو یه جور شکل می‌ده.</p></div>
    <div class="field ${d.items.length >= 3 ? 'full' : ''}" id="field" role="group" aria-label="کلمه‌های احساس">
      <div class="anchor-field" data-anchor></div>${words}
    </div>
    <aside class="tray" id="tray" aria-label="انتخاب‌های تو">${trayHTML()}</aside>
    <div class="actionbar" id="xbar">${xbarHTML()}</div>
  </div>`;
}
/**
 * Under the ring: no list repeating the chosen words (the ring and the sculpture already show them). Only what the
 * ring can't: finer words for the one just chosen, and words of one's own, which have no place on the ring.
 */
export function trayHTML() {
  const d = S.draft,
    n = d.items.length;
  const it = d.items[d.focus],
    par = it && it.parent && REFINE[it.parent] ? it.parent : null;
  const refine = par
    ? `<div class="refine"><p class="refine-q">«${par}» رو دقیق‌تر بگی؟</p><div class="refine-opts">
        ${REFINE[par].map((r) => `<button class="rf" data-act="refine" data-i="${d.focus}" data-key="${r}" aria-pressed="${it.key === r}" style="${cvars(r)}">${glyph(r)}${r}</button>`).join('')}</div></div>`
    : '';
  const own = d.items
    .map((x, i) => [x, i] as const)
    .filter(([x]) => x.custom)
    .map(
      ([x, i]) =>
        `<li class="sel" style="${cvars(x.key, x.color)}"><span class="sel-chip">${glyph(x.key, x.color)}<span>${esc(labelOf(x.key))}</span></span><button class="x" data-act="removeSel" data-i="${i}" aria-label="برداشتن ${esc(labelOf(x.key))}">${IC.close}</button></li>`,
    )
    .join('');
  return `<span class="vh" role="status">${n ? `${fa(n)} از ${fa(3)} کلمه` : 'هنوز کلمه‌ای انتخاب نشده'}</span>
    ${own ? `<ul class="sel-list">${own}</ul>` : ''}${refine}
    ${n < 3 ? customHTML() : ''}`;
}
export function customHTML() {
  return S.customOpen
    ? `<form class="custom" data-form="custom"><label class="vh" for="customInput">کلمه‌ی خودت</label>
      <input class="inp" id="customInput" maxlength="28" autocomplete="off" placeholder="کلمه‌ی خودت…"><button class="addbtn" type="submit">افزودن</button></form>`
    : `<div class="own"><button class="link" data-act="openCustom">با کلمه‌ی خودم بگم</button></div>`;
}
export function xbarHTML() {
  const n = S.draft.items.length;
  return `<div class="ab-in"><button class="quiet" data-act="${S.editing ? 'back' : 'toGuide'}">${S.editing ? 'انصراف' : 'نمی‌دونم؛ کمکم کن'}</button>
    <button class="primary" data-act="toReflect" ${n ? '' : 'disabled'}>ادامه${n ? ` <small class="num">${fa(n)} کلمه</small>` : ''}</button></div>`;
}
