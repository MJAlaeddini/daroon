import { REFINE, fa, labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { coreOf } from '../sculpture/engine';
import { S } from '../state/app';
import { EMOTIONS } from '../stone/presets';
import { IC } from '../ui/icons';
import { progressBar } from './reflect';

/* The twelve words are set like a short poem, three to a line, from the light feelings to the heavy ones. A touched word
   is breathed into the one stone above them (features/breath.ts); what is inside is named under the stone, and the
   last one named offers its finer words there. */
const VERSE: string[][] = [
  ['آرامش', 'امید', 'خوشحالی'],
  ['اشتیاق', 'صمیمیت', 'دلتنگی'],
  ['غم', 'دلخوری', 'سردرگمی'],
  ['نگرانی', 'ترس', 'خشم'],
];

type Item = { key: string; parent?: string | null; custom?: boolean };

/** The colour a word wears: the middle colour of its stone (a finer word or a word of one's own takes its core's). */
export function wordColour(key: string): string {
  const id = coreOf(key);
  return id ? EMOTIONS[id].palette.middle : '#b9a6e8';
}
/** The item a verse word stands for, if it is inside the stone (itself or one of its finer words). */
const itemOf = (k: string): Item | undefined => S.draft.items.find((x: Item) => x.key === k || x.parent === k);

export function vExplore() {
  const lines = VERSE.map(
    (line) =>
      `<div class="v-line">${line
        .map(
          (k, i) =>
            `${i ? '<i class="v-dot" aria-hidden="true"></i>' : ''}<button class="word" type="button" data-act="word" data-key="${k}" ${wordState(k)} style="--wc:${wordColour(k)}">${k}</button>`,
        )
        .join('')}</div>`,
  ).join('');
  return `<div class="flow-head"><button class="back" data-act="back">${IC.back}بازگشت</button>${S.editing ? '<span class="step">ویرایش ردپا</span>' : progressBar(0)}<span class="r-close-pad" aria-hidden="true"></span></div>
  <div class="x-grid">
    <div class="x-intro"><h1 class="ed r" style="--i:0" tabindex="-1" data-autofocus>بین احساس‌ها بگرد</h1><p class="lede r" style="--i:1">تا سه تا. هر کدوم، درونت رو یه جور شکل می‌ده.</p></div>
    <div class="x-stage">
      <div class="anchor-explore" data-anchor data-scale=".7"></div>
      <div class="x-names r" style="--i:2" id="xnames">${namesHTML()}</div>
      <div class="x-fine" id="xfine">${fineHTML()}</div>
    </div>
    <div class="x-words r" style="--i:3">
      <div class="verse" id="field" role="group" aria-label="کلمه‌های احساس">${lines}</div>
      <div class="x-own" id="tray">${trayHTML()}</div>
    </div>
    <div class="x-bar r" style="--i:4" id="xbar">${xbarHTML()}</div>
  </div>`;
}
/** aria state of a verse word: inside the stone, or out of reach because the stone is full */
export function wordState(k: string): string {
  const on = !!itemOf(k),
    full = S.draft.items.length >= 3;
  return `aria-pressed="${on}" aria-disabled="${full && !on}"`;
}
/** Under the stone: what is inside it. The one whose finer words are showing is underlined in its colour. */
export function namesHTML(): string {
  const d = S.draft;
  if (!d.items.length) return '<span class="x-none">هنوز بی‌نام</span>';
  return d.items
    .map(
      (it: Item, i: number) =>
        `${i ? '<i class="v-dot" aria-hidden="true"></i>' : ''}<button class="nm" type="button" data-act="focusSel" data-i="${i}" aria-pressed="${i === d.focus}" style="--wc:${wordColour(it.key)}">${esc(labelOf(it.key))}</button>`,
    )
    .join('');
}
/** One line under the names: the finer words of the focused feeling, or a way to take out a word of one's own. */
export function fineHTML(): string {
  const d = S.draft,
    it: Item | undefined = d.items[d.focus];
  if (!it) return '';
  if (it.custom)
    return `<span class="x-q">کلمه‌ی خودته</span><button class="rf rf-out" type="button" data-act="removeSel" data-i="${d.focus}">برداشتن</button>`;
  const par = it.parent && REFINE[it.parent] ? it.parent : null;
  if (!par) return '';
  return `<span class="x-q">دقیق‌تر بگی؟</span>${REFINE[par]
    .map(
      (r) =>
        `<button class="rf" type="button" data-act="refine" data-i="${d.focus}" data-key="${r}" aria-pressed="${it.key === r}" style="--wc:${wordColour(r)}">${r}</button>`,
    )
    .join('')}`;
}
/** Under the verse: a word of one's own. Its line keeps its height when the stone is full, so nothing jumps. */
export function trayHTML() {
  const n = S.draft.items.length;
  return `<span class="vh" role="status">${n ? `${fa(n)} از ${fa(3)} کلمه` : 'هنوز کلمه‌ای انتخاب نشده'}</span>${n < 3 ? customHTML() : ''}`;
}
export function customHTML() {
  return S.customOpen
    ? `<form class="custom" data-form="custom"><label class="vh" for="customInput">کلمه‌ی خودت</label>
      <input class="inp" id="customInput" maxlength="28" autocomplete="off" placeholder="کلمه‌ی خودت…"><button class="addbtn" type="submit">افزودن</button></form>`
    : `<div class="own"><button class="link" data-act="openCustom">با کلمه‌ی خودم بگم</button></div>`;
}
export function xbarHTML() {
  const n = S.draft.items.length;
  const side = S.editing
    ? '<button class="x-help" data-act="back">انصراف</button>'
    : `<button class="x-help" data-act="toGuide">${IC.apB}نمی‌دونم؛ کمکم کن</button>`;
  return `${side}<button class="primary" data-act="toReflect" ${n ? '' : 'disabled'}>ادامه${n ? ` <small class="num">${fa(n)} کلمه</small>` : ''}</button>`;
}
