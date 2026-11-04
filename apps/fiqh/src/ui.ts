/**
 * The whole interface: a library of trees, one tree drawn as a growing tree (sources at the roots, rulings at the
 * top), a panel that opens a node (the narration's text and chain, an inference's method, the derivation of a
 * ruling), and forms to add, edit and derive. Everything renders from `state` with plain template strings.
 */
import {
  CHAIN,
  KINDS,
  STANDING,
  STRENGTH,
  gradeChain,
  lineage,
  steps,
  uid,
  wouldLoop,
  type Kind,
  type Narrator,
  type Node,
  type Standing,
  type Strength,
  type Tree,
} from './model';
import { attackPath, edgePath, layout, type Layout } from './layout';
import { download, load, parseImport, save, type Saved } from './store';

/* ───────────── state ───────────── */
interface View {
  x: number;
  y: number;
  s: number;
}
const state: {
  saved: Saved;
  treeId: string | null;
  sel: string | null;
  view: View | null;
  modal: string | null;
} = { saved: load(), treeId: null, sel: null, view: null, modal: null };

let lay: Layout | null = null;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const esc = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const tree = (): Tree | undefined => state.saved.trees.find((t) => t.id === state.treeId);
const nodeById = (t: Tree, id: string) => t.nodes.find((n) => n.id === id);
function commit() {
  const t = tree();
  if (t) t.updatedAt = new Date().toISOString();
  save(state.saved);
}

/* ───────────── icons (inline, stroke) ───────────── */
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  branch:
    '<svg viewBox="0 0 24 24"><path d="M12 21V11M12 11c0-4-4-5-6-7M12 11c0-4 4-5 6-7"/><circle cx="12" cy="21" r="1"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/></svg>',
  fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M5 12h4M15 12h4"/><circle cx="12" cy="12" r="2"/></svg>',
};

/* ───────────── routing ───────────── */
function route() {
  const m = location.hash.match(/^#\/t\/([\w-]+)/);
  const id = m ? m[1] : null;
  if (id !== state.treeId) {
    state.treeId = id && state.saved.trees.some((t) => t.id === id) ? id : null;
    state.sel = null;
    state.view = null;
  }
  render();
}
const go = (hash: string) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

/* ───────────── library ───────────── */
function counts(t: Tree) {
  const c = (k: Kind) => t.nodes.filter((n) => n.kind === k).length;
  return { h: c('hadith'), v: c('verse'), r: c('ruling'), i: c('inference') };
}
function libraryHTML() {
  const trees = [...state.saved.trees].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const cards = trees
    .map((t) => {
      const c = counts(t);
      return `<a class="lib-card" href="#/t/${t.id}">
        <span class="lib-glyph" aria-hidden="true">${miniTree(t)}</span>
        <span class="lib-body"><b>${esc(t.title)}</b>${t.summary ? `<small>${esc(t.summary)}</small>` : ''}
        <span class="lib-meta">${[c.h && `${fa(c.h)} روایت`, c.v && `${fa(c.v)} آیه`, c.i && `${fa(c.i)} استدلال`, c.r && `${fa(c.r)} حکم`].filter(Boolean).join(' · ') || 'هنوز خالی'}${t.sample ? ' · <i>نمونه</i>' : ''}</span></span></a>`;
    })
    .join('');
  return `<header class="lib-head">
      <div class="brand"><span class="brand-mark" aria-hidden="true">${I.branch}</span><div><h1>شَجَره</h1><p>درختِ استدلالِ فقهی</p></div></div>
      <button class="icon" data-act="theme" aria-label="روشن یا تیره">${I.moon}</button>
    </header>
    <section class="lib-hero">
      <p class="lib-lede">از آیه و روایت تا حکم؛ هر گزاره بر چه چیزی بنا شده، سندش چه وزنی دارد، و از دلِ آن چه حکمِ تازه‌ای برمی‌آید.</p>
      <div class="lib-acts"><button class="btn primary" data-act="newTree">${I.plus}درختِ تازه</button>
      <label class="btn ghost">آوردن از فایل<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
    </section>
    <section class="lib-list" aria-label="درخت‌ها">${cards || '<p class="empty">هنوز درختی نیست.</p>'}</section>
    <footer class="lib-foot">درخت‌ها فقط روی همین دستگاه نگه داشته می‌شوند؛ برای نگه‌داشتن یا جابه‌جا کردن، از هر درخت خروجی بگیر.</footer>`;
}
/** A tiny drawing of the tree's shape for its card: one dot per node, rows bottom to top. */
function miniTree(t: Tree) {
  if (!t.nodes.length) return '<svg viewBox="0 0 60 60"><circle cx="30" cy="48" r="3" class="m-root"/></svg>';
  const L = layout(t),
    sx = 52 / Math.max(L.width, 1),
    sy = 46 / Math.max(L.height, 1);
  const pt = (id: string) => {
    const p = L.placed.get(id)!;
    return [4 + (p.x + p.w / 2) * sx, 7 + (p.y + p.h / 2) * sy];
  };
  let g = '';
  t.nodes.forEach((n) => {
    if (n.kind === 'objection' || !L.placed.has(n.id)) return;
    n.from.forEach((f) => {
      if (!L.placed.has(f)) return;
      const [x1, y1] = pt(f),
        [x2, y2] = pt(n.id);
      g += `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}"/>`;
    });
  });
  t.nodes.forEach((n) => {
    if (!L.placed.has(n.id)) return;
    const [x, y] = pt(n.id);
    g += `<circle cx="${x}" cy="${y}" r="${n.kind === 'ruling' ? 3.4 : 2.4}" class="m-${n.kind}"/>`;
  });
  return `<svg viewBox="0 0 60 60">${g}</svg>`;
}

/* ───────────── tree ───────────── */
function badge(n: Node) {
  if (n.kind === 'hadith') {
    const g = gradeChain(n);
    return g ? `<span class="grade g-${g}">${CHAIN[g].label}</span>` : '';
  }
  if (n.kind === 'ruling' && n.strength) return `<span class="grade s-${n.strength}">${STRENGTH[n.strength]}</span>`;
  return '';
}
function cardMeta(n: Node) {
  if (n.kind === 'hadith') return esc(n.speaker || n.source || '');
  if (n.kind === 'verse') return esc(n.source || '');
  if (n.kind === 'inference') return esc(n.method || '');
  if (n.kind === 'objection') return n.reply ? 'پاسخ داده شده' : 'بی‌پاسخ';
  return '';
}
function treeHTML(t: Tree) {
  lay = layout(t);
  const { placed, width, height } = lay;
  const path = state.sel ? lineage(t, state.sel) : null;
  let edges = '';
  t.nodes.forEach((n) => {
    const b = placed.get(n.id);
    if (!b) return;
    if (n.kind === 'objection') {
      const target = placed.get(n.from[0]);
      if (target)
        edges += `<path class="e attack ${path && path.has(n.id) && path.has(n.from[0]) ? 'on' : ''}" d="${attackPath(b, target)}"/>`;
      return;
    }
    n.from.forEach((f) => {
      const a = placed.get(f);
      if (a)
        edges += `<path class="e k-${a.node.kind} ${path && path.has(f) && path.has(n.id) ? 'on' : ''}" d="${edgePath(a, b)}"/>`;
    });
  });
  const cards = t.nodes
    .map((n) => {
      const p = placed.get(n.id);
      if (!p) return '';
      return `<button class="card k-${n.kind} ${state.sel === n.id ? 'sel' : ''} ${path && !path.has(n.id) ? 'dim' : ''}" data-id="${n.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
        <span class="ck">${KINDS[n.kind].label}${badge(n)}</span>
        <span class="ct">${esc(n.title)}</span>
        <span class="cm">${cardMeta(n)}</span></button>`;
    })
    .join('');
  const sel = state.sel ? nodeById(t, state.sel) : null;
  return `<header class="t-head">
      <a class="icon" href="#/" aria-label="بازگشت به درخت‌ها">${I.back}</a>
      <div class="t-title"><small>مسئله</small><h1>${esc(t.title)}</h1></div>
      <button class="icon" data-act="menu" aria-label="بیشتر" aria-expanded="${state.modal === 'menu'}">${I.more}</button>
    </header>
    <div class="board" id="board" aria-label="درخت استدلال">
      <div class="plane" id="plane" style="width:${width}px;height:${height}px">
        <svg class="edges" style="width:${width}px;height:${height}px" viewBox="0 0 ${width} ${height}" aria-hidden="true">${edges}</svg>${cards}
      </div>
      ${t.nodes.length ? '' : `<div class="board-empty"><p>درخت از ریشه‌هایش رشد می‌کند: یک آیه، یک روایت یا یک قاعده.</p><button class="btn primary" data-act="add">${I.plus}نخستین ریشه</button></div>`}
      <div class="legend" aria-hidden="true"><span class="lg-root">ریشه‌ها: منابع</span><span class="lg-mid">استدلال</span><span class="lg-top">حکم</span></div>
    </div>
    <nav class="dock" aria-label="کارها">
      <button class="icon" data-act="fit" aria-label="دیدن همهٔ درخت">${I.fit}</button>
      <button class="btn ghost" data-act="add">${I.plus}گزاره</button>
      <button class="btn primary" data-act="derive">${I.bolt}استنباط حکم تازه</button>
    </nav>
    ${sel ? drawerHTML(t, sel) : ''}`;
}

/* ───────────── a node opened ───────────── */
function chainHTML(n: Node) {
  const g = gradeChain(n);
  const links = (n.chain || [])
    .map(
      (r) =>
        `<li class="st-${r.standing}"><span class="dot"></span><span class="nm">${esc(r.name)}</span><span class="sd">${STANDING[r.standing]}</span></li>`,
    )
    .join('');
  return `<section class="isnad"><div class="sec-h"><h3>سند</h3>${g ? `<span class="grade g-${g}">${CHAIN[g].label}</span>` : ''}</div>
    ${g ? `<p class="why">${CHAIN[g].why}</p>` : '<p class="why">سندی ثبت نشده.</p>'}
    ${links ? `<ol class="chain ${n.broken ? 'broken' : ''}">${links}${n.speaker ? `<li class="imam"><span class="dot"></span><span class="nm">${esc(n.speaker)}</span></li>` : ''}</ol>` : ''}</section>`;
}
function drawerHTML(t: Tree, n: Node) {
  const by = new Map(t.nodes.map((x) => [x.id, x]));
  const chip = (x: Node) => `<button class="chip k-${x.kind}" data-sel="${x.id}"><i></i>${esc(x.title)}</button>`;
  const premises = n.kind === 'objection' ? [] : (n.from.map((id) => by.get(id)).filter(Boolean) as Node[]);
  const built = t.nodes.filter((x) => x.kind !== 'objection' && x.from.includes(n.id));
  const attacks = t.nodes.filter((x) => x.kind === 'objection' && x.from[0] === n.id);
  const target = n.kind === 'objection' ? by.get(n.from[0]) : null;
  const arabic = n.kind === 'verse' || n.kind === 'hadith';
  const text = n.text
    ? arabic
      ? `<blockquote class="ar ${n.kind}" lang="ar">${n.kind === 'verse' ? '﴿' : '«'}${esc(n.text)}${n.kind === 'verse' ? '﴾' : '»'}</blockquote>`
      : `<p class="stmt">${esc(n.text)}</p>`
    : '';
  const path = !KINDS[n.kind].root && n.kind !== 'objection' ? steps(t, n.id) : [];
  const derivation =
    path.length > 2
      ? `<section class="steps"><div class="sec-h"><h3>سیرِ استنباط</h3><span class="count">${fa(path.length)} گام</span></div><ol>${path
          .map(
            (s) =>
              `<li class="k-${s.kind}"><button data-sel="${s.id}"><small>${KINDS[s.kind].label}</small>${esc(s.title)}${s.method ? `<em>${esc(s.method)}</em>` : ''}</button></li>`,
          )
          .join('')}</ol></section>`
      : '';
  return `<aside class="drawer k-${n.kind}" role="dialog" aria-label="${esc(n.title)}">
    <div class="d-grip" aria-hidden="true"></div>
    <div class="d-head"><div><small class="d-kind">${KINDS[n.kind].label}${n.kind === 'ruling' && n.strength ? ` · ${STRENGTH[n.strength]}` : ''}</small><h2>${esc(n.title)}</h2>
      ${n.speaker && n.kind === 'hadith' ? `<p class="speaker">از ${esc(n.speaker)}</p>` : ''}</div>
      <button class="icon" data-act="unsel" aria-label="بستن">${I.close}</button></div>
    <div class="d-body">
      ${text}
      ${n.translation ? `<p class="tr">${esc(n.translation)}</p>` : ''}
      ${n.source ? `<p class="src">${esc(n.source)}</p>` : ''}
      ${n.method ? `<p class="method"><span>شیوهٔ دلالت</span>${esc(n.method)}</p>` : ''}
      ${n.kind === 'hadith' ? chainHTML(n) : ''}
      ${target ? `<section class="rel"><h3>اشکال بر</h3><div class="chips">${chip(target)}</div></section>` : ''}
      ${n.kind === 'objection' ? `<section class="reply"><h3>پاسخ</h3>${n.reply ? `<p>${esc(n.reply)}</p>` : '<p class="muted">هنوز پاسخی ثبت نشده.</p>'}</section>` : ''}
      ${premises.length ? `<section class="rel"><h3>بر پایهٔ</h3><div class="chips">${premises.map(chip).join('')}</div></section>` : ''}
      ${attacks.length ? `<section class="rel"><h3>اشکال‌ها</h3><div class="chips">${attacks.map(chip).join('')}</div></section>` : ''}
      ${built.length ? `<section class="rel"><h3>پایهٔ</h3><div class="chips">${built.map(chip).join('')}</div></section>` : ''}
      ${derivation}
      ${n.note ? `<p class="note">${esc(n.note)}</p>` : ''}
    </div>
    <div class="d-acts">
      <button class="btn primary" data-act="deriveFrom">${I.bolt}استنباط از این</button>
      ${n.kind !== 'objection' && !KINDS[n.kind].root ? `<button class="btn ghost" data-act="object">اشکال</button>` : ''}
      <button class="icon" data-act="edit" aria-label="ویرایش">${I.edit}</button>
      <button class="icon danger" data-act="del" aria-label="حذف">${I.trash}</button>
    </div></aside>`;
}

/* ───────────── forms ───────────── */
const KIND_ORDER: Kind[] = [
  'hadith',
  'verse',
  'principle',
  'consensus',
  'reason',
  'subject',
  'inference',
  'ruling',
  'objection',
];
function premisePicker(t: Tree, self: string | null, chosen: string[], single = false) {
  const opts = t.nodes
    .filter((n) => n.id !== self && (!self || !wouldLoop(t, self, n.id)))
    .map(
      (n) =>
        `<label class="pick k-${n.kind}"><input type="${single ? 'radio' : 'checkbox'}" name="from" value="${n.id}" ${chosen.includes(n.id) ? 'checked' : ''}><i></i><span>${esc(n.title)}<small>${KINDS[n.kind].label}</small></span></label>`,
    )
    .join('');
  return opts ? `<div class="picks">${opts}</div>` : '<p class="muted">هنوز گزاره‌ای نیست.</p>';
}
function chainRow(r: Narrator = { name: '', standing: 'imami' }) {
  return `<div class="crow"><input class="inp" name="cname" value="${esc(r.name)}" placeholder="نام راوی"><select class="inp" name="cstand">${(
    Object.keys(STANDING) as Standing[]
  )
    .map((s) => `<option value="${s}" ${r.standing === s ? 'selected' : ''}>${STANDING[s]}</option>`)
    .join(
      '',
    )}</select><button type="button" class="icon" data-act="rmRow" aria-label="حذف راوی">${I.close}</button></div>`;
}
function editorHTML(t: Tree, n: Node | null, kind: Kind, presetFrom: string[] = []) {
  const v = (k: keyof Node) => esc(((n?.[k] as string) || '') as string);
  const isRoot = KINDS[kind].root;
  const field = (name: string, label: string, val: string, opts: { area?: boolean; ar?: boolean; ph?: string } = {}) =>
    `<label class="fld"><span>${label}</span>${
      opts.area
        ? `<textarea class="inp ${opts.ar ? 'ar' : ''}" name="${name}" rows="3" ${opts.ar ? 'lang="ar"' : ''} placeholder="${opts.ph || ''}">${val}</textarea>`
        : `<input class="inp" name="${name}" value="${val}" placeholder="${opts.ph || ''}">`
    }</label>`;
  const kindSel = n
    ? ''
    : `<div class="kinds" role="radiogroup" aria-label="نوع گزاره">${KIND_ORDER.map((k) => `<button type="button" class="kchip k-${k}" data-act="pickKind" data-k="${k}" aria-pressed="${k === kind}"><i></i>${KINDS[k].label}</button>`).join('')}</div>`;
  const from = n ? n.from : presetFrom;
  return `<form class="sheet" data-form="node" data-kind="${kind}" ${n ? `data-id="${n.id}"` : ''}>
    <div class="sh-head"><h2>${n ? 'ویرایشِ ' + KINDS[kind].label : 'گزارهٔ تازه'}</h2><button type="button" class="icon" data-act="closeModal" aria-label="بستن">${I.close}</button></div>
    <div class="sh-body">
      ${kindSel}
      ${field('title', 'عنوانِ کوتاه', v('title'), { ph: kind === 'hadith' ? 'مثلاً صحیحهٔ زراره' : '' })}
      ${kind === 'hadith' ? field('speaker', 'معصوم', v('speaker'), { ph: 'امام صادق (ع)' }) : ''}
      ${field('text', kind === 'verse' || kind === 'hadith' ? 'متنِ عربی' : kind === 'objection' ? 'اشکال' : 'متن', v('text'), { area: true, ar: kind === 'verse' || kind === 'hadith' })}
      ${kind === 'verse' || kind === 'hadith' ? field('translation', 'ترجمه', v('translation'), { area: true }) : ''}
      ${kind === 'verse' || kind === 'hadith' || kind === 'principle' || kind === 'consensus' ? field('source', 'منبع', v('source'), { ph: kind === 'verse' ? 'نام سوره، شمارهٔ آیه' : 'کتاب، جلد، صفحه، حدیث' }) : ''}
      ${
        kind === 'hadith'
          ? `<fieldset class="fld chain-ed"><legend>سند <small>از مؤلف تا آخرین راوی پیش از معصوم</small></legend><div id="rows">${(n?.chain?.length ? n.chain : [undefined]).map((r) => chainRow(r)).join('')}</div>
            <div class="row-acts"><button type="button" class="btn ghost sm" data-act="addRow">${I.plus}راوی</button><label class="chk"><input type="checkbox" name="broken" ${n?.broken ? 'checked' : ''}> افتادگی در سند (مرسل)</label></div></fieldset>`
          : ''
      }
      ${kind === 'inference' ? field('method', 'شیوهٔ دلالت', v('method'), { ph: 'اطلاق، عموم، تعلیل، مفهوم، الغای خصوصیت…' }) : ''}
      ${
        kind === 'ruling'
          ? `<label class="fld"><span>درجه</span><select class="inp" name="strength">${(Object.keys(STRENGTH) as Strength[]).map((s) => `<option value="${s}" ${(n?.strength || 'fatwa') === s ? 'selected' : ''}>${STRENGTH[s]}</option>`).join('')}</select></label>`
          : ''
      }
      ${kind === 'objection' ? field('reply', 'پاسخ', v('reply'), { area: true }) : ''}
      ${!isRoot ? `<fieldset class="fld"><legend>${kind === 'objection' ? 'اشکال بر کدام گزاره؟' : 'بر پایهٔ کدام گزاره‌ها؟'}</legend>${premisePicker(t, n?.id ?? null, from, kind === 'objection')}</fieldset>` : ''}
      ${field('note', 'یادداشت', v('note'), { area: true })}
    </div>
    <div class="sh-foot"><button class="btn primary" type="submit">${n ? 'ذخیره' : 'افزودن'}</button><button type="button" class="btn ghost" data-act="closeModal">انصراف</button><p class="form-err" role="alert"></p></div>
  </form>`;
}
function deriveHTML(t: Tree, preset: string[]) {
  return `<form class="sheet" data-form="derive">
    <div class="sh-head"><h2>استنباطِ حکمِ تازه</h2><button type="button" class="icon" data-act="closeModal" aria-label="بستن">${I.close}</button></div>
    <div class="sh-body">
      <p class="muted">مقدمه‌ها را برگزین، بگو چگونه به نتیجه می‌رسند، و حکم را بنویس. یک استدلال و یک حکم به درخت افزوده می‌شود.</p>
      <fieldset class="fld"><legend>مقدمه‌ها</legend>${premisePicker(t, null, preset)}</fieldset>
      <label class="fld"><span>شیوهٔ دلالت</span><input class="inp" name="method" placeholder="تطبیق کبری بر صغری، اولویت، تنقیح مناط…"></label>
      <label class="fld"><span>تقریرِ استدلال</span><textarea class="inp" name="argument" rows="3"></textarea></label>
      <label class="fld"><span>حکم</span><input class="inp" name="title" placeholder="عنوانِ کوتاهِ حکم"></label>
      <label class="fld"><span>متنِ حکم</span><textarea class="inp" name="text" rows="2"></textarea></label>
      <label class="fld"><span>درجه</span><select class="inp" name="strength">${(Object.keys(STRENGTH) as Strength[]).map((s) => `<option value="${s}">${STRENGTH[s]}</option>`).join('')}</select></label>
    </div>
    <div class="sh-foot"><button class="btn primary" type="submit">${I.bolt}استنباط</button><button type="button" class="btn ghost" data-act="closeModal">انصراف</button><p class="form-err" role="alert"></p></div>
  </form>`;
}
function newTreeHTML() {
  return `<form class="sheet" data-form="tree">
    <div class="sh-head"><h2>درختِ تازه</h2><button type="button" class="icon" data-act="closeModal" aria-label="بستن">${I.close}</button></div>
    <div class="sh-body"><label class="fld"><span>مسئله</span><input class="inp" name="title" placeholder="مثلاً حکمِ معامله‌ای که در آن غبن هست"></label>
      <label class="fld"><span>توضیحِ کوتاه</span><input class="inp" name="summary"></label></div>
    <div class="sh-foot"><button class="btn primary" type="submit">ساختن</button><button type="button" class="btn ghost" data-act="closeModal">انصراف</button><p class="form-err" role="alert"></p></div></form>`;
}
function menuHTML() {
  return `<div class="menu" role="menu">
    <button role="menuitem" data-act="export">خروجیِ این درخت (JSON)</button>
    <button role="menuitem" data-act="rename">ویرایشِ عنوانِ مسئله</button>
    <button role="menuitem" data-act="theme">روشن یا تیره</button>
    <button role="menuitem" class="danger" data-act="delTree">حذفِ درخت</button></div>`;
}

/* ───────────── render ───────────── */
function render() {
  const app = $('#app')!;
  const t = tree();
  document.body.dataset.screen = t ? 'tree' : 'library';
  app.innerHTML = t ? treeHTML(t) : libraryHTML();
  renderModal();
  if (t) {
    setupBoard();
    applyView();
  }
}
let modalArgs: { kind?: Kind; id?: string; preset?: string[] } = {};
function renderModal() {
  const host = $('#modal')!;
  const t = tree();
  if (!state.modal) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;
  let inner = '';
  if (state.modal === 'tree') inner = newTreeHTML();
  else if (state.modal === 'rename' && t)
    inner = newTreeHTML()
      .replace('درختِ تازه', 'مسئله')
      .replace('name="title" ', `name="title" value="${esc(t.title)}" `)
      .replace('name="summary"', `name="summary" value="${esc(t.summary || '')}"`)
      .replace('ساختن', 'ذخیره');
  else if (state.modal === 'menu') inner = menuHTML();
  else if (state.modal === 'node' && t)
    inner = editorHTML(
      t,
      modalArgs.id ? nodeById(t, modalArgs.id) || null : null,
      modalArgs.kind || 'hadith',
      modalArgs.preset,
    );
  else if (state.modal === 'derive' && t) inner = deriveHTML(t, modalArgs.preset || []);
  host.innerHTML = `<div class="scrim" data-act="closeModal"></div>${inner}`;
  host.dataset.kind = state.modal;
  requestAnimationFrame(() =>
    $<HTMLElement>('#modal .sh-body input, #modal .sh-body textarea, #modal .menu button')?.focus(),
  );
}
function openModal(m: string, args: typeof modalArgs = {}) {
  state.modal = m;
  modalArgs = args;
  renderModal();
}
function closeModal() {
  state.modal = null;
  renderModal();
}

/* ───────────── pan and zoom ───────────── */
function applyView() {
  const plane = $('#plane'),
    board = $('#board');
  if (!plane || !board || !lay) return;
  if (!state.view) fit();
  const v = state.view!;
  plane.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
}
/**
 * The first view. On a wide screen the whole tree fits. On a phone a whole tree would be too small to read, so it
 * opens at a readable size on the crown (the rulings at the top), and the tree is explored by dragging down
 * toward its roots; the fit button still shows all of it.
 */
function fit(all = false) {
  const board = $('#board');
  if (!board || !lay) return;
  // room for the header and legend above, and the dock below
  const top = 104,
    bottom = 90,
    bw = board.clientWidth,
    bh = board.clientHeight - top - bottom;
  const whole = Math.min(1, (bw - 32) / lay.width, bh / lay.height);
  if (all || whole >= 0.62 || bw >= 700) {
    const s = Math.max(0.25, whole);
    state.view = { s, x: (bw - lay.width * s) / 2, y: top + Math.max(0, (bh - lay.height * s) / 2) };
    return;
  }
  const s = 0.8;
  state.view = { s, x: (bw - lay.width * s) / 2, y: top };
}
function setupBoard() {
  const board = $('#board')!;
  const pts = new Map<number, { x: number; y: number }>();
  let moved = 0,
    pinch0 = 0,
    s0 = 1;
  board.onpointerdown = (e) => {
    if ((e.target as Element).closest('.legend, .board-empty')) return;
    // the pointer is captured only once it moves: capturing at once would send the tap's click to the board
    // instead of the card under the finger
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      s0 = state.view!.s;
    }
  };
  board.onpointermove = (e) => {
    const p = pts.get(e.pointerId);
    if (!p || !state.view) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (moved > 4 && !board.hasPointerCapture(e.pointerId)) board.setPointerCapture(e.pointerId);
    if (pts.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      state.view.x += dx;
      state.view.y += dy;
    } else if (pts.size === 2) {
      moved += 10;
      const [a, b] = [...pts.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (s0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0);
    }
    applyView();
  };
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch0 = 0;
  };
  board.onpointerup = up;
  board.onpointercancel = up;
  board.onwheel = (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, state.view!.s * Math.exp(-e.deltaY * 0.0015));
    applyView();
  };
  board.onclick = (e) => {
    if (moved > 8) return;
    const c = (e.target as Element).closest<HTMLElement>('.card');
    if (c) select(c.dataset.id!);
    else if (!(e.target as Element).closest('.board-empty, .legend')) select(null);
  };
}
function zoomAt(cx: number, cy: number, s: number) {
  const v = state.view!,
    r = $('#board')!.getBoundingClientRect();
  s = Math.max(0.25, Math.min(2.2, s));
  const px = cx - r.left,
    py = cy - r.top;
  v.x = px - ((px - v.x) * s) / v.s;
  v.y = py - ((py - v.y) * s) / v.s;
  v.s = s;
}
function select(id: string | null) {
  state.sel = id;
  const t = tree()!;
  const keep = state.view;
  $('#app')!.innerHTML = treeHTML(t);
  state.view = keep;
  setupBoard();
  applyView();
  if (id) bringIntoView(id);
}
/** Moves the plane so the chosen card is above the panel, not under it. */
function bringIntoView(id: string) {
  const p = lay?.placed.get(id),
    v = state.view,
    board = $('#board');
  if (!p || !v || !board) return;
  const drawer = $('.drawer');
  const visibleH = drawer && innerWidth < 760 ? board.clientHeight - drawer.offsetHeight : board.clientHeight;
  const cx = v.x + (p.x + p.w / 2) * v.s,
    cy = v.y + (p.y + p.h / 2) * v.s,
    top = 104;
  const wantX = innerWidth >= 760 ? (board.clientWidth - 420) / 2 + 420 : board.clientWidth / 2;
  if (cx < 40 || cx > board.clientWidth - 40 || cy < top + 20 || cy > visibleH - 30) {
    v.x += wantX - cx;
    v.y += top + (visibleH - top) / 2 - cy;
    const plane = $('#plane')!;
    plane.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
    applyView();
    setTimeout(() => (plane.style.transition = ''), 460);
  }
}

/* ───────────── actions ───────────── */
function readNode(form: HTMLFormElement, kind: Kind, base?: Node): Node | string {
  const f = new FormData(form);
  const s = (k: string) => String(f.get(k) ?? '').trim();
  const title = s('title');
  if (!title) return 'عنوان لازم است.';
  const n: Node = { ...(base || { id: uid(), from: [] }), kind, title };
  const opt = (k: 'text' | 'translation' | 'source' | 'speaker' | 'method' | 'reply' | 'note') => {
    const x = s(k);
    if (x) n[k] = x;
    else delete n[k];
  };
  (['text', 'translation', 'source', 'speaker', 'method', 'reply', 'note'] as const).forEach(opt);
  if (kind === 'hadith') {
    const names = f.getAll('cname').map(String),
      st = f.getAll('cstand').map(String) as Standing[];
    n.chain = names.map((name, i) => ({ name: name.trim(), standing: st[i] })).filter((r) => r.name);
    n.broken = f.get('broken') === 'on';
  } else {
    delete n.chain;
    delete n.broken;
  }
  if (kind === 'ruling') n.strength = (s('strength') || 'fatwa') as Strength;
  else delete n.strength;
  if (!KINDS[kind].root) {
    n.from = f.getAll('from').map(String);
    if (kind === 'objection' && n.from.length !== 1) return 'گزاره‌ای را که اشکال بر آن است، برگزین.';
  } else n.from = [];
  return n;
}
function submit(form: HTMLFormElement) {
  const err = $('.form-err', form)!;
  const kind = form.dataset.form;
  if (kind === 'tree') {
    const f = new FormData(form),
      title = String(f.get('title') || '').trim();
    if (!title) return (err.textContent = 'مسئله را بنویس.');
    const summary = String(f.get('summary') || '').trim() || undefined;
    if (state.modal === 'rename') {
      const t = tree()!;
      t.title = title;
      t.summary = summary;
      commit();
      closeModal();
      return render();
    }
    const t: Tree = { id: uid(), title, summary, updatedAt: new Date().toISOString(), nodes: [] };
    state.saved.trees.push(t);
    commit();
    closeModal();
    return go(`#/t/${t.id}`);
  }
  const t = tree()!;
  if (kind === 'node') {
    const id = form.dataset.id,
      base = id ? nodeById(t, id) : undefined;
    const n = readNode(form, form.dataset.kind as Kind, base);
    if (typeof n === 'string') return (err.textContent = n);
    if (base) Object.assign(base, n);
    else t.nodes.push(n);
    commit();
    closeModal();
    return select(n.id);
  }
  if (kind === 'derive') {
    const f = new FormData(form);
    const from = f.getAll('from').map(String),
      title = String(f.get('title') || '').trim();
    if (!from.length) return (err.textContent = 'دست‌کم یک مقدمه برگزین.');
    if (!title) return (err.textContent = 'حکم را بنویس.');
    const inf: Node = {
      id: uid(),
      kind: 'inference',
      title: String(f.get('method') || '').trim() || 'استدلال',
      method: String(f.get('method') || '').trim() || undefined,
      text: String(f.get('argument') || '').trim() || undefined,
      from,
    };
    const rul: Node = {
      id: uid(),
      kind: 'ruling',
      title,
      text: String(f.get('text') || '').trim() || undefined,
      strength: String(f.get('strength') || 'fatwa') as Strength,
      from: [inf.id],
    };
    t.nodes.push(inf, rul);
    commit();
    closeModal();
    state.view = null;
    render();
    return select(rul.id);
  }
}
const ACT: Record<string, (el: HTMLElement) => void> = {
  theme() {
    const order = ['auto', 'light', 'dark'] as const;
    state.saved.theme = order[(order.indexOf(state.saved.theme) + 1) % 3];
    applyTheme();
    save(state.saved);
    if (state.modal === 'menu') closeModal();
  },
  newTree: () => openModal('tree'),
  menu: () => (state.modal === 'menu' ? closeModal() : openModal('menu')),
  closeModal,
  fit() {
    fit(true);
    const plane = $('#plane')!;
    plane.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
    applyView();
    setTimeout(() => (plane.style.transition = ''), 460);
  },
  add: () => openModal('node', { kind: 'hadith' }),
  derive: () => openModal('derive', { preset: state.sel ? [state.sel] : [] }),
  deriveFrom: () => openModal('derive', { preset: state.sel ? [state.sel] : [] }),
  object: () => openModal('node', { kind: 'objection', preset: state.sel ? [state.sel] : [] }),
  edit() {
    const n = state.sel && nodeById(tree()!, state.sel);
    if (n) openModal('node', { kind: n.kind, id: n.id });
  },
  del(el) {
    const t = tree()!,
      id = state.sel!;
    if (el.dataset.armed !== '1') {
      el.dataset.armed = '1';
      el.classList.add('armed');
      el.setAttribute('aria-label', 'دوباره بزن تا حذف شود');
      setTimeout(() => {
        el.dataset.armed = '';
        el.classList.remove('armed');
      }, 3000);
      return;
    }
    t.nodes = t.nodes.filter((n) => n.id !== id && !(n.kind === 'objection' && n.from[0] === id));
    t.nodes.forEach((n) => (n.from = n.from.filter((f) => f !== id)));
    commit();
    state.view = null;
    state.sel = null;
    render();
  },
  unsel: () => select(null),
  pickKind(el) {
    const form = el.closest<HTMLFormElement>('form')!;
    const keep = {
      title: (form.elements.namedItem('title') as HTMLInputElement)?.value,
      text: (form.elements.namedItem('text') as HTMLTextAreaElement)?.value,
    };
    openModal('node', { kind: el.dataset.k as Kind, preset: modalArgs.preset });
    const f2 = $<HTMLFormElement>('#modal form')!;
    (f2.elements.namedItem('title') as HTMLInputElement).value = keep.title || '';
    (f2.elements.namedItem('text') as HTMLTextAreaElement).value = keep.text || '';
  },
  addRow() {
    $('#rows')!.insertAdjacentHTML('beforeend', chainRow());
    $$<HTMLInputElement>('#rows input').pop()?.focus();
  },
  rmRow(el) {
    const rows = $$('#rows .crow');
    if (rows.length > 1) el.closest('.crow')!.remove();
    else $$<HTMLInputElement>('input', rows[0]).forEach((i) => (i.value = ''));
  },
  export() {
    const t = tree()!;
    download(`${t.title.slice(0, 40)}.json`, t);
    closeModal();
  },
  rename: () => openModal('rename'),
  delTree(el) {
    if (el.dataset.armed !== '1') {
      el.dataset.armed = '1';
      el.textContent = 'مطمئنی؟ دوباره بزن';
      return;
    }
    state.saved.trees = state.saved.trees.filter((t) => t.id !== state.treeId);
    commit();
    closeModal();
    go('#/');
  },
};

function applyTheme() {
  const t = state.saved.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function start() {
  applyTheme();
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    const s = t.closest<HTMLElement>('[data-sel]');
    if (s) return select(s.dataset.sel!);
    const a = t.closest<HTMLElement>('[data-act]');
    if (a && a.tagName !== 'INPUT' && ACT[a.dataset.act!]) {
      e.preventDefault();
      ACT[a.dataset.act!](a);
    }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target as HTMLFormElement);
  });
  document.addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.act !== 'import' || !el.files?.[0]) return;
    try {
      const list = parseImport(await el.files[0].text());
      list.forEach((t) => {
        if (state.saved.trees.some((x) => x.id === t.id)) t.id = uid();
        t.updatedAt = new Date().toISOString();
        state.saved.trees.push(t);
      });
      save(state.saved);
      render();
    } catch {
      alert('این فایل خوانده نشد.');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.modal) closeModal();
    else if (state.sel) select(null);
  });
  addEventListener('hashchange', route);
  addEventListener('resize', () => {
    if (tree()) {
      state.view = null;
      applyView();
    }
  });
  route();
}
