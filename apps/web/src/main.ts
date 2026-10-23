import './styles/fonts.css';
import './styles/base.css';
import './styles/app.css';
import './styles/auth.css';
import './events';
import { loadAuthConfig, pullStories, refreshAvatar, sessionExpired } from './features/account';
import { onSessionExpired, onSynced, startSync } from './features/sync';
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
load();
if (DB.account && !DB.account.id) DB.account = null; /* a sample account from the prototype */
reindex(); applyTheme(false); refreshAvatar();
if (!DB.account && !DB.loginDone) S.view = 'login';
renderView();
requestAnimationFrame(frame);

/* account & sync: the app works fully offline; the server only adds sign-in, sync and written stories */
loadAuthConfig();
onSessionExpired(sessionExpired);
onSynced(changed => {
  refreshAvatar();
  if (changed && ['today', 'archive', 'patterns'].includes(S.view) && !S.sheet && !S.story && !S.done) renderView({ quiet: true });
});
startSync();
if (DB.account) pullStories();
if (new URLSearchParams(location.search).has('e2e')) (window as any).__daroon = { S, DB, engine, go, ACT, todayKey };
try { mini.draw(buildU(staticState({ items: [], neutral: 1, seed: 0 }), .5, .7)); } catch (e){} /* compile the trace shader before the first calendar needs it */
