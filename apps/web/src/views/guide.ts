import { fa, labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { Q1, Q2 } from '../domain/guide';
import { cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { glyph } from '../ui/glyph';
import { IC } from '../ui/icons';
import { emoji } from './common';
import { customHTML } from './explore';

export function vGuide() {
  return `<div class="flow-head"><button class="back" data-act="guideBack">${IC.back}بازگشت</button><span class="step" id="gstep">${guideStepLabel()}</span></div>
  <div class="g-grid"><div class="g-stage"><div class="anchor-guide" data-anchor></div></div><div class="g-body" id="gbody">${guideBody()}</div></div>`;
}
export function guideStepLabel() {
  const g = S.guide;
  return g.step === 'q1'
    ? `قدم ${fa(1)} از ${fa(2)}`
    : g.step === 'q2'
      ? `قدم ${fa(2)} از ${fa(2)}`
      : g.step === 'sug'
        ? 'شاید این‌ها'
        : 'بدون اسم';
}
export function stones(opts, act) {
  return `<ol class="stones">${opts.map((o, i) => `<li style="--i:${i}"><button class="stone" data-act="${act}" data-id="${o.id}"><span class="dot"></span><span>${o.t}</span></button></li>`).join('')}</ol>`;
}
export function guideBody() {
  const g = S.guide;
  if (g.step === 'q1') return `<h1 class="q" tabindex="-1" data-autofocus>${Q1.q}</h1>${stones(Q1.opts, 'answer')}`;
  if (g.step === 'q2') {
    const b = Q2[g.q1];
    return `<h1 class="q" tabindex="-1" data-autofocus>${b.q}</h1>${g.q1 === 'body' ? '<p class="q-sub">فقط توصیف بدن؛ قرار نیست از روی اون چیزی درباره‌ی حالت نتیجه بگیریم.</p>' : ''}${stones(b.opts, 'answer')}`;
  }
  if (g.step === 'sug') {
    const o = Q2[g.q1].opts.find((x) => x.id === g.q2),
      body = g.q1 === 'body',
      picks = S.draft.items.map((i) => i.key);
    const sugs = o.sug
      .map((k, i) => {
        const on = picks.includes(k);
        return `<button class="sug" data-act="pickSug" data-key="${k}" aria-pressed="${on}" style="--i:${i};${cvars(k)}">${glyph(k)}<span>${k}</span>${emoji(k)}<span class="st">${on ? 'انتخاب شد' : 'پیشنهاد'}</span></button>`;
      })
      .join('');
    const n = S.draft.items.length;
    return `<h1 class="q" tabindex="-1" data-autofocus>${body ? 'این توصیف جسمی، خودش کافیه.' : 'شاید یکی از این کلمه‌ها نزدیک باشه'}</h1>
      <p class="q-sub">${body ? 'اگه خواستی، چند کلمه هم هست که شاید کنارش بشینه؛ هیچ‌کدوم لازم نیست.' : 'این‌ها فقط پیشنهادن، نه نتیجه. هر کدوم درست به نظر می‌رسه انتخاب کن؛ یا هیچ‌کدوم.'}</p>
      <div class="sugs" role="group" aria-label="کلمه‌های پیشنهادی">${sugs}</div>
      ${S.customOpen && n < 3 ? customHTML() : ''}
      ${
        S.draft.items.filter((i) => !o.sug.includes(i.key)).length
          ? `<p class="fine">کلمه‌های دیگه‌ات: ${S.draft.items
              .filter((i) => !o.sug.includes(i.key))
              .map((i) => esc(labelOf(i.key)))
              .join('، ')}</p>`
          : ''
      }
      <div class="alt"><button class="link" data-act="noneFit">هیچ‌کدوم نیست</button>${!S.customOpen && n < 3 ? '<button class="link" data-act="openCustom">با کلمه‌ی خودم بگم</button>' : ''}<button class="link" data-act="toExplore">همه‌ی کلمه‌ها</button></div>
      <div class="acts"><button class="primary" data-act="toReflect" ${n || body ? '' : 'disabled'}>${!n && body ? 'همین حس جسمی رو ثبت کن' : 'ادامه'}</button><button class="quiet" data-act="exitFlow">بدون ثبت بیرون برو</button></div>`;
  }
  return `<h1 class="q" tabindex="-1" data-autofocus>اشکالی نداره که هنوز اسمی نداره.</h1>
    <p class="q-sub">یه حال بی‌نام هم ارزش ثبت شدن داره. هر وقت خواستی، می‌شه دوباره سراغش اومد.</p>
    <ol class="stones"><li style="--i:0"><button class="stone em" data-act="saveUnnamed"><span class="dot"></span><span>همین حال بی‌نام رو ثبت کنم</span></button></li>
      <li style="--i:1"><button class="stone" data-act="writeUnnamed"><span class="dot"></span><span>یه جمله درباره‌اش بنویسم</span></button></li>
      <li style="--i:2"><button class="stone" data-act="toExplore"><span class="dot"></span><span>بین همه‌ی کلمه‌ها بگردم</span></button></li></ol>
    <div class="acts"><button class="quiet" data-act="exitFlow">الان نه؛ بیرون برو</button></div>`;
}
