import { REFINE, SCENES, SCENE_IDS, fa, fmtDay, labelOf, pad, todayKey } from '@daroon/shared';
import { esc } from '../core/util';
import { SWATCHES, cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { DB } from '../state/store';
import { IC } from '../ui/icons';

export function vReflect() {
  const d = S.draft,
    items = d.items,
    ed = S.editing ? DB.entries.find((e) => e.id === S.editing) : null;
  const now = new Date(),
    when = ed
      ? `${fmtDay(ed.day)} · ${fa(ed.time)}`
      : `${fmtDay(todayKey())} · ${fa(pad(now.getHours()) + ':' + pad(now.getMinutes()))}`;
  /* the words are said once, large; each one is also the button for its personal colour */
  const title = items.length
    ? items
        .map(
          (it, i) =>
            `${i ? (i === items.length - 1 ? '<span class="amp"> و </span>' : '<span class="amp">، </span>') : ''}<button class="hw" data-act="palette" data-i="${i}" aria-expanded="${d.palette === i}" aria-label="رنگ شخصی برای ${esc(labelOf(it.key))}" title="رنگ شخصی" style="${cvars(it.key, it.color)}">${esc(labelOf(it.key))}</button>`,
        )
        .join('')
    : d.context && d.context.kind === 'body'
      ? 'حسی در بدن'
      : 'حالی بی‌نام';
  const from = items.filter((it) => it.parent && it.parent !== it.key && REFINE[it.parent]);
  const sub = items.length
    ? from.map((it) => `«${esc(labelOf(it.key))}» از خانواده‌ی «${it.parent}»`).join('، ')
    : 'اسمی براش انتخاب نکردی؛ این هم یه جوابه.';
  return `<div class="flow-head"><button class="back" data-act="back">${IC.back}بازگشت</button><span class="step">${ed ? 'ویرایش ردپا' : 'پیش از ثبت'}</span></div>
  <div class="r-grid">
    <div class="r-stage"><div class="anchor-reflect" data-anchor></div></div>
    <div class="r-body">
      <p class="eyebrow r" style="--i:0">${ed && ed.demo ? 'ردپای نمونه · ' : ''}${when}</p>
      <h1 class="r-title r" style="--i:1" tabindex="-1" data-autofocus>${title}</h1>
      <div class="r-sub r" style="--i:1">${sub ? `<span>${sub}</span>` : ''}<button class="link" data-act="changeWords">${items.length ? 'تغییر کلمه‌ها' : 'افزودن کلمه'}</button></div>
      ${d.palette >= 0 && items[d.palette] ? paletteHTML(d.palette) : ''}
      <dl class="record r" style="--i:2">
        ${d.context ? `<div class="rec"><dt>${d.context.name}</dt><dd>${esc(d.context.value)} <small>· از جواب‌های خودت</small></dd></div>` : ''}
        ${scenesHTML()}
      </dl>
      <div class="note r" style="--i:3"><label class="vh" for="noteInput">یادداشت</label>
        <textarea id="noteInput" rows="4" placeholder="اگر دوست داری، چند خط بنویس…">${esc(d.note)}</textarea>
        <span class="private">${IC.lock}فقط روی همین دستگاه می‌مونه.</span></div>
      <div class="acts r" style="--i:4"><button class="primary" data-act="save">${ed ? 'ذخیره‌ی تغییرات' : 'ثبت در ردپای من'}</button>
        <button class="quiet" data-act="${ed ? 'back' : 'discard'}">${ed ? 'انصراف' : S.discardArm ? 'یادداشت پاک می‌شه؛ مطمئنی؟' : 'بیرون رفتن بدون ثبت'}</button></div>
    </div>
  </div>`;
}
export function scenesHTML() {
  const on = S.draft.scenes;
  return `<div class="rec scn"><dt id="scnH">کجا بودی، با کی؟ <small>اگه خواستی</small></dt><dd role="group" aria-labelledby="scnH">${SCENE_IDS.map(
    (s) => `<button class="chip" data-act="scene" data-s="${s}" aria-pressed="${on.includes(s)}">${SCENES[s]}</button>`,
  ).join('')}</dd></div>`;
}
export function paletteHTML(i) {
  const it = S.draft.items[i];
  return `<div class="palette"><p class="fine">رنگی که برای «${esc(labelOf(it.key))}» حس می‌کنی؛ یه تداعی شخصی، نه قاعده‌ی علمی.</p><div class="palette-row">
    <button class="pal def" data-act="setColor" data-i="${i}" data-c="" aria-pressed="${!it.color}">رنگ پیشنهادی</button>
    ${Object.entries(SWATCHES)
      .map(
        ([id, s]) =>
          `<button class="pal" data-act="setColor" data-i="${i}" data-c="${id}" aria-pressed="${it.color === id}" aria-label="${s.n}" style="--c0:${s.pal[0]};--c1:${s.pal[1]};--c2:${s.pal[2]}"><i></i></button>`,
      )
      .join('')}</div></div>`;
}
