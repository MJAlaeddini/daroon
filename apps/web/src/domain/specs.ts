import { clamp, hashStr } from '../core/util';
import { dayList } from '../state/store';

/* specs: the emotional composition shown by a sculpture or a trace */
export function aggregate(list, seedStr: string){
  const cnt = new Map(); let un = 0;
  list.forEach((e, idx) => { if (!e.emotions.length) un++; e.emotions.forEach(x => { const c = cnt.get(x.key) || { n: 0, last: -1, color: null }; c.n++; c.last = idx; c.color = x.color || c.color; cnt.set(x.key, c); }); });
  const items = [...cnt.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last).slice(0, 3).map(([key, c]) => ({ key, color: c.color }));
  return { items, neutral: items.length ? clamp(un / Math.max(1, list.length) * .6) : 1, seed: hashStr(seedStr) / 4294967296 };
}
export const daySpec = k => aggregate(dayList(k), k);
export const entrySpec = e => ({ items: e.emotions.slice(0, 3).map(x => ({ key: x.key, color: x.color })), neutral: e.emotions.length ? 0 : 1, seed: hashStr(e.id) / 4294967296 });
