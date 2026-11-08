import './styles/fonts.css';
import './styles/base.css';
import './styles/app.css';
import './styles/auth.css';
import './events';
import { loadAuthConfig, pullStories, refreshAvatar, sessionExpired } from './features/account';
import { onSessionExpired, onSynced, startSync } from './features/sync';
import { renderTraceNow } from './sculpture/traces';
import { loadArt } from './stone/art';
import { frame } from './stage/stage';
import { S } from './state/app';
import { DB, load, reindex } from './state/store';
import { go, renderView } from './ui/render';
import { ACT } from './actions';
import { engine } from './stage/stage';
import { todayKey } from '@daroon/shared';
import { applyTheme } from './ui/theme';
import { setupPwa } from './pwa';
import { setupChrome } from './ui/chrome';
import { setupHaptics } from './ui/haptics';
import { setupGlide } from './ui/glide';
import { setupPress } from './ui/press';
import { setupEntrySwipe } from './ui/entry-swipe';
import { setupInstall } from './features/install';
import { setupSwipe } from './ui/swipe';

/* ═════════════════════════ boot ═════════════════════════ */
document.documentElement.lang = 'fa';
document.documentElement.dir = 'rtl';
const E2E = new URLSearchParams(location.search).has('e2e');
/* the browser tests get a fixed set of sample entries; real use starts empty */
load(E2E ? (await import('./state/sample')).sampleEntries : undefined);
if (DB.account && !DB.account.id) DB.account = null; /* a sample account from the prototype */
reindex();
applyTheme(false);
refreshAvatar();
if (!DB.account && !DB.loginDone) S.view = 'login';
renderView();
requestAnimationFrame(frame);

/* account & sync: the app works fully offline; the server only adds sign-in, sync and written stories */
loadAuthConfig();
onSessionExpired(sessionExpired);
onSynced((changed) => {
  refreshAvatar();
  if (changed && ['today', 'archive', 'patterns'].includes(S.view) && !S.sheet && !S.story && !S.done)
    renderView({ quiet: true });
});
startSync();
setupPwa();
setupInstall({ auto: !E2E });
setupSwipe();
setupChrome();
setupHaptics();
setupGlide();
setupPress();
setupEntrySwipe();
if (DB.account) pullStories();
if (E2E) (window as any).__daroon = { S, DB, engine, go, ACT, todayKey };
/* load the stones' art and compile the still shader before the first calendar needs them */
void loadArt().then(() => {
  try {
    renderTraceNow({ items: [] }, 16);
  } catch (e) {}
});
