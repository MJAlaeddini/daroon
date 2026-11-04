/**
 * Places the nodes of a tree in rows, roots at the bottom and conclusions at the top, the way a tree grows. A node
 * sits one row above its highest premise; an objection sits beside the node it attacks. Within a row, nodes are
 * ordered by the mean position of what they connect to (a few up-and-down sweeps), which keeps lines from
 * crossing. Rows read right to left.
 */
import type { Node, Tree } from './model';

export interface Placed {
  node: Node;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
}
export interface Layout {
  placed: Map<string, Placed>;
  width: number;
  height: number;
}

export const CARD = { w: 196, h: 112, gapX: 26, gapY: 74 };

export function layout(tree: Tree): Layout {
  const by = new Map(tree.nodes.map((n) => [n.id, n]));
  const row = new Map<string, number>();
  const rowOf = (id: string, guard = new Set<string>()): number => {
    if (row.has(id)) return row.get(id)!;
    const n = by.get(id);
    if (!n || guard.has(id)) return 0;
    guard.add(id);
    let r = 0;
    if (n.kind === 'objection') r = n.from[0] && by.has(n.from[0]) ? rowOf(n.from[0], guard) : 0;
    else for (const p of n.from) if (by.has(p)) r = Math.max(r, rowOf(p, guard) + 1);
    row.set(id, r);
    return r;
  };
  tree.nodes.forEach((n) => rowOf(n.id));
  const top = Math.max(0, ...row.values());
  const rows: string[][] = [...Array(top + 1)].map(() => []);
  tree.nodes.forEach((n) => n.kind !== 'objection' && rows[row.get(n.id)!].push(n.id));

  const kids = new Map<string, string[]>();
  tree.nodes.forEach((n) => {
    if (n.kind === 'objection') return;
    n.from.forEach((p) => kids.set(p, [...(kids.get(p) || []), n.id]));
  });
  const pos = () => {
    const m = new Map<string, number>();
    rows.forEach((r) => r.forEach((id, i) => m.set(id, (i + 0.5) / r.length)));
    return m;
  };
  const sortBy = (r: string[], f: (id: string) => number | null) => {
    const keyed = r.map((id, i) => ({ id, k: f(id) ?? (i + 0.5) / r.length }));
    keyed.sort((a, b) => a.k - b.k);
    return keyed.map((x) => x.id);
  };
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  for (let it = 0; it < 6; it++) {
    for (let r = 1; r <= top; r++) {
      const p = pos();
      rows[r] = sortBy(rows[r], (id) =>
        mean(
          by
            .get(id)!
            .from.filter((x) => p.has(x))
            .map((x) => p.get(x)!),
        ),
      );
    }
    for (let r = top - 1; r >= 0; r--) {
      const p = pos();
      rows[r] = sortBy(rows[r], (id) => mean((kids.get(id) || []).filter((x) => p.has(x)).map((x) => p.get(x)!)));
    }
  }
  // objections go right after the node they attack
  tree.nodes
    .filter((n) => n.kind === 'objection')
    .forEach((o) => {
      const r = rows[row.get(o.id)!],
        at = r.indexOf(o.from[0]);
      r.splice(at < 0 ? r.length : at + 1, 0, o.id);
    });

  const { w, h, gapX, gapY } = CARD;
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const width = widest * (w + gapX) - gapX;
  const height = (top + 1) * (h + gapY) - gapY;
  const placed = new Map<string, Placed>();
  rows.forEach((r, ri) => {
    const span = r.length * (w + gapX) - gapX,
      x0 = (width - span) / 2;
    r.forEach((id, i) => {
      // right to left: the first in the row sits at the right
      const x = width - x0 - (i + 1) * w - i * gapX;
      placed.set(id, { node: by.get(id)!, x, y: (top - ri) * (h + gapY), w, h, row: ri });
    });
  });
  return { placed, width, height };
}

/** A soft vertical curve from the top of a premise to the bottom of what rests on it. */
export function edgePath(a: Placed, b: Placed): string {
  const x1 = a.x + a.w / 2,
    y1 = a.y,
    x2 = b.x + b.w / 2,
    y2 = b.y + b.h,
    k = Math.max(30, (y1 - y2) * 0.5);
  return `M${x1},${y1} C${x1},${y1 - k} ${x2},${y2 + k} ${x2},${y2}`;
}

/** An objection's line: from its side to the side of the node it attacks, bowing slightly. */
export function attackPath(o: Placed, t: Placed): string {
  const left = o.x < t.x;
  const x1 = left ? o.x + o.w : o.x,
    x2 = left ? t.x : t.x + t.w,
    y = o.y + o.h / 2,
    mid = (x1 + x2) / 2;
  return `M${x1},${y} C${mid},${y - 26} ${mid},${y - 26} ${x2},${y}`;
}
