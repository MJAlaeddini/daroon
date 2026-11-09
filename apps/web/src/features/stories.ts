import { fa, labelOf, localStory, weekDays, weekRange } from '@daroon/shared';
import { api } from '../net/api';
import { isSignedIn } from './sync';
import { hexToLab, labToHex } from '../core/color';
import { clamp, esc, hashStr, uid } from '../core/util';
import { NEUTRAL_PAL, palFor } from '../domain/lexicon';
import { aggregate } from '../domain/specs';
import { reduced } from '../sculpture/engine';
import { BLANK, TR, renderTraceNow, traceKey } from '../sculpture/traces';
import { stageEl } from '../stage/stage';
import { S } from '../state/app';
import { DB, dayList, persist } from '../state/store';
import { IC } from '../ui/icons';
import { renderView } from '../ui/render';
import { toast } from '../ui/toast';

/* ═════════════════════════ weekly stories ═════════════════════════
   Written by a language model on the server for signed-in people (net/api.ts); otherwise a plain local summary.
   Saved in DB.stories and, when signed in, on the server too. */
export function renderArt(spec, dk = 0, size = 360) {
  const k = 'A' + dk + traceKey(spec);
  if (TR.has(k)) return TR.get(k);
  let url: string | null = null;
  try {
    url = renderTraceNow(spec, size, 0.5, !!dk);
  } catch (e) {}
  if (!url) return BLANK; /* the art is still loading; the next render of the page draws it */
  TR.set(k, url);
  return url;
}
/** A colour at a given OKLab lightness and chroma on the hue of `hex`. A dark warm hue (orange to yellow) reads as
    brown, so as a ground it turns to dusk plum instead, and its own light glows over it like a sunset. */
function tone(hex: string, L: number, C: number, dark = false): string {
  const [, a, b] = hexToLab(hex);
  if (Math.hypot(a, b) < 0.03) C = Math.min(C, 0.02); /* a near-grey has no hue worth saturating */
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (dark && h > 20 && h < 120) h = 335 + (h - 20) * 0.12;
  const r = (h * Math.PI) / 180;
  return labToHex([L, C * Math.cos(r), C * Math.sin(r)]);
}
/**
 * A story page is a poster in the feeling's own night: a deep, saturated ground of its hue (never near-black, never
 * brown), a light pool where the sculpture stands, a second colour rising from a corner, and light text. Every page
 * has its own colour, and the palette always holds together because each tone comes from the same hue.
 */
export function pageLook(key: string | null, weekKeys: string[] = []) {
  const pal = key ? palFor(key) : weekKeys[0] ? palFor(weekKeys[0]) : NEUTRAL_PAL,
    pal2 = !key && weekKeys[1] ? palFor(weekKeys[1]) : pal;
  const hi = tone(pal[1], 0.34, 0.085, true),
    mid = tone(pal[1], 0.22, 0.065, true),
    lo = tone(pal[1], 0.14, 0.04, true),
    pool = tone(pal[0], 0.52, 0.11),
    rise = tone(pal2[2], 0.4, 0.1, true);
  return {
    bg: `radial-gradient(62% 36% at 50% 30%, color-mix(in oklab, ${pool} 42%, transparent), transparent 75%),
      radial-gradient(90% 55% at 0% 100%, color-mix(in oklab, ${rise} 55%, transparent), transparent 72%),
      linear-gradient(168deg, ${hi}, ${mid} 48%, ${lo})`,
    fg: '#fbf7f3',
    solid: lo,
    dk: 1,
    pc: tone(pal[0], 0.88, 0.075),
  };
}
/** The story's sentences, each on its own entrance; words in «» take the page's colour. */
function storyLines(text: string) {
  const parts = text.match(/[^.!؟?؛]+[.!؟?؛]*\s*/g) || [text];
  return parts
    .map(
      (t, i) =>
        `<span class="st-line" style="--l:${i}">${esc(t.trim()).replace(/«([^»]{1,40})»/g, '<em>«$1»</em>')}</span>`,
    )
    .join(' ');
}
export function storyShell(look, inner, n = 0, cur = 0) {
  return `<div class="st-frame" style="--sbg:${look.bg};--sfg:${look.fg};--sbgc:${look.solid};--spc:${look.pc}">
    <div class="st-bars" aria-hidden="true">${[...Array(n)].map((_, i) => `<i class="${i < cur ? 'past' : i === cur ? 'cur' : ''}"><b></b></i>`).join('')}</div>
    <div class="st-top"><span class="st-range vh"></span><button class="st-x" data-act="storyClose" aria-label="بستن">${IC.close}</button></div>${inner}</div>`;
}
export function openStoryShell() {
  closeStory(true);
  const el = document.createElement('div');
  el.className = 'story';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'داستان هفته');
  document.body.appendChild(el);
  stageEl.style.visibility = 'hidden';
  S.story = { el, st: null, i: 0 };
  return el;
}
export async function weekStory(ws, regen = false) {
  const old = DB.stories.find((x) => x.week === ws);
  if (old && !regen) {
    openStoryView(old, 0);
    return;
  }
  const list = weekDays(ws).flatMap(dayList);
  if (list.length < 2) {
    toast('برای داستان این هفته، دست‌کم دو ردپا لازمه.');
    return;
  }
  const keys = [...new Set(list.flatMap((e) => e.emotions.map((x) => x.key)))];
  const wk = aggregate(list, 'w' + ws).items.map((x) => x.key);
  const el = openStoryShell();
  const lk0 = pageLook(null, wk);
  el.innerHTML = storyShell(
    lk0,
    `<div class="st-page loading"><div class="st-art-box"><img class="st-art breathe" alt="" src="${renderArt(aggregate(list, 'w' + ws), lk0.dk)}"></div>
    <div class="st-txt"><p class="st-k">${weekRange(ws)}</p><p class="st-text">دارم هفته‌ات رو مرور می‌کنم…</p><p class="st-note">فقط ردپاها و یادداشت‌های همین هفته خونده می‌شه.</p></div></div>`,
  );
  el.querySelector<HTMLElement>('.st-x').focus();
  /* signed in: the server writes it (the week's notes go along for this one request only);
     otherwise, or when that fails, a plain summary is written here */
  let st = null;
  if (isSignedIn() && S.story && S.story.el === el) {
    const ctl = new AbortController();
    S.story.ctl = ctl;
    try {
      const entries = list.map((e) => ({
        day: e.day,
        time: e.time,
        emotions: e.emotions.map((x) => ({
          key: x.key,
          parent: x.parent ?? null,
          custom: !!x.custom,
          color: x.color ?? null,
        })),
        context: e.context ?? null,
        scenes: e.scenes || [],
        intensity: e.intensity ?? null,
        meaning: e.meaning ?? null,
        note: (e.note || '').slice(0, 2000),
      }));
      const { story } = await api.writeStory({ week: ws, entries, weekKeys: wk }, ctl.signal);
      st = { ...story, weekKeys: wk, seen: false };
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      st = null;
    }
  }
  if (!S.story || S.story.el !== el) return;
  if (!st) {
    const res = localStory(list);
    const toKey = (l) => (l ? keys.find((k) => labelOf(k) === l) || null : null);
    st = {
      id: uid(),
      week: ws,
      createdAt: new Date().toISOString(),
      title: res.title,
      pages: res.pages.map((p) => ({ key: toKey(p.label), text: p.text })),
      weekKeys: wk,
      source: 'local',
      seen: false,
    };
  }
  DB.stories = DB.stories.filter((x) => x.week !== ws).concat(st);
  persist();
  openStoryView(st, 0, el);
}
export function openStoryView(st, i = 0, el?: HTMLElement) {
  if (!el) el = openStoryShell();
  S.story.st = st;
  S.story.el = el;
  const n = st.pages.length + 1;
  i = clamp(i, 0, n - 1);
  S.story.i = i;
  const isTitle = i === 0,
    pg = isTitle ? null : st.pages[i - 1],
    key = pg ? pg.key : null;
  const look = pageLook(key, st.weekKeys || []);
  const spec = key
    ? { items: [{ key }], neutral: 0, seed: (hashStr(st.id) % 997) / 997 }
    : {
        items: (st.weekKeys || []).slice(0, 3).map((k) => ({ key: k })),
        neutral: st.weekKeys?.length ? 0 : 1,
        seed: 0.4,
      };
  const last = i === n - 1;
  const art = `<div class="st-art-box"><img class="st-art" alt="" src="${renderArt(spec, look.dk)}"></div>`;
  const words = (st.weekKeys || [])
    .slice(0, 3)
    .map((k) => `<span style="--wc:${tone(palFor(k)[0], 0.86, 0.09)}"><i></i>${esc(labelOf(k))}</span>`)
    .join('');
  const body = isTitle
    ? `<div class="st-page title">${art}<div class="st-txt"><p class="st-k">${weekRange(st.week)}</p><h2 class="st-h">${esc(st.title)}</h2>${words ? `<p class="st-words">${words}</p>` : ''}<p class="st-note">برای ورق زدن، لمس کن</p></div></div>`
    : `<div class="st-page">${art}<div class="st-txt">${key ? `<p class="st-k"><i></i>${esc(labelOf(key))}</p>` : ''}<p class="st-text">${storyLines(pg.text)}</p>
        ${last ? `<div class="st-end"><button class="st-done" data-act="storyClose">تمام</button><button class="st-again" data-act="storyRegen">نوشتن دوباره</button></div><p class="st-note">در «الگوها» نگه داشته شد.</p>` : ''}</div></div>`;
  el.innerHTML = storyShell(
    look,
    `<button class="st-tap prev" data-act="storyPrev" aria-label="صفحه‌ی قبل"></button><button class="st-tap next" data-act="storyNext" aria-label="صفحه‌ی بعد"></button>${body}`,
    n,
    i,
  );
  el.querySelector<HTMLElement>('.st-range').textContent = `${fa(i + 1)} از ${fa(n)}`;
  const bar = el.querySelector<HTMLElement>('.st-bars i.cur b');
  if (bar && !reduced() && !last) {
    bar.style.animationDuration = (isTitle ? 5 : Math.min(14, 5 + pg.text.length / 22)) + 's';
    bar.addEventListener(
      'animationend',
      () => {
        if (S.story && S.story.el === el && S.story.i === i) openStoryView(st, i + 1, el);
      },
      { once: true },
    );
  } else if (bar) bar.style.transform = 'scaleX(1)';
  const fr = el.querySelector<HTMLElement>('.st-frame');
  fr.addEventListener('pointerdown', () => fr.classList.add('paused'));
  fr.addEventListener('pointerup', () => fr.classList.remove('paused'));
  fr.addEventListener('pointerleave', () => fr.classList.remove('paused'));
  if (last) {
    st.seen = true;
    persist();
  }
  requestAnimationFrame(() =>
    (el.querySelector<HTMLElement>('.st-done') || el.querySelector<HTMLElement>('.st-x')).focus({
      preventScroll: true,
    }),
  );
}
export function closeStory(instant = false) {
  const s0 = S.story;
  if (!s0) return;
  S.story = null;
  try {
    s0.ctl && s0.ctl.abort();
  } catch (e) {}
  stageEl.style.visibility = '';
  const el = s0.el;
  if (instant || reduced()) el.remove();
  else {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }
  if (S.view === 'patterns' || S.view === 'archive') renderView({ quiet: true });
}
