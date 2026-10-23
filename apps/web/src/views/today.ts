import { WD_S, fa, fmtDay, jOfKey, keyAdd, todayKey, weekStart } from '@daroon/shared';
import { esc } from '../core/util';
import { daySpec } from '../domain/specs';
import { traceImg } from '../sculpture/traces';
import { DB, dayList } from '../state/store';
import { IC } from '../ui/icons';

export function vToday() {
  const tk = todayKey(),
    ws = weekStart(tk),
    cnt = dayList(tk).length;
  const days = [...Array(7)]
    .map((_, i) => {
      const k = keyAdd(ws, i),
        j = jOfKey(k),
        list = dayList(k);
      return `<button class="wk-day ${k === tk ? 'is-today' : ''} ${k > tk ? 'is-future' : ''}" data-day="${k}" aria-label="${fmtDay(k)}، ${list.length ? fa(list.length) + ' ردپا' : 'بدون ردپا'}">
      <span class="wk-wd">${WD_S[i]}</span><span class="wk-dn num">${fa(j.jd)}</span>
      <span class="wk-tr">${list.length ? traceImg(daySpec(k)) : '<span class="wk-empty"></span>'}</span></button>`;
    })
    .join('');
  return `<div class="t-grid">
    <div class="t-copy">
      <p class="eyebrow r" style="--i:0">${fmtDay(tk)}${DB.account ? ` · سلام ${esc(DB.account.name)}` : ''}</p>
      <h1 class="hero r" style="--i:1" tabindex="-1" data-autofocus>امروز درونت چه می‌گذره؟</h1>
      <p class="lede r" style="--i:2">لازم نیست اسم احساست رو بدونی.</p>
    </div>
    <div class="t-stage r" style="--i:2">
      <div class="anchor-home" data-anchor data-scale=".6"></div>
    </div>
    <div class="t-paths">
      <div class="paths r" style="--i:3" role="group" aria-label="دو راه برای شروع">
        <button class="path" data-act="startA" data-hint="A"><span class="aperture">${IC.apA}</span><span class="path-title">می‌خوام بین احساس‌ها بگردم</span><span class="path-hint">دوازده کلمه، و کلمه‌های نزدیک‌تر به هرکدوم</span></button>
        <button class="path" data-act="startB" data-hint="B"><span class="aperture">${IC.apB}</span><span class="path-title">واقعاً نمی‌دونم چه حسی دارم</span><span class="path-hint">دو سؤال کوتاه؛ جواب درست یا غلط نداره</span></button>
      </div>
    </div>
    <section class="week r" style="--i:4" aria-label="ردپاهای این هفته">
      <div class="week-head"><h2 class="sec">این هفته${cnt ? ` · <span style="font-weight:400;color:var(--ink-3)">امروز ${fa(cnt)} ردپا</span>` : ''}</h2><button class="link" data-go="archive">همه‌ی ردپاها</button></div>
      <div class="wk">${days}</div>
    </section>
  </div>`;
}
