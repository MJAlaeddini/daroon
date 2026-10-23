import { $ } from '../core/util';
import { habit, isDark, reduced } from '../sculpture/engine';
import { S } from '../state/app';
import { DB } from '../state/store';
import { IC } from './icons';
import { renderView } from './render';
import { fillDaySheet, refreshSettings } from './sheets';

/* theme */
export const hostTheme = document.documentElement.getAttribute('data-theme');
export function applyTheme(animate = true) {
  const root = document.documentElement,
    d = DB.settings.direction;
  if (animate) {
    root.classList.add('theming');
    setTimeout(() => root.classList.remove('theming'), 650);
  }
  root.removeAttribute('data-direction');
  if (d === 'night') root.dataset.theme = 'dark';
  else if (d === 'light') root.dataset.theme = 'light';
  else if (d === 'spectrum') {
    root.dataset.theme = 'dark';
    root.dataset.direction = 'spectrum';
  } else {
    hostTheme ? root.setAttribute('data-theme', hostTheme) : root.removeAttribute('data-theme');
  }
  $('#themeBtn').innerHTML = isDark() ? IC.sun : IC.moon;
  root.dataset.motion = reduced() ? 'reduced' : 'full';
  root.style.setProperty('--ds', (1 - 0.35 * habit()).toFixed(2));
  $('meta[name="theme-color"]').setAttribute('content', isDark() ? '#110e18' : '#f8f6f4');
}
export function themeChanged() {
  applyTheme(true);
  if (S.view !== 'explore' && S.view !== 'reflect' && S.view !== 'guide') renderView({ quiet: true });
  if (S.sheet === 'settings') refreshSettings();
  else if (S.sheet === 'day') fillDaySheet();
}
