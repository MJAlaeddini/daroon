import { jOfKey, weekStart } from '@daroon/shared';
import { $ } from '../core/util';
import { engine } from '../stage/stage';
import { S, isWide } from '../state/app';
import { refreshArchive } from './render';
import { openDaySheet, refreshArchiveSelOnly } from './sheets';

export function selectDay(k, openSheetMobile = true){
  const A = S.arch; A.sel = k; S.confirmDel = null;
  const j = jOfKey(k), c = jOfKey(A.cursor);
  if (A.mode === 'month' && (j.jy !== c.jy || j.jm !== c.jm)) A.cursor = k; if (A.mode === 'week' && weekStart(k) !== weekStart(A.cursor)) A.cursor = k;
  if (isWide() || A.mode === 'week'){ refreshArchive(); engine.pulse(.3, 300); requestAnimationFrame(() => { const b = $(`#calGrid [data-day="${k}"]`); b && b.focus({ preventScroll: true }); }); }
  else { refreshArchiveSelOnly(); if (openSheetMobile) openDaySheet(k); }
}
