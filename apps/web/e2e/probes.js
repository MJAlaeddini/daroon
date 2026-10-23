/* In-page probes for the acceptance suite: stage position, text over the sculpture, layout checks. */
window.__acc = {
  effOpacity(el){ let o = 1; while (el && el.nodeType === 1){ const cs = getComputedStyle(el); o *= parseFloat(cs.opacity); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; el = el.parentElement; } return o; },
  textEls(root){ const out = []; const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())){ if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || el.closest('#sprite,script,style,noscript')) continue; out.push(el); }
    return [...new Set(out)]; },
  stage(){ const s = document.getElementById('stage'), c = s.querySelector('canvas'); const m = (s.style.transform || '').match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px.*scale\(([-\d.]+),\s*([-\d.]+)\)/);
    if (!m) return null; const w = parseFloat(c.style.width) * +m[3], h = parseFloat(c.style.height) * +m[4];
    return { x: +m[1], y: +m[2], w, h, op: parseFloat(getComputedStyle(s).opacity) * (getComputedStyle(s).visibility === 'hidden' ? 0 : 1) }; },
  sample(){ const st = this.stage(); const res = { t: performance.now(), st, overlaps: [], views: document.querySelectorAll('#views .view').length };
    if (st && st.op > .3){ const core = { x: st.x + st.w * .3, y: st.y + st.h * .3, w: st.w * .4, h: st.h * .4 };
      for (const el of this.textEls(document.querySelector('#views'))){ const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        if (r.right < core.x || r.left > core.x + core.w || r.bottom < core.y || r.top > core.y + core.h) continue;
        const op = this.effOpacity(el); if (op < .25) continue; if (el.closest('.word,.login-words')) continue;
        res.overlaps.push({ txt: el.textContent.trim().slice(0, 40), op: +op.toFixed(2), leaving: !!el.closest('.leaving') }); } }
    const lv = document.querySelector('#views .view.leaving'), nw = document.querySelector('#views .view:not(.leaving)');
    if (lv && nw){ const a = this.effOpacity(lv), b = this.effOpacity(nw); const r = lv.getBoundingClientRect(), q = nw.getBoundingClientRect(); const ox = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)); const shared = ox / Math.max(1, Math.min(r.width, q.width)); res.ghost = (a > .3 && b > .3 && shared > .35) ? [+a.toFixed(2), +b.toFixed(2), +shared.toFixed(2)] : null; }
    return res; },
  lum(c){ const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return { L: .2126 * r + .7152 * g + .0722 * b, a: m[3] !== undefined ? +m[3] : 1 }; },
  bgOf(el){ while (el && el.nodeType === 1){ const cs = getComputedStyle(el); const bg = cs.backgroundColor; const l = this.lum(bg); if (l && l.a > .85) return bg; if (cs.backgroundImage !== 'none' && !el.matches('body,html')) return 'IMG'; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; },
  layout(){ const W = innerWidth, issues = { hscroll: document.documentElement.scrollWidth > W + 1, offscreen: [], clipped: [], smallTargets: [], overlapsBtn: [], lowContrast: [], tinyText: [] };
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && this.effOpacity(el) > .5; };
    for (const el of this.textEls(document.body)){ if (!vis(el)) continue; const r = el.getBoundingClientRect(); const inScroll = el.closest('.srow,.weave-wrap,.sheet-scroll');
      if (!inScroll && (r.right > W + 1 || r.left < -1) && !el.closest('.st-frame,.flyer')) issues.offscreen.push(el.textContent.trim().slice(0, 30) + ` [${Math.round(r.left)}..${Math.round(r.right)}]`);
      const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); if (fs < 12) issues.tinyText.push(el.textContent.trim().slice(0, 24) + ' ' + fs + 'px');
      if (!el.matches('.vh') && (cs.overflow.includes('hidden') || cs.overflow.includes('clip')) && el.scrollWidth > el.clientWidth + 1) issues.clipped.push(el.textContent.trim().slice(0, 30));
      const bg = this.bgOf(el); if (bg !== 'IMG' && !el.closest('.st-frame')){ const a = this.lum(cs.color), b = this.lum(bg); if (a && b){ const op = this.effOpacity(el); const L1 = a.L, L2 = b.L; let ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
          if (op < .95) ratio = 1 + (ratio - 1) * op; const large = fs >= 18.6 || (fs >= 14 && +cs.fontWeight >= 700);
          if (ratio < (large ? 3 : 4.5)) issues.lowContrast.push(`${el.textContent.trim().slice(0, 24)} (${ratio.toFixed(2)}${op < .95 ? ', op ' + op.toFixed(2) : ''})`); } } }
    const layer = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement){ const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
    const covered = el => { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false; const x = r.left + r.width / 2, y = Math.max(1, Math.min(r.top + r.height / 2, innerHeight - 1)); const h = document.elementFromPoint(x, y); return h && !el.contains(h) && !h.contains(el) && !(layer(el) === null && h.closest('.actionbar,.bottomnav,.topnav,.navfade,.ab-in')); };
    const ctrls = [...document.querySelectorAll('button, a, input, textarea, [role=switch]')].filter(vis).filter(el => !el.closest('.leaving') && !covered(el));
    for (const el of ctrls){ const r = el.getBoundingClientRect(); if ((r.width < 40 || r.height < 40) && !el.matches('.st-tap')) issues.smallTargets.push(`${(el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`); }
    for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++){ const a = ctrls[i], b = ctrls[j]; if (a.contains(b) || b.contains(a)) continue; if (a.matches('.st-tap') || b.matches('.st-tap')) continue;
      const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 4 && oy > 4 && !!layer(a) !== !!layer(b)){ const f = layer(a) ? a : b, fr = f.getBoundingClientRect(); if (!(scrollY < 2 && fr.top + fr.height / 2 < innerHeight / 2)) continue; }
      if (ox > 4 && oy > 4) issues.overlapsBtn.push(`${(a.getAttribute('aria-label') || a.textContent.trim()).slice(0, 18)} × ${(b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 18)}`); }
    const sy = scrollY; scrollTo(0, 1e6);
    if (document.documentElement.scrollHeight > innerHeight + 2){
      const cs2 = [...document.querySelectorAll('button, a, input, textarea, [role=switch]')].filter(vis).filter(el => !el.closest('.leaving') && !covered(el));
      const fx = cs2.filter(e => { if (!layer(e)) return false; const r = e.getBoundingClientRect(); return r.top + r.height / 2 > innerHeight / 2; }), fl = cs2.filter(e => !layer(e));
      for (const a of fx) for (const b of fl){ if (a.contains(b) || b.contains(a)) continue; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (ox > 4 && oy > 4) issues.overlapsBtn.push(`[end of scroll] ${(a.getAttribute('aria-label') || a.textContent.trim()).slice(0, 18)} × ${(b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 18)}`); } }
    scrollTo(0, sy);
    return issues; }
};
