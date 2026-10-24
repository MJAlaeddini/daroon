import { WD_S, fa, fmtDay, jOfKey, keyAdd, labelOf, todayKey, weekStart } from '@daroon/shared';
import { $, esc, lerp } from '../core/util';
import { daySpec } from '../domain/specs';
import { habit, reduced } from '../sculpture/engine';
import { BLANK, TR, renderTraceNow, traceImg, traceKey } from '../sculpture/traces';
import { grow, stageEl } from '../stage/stage';
import { S } from '../state/app';
import { dayList } from '../state/store';

/* completion scene: the sculpture settles in the middle, then a small seed of it flies into today's empty place
   in the week and becomes its mark there */
/** How much larger the snapshot is than the mark it becomes (the snapshot has more air around the shape). */
const FILL = 1.25;
export function showDone(entry, shot: string | null, from?) {
  const tk = todayKey(),
    ws = weekStart(tk),
    spec = daySpec(tk),
    key = traceKey(spec);
  if (!TR.has(key)) {
    try {
      TR.set(key, renderTraceNow(spec));
    } catch (e) {}
  }
  const cells = [...Array(7)]
    .map((_, i) => {
      const k = keyAdd(ws, i),
        j = jOfKey(k),
        list = dayList(k),
        isT = k === tk;
      return `<div class="dn-day ${isT ? 'is-today' : ''} ${k > tk ? 'is-future' : ''}"><span class="wk-wd">${WD_S[i]}</span><span class="wk-dn num">${fa(j.jd)}</span>
      <span class="wk-tr" ${isT ? 'id="doneSlot"' : ''}>${isT ? `<span class="wk-empty"></span><img class="tr" alt="" data-hold src="${TR.get(key) || BLANK}" style="opacity:0">` : list.length ? traceImg(daySpec(k)) : '<span class="wk-empty"></span>'}</span></div>`;
    })
    .join('');
  const words = entry.emotions.length ? entry.emotions.map((x) => esc(labelOf(x.key))).join('، ') : 'حالی بی‌نام';
  const el = document.createElement('div');
  el.className = 'done';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'ردپا ثبت شد');
  el.innerHTML = `<div class="done-in"><div class="done-art" id="doneArt"></div><p class="done-k">ثبت شد</p><h2 class="done-t" tabindex="-1">${words}</h2>
    <p class="done-m">${fmtDay(entry.day)} · <span class="num">${fa(entry.time)}</span></p>
    <div class="done-week" aria-label="این هفته">${cells}</div>
    <div class="done-acts"><button class="primary" data-act="doneClose">تمام</button><button class="quiet" data-act="doneArchive">دیدنش در ردپای من</button></div></div>`;
  document.body.appendChild(el);
  S.done = el;
  stageEl.style.visibility = 'hidden';
  requestAnimationFrame(() => el.querySelector<HTMLElement>('.done-t').focus({ preventScroll: true }));
  const art = $('#doneArt', el),
    slot = $('#doneSlot', el),
    slotImg = slot && slot.querySelector('img'),
    slotDot = slot && slot.querySelector('.wk-empty');
  const fill = () => {
    slotDot?.remove();
    if (slotImg) slotImg.style.opacity = '';
  };
  const ar = grow(art.getBoundingClientRect());
  const big = new Image();
  big.className = 'flyer';
  big.alt = '';
  big.src = shot || slotImg?.src || BLANK;
  big.style.width = ar.width + 'px';
  big.style.height = ar.height + 'px';
  el.appendChild(big);
  const place = (img, r, w) => `translate(${r.left}px,${r.top}px) scale(${r.width / w})`;
  if (reduced() || !from || !shot) {
    big.style.transform = place(big, ar, ar.width);
    fill();
    return;
  }
  const k = habit() ? 1 - 0.2 * habit() : 1;
  big.animate(
    [
      { transform: `translate(${from.x}px,${from.y}px) scale(${from.w / ar.width})` },
      { transform: place(big, ar, ar.width) },
    ],
    { duration: 820 * k, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  );
  setTimeout(() => {
    if (!slot || !el.isConnected) return;
    // land exactly where today's mark will show, at its size, so the hand-over is invisible
    const sr = (slotImg || slot).getBoundingClientRect(),
      sz = sr.width * FILL,
      tr = { left: sr.left + sr.width / 2 - sz / 2, top: sr.top + sr.height / 2 - sz / 2, width: sz };
    const seed = new Image();
    seed.className = 'flyer';
    seed.alt = '';
    seed.src = big.src;
    seed.style.width = ar.width + 'px';
    seed.style.height = ar.height + 'px';
    el.appendChild(seed);
    big.animate(
      [
        { transform: place(big, ar, ar.width) + ' scale(1)' },
        { transform: place(big, ar, ar.width) + ' scale(.94)', offset: 0.35 },
        { transform: place(big, ar, ar.width) + ' scale(1)' },
      ],
      { duration: 900, easing: 'ease-in-out' },
    );
    // the empty-day dot gives way just before the seed covers it
    slotDot?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 500 * k, fill: 'forwards' });
    const mid = { left: lerp(ar.left, tr.left, 0.5), top: lerp(ar.top, tr.top, 0.45), width: lerp(ar.width, sz, 0.55) };
    seed.animate(
      [
        { transform: place(seed, ar, ar.width), opacity: 0.0 },
        { transform: place(seed, ar, ar.width), opacity: 0.9, offset: 0.12 },
        { transform: place(seed, mid, ar.width), opacity: 1, offset: 0.55 },
        { transform: place(seed, tr, ar.width), opacity: 1 },
      ],
      { duration: 900 * k, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' },
    ).onfinish = () => {
      if (slotImg) slotImg.style.transition = 'opacity .22s';
      fill();
      seed.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () =>
        seed.remove();
    };
  }, 1250 * k);
}
export function closeDone(then?: () => void) {
  const el = S.done;
  if (!el) return;
  S.done = null;
  stageEl.style.visibility = '';
  const fin = () => {
    el.remove();
    then && then();
  };
  if (reduced()) fin();
  else {
    el.classList.add('out');
    setTimeout(fin, 320);
  }
}
