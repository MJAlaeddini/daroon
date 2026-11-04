/**
 * Trees are kept in this browser (localStorage) and can be taken out and brought back as JSON. On a first visit
 * the worked example is put in so there is something to look at.
 */
import type { Tree } from './model';
import { sampleTree } from './sample';

const KEY = 'shajara.v1';

export interface Saved {
  trees: Tree[];
  theme: 'auto' | 'light' | 'dark';
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Saved>;
      if (Array.isArray(d.trees)) return { trees: d.trees, theme: d.theme || 'auto' };
    }
  } catch {
    /* private mode or a broken entry: start fresh */
  }
  return { trees: [sampleTree()], theme: 'auto' };
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: the session keeps working in memory */
  }
}

/** Accepts a single tree or a list of trees from a JSON file. */
export function parseImport(text: string): Tree[] {
  const d = JSON.parse(text);
  const list = Array.isArray(d) ? d : Array.isArray(d?.trees) ? d.trees : [d];
  return list.filter(
    (t: Tree) =>
      t && typeof t.title === 'string' && Array.isArray(t.nodes) && t.nodes.every((n) => n && n.id && n.kind),
  );
}

export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
