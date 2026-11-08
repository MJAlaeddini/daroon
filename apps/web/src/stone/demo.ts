/* /stone.html: a workbench for the emotion stone. Pick up to three feelings and watch one stone become another;
 * below, the twelve base stones, the five reference mixes from the brief, and all 298 states as canonical stills. */
import { EMOTIONS, EMOTION_IDS, EXAMPLES, type EmotionId } from './presets';
import { allSelections, describe, MAX_FEELINGS } from './resolve';
import { Stone, stillCanvasFor, stillPNG, stoneReady } from './stone';
import type { Theme } from './renderer';

const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/* the page follows the system (or an explicit data-theme on <html>) until the person picks a ground */
const light = matchMedia('(prefers-color-scheme: light)');
let picked = (() => {
  try {
    return localStorage.getItem('stone.theme') as Theme | null;
  } catch {
    return null;
  }
})();
const effective = (): Theme =>
  picked ?? ((document.documentElement.dataset.theme as Theme | undefined) || (light.matches ? 'light' : 'dark'));
let theme: Theme = effective();

document.body.innerHTML = `
<main class="wb">
  <header class="wb-head">
    <h1>سنگ‌های درون</h1>
    <p>دوازده احساس، هر کدوم یه سنگ. دو یا سه تا رو با هم انتخاب کن تا یه سنگ تازه ساخته بشه.</p>
  </header>
  <section class="wb-stage">
    <div class="wb-canvas"><canvas id="stone" role="img"></canvas></div>
    <p class="wb-label" id="label" aria-live="polite"></p>
    <figure class="wb-still" id="still" hidden>
      <img id="stillImg" alt="">
      <figcaption>این عکسِ همین سنگه، با پس‌زمینه‌ی شفاف. برای ذخیره، انگشتت رو روش نگه دار. <button class="wb-ghost" id="stillClose" type="button">بستن</button></figcaption>
    </figure>
  </section>
  <section class="wb-pick" aria-labelledby="pickTitle">
    <div class="wb-pick-head">
      <h2 id="pickTitle">احساس‌ها <span id="count"></span></h2>
      <button class="wb-ghost" id="clear" type="button">پاک کردن</button>
    </div>
    <div class="wb-chips" role="group" aria-label="احساس‌ها، تا سه تا"></div>
    <p class="wb-cap" id="cap" role="status"></p>
    <div class="wb-tools">
      <button class="wb-ghost" id="random" type="button">یه ترکیب تصادفی</button>
      <button class="wb-ghost" id="theme" type="button" aria-pressed="false"></button>
      <button class="wb-ghost" id="calm" type="button" aria-pressed="false">حرکت کم</button>
      <button class="wb-ghost" id="save" type="button">ذخیره‌ی عکس</button>
    </div>
  </section>
  <section class="wb-sheet">
    <h2>دوازده سنگ پایه</h2>
    <div class="wb-grid" id="singles"></div>
    <h2>ترکیب‌های نمونه</h2>
    <div class="wb-grid wb-grid-wide" id="examples"></div>
    <div class="wb-all-head">
      <h2>همه‌ی ${fa(allSelections().length)} حالت</h2>
      <button class="wb-ghost" id="showAll" type="button">نشونم بده</button>
    </div>
    <div class="wb-grid wb-grid-dense" id="all"></div>
  </section>
</main>`;

const canvas = $<HTMLCanvasElement>('#stone');
const stone = new Stone(canvas, { theme });
let chosen: EmotionId[] = [];

const dot = (id: EmotionId) => EMOTIONS[id].palette.middle;
const chips = $('.wb-chips');
chips.innerHTML = EMOTION_IDS.map(
  (id) =>
    `<button type="button" class="wb-chip" data-id="${id}" aria-pressed="false"><i style="background:${dot(id)}"></i>${EMOTIONS[id].label}</button>`,
).join('');

function apply(): void {
  stone.set(chosen.map((id) => ({ id })));
  chips.querySelectorAll<HTMLButtonElement>('.wb-chip').forEach((c) => {
    const on = chosen.includes(c.dataset.id as EmotionId);
    c.setAttribute('aria-pressed', String(on));
    c.disabled = false;
  });
  $('#label').textContent = describe(chosen);
  $('#count').textContent = chosen.length ? `${fa(chosen.length)} از ${fa(MAX_FEELINGS)}` : '';
}

let capTimer: ReturnType<typeof setTimeout> | undefined;
chips.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.wb-chip');
  if (!b) return;
  const id = b.dataset.id as EmotionId;
  const cap = $('#cap');
  if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
  else if (chosen.length >= MAX_FEELINGS) {
    cap.textContent = 'سه تا انتخاب کردی. برای یکی دیگه، اول یکی از این سه تا رو بردار.';
    clearTimeout(capTimer);
    capTimer = setTimeout(() => (cap.textContent = ''), 4000);
    b.animate([{ translate: '0' }, { translate: '-4px' }, { translate: '4px' }, { translate: '0' }], { duration: 260 });
    return;
  } else chosen = [...chosen, id];
  cap.textContent = '';
  apply();
});
$('#clear').addEventListener('click', () => {
  chosen = [];
  apply();
});
$('#random').addEventListener('click', () => {
  const all = allSelections();
  chosen = all[Math.floor(Math.random() * all.length)];
  apply();
});

function paintTheme(): void {
  if (picked) document.documentElement.dataset.theme = theme;
  stone.setTheme(theme);
  $('#theme').textContent = theme === 'dark' ? 'زمینه‌ی روشن' : 'زمینه‌ی تیره';
}
light.addEventListener('change', () => {
  if (picked) return;
  theme = effective();
  paintTheme();
  renderSheets();
});
$('#theme').addEventListener('click', () => {
  theme = picked = theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('stone.theme', theme);
  } catch {
    /* private mode: the choice simply isn't remembered */
  }
  paintTheme();
  renderSheets();
});
const calm = $<HTMLButtonElement>('#calm');
calm.addEventListener('click', () => {
  const on = calm.getAttribute('aria-pressed') !== 'true';
  calm.setAttribute('aria-pressed', String(on));
  stone.setReducedMotion(on || undefined);
});
/* The canonical still of the current choice. Shown on the page (long-press saves it on a phone) and offered as a
   download where the browser allows one. */
$('#save').addEventListener('click', () => {
  const url = stillPNG(
    chosen.map((id) => ({ id })),
    1024,
    theme,
  );
  $<HTMLImageElement>('#stillImg').src = url;
  $('#still').hidden = false;
  const a = document.createElement('a');
  a.href = url;
  a.download = `stone-${chosen.length ? [...chosen].sort().join('-') : 'rest'}.png`;
  a.click();
});
$('#stillClose').addEventListener('click', () => ($('#still').hidden = true));

/* ── contact sheets ──
   Tiles are canvases filled one per frame, and only once they come near the screen, so the live stone is never
   held up by a page of stills. */
const dpr = Math.min(2, window.devicePixelRatio || 1);
const queue: HTMLCanvasElement[] = [];
let pumping = false;
function pump(): void {
  if (pumping) return;
  pumping = true;
  const next = () => {
    const c = queue.shift();
    if (!c) {
      pumping = false;
      return;
    }
    const px = c.width;
    const src = stillCanvasFor(
      c.dataset.ids!.split(',').map((id) => ({ id: id as EmotionId })),
      px,
      theme,
    );
    const x = c.getContext('2d');
    x?.clearRect(0, 0, px, px);
    if (src) x?.drawImage(src, 0, 0);
    requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}
const seen = new IntersectionObserver(
  (es) => {
    for (const e of es)
      if (e.isIntersecting) {
        seen.unobserve(e.target);
        queue.push(e.target as HTMLCanvasElement);
      }
    pump();
  },
  { rootMargin: '200px' },
);
function tile(ids: EmotionId[], size: number, caption: string, note = ''): string {
  const px = Math.round(size * dpr);
  return `<button type="button" class="wb-tile" data-ids="${ids.join(',')}" aria-label="${describe(ids)}">
    <canvas data-ids="${ids.join(',')}" width="${px}" height="${px}" style="width:${size}px" aria-hidden="true"></canvas><span>${caption}</span>${note ? `<small>${note}</small>` : ''}</button>`;
}
function watch(box: HTMLElement): void {
  box.querySelectorAll('canvas').forEach((c) => seen.observe(c));
}
const label = (ids: EmotionId[]) => ids.map((id) => EMOTIONS[id].label).join(' + ');
function renderSheets(): void {
  queue.length = 0;
  $('#singles').innerHTML = EMOTION_IDS.map((id) => tile([id], 112, EMOTIONS[id].label)).join('');
  $('#examples').innerHTML = EXAMPLES.map((x) => tile(x.ids, 150, label(x.ids), x.description)).join('');
  watch($('#singles'));
  watch($('#examples'));
  if (allShown) renderAll();
}
let allShown = false;
function renderAll(): void {
  const box = $('#all');
  box.innerHTML = allSelections()
    .map((ids) => tile(ids, 72, label(ids)))
    .join('');
  watch(box);
}
$('#showAll').addEventListener('click', (e) => {
  allShown = true;
  (e.currentTarget as HTMLElement).remove();
  renderAll();
});
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.wb-tile');
  if (!t) return;
  chosen = t.dataset.ids!.split(',') as EmotionId[];
  apply();
  canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

paintTheme();
apply();
/* the live stone first; the sheets once it has had a moment to start */
void stoneReady().then(() => setTimeout(renderSheets, 300));
