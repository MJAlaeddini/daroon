import {
  ANSWER_LABEL,
  INTENSITY_LABEL,
  MEANING,
  SCENES,
  SCENE_AT,
  SCENE_IDS,
  fa,
  labelOf,
  pickQuestion,
  type Intensity,
  type MeaningQ,
} from '@daroon/shared';
import { esc } from '../core/util';
import { cvars } from '../domain/lexicon';
import { S } from '../state/app';
import { DB } from '../state/store';
import { IC } from '../ui/icons';

/* ═════════════════════════ the check-in, step by step ═════════════════════════
   After the words (step 1, views/explore.ts or the guide), one thing per screen: how strong it was, where and with
   whom, one small question about what was going on, a line of one's own. The stone stays with every step. Every
   step after the first can save right there («ثبت همین‌جا»); nothing but the words is required. */
export const STEPS = ['strength', 'where', 'ask', 'note'] as const;
export type Step = (typeof STEPS)[number];
export const stepOf = (): Step => STEPS[Math.max(0, Math.min(STEPS.length - 1, S.draft.step || 0))];

/** The question this check-in asks: kept if it was already answered (editing), else chosen by the settings. */
export function askQ(): MeaningQ {
  const d = S.draft;
  if (d.meaning) return d.meaning.q;
  return pickQuestion(d.scenes, DB.entries.filter((e) => e.meaning && !e.deletedAt).length);
}

/** Five short bars: the words, then the four steps here (`i` is the current one, 0 = the words). */
export function progressBar(i: number): string {
  return `<span class="r-prog" role="img" aria-label="مرحله‌ی ${fa(i + 1)} از ${fa(5)}">${[0, 1, 2, 3, 4]
    .map((k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`)
    .join('')}</span>`;
}
const progress = () => progressBar(1 + (S.draft.step || 0));

/** The chosen words (and, after the first step, the strength) as small capsules: what this check-in is so far. */
function capsules(withStrength: boolean): string {
  const d = S.draft;
  const words = d.items.length
    ? d.items
        .map((it) => `<span class="r-cap" style="${cvars(it.key, it.color)}">${esc(labelOf(it.key))}</span>`)
        .join('')
    : `<span class="r-cap plain">${d.context && d.context.kind === 'body' ? 'حسی در بدن' : 'حالی بی‌نام'}</span>`;
  const strength = withStrength
    ? `<span class="r-cap plain">${INTENSITY_LABEL[d.intensity as Intensity] || INTENSITY_LABEL[2]}</span>`
    : '';
  return `<div class="r-caps">${words}${strength}</div>`;
}

function saveHere(): string {
  return `<button class="quiet" data-act="save">${S.editing ? 'ذخیره همین‌جا' : 'ثبت همین‌جا'}</button>`;
}

function stepBody(step: Step): string {
  const d = S.draft;
  if (step === 'strength')
    return `${capsules(false)}
      ${d.context ? `<p class="r-ctx">${esc(d.context.name)}: ${esc(d.context.value)} · از جواب‌های خودت</p>` : ''}
      <h1 class="r-q" tabindex="-1" data-autofocus>چقدر پررنگ بود؟</h1>
      <p class="r-hint">انگشتت رو روی شکل نگه دار؛ هرچی بیشتر، پررنگ‌تر</p>
      <div class="seg r-seg" role="radiogroup" aria-label="پررنگی">${([1, 2, 3] as Intensity[])
        .map(
          (n) =>
            `<button role="radio" data-act="rIntensity" data-n="${n}" aria-checked="${d.intensity === n}" aria-pressed="${d.intensity === n}">${INTENSITY_LABEL[n]}</button>`,
        )
        .join('')}</div>
      <div class="acts r-acts">${saveHere()}<button class="primary" data-act="rNext">بعدی</button></div>`;
  if (step === 'where')
    return `${capsules(true)}
      <h1 class="r-q" tabindex="-1" data-autofocus>کجا بودی، با کی؟</h1>
      <p class="r-hint">تا دو تا. اگه نمی‌خوای، رد شو.</p>
      <div class="r-chips" role="group" aria-label="کجا بودی، با کی">${SCENE_IDS.map(
        (s) =>
          `<button class="chip" data-act="scene" data-s="${s}" aria-pressed="${d.scenes.includes(s)}">${SCENES[s]}</button>`,
      ).join('')}</div>
      <div class="acts r-acts">${saveHere()}<button class="primary" data-act="rNext">بعدی</button></div>`;
  if (step === 'ask') {
    const q = askQ(),
      lead = d.scenes.length && q === 'heard' ? `${SCENE_AT[d.scenes[0]]}، ` : '';
    return `<p class="r-tag">یه سؤال کوچیک</p>
      <h1 class="r-q big" tabindex="-1" data-autofocus>${lead}${MEANING[q].ask}</h1>
      <div class="r-answers" role="radiogroup" aria-label="جواب">${(['yes', 'some', 'no'] as const)
        .map(
          (a) =>
            `<button role="radio" data-act="rAnswer" data-q="${q}" data-a="${a}" aria-checked="${d.meaning?.a === a}">${ANSWER_LABEL[a]}</button>`,
        )
        .join('')}</div>
      <p class="r-fine">هر بار فقط یه سؤال؛ کم‌کم تصویر کامل‌تر می‌شه.</p>
      <div class="acts r-acts">${saveHere()}<button class="quiet" data-act="rSkip">نمی‌خوام بگم</button></div>`;
  }
  return `<h1 class="r-q" tabindex="-1" data-autofocus>یه خط بنویسی؟</h1>
    <span class="private">${IC.lock}فقط روی همین گوشی می‌مونه.</span>
    <div class="note"><label class="vh" for="noteInput">یادداشت</label>
      <textarea id="noteInput" rows="4" placeholder="امروز…">${esc(d.note)}</textarea></div>
    <div class="acts r-acts"><button class="quiet" data-act="save">نه، همین بسه</button><button class="primary" data-act="save">${S.editing ? 'ذخیره‌ی تغییرات' : 'ثبت در ردپای من'}</button></div>`;
}

export function vReflect() {
  const step = stepOf();
  return `<div class="flow-head r-head"><button class="back" data-act="rBack">${IC.back}${S.draft.step ? 'قبلی' : 'کلمه‌ها'}</button>${progress()}<button class="link r-close" data-act="${S.editing ? 'back' : 'discard'}">${S.editing ? 'انصراف' : S.discardArm ? 'پاک بشه؟' : 'بستن'}</button></div>
  <div class="r-grid" data-step="${step}">
    <div class="r-stage"><div class="anchor-reflect" data-anchor data-press="strength"></div></div>
    <div class="r-body" id="rbody">${stepBody(step)}</div>
  </div>`;
}
/** The body of the current step, for swapping in place (the header and the stone stay). */
export function reflectBody(): string {
  return stepBody(stepOf());
}
export function reflectProgress(): string {
  return progress();
}
