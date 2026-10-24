import { fa, labelOf, localStory, weekDays, weekRange } from '@daroon/shared';
import { api } from '../net/api';
import { isSignedIn } from './sync';
import { hexToLab, labRot, labToHex } from '../core/color';
import { clamp, esc, hashStr, uid } from '../core/util';
import { NEUTRAL_PAL, P0, lex, palFor } from '../domain/lexicon';
import { aggregate } from '../domain/specs';
import { buildU, reduced, staticState } from '../sculpture/engine';
import { BLANK, TR, mini, miniCanvas, traceKey } from '../sculpture/traces';
import { stageEl } from '../stage/stage';
import { S } from '../state/app';
import { DB, dayList, persist } from '../state/store';
import { polyPath } from '../ui/glyph';
import { IC } from '../ui/icons';
import { renderView } from '../ui/render';
import { toast } from '../ui/toast';

/* ═════════════════════════ weekly stories ═════════════════════════
   Written by a language model on the server for signed-in people (net/api.ts); otherwise a plain local summary.
   Saved in DB.stories and, when signed in, on the server too. */
export function renderArt(spec, dk = 0, size = 360) {
  const k = 'A' + dk + traceKey(spec);
  if (TR.has(k)) return TR.get(k);
  let url = BLANK;
  try {
    miniCanvas.width = miniCanvas.height = size;
    mini.draw(buildU(staticState(spec), 0.5, 0.9, dk));
    url = miniCanvas.toDataURL('image/png');
  } catch (e) {}
  miniCanvas.width = miniCanvas.height = 144;
  TR.set(k, url);
  return url;
}
export function pageLook(key: string | null, weekKeys?: string[]) {
  const pal = key ? palFor(key) : weekKeys[0] ? palFor(weekKeys[0]) : NEUTRAL_PAL,
    pal2 = !key && weekKeys[1] ? palFor(weekKeys[1]) : pal;
  const light = hexToLab(pal[1])[0] > 0.66;
  return {
    bg: `radial-gradient(120% 75% at 75% 15%,${pal[0]},${pal[1]} 55%,${pal2[2]} 120%)`,
    fg: light ? '#1d1726' : '#fbf8f5',
    solid: pal[1],
    dk: light ? 0 : 1,
    pc: light ? labToHex(labRot(hexToLab(pal[2]), 0, -0.12, 1.2)) : pal[0],
  };
}
export function storyShell(look, inner, n = 0, cur = 0) {
  return `<div class="st-frame" style="--sbg:${look.bg};--sfg:${look.fg};--sbgc:${look.solid};--spc:${look.pc}">
    <div class="st-bars" aria-hidden="true">${[...Array(n)].map((_, i) => `<i class="${i < cur ? 'past' : i === cur ? 'cur' : ''}"><b></b></i>`).join('')}</div>
    <div class="st-top"><span class="st-range"></span><button class="st-x" data-act="storyClose" aria-label="بستن">${IC.close}</button></div>${inner}</div>`;
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
    `<div class="st-page loading">${patSVG(wk[0] || null, 0)}<img class="st-art breathe" alt="" src="${renderArt(aggregate(list, 'w' + ws), lk0.dk)}">
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
/* minimal generative patterns that frame each story page; the emotion's own form parameters set their rhythm */
export function storyPattern(key, idx) {
  const P = key ? lex(key).P : P0,
    seed = (hashStr((key || 'w') + idx) % 1000) / 1000,
    kinds = ['rings', 'waves', 'dots', 'arcs'],
    kind = idx === 0 ? 'rings' : kinds[(idx + Math.floor(seed * 4)) % 4];
  let g = '';
  if (kind === 'rings') {
    const n = 9 + Math.round(P.tens * 7),
      gap = 30 - P.tens * 10;
    for (let i = 1; i <= n; i++)
      g += `<path d="${polyPath(200, 300, 92 + i * gap, P, seed, i % 3, 0, i * 0.21, 90)}" stroke-opacity="${(0.42 - i * 0.02).toFixed(3)}"/>`;
    return `<g class="spin">${g}</g>`;
  }
  if (kind === 'waves') {
    const n = 16 + Math.round(P.freq * 10),
      amp = 8 + P.turb * 22,
      tilt = -P.dy * 40;
    for (let i = 0; i < n; i++) {
      const y0 = 40 + i * (720 / n);
      let d = '';
      for (let x = -40; x <= 440; x += 10) {
        const y =
          y0 +
          (tilt * (x - 200)) / 400 +
          amp * Math.sin(x / (40 + P.reg * 40) + i * 0.55 + seed * 6) * Math.sin(i * 0.3 + 1);
        d += (x === -40 ? 'M' : 'L') + x + ' ' + y.toFixed(1);
      }
      g += `<path d="${d}" stroke-opacity="${(0.12 + 0.14 * Math.sin((i / n) * Math.PI)).toFixed(3)}"/>`;
    }
    return `<g class="drift">${g}</g>`;
  }
  if (kind === 'dots') {
    const step = 18 - P.tens * 4,
      maxD = 430;
    for (let y = 10; y < 800; y += step)
      for (let x = 10 + ((Math.round(y / step) % 2) * step) / 2; x < 400; x += step) {
        const d = Math.hypot(x - 200, (y - 300) * 0.9) / maxD,
          r = Math.max(
            0,
            3.4 * Math.pow(Math.max(0, 1 - d), 1.6) * (0.6 + 0.4 * Math.sin(x * 0.05 + y * 0.03 + seed * 9)),
          );
        if (r > 0.35) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`;
      }
    return `<g fill="currentColor" fill-opacity=".32" stroke="none">${g}</g>`;
  }
  const cx = 200 + (seed - 0.5) * 260,
    cy = 860;
  for (let i = 0; i < 22; i++) {
    const r = 120 + i * (26 + P.exp * 14);
    g += `<circle cx="${cx.toFixed(0)}" cy="${cy}" r="${r.toFixed(0)}" stroke-opacity="${(0.28 - i * 0.011).toFixed(3)}"/>`;
  }
  return `<g class="rise-g">${g}</g>`;
}
export const patSVG = (key, idx) =>
  `<svg class="st-pat" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.1" vector-effect="non-scaling-stroke">${storyPattern(key, idx)}</g></svg>`;
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
  const body = isTitle
    ? `<div class="st-page title">${patSVG(st.weekKeys?.[0] || null, 0)}<img class="st-art" alt="" src="${renderArt(spec, look.dk)}"><div class="st-txt"><p class="st-k">${weekRange(st.week)}</p><h2 class="st-h">${esc(st.title)}</h2><p class="st-note">برای ورق زدن، لمس کن.</p></div></div>`
    : `<div class="st-page">${patSVG(key, i)}<img class="st-art" alt="" src="${renderArt(spec, look.dk)}"><div class="st-txt">${key ? `<p class="st-k">${esc(labelOf(key))}</p>` : ''}<p class="st-text">${esc(pg.text)}</p>
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
