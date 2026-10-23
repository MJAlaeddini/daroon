import './styles/fonts.css';
import './styles/base.css';
import './styles/app.css';
import './events';
import { refreshAvatar } from './features/account';
import { buildU, staticState } from './sculpture/engine';
import { mini } from './sculpture/traces';
import { frame } from './stage/stage';
import { S } from './state/app';
import { DB, load, reindex } from './state/store';
import { go, renderView } from './ui/render';
import { ACT } from './actions';
import { engine } from './stage/stage';
import { todayKey } from '@daroon/shared';
import { applyTheme } from './ui/theme';

/* ═════════════════════════ boot ═════════════════════════ */
document.documentElement.lang = 'fa'; document.documentElement.dir = 'rtl';
load(); reindex(); applyTheme(false); refreshAvatar();
if (!DB.account && !DB.loginDone) S.view = 'login';
renderView();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('e2e')) (window as any).__daroon = { S, DB, engine, go, ACT, todayKey };
try { mini.draw(buildU(staticState({ items: [], neutral: 1, seed: 0 }), .5, .7)); } catch (e){} /* compile the trace shader before the first calendar needs it */
