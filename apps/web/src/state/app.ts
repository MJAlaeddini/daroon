import { jMonthLen, jOfKey, keyOfJ, todayKey, type SceneId } from '@daroon/shared';
import { guideMods } from '../domain/guide';
import { HOME_LABS, NEU_LABS } from '../domain/lexicon';
import { aggregate, daySpec } from '../domain/specs';
import { engine } from '../stage/stage';
import { dayList } from './store';
import { patternData } from '../views/patterns';

/* ═════════════════════════ app state ═════════════════════════ */
/** What the person is composing right now: up to three words, an optional context and note. */
export interface Draft {
  items: { key: string; parent: string | null; custom?: boolean; color?: string | null }[];
  suggested: string[];
  context: any;
  /** Who or what was around (ids from SCENE_IDS), at most two. */
  scenes: SceneId[];
  path: string | null;
  note: string;
  focus: number;
  palette: number;
}
export interface AppState {
  view: string;
  prev: string[];
  draft: Draft;
  guide: { step: string; q1: string | null; q2: string | null } | null;
  editing: string | null;
  arch: { mode: 'week' | 'month'; cursor: string; sel: string; jump: boolean; jy: number | null };
  pat: { range: number; mOff: number };
  customOpen: boolean;
  story: any;
  done: any;
  sheet: string | null;
  sheetReturn?: any;
  setPage?: string;
  confirmDel: string | null;
  lastDel: any;
  discardArm: boolean;
  wipeArm?: boolean;
  deleteArm?: boolean;
}
export const newDraft = (): Draft => ({
  items: [],
  suggested: [],
  context: null,
  scenes: [],
  path: null,
  note: '',
  focus: -1,
  palette: -1,
});
export const S: AppState = {
  customOpen: false,
  story: null,
  done: null,
  view: 'today',
  prev: [],
  draft: newDraft(),
  guide: null,
  editing: null,
  arch: {
    mode: jOfKey(todayKey()).jd <= 7 ? 'week' : 'month',
    cursor: todayKey(),
    sel: todayKey(),
    jump: false,
    jy: null,
  },
  pat: { range: 90, mOff: 0 },
  sheet: null,
  confirmDel: null,
  lastDel: null,
  discardArm: false,
};
export const isWide = () => matchMedia('(min-width: 700px)').matches;
export const FLOW = new Set(['explore', 'guide', 'reflect', 'login']);

export function syncEngine() {
  const v = S.view;
  let spec;
  if (v === 'archive') {
    if (isWide() || S.sheet === 'day' || S.arch.mode === 'week')
      spec = dayList(S.arch.sel).length ? daySpec(S.arch.sel) : { items: [], neutral: 1 };
    else {
      const j = jOfKey(S.arch.cursor);
      const list = [];
      for (let d = 1; d <= jMonthLen(j.jy, j.jm); d++) list.push(...dayList(keyOfJ(j.jy, j.jm, d)));
      spec = aggregate(list, 'm' + j.jy + j.jm);
    }
  } else if (v === 'patterns') spec = patternData().spec;
  else spec = { items: S.draft.items.map((i) => ({ key: i.key, color: i.color })), neutral: 0 };
  engine.setSpec(spec);
  engine.neuT = v === 'today' || v === 'login' ? HOME_LABS : NEU_LABS;
  engine.mod =
    v === 'guide'
      ? guideMods()
      : v === 'reflect'
        ? Object.assign(guideMods(), { coh: 0.14, sep: -0.12, turb: -0.08 })
        : {};
  if (v !== 'today') engine.hintMod = {};
}
